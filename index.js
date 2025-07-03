const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  SlashCommandBuilder 
} = require("discord.js");
const express = require("express");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");

const app = express();

// Vérification des variables d'environnement
const { DISCORD_TOKEN: TOKEN, CLIENT_ID, GUILD_ID, PORT = 3000 } = process.env;
if (!TOKEN || !CLIENT_ID) {
  console.error("Il manque DISCORD_TOKEN ou CLIENT_ID !");
  process.exit(1);
}

// === Stockage des données de jeu ===
const DATA_FILE = path.join(__dirname, "pun_data.json");
let data = { guilds: {}, scores: {} };
if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    console.warn('Impossible de lire pun_data.json, réinitialisation des données.');
  }
}
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// === Définition des modes de recherche ===
const modes = [
  { name: "default", description: "Recherche standard (insensible à la casse, substring)" },
  { name: "wholeword", description: "Recherche par mot complet (insensible à la casse)" },
  { name: "exact", description: "Recherche exacte (sensible à la casse, substring)" },
  { name: "wholeword-exact", description: "Recherche par mot complet ET sensible à la casse" },
];

// === Création dynamique des slash commands ===
const slashCommands = [
  ...modes.map(mode =>
    new SlashCommandBuilder()
      .setName(mode.name)
      .setDescription(mode.description)
      .addStringOption(opt =>
        opt
          .setName("mot")
          .setDescription("Le mot à chercher")
          .setRequired(true)
      )
      .setDefaultPermission(true)
      .toJSON()
  ),
  // /rank pour afficher le classement
  new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Affiche le classement des joueurs au jeu de puns BOUH")
    .setDefaultPermission(true)
    .toJSON(),
];

// === Client Discord ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// === Canaux autorisés ===
const allowedChannels = [
  "1278672736910311465",
  "1284829796290793593",
  "1299853826001469561"
];

// === Événement ready ===
client.once("ready", async () => {
  console.log("Le bot est prêt !");
  console.log(`Connecté en tant que ${client.user.tag}`);
  client.user.setStatus("online");
  client.user.setActivity("En ligne !", { type: "PLAYING" });

  // Enregistrer les slash commands
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    console.log("Enregistrement des commandes slash...");
    if (GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: slashCommands }
      );
      console.log("Commandes enregistrées en scope guilde.");
    } else {
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: slashCommands }
      );
      console.log("Commandes enregistrées en scope global.");
    }
  } catch (error) {
    console.error("Erreur lors de l'enregistrement des slash-commands :", error);
  }
});

// === Gestion des interactions (slash commands) ===
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = interaction.commandName;

  // /rank affiche le classement
  if (cmd === 'rank') {
    const scores = data.scores;
    if (!scores || Object.keys(scores).length === 0) {
      await interaction.reply({ content: "Aucun joueur dans le classement.", ephemeral: true });
      return;
    }
    // Tri décroissant
    const sorted = Object.entries(scores).sort((a, b) => b[1].score - a[1].score);
    const lines = sorted.map(([userId, info], idx) =>
      `${idx + 1}. ${info.name}: ${info.score} pts`
    );
    await interaction.reply(`**Classement BOUH-tiques :**\n${lines.join("\n")}`);
    return;
  }

  // Recherche existante (modes)
  const mode = modes.find(m => m.name === cmd);
  if (!mode) return;
  const mot = interaction.options.getString("mot") ?? "";
  const scriptPath = path.join(__dirname, "g1000mots.sh");

  await interaction.deferReply({ ephemeral: true });
  execFile("bash", [scriptPath, mode.name, mot], (err, stdout) => {
    if (err) {
      interaction.editReply({ content: `Erreur : ${err.message}` });
    } else {
      interaction.editReply({ content: `Résultat :
\`\`\`bash
${stdout}
\`\`\`` });
    }
  });
});

// === Gestion des messages (puns + triggers classiques) ===
client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!allowedChannels.includes(message.channel.id)) return;

  const guildId = message.guild.id;
  const channelId = message.channel.id;
  const guildData = data.guilds[guildId] = data.guilds[guildId] || { channels: {} };
  const channelData = guildData.channels[channelId] = guildData.channels[channelId] || { currentRound: null, usedPuns: {} };
  const raw = message.content.trim();
  const lower = raw.toLowerCase();

  // -- Jeu de puns "BOUH" --
  if (lower.startsWith("bouh")) {
    channelData.currentRound = message.id;
    channelData.usedPuns = {};
    saveData();
    return;
  }
  // Réponse à la manche en cours
  if (message.reference && message.reference.messageId
      && message.reference.messageId === channelData.currentRound) {
    const pun = lower;
    if (channelData.usedPuns[pun]) {
      await message.channel.send(`Déjà fait par ${channelData.usedPuns[pun]}`);
    } else {
      channelData.usedPuns[pun] = message.author.username;
      // Mise à jour du score
      const uid = message.author.id;
      data.scores[uid] = data.scores[uid] || { name: message.author.username, score: 0 };
      data.scores[uid].score += 1;
      data.scores[uid].name = message.author.username;
      saveData();
    }
    return;
  }

  // --- Trigger et remplacements existants ---
  let newMessage = raw;
  let modified = false;
  // Remplacement "gé"
  if (/gé/i.test(newMessage)) {
    newMessage = newMessage
      .replaceAll(/([^[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])?:?gé(?![\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "$1-G-")
      .replaceAll(/gé/gi, "-G");
    modified = true;
  }
  // Réactions
  if (/myrtille|myrtilles/i.test(newMessage)) message.react("🫐").catch(() => {});
  if (/sanglier/i.test(newMessage)) message.react("🐗").catch(() => {});
  // Fin pour un utilisateur ciblé
  if (/oui oui bien sûr bien sûûûr/i.test(newMessage) && message.author.id === TARGET_USER_ID) {
    message.channel.send(messageFin).catch(() => {});
  }
  // Lien quantique
  if (/quantique/i.test(newMessage)) {
    newMessage = newMessage.replace(/quantique/gi,
      "[quan-tic tac](https://www.youtube.com/watch?v=fmvqz0_KFX0)");
    modified = true;
  }
  if (modified) {
    message.channel.send(newMessage)
      .then(sent => setTimeout(() => sent.delete().catch(() => {}), 30_000))
      .catch(() => {});
  }

  // Autres triggers courts
  switch (lower) {
    case /^quoi[!?]?$/.test(lower) && lower:
      message.channel.send("feur").catch(() => {});
      break;
    case /^bonne nuit[.!?]?$/.test(lower) && lower:
      message.channel.send("medbed activé !").catch(() => {});
      break;
    case /^(non)[.!?]?$/.test(lower) && lower:
      message.channel.send("bril").catch(() => {});
      break;
  }
});

// === Démarrage ===
client.login(TOKEN);
app.get("/", (req, res) => res.send("OK"));
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

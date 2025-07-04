const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  SlashCommandBuilder 
} = require("discord.js");
const express = require("express");
const path = require("path");
const { execFile } = require("child_process");

const app = express();

// Vérification des variables d'environnement
const { DISCORD_TOKEN: TOKEN, CLIENT_ID, GUILD_ID, PORT = 3000 } = process.env;
if (!TOKEN || !CLIENT_ID) {
  console.error("Il manque DISCORD_TOKEN ou CLIENT_ID !");
  process.exit(1);
}

// === Définition des modes de recherche ===
const modes = [
  { name: "default", description: "Recherche standard (insensible à la casse, substring)" },
  { name: "wholeword", description: "Recherche par mot complet (insensible à la casse)" },
  { name: "exact", description: "Recherche exacte (sensible à la casse, substring)" },
  { name: "wholeword-exact", description: "Recherche par mot complet ET sensible à la casse" },
];

// === Création dynamique des slash commands ===
const slashCommands = modes.map(mode =>
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
);

// === Client Discord ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// === Constantes et compteurs ===
const allowedChannels = [
  "1278672736910311465",
  "1284829796290793593",
  "1299853826001469561"
];
const TARGET_USER_ID = "819527758501642290";
let geReplacementCount = 0;
let myrtilleReactionCount = 0;
let sanglierReactionCount = 0;
let quoiCount = 0;
let nonCount = 0;
let quantiqueCount = 0;

const messageFin = `# GMilgram - C'est la fin !
Ça y est ! Tu as terminé toutes les énigmes de la communauté !  
Mais qui dit énigme dit Coffre... Que tu recevras par la Poste (cadeau, pas besoin de partir en pleine nuit avec une pelle...).  
||@everyone||`;

const SCORES_FILE = 'scores.json';
let scores = {};
let activeMessageId = null;
let usedWords = new Set();

// Chargement des scores
function loadScores() {
  if (fs.existsSync(SCORES_FILE)) {
    const raw = fs.readFileSync(SCORES_FILE);
    scores = JSON.parse(raw);
  }
}

// Sauvegarde des scores
function saveScores() {
  fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2));
}

// === Événement ready ===
client.once("ready", () => {
  console.log("Le bot est prêt !");
  console.log(`Connecté en tant que ${client.user.tag}`);
  client.user.setStatus("online");
  client.user.setActivity("En ligne !", { type: "PLAYING" });
});

// === Enregistrement des slash commands ===
async function registerCommands() {
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
}
registerCommands();

// === Lyllit Game – version simplifiée ===
// === Lyllit Game – version simplifiée avec .rank prioritaire ===
const replyCounts = {};    // pour compter les réponses par partie
const usedContents = {};   // pour stocker les contenus déjà vus

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.toLowerCase();

  // 0) Classement : toujours pris en compte en priorité
  if (content.startsWith(".rank")) {
    if (Object.keys(scores).length === 0) {
      return await message.channel.send("Aucun score pour l’instant.");
    }

    const entries = Object.entries(scores)
      .sort(([, a], [, b]) => b - a);

    const lines = entries.map(([userId, score], i) => {
      const user = client.users.cache.get(userId);
      const name = user ? user.username : `Inconnu (${userId})`;
      return `${i + 1}. **${name}** : ${score} point${score !== 1 ? 's' : ''}`;
    });

    return await message.channel.send("**🏆 Classement :**\n" + lines.join("\n"));
  }

  // 1) Lancement de la partie “BOUH”
  if (content.includes("bouh") && !message.reference) {
    activeMessageId = message.id;
    replyCounts[activeMessageId] = 0;
    usedContents[activeMessageId] = new Set();
    return await message.channel.send("👻 Partie lancée ! Répondez au `BOUH` initial.");
  }

  // 2) Traitement des trois premières réponses
  if (
    activeMessageId &&
    message.reference?.messageId === activeMessageId &&
    replyCounts[activeMessageId] < 3
  ) {
    const replyContent = content.trim();
    const userId = message.author.id;

    if (usedContents[activeMessageId].has(replyContent)) {
      scores[userId] = (scores[userId] || 0) - 1;
      await message.channel.send(`❌ Contenu déjà posté : **${message.content}**`);
    } else {
      usedContents[activeMessageId].add(replyContent);
      scores[userId] = (scores[userId] || 0) + 1;
      await message.react("✅");
    }

    saveScores();
    replyCounts[activeMessageId]++;
    return;
  }

  // (Pas de else ici : tout autre message est ignoré)
});

// === Gestion des slash commands ===
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const mode = interaction.commandName;
  if (!modes.find(m => m.name === mode)) return;

  const mot = interaction.options.getString("mot") ?? "";
  const scriptPath = path.join(__dirname, "g1000mots.sh");

  // Acknowledge the command
  await interaction.deferReply({ ephemeral: true });

  execFile("bash", [scriptPath, mode, mot], (err, stdout, stderr) => {
    if (err) {
      interaction.editReply({ content: `Erreur lors de l'exécution : ${err.message}` });
    } else {
      interaction.editReply({ content: `-# Recherche en cours...${stdout}` });
    }
  });
});

// === Gestion principale des messages ===
client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!allowedChannels.includes(message.channel.id)) return;

  let newMessage = message.content;
  let modified = false;

  // Remplacement de "gé"
  if (/gé/i.test(newMessage)) {
    newMessage = newMessage
      .replaceAll(/([^[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])?gé(?![\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "$1-G-")
      .replaceAll(/gé(?![\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "G-")
      .replaceAll(/(^|[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])gé(?=[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "$1G")
      .replaceAll(/gé/gi, "-G");
    geReplacementCount++;
    modified = true;
  }

  // Réaction myrtille
  if (/myrtilles?/i.test(newMessage)) {
    try { await message.react("🫐"); myrtilleReactionCount++; } catch {}
  }

  // Réaction sanglier
  if (/sangliers?/i.test(newMessage)) {
    try { await message.react("🐗"); sanglierReactionCount++; } catch {}
  }

  // Message de fin pour l'utilisateur ciblé
  if (/oui oui bien sûr bien sûûûr/i.test(newMessage) && message.author.id === TARGET_USER_ID) {
    try { await message.channel.send(messageFin); } catch {}
  }

  // Lien quantique
  if (/quantique/i.test(newMessage)) {
    newMessage = newMessage.replace(/quantique/gi, "[quan-tic tac](https://www.youtube.com/watch?v=fmvqz0_KFX0)");
    quantiqueCount++;
    modified = true;
  }

  // Envoi et suppression si modifié
  if (modified) {
    try {
      const sent = await message.channel.send(newMessage);
      setTimeout(() => sent.delete().catch(() => {}), 30_000);
    } catch {}
  }
});

// === Gestion des triggers courts ===
client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!allowedChannels.includes(message.channel.id)) return;

  const raw = message.content.trim().toLowerCase();

  if (/^.*quoi[ .!?]*$/i.test(raw)) {
    try { await message.channel.send("feur."); quoiCount++; } catch {}
    return;
  }
  if (/^.*non[ .!?]*$/i.test(raw)) {
    try { await message.channel.send("bril."); nonCount++; } catch {}
    return;
  }
  if (/^.*bonne nuit.*$/i.test(raw)) {
    try { await message.channel.send("Medbed activé !"); } catch {}
    return;
  }
});

// === Démarrage ===
client.login(TOKEN);
app.get("/", (req, res) => res.send("OK"));
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

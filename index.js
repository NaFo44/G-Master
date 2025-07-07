function logsDateSeverity(severityCode) {
    let severity;
    switch (severityCode) {
        case 'C':
            severity = 'CRT';
            break;
        case 'E':
            severity = 'ERR';
            break;
        case 'W':
            severity = 'WRN';
            break;
        case 'I':
            severity = 'INF';
            break;
        case 'D':
            severity = 'DBG';
            break;
        default:
            severity = 'UNK';
    }

    const currentDateTime = new Date();
    // Formater la date et l'heure pour le fuseau horaire de Paris
    const options = {
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };

    const formatter = new Intl.DateTimeFormat('fr-FR', options);
    const parts = formatter.formatToParts(currentDateTime);

    // Extraction des éléments de la date
    let year, month, day, hour, minute, second;
    parts.forEach(part => {
        switch (part.type) {
            case 'year': year = part.value; break;
            case 'month': month = part.value; break;
            case 'day': day = part.value; break;
            case 'hour': hour = part.value; break;
            case 'minute': minute = part.value; break;
            case 'second': second = part.value; break;
        }
    });
    return `[${year}-${month}-${day} ${hour}:${minute}:${second}]\t${severity}\t`;
}


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
const fs = require("fs");

const app = express();

// Vérification des variables d'environnement
const { DISCORD_TOKEN: TOKEN, CLIENT_ID, GUILD_ID, PORT = 3000 } = process.env;
if (!TOKEN) {
    console.log(logsDateSeverity("C") + "Variable d'environnement DISCORD_TOKEN non définie");
    process.exit(1);
}
if (!CLIENT_ID) {
    console.log(logsDateSeverity("C") + "Variable d'environnement CLIENT_ID non définie");
    process.exit(1);
}
const SCORES_FILE = process.env.SCORES_FILE || "scores.json";
const TARGET_USER_ID = process.env.TARGET_USER_ID || "819527758501642290";

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
//let geReplacementCount = 0;
//let myrtilleReactionCount = 0;
//let sanglierReactionCount = 0;
//let quoiCount = 0;
//let nonCount = 0;
//let quantiqueCount = 0;

const messageFin = `# GMilgram - C'est la fin !
Ça y est ! Tu as terminé toutes les énigmes de la communauté !  
Mais qui dit énigme dit Coffre... Que tu recevras par la Poste (cadeau, pas besoin de partir en pleine nuit avec une pelle...).  
||@everyone||`;

let scores = {};
let activeMessageId = null;
//let usedWords = new Set();

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
  console.log(logsDateSeverity("I") + "Le bot est prêt !");
  console.log(logsDateSeverity("I") + "Connecté en tant que " + client.user.tag);
  client.user.setStatus("online");
  client.user.setActivity("En ligne !", { type: "PLAYING" });
});

// === Enregistrement des slash commands ===
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    console.log(logsDateSeverity("I") + "Enregistrement des commandes slash...");
    if (GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: slashCommands }
      );
      console.log(logsDateSeverity("I") + "Commandes enregistrées en scope guilde.");
    } else {
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: slashCommands }
      );
      console.log(logsDateSeverity("I") + "Commandes enregistrées en scope global.");
    }
  } catch (error) {
    console.error(logsDateSeverity("E") + "Erreur lors de l'enregistrement des slash-commands :", error);
  }
}
registerCommands();

// === Lylitt Game – version simplifiée ===
// === Lylitt Game – version simplifiée avec .rank prioritaire ===
const replyCounts = {};    // pour compter les réponses par partie
const usedContents = {};   // pour stocker les contenus déjà vus

client.on('messageCreate', async (message) => {
  loadScores();
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

  console.log(logsDateSeverity("I") + "Recherche du texte \"" + mot + "\" en mode \"" + mode + "\"");

  const scriptPath = path.join(__dirname, "g1000mots.sh");

  // Acknowledge the command
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  execFile("bash", [scriptPath, mode, mot], (err, stdout, stderr) => {
    if (err) {
      console.log(logsDateSeverity("E") + "Erreur (\"" + err + "\") lors de l'exécution du script (\"" + scriptPath + "\") : " + stderr);
      interaction.editReply({ content: "Erreur, merci de réessayer plus tard. Si le problème persiste, contacter @TARDIgradeS ou un modo :sweat_smile:" });
    } else {
      console.log(logsDateSeverity("I") + "Script exécuté correctement");
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
    console.log(logsDateSeverity("I") + "Remplacement d'un ou plusieurs \"gé\"");
    newMessage = newMessage
      .replaceAll(/([^[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])?gé(?![\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "$1-G-")
      .replaceAll(/gé(?![\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "G-")
      .replaceAll(/(^|[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])gé(?=[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "$1G")
      .replaceAll(/gé/gi, "-G");
    //geReplacementCount++;
    modified = true;
  }

  // Réaction myrtille
  if (/myrtilles?/i.test(newMessage)) {
    console.log(logsDateSeverity("I") + "Ajout d'une myrtille en tant que réaction");
    try {
      await message.react("🫐");
      //myrtilleReactionCount++;
    } catch {
      console.log(logsDateSeverity("E") + "Impossible d'ajouter une myrtille en tant que réaction");
    }
  }

  // Réaction sanglier
  if (/sangliers?/i.test(newMessage)) {
    console.log(logsDateSeverity("I") + "Ajout d'un sanglier en tant que réaction");
    try {
      await message.react("🐗");
      //sanglierReactionCount++;
    } catch {
      console.log(logsDateSeverity("E") + "Impossible d'ajouter un sanglier en tant que réaction");
    }
  }

  // Message de fin pour l'utilisateur ciblé
  if (/oui oui bien sûr bien sûûûr/i.test(newMessage) && message.author.id === TARGET_USER_ID) {
    console.log(logsDateSeverity("I") + "Envoi du *message de fin*");
    try {
      await message.channel.send(messageFin);
    } catch {
      console.log(logsDateSeverity("E") + "Impossible d'envoyer le *message de fin*");
    }
  }

  // Lien quantique
  if (/quantique/i.test(newMessage)) {
    console.log(logsDateSeverity("I") + "Remplacement d'un ou plusieurs \"quantique\"");
    newMessage = newMessage.replace(/quantique/gi, "[quan-tic tac](https://www.youtube.com/watch?v=fmvqz0_KFX0)");
    //quantiqueCount++;
    modified = true;
  }

  // Envoi et suppression si modifié
  if (modified) {
    console.log(logsDateSeverity("I") + "Envoi du message modifié");
    try {
      const sent = await message.channel.send(newMessage);
      setTimeout(() => sent.delete().catch(() => {}), 30_000);
    } catch {
      console.log(logsDateSeverity("E") + "Impossible d'envoyer le message modifié");
    }
  }
});

// === Gestion des triggers courts ===
client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!allowedChannels.includes(message.channel.id)) return;

  const raw = message.content.trim().toLowerCase();

  if (/^.*quoi[ .!?]*$/i.test(raw)) {
    console.log(logsDateSeverity("I") + "Réponse à un \"quoi\" par un \"feur.\"");
    try {
      await message.channel.send("feur.");
      //quoiCount++;
    } catch {
      console.log(logsDateSeverity("E") + "Impossible d'envoyer le \"feur.\"");
    }
    return;
  }
  if (/^.*non[ .!?]*$/i.test(raw)) {
    console.log(logsDateSeverity("I") + "Réponse à un \"non\" par un \"bril.\"");
    try {
      await message.channel.send("bril.");
      //nonCount++;
    } catch {
      console.log(logsDateSeverity("E") + "Impossible d'envoyer le \"bril.\"");
    }
    return;
  }
  if (/^.*bonne nuit.*$/i.test(raw)) {
    console.log(logsDateSeverity("I") + "Réponse à un \"bonne nuit\" par un \"Medbed activé !\"");
    try {
      await message.channel.send("Medbed activé !");
    } catch {
      console.log(logsDateSeverity("E") + "Impossible d'envoyer le \"Medbed activé !\"");
    }
    return;
  }
});

// === Démarrage ===
client.login(TOKEN);
app.get("/", (req, res) => res.send("OK"));
app.listen(PORT, () => console.log(logsDateSeverity("I") + "Le serveur tourne sur le port " + PORT));

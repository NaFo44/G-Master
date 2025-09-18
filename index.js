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
  SlashCommandBuilder,
  MessageFlags
} = require("discord.js");
const express = require("express");
const path = require("path");
const { execFile } = require("child_process");
const fs = require("fs");
const app = express();

// Vérification des variables d'environnement
const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID, PORT = 3000 } = process.env;
if (!DISCORD_TOKEN) {
    console.log(logsDateSeverity("C") + "Général : variable d'environnement DISCORD_TOKEN non définie");
    process.exit(1);
}
if (!CLIENT_ID) {
    console.log(logsDateSeverity("C") + "Général : variable d'environnement CLIENT_ID non définie");
    process.exit(1);
}
const SCORES_FILE = process.env.SCORES_FILE || "scores.json";
const USED_CONTENTS_FILE = process.env.USED_CONTENTS_FILE || "used_contents.json";
const TARGET_USER_ID = process.env.TARGET_USER_ID || "819527758501642290";
const LYLITT_USER_ID = process.env.LYLITT_USER_ID || "460073251352346624";

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
let initialAuthorId = null;

// Chargement des scores
function loadScores() {
  if (fs.existsSync(SCORES_FILE)) {
    const raw = fs.readFileSync(SCORES_FILE);
    scores = JSON.parse(raw);
    console.log(logsDateSeverity("I") + "Lylitt Game : chargement des scores");
  }
}
// Sauvegarde des scores
function saveScores() {
  fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2));
  console.log(logsDateSeverity("I") + "Lylitt Game : sauvegarde des scores");
}

// Chargement des réponses déjà envoyées
function loadUsedContents() {
  if (fs.existsSync(USED_CONTENTS_FILE)) {
    const raw = fs.readFileSync(USED_CONTENTS_FILE);
    const data = JSON.parse(raw);
    Object.keys(data).forEach(key => {
      usedContents[key] = new Set(data[key]);
    });
    console.log(logsDateSeverity("I") + "Lylitt Game : chargement des réponses déjà envoyées");
  }
}
// Sauvegarde des réponses déjà envoyées
function saveUsedContents() {
  fs.writeFileSync(USED_CONTENTS_FILE, JSON.stringify(usedContents, (key, value) => {
    if (value instanceof Set) {
      return Array.from(value);
    }
    return value;
  }), null, 2);
  console.log(logsDateSeverity("I") + "Lylitt Game : sauvegarde des réponses déjà envoyées");
}


// === Événement ready ===
client.once("ready", () => {
  console.log(logsDateSeverity("I") + "Général : le bot est prêt et connecté en tant que \"" + client.user.tag + "\"");
  client.user.setStatus("online");
  client.user.setActivity("En ligne !", { type: "PLAYING" });
});

// === Enregistrement des slash commands ===
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  try {
    console.log(logsDateSeverity("I") + "Commandes slash : enregistrement des commandes slash");
    if (GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: slashCommands }
      );
      console.log(logsDateSeverity("I") + "Commandes slash : commandes enregistrées en scope guilde");
    } else {
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: slashCommands }
      );
      console.log(logsDateSeverity("I") + "Commandes slash : commandes enregistrées en scope global");
    }
  } catch (error) {
    console.error(logsDateSeverity("E") + "Commandes slash : erreur lors de l'enregistrement des commandes slash (\"" + error + "\")");
  }
}
registerCommands();

// === Lylitt Game – version simplifiée ===
// === Lylitt Game – version simplifiée avec .rank prioritaire ===
const replyCounts = {};    // pour compter les réponses par partie
const usedContents = {};   // pour stocker les contenus déjà vus

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.toLowerCase();

  // 0) Classement : toujours pris en compte en priorité
  if (content === '.rank') {
    loadScores();
    loadUsedContents();
    console.log(logsDateSeverity("I") + "Lylitt Game : demande d'affichage du classement");

    // Gestion de la suppression du message de demande d'affichage du rank
    try {
//      if (message.guild?.me?.permissionsIn(message.channel).has('ManageMessages')) {
        await message.delete();
//      } else {
//        console.log(logsDateSeverity("E") + "Lylitt Game : permission 'ManageMessages' manquante, impossible de supprimer le message demandant l'affichage du rank");
//      }
    } catch (err) {
      console.log(logsDateSeverity("E") + "Lylitt Game : impossible de supprimer le message demandant l'affichage du rank");
    }

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

    const sent = await message.channel.send("**🏆 Classement :**\n" + lines.join('\n'));
    setTimeout(async () => {
      try {
        await sent.edit('**🏆 Classement (top 5) :**\n' + lines.slice(0, 5).join('\n'));
        console.log(`${logsDateSeverity('I')} Lylitt Game : message de classement édité (top 5) après 30s`);
      } catch (err) {
        console.log(`${logsDateSeverity('E')} Lylitt Game : échec de l’édition du message de classement (top 5)`);
      }
    }, 30_000);
  }

  // 1) Lancement de la partie “BOUH”
  if (message.author.id === LYLITT_USER_ID && content.includes("bouh") && !message.reference) {
    loadScores();
    loadUsedContents();
    activeMessageId = message.id;
    initialAuthorId = message.author.id;
    replyCounts[activeMessageId] = 0;
    usedContents[activeMessageId] = new Set();
    console.log(logsDateSeverity("I") + "Lylitt Game : lancement d'une partie après détection d'un \"BOUH\"");
    return await message.channel.send("👻 Partie lancée ! Répondez au `BOUH` initial.");
  }

  // 2) Traitement des trois premières réponses
  if (
    activeMessageId &&
    message.author.id !== initialAuthorId &&
    message.reference?.messageId === activeMessageId &&
    replyCounts[activeMessageId] < 3
  ) {
    loadScores();
    loadUsedContents();
    console.log(logsDateSeverity("I") + "Lylitt Game : analyse d'une réponse (" + (replyCounts[activeMessageId] + 1) + "/3)");
    const replyContent = content.trim();
    const userId = message.author.id;

    if (usedContents[activeMessageId].has(replyContent)) {
      scores[userId] = (scores[userId] || 0) - 1;
      console.log(logsDateSeverity("I") + "Lylitt Game : envoi de la réaction à une réponse déjà postée");
      try {
        await message.react("❌");
        await message.react("🇩");
        await message.react("🇪");
        await message.react("🇯");
        await message.react("🇦");
        await message.react("▪️");
        await message.react("🇵");
        await message.react("🇴");
        await message.react("🇸");
        await message.react("🇹");
        await message.react("3️⃣");
      } catch (error) {
        console.log(logsDateSeverity("E") + "Lylitt Game : impossible d'envoyer la réaction à une réponse déjà postée : " + error + "\"");
      }
    } else {
      usedContents[activeMessageId].add(replyContent);
      saveUsedContents();
      scores[userId] = (scores[userId] || 0) + 1;
      console.log(logsDateSeverity("I") + "Lylitt Game : envoi de la réaction à une réponse validée");
      try {
        await message.react("✅");
      } catch (error) {
        console.log(logsDateSeverity("E") + "Lylitt Game : impossible d'envoyer la réaction à une réponse validée : " + error + "\"");
      }
      replyCounts[activeMessageId]++;
      saveScores();
    }
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

  console.log(logsDateSeverity("I") + "G fait mes propres recherches : recherche de \"" + mot + "\" en mode \"" + mode + "\"");

  const scriptPath = path.join(__dirname, "g1000mots.sh");

  // Acknowledge the command
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  execFile("bash", [scriptPath, mode, mot], (err, stdout, stderr) => {
    if (err) {
      console.log(logsDateSeverity("E") + "G fait mes propres recherches : erreur (\"" + err + "\") lors de l'exécution du script (\"" + scriptPath + "\") : " + stderr);
      interaction.editReply({ content: "Erreur, merci de réessayer plus tard. Si le problème persiste, contacter @TARDIgradeS ou un modo :sweat_smile:" });
    } else {
      console.log(logsDateSeverity("I") + "G fait mes propres recherches : script exécuté correctement");
      interaction.editReply({ content: `-# Recherche en cours...${stdout}` });
    }
  });
});

// === Gestion principale des messages ===
client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!allowedChannels.includes(message.channel.id)) return;

  let newMessage = message.content;

  // Message de fin pour l'utilisateur ciblé
  if (/oui oui bien sûr bien sûûûr/i.test(newMessage) && message.author.id === TARGET_USER_ID) {
    console.log(logsDateSeverity("I") + "Fin de chasse : envoi du message");
    try {
      await message.channel.send(messageFin);
    } catch {
      console.log(logsDateSeverity("E") + "Fin de chasse : impossible d'envoyer le message");
    }
  }

  // Réactions :
  // Myrtille(s) :
  if (/myrtilles?/i.test(newMessage)) {
    console.log(logsDateSeverity("I") + "Myrtille(s) : ajout d'une réaction");
    try {
      await message.react("🫐");
      //myrtilleReactionCount++;
    } catch {
      console.log(logsDateSeverity("E") + "Myrtille(s) : impossible d'ajouter une réaction");
    }
  }
  // Sanglier(s) :
  if (/sangliers?/i.test(newMessage)) {
    console.log(logsDateSeverity("I") + "Sanglier(s) : ajout d'une réaction");
    try {
      await message.react("🐗");
      //sanglierReactionCount++;
    } catch {
      console.log(logsDateSeverity("E") + "Sanglier(s) : impossible d'ajouter une réaction");
    }
  }

  // Remplacements :
  let modified = false;
  // "gé" --> "G" :
  if (/gé/i.test(newMessage)) {
    console.log(logsDateSeverity("I") + "gé/G : remplacement d'au moins 1 occurence");
    newMessage = newMessage
      .replaceAll(/([^[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])?gé(?![\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "$1-G-")
      .replaceAll(/gé(?![\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "G-")
      .replaceAll(/(^|[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])gé(?=[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "$1G")
      .replaceAll(/gé/gi, "-G");
    //geReplacementCount++;
    modified = true;
  }
  // "quantique" --> "quan-tic tac" + lien :
  if (/quantique/i.test(newMessage)) {
    console.log(logsDateSeverity("I") + "Quantique/quan-tic tac : remplacement d'au moins 1 occurence");
    newMessage = newMessage.replace(/quantique/gi, "[quan-tic tac](https://www.youtube.com/watch?v=fmvqz0_KFX0)");
    //quantiqueCount++;
    modified = true;
  }
  // Envoi + suppression du message modifié
  if (modified) {
    console.log(logsDateSeverity("I") + "Message modifié : envoi du message");
    try {
      const sent = await message.channel.send(newMessage);
      setTimeout(() => sent.delete().catch(() => {}), 30_000);
    } catch {
      console.log(logsDateSeverity("E") + "Message modifié : impossible d'envoyer le message");
    }
  }

  // Envoi d'images de bouffe si un "j'ai faim" est détecté
  if (/j'ai faim/i.test(newMessage)) {
    const images_bouffe = [
      "https://lelocalapizzas.fr/wp-content/uploads/2023/04/pizza-saumon-creme-fraiche-recette.jpg",
      "https://burgerkingfrance.twic.pics/custom-pages/2024/20241028_MastersPerennes/produit_1_1.png",
      "https://dxm.dam.savencia.com/api/wedia/dam/variation/fix635d9eidk9muu7yq33zuescmdts13b7bw94o/savencia_2000_webp",
      "https://marcwiner.com/wp-content/uploads/2024/09/brochettes-teriyaki-en-tete-750x563.jpg",
      "https://assets.afcdn.com/recipe/20211222/126196_w1024h768c1cx896cy845cxt0cyt0cxb2121cyb1414.jpg",
      "https://odelices.ouest-france.fr/images/recettes/2015/glace_au_chocolat-1024x1081.jpg"
    ];
    const image_bouffe = images_bouffe[Math.floor(Math.random() * images_bouffe.length)];
    try {
      await message.reply(image_bouffe);
    } catch (err) {
        console.log(logsDateSeverity("E") + "Image de bouffe : impossible d'envoyer l'image");
    }
  }
});

// === Gestion des triggers courts ===
client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!allowedChannels.includes(message.channel.id)) return;

  const raw = message.content;

  if (/^.*quoi[ .!?]*$/i.test(raw)) {
    console.log(logsDateSeverity("I") + "quoi/feur : envoi d'une réponse");
    try {
      await message.channel.send("feur.");
      //quoiCount++;
    } catch {
      console.log(logsDateSeverity("E") + "quoi/feur : impossible d'envoyer la réponse");
    }
    return;
  }
  if (/^.*oui[ .!?]*$/i.test(raw)) {
    console.log(logsDateSeverity("I") + "oui/stiti : envoi d'une réponse");
    try {
      await message.channel.send("stiti.");
    } catch {
      console.log(logsDateSeverity("E") + "oui/stiti : impossible d'envoyer la réponse");
    }
    return;
  }
  if (/^.*non[ .!?]*$/i.test(raw)) {
    console.log(logsDateSeverity("I") + "non/bril : envoi d'une réponse");
    try {
      await message.channel.send("bril.");
      //nonCount++;
    } catch {
      console.log(logsDateSeverity("E") + "non/bril : impossible d'envoyer la réponse");
    }
    return;
  }
  if (/^.*bonne nuit.*$/i.test(raw)) {
    console.log(logsDateSeverity("I") + "bonne nuit/Medbed activé ! : envoi d'une réponse");
    try {
      await message.channel.send("Medbed activé !");
    } catch {
      console.log(logsDateSeverity("E") + "bonne nuit/Medbed activé ! : impossible d'envoyer la réponse");
    }
    return;
  }
});

// === Démarrage ===
client.login(DISCORD_TOKEN);
app.get("/", (req, res) => res.send("OK"));
app.listen(PORT, () => console.log(logsDateSeverity("I") + "Général : le serveur tourne sur le port " + PORT));

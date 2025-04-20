const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  SlashCommandBuilder 
} = require("discord.js");
const express = require("express");
const fs = require("fs");
const path = require("path");
const { exec: _exec } = require("child_process");
const { promisify } = require("util");

const exec = promisify(_exec);
const app = express();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Utilisez la variable d'environnement pour le token
const TOKEN = process.env.DISCORD_TOKEN;

// Liste des ID des salons spécifiques où le bot doit intervenir
const allowedChannels = [
  "1278672736910311465",
  "1284829796290793593",
  "1299853826001469561"
];
const TARGET_USER_ID = "819527758501642290";

// Compteurs de statistiques
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

client.once("ready", () => {
  console.log("Le bot est prêt !");
  console.log(`Connecté en tant que ${client.user.tag}`);
  client.user.setStatus("online");
  client.user.setActivity("En ligne !", { type: "PLAYING" });
});

// === Slash command /search ===

const searchCommand = new SlashCommandBuilder()
  .setName("search")
  .setDescription("Cherche un mot dans les fichiers .tsv")
  .addStringOption(opt =>
    opt
      .setName("mot")
      .setDescription("Le mot à chercher")
      .setRequired(true)
  )
  .setDefaultPermission(true)
  .toJSON();

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    console.log("Enregistrement des commandes slash...");
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: [searchCommand] }
    );
    console.log("Commandes slash enregistrées.");
  } catch (error) {
    console.error("Erreur lors de l'enregistrement :", error);
  }
}
registerCommands();

// === Gestion des slash commands ===

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "search") return;

  const keyword   = interaction.options.getString("mot");
  const scriptPath = path.join(__dirname, "g1000mots.sh");
  const command    = `${scriptPath} "${keyword}"`;

  // On lance simplement le script sans répondre ni logger
  exec(command);
});

// === Gestion des messages textuels ===

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!allowedChannels.includes(message.channel.id)) return;

  let newMessage = message.content;
  let modified = false;

  // Remplacement de "gé"
  if (newMessage.toLowerCase().includes("gé")) {
    newMessage = newMessage
      .replaceAll(
        /([^[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])gé(?![[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi,
        "$1-G-"
      )
      .replaceAll(/gé(?![[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "G-")
      .replaceAll(
        /(^|[[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])gé(?=[[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi,
        "$1G"
      )
      .replaceAll(/(?!^|[[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])gé/gi, "-G");
    geReplacementCount++;
    modified = true;
  }

  // Réaction myrtille
  if (/myrtille|myrtilles/i.test(newMessage)) {
    try {
      await message.react("🫐");
      myrtilleReactionCount++;
    } catch {}
  }

  // Réaction sanglier
  if (newMessage.toLowerCase().includes("sanglier")) {
    try {
      await message.react("🐗");
      sanglierReactionCount++;
    } catch {}
  }

  // Message de fin pour l'utilisateur ciblé
  if (
    newMessage.toLowerCase().includes("oui oui bien sûr bien sûûûr") &&
    message.author.id === TARGET_USER_ID
  ) {
    try {
      await message.channel.send(messageFin);
    } catch {}
  }

  // Lien quantique
  if (newMessage.toLowerCase().includes("quantique")) {
    newMessage = newMessage.replace(
      /quantique/gi,
      "[quan-tic tac](<https://www.youtube.com/watch?v=fmvqz0_KFX0>)"
    );
    quantiqueCount++;
    modified = true;
  }

  // "quoi" → "feur"
  const words = newMessage.split(/\s+/);
  const lastWord = words[words.length - 1].toLowerCase();
  if (["quoi", "quoi?", "quoi ?", "quoi "].includes(lastWord)) {
    try {
      await message.channel.send("feur");
      quoiCount++;
    } catch {}
  }

  // "non" → "bril"
  if (["non", "non.", "non "].includes(lastWord)) {
    try {
      await message.channel.send("bril");
      nonCount++;
    } catch {}
  }

  // Si on a modifié le message, on l'envoie et le supprime au bout de 30s
  if (modified) {
    try {
      const sentMessage = await message.channel.send(newMessage);
      setTimeout(() => {
        sentMessage.delete().catch(() => {});
      }, 30_000);
    } catch {}
  }
});

// Connexion au bot + serveur HTTP
client.login(TOKEN);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

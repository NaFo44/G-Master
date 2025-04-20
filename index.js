const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags
} = require("discord.js");
const express = require("express");
const fs = require("fs");
const path = require("path");

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
const allowedChannels = ["1278672736910311465", "1284829796290793593", "1299853826001469561"];
const TARGET_USER_ID = '819527758501642290';

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

// --- Fonctions de recherche (portage du code Python) ---

/**
 * Extrait l'ID YouTube entre crochets, ex: [X0T52QoB-1Q]
 */
function extraireIdYoutube(nomFichier) {
  const match = nomFichier.match(/\[([A-Za-z0-9_-]{11})\]/);
  return match ? match[1] : null;
}

/**
 * Convertit les millisecondes en format hh:mm:ss
 */
function msToHms(ms) {
  const secondes = Math.floor(ms / 1000);
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const s = secondes % 60;
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

/**
 * Cherche un mot dans tous les fichiers .tsv du dossier donné.
 * Renvoie un tableau de chaînes formatées pour Discord.
 */
function chercherDansFichiers(mot, dossierPath) {
  mot = mot.toLowerCase();
  const resultats = [];
  let fichiers;
  try {
    fichiers = fs.readdirSync(dossierPath);
  } catch (err) {
    console.error(`Impossible de lire ${dossierPath}:`, err);
    return [];
  }

  for (const nomFichier of fichiers) {
    if (!nomFichier.toLowerCase().endsWith('.tsv')) continue;
    const fullPath = path.join(dossierPath, nomFichier);
    let contenu;
    try {
      contenu = fs.readFileSync(fullPath, 'utf-8');
    } catch (err) {
      console.error(`Erreur lecture de ${nomFichier}`, err);
      continue;
    }

    for (const ligne of contenu.split(/\r?\n/)) {
      if (!ligne.toLowerCase().includes(mot)) continue;
      const parties = ligne.split('\t');
      if (parties.length < 3) continue;

      const startMs = parseInt(parties[0], 10);
      const endMs   = parseInt(parties[1], 10);
      const texte   = parties.slice(2).join('\t');

      const idYoutube = extraireIdYoutube(nomFichier);
      if (idYoutube) {
        const lien     = `https://www.youtube.com/watch?v=${idYoutube}&t=${Math.floor(startMs/1000)}s`;
        const titre    = nomFichier.replace(`[${idYoutube}]`, '').replace('.tsv','').trim();
        const timecode = `${msToHms(startMs)} → ${msToHms(endMs)}`;
        resultats.push(`- [${titre}](${lien}) (${timecode}) : ${texte}`);
      } else {
        resultats.push(`- ${nomFichier} (${startMs}–${endMs}) : ${texte}`);
      }
    }
  }

  return resultats;
}

// --- Slash command /search ---

const searchCommand = new SlashCommandBuilder()
  .setName("search")
  .setDescription("Cherche un mot dans les fichiers .tsv")
  .addStringOption(opt => opt
    .setName("mot")
    .setDescription("Le mot à chercher")
    .setRequired(true))
  .toJSON();

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: [searchCommand] }
    );
    console.log("Commandes slash enregistrées.");
  } catch (err) {
    console.error("Erreur enregistrement slash:", err);
  }
}
registerCommands();

client.once("ready", () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
  client.user.setStatus('online');
  client.user.setActivity("Recherche TSV", { type: "PLAYING" });
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "search") return;

  const keyword = interaction.options.getString("mot");
  const dataDir = path.join(__dirname, "data");

  // On supprime les miniatures YouTube
  await interaction.deferReply({ flags: MessageFlags.SuppressEmbeds });

  const resultats = chercherDansFichiers(keyword, dataDir);
  if (resultats.length === 0) {
    return interaction.editReply({
      content: `Aucun résultat pour « ${keyword} ».`,
      flags: MessageFlags.SuppressEmbeds
    });
  }

  // Pagination (15 résultats par page)
  const pageSize = 15;
  const pages = [];
  for (let i = 0; i < resultats.length; i += pageSize) {
    pages.push(resultats.slice(i, i + pageSize).join("\n"));
  }
  let currentPage = 0;

  const buildRow = () => new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId("prev")
        .setLabel("◀ Précédent")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("Suivant ▶")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === pages.length - 1)
    );

  const reply = await interaction.editReply({
    content: `**Résultats pour « ${keyword} » (page ${currentPage+1}/${pages.length}) :**\n${pages[currentPage]}`,
    components: pages.length > 1 ? [ buildRow() ] : [],
    flags: MessageFlags.SuppressEmbeds
  });

  if (pages.length <= 1) return;

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 5 * 60 * 1000, // 5 minutes
  });

  collector.on("collect", async i => {
    if (i.user.id !== interaction.user.id) {
      return i.reply({ content: "Seul·e l'auteur·rice de la recherche peut naviguer.", ephemeral: true });
    }
    await i.deferUpdate();

    if (i.customId === "prev" && currentPage > 0) {
      currentPage--;
    } else if (i.customId === "next" && currentPage < pages.length - 1) {
      currentPage++;
    }

    await interaction.editReply({
      content: `**Résultats pour « ${keyword} » (page ${currentPage+1}/${pages.length}) :**\n${pages[currentPage]}`,
      components: [ buildRow() ],
      flags: MessageFlags.SuppressEmbeds
    });
  });

  collector.on("end", async () => {
    // désactive les boutons quand le temps est écoulé
    const disabledRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId("prev").setLabel("◀ Précédent").setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId("next").setLabel("Suivant ▶").setStyle(ButtonStyle.Secondary).setDisabled(true)
      );
    await interaction.editReply({ components: [ disabledRow ] });
  });
});

// === Gestion des messages textuels ===

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!allowedChannels.includes(message.channel.id)) return;

  let newMessage = message.content;
  let modified = false;

  // Remplacement de "gé"
  if (newMessage.toLowerCase().includes("gé")) {
    newMessage = newMessage
      .replaceAll(/([^[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])gé(?![[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "$1-G-")
      .replaceAll(/gé(?![[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "G-")
      .replaceAll(/(^|[[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])gé(?=[[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "$1G")
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

  // Message de fin pour l'utilisateur cible
  if (newMessage.toLowerCase().includes("oui oui bien sûr bien sûûûr") && message.author.id === TARGET_USER_ID) {
    try {
      await message.channel.send(messageFin);
    } catch {}
  }

  // Lien quantique
  if (newMessage.toLowerCase().includes("quantique")) {
    newMessage = newMessage.replace(/quantique/gi,
      "[quan-tic tac](<https://www.youtube.com/watch?v=fmvqz0_KFX0>)"
    );
    quantiqueCount++;
    modified = true;
  }

  // "quoi" -> "feur"
  const words = newMessage.split(/\s+/);
  const lastWord = words[words.length - 1].toLowerCase();
  if (["quoi", "quoi?", "quoi ", "quoi ?"].includes(lastWord)) {
    try {
      await message.channel.send("feur");
      quoiCount++;
    } catch {}
  }

  // "non" -> "bril"
  if (["non", "non.", "non "].includes(lastWord)) {
    try {
      await message.channel.send("bril");
      nonCount++;
    } catch {}
  }

  // Envoi du message modifié puis suppression
  if (modified) {
    try {
      const sent = await message.channel.send(newMessage);
      setTimeout(() => {
        sent.delete().catch(() => {});
      }, 30_000);
    } catch {}
  }
});

// Connexion et serveur HTTP
client.login(TOKEN);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server démarré sur le port ${PORT}`);
});

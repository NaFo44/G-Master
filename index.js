const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
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
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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
        console.error(`Impossible de lire le dossier ${dossierPath}:`, err);
        return [];
    }

    for (const nomFichier of fichiers) {
        if (!nomFichier.toLowerCase().endsWith('.tsv')) continue;
        const fullPath = path.join(dossierPath, nomFichier);
        let contenu;
        try {
            contenu = fs.readFileSync(fullPath, 'utf-8');
        } catch (err) {
            console.error(`Erreur lecture de ${nomFichier} :`, err);
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
                const lien    = `https://www.youtube.com/watch?v=${idYoutube}&t=${Math.floor(startMs/1000)}s`;
                const titre   = nomFichier.replace(`[${idYoutube}]`, '').replace('.tsv', '').trim();
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
    .addStringOption(option =>
        option.setName("mot")
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

client.once("ready", () => {
    console.log("Le bot est prêt !");
    console.log(`Connecté en tant que ${client.user.tag}`);
    client.user.setStatus('online');
    client.user.setActivity('En ligne !', { type: 'PLAYING' });
});

client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "search") return;

    const keyword = interaction.options.getString("mot");
    const dataDir = path.join(__dirname, "data"); // Adaptez selon l'emplacement réel

    await interaction.deferReply();

    const resultats = chercherDansFichiers(keyword, dataDir);

    if (resultats.length === 0) {
        await interaction.editReply(`Aucun résultat trouvé pour « ${keyword} ».`);
    } else {
        const affichage = resultats.slice(0, 10).join("\n");
        let footer = "";
        if (resultats.length > 10) {
            footer = `\net ${resultats.length - 10} autres résultat${resultats.length - 10 > 1 ? "s" : ""}...`;
        }
        await interaction.editReply(`**Résultats pour « ${keyword} » :**\n${affichage}${footer}`);
    }
});

// === Gestion des messages textuels (inchangé) ===
// ... (conservez la suite de votre code pour les réactions et transformations)

client.login(TOKEN);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

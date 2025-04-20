const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const express = require("express");
const fs = require("fs");
const { exec } = require("child_process");
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

client.once("ready", () => {
    console.log("Le bot est prêt !");
    console.log(`Connecté en tant que ${client.user.tag}`);
    client.user.setStatus('online');
    client.user.setActivity('En ligne !', { type: 'PLAYING' });
});

// === Slash command /search ===

const searchCommand = new SlashCommandBuilder()
    .setName("search")
    .setDescription("Cherche un mot dans les fichiers .tsv")
    .addStringOption(option =>
        option.setName("mot")
            .setDescription("Le mot à chercher")
            .setRequired(true)
    )
    .setDefaultPermission(true)  // Assure-toi que la permission par défaut est `true`
    .toJSON();

async function registerCommands() {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    try {
        console.log("Enregistrement des commandes slash...");
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID), // Remplace applicationGuildCommands par applicationCommands
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
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "search") {
        const keyword = interaction.options.getString("mot");

        // Chemin absolu vers ton script
        const scriptPath = path.join(__dirname, "/home/tardis/Documents/g1000mots.sh");

        // Commande à exécuter
        const command = `ls -l`;

        // Réponse initiale pour montrer que le bot bosse
        await interaction.deferReply();

        // Exécution du script
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Erreur d'exécution: ${error.message}`);
                interaction.editReply("Une erreur est survenue lors de l'exécution du script.");
                return;
            }

            if (stderr) {
                console.warn(`stderr: ${stderr}`);
            }
        });
    }
});

// === Gestion des messages textuels ===
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!allowedChannels.includes(message.channel.id)) return;

    let newMessage = message.content;
    let modified = false;

    if (newMessage.toLowerCase().includes("gé")) {
        console.log("G detected");
        newMessage = newMessage
            .replaceAll(/([^[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])gé(?![[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "$1-G-")
            .replaceAll(/gé(?![[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "G-")
            .replaceAll(/(^|[[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])gé(?=[[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "$1G")
            .replaceAll(/(?!^|[[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])gé/gi, "-G");
        console.log("G modified");
        geReplacementCount++;
        console.log(`Compteur de remplacement de "gé" : ${geReplacementCount}`);
        modified = true;
    }

    if (/myrtille|myrtilles/i.test(newMessage)) {
        try {
            await message.react("🫐");
            console.log("Blue berry added");
            myrtilleReactionCount++;
            console.log(`Compteur de réactions "myrtille" : ${myrtilleReactionCount}`);
        } catch (error) {
            console.error("Erreur lors de l'ajout de la réaction :", error);
        }
    }

    if (newMessage.toLowerCase().includes("sanglier")) {
        try {
            await message.react("🐗");
            console.log("Sanglier added");
            sanglierReactionCount++;
            console.log(`Compteur de réactions "sanglier" : ${sanglierReactionCount}`);
        } catch (error) {
            console.error("Erreur lors de l'ajout de la réaction :", error);
        }
    }

    if (newMessage.toLowerCase().includes("oui oui bien sûr bien sûûûr") && message.author.id === TARGET_USER_ID) {
        try {
            await message.channel.send(messageFin);
            console.log("Chasse terminée");
        } catch (error) {
            console.error("Erreur lors de l'envoi du message final :", error);
        }
    }

    if (newMessage.toLowerCase().includes("quantique")) {
        newMessage = newMessage.replace(/quantique/gi, "[quan-tic tac](<https://www.youtube.com/watch?v=fmvqz0_KFX0>)");
        quantiqueCount++;
        console.log(`Compteur de Quantique : ${quantiqueCount}`);
        modified = true;
    }

    const words = newMessage.split(/\s+/);
    const lastWord = words[words.length - 1].toLowerCase();

    if (["quoi", "quoi?", "quoi ", "quoi ?"].includes(lastWord)) {
        try {
            await message.channel.send("feur");
            quoiCount++;
            console.log(`Compteur de "quoi" : ${quoiCount}`);
        } catch (error) {
            console.error("Erreur lors de l'envoi de 'feur' :", error);
        }
    }

    if (["non", "non.", "non "].includes(lastWord)) {
        try {
            await message.channel.send("bril");
            nonCount++;
            console.log(`Compteur de "non" : ${nonCount}`);
        } catch (error) {
            console.error("Erreur lors de l'envoi de 'bril' :", error);
        }
    }

    if (modified) {
        try {
            const sentMessage = await message.channel.send(newMessage);
            setTimeout(() => {
                sentMessage.delete().catch(err => console.error("Erreur suppression :", err));
            }, 30000);
        } catch (err) {
            console.error("Erreur lors de l'envoi du message modifié :", err);
        }
    }
});

// Connexion au bot
client.login(TOKEN);

// Écouter sur un port spécifique
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

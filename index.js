const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");
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
const allowedChannels = ["1278672736910311465", "1284829796290793593", "1278662594135330841"]];

// Compteurs de statistiques
let geReplacementCount = 0;
let myrtilleReactionCount = 0;
let sanglierReactionCount = 0;
let quoiCount = 0;
let nonCount = 0;
let quantiqueCount = 0;

client.once("ready", () => {
    console.log("Le bot est prêt !");
});

// Gère les messages texte
client.on("messageCreate", async (message) => {
    if (message.author.bot) return; // Ne pas répondre aux bots
    if (!allowedChannels.includes(message.channel.id)) return; // Vérifie si le message provient d'un salon autorisé

    let newMessage = message.content;
    let modified = false;

    // Remplace "gé"
    if (newMessage.toLowerCase().includes("gé")) {
        newMessage = newMessage
            .replaceAll(/([^[\]\s.,\/#!$%\^&\*;:{}=\-_~()'"])gé(?![[\]\s.,\/#!$%\^&\*;:{}=\-_~()'"]|$)/gi, "$1-G-")
            .replaceAll(/gé(?![[\]\s.,\/#!$%\^&\*;:{}=\-_~()'"]|$)/gi, "G-")
            .replaceAll(/(^|[[\]\s.,\/#!$%\^&\*;:{}=\-_~()'"])gé(?=[[\]\s.,\/#!$%\^&\*;:{}=\-_~()'"]|$)/gi, "$1G")
            .replaceAll(/(?!^|[[\]\s.,\/#!$%\^&\*;:{}=\-_~()'"])gé/gi, "-G");
        geReplacementCount++;
        console.log(`Compteur de remplacement de "gé" : ${geReplacementCount}`);
        modified = true;
    }

    // Réactions pour "myrtille" et "sanglier"
    if (/myrtille|myrtilles/i.test(newMessage)) {
        try {
            await message.react("🫐");
            myrtilleReactionCount++;
            console.log(`Compteur de réactions "myrtille" : ${myrtilleReactionCount}`);
        } catch (error) {
            console.error("Erreur lors de l'ajout de la réaction :", error);
        }
    }

    if (newMessage.toLowerCase().includes("sanglier")) {
        try {
            await message.react("🐗");
            sanglierReactionCount++;
            console.log(`Compteur de réactions "sanglier" : ${sanglierReactionCount}`);
        } catch (error) {
            console.error("Erreur lors de l'ajout de la réaction :", error);
        }
    }

    // Remplacement de "quantique"
    if (newMessage.toLowerCase().includes("quantique")) {
        newMessage = newMessage.replace(
            /quantique/gi,
            "[quan-tic tac](<https://www.youtube.com/watch?v=fmvqz0_KFX0>)"
        );
        quantiqueCount++;
        console.log(`Compteur de "quantique" : ${quantiqueCount}`);
        modified = true;
    }

    // Réponses pour "quoi" et "non"
    const words = newMessage.split(/\s+/);
    const lastWord = words[words.length - 1].toLowerCase();

    if (["quoi", "quoi?", "quoi ?", "quoi."].includes(lastWord)) {
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

    // Envoie un message modifié si nécessaire
    if (modified) {
        try {
            const sentMessage = await message.channel.send(newMessage);
            setTimeout(() => {
                sentMessage.delete().catch((err) => console.error("Erreur lors de la suppression du message :", err));
            }, 30000);
        } catch (err) {
            console.error("Erreur lors de l'envoi du message :", err);
        }
    }
});

// Commandes vocales (rejoindre et quitter)
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
} = require("@discordjs/voice");
const googleTTS = require("google-tts-api");
const fs = require("fs");
const path = require("path");

const authorizedUserId = "1043860463903051846"; // Ton ID Discord ici

client.on("messageCreate", async (message) => {
    if (message.author.id !== authorizedUserId) return;

    if (message.content === "!join") {
        const connection = joinVoiceChannel({
            channelId: message.member.voice.channel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
        });
        message.reply("Je suis connecté au canal vocal !");
    }

    if (message.content === "!leave") {
        const connection = message.guild.voice?.connection;
        if (connection) {
            connection.destroy();
            message.reply("Déconnecté du canal vocal !");
        } else {
            message.reply("Je ne suis pas connecté à un canal vocal !");
        }
    }

    // Lecture audio pour chaque message
    if (message.guild.voice?.connection) {
        const text = message.content;
        const audioUrl = googleTTS.getAudioUrl(text, { lang: "fr", slow: false });
        const tempFile = path.join(__dirname, "message.mp3");

        const response = await fetch(audioUrl);
        const buffer = await response.buffer();
        fs.writeFileSync(tempFile, buffer);

        const player = createAudioPlayer();
        const resource = createAudioResource(tempFile);

        player.play(resource);
        message.guild.voice.connection.subscribe(player);

        player.on(AudioPlayerStatus.Idle, () => {
            fs.unlinkSync(tempFile);
        });
    }
});

// Connexion au bot
client.login(TOKEN);

// Écouter sur un port spécifique
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

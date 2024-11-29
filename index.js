const { 
    Client, 
    GatewayIntentBits 
} = require("discord.js");
const express = require("express");
const app = express();

const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus 
} = require("@discordjs/voice");
const googleTTS = require("google-tts-api");
const fs = require("fs");
const path = require("path");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ],
});

const TOKEN = process.env.DISCORD_TOKEN;
const allowedChannels = ["1278672736910311465", "1284829796290793593", "1278662594135330841"];
const authorizedUserId = "1043860463903051846"; // Ton ID Discord ici
let stats = {
    geReplacementCount: 0,
    myrtilleReactionCount: 0,
    sanglierReactionCount: 0,
    quoiCount: 0,
    nonCount: 0,
    quantiqueCount: 0
};

client.once("ready", () => {
    console.log("Le bot est prêt !");
});

// Fonctions pour les messages
client.on("messageCreate", async (message) => {
    if (message.author.bot || !allowedChannels.includes(message.channel.id)) return;

    let newMessage = message.content;
    let modified = false;

    if (newMessage.toLowerCase().includes("gé")) {
        newMessage = newMessage
            .replaceAll(/([^[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])gé(?![[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "$1-G-")
            .replaceAll(/gé(?![[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "G-")
            .replaceAll(/(^|[[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])gé(?=[[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "$1G")
            .replaceAll(/(?!^|[[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])gé/gi, "-G");
        stats.geReplacementCount++;
        modified = true;
    }

    if (/myrtille|myrtilles/i.test(newMessage)) {
        await message.react("🫐");
        stats.myrtilleReactionCount++;
    }

    if (newMessage.toLowerCase().includes("sanglier")) {
        await message.react("🐗");
        stats.sanglierReactionCount++;
    }

    if (newMessage.toLowerCase().includes("quantique")) {
        newMessage = newMessage.replace(
            /quantique/gi,
            "[quan-tic tac](<https://www.youtube.com/watch?v=fmvqz0_KFX0>)"
        );
        stats.quantiqueCount++;
        modified = true;
    }

    const words = newMessage.split(/\s+/);
    const lastWord = words[words.length - 1].toLowerCase();

    if (["quoi", "quoi?", "quoi ", "quoi ?"].includes(lastWord)) {
        await message.channel.send("feur");
        stats.quoiCount++;
    }

    if (["non", "non.", "non "].includes(lastWord)) {
        await message.channel.send("bril");
        stats.nonCount++;
    }

    if (modified) {
        const sentMessage = await message.channel.send(newMessage);
        setTimeout(() => sentMessage.delete().catch(console.error), 30000);
    }
});

// Commandes vocales
async function joinVoice(message) {
    if (!message.member.voice.channel) {
        return message.reply("Vous devez être dans un canal vocal !");
    }

    return joinVoiceChannel({
        channelId: message.member.voice.channel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
    });
}

client.on("messageCreate", async (message) => {
    if (message.author.id !== authorizedUserId) return;

    if (message.content === "!join") {
        const connection = await joinVoice(message);
        if (connection) {
            message.reply("Je suis connecté au canal vocal !");
        }
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

    if (message.guild.voice?.connection) {
        const text = message.content;
        const audioUrl = googleTTS.getAudioUrl(text, {
            lang: "fr",
            slow: false,
            host: "https://translate.google.com",
        });

        const tempFile = path.join(__dirname, "message.mp3");
        const response = await fetch(audioUrl);
        const buffer = await response.buffer();
        fs.writeFileSync(tempFile, buffer);

        const player = createAudioPlayer();
        const resource = createAudioResource(tempFile);
        player.play(resource);
        message.guild.voice.connection.subscribe(player);

        player.on(AudioPlayerStatus.Idle, () => fs.unlinkSync(tempFile));
    }
});

// Connexion au bot
client.login(TOKEN);

// Serveur express
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

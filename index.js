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
const allowedChannels = ["1278672736910311465", "1284829796290793593"];

client.once("ready", () => {
    console.log("Le bot est prêt !");
});

// Ajout du heartbeat pour garder l'instance active
setInterval(() => {
    console.log('Heartbeat');
}, 60000); // Toutes les 5s

client.on("messageCreate", async (message) => {
    // Ne pas répondre aux messages du bot lui-même
    if (message.author.bot) return;

    // Vérifie si le message provient d'un salon autorisé
    if (!allowedChannels.includes(message.channel.id)) return;

    // Détermine si le message contient "gé", "myrtille", ou "quantique"
    let newMessage = message.content;
    let modified = false;

    // Remplace "gé" par "G-" au début ou milieu, et "-G" à la fin d'un mot
    if (newMessage.toLowerCase().includes("gé")) {
        console.log("G detected");
        newMessage = newMessage
            .replaceAll(/([^[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])gé(?![[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "$1-G-")
            .replaceAll(/gé(?![[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "G-")
            .replaceAll(/(^|[[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])gé(?=[[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "$1G") // gé alone
            .replaceAll(/(?!^|[[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])gé/gi, "-G");
            console.log("G modified");
        modified = true;
    }

    // Ajoute une réaction lorsque le mot "myrtille" ou "myrtilles" est détecté
    if (/myrtille|myrtilles/i.test(newMessage)) {
        try {
            const reactionEmoji = "🫐"; // Utilise le code Unicode de l'emoji
            await message.react(reactionEmoji);
            console.log("Blue berry added");
        } catch (error) {
            console.error("Erreur lors de l'ajout de la réaction :", error);
        }
    }

    // Ajoute une réaction lorsque le mot "sanglier" est détecté
    if (newMessage.toLowerCase().includes("sanglier")) {
        try {
            const reactionEmoji = "🐗"; // Utilise le code Unicode de l'emoji
            await message.react(reactionEmoji);
            console.log("Sanglier added");
        } catch (error) {
            console.error("Erreur lors de l'ajout de la réaction :", error);
        }
    }

    // Remplace "quantique" par "quantic tac"
    if (newMessage.toLowerCase().includes("quantique")) {
        newMessage = newMessage.replace(
            /quantique/gi,
            "[quan-tic tac](<https://www.youtube.com/watch?v=fmvqz0_KFX0>)",
        );
        modified = true;
    }

    const words = newMessage.split(/\s+/);
    const lastWord = words[words.length - 1].toLowerCase();
    if (lastWord === "quoi" || lastWord === "quoi?" || lastWord === "quoi " || lastWord === "quoi ?") {
        try {
            await message.channel.send("feur");
        } catch (error) {
            console.error("Erreur lors de l'envoi du message :", error);
        }
    }

    if (lastWord === "non" || lastWord === "non." || lastWord === "non ") {
        try {
            await message.channel.send("bril");
        } catch (error) {
            console.error("Erreur lors de l'envoi du message :", error);
        }
    }

    // Si le message a été modifié, envoie le nouveau message et supprime-le après 10 secondes
    if (modified) {
        try {
            const sentMessage = await message.channel.send(newMessage);
            setTimeout(() => {
                sentMessage
                    .delete()
                    .catch((err) =>
                        console.error(
                            "Erreur lors de la suppression du message :",
                            err,
                        ),
                    );
            }, 30000); // 10 secondes
        } catch (err) {
            console.error("Erreur lors de l'envoi du message :", err);
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

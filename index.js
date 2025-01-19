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
const allowedChannels = ["1278672736910311465", "1284829796290793593", "1299853826001469561"];
const testchan = ["1299853826001469561"];
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
        geReplacementCount++; // Incrémente le compteur pour gé
        console.log(`Compteur de remplacement de "gé" : ${geReplacementCount}`);
        modified = true;
    }

    // Ajoute une réaction lorsque le mot "myrtille" ou "myrtilles" est détecté
    if (/myrtille|myrtilles/i.test(newMessage)) {
        try {
            const reactionEmoji = "🫐"; // Utilise le code Unicode de l'emoji
            await message.react(reactionEmoji);
            console.log("Blue berry added");
            myrtilleReactionCount++; // Incrémente le compteur pour myrtille
            console.log(`Compteur de réactions "myrtille" : ${myrtilleReactionCount}`);
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
            sanglierReactionCount++; // Incrémente le compteur pour sanglier
            console.log(`Compteur de réactions "sanglier" : ${sanglierReactionCount}`);
        } catch (error) {
            console.error("Erreur lors de l'ajout de la réaction :", error);
        }
    }

    // Le G a finis la chasse
    if (newMessage.toLowerCase().includes("oui oui bien sûr bien sûûûr")) {
        if (!testchan.includes(message.channel.id)) return;
        try {
            await message.channel.send("###BRAVOOO !!!!");
            console.log("Chasse terminée");
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
        quantiqueCount++;
        console.log(`Compteur de Quantique : ${quantiqueCount}`);
        modified = true;
    }

    const words = newMessage.split(/\s+/);
    const lastWord = words[words.length - 1].toLowerCase();

    // Ajoute "feur" si le message se termine par "quoi"
    if (lastWord === "quoi" || lastWord === "quoi?" || lastWord === "quoi " || lastWord === "quoi ?") {
        try {
            await message.channel.send("feur");
            quoiCount++; // Incrémente le compteur pour "quoi"
            console.log(`Compteur de "quoi" : ${quoiCount}`);
        } catch (error) {
            console.error("Erreur lors de l'envoi du message :", error);
        }
    }

    // Ajoute "bril" si le message se termine par "non"
    if (lastWord === "non" || lastWord === "non." || lastWord === "non ") {
        try {
            await message.channel.send("bril");
            nonCount++; // Incrémente le compteur pour "non"
            console.log(`Compteur de "non" : ${nonCount}`);
        } catch (error) {
            console.error("Erreur lors de l'envoi du message :", error);
        }
    }

    // Si le message a été modifié, envoie le nouveau message et supprime-le après 30 secondes
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
            }, 30000); // 30 secondes
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

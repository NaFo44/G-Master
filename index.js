const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require("discord.js");
const express = require("express");
const app = express();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID; // Remplacez par l'ID de votre bot
const GUILD_ID = process.env.GUILD_ID; // Remplacez par l'ID de votre serveur

// Stockage des scores des utilisateurs
const userScores = {};

// Réponses correctes (assurez-vous de remplir les valeurs pour chaque jour)
const correctAnswers = {
    1: "réponse1",
    2: "réponse2",
    3: "réponse3",
    // Ajoutez d'autres jours ici...
};

// Commande `/avent`
const commands = [
    new SlashCommandBuilder()
        .setName("avent")
        .setDescription("Répondez à l'énigme du jour pour gagner des points.")
        .addIntegerOption((option) =>
            option
                .setName("number")
                .setDescription("Le numéro du jour (1-24)")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("answer")
                .setDescription("Votre réponse à l'énigme")
                .setRequired(true),
        ),
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

// Enregistre les commandes slash
(async () => {
    try {
        console.log("Enregistrement des commandes slash...");
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
            body: commands,
        });
        console.log("Commandes enregistrées avec succès !");
    } catch (error) {
        console.error("Erreur lors de l'enregistrement des commandes :", error);
    }
})();

// Gère les commandes slash
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === "avent") {
        const dayNumber = interaction.options.getInteger("number");
        const userAnswer = interaction.options.getString("answer").toLowerCase();
        const userId = interaction.user.id;

        // Vérifie si le jour existe
        if (!correctAnswers[dayNumber]) {
            return interaction.reply("Ce jour n'a pas encore été défini !");
        }

        // Vérifie si la réponse est correcte
        if (userAnswer === correctAnswers[dayNumber].toLowerCase()) {
            // Incrémente le score de l'utilisateur
            userScores[userId] = (userScores[userId] || 0) + 1;

            return interaction.reply(`Bonne réponse ! Votre score est maintenant de ${userScores[userId]} point(s).`);
        } else {
            return interaction.reply("Mauvaise réponse !");
        }
    }
});

// Connexion au bot
client.once("ready", () => {
    console.log("Le bot est prêt !");
});

client.login(TOKEN).catch(error => {
    console.error("Erreur lors de la connexion au bot :", error);
});

// Écoute sur un port spécifique
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}).on('error', (error) => {
    console.error("Erreur lors de l'écoute du serveur :", error);
});

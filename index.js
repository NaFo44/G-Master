const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1284631073849872394';
const GUILD_ID = '1278662593656913930';

const bot = new Client({ intents: [GatewayIntentBits.Guilds] });

// Liste des réponses correctes (indexées par numéro d'énigme)
const correctAnswers = {
    1: "sapin",
    2: "cadeau",
    3: "neige",
    // Ajoute les 24 réponses ici...
};

// Scores des utilisateurs
const userScores = {};

// Inscription de la commande Slash
const commands = [
    new SlashCommandBuilder()
        .setName('avent')
        .setDescription("Répond à une question de l'avent.")
        .addIntegerOption(option => 
            option.setName('number')
                .setDescription("Numéro de la question (1-24)")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(24)
        )
        .addStringOption(option => 
            option.setName('answer')
                .setDescription("Votre réponse")
                .setRequired(true)
        )
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

// Enregistrement des commandes
(async () => {
    try {
        console.log('Enregistrement des commandes...');
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands },
        );
        console.log('Commandes enregistrées avec succès.');
    } catch (error) {
        console.error(error);
    }
})();

// Gestion des événements
bot.on('ready', () => {
    console.log(`Bot connecté en tant que ${bot.user.tag}`);
});

bot.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'avent') {
        const number = interaction.options.getInteger('number');
        const answer = interaction.options.getString('answer').toLowerCase();
        const userId = interaction.user.id;

        if (correctAnswers[number] && correctAnswers[number] === answer) {
            // Incrémente le score de l'utilisateur
            if (!userScores[userId]) userScores[userId] = 0;
            userScores[userId] += 1;

            await interaction.reply(`Bonne réponse ! 🎉 Votre score est maintenant de ${userScores[userId]}.`);
        } else {
            await interaction.reply("Mauvaise réponse. 😞 Essayez encore !");
        }
    }
});

bot.login(TOKEN);

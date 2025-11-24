import { logsDateSeverity, client } from "./src/utils.js";
import initGame from "./src/game.js";
import {
  handleMessage,
  handleMessageUpdate,
  messageReplyHandler,
} from "./src/messageHandlers.js";
import {
  REST,
  Routes,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import express from "express";
import path from "path";
import { execFile } from "child_process";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// environment configuration
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

// configuration and constants
const PORT = process.env.PORT || 3000;
const LOG_CHANNEL_ID = "1315805001603481660";
const modes = [
  { name: "default", description: "Recherche standard (insensible à la casse, substring)" },
  { name: "wholeword", description: "Recherche par mot complet (insensible à la casse)" },
  { name: "exact", description: "Recherche exacte (sensible à la casse, substring)" },
  { name: "wholeword-exact", description: "Recherche par mot complet ET sensible à la casse" },
];

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
const requiredEnvVars = [
  { name: "DISCORD_TOKEN", value: DISCORD_TOKEN },
  { name: "CLIENT_ID", value: CLIENT_ID },
  { name: "GUILD_ID", value: GUILD_ID },
];

for (const { name, value } of requiredEnvVars) {
  if (!value) {
    console.log(logsDateSeverity("C") + `Général : variable d'environnement ${name} non définie`);
    process.exit(1);
  }
}

// initializing express app
const app = express();

// dynamic creation of slash commands
const slashCommands = modes.map(mode =>
  new SlashCommandBuilder()
    .setName(mode.name)
    .setDescription(mode.description)
    .addStringOption(opt =>
      opt
        .setName("mot")
        .setDescription("Le mot à chercher")
        .setRequired(true)
    )
    .toJSON()
);

client.once("ready", async () => {
  console.log(
    logsDateSeverity("I") +
      `Général : le bot est prêt et connecté en tant que "${client.user.tag}"`
  );

  client.user.setStatus("online");
  client.user.setActivity("En ligne !", { type: "PLAYING" });

  try {
    const channel = await client.channels.fetch(LOG_CHANNEL_ID);

    if (channel && channel.isTextBased()) {
      await channel.send("le bot est démarré !");
    } else {
      console.log(
        logsDateSeverity("W") +
          "Startup msg : salon introuvable"
      );
    }
  } catch (err) {
    console.error(
      logsDateSeverity("E") +
        `Startup msg : impossible d'envoyer le message (${err})`
    );
  }
});

// slash command registration
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: slashCommands }
    );

    console.log(logsDateSeverity("I") + "Commandes slash : commandes enregistrées en scope global");
  } catch (error) {
    console.error(logsDateSeverity("E") + "Commandes slash : erreur lors de l'enregistrement des commandes slash (\"" + error + "\")");
  }
}
registerCommands();

// slash command handling
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const mode = interaction.commandName;
  if (!modes.find(m => m.name === mode)) return;
  const mot = interaction.options.getString("mot") ?? "";

  console.log(logsDateSeverity("I") + "G fait mes propres recherches : recherche de \"" + mot + "\" en mode \"" + mode + "\"");

  const scriptPath = path.join(__dirname, "g1000mots.sh");

  // acknowledge the command
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  execFile("bash", [scriptPath, mode, mot], (err, stdout, stderr) => {
    if (err) {
      console.log(logsDateSeverity("E") + "G fait mes propres recherches : erreur (\"" + err + "\") lors de l'exécution du script (\"" + scriptPath + "\") : " + stderr);
      interaction.editReply({ content: "Erreur, merci de réessayer plus tard. Si le problème persiste, contacter @TARDIgradeS ou un modo :sweat_smile:" });
    } else {
      console.log(logsDateSeverity("I") + "G fait mes propres recherches : script exécuté correctement");
      interaction.editReply({ content: `-# Recherche en cours...${stdout}` });
    }
  });
});

client.on("messageCreate", handleMessage);
client.on("messageUpdate", handleMessageUpdate);
client.on("messageCreate", messageReplyHandler);
client.on("messageCreate", initGame);

// startup
client.login(DISCORD_TOKEN);
app.get("/", (req, res) => res.send("OK"));
app.listen(PORT, () => console.log(logsDateSeverity("I") + "Général : le serveur tourne sur le port " + PORT));

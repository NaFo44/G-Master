import { REST, Routes, SlashCommandBuilder, MessageFlags } from "discord.js";
import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../logger.js";
import config, { SEARCH_MODES } from "../config.js";

const log = logger.child("Commands");

// Get directory path for script location
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Commands Module - Handles slash command registration and execution
 */

/**
 * Build slash commands from search modes
 */
function buildSlashCommands() {
  return SEARCH_MODES.map((mode) =>
    new SlashCommandBuilder()
      .setName(mode.name)
      .setDescription(mode.description)
      .addStringOption((opt) =>
        opt.setName("mot").setDescription("Le mot à chercher").setRequired(true)
      )
      .toJSON()
  );
}

/**
 * Register slash commands with Discord API
 */
async function registerCommands() {
  const slashCommands = buildSlashCommands();
  const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);

  try {
    log.info("Registering slash commands...", { count: slashCommands.length });

    await rest.put(
      Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID),
      { body: slashCommands }
    );

    log.success("Slash commands registered successfully");
  } catch (error) {
    log.error("Failed to register slash commands", { error: error.message });
    throw error;
  }
}

/**
 * Execute the search script
 */
function executeSearch(mode, mot) {
  return new Promise((resolve, reject) => {
    // Script path - assuming it's in the project root
    const scriptPath = path.join(__dirname, "../../g1000mots.sh");

    log.debug("Executing search script", { mode, mot, scriptPath });

    execFile("bash", [scriptPath, mode, mot], (err, stdout, stderr) => {
      if (err) {
        log.error("Search script error", {
          error: err.message,
          stderr,
          scriptPath,
        });
        reject(
          new Error(
            `Erreur lors de l'exécution du script: ${stderr || err.message}`
          )
        );
      } else {
        log.info("Search completed", {
          mode,
          mot,
          resultLength: stdout.length,
        });
        resolve(stdout);
      }
    });
  });
}

/**
 * Handle slash command interactions
 */
async function handleInteraction(interaction) {
  // Only handle slash commands
  if (!interaction.isChatInputCommand()) return;

  const mode = interaction.commandName;

  // Check if this is a search command
  if (!SEARCH_MODES.find((m) => m.name === mode)) return;

  const mot = interaction.options.getString("mot") ?? "";

  log.info("Search command received", {
    mode,
    mot,
    user: interaction.user.tag,
    channel: interaction.channel?.name,
  });

  // Acknowledge the command (ephemeral = only visible to user)
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const result = await executeSearch(mode, mot);
    await interaction.editReply({
      content: `-# Recherche en cours...${result}`,
    });
  } catch (error) {
    log.error("Search command failed", { error: error.message, mode, mot });
    await interaction.editReply({
      content:
        "Erreur, merci de réessayer plus tard. Si le problème persiste, contacter @TARDIgradeS ou un modo :sweat_smile:",
    });
  }
}

export {
  registerCommands,
  handleInteraction,
  buildSlashCommands,
  executeSearch,
  SEARCH_MODES,
};

export default {
  registerCommands,
  handleInteraction,
};

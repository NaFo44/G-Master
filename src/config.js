import dotenv from "dotenv";
import logger from "./logger.js";

// Load environment variables
dotenv.config();

const log = logger.child("Config");

/**
 * Configuration module - Centralized configuration management
 */

// Define all configuration with defaults and validation
const configDefinitions = {
  // Required Discord configuration
  DISCORD_TOKEN: {
    required: true,
    description: "Discord bot token",
  },
  CLIENT_ID: {
    required: true,
    description: "Discord application/bot ID",
  },
  GUILD_ID: {
    required: true,
    description: "Discord server (guild) ID",
  },

  // Optional Discord configuration
  PORT: {
    required: false,
    default: 3000,
    transform: (v) => parseInt(v, 10),
    description: "HTTP server port",
  },
  LOG_CHANNEL_ID: {
    required: false,
    default: "1315805001603481660",
    description: "Channel ID for startup messages",
  },

  // Search script configuration
  TSV_DIR: {
    required: false,
    default: "/home/romain/dev/G-Master/tsv",
    description: "Directory containing TSV files",
  },
  SEARCH_MIN_CHARS: {
    required: false,
    default: 4,
    transform: (v) => parseInt(v, 10),
    description: "Minimum search term length",
  },
  SEARCH_MAX_CHARS: {
    required: false,
    default: 100,
    transform: (v) => parseInt(v, 10),
    description: "Maximum search term length",
  },
  MAX_MATCHES: {
    required: false,
    default: 100,
    transform: (v) => parseInt(v, 10),
    description: "Maximum matches before truncating details",
  },
  MAX_MATCHES_LIMIT: {
    required: false,
    default: 1000,
    transform: (v) => parseInt(v, 10),
    description: "Absolute limit for matches",
  },

  // Game configuration
  USED_CONTENTS_FILE: {
    required: false,
    default: "data/used_contents.json",
    description: "File to store used responses",
  },
  SCORES_FILE: {
    required: false,
    default: "data/scores.json",
    description: "File to store player scores",
  },
  LYLITT_USER_ID: {
    required: false,
    default: "460073251352346624",
    description: "User ID that triggers the Lylitt game",
  },
  TARGET_USER_ID: {
    required: false,
    default: "819527758501642290",
    description: "Target user ID for special messages",
  },

  // Logging configuration
  LOG_LEVEL: {
    required: false,
    default: "DEBUG",
    description: "Minimum log level (CRITICAL, ERROR, WARN, INFO, DEBUG)",
  },
  LOG_TO_FILE: {
    required: false,
    default: false,
    transform: (v) => v === "true" || v === true,
    description: "Enable file logging",
  },
  LOG_FILE_PATH: {
    required: false,
    default: "logs/bot.log",
    description: "Path to log file",
  },

  // Discord message configuration
  DISCORD_MAX_MESSAGE_SIZE: {
    required: false,
    default: 1900,
    transform: (v) => parseInt(v, 10),
    description: "Maximum Discord message size",
  },

  // Formatting
  BULLET_POINT_SYMBOL: {
    required: false,
    default: ":large_blue_diamond:",
    description: "Bullet point symbol for formatted messages",
  },
  SUB_BULLET_POINT_SYMBOL: {
    required: false,
    default: ":small_orange_diamond:",
    description: "Sub-bullet point symbol for formatted messages",
  },
};

/**
 * Build configuration object from environment variables
 */
function buildConfig() {
  const config = {};
  const errors = [];

  for (const [key, definition] of Object.entries(configDefinitions)) {
    let value = process.env[key];

    // Check required fields
    if (definition.required && !value) {
      errors.push(
        `Missing required environment variable: ${key} (${definition.description})`
      );
      continue;
    }

    // Apply default if not set
    if (value === undefined || value === "") {
      value = definition.default;
    }

    // Apply transformation if defined
    if (value !== undefined && definition.transform) {
      value = definition.transform(value);
    }

    config[key] = value;
  }

  // Report errors
  if (errors.length > 0) {
    errors.forEach((err) => log.critical(err));
    process.exit(1);
  }

  log.success("Configuration loaded successfully");
  return config;
}

// Allowed channels for bot responses
const ALLOWED_CHANNELS = [
  "1278672736910311465",
  "1299853826001469561",
  "1315805001603481660",
];

// Search modes for slash commands
const SEARCH_MODES = [
  {
    name: "default",
    description: "Recherche standard (insensible à la casse, substring)",
  },
  {
    name: "wholeword",
    description: "Recherche par mot complet (insensible à la casse)",
  },
  {
    name: "exact",
    description: "Recherche exacte (sensible à la casse, substring)",
  },
  {
    name: "wholeword-exact",
    description: "Recherche par mot complet ET sensible à la casse",
  },
];

// Build and export configuration
const config = buildConfig();

export { config, ALLOWED_CHANNELS, SEARCH_MODES };
export default config;

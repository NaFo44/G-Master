import { Client, GatewayIntentBits, Events } from "discord.js";
import logger from "./logger.js";
import config from "./config.js";

const log = logger.child("Discord");

let memberCache = new Set();
let lastCacheUpdate = 0;
const CACHE_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Discord Client Module - Handles Discord.js client setup and connection
 */

// Create the Discord client with required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
  ],
});

/**
 * Connect the bot to Discord
 */
async function connect() {
  try {
    log.info("Connecting to Discord...");
    await client.login(config.DISCORD_TOKEN);
  } catch (error) {
    log.critical("Failed to connect to Discord", { error: error.message });
    process.exit(1);
  }
}

/**
 * Get the guild (server) by ID
 */
async function getGuild() {
  try {
    const guild = await client.guilds.fetch(config.GUILD_ID);
    return guild;
  } catch (error) {
    log.error("Failed to fetch guild", {
      guildId: config.GUILD_ID,
      error: error.message,
    });
    return null;
  }
}

/**
 * Fetch all member IDs from a guild
 */
export async function fetchAllMemberIds(guild) {
  const now = Date.now();

  if (memberCache.size === 0 || now - lastCacheUpdate > CACHE_EXPIRY_MS) {
    try {
      const members = await guild.members.fetch();
      memberCache = new Set(members.keys());
      lastCacheUpdate = now;
      log.debug(`Récupération et mise en cache de ${members.size} membres depuis la guilde`);
    } catch (error) {
      log.error("Échec de la récupération des membres", { error: error.message });
      return Array.from(memberCache);
    }
  }

  log.debug(`Récupération de ${memberCache.size} membres depuis le cache`);
  return Array.from(memberCache);
}


/**
 * Send a startup message to the log channel
 */
async function sendStartupMessage() {
  try {
    const channel = await client.channels.fetch(config.LOG_CHANNEL_ID);

    if (channel && channel.isTextBased()) {
      await channel.send("🟢 Le bot est démarré !");
      log.success("Startup message sent");
    } else {
      log.warn("Log channel not found or not text-based", {
        channelId: config.LOG_CHANNEL_ID,
      });
    }
  } catch (error) {
    log.error("Failed to send startup message", { error: error.message });
  }
}

/**
 * Set the bot's presence/status
 */
function setPresence(
  status = "online",
  activity = "En ligne !",
  type = "PLAYING"
) {
  try {
    client.user.setStatus(status);
    client.user.setActivity(activity, { type });
    log.debug("Bot presence updated", { status, activity });
  } catch (error) {
    log.error("Failed to set presence", { error: error.message });
  }
}

/**
 * Initialize the client with event handlers
 */
function initializeClient(eventHandlers = {}) {
  // Ready event
  client.once(Events.ClientReady, async (readyClient) => {
    log.success(`Bot connected as "${readyClient.user.tag}"`);
    setPresence();
    await sendStartupMessage();

    if (eventHandlers.onReady) {
      eventHandlers.onReady(readyClient);
    }
  });

  // Error handling
  client.on(Events.Error, (error) => {
    log.error("Discord client error", { error: error.message });
  });

  client.on(Events.Warn, (warning) => {
    log.warn("Discord client warning", { warning });
  });

  // Debug (only in debug mode)
  if (config.LOG_LEVEL === "DEBUG") {
    client.on(Events.Debug, (info) => {
      // Filter out noisy heartbeat messages
      if (!info.includes("Heartbeat")) {
        log.debug("Discord debug", { info });
      }
    });
  }

  log.info("Discord client initialized");
}

export {
  client,
  connect,
  getGuild,
  fetchAllMemberIds,
  sendStartupMessage,
  setPresence,
  initializeClient,
};

export default client;

import { Events } from "discord.js";
import express from "express";
import logger from "./src/logger.js";
import config from "./src/config.js";
import { client, connect, initializeClient } from "./src/discord.js";
import {
  handleMessage,
  handleMessageUpdate,
  handleMessageReply,
  handleGameMessage,
  handleInteraction,
  registerCommands,
} from "./src/handlers/index.js";

const log = logger.child("Main");

/**
 * G-Master Discord Bot
 *
 * A feature-rich Discord bot with:
 * - Advanced logging system
 * - Message transformations (gé → G, quantique → quan-tic tac)
 * - Auto-replies (quoi/feur, oui/stiti, etc.)
 * - Lylitt Game (BOUH game with scoring)
 * - Search slash commands
 * - HTTP health check server
 */

// Initialize Express for health checks
const app = express();

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    bot: client.user?.tag ?? "Not connected",
    uptime: process.uptime(),
  });
});

app.get("/health", (req, res) => {
  const isConnected = client.ws.status === 0;
  res.status(isConnected ? 200 : 503).json({
    status: isConnected ? "healthy" : "unhealthy",
    discord: isConnected ? "connected" : "disconnected",
  });
});

/**
 * Setup all event handlers
 */
function setupEventHandlers() {
  // Message creation events
  client.on(Events.MessageCreate, async (message) => {
    try {
      // Run handlers in sequence to avoid conflicts
      await handleMessage(message);
      await handleMessageReply(message);
      await handleGameMessage(message);
    } catch (error) {
      log.error("Error handling message", {
        error: error.message,
        messageId: message.id,
      });
    }
  });

  // Message update events
  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    try {
      await handleMessageUpdate(oldMessage, newMessage);
    } catch (error) {
      log.error("Error handling message update", {
        error: error.message,
        messageId: newMessage.id,
      });
    }
  });

  // Interaction events (slash commands)
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      await handleInteraction(interaction);
    } catch (error) {
      log.error("Error handling interaction", {
        error: error.message,
        interactionId: interaction.id,
      });
    }
  });

  log.info("Event handlers registered");
}

/**
 * Graceful shutdown handler
 */
function setupShutdownHandlers() {
  const shutdown = async (signal) => {
    log.warn(`Received ${signal}, shutting down gracefully...`);

    try {
      // Destroy Discord client
      await client.destroy();
      log.info("Discord client disconnected");

      process.exit(0);
    } catch (error) {
      log.error("Error during shutdown", { error: error.message });
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Handle uncaught errors
  process.on("uncaughtException", (error) => {
    log.critical("Uncaught exception", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    log.error("Unhandled rejection", { reason: String(reason) });
  });
}

/**
 * Main startup function
 */
async function main() {
  log.info("Starting G-Master bot...");
  log.info("Configuration loaded", {
    port: config.PORT,
    guildId: config.GUILD_ID,
    logLevel: config.LOG_LEVEL,
  });

  // Setup shutdown handlers
  setupShutdownHandlers();

  // Initialize Discord client
  initializeClient();

  // Setup event handlers
  setupEventHandlers();

  // Register slash commands
  try {
    await registerCommands();
  } catch (error) {
    log.error("Failed to register commands", { error: error.message });
    // Continue anyway - commands might already be registered
  }

  // Connect to Discord
  await connect();

  // Start HTTP server
  app.listen(config.PORT, () => {
    log.success(`HTTP server running on port ${config.PORT}`);
  });
}

// Run the bot
main().catch((error) => {
  log.critical("Failed to start bot", { error: error.message });
  process.exit(1);
});

import fs from "fs";
import path from "path";
import logger from "../logger.js";
import config from "../config.js";
import { getGuild, fetchAllMemberIds } from "../discord.js";

const log = logger.child("LylittGame");

/**
 * Lylitt Game Module - Handles the "BOUH" game mechanics
 */

// Game state
const gameState = {
  activeMessageId: null,
  initialAuthorId: null,
  replyCounts: {}, // Count replies per game
  usedContents: {}, // Store already used contents per game
  scores: {}, // Player scores
};

// Ensure data directory exists
const dataDir = path.dirname(config.USED_CONTENTS_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  log.debug("Created data directory", { path: dataDir });
}

/**
 * Load used contents from file
 */
function loadUsedContents() {
  try {
    if (fs.existsSync(config.USED_CONTENTS_FILE)) {
      const raw = fs.readFileSync(config.USED_CONTENTS_FILE, "utf8");
      const data = JSON.parse(raw);

      // Convert arrays back to Sets
      Object.keys(data).forEach((key) => {
        gameState.usedContents[key] = new Set(data[key]);
      });

      log.debug("Loaded used contents");
    }
  } catch (error) {
    log.error("Failed to load used contents", { error: error.message });
  }
}

/**
 * Save used contents to file
 */
function saveUsedContents() {
  try {
    // Convert Sets to arrays for JSON serialization
    const data = {};
    Object.keys(gameState.usedContents).forEach((key) => {
      data[key] = Array.from(gameState.usedContents[key]);
    });

    fs.writeFileSync(config.USED_CONTENTS_FILE, JSON.stringify(data, null, 2));
    log.debug("Saved used contents");
  } catch (error) {
    log.error("Failed to save used contents", { error: error.message });
  }
}

/**
 * Load scores from file
 */
function loadScores() {
  try {
    if (fs.existsSync(config.SCORES_FILE)) {
      const raw = fs.readFileSync(config.SCORES_FILE, "utf8");
      gameState.scores = JSON.parse(raw);
      log.debug("Loaded scores");
    }
  } catch (error) {
    log.error("Failed to load scores", { error: error.message });
  }
}

/**
 * Save scores to file
 */
function saveScores() {
  try {
    fs.writeFileSync(
      config.SCORES_FILE,
      JSON.stringify(gameState.scores, null, 2)
    );
    log.debug("Saved scores");
  } catch (error) {
    log.error("Failed to save scores", { error: error.message });
  }
}

/**
 * Count points from users who left the server
 */
async function countAbsentPoints(guild) {
  const presentIds = await fetchAllMemberIds(guild);
  const presentSet = new Set(presentIds);

  let totalPoints = 0;
  let absentCount = 0;

  for (const [id, pts] of Object.entries(gameState.scores)) {
    if (!presentSet.has(id)) {
      totalPoints += Number(pts) || 0;
      absentCount++;
    }
  }

  log.info("Counted absent users points", {
    absentCount,
    totalPoints,
    forRedistribution: true,
  });

  return totalPoints;
}

/**
 * Remove scores from users who left the server
 */
async function purgeAbsentScores(guild) {
  const presentIds = await fetchAllMemberIds(guild);
  const presentSet = new Set(presentIds);

  for (const id of Object.keys(gameState.scores)) {
    if (!presentSet.has(id)) {
      log.info("Removing absent user from scores", {
        userId: id,
        points: gameState.scores[id],
      });
      delete gameState.scores[id];
    }
  }

  saveScores();
}

/**
 * Display the leaderboard
 */
async function showRank(message) {
  loadScores();
  loadUsedContents();

  log.info("Rank requested", { requestedBy: message.author.tag });

  // Delete the .rank message
  try {
    await message.delete();
    log.debug("Deleted .rank command message");
    await new Promise((r) => setTimeout(r, 300));
  } catch (error) {
    log.warn("Could not delete .rank message", { error: error.message });
  }

  // Check if there are scores
  if (Object.keys(gameState.scores).length === 0) {
    return await message.channel.send("Aucun score pour l'instant.");
  }

  // Sort and format scores
  const entries = Object.entries(gameState.scores).sort(
    ([, a], [, b]) => b - a
  );
  const lines = entries.map(([userId, score], i) => {
    return `${i + 1}. <@${userId}> : ${score} point${score !== 1 ? "s" : ""}`;
  });

  // Send and animate the leaderboard
  try {
    const sent = await message.channel.send("Préparation du classement...");

    // Show full leaderboard after 1 second
    setTimeout(async () => {
      try {
        await sent.edit("**🏆 Classement :**\n" + lines.join("\n"));
        log.info("Showed full leaderboard");

        // Show top 5 after 30 seconds
        setTimeout(async () => {
          try {
            await sent.edit(
              "**🏆 Classement (top 5) :**\n" + lines.slice(0, 5).join("\n")
            );
            log.debug("Collapsed leaderboard to top 5");
          } catch (error) {
            log.warn("Failed to collapse leaderboard", {
              error: error.message,
            });
          }
        }, 30_000);
      } catch (error) {
        log.error("Failed to show leaderboard", { error: error.message });
      }
    }, 1_000);
  } catch (error) {
    log.error("Failed to send leaderboard", { error: error.message });
  }
}

/**
 * Start a new game when "BOUH" is detected
 */
async function startGame(message) {
  loadScores();
  loadUsedContents();

  gameState.activeMessageId = message.id;
  gameState.initialAuthorId = message.author.id;
  gameState.replyCounts[message.id] = 0;
  gameState.usedContents[message.id] = new Set();

  log.info("New game started", {
    messageId: message.id,
    triggeredBy: message.author.tag,
  });

  await message.channel.send("👻 Partie lancée ! Répondez au `BOUH` initial.");
}

/**
 * Process a game reply
 */
async function processGameReply(message) {
  const { activeMessageId } = gameState;
  const replyContent = message.content.toLowerCase().trim();
  const userId = message.author.id;
  const replyNumber = gameState.replyCounts[activeMessageId] + 1;

  loadScores();
  loadUsedContents();

  log.info("Processing game reply", {
    replyNumber: `${replyNumber}/3`,
    userId,
    content: replyContent.substring(0, 30),
  });

  // Check if content was already used
  if (gameState.usedContents[activeMessageId].has(replyContent)) {
    // Penalize duplicate
    gameState.scores[userId] = (gameState.scores[userId] || 0) - 1;
    saveScores();

    log.info("Duplicate answer detected", { userId, penalty: -1 });

    try {
      // React with "DÉJÀ POSTÉ"
      const reactions = [
        "❌",
        "🇩",
        "🇪",
        "🇯",
        "🇦",
        "▪️",
        "🇵",
        "🇴",
        "🇸",
        "🇹",
        "3️⃣",
      ];
      for (const emoji of reactions) {
        await message.react(emoji);
      }
    } catch (error) {
      log.error("Failed to add duplicate reaction", { error: error.message });
    }
  } else {
    // Valid answer
    gameState.usedContents[activeMessageId].add(replyContent);
    saveUsedContents();

    gameState.scores[userId] = (gameState.scores[userId] || 0) + 1;
    saveScores();

    gameState.replyCounts[activeMessageId]++;

    log.info("Valid answer", { userId, newScore: gameState.scores[userId] });

    try {
      await message.react("✅");
    } catch (error) {
      log.error("Failed to add valid reaction", { error: error.message });
    }
  }
}

/**
 * Handle redistribution trigger ("grrr")
 */
async function handleRedistributionTrigger(message) {
  loadScores();
  const guild = await getGuild();

  if (!guild) {
    log.error("Could not fetch guild for redistribution");
    return;
  }

  const points = await countAbsentPoints(guild);

  if (points === 0) {
    log.info("Redistribution cancelled - no points to redistribute");
    await message.react("❌");
  } else {
    log.info("Redistribution triggered", { pointsAvailable: points });
    await message.reply(
      `*${points} point${points > 1 ? "s" : ""} à redistribuer :clock1230:*`
    );
  }
}

/**
 * Handle redistribution claim
 */
async function handleRedistributionClaim(message, originalMessage) {
  loadScores();
  const guild = await getGuild();

  if (!guild) {
    log.error("Could not fetch guild for redistribution claim");
    return;
  }

  const points = await countAbsentPoints(guild);

  if (points <= 0) {
    await message.react("❌");
    return;
  }

  const diffSec = Math.floor(
    (Date.now() - originalMessage.createdTimestamp) / 1000
  );
  const pointsWon = points - diffSec + 1;

  if (pointsWon > 0) {
    const winnerId = message.author.id;

    log.info("Redistribution claimed", {
      winnerId,
      pointsWon,
      reactionTime: diffSec,
    });

    gameState.scores[winnerId] = (gameState.scores[winnerId] || 0) + pointsWon;
    saveScores();
    await purgeAbsentScores(guild);

    await message.reply(
      `**Bien joué, tu viens de gagner ${pointsWon} point${
        pointsWon > 1 ? "s" : ""
      } ! :clap:**`
    );
  } else {
    await message.react("❌");
  }
}

/**
 * Main game handler - called on every message
 */
async function handleGameMessage(message) {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  // Handle .rank command
  if (content === ".rank") {
    return await showRank(message);
  }

  // Detect "BOUH" from Lylitt to start a game
  if (
    message.author.id === config.LYLITT_USER_ID &&
    content.includes("bouh") &&
    !message.reference
  ) {
    return await startGame(message);
  }

  // Process game replies (first 3 valid replies)
  if (
    gameState.activeMessageId &&
    message.author.id !== gameState.initialAuthorId &&
    message.reference?.messageId === gameState.activeMessageId &&
    gameState.replyCounts[gameState.activeMessageId] < 3
  ) {
    return await processGameReply(message);
  }

  // Handle redistribution trigger ("grrr" from Lylitt)
  if (
    message.author.id === config.LYLITT_USER_ID &&
    content.includes("grrr") &&
    !message.reference
  ) {
    return await handleRedistributionTrigger(message);
  }

  // Handle redistribution claim (reply to "grrr" message)
  if (
    message.author.id !== config.LYLITT_USER_ID &&
    message.reference &&
    !message.author.bot
  ) {
    try {
      const original = await message.channel.messages.fetch(
        message.reference.messageId
      );

      if (
        original.author.id === config.LYLITT_USER_ID &&
        original.content.toLowerCase().includes("grrr")
      ) {
        return await handleRedistributionClaim(message, original);
      }
    } catch (error) {
      log.error("Failed to fetch referenced message", { error: error.message });
    }
  }
}

// Export functions
export {
  handleGameMessage,
  loadScores,
  saveScores,
  loadUsedContents,
  saveUsedContents,
  gameState,
};

export default handleGameMessage;

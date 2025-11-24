import logger from "./logger.js";
import config, { ALLOWED_CHANNELS } from "./config.js";

const log = logger.child("Messages");

/**
 * Message Handlers Module - Handles all message-related events
 */

// Patterns and data
const PATTERNS = {
  hungry: /(j.?ai|gé?).?(faim|f1|la dalle)/i,
  endGame: /oui oui bien sûr bien sûûûr/i,
  geSound: /gé/gi,
  quantum: /quantique/gi,
};

const FOOD_IMAGES = [
  "https://lelocalapizzas.fr/wp-content/uploads/2023/04/pizza-saumon-creme-fraiche-recette.jpg",
  "https://burgerkingfrance.twic.pics/custom-pages/2024/20241028_MastersPerennes/produit_1_1.png",
  "https://dxm.dam.savencia.com/api/wedia/dam/variation/fix635d9eidk9muu7yq33zuescmdts13b7bw94o/savencia_2000_webp",
  "https://marcwiner.com/wp-content/uploads/2024/09/brochettes-teriyaki-en-tete-750x563.jpg",
  "https://assets.afcdn.com/recipe/20211222/126196_w1024h768c1cx896cy845cxt0cyt0cxb2121cyb1414.jpg",
  "https://odelices.ouest-france.fr/images/recettes/2015/glace_au_chocolat-1024x1081.jpg",
  "https://blog.pourdebon.com/wp-content/uploads/2018/03/omelette-750x500.jpg",
  "https://www.tables-auberges.com/storage/uploads/2023/10/AdobeStock_478424723-2-1024x683.jpeg",
  "https://charcuteriepereanselme.fr/cdn/shop/products/IMG_6845.jpg",
  "https://img.cuisineaz.com/660x495/2015/10/29/i88809-raclette.webp",
  "https://assets.afcdn.com/recipe/20171218/76132_w1024h768c1cx1872cy2808cxt0cyt0cxb3744cyb5616.jpg",
  "https://mag.guydemarle.com/app/uploads/2025/04/cassoulet-1024x598.jpg",
  "https://www.lesfoodies.com/_recipeimage/118317/astuce-conserver-la-salade.jpg",
  "https://i0.wp.com/cuisinovores.com/wp-content/uploads/2024/10/photo_boeuf_bourguignon_cuisinovores.webp",
];

const REACTIONS = [
  { name: "myrtilles", pattern: /myrtilles/i, emoji: "🫐" },
  { name: "sangliers", pattern: /sangliers/i, emoji: "🐗" },
];

const AUTO_REPLIES = [
  { name: "quoi → feur", pattern: /^.*quoi[ .!?]*$/i, response: "feur." },
  { name: "oui → stiti", pattern: /^.*oui[ .!?]*$/i, response: "stiti." },
  { name: "non → bril", pattern: /^.*non[ .!?]*$/i, response: "bril." },
  {
    name: "bonne nuit → medbed",
    pattern: /^.*bonne nuit.*$/i,
    response: "Medbed activé !",
  },
];

const END_GAME_MESSAGE = `# GMilgram - C'est la fin !
Ça y est ! Tu as terminé toutes les énigmes de la communauté !
Mais qui dit énigme dit Coffre... Que tu recevras par la Poste (cadeau, pas besoin de partir en pleine nuit avec une pelle...).
||@everyone||`;

/**
 * Check if message is from allowed channel
 */
function isAllowedChannel(channelId) {
  return ALLOWED_CHANNELS.includes(channelId);
}

/**
 * Get a random food image
 */
function getRandomFoodImage() {
  return FOOD_IMAGES[Math.floor(Math.random() * FOOD_IMAGES.length)];
}

/**
 * Transform "gé" to "G" with proper formatting
 */
function transformGeToG(text) {
  return text
    .replaceAll(
      /([^[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])?gé(?![\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi,
      "$1-G-"
    )
    .replaceAll(/gé(?![\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "G-")
    .replaceAll(
      /(^|[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])gé(?=[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi,
      "$1G"
    )
    .replaceAll(/gé/gi, "-G");
}

/**
 * Transform "quantique" to "quan-tic tac" with link
 */
function transformQuantum(text) {
  return text.replace(
    PATTERNS.quantum,
    "[quan-tic tac](https://www.youtube.com/watch?v=fmvqz0_KFX0)"
  );
}

/**
 * Handle reactions on messages
 */
async function handleReactions(message) {
  const content = message.content;

  for (const reaction of REACTIONS) {
    if (reaction.pattern.test(content)) {
      try {
        await message.react(reaction.emoji);
        log.debug(`Added reaction ${reaction.emoji} for "${reaction.name}"`);
      } catch (error) {
        log.error(`Failed to add reaction for "${reaction.name}"`, {
          error: error.message,
        });
      }
    }
  }
}

/**
 * Handle text transformations (gé → G, quantique → quan-tic tac)
 */
async function handleTextTransformations(message) {
  const content = message.content;
  let newContent = content;
  let modified = false;

  // Transform "gé" to "G"
  if (PATTERNS.geSound.test(content)) {
    newContent = transformGeToG(newContent);
    modified = true;
    log.debug('Transformed "gé" to "G"');
  }

  // Transform "quantique" to "quan-tic tac"
  if (PATTERNS.quantum.test(content)) {
    newContent = transformQuantum(newContent);
    modified = true;
    log.debug('Transformed "quantique" to "quan-tic tac"');
  }

  if (modified) {
    try {
      const sent = await message.channel.send(newContent);
      log.info("Sent transformed message");

      // Auto-delete after 30 seconds
      setTimeout(async () => {
        try {
          await sent.delete();
          log.debug("Auto-deleted transformed message");
        } catch {
          // Message might already be deleted
        }
      }, 30_000);
    } catch (error) {
      log.error("Failed to send transformed message", { error: error.message });
    }
  }
}

/**
 * Handle auto-replies (quoi/feur, oui/stiti, etc.)
 */
async function handleAutoReplies(message) {
  const content = message.content;

  for (const reply of AUTO_REPLIES) {
    if (reply.pattern.test(content)) {
      try {
        await message.channel.send(reply.response);
        log.debug(`Sent auto-reply: "${reply.name}"`);
      } catch (error) {
        log.error(`Failed to send auto-reply for "${reply.name}"`, {
          error: error.message,
        });
      }
    }
  }
}

/**
 * Handle "j'ai faim" messages with food images
 */
async function handleHungryMessage(message) {
  if (!PATTERNS.hungry.test(message.content)) return;

  const image = getRandomFoodImage();
  try {
    await message.reply(image);
    log.info("Sent food image", { image });
  } catch (error) {
    log.error("Failed to send food image", { error: error.message });
  }
}

/**
 * Handle end game trigger (GMilgram)
 */
async function handleEndGame(message) {
  if (message.author.id !== config.TARGET_USER_ID) return;
  if (!PATTERNS.endGame.test(message.content)) return;

  try {
    await message.channel.send(END_GAME_MESSAGE);
    log.info("Sent end game message");
  } catch (error) {
    log.error("Failed to send end game message", { error: error.message });
  }
}

/**
 * Main message handler - processes all new messages
 */
async function handleMessage(message) {
  // Ignore bots
  if (message.author.bot) return;

  // Only process messages from allowed channels
  if (!isAllowedChannel(message.channel.id)) return;

  log.debug("Processing message", {
    author: message.author.tag,
    channel: message.channel.name,
    preview:
      message.content.substring(0, 50) +
      (message.content.length > 50 ? "..." : ""),
  });

  // Process all handlers (they run independently)
  await Promise.all([
    handleReactions(message),
    handleTextTransformations(message),
    handleEndGame(message),
  ]);
}

/**
 * Handle message updates
 */
async function handleMessageUpdate(oldMessage, newMessage) {
  // Ignore bots
  if (newMessage.author?.bot) return;

  // Only process messages from allowed channels
  if (!isAllowedChannel(newMessage.channel.id)) return;

  // Only process if content actually changed
  if (oldMessage.content === newMessage.content) return;

  log.debug("Processing message update", {
    author: newMessage.author?.tag,
    oldPreview: oldMessage.content?.substring(0, 30),
    newPreview: newMessage.content?.substring(0, 30),
  });

  // Handle "j'ai faim" on edited messages
  await handleHungryMessage(newMessage);
}

/**
 * Handle auto-replies (separate handler for message create)
 */
async function handleMessageReply(message) {
  // Ignore bots
  if (message.author.bot) return;

  // Only process messages from allowed channels
  if (!isAllowedChannel(message.channel.id)) return;

  await handleAutoReplies(message);
  await handleHungryMessage(message);
}

export {
  handleMessage,
  handleMessageUpdate,
  handleMessageReply,
  isAllowedChannel,
  PATTERNS,
  FOOD_IMAGES,
  REACTIONS,
  AUTO_REPLIES,
};

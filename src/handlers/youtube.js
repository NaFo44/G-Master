import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import logger from "../logger.js";
import { ALLOWED_CHANNELS } from "../config.js";

const log = logger.child("Youtube");

/**
 * Youtube Tracking Handler Module
 *
 * Detects Youtube links (classic/short/music) carrying a tracking parameter
 * (`si=`, `is=`, `pp=`), re-sends the message as the bot with an embed crediting the
 * author, deletes the original, and lets the author remove the relayed
 * message with a 🗑️ reaction.
 */

const TRASH_EMOJI = "🗑️";
const TRACKING_PARAMS = ["si", "is", "pp"];
const EXPLANATION_AUTODELETE_MS = 20_000;

const YOUTUBE_URL_REGEX =
  /https?:\/\/(?:www\.|music\.)?(?:youtube\.com\/(?:watch\?[^\s]+|shorts\/[^\s]+)|youtu\.be\/[^\s]+)/gi;

// message.id (relayed message) -> original author id
const relayOwners = new Map();

/**
 * Strip every known tracking parameter from a Youtube URL
 */
function stripTrackingParam(rawUrl) {
  try {
    const url = new URL(rawUrl);
    for (const param of TRACKING_PARAMS) {
      url.searchParams.delete(param);
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

/**
 * Check whether the content contains at least one Youtube link carrying a
 * tracking parameter
 */
function hasTrackedYoutubeLink(content) {
  const matches = content.match(YOUTUBE_URL_REGEX);
  if (!matches) return false;
  return matches.some((match) => {
    try {
      const { searchParams } = new URL(match);
      return TRACKING_PARAMS.some((param) => searchParams.has(param));
    } catch {
      return false;
    }
  });
}

/**
 * Replace every tracked Youtube link in the content with its cleaned version
 */
function cleanContent(content) {
  return content.replace(YOUTUBE_URL_REGEX, (match) => stripTrackingParam(match));
}

/**
 * Build allowedMentions that only preserve mentions the original author was
 * actually permitted to make - never let the relay grant escalated pings
 */
function buildAllowedMentions(message) {
  const canMentionEveryone =
    message.member?.permissionsIn(message.channel).has(PermissionFlagsBits.MentionEveryone) ??
    false;

  const roles = [...message.mentions.roles.values()]
    .filter((role) => role.mentionable || canMentionEveryone)
    .map((role) => role.id);

  return {
    parse: canMentionEveryone ? ["everyone"] : [],
    users: [...message.mentions.users.keys()],
    roles,
  };
}

/**
 * Send the explanation message (public, auto-deleted after a short delay)
 */
async function sendTrackingExplanation(channel) {
  try {
    const explanation = await channel.send(
      "🔍 Ce lien Youtube contenait un paramètre de suivi (`si=`, `is=` ou `pp=`) qui permet " +
        "d'identifier qui a partagé le lien et par où il a circulé. Il a été " +
        "retiré automatiquement pour protéger ta vie privée et celle des autres."
    );

    setTimeout(async () => {
      try {
        await explanation.delete();
      } catch {
        // Message might already be deleted
      }
    }, EXPLANATION_AUTODELETE_MS);
  } catch (error) {
    log.error("Failed to send tracking explanation", { error: error.message });
  }
}

/**
 * Main entry point - relay the message if it contains a tracked Youtube link
 * Returns true if the original message was handled (relayed + deleted)
 */
async function handleYoutubeMessage(message) {
  if (message.author.bot) return false;
  // if (!ALLOWED_CHANNELS.includes(message.channel.id)) return false;
  if (!hasTrackedYoutubeLink(message.content)) return false;

  try {
    const cleanedContent = cleanContent(message.content);

    const embed = new EmbedBuilder()
      .setAuthor({
        name: message.member?.displayName ?? message.author.username,
        iconURL: message.author.displayAvatarURL(),
      })
      .setColor(0xff0000)
      .setTimestamp(message.createdTimestamp);

    const sent = await message.channel.send({
      content: cleanedContent,
      embeds: [embed],
      allowedMentions: buildAllowedMentions(message),
    });

    relayOwners.set(sent.id, message.author.id);

    await message.delete();
    log.info("Relayed message with cleaned Youtube link", {
      author: message.author.tag,
      channel: message.channel.name,
    });

    await sent.react(TRASH_EMOJI);
    await sendTrackingExplanation(message.channel);

    return true;
  } catch (error) {
    log.error("Failed to relay Youtube message", { error: error.message });
    return false;
  }
}

/**
 * Handle 🗑️ reactions - let the original author delete their relayed message
 */
async function handleYoutubeReactionAdd(reaction, user) {
  if (user.bot) return;
  if (reaction.emoji.name !== TRASH_EMOJI) return;

  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();
  } catch (error) {
    log.error("Failed to fetch partial reaction", { error: error.message });
    return;
  }

  const message = reaction.message;
  const ownerId = relayOwners.get(message.id);
  if (!ownerId || ownerId !== user.id) return;

  try {
    await message.delete();
    relayOwners.delete(message.id);
    log.debug("Relay message deleted by owner reaction", {
      messageId: message.id,
      userId: user.id,
    });
  } catch (error) {
    log.error("Failed to delete relay message", { error: error.message });
  }
}

export {
  handleYoutubeMessage,
  handleYoutubeReactionAdd,
  hasTrackedYoutubeLink,
  cleanContent,
  YOUTUBE_URL_REGEX,
};

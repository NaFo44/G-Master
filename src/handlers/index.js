/**
 * Handlers Index - Re-export all handlers for clean imports
 */

export {
  handleMessage,
  handleMessageUpdate,
  handleMessageReply,
} from "./messages.js";
export { handleGameMessage } from "./game.js";
export { handleInteraction, registerCommands } from "./commands.js";

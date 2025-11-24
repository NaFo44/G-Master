import fs from "fs";
import path from "path";

/**
 * Logger - A professional logging system with severity levels, colors, and file output
 */

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",

  // Severity colors
  critical: "\x1b[41m\x1b[37m", // White on red background
  error: "\x1b[31m", // Red
  warn: "\x1b[33m", // Yellow
  info: "\x1b[36m", // Cyan
  debug: "\x1b[35m", // Magenta
  success: "\x1b[32m", // Green
};

// Log levels with their configurations
const LOG_LEVELS = {
  CRITICAL: { code: "CRT", priority: 0, color: colors.critical },
  ERROR: { code: "ERR", priority: 1, color: colors.error },
  WARN: { code: "WRN", priority: 2, color: colors.warn },
  INFO: { code: "INF", priority: 3, color: colors.info },
  DEBUG: { code: "DBG", priority: 4, color: colors.debug },
  SUCCESS: { code: "OK!", priority: 3, color: colors.success },
};

class Logger {
  constructor(options = {}) {
    this.options = {
      enableColors: options.enableColors ?? true,
      enableFileLogging: options.enableFileLogging ?? false,
      logFilePath: options.logFilePath ?? "logs/bot.log",
      minLevel: options.minLevel ?? "DEBUG",
      timezone: options.timezone ?? "Europe/Paris",
      ...options,
    };

    // Ensure log directory exists if file logging is enabled
    if (this.options.enableFileLogging) {
      const logDir = path.dirname(this.options.logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    }
  }

  /**
   * Format current date/time for Paris timezone
   */
  getTimestamp() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("fr-FR", {
      timeZone: this.options.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const get = (type) => parts.find((p) => p.type === type)?.value ?? "";

    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get(
      "minute"
    )}:${get("second")}`;
  }

  /**
   * Check if the log level should be displayed
   */
  shouldLog(level) {
    const minPriority = LOG_LEVELS[this.options.minLevel]?.priority ?? 4;
    const currentPriority = LOG_LEVELS[level]?.priority ?? 4;
    return currentPriority <= minPriority;
  }

  /**
   * Format and output a log message
   */
  log(level, module, message, data = null) {
    if (!this.shouldLog(level)) return;

    const levelConfig = LOG_LEVELS[level] || LOG_LEVELS.INFO;
    const timestamp = this.getTimestamp();

    // Plain text format for file logging
    const plainMessage = `[${timestamp}] ${levelConfig.code} [${module}] ${message}`;

    // Colored format for console
    let consoleMessage = plainMessage;
    if (this.options.enableColors) {
      consoleMessage = `${colors.dim}[${timestamp}]${colors.reset} ${levelConfig.color}${levelConfig.code}${colors.reset} ${colors.bright}[${module}]${colors.reset} ${message}`;
    }

    // Output to console
    if (level === "ERROR" || level === "CRITICAL") {
      console.error(consoleMessage);
    } else {
      console.log(consoleMessage);
    }

    // Output additional data if provided
    if (data !== null) {
      if (this.options.enableColors) {
        console.log(`${colors.dim}    └─ Data:${colors.reset}`, data);
      } else {
        console.log("    └─ Data:", data);
      }
    }

    // Write to file if enabled
    if (this.options.enableFileLogging) {
      const fileEntry = data
        ? `${plainMessage}\n    └─ Data: ${JSON.stringify(data)}\n`
        : `${plainMessage}\n`;

      fs.appendFileSync(this.options.logFilePath, fileEntry);
    }
  }

  // Convenience methods for each log level
  critical(module, message, data = null) {
    this.log("CRITICAL", module, message, data);
  }

  error(module, message, data = null) {
    this.log("ERROR", module, message, data);
  }

  warn(module, message, data = null) {
    this.log("WARN", module, message, data);
  }

  info(module, message, data = null) {
    this.log("INFO", module, message, data);
  }

  debug(module, message, data = null) {
    this.log("DEBUG", module, message, data);
  }

  success(module, message, data = null) {
    this.log("SUCCESS", module, message, data);
  }

  /**
   * Create a child logger with a fixed module name
   */
  child(moduleName) {
    const parent = this;
    return {
      critical: (msg, data) => parent.critical(moduleName, msg, data),
      error: (msg, data) => parent.error(moduleName, msg, data),
      warn: (msg, data) => parent.warn(moduleName, msg, data),
      info: (msg, data) => parent.info(moduleName, msg, data),
      debug: (msg, data) => parent.debug(moduleName, msg, data),
      success: (msg, data) => parent.success(moduleName, msg, data),
    };
  }
}

// Create and export default logger instance
const logger = new Logger({
  enableColors: true,
  enableFileLogging: process.env.LOG_TO_FILE === "true",
  logFilePath: process.env.LOG_FILE_PATH || "logs/bot.log",
  minLevel: process.env.LOG_LEVEL || "DEBUG",
});

export { Logger, LOG_LEVELS };
export default logger;

# G-Master Discord Bot

A feature-rich Discord bot with advanced logging, message handling, and game mechanics.

## Features

- 🎨 **Advanced Logging System** - Color-coded console output with severity levels, timestamps, and optional file logging
- 💬 **Message Transformations** - Automatically transforms text patterns (gé → G, quantique → quan-tic tac)
- 🤖 **Auto-Replies** - Responds to common patterns (quoi/feur, oui/stiti, non/bril)
- 🎮 **Lylitt Game** - Interactive "BOUH" game with scoring system
- 🔍 **Search Commands** - Slash commands for searching transcripts
- 🍕 **Fun Features** - Food images on "j'ai faim", emoji reactions, and more

## Project Structure

```
new/
├── index.js              # Main entry point
├── package.json          # Dependencies and scripts
├── example.env           # Environment configuration template
├── g1000mots.sh          # Search script (copy from old/)
├── src/
│   ├── logger.js         # Advanced logging system
│   ├── config.js         # Configuration management
│   ├── discord.js        # Discord client setup
│   └── handlers/
│       ├── index.js      # Handler exports
│       ├── messages.js   # Message handling
│       ├── game.js       # Lylitt game logic
│       └── commands.js   # Slash commands
├── data/                 # Game data (auto-created)
│   ├── scores.json
│   └── used_contents.json
└── logs/                 # Log files (if enabled)
    └── bot.log
```

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure environment:**

   ```bash
   cp example.env .env
   # Edit .env with your Discord credentials
   ```

3. **Copy search script:**

   ```bash
   cp ../old/g1000mots.sh .
   ```

4. **Run the bot:**

   ```bash
   npm start
   ```

   For development with auto-reload:

   ```bash
   npm run dev
   ```

## Configuration

### Required Variables

| Variable        | Description                                  |
| --------------- | -------------------------------------------- |
| `DISCORD_TOKEN` | Bot token from Discord Developer Portal      |
| `CLIENT_ID`     | Application ID from Discord Developer Portal |
| `GUILD_ID`      | Server ID where the bot operates             |

### Optional Variables

See `example.env` for all configuration options including:

- Server port for health checks
- Log levels and file logging
- Game configuration
- Search script settings

## Logging

The bot includes a professional logging system with:

- **Severity Levels:** CRITICAL, ERROR, WARN, INFO, DEBUG, SUCCESS
- **Color Coding:** Each level has a distinct color
- **Timestamps:** Paris timezone with ISO format
- **Module Tags:** Each component logs with its module name
- **File Output:** Optional logging to file

Example output:

```
[2025-11-24 15:30:45] INF [Main] Starting G-Master bot...
[2025-11-24 15:30:46] OK! [Config] Configuration loaded successfully
[2025-11-24 15:30:47] OK! [Discord] Bot connected as "G-Master#1234"
```

## Slash Commands

| Command                  | Description                                   |
| ------------------------ | --------------------------------------------- |
| `/default <mot>`         | Standard search (case-insensitive, substring) |
| `/wholeword <mot>`       | Whole word search (case-insensitive)          |
| `/exact <mot>`           | Exact search (case-sensitive, substring)      |
| `/wholeword-exact <mot>` | Whole word AND case-sensitive search          |

## Game Commands

| Command | Description             |
| ------- | ----------------------- |
| `.rank` | Display the leaderboard |

## API Endpoints

| Endpoint      | Description                 |
| ------------- | --------------------------- |
| `GET /`       | Bot status and uptime       |
| `GET /health` | Health check for monitoring |

## Improvements over v1

1. **Better Code Organization** - Modular structure with separate handlers
2. **Advanced Logging** - Colored output, severity levels, optional file logging
3. **Configuration Management** - Centralized config with validation
4. **Error Handling** - Comprehensive try-catch blocks and graceful shutdown
5. **Clean Exports** - ES modules with proper exports
6. **Health Checks** - HTTP endpoints for monitoring
7. **Development Mode** - Watch mode for auto-reload

## License

MIT

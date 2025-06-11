One-Piece-Leveling-Bot/
│
├── index.js                  # Main bot entry point
├── package.json
├── Dockerfile
├── railway.toml
├── .env.example
├── readme.md
│
├── src/
│   └── commands/
│         ├── admin.js           # /settings and admin logic
│         ├── leaderboard.js     # /leaderboard command
│         ├── level.js           # /level, XP, and level roles
│         └── utility.js         # Shared utility functions for commands (if needed)
│
├── utils/
│     ├── xpLogger.js            # All XP log channel logic, formatting, output
│     └── xpTracker.js           # Voice, message, and reaction XP tracking logic
│
└── (other files/folders as needed)

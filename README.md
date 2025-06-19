# 🏴‍☠️ One Piece Leveling Bot

A Discord bot for role management, leveling, leaderboards, and more — inspired by One Piece!  
Designed for easy deployment on [Railway](https://railway.app) or locally.

---

## 📁 Project Structure

one-piece-leveling-bot/
│
├── assets/ # Images and fonts for image-based features
├── src/
│ ├── commands/ # All command modules (leaderboard, admin, etc.)
│ └── utils/ # Utility scripts for XP, bounty, tracking, etc.
│
├── index.js # Main bot entrypoint
├── package.json # Node.js dependencies & project info
├── railway.toml # Railway project config
├── Dockerfile # For containerized deployment
├── .env.example # Example environment variables
├── README.md # This file!

---

## ⚡ Features

- **Leveling system** — XP from messages, voice, and reactions
- **Leaderboard** with custom One Piece styling
- **Role management** (`/add`, `/delete`, `/settings`, etc.)
- **Admin commands**
- **Supports custom images and fonts for embeds/posters**
- **Easy deployment on Railway or locally**

---

## 🚀 Quick Start (Railway)

### 1. **Clone/Upload the Bot**

If not already on Railway, upload all files or link your repo.

### 2. **Set Environment Variables**

In the Railway project dashboard, go to the "Variables" tab and set:

| Variable         | Description                      |
|------------------|---------------------------------|
| `DISCORD_TOKEN`  | Your Discord bot token           |
| `CLIENT_ID`      | Your Discord Application ID      |
| `DATABASE_URL`   | Your PostgreSQL URL (if used)    |

*For local use, copy `.env.example` to `.env` and fill in your values.*

### 3. **Enable Privileged Intents**

- Go to your bot's page in the [Discord Developer Portal](https://discord.com/developers/applications).
- Click **Bot** in the sidebar.
- Enable **SERVER MEMBERS INTENT**.
- Save changes and restart the bot!

### 4. **Set Bot Permissions**

- The bot’s role must be **above** the roles it will manage in Server Settings > Roles.
- The bot needs **Manage Roles** and **Read Messages/Members** permissions.

### 5. **Deploy!**

- Railway will automatically install dependencies and start the bot.
- If using Dockerfile/railway.toml, ensure the start command matches your main file (`index.js`).

---

## 🛠️ Usage

### **Main Slash Commands**

| Command               | Description                                  | Permissions         |
|-----------------------|----------------------------------------------|---------------------|
| `/leaderboard`        | Show the leveling leaderboard                | Everyone            |
| `/add`                | Add a role to a user or everyone             | Admin only          |
| `/delete`             | Remove a role from a user or everyone        | Admin only          |
| `/settings`           | Adjust leveling and bot settings             | Admin only          |
| ...                   | See `src/commands/` for more                 |                     |

---

## 📝 Customization

- **Edit/Add Commands:**  
  Modify or add command files in `src/commands/`.

- **Change XP/Level Logic:**  
  Tweak XP/bounty systems in `src/utils/`.

- **Custom Images/Fonts:**  
  Replace files in `assets/` for different styles.

---

## 🧩 Troubleshooting

- **Bot says “0 members”:**  
  - Enable SERVER MEMBERS INTENT in Developer Portal  
  - Bot’s role must be above the role it’s managing  
  - Give bot “Manage Roles” permission

- **Bot not responding:**  
  - Check Railway logs  
  - Ensure environment variables are set

- **Roles not being managed:**  
  - Confirm bot's role hierarchy and permissions

---

## 🖥️ Local Development

1. `cp .env.example .env` (and fill in your info)
2. `npm install`
3. `node index.js`

---

## 👑 Credits

Inspired by **One Piece**.  
Created by ExoCode.

---

## 📄 License

Open source — free to use and modify!

---


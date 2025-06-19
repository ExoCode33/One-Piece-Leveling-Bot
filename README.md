🏴‍☠️ One Piece Leveling Bot
A Discord bot for role management, leveling, leaderboards, and more — inspired by One Piece!
Designed for easy deployment on Railway.

📁 Project Structure
bash
Copy
Edit
.
.
├── assets/               # Images and fonts for image-based features
├── src/
│   ├── commands/         # All command modules (leaderboard, admin, etc.)
│   └── utils/            # Utility scripts for XP, bounty, tracking, etc.
├── index.js              # Main bot entrypoint
├── package.json          # Node.js dependencies & project info
├── railway.toml          # Railway project config
├── Dockerfile            # For containerized deployment
├── .env.example          # Example environment variables (copy and edit as .env)
├── README.md             # (This file!)
 
⚡ Features
Leveling system with XP from messages, voice, reactions

Leaderboard with custom One Piece styling

Role management (/add, /delete, /settings, etc.)

Admin commands

Supports custom images and fonts for embeds/posters

Designed for Railway/Node.js deployment

🚀 Quick Start (Railway)
1. Clone/Upload the Bot
If not already on Railway, upload all files or link your repo.

2. Set Environment Variables
You need these in Railway's “Variables”:

Variable	Example/Description
DISCORD_TOKEN	Your Discord bot token
CLIENT_ID	Your Discord Application ID
DATABASE_URL	(If using a DB, e.g. PostgreSQL)

Note:

Use .env.example as a template for local dev (rename to .env).

On Railway, set these in the dashboard (not as a file).

3. Enable Privileged Intents
Go to your bot's page in the Discord Developer Portal.

Under Bot, scroll to Privileged Gateway Intents.

Enable SERVER MEMBERS INTENT.

Save and restart your bot!

4. Set Bot Permissions
The bot's role must be above the roles it will manage.

Bot needs Manage Roles and Read Messages/Members permissions.

5. Deploy!
Railway will auto-install with npm install and run node index.js by default.

If using Dockerfile/railway.toml, double check your start command matches your main file (index.js).

🛠️ Usage
Leaderboard: /leaderboard

Add/Remove Roles: /add, /delete
(administrator only, if using provided code)

Other Commands: See files in src/commands/

📝 Customization
Edit /src/commands/ to add or change bot commands.

Change images or fonts in /assets/.

Logic for XP and leveling is in /src/utils/.

🧩 Troubleshooting
Bot says “0 members”:

Enable SERVER MEMBERS INTENT in Developer Portal

Place bot’s role above target roles

Give bot “Manage Roles” permission

Bot not responding:

Check Railway logs for errors

Make sure environment variables are set correctly

Role not being managed:

Check bot's role hierarchy and permissions

🖥️ Local Development
Copy .env.example to .env and fill in your values.

npm install

node index.js

👑 Credits & License
Inspired by the world of One Piece.
Open source — use and modify as you like!

🚨 Contact
For help or custom changes, just ask ExoCode or your project maintainer!

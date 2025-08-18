// index.js — One Piece Leveling Bot (clean & adapted)
// ---------------------------------------------------
// - Repo layout: src/commands/* , src/utils/*
// - Exports ONLY { db, xpBoostManager } (no stray executeQuery)
// - Recursively loads slash commands from src/commands
// - Optional events loader if you add src/events later
// - Graceful shutdown & clean error handlers
// ---------------------------------------------------

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials, Collection, Events } = require('discord.js');
const { Pool } = require('pg');

// ---- Discord client (intents for leveling: messages, reactions, voice) ----
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent, // disable in dev portal if not needed
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

// ---- Database (PostgreSQL) ----
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.PG_POOL_SIZE || 10),
  idleTimeoutMillis: 30_000,
});

db.on('error', (err) => {
  console.error('[ERROR] PG pool error:', err);
});

// ---- XP Boost Manager (optional, safe if missing) ----
let xpBoostManager = null;
(() => {
  const xpPath = path.join(__dirname, 'src', 'utils', 'xpBoostManager.js');
  if (fs.existsSync(xpPath)) {
    try {
      const XpBoost = require(xpPath);
      xpBoostManager = typeof XpBoost === 'function'
        ? (() => { try { return new XpBoost(db, client); } catch { return new XpBoost(db); } })()
        : XpBoost;
      console.log('[INFO] xpBoostManager loaded');
    } catch (e) {
      console.warn('[WARN] xpBoostManager found but failed to load:', e.message);
    }
  } else {
    console.warn('[WARN] xpBoostManager not found — continuing without it');
  }
})();

// ---- Command loader (recursive) ----
client.commands = new Collection();

function loadCommandsFrom(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      loadCommandsFrom(full);
      continue;
    }
    if (!entry.name.endsWith('.js')) continue;

    try {
      const cmd = require(full);
      // Expect shape: { data: SlashCommandBuilder, execute: (interaction, ctx) => {} }
      if (cmd?.data?.name && typeof cmd.execute === 'function') {
        client.commands.set(cmd.data.name, cmd);
      } else {
        console.warn(`[WARN] Skipped ${path.relative(__dirname, full)}: missing data.name or execute()`);
      }
    } catch (err) {
      console.error('[ERROR] Failed loading command:', path.relative(__dirname, full), err);
    }
  }
}

function loadEventsFrom(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const full = path.join(dir, file);
    try {
      const evt = require(full);
      // Expect shape: { name: 'eventName', once?: bool, execute: (...args) => {} }
      if (evt?.name && typeof evt.execute === 'function') {
        if (evt.once) client.once(evt.name, (...args) => evt.execute(...args, { client, db, xpBoostManager }));
        else client.on(evt.name, (...args) => evt.execute(...args, { client, db, xpBoostManager }));
        console.log(`[INFO] Event wired: ${evt.name} (${file})`);
      } else {
        console.warn(`[WARN] Skipped event ${file}: missing name/execute`);
      }
    } catch (err) {
      console.error('[ERROR] Failed loading event:', file, err);
    }
  }
}

// ---- Ready ----
client.once(Events.ClientReady, async () => {
  console.log(`[READY] Logged in as ${client.user.tag}`);
});

// ---- Slash command handler ----
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      console.warn(`[WARN] Unknown command: ${interaction.commandName}`);
      return;
    }

    const ctx = {
      client,
      db,
      xpBoostManager,
      guild: interaction.guild,
      user: interaction.user,
    };

    await command.execute(interaction, ctx);
  } catch (error) {
    console.error('[ERROR] Command execution failed:', error);
    const reply = { content: '❌ An error occurred while executing that command.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      try { await interaction.followUp(reply); } catch {}
    } else {
      try { await interaction.reply(reply); } catch {}
    }
  }
});

// ---- (Optional) Message/Voice handlers if implemented as direct listeners ----
// If you keep your message/voice XP in utils that register their own listeners,
// you can remove this block. Otherwise, you can hook them here if needed.
// Example (only if these files exist):
const messageHandlerPath = path.join(__dirname, 'src', 'utils', 'messageXpHandler.js');
if (fs.existsSync(messageHandlerPath)) {
  try {
    const handleMessage = require(messageHandlerPath);
    if (typeof handleMessage === 'function') {
      client.on(Events.MessageCreate, (message) =>
        handleMessage(message, { client, db, xpBoostManager })
      );
      console.log('[INFO] messageXpHandler wired');
    }
  } catch (e) {
    console.warn('[WARN] Failed to wire messageXpHandler:', e.message);
  }
}

const voiceHandlerPath = path.join(__dirname, 'src', 'utils', 'voiceXpHandler.js');
if (fs.existsSync(voiceHandlerPath)) {
  try {
    const handleVoice = require(voiceHandlerPath);
    if (typeof handleVoice === 'function') {
      client.on(Events.VoiceStateUpdate, (oldState, newState) =>
        handleVoice(oldState, newState, { client, db, xpBoostManager })
      );
      console.log('[INFO] voiceXpHandler wired');
    }
  } catch (e) {
    console.warn('[WARN] Failed to wire voiceXpHandler:', e.message);
  }
}

// ---- Optional events folder support (safe if folder doesn’t exist) ----
loadEventsFrom(path.join(__dirname, 'src', 'events'));

// ---- Error handling (clean) ----
client.on('error', (error) => {
  console.error('[ERROR] Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('[ERROR] Unhandled promise rejection:', error);
  // Keep running; common with transient DB/HTTP failures
});

process.on('uncaughtException', (error) => {
  console.error('[ERROR] Uncaught Exception:', error);

  // Allow DB hiccups to self-recover
  if (typeof error.message === 'string' && error.message.includes('Connection terminated unexpectedly')) {
    console.log('[INFO] Database connection will be automatically restored');
    return;
  }

  // For other critical errors, exit so the host restarts the process
  process.exit(1);
});

// ---- Graceful shutdown ----
async function shutdown(signal) {
  try {
    console.log(`[INFO] ${signal} received — shutting down...`);

    if (client && typeof client.destroy === 'function') {
      await client.destroy();
    }

    if (db && typeof db.end === 'function') {
      await db.end();
    }

    console.log('[INFO] Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('[ERROR] Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ---- Export ONLY what your commands need ----
module.exports = { db, xpBoostManager };

// ---- Boot ----
(async function main() {
  try {
    loadCommandsFrom(path.join(__dirname, 'src', 'commands'));
    await client.login(process.env.DISCORD_TOKEN);
  } catch (err) {
    console.error('[ERROR] Failed to start bot:', err);
    process.exit(1);
  }
})();

// index.js

const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
require('dotenv').config();
const { sendXPLog } = require('./src/commands/utility');
const level = require('./src/commands/level');
const admin = require('./src/commands/admin');
const leaderboard = require('./src/commands/leaderboard');

// === Database Setup ===
const { Pool } = require('pg');
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});
db.connect().then(() => console.log('[INFO] Database initialized successfully')).catch(console.error);

// === Discord Client Setup ===
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember],
});

client.commands = new Collection();
client.db = db;

// === Register Slash Commands ===
const commandFiles = [level, admin, leaderboard];
for (const command of commandFiles) {
    if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
    }
}

// === Slash Command Handler ===
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction, client);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error executing this command.', ephemeral: true });
    }
});

// === XP/Level Event Example: Message XP ===
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    // Award XP logic here (using your level.js functions)
    const xpAmount = await level.giveXP(message, client);

    // Log to XP channel (if enabled)
    if (xpAmount && process.env.XP_LOG_CHANNEL) {
        sendXPLog(client, `📝 **Message XP**: ${message.author} (+${xpAmount} XP) in <#${message.channel.id}>`);
    }
});

// === XP/Level Event Example: Reaction XP ===
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    // Award Reaction XP logic here (using your level.js functions)
    const xpAmount = await level.giveReactionXP(reaction, user, client);

    // Log to XP channel (if enabled)
    if (xpAmount && process.env.XP_LOG_CHANNEL) {
        sendXPLog(client, `👍 **Reaction XP**: ${user} (+${xpAmount} XP) for reacting in <#${reaction.message.channel.id}>`);
    }
});

// === XP/Level Event Example: Voice XP ===
client.on('voiceStateUpdate', async (oldState, newState) => {
    // Implement your voice XP logic (in level.js or here)
    // Example pseudo-code:
    // const xpAmount = await level.giveVoiceXP(newState, client);

    // // Log to XP channel (if enabled)
    // if (xpAmount && process.env.XP_LOG_CHANNEL) {
    //     sendXPLog(client, `🔊 **Voice XP**: <@${newState.id}> (+${xpAmount} XP) in voice channel \`${newState.channel?.name}\``);
    // }
});

// === Bot Ready Event ===
client.once('ready', () => {
    console.log(`[INFO] Bot logged in as ${client.user.tag}`);
    // Register slash commands globally or per guild if needed
    // (Add your command registration logic if not automated)
});

// === Login ===
client.login(process.env.DISCORD_TOKEN);


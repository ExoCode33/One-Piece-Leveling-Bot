// index.js - Fixed version with proper client setup

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const XPTracker = require('./src/utils/xpTracker');

// Environment validation
const requiredEnvVars = ['DISCORD_TOKEN', 'DATABASE_URL'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`[ERROR] Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}

console.log('[INFO] Starting Discord Leveling Bot...');
console.log('[INFO] Environment validation passed');

// Create client with required intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers
    ]
});

// Initialize collections
client.commands = new Collection();

// Set global client reference IMMEDIATELY
global.client = client;

// Initialize XP Tracker
const xpTracker = new XPTracker();
global.xpTracker = xpTracker;

// Load commands
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`[DEBUG] ✅ Loaded command: ${command.data.name}`);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Event handlers
client.once('ready', async () => {
    console.log(`[INFO] Bot logged in as ${client.user.tag}`);
    
    try {
        // Register slash commands
        const commands = Array.from(client.commands.values()).map(command => command.data.toJSON());
        console.log(`[DEBUG] Registering ${commands.length} slash commands: ${commands.map(c => c.name).join(', ')}`);
        console.log(`[DEBUG] Using bot application ID: ${client.application.id}`);
        
        await client.application.commands.set(commands);
        console.log('[INFO] Successfully registered slash commands');
        
        // Start periodic tasks ONLY after client is ready
        console.log('[INFO] Starting periodic tasks...');
        
        // Process voice XP every minute
        setInterval(() => {
            if (client.isReady()) {
                xpTracker.processVoiceXP().catch(error => {
                    console.error('[ERROR] Error in voice XP processing:', error);
                });
            }
        }, 60000);
        
        // Cleanup daily voice XP (run every 24 hours)
        setInterval(() => {
            if (client.isReady()) {
                xpTracker.cleanupDailyVoiceXP().catch(error => {
                    console.error('[ERROR] Error in daily cleanup:', error);
                });
            }
        }, 24 * 60 * 60 * 1000);
        
        // Run initial cleanup
        await xpTracker.cleanupDailyVoiceXP();
        
        console.log('[INFO] Discord Leveling Bot is fully operational!');
        console.log(`[INFO] Bot is in ${client.guilds.cache.size} servers`);
        console.log(`[INFO] Monitoring ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)} total members`);
        console.log(`[INFO] Daily voice XP cap: ${process.env.DAILY_VOICE_XP_CAP || 6000} XP per user`);
        
    } catch (error) {
        console.error('[ERROR] Error during bot initialization:', error);
    }
});

// Interaction handler
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`[ERROR] No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`[ERROR] Error executing command ${interaction.commandName}:`, error);
        
        const errorMessage = {
            content: 'There was an error while executing this command!',
            ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

// Message handler for XP tracking
client.on('messageCreate', async message => {
    // Ignore bots and system messages
    if (message.author.bot || !message.guild) return;
    
    try {
        // Check cooldown
        if (xpTracker.isOnCooldown(message.author.id, message.guild.id)) {
            return;
        }
        
        // Get guild settings
        const guildSettings = await xpTracker.getGuildSettings(message.guild.id);
        const messageXP = guildSettings.message_xp || parseInt(process.env.MESSAGE_XP) || 15;
        
        // Add XP for message
        await xpTracker.addXP(message.author.id, message.guild.id, messageXP, 'message');
        
        // Set cooldown
        xpTracker.setCooldown(message.author.id, message.guild.id, guildSettings.xp_cooldown || 60);
        
    } catch (error) {
        console.error('[ERROR] Error processing message XP:', error);
    }
});

// Reaction handler for XP tracking
client.on('messageReactionAdd', async (reaction, user) => {
    // Ignore bots
    if (user.bot || !reaction.message.guild) return;
    
    try {
        // Check cooldown
        if (xpTracker.isOnCooldown(user.id, reaction.message.guild.id)) {
            return;
        }
        
        // Get guild settings
        const guildSettings = await xpTracker.getGuildSettings(reaction.message.guild.id);
        const reactionXP = guildSettings.reaction_xp || parseInt(process.env.REACTION_XP) || 2;
        
        // Add XP for reaction
        await xpTracker.addXP(user.id, reaction.message.guild.id, reactionXP, 'reaction');
        
        // Set shorter cooldown for reactions
        xpTracker.setCooldown(user.id, reaction.message.guild.id, 10);
        
    } catch (error) {
        console.error('[ERROR] Error processing reaction XP:', error);
    }
});

// Error handlers
client.on('error', error => {
    console.error('[ERROR] Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('[ERROR] Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('[ERROR] Uncaught Exception:', error);
    // Don't exit the process, just log the error
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('[INFO] Received SIGINT, shutting down gracefully...');
    
    try {
        if (xpTracker && xpTracker.cleanup) {
            await xpTracker.cleanup();
        }
        
        if (client) {
            client.destroy();
        }
        
        console.log('[INFO] Shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('[ERROR] Error during shutdown:', error);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('[INFO] Received SIGTERM, shutting down gracefully...');
    
    try {
        if (xpTracker && xpTracker.cleanup) {
            await xpTracker.cleanup();
        }
        
        if (client) {
            client.destroy();
        }
        
        console.log('[INFO] Shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('[ERROR] Error during shutdown:', error);
        process.exit(1);
    }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);

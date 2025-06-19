const { Client, Collection, GatewayIntentBits, REST, Routes, ActivityType } = require('discord.js');
const { initializeDatabase, getPool } = require('./src/utils/database');
const { loadGuildSettings } = require('./src/utils/settings');
const fs = require('fs');
const path = require('path');

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

// Initialize commands collection
client.commands = new Collection();

// Environment validation
const requiredEnvVars = ['DISCORD_TOKEN', 'DATABASE_URL'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error(`[ERROR] Missing required environment variables: ${missingEnvVars.join(', ')}`);
    process.exit(1);
}

console.log('[INFO] Starting Discord Leveling Bot...');
console.log('[INFO] Environment validation passed');

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
        console.log(`[WARNING] Command at ${filePath} is missing required "data" or "execute" property.`);
    }
}

// Load guild settings on startup
loadGuildSettings();

// Initialize XP tracking utilities
const xpTracker = require('./src/utils/xpTracker');
const messageXP = require('./src/utils/messageXP');
const reactionXP = require('./src/utils/reactionXP');
const voiceXP = require('./src/utils/voiceXP');

// Bot ready event
client.once('ready', async () => {
    console.log(`[INFO] Bot logged in as ${client.user.tag}`);
    
    try {
        // Initialize database
        await initializeDatabase();
        console.log('[INFO] Database connection established');
        console.log('[INFO] Database tables initialized');
        
        // Register slash commands
        const commands = Array.from(client.commands.values()).map(command => command.data.toJSON());
        console.log(`[DEBUG] Registering ${commands.length} slash commands: ${commands.map(c => c.name).join(', ')}`);
        
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        const applicationId = client.user.id;
        console.log(`[DEBUG] Using bot application ID: ${applicationId}`);
        
        await rest.put(
            Routes.applicationCommands(applicationId),
            { body: commands }
        );
        
        console.log('[INFO] Successfully registered slash commands');
        
        // Start periodic tasks
        console.log('[INFO] Starting periodic tasks...');
        startPeriodicTasks();
        
        // Set bot status
        client.user.setActivity('Marine Operations', { type: ActivityType.Watching });
        
        console.log('[INFO] Discord Leveling Bot is fully operational!');
        console.log(`[INFO] Bot is in ${client.guilds.cache.size} servers`);
        console.log(`[INFO] Monitoring ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)} total members`);
        console.log(`[INFO] Daily voice XP cap: ${process.env.DAILY_VOICE_XP_CAP || 4000} XP per user`);
        
        // Initialize voice XP tracking for existing members
        setTimeout(() => {
            voiceXP.scanExistingMembers(client);
        }, 5000);
        
    } catch (error) {
        console.error('[ERROR] Failed to initialize bot:', error);
        process.exit(1);
    }
});

// Slash command interactions
client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        
        if (!command) {
            console.error(`[ERROR] No command matching ${interaction.commandName} was found.`);
            return;
        }
        
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error('[ERROR] Error executing command:', error);
            
            const errorMessage = {
                content: '```diff\n- MARINE INTELLIGENCE SYSTEM ERROR\n- Command execution failed. Please try again.```',
                ephemeral: true
            };
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    } else if (interaction.isButton()) {
        // Handle button interactions
        await handleButtonInteraction(interaction);
    }
});

// Button interaction handler
async function handleButtonInteraction(interaction) {
    try {
        const pool = getPool();
        
        // Maintenance buttons
        if (['cleanup_inactive', 'optimize_db', 'backup_stats'].includes(interaction.customId)) {
            const adminCommand = require('./src/commands/admin');
            await adminCommand.handleMaintenanceButtons(interaction, pool);
        }
        
        // Nuclear buttons
        if (['nuclear_confirm', 'nuclear_abort', 'nuclear_execute'].includes(interaction.customId)) {
            // Additional security check for nuclear operations
            if (!interaction.member.permissions.has('Administrator')) {
                return interaction.reply({
                    content: '```diff\n- ACCESS DENIED - NUCLEAR AUTHORIZATION REQUIRED\n- ADMINISTRATOR PERMISSIONS MANDATORY```',
                    ephemeral: true
                });
            }
            
            const adminCommand = require('./src/commands/admin');
            await adminCommand.handleNuclearButtons(interaction, pool);
        }
        
    } catch (error) {
        console.error('[ERROR] Button interaction error:', error);
        
        const errorMessage = {
            content: '```diff\n- MARINE INTELLIGENCE SYSTEM ERROR\n- Button interaction failed. Please try again.```',
            ephemeral: true
        };
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
}

// Message events for XP tracking
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    
    // Check if user has excluded role (Pirate King)
    const excludedRoleId = process.env.LEADERBOARD_EXCLUDE_ROLE;
    if (excludedRoleId && message.member.roles.cache.has(excludedRoleId)) {
        return; // Skip XP tracking for Pirate King
    }
    
    try {
        await messageXP.handleMessage(message);
        await xpTracker.updateUserXP(message.author.id, message.guild.id, 'message');
    } catch (error) {
        console.error('[ERROR] Message XP tracking error:', error);
    }
});

// Reaction events for XP tracking
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot || !reaction.message.guild) return;
    
    // Check if user has excluded role (Pirate King)
    const excludedRoleId = process.env.LEADERBOARD_EXCLUDE_ROLE;
    const member = reaction.message.guild.members.cache.get(user.id);
    if (excludedRoleId && member && member.roles.cache.has(excludedRoleId)) {
        return; // Skip XP tracking for Pirate King
    }
    
    try {
        await reactionXP.handleReaction(reaction, user);
        await xpTracker.updateUserXP(user.id, reaction.message.guild.id, 'reaction');
    } catch (error) {
        console.error('[ERROR] Reaction XP tracking error:', error);
    }
});

// Voice state events for XP tracking
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        await voiceXP.handleVoiceStateUpdate(oldState, newState);
    } catch (error) {
        console.error('[ERROR] Voice XP tracking error:', error);
    }
});

// Guild member events
client.on('guildMemberAdd', member => {
    console.log(`[INFO] New member joined: ${member.user.tag} in ${member.guild.name}`);
});

client.on('guildMemberRemove', member => {
    console.log(`[INFO] Member left: ${member.user.tag} from ${member.guild.name}`);
});

// Guild events
client.on('guildCreate', guild => {
    console.log(`[INFO] Bot added to new guild: ${guild.name} (${guild.id})`);
});

client.on('guildDelete', guild => {
    console.log(`[INFO] Bot removed from guild: ${guild.name} (${guild.id})`);
});

// Error handling
client.on('error', error => {
    console.error('[ERROR] Discord client error:', error);
});

client.on('warn', warning => {
    console.warn('[WARNING] Discord client warning:', warning);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[ERROR] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', error => {
    console.error('[ERROR] Uncaught exception:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('[INFO] Received SIGINT, shutting down gracefully...');
    
    try {
        await client.destroy();
        console.log('[INFO] Discord client destroyed');
        
        const pool = getPool();
        if (pool) {
            await pool.end();
            console.log('[INFO] Database connection closed');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('[ERROR] Error during shutdown:', error);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('[INFO] Received SIGTERM, shutting down gracefully...');
    
    try {
        await client.destroy();
        const pool = getPool();
        if (pool) {
            await pool.end();
        }
        process.exit(0);
    } catch (error) {
        console.error('[ERROR] Error during shutdown:', error);
        process.exit(1);
    }
});

// Periodic tasks
function startPeriodicTasks() {
    // Health check every 5 minutes
    setInterval(() => {
        const memoryUsage = process.memoryUsage();
        const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        
        if (memoryMB > 450) { // Warning at 450MB
            console.warn(`[WARNING] High memory usage: ${memoryMB}MB`);
        }
        
        console.log(`[HEALTH] Memory: ${memoryMB}MB | Guilds: ${client.guilds.cache.size} | Uptime: ${Math.floor(process.uptime() / 60)}min`);
    }, 5 * 60 * 1000);
    
    // Database cleanup every hour
    setInterval(async () => {
        try {
            const pool = getPool();
            // Clean up old voice sessions that might be stuck
            await pool.query(`
                DELETE FROM daily_voice_xp 
                WHERE date < CURRENT_DATE - INTERVAL '7 days'
            `);
            
            console.log('[CLEANUP] Cleaned old voice XP records');
        } catch (error) {
            console.error('[ERROR] Cleanup task failed:', error);
        }
    }, 60 * 60 * 1000);
}

// Login to Discord
client.login(process.env.DISCORD_TOKEN);

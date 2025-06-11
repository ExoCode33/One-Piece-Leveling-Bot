// index.js - Complete Discord Leveling Bot with All Features

const { Client, GatewayIntentBits, Partials, Collection, EmbedBuilder, REST, Routes } = require('discord.js');
require('dotenv').config();

// === Database Setup ===
const { Pool } = require('pg');
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

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

// === Cooldown Maps ===
const messageCooldowns = new Map();
const reactionCooldowns = new Map();
const voiceSessions = new Map();

// === Helper Functions ===
function getRandomXP(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateLevel(xp) {
    const curve = process.env.FORMULA_CURVE || 'exponential';
    const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
    const maxLevel = parseInt(process.env.MAX_LEVEL) || 50;
    
    let level;
    switch (curve) {
        case 'linear':
            level = Math.floor(xp / (1000 * multiplier));
            break;
        case 'logarithmic':
            level = Math.floor(Math.log(xp / 100 + 1) * multiplier);
            break;
        case 'exponential':
        default:
            level = Math.floor(Math.sqrt(xp / 100) * multiplier);
            break;
    }
    
    return Math.min(level, maxLevel);
}

function calculateXPForLevel(level) {
    const curve = process.env.FORMULA_CURVE || 'exponential';
    const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
    
    switch (curve) {
        case 'linear':
            return Math.floor(level * 1000 * multiplier);
        case 'logarithmic':
            return Math.floor((Math.exp(level / multiplier) - 1) * 100);
        case 'exponential':
        default:
            return Math.floor(Math.pow(level / multiplier, 2) * 100);
    }
}

async function debugLog(message) {
    if (process.env.DEBUG_MODE === 'true') {
        console.log(`[DEBUG] ${message}`);
    }
}

async function sendXPLog(content) {
    const logChannelId = process.env.XP_LOG_CHANNEL;
    if (!logChannelId || process.env.XP_LOG_ENABLED !== 'true') return;

    try {
        const channel = await client.channels.fetch(logChannelId);
        if (channel && channel.isTextBased()) {
            await channel.send(content);
        }
    } catch (err) {
        console.error('[XP LOG] Failed to send log:', err);
    }
}

async function updateUserLevel(userId, guildId, xpGain, activityType) {
    try {
        // Get current user data
        const userQuery = `
            SELECT total_xp, level, messages, reactions, voice_time 
            FROM user_levels 
            WHERE user_id = $1 AND guild_id = $2
        `;
        let userResult = await db.query(userQuery, [userId, guildId]);
        
        let currentXP = 0;
        let currentLevel = 0;
        let messages = 0;
        let reactions = 0;
        let voiceTime = 0;
        
        if (userResult.rows.length > 0) {
            const row = userResult.rows[0];
            currentXP = row.total_xp;
            currentLevel = row.level;
            messages = row.messages;
            reactions = row.reactions;
            voiceTime = row.voice_time;
        }
        
        // Apply XP multiplier
        const multiplier = parseFloat(process.env.XP_MULTIPLIER) || 1.0;
        const finalXP = Math.floor(xpGain * multiplier);
        const newTotalXP = currentXP + finalXP;
        const newLevel = calculateLevel(newTotalXP);
        
        // Update activity counters
        if (activityType === 'message') messages++;
        if (activityType === 'reaction') reactions++;
        if (activityType === 'voice') voiceTime += 1; // 1 minute increment
        
        // Upsert user data
        const upsertQuery = `
            INSERT INTO user_levels (user_id, guild_id, total_xp, level, messages, reactions, voice_time, last_updated)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (user_id, guild_id)
            DO UPDATE SET 
                total_xp = $3,
                level = $4,
                messages = $5,
                reactions = $6,
                voice_time = $7,
                last_updated = NOW()
        `;
        
        await db.query(upsertQuery, [userId, guildId, newTotalXP, newLevel, messages, reactions, voiceTime]);
        
        // Debug logging
        await debugLog(`XP Update: User ${userId}, Activity: ${activityType}, XP: +${finalXP}, Total: ${newTotalXP}, Level: ${newLevel}`);
        
        // Check for level up
        if (newLevel > currentLevel) {
            await handleLevelUp(userId, guildId, newLevel, currentLevel);
        }
        
        return finalXP;
    } catch (error) {
        console.error('Error updating user level:', error);
        return 0;
    }
}

async function handleLevelUp(userId, guildId, newLevel, oldLevel) {
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;
        
        const user = await guild.members.fetch(userId);
        if (!user) return;
        
        await debugLog(`Level Up: ${user.user.tag} reached level ${newLevel}`);
        
        // Check for role rewards
        const roleId = process.env[`LEVEL_${newLevel}_ROLE`];
        if (roleId && roleId !== 'your_role_id_here') {
            try {
                const role = guild.roles.cache.get(roleId);
                if (role && !user.roles.cache.has(roleId)) {
                    await user.roles.add(role);
                    console.log(`[LEVEL UP] Added role ${role.name} to ${user.user.tag}`);
                }
            } catch (error) {
                console.error(`Error adding role for level ${newLevel}:`, error);
            }
        }
        
        // Send level up message
        const levelUpEnabled = process.env.LEVELUP_ENABLED !== 'false';
        if (levelUpEnabled) {
            const channelId = process.env.LEVELUP_CHANNEL;
            let channel = null;
            
            if (channelId && channelId !== 'your_levelup_channel_id') {
                channel = guild.channels.cache.get(channelId);
            }
            
            if (!channel) {
                // Use a general channel if levelup channel not found
                channel = guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(guild.members.me).has('SendMessages'));
            }
            
            if (channel) {
                let message = process.env.LEVELUP_MESSAGE || 'Congratulations {user}! You\'ve reached **Level {level}**!';
                message = message.replace('{user}', process.env.LEVELUP_PING_USER === 'true' ? `<@${userId}>` : user.user.username);
                message = message.replace('{level}', newLevel);
                message = message.replace('{oldlevel}', oldLevel);
                
                const embed = new EmbedBuilder()
                    .setTitle('🎉 Level Up!')
                    .setDescription(message)
                    .setColor(0x00AE86)
                    .setThumbnail(user.user.displayAvatarURL());
                
                if (process.env.LEVELUP_SHOW_XP === 'true') {
                    const userQuery = `SELECT total_xp FROM user_levels WHERE user_id = $1 AND guild_id = $2`;
                    const result = await db.query(userQuery, [userId, guildId]);
                    if (result.rows.length > 0) {
                        embed.addFields({ name: 'Total XP', value: result.rows[0].total_xp.toString(), inline: true });
                    }
                }
                
                if (process.env.LEVELUP_SHOW_PROGRESS === 'true') {
                    const nextLevelXP = calculateXPForLevel(newLevel + 1);
                    const currentLevelXP = calculateXPForLevel(newLevel);
                    embed.addFields({ name: 'Next Level', value: `${nextLevelXP - currentLevelXP} XP needed`, inline: true });
                }
                
                if (process.env.LEVELUP_SHOW_ROLE === 'true' && roleId && roleId !== 'your_role_id_here') {
                    const role = guild.roles.cache.get(roleId);
                    if (role) {
                        embed.addFields({ name: 'Role Unlocked', value: role.name, inline: true });
                    }
                }
                
                await channel.send({ embeds: [embed] });
            }
        }
    } catch (error) {
        console.error('Error handling level up:', error);
    }
}

// === Database Initialization ===
async function initializeDatabase() {
    try {
        // Create user_levels table
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_levels (
                user_id VARCHAR(20) NOT NULL,
                guild_id VARCHAR(20) NOT NULL,
                total_xp INTEGER DEFAULT 0,
                level INTEGER DEFAULT 0,
                messages INTEGER DEFAULT 0,
                reactions INTEGER DEFAULT 0,
                voice_time INTEGER DEFAULT 0,
                last_updated TIMESTAMP DEFAULT NOW(),
                PRIMARY KEY (user_id, guild_id)
            )
        `);
        
        // Create voice_sessions table
        await db.query(`
            CREATE TABLE IF NOT EXISTS voice_sessions (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(20) NOT NULL,
                guild_id VARCHAR(20) NOT NULL,
                channel_id VARCHAR(20) NOT NULL,
                start_time TIMESTAMP DEFAULT NOW(),
                end_time TIMESTAMP,
                duration INTEGER DEFAULT 0,
                xp_awarded INTEGER DEFAULT 0
            )
        `);
        
        // Create guild_settings table
        await db.query(`
            CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id VARCHAR(20) PRIMARY KEY,
                level_roles JSONB DEFAULT '{}',
                settings JSONB DEFAULT '{}'
            )
        `);
        
        console.log('[INFO] Database tables initialized successfully');
        
        if (process.env.DEBUG_DATABASE === 'true') {
            const userCount = await db.query('SELECT COUNT(*) FROM user_levels');
            console.log(`[DEBUG] Database has ${userCount.rows[0].count} user records`);
        }
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// === Slash Commands ===
const commands = [
    {
        name: 'level',
        description: 'Check your or someone\'s level and stats',
        options: [
            {
                name: 'user',
                description: 'User to check (optional)',
                type: 6,
                required: false
            }
        ]
    },
    {
        name: 'leaderboard',
        description: 'Show the server leaderboard',
        options: [
            {
                name: 'page',
                description: 'Page number (default: 1)',
                type: 4,
                required: false
            }
        ]
    },
    {
        name: 'settings',
        description: 'View bot settings (Admin only)'
    },
    {
        name: 'setlevelrole',
        description: 'Set role reward for a level (Admin only)',
        options: [
            {
                name: 'level',
                description: 'Level number',
                type: 4,
                required: true
            },
            {
                name: 'role',
                description: 'Role to assign (leave empty to remove)',
                type: 8,
                required: false
            }
        ]
    },
    {
        name: 'levelroles',
        description: 'View all configured level roles'
    }
];

// === Command Handlers ===
async function handleLevelCommand(interaction) {
    try {
        await interaction.deferReply();
        
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userId = targetUser.id;
        const guildId = interaction.guildId;
        
        const query = `
            SELECT total_xp, level, messages, reactions, voice_time
            FROM user_levels
            WHERE user_id = $1 AND guild_id = $2
        `;
        const result = await db.query(query, [userId, guildId]);
        
        if (!result.rows.length) {
            return await interaction.editReply(`${targetUser === interaction.user ? 'You have' : `${targetUser.username} has`} no XP yet! Send messages to start leveling up.`);
        }
        
        const row = result.rows[0];
        const currentLevelXP = calculateXPForLevel(row.level);
        const nextLevelXP = calculateXPForLevel(row.level + 1);
        const progressXP = row.total_xp - currentLevelXP;
        const neededXP = nextLevelXP - currentLevelXP;
        
        const embed = new EmbedBuilder()
            .setTitle(`${targetUser.username}'s Level Stats`)
            .setThumbnail(targetUser.displayAvatarURL())
            .setColor(0x00AE86)
            .addFields(
                { name: 'Level', value: row.level.toString(), inline: true },
                { name: 'Total XP', value: row.total_xp.toString(), inline: true },
                { name: 'Progress', value: `${progressXP}/${neededXP} XP`, inline: true },
                { name: 'Messages', value: row.messages.toString(), inline: true },
                { name: 'Reactions', value: row.reactions.toString(), inline: true },
                { name: 'Voice Time', value: `${row.voice_time} minutes`, inline: true }
            );
        
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error in level command:', error);
        await interaction.editReply('An error occurred while fetching level data.');
    }
}

async function handleLeaderboardCommand(interaction) {
    try {
        await interaction.deferReply();
        
        const page = Math.max(1, interaction.options.getInteger('page') || 1);
        const offset = (page - 1) * 10;
        const guildId = interaction.guildId;
        
        // Check for leaderboard exclude role
        const excludeRoleId = process.env.LEADERBOARD_EXCLUDE_ROLE;
        let query = `
            SELECT user_id, total_xp, level
            FROM user_levels
            WHERE guild_id = $1
            ORDER BY total_xp DESC
            LIMIT 10 OFFSET $2
        `;
        
        const result = await db.query(query, [guildId, offset]);
        
        if (!result.rows.length) {
            return await interaction.editReply("No users found on the leaderboard.");
        }
        
        let leaderboard = '';
        for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows[i];
            const rank = offset + i + 1;
            
            // Check if user has exclude role
            if (excludeRoleId && excludeRoleId !== 'your_exclude_role_id') {
                try {
                    const member = await interaction.guild.members.fetch(row.user_id);
                    if (member.roles.cache.has(excludeRoleId)) continue;
                } catch (error) {
                    // User might have left the server
                }
            }
            
            leaderboard += `**#${rank}** <@${row.user_id}> — Level ${row.level} (${row.total_xp} XP)\n`;
        }
        
        const embed = new EmbedBuilder()
            .setTitle(`🏆 Server Leaderboard - Page ${page}`)
            .setDescription(leaderboard || 'No users found.')
            .setColor(0xFFD700);
        
        await interaction.editReply({ embeds: [embed], allowedMentions: { users: [] } });
    } catch (error) {
        console.error('Error in leaderboard command:', error);
        await interaction.editReply('An error occurred while fetching the leaderboard.');
    }
}

async function handleSettingsCommand(interaction) {
    try {
        if (!interaction.member.permissions.has('Administrator')) {
            return await interaction.reply({ content: 'You need Administrator permissions to use this command.', ephemeral: true });
        }
        
        await interaction.deferReply({ ephemeral: true });
        
        const embed = new EmbedBuilder()
            .setTitle('🔧 Bot Settings')
            .setColor(0x0099FF)
            .addFields(
                { name: 'Message XP', value: `${process.env.MESSAGE_XP_MIN || 25}-${process.env.MESSAGE_XP_MAX || 35}`, inline: true },
                { name: 'Voice XP', value: `${process.env.VOICE_XP_MIN || 45}-${process.env.VOICE_XP_MAX || 55} per minute`, inline: true },
                { name: 'Reaction XP', value: `${process.env.REACTION_XP_MIN || 25}-${process.env.REACTION_XP_MAX || 35}`, inline: true },
                { name: 'Message Cooldown', value: `${(parseInt(process.env.MESSAGE_COOLDOWN) || 60000) / 1000}s`, inline: true },
                { name: 'Voice Cooldown', value: `${(parseInt(process.env.VOICE_COOLDOWN) || 60000) / 1000}s`, inline: true },
                { name: 'Reaction Cooldown', value: `${(parseInt(process.env.REACTION_COOLDOWN) || 300000) / 1000}s`, inline: true },
                { name: 'Formula', value: process.env.FORMULA_CURVE || 'exponential', inline: true },
                { name: 'Multiplier', value: process.env.FORMULA_MULTIPLIER || '1.75', inline: true },
                { name: 'Max Level', value: process.env.MAX_LEVEL || '50', inline: true }
            );
        
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error in settings command:', error);
        await interaction.editReply('An error occurred while fetching settings.');
    }
}

// === Event Handlers ===
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    
    const userId = message.author.id;
    const guildId = message.guildId;
    const cooldownKey = `${userId}-${guildId}`;
    const cooldownTime = parseInt(process.env.MESSAGE_COOLDOWN) || 60000;
    
    // Check cooldown
    if (messageCooldowns.has(cooldownKey)) {
        const expirationTime = messageCooldowns.get(cooldownKey) + cooldownTime;
        if (Date.now() < expirationTime) return;
    }
    
    // Set cooldown
    messageCooldowns.set(cooldownKey, Date.now());
    setTimeout(() => messageCooldowns.delete(cooldownKey), cooldownTime);
    
    // Award XP
    const minXP = parseInt(process.env.MESSAGE_XP_MIN) || 25;
    const maxXP = parseInt(process.env.MESSAGE_XP_MAX) || 35;
    const xpAmount = getRandomXP(minXP, maxXP);
    
    const actualXP = await updateUserLevel(userId, guildId, xpAmount, 'message');
    
    // Log XP if enabled
    if (process.env.XP_LOG_MESSAGES === 'true') {
        await sendXPLog(`📝 **Message XP**: ${message.author} (+${actualXP} XP) in <#${message.channel.id}>`);
    }
});

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot || !reaction.message.guild) return;
    
    const userId = user.id;
    const guildId = reaction.message.guildId;
    const cooldownKey = `${userId}-${guildId}`;
    const cooldownTime = parseInt(process.env.REACTION_COOLDOWN) || 300000;
    
    // Check cooldown
    if (reactionCooldowns.has(cooldownKey)) {
        const expirationTime = reactionCooldowns.get(cooldownKey) + cooldownTime;
        if (Date.now() < expirationTime) return;
    }
    
    // Set cooldown
    reactionCooldowns.set(cooldownKey, Date.now());
    setTimeout(() => reactionCooldowns.delete(cooldownKey), cooldownTime);
    
    // Award XP
    const minXP = parseInt(process.env.REACTION_XP_MIN) || 25;
    const maxXP = parseInt(process.env.REACTION_XP_MAX) || 35;
    const xpAmount = getRandomXP(minXP, maxXP);
    
    const actualXP = await updateUserLevel(userId, guildId, xpAmount, 'reaction');
    
    // Log XP if enabled
    if (process.env.XP_LOG_REACTIONS === 'true') {
        await sendXPLog(`👍 **Reaction XP**: ${user} (+${actualXP} XP) in <#${reaction.message.channel.id}>`);
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.id || oldState.id;
    const guildId = newState.guild.id;
    
    if (!userId || !guildId) return;
    
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;
    
    const sessionKey = `${userId}-${guildId}`;
    
    // User joined a voice channel
    if (!oldState.channelId && newState.channelId) {
        voiceSessions.set(sessionKey, {
            channelId: newState.channelId,
            startTime: Date.now(),
            lastXPTime: Date.now()
        });
        await debugLog(`Voice session started: ${member.user.tag} joined ${newState.channel.name}`);
    }
    
    // User left a voice channel
    else if (oldState.channelId && !newState.channelId) {
        const session = voiceSessions.get(sessionKey);
        if (session) {
            const duration = Math.floor((Date.now() - session.startTime) / 60000); // minutes
            voiceSessions.delete(sessionKey);
            
            // Record session in database
            try {
                await db.query(`
                    INSERT INTO voice_sessions (user_id, guild_id, channel_id, start_time, end_time, duration)
                    VALUES ($1, $2, $3, to_timestamp($4/1000), NOW(), $5)
                `, [userId, guildId, session.channelId, session.startTime, duration]);
            } catch (error) {
                console.error('Error recording voice session:', error);
            }
            
            await debugLog(`Voice session ended: ${member.user.tag} left after ${duration} minutes`);
        }
    }
    
    // User switched channels
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        const session = voiceSessions.get(sessionKey);
        if (session) {
            session.channelId = newState.channelId;
            await debugLog(`Voice session moved: ${member.user.tag} moved to ${newState.channel.name}`);
        }
    }
});

// Voice XP Award Loop
setInterval(async () => {
    for (const [sessionKey, session] of voiceSessions.entries()) {
        try {
            const [userId, guildId] = sessionKey.split('-');
            const guild = client.guilds.cache.get(guildId);
            if (!guild) continue;
            
            const channel = guild.channels.cache.get(session.channelId);
            if (!channel) continue;
            
            // Check minimum members requirement
            const minMembers = parseInt(process.env.VOICE_MIN_MEMBERS) || 2;
            const humanMembers = channel.members.filter(m => !m.user.bot);
            if (humanMembers.size < minMembers) continue;
            
            // Check anti-AFK if enabled
            if (process.env.VOICE_ANTI_AFK === 'true') {
                const member = humanMembers.get(userId);
                if (member && (member.voice.mute || member.voice.deaf)) {
                    // Skip XP for muted/deafened users
                    continue;
                }
            }
            
            // Check voice cooldown
            const cooldownTime = parseInt(process.env.VOICE_COOLDOWN) || 60000;
            if (Date.now() - session.lastXPTime < cooldownTime) continue;
            
            // Award XP
            const minXP = parseInt(process.env.VOICE_XP_MIN) || 45;
            const maxXP = parseInt(process.env.VOICE_XP_MAX) || 55;
            const xpAmount = getRandomXP(minXP, maxXP);
            
            const actualXP = await updateUserLevel(userId, guildId, xpAmount, 'voice');
            session.lastXPTime = Date.now();
            
            // Log XP if enabled
            if (process.env.DEBUG_VOICE === 'true') {
                await debugLog(`Voice XP awarded: ${userId} (+${actualXP} XP) in ${channel.name}`);
            }
            
        } catch (error) {
            console.error('Error in voice XP loop:', error);
        }
    }
}, 60000); // Check every minute

// === Slash Command Handler ===
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    
    try {
        switch (interaction.commandName) {
            case 'level':
                await handleLevelCommand(interaction);
                break;
            case 'leaderboard':
                await handleLeaderboardCommand(interaction);
                break;
            case 'settings':
                await handleSettingsCommand(interaction);
                break;
            default:
                await interaction.reply({ content: 'Command not found.', ephemeral: true });
        }
    } catch (error) {
        console.error('Error handling command:', error);
        try {
            if (interaction.deferred) {
                await interaction.editReply('An error occurred while executing this command.');
            } else {
                await interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
            }
        } catch (e) {
            console.error('Error sending error message:', e);
        }
    }
});

// === Bot Ready Event ===
client.once('ready', async () => {
    console.log(`[INFO] Bot logged in as ${client.user.tag}`);
    
    // Initialize database
    await initializeDatabase();
    
    // Register slash commands
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        
        if (process.env.DEBUG_COMMANDS === 'true') {
            console.log('[DEBUG] Registering slash commands...');
        }
        
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        
        console.log('[INFO] Slash commands registered successfully');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
    
    // Set bot status
    client.user.setActivity('for XP gains!', { type: 'WATCHING' });
    
    console.log('[INFO] Discord Leveling Bot is fully operational!');
});

// === Error Handling ===
client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

// === Login ===
client.login(process.env.DISCORD_TOKEN);

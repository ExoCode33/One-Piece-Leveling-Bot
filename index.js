const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const { Pool } = require('pg');
const CommandHandler = require('./src/commands');
require('dotenv').config();

// Simple debug replacement
const debug = {
    debug: (...args) => console.log('[DEBUG]', ...args),
    voice: (...args) => console.log('[VOICE]', ...args),
    xp: (...args) => console.log('[XP]', ...args),
    database: (...args) => console.log('[DB]', ...args),
    command: (...args) => console.log('[CMD]', ...args),
    levelup: (...args) => console.log('[LEVELUP]', ...args),
    success: (category, ...args) => console.log('[SUCCESS]', category, ...args),
    error: (category, ...args) => console.error('[ERROR]', category, ...args),
    warn: (category, ...args) => console.warn('[WARN]', category, ...args)
};

class LevelingBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMembers
            ]
        });

        // PostgreSQL connection
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });

        // Voice tracking
        this.voiceTracker = new Map();
        
        // Cooldown tracking
        this.messageCooldowns = new Map();
        this.reactionCooldowns = new Map();

        // Load configuration
        this.loadConfiguration();

        // Initialize command handler
        this.commandHandler = new CommandHandler(this);

        debug.debug('Bot Configuration loaded');

        this.initializeDatabase();
        this.setupEventHandlers();
        this.setupCommands();
    }

    loadConfiguration() {
        // XP Configuration
        this.config = {
            messageXPMin: parseInt(process.env.MESSAGE_XP_MIN) || 25,
            messageXPMax: parseInt(process.env.MESSAGE_XP_MAX) || 35,
            messageCooldown: parseInt(process.env.MESSAGE_COOLDOWN) || 60000,
            voiceXPMin: parseInt(process.env.VOICE_XP_MIN) || 45,
            voiceXPMax: parseInt(process.env.VOICE_XP_MAX) || 55,
            voiceCooldown: parseInt(process.env.VOICE_COOLDOWN) || 180000,
            voiceMinMembers: parseInt(process.env.VOICE_MIN_MEMBERS) || 2,
            voiceAntiAFK: process.env.VOICE_ANTI_AFK === 'true' || true,
            reactionXPMin: parseInt(process.env.REACTION_XP_MIN) || 25,
            reactionXPMax: parseInt(process.env.REACTION_XP_MAX) || 35,
            reactionCooldown: parseInt(process.env.REACTION_COOLDOWN) || 300000,
            formulaCurve: process.env.FORMULA_CURVE || 'exponential',
            formulaMultiplier: parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75,
            maxLevel: parseInt(process.env.MAX_LEVEL) || 50,
            xpMultiplier: parseFloat(process.env.XP_MULTIPLIER) || 1.0
        };

        // Level roles
        this.levelRoles = {
            0: process.env.LEVEL_0_ROLE || null,
            5: process.env.LEVEL_5_ROLE || null,
            10: process.env.LEVEL_10_ROLE || null,
            15: process.env.LEVEL_15_ROLE || null,
            20: process.env.LEVEL_20_ROLE || null,
            25: process.env.LEVEL_25_ROLE || null,
            30: process.env.LEVEL_30_ROLE || null,
            35: process.env.LEVEL_35_ROLE || null,
            40: process.env.LEVEL_40_ROLE || null,
            45: process.env.LEVEL_45_ROLE || null,
            50: process.env.LEVEL_50_ROLE || null
        };

        // Level up configuration
        this.levelUpConfig = {
            enabled: process.env.LEVELUP_ENABLED !== 'false',
            channel: process.env.LEVELUP_CHANNEL || null,
            channelName: process.env.LEVELUP_CHANNEL_NAME || null,
            message: process.env.LEVELUP_MESSAGE || '⚡ **BREAKING NEWS!** ⚡\n📰 *World Economic News* reports that **{user}** has become a more notorious pirate!\n\n💰 **NEW BOUNTY:** {bounty}\n⚔️ **THREAT LEVEL:** Level {level} Pirate\n\n*The World Government has issued an updated wanted poster!*',
            showXP: process.env.LEVELUP_SHOW_XP !== 'false',
            showProgress: process.env.LEVELUP_SHOW_PROGRESS !== 'false',
            showRole: process.env.LEVELUP_SHOW_ROLE !== 'false',
            pingUser: process.env.LEVELUP_PING_USER === 'true' || false
        };

        // Leaderboard configuration
        this.leaderboardConfig = {
            topRole: process.env.LEADERBOARD_TOP_ROLE || null,
            excludeRole: process.env.LEADERBOARD_EXCLUDE_ROLE || null
        };

        // XP Logging configuration
        this.xpLogConfig = {
            enabled: process.env.XP_LOG_ENABLED === 'true' || false,
            channel: process.env.XP_LOG_CHANNEL || null,
            channelName: process.env.XP_LOG_CHANNEL_NAME || null,
            logMessages: process.env.XP_LOG_MESSAGES !== 'false',
            logReactions: process.env.XP_LOG_REACTIONS !== 'false', 
            logVoice: process.env.XP_LOG_VOICE !== 'false',
            logLevelUps: process.env.XP_LOG_LEVELUPS !== 'false',
            showCooldowns: process.env.XP_LOG_SHOW_COOLDOWNS === 'true' || false
        };
    }

    // Method to reload configuration (called by commands)
    reloadConfiguration() {
        this.loadConfiguration();
        // Update the command handler with new config
        this.commandHandler.updateConfiguration();
    }

    async initializeDatabase() {
        try {
            debug.database('Initializing database tables...');
            
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS user_levels (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    guild_id TEXT NOT NULL,
                    messages INTEGER DEFAULT 0,
                    reactions INTEGER DEFAULT 0,
                    voice_time INTEGER DEFAULT 0,
                    total_xp BIGINT DEFAULT 0,
                    level INTEGER DEFAULT 0,
                    last_message_time DATE DEFAULT CURRENT_DATE,
                    last_reaction_time DATE DEFAULT CURRENT_DATE,
                    UNIQUE(user_id, guild_id)
                );
            `);

            await this.db.query(`
                CREATE TABLE IF NOT EXISTS guild_settings (
                    guild_id TEXT PRIMARY KEY,
                    level_roles JSON DEFAULT '{}',
                    xp_multiplier REAL DEFAULT 1.0,
                    voice_xp_rate INTEGER DEFAULT 1,
                    message_xp_min INTEGER DEFAULT 15,
                    message_xp_max INTEGER DEFAULT 25,
                    reaction_xp INTEGER DEFAULT 5,
                    level_up_channel TEXT,
                    created_at DATE DEFAULT CURRENT_DATE
                );
            `);

            await this.db.query(`
                CREATE TABLE IF NOT EXISTS voice_sessions (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    guild_id TEXT NOT NULL,
                    start_time DATE DEFAULT CURRENT_DATE,
                    end_time DATE,
                    duration INTEGER DEFAULT 0
                );
            `);

            debug.success('Database', 'Tables initialized successfully');
        } catch (error) {
            debug.error('Database Initialization', error);
        }
    }

    setupEventHandlers() {
        this.client.once('ready', () => {
            console.log(`✅ Logged in as ${this.client.user.tag}`);
            debug.success('Bot Started', `${this.client.user.tag} is online`);
            
            this.client.user.setActivity('Leveling System | /level', { type: ActivityType.Watching });
        });

        // Message XP
        this.client.on('messageCreate', async (message) => {
            if (message.author.bot || !message.guild) return;
            
            const cooldownKey = `${message.author.id}-${message.guild.id}`;
            const now = Date.now();
            
            // Check cooldown
            if (this.messageCooldowns.has(cooldownKey)) {
                const cooldownEnd = this.messageCooldowns.get(cooldownKey);
                if (now < cooldownEnd) {
                    // Log cooldown if enabled
                    await this.logCooldown(message.author.id, message.guild.id, 'message', cooldownEnd - now);
                    return;
                }
            }
            
            this.messageCooldowns.set(cooldownKey, now + this.config.messageCooldown);
            
            const xpGain = Math.floor(Math.random() * (this.config.messageXPMax - this.config.messageXPMin + 1)) + this.config.messageXPMin;
            debug.xp(`Awarding ${xpGain} XP to ${message.author.username} for message`);
            
            await this.addXP(message.author.id, message.guild.id, xpGain, 'message', {
                channelName: message.channel.name
            });
        });

        // Reaction XP
        this.client.on('messageReactionAdd', async (reaction, user) => {
            if (user.bot || !reaction.message.guild) return;
            
            const cooldownKey = `${user.id}-${reaction.message.guild.id}`;
            const now = Date.now();
            
            // Check cooldown
            if (this.reactionCooldowns.has(cooldownKey)) {
                const cooldownEnd = this.reactionCooldowns.get(cooldownKey);
                if (now < cooldownEnd) {
                    // Log cooldown if enabled
                    await this.logCooldown(user.id, reaction.message.guild.id, 'reaction', cooldownEnd - now);
                    return;
                }
            }
            
            this.reactionCooldowns.set(cooldownKey, now + this.config.reactionCooldown);
            
            const reactionXP = Math.floor(Math.random() * (this.config.reactionXPMax - this.config.reactionXPMin + 1)) + this.config.reactionXPMin;
            debug.xp(`Awarding ${reactionXP} XP to ${user.username} for reaction`);
            
            await this.addXP(user.id, reaction.message.guild.id, reactionXP, 'reaction');
        });

        // Voice XP tracking
        this.client.on('voiceStateUpdate', async (oldState, newState) => {
            const userId = newState.id;
            const guildId = newState.guild.id;
            
            debug.voice(`Voice State Update: ${newState.member.user.username}`);
            
            // User joined a voice channel
            if (!oldState.channelId && newState.channelId) {
                debug.voice(`${newState.member.user.username} JOINED voice channel`);
                
                const sessionData = {
                    startTime: Date.now(),
                    channelId: newState.channelId,
                    lastActivity: Date.now()
                };
                this.voiceTracker.set(`${userId}-${guildId}`, sessionData);
            }
            
            // User left a voice channel
            if (oldState.channelId && !newState.channelId) {
                debug.voice(`${newState.member.user.username} LEFT voice channel`);
                
                const session = this.voiceTracker.get(`${userId}-${guildId}`);
                if (session) {
                    const duration = Math.floor((Date.now() - session.startTime) / 1000);
                    await this.processVoiceXP(userId, guildId, duration, oldState.channelId);
                    this.voiceTracker.delete(`${userId}-${guildId}`);
                }
            }
            
            // User switched channels
            if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
                debug.voice(`${newState.member.user.username} SWITCHED channels`);
                
                const session = this.voiceTracker.get(`${userId}-${guildId}`);
                if (session) {
                    const duration = Math.floor((Date.now() - session.startTime) / 1000);
                    await this.processVoiceXP(userId, guildId, duration, oldState.channelId);
                }
                
                // Start new session
                const sessionData = {
                    startTime: Date.now(),
                    channelId: newState.channelId,
                    lastActivity: Date.now()
                };
                this.voiceTracker.set(`${userId}-${guildId}`, sessionData);
            }
        });

        // Slash commands - Now handled by command handler
        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            
            await this.commandHandler.handleCommand(interaction);
        });

        // Error handling
        this.client.on('error', error => {
            debug.error('Discord Client', error);
        });

        this.client.on('warn', warning => {
            debug.warn('Discord Client', warning);
        });

        process.on('unhandledRejection', error => {
            debug.error('Unhandled Rejection', error);
        });
    }

    async logXPGain(userId, guildId, xpAmount, type, details = {}) {
        if (!this.xpLogConfig.enabled) return;
        
        // Check if this type of XP gain should be logged
        if ((type === 'message' && !this.xpLogConfig.logMessages) ||
            (type === 'reaction' && !this.xpLogConfig.logReactions) ||
            (type === 'voice' && !this.xpLogConfig.logVoice)) {
            return;
        }

        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;

            const user = await guild.members.fetch(userId).catch(() => null);
            if (!user) return;

            let logChannel = null;

            // Try to find channel by ID first
            if (this.xpLogConfig.channel) {
                logChannel = guild.channels.cache.get(this.xpLogConfig.channel);
            }

            // If no ID channel found, try to find by name
            if (!logChannel && this.xpLogConfig.channelName) {
                logChannel = guild.channels.cache.find(ch => 
                    ch.type === 0 && // Text channel
                    ch.name.toLowerCase() === this.xpLogConfig.channelName.toLowerCase() &&
                    ch.permissionsFor(guild.members.me).has(['SendMessages'])
                );
            }

            if (!logChannel) return;

            // Create log message based on type
            let logMessage = '';
            let emoji = '';
            
            switch (type) {
                case 'message':
                    emoji = '💬';
                    logMessage = `${emoji} **${user.user.username}** gained **${xpAmount} XP** from sending a message`;
                    if (details.channelName) {
                        logMessage += ` in ${details.channelName}`;
                    }
                    break;
                    
                case 'reaction':
                    emoji = '👍';
                    logMessage = `${emoji} **${user.user.username}** gained **${xpAmount} XP** from adding a reaction`;
                    break;
                    
                case 'voice':
                    emoji = '🎤';
                    const minutes = details.minutes || Math.floor(xpAmount / ((this.config.voiceXPMin + this.config.voiceXPMax) / 2));
                    logMessage = `${emoji} **${user.user.username}** gained **${xpAmount} XP** from **${minutes} minute(s)** in voice chat`;
                    if (details.channelName) {
                        logMessage += ` in ${details.channelName}`;
                    }
                    break;
            }

            // Add timestamp
            const timestamp = new Date().toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
            });
            
            logMessage += ` \`${timestamp}\``;

            // Add total XP if available
            if (details.totalXP) {
                logMessage += ` • Total: **${details.totalXP.toLocaleString()} XP**`;
            }

            await logChannel.send(logMessage);
            
        } catch (error) {
            debug.error('XP Logging', error);
        }
    }

    async logLevelUp(userId, guildId, oldLevel, newLevel, details = {}) {
        if (!this.xpLogConfig.enabled || !this.xpLogConfig.logLevelUps) return;

        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;

            const user = await guild.members.fetch(userId).catch(() => null);
            if (!user) return;

            let logChannel = null;

            // Try to find channel by ID first
            if (this.xpLogConfig.channel) {
                logChannel = guild.channels.cache.get(this.xpLogConfig.channel);
            }

            // If no ID channel found, try to find by name
            if (!logChannel && this.xpLogConfig.channelName) {
                logChannel = guild.channels.cache.find(ch => 
                    ch.type === 0 && // Text channel
                    ch.name.toLowerCase() === this.xpLogConfig.channelName.toLowerCase() &&
                    ch.permissionsFor(guild.members.me).has(['SendMessages'])
                );
            }

            if (!logChannel) return;

            const bountyAmount = this.getBountyForLevel(newLevel);
            const timestamp = new Date().toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
            });

            let logMessage = `🎉 **${user.user.username}** leveled up from **Level ${oldLevel}** to **Level ${newLevel}**! New bounty: **₿${bountyAmount}** \`${timestamp}\``;

            if (details.roleAssigned) {
                logMessage += ` 🏆 *Role reward assigned!*`;
            }

            await logChannel.send(logMessage);
            
        } catch (error) {
            debug.error('Level Up Logging', error);
        }
    }

    async logCooldown(userId, guildId, type, remainingTime) {
        if (!this.xpLogConfig.enabled || !this.xpLogConfig.showCooldowns) return;

        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;

            const user = await guild.members.fetch(userId).catch(() => null);
            if (!user) return;

            let logChannel = null;

            if (this.xpLogConfig.channel) {
                logChannel = guild.channels.cache.get(this.xpLogConfig.channel);
            }

            if (!logChannel && this.xpLogConfig.channelName) {
                logChannel = guild.channels.cache.find(ch => 
                    ch.type === 0 &&
                    ch.name.toLowerCase() === this.xpLogConfig.channelName.toLowerCase() &&
                    ch.permissionsFor(guild.members.me).has(['SendMessages'])
                );
            }

            if (!logChannel) return;

            const timestamp = new Date().toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
            });

            const remainingSeconds = Math.ceil(remainingTime / 1000);
            const emoji = type === 'message' ? '💬' : type === 'reaction' ? '👍' : '🎤';
            
            const logMessage = `❄️ ${emoji} **${user.user.username}** is on cooldown for **${type}** XP (${remainingSeconds}s remaining) \`${timestamp}\``;

            await logChannel.send(logMessage);
            
        } catch (error) {
            debug.error('Cooldown Logging', error);
        }
    }

    getBountyForLevel(level) {
        if (level <= 0) return '0';
        if (level === 1) return '5,000,000';
        if (level === 2) return '10,000,000';
        if (level === 3) return '18,000,000';
        if (level === 4) return '25,000,000';
        if (level === 5) return '30,000,000';
        if (level === 6) return '38,000,000';
        if (level === 7) return '48,000,000';
        if (level === 8) return '60,000,000';
        if (level === 9) return '75,000,000';
        if (level === 10) return '81,000,000';
        if (level === 11) return '90,000,000';
        if (level === 12) return '100,000,000';
        if (level === 13) return '110,000,000';
        if (level === 14) return '115,000,000';
        if (level === 15) return '120,000,000';
        if (level === 16) return '135,000,000';
        if (level === 17) return '155,000,000';
        if (level === 18) return '177,000,000';
        if (level === 19) return '190,000,000';
        if (level === 20) return '200,000,000';
        if (level === 21) return '230,000,000';
        if (level === 22) return '260,000,000';
        if (level === 23) return '290,000,000';
        if (level === 24) return '310,000,000';
        if (level === 25) return '320,000,000';
        if (level === 26) return '360,000,000';
        if (level === 27) return '410,000,000';
        if (level === 28) return '450,000,000';
        if (level === 29) return '480,000,000';
        if (level === 30) return '500,000,000';
        if (level === 31) return '580,000,000';
        if (level === 32) return '670,000,000';
        if (level === 33) return '760,000,000';
        if (level === 34) return '820,000,000';
        if (level === 35) return '860,000,000';
        if (level === 36) return '920,000,000';
        if (level === 37) return '980,000,000';
        if (level === 38) return '1,020,000,000';
        if (level === 39) return '1,040,000,000';
        if (level === 40) return '1,057,000,000';
        if (level === 41) return '1,150,000,000';
        if (level === 42) return '1,250,000,000';
        if (level === 43) return '1,350,000,000';
        if (level === 44) return '1,450,000,000';
        if (level === 45) return '1,500,000,000';
        if (level === 46) return '1,800,000,000';
        if (level === 47) return '2,200,000,000';
        if (level === 48) return '2,600,000,000';
        if (level === 49) return '2,900,000,000';
        if (level === 50) return '3,000,000,000';
        
        // Beyond level 50
        const baseBounty = 3000000000 + (level - 50) * 200000000;
        return baseBounty.toLocaleString();
    }

    async processVoiceXP(userId, guildId, duration, channelId) {
        try {
            debug.voice(`Processing voice XP: ${duration}s`);
            
            const channel = this.client.channels.cache.get(channelId);
            const channelName = channel ? channel.name : 'Unknown Channel';
            
            if (duration >= 60) { // At least 1 minute
                const cooldownKey = `voice-${userId}-${guildId}`;
                const now = Date.now();
                const lastVoiceXP = this.voiceTracker.get(cooldownKey) || 0;
                
                if (now - lastVoiceXP >= this.config.voiceCooldown) {
                    const minutes = Math.floor(duration / 60);
                    
                    if (minutes > 0) {
                        const baseVoiceXP = Math.floor(Math.random() * (this.config.voiceXPMax - this.config.voiceXPMin + 1)) + this.config.voiceXPMin;
                        const totalVoiceXP = baseVoiceXP * minutes;
                        
                        debug.voice(`Awarding ${totalVoiceXP} voice XP (${baseVoiceXP} per minute × ${minutes} minutes)`);
                        
                        await this.addXP(userId, guildId, totalVoiceXP, 'voice', {
                            minutes: minutes,
                            channelName: channelName
                        });
                        this.voiceTracker.set(cooldownKey, now);
                    }
                } else {
                    // Log voice cooldown if enabled
                    const cooldownRemaining = this.config.voiceCooldown - (now - lastVoiceXP);
                    await this.logCooldown(userId, guildId, 'voice', cooldownRemaining);
                }
            }
            
            // Log voice session to database
            await this.db.query(
                'INSERT INTO voice_sessions (user_id, guild_id, duration) VALUES ($1, $2, $3)',
                [userId, guildId, duration]
            );
            
        } catch (error) {
            debug.error('Voice XP Processing', error);
        }
    }

    async addXP(userId, guildId, xpAmount, type, details = {}) {
        try {
            const finalXP = Math.floor(xpAmount * this.config.xpMultiplier);
            debug.xp(`Adding ${finalXP} XP (${type}) for user ${userId}`);
            
            let voiceMinutes = 0;
            if (type === 'voice') {
                voiceMinutes = Math.floor(xpAmount / ((this.config.voiceXPMin + this.config.voiceXPMax) / 2));
            }
            
            const result = await this.db.query(`
                INSERT INTO user_levels (user_id, guild_id, total_xp, ${type === 'message' ? 'messages' : type === 'reaction' ? 'reactions' : 'voice_time'})
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, guild_id)
                DO UPDATE SET
                    total_xp = user_levels.total_xp + $3,
                    ${type === 'message' ? 'messages = user_levels.messages + 1' : 
                      type === 'reaction' ? 'reactions = user_levels.reactions + 1' : 
                      'voice_time = user_levels.voice_time + $4'}
                RETURNING total_xp, level
            `, [userId, guildId, finalXP, type === 'voice' ? voiceMinutes : 1]);
            
            const newTotalXP = result.rows[0].total_xp;
            const currentLevel = result.rows[0].level;
            const newLevel = this.calculateLevel(newTotalXP);
            
            // Log XP gain
            await this.logXPGain(userId, guildId, finalXP, type, {
                ...details,
                totalXP: newTotalXP
            });
            
            if (newLevel > currentLevel) {
                await this.db.query(
                    'UPDATE user_levels SET level = $1 WHERE user_id = $2 AND guild_id = $3',
                    [newLevel, userId, guildId]
                );
                
                debug.levelup(`Level up! ${currentLevel} → ${newLevel}`);
                await this.handleLevelUp(userId, guildId, newLevel, currentLevel);
            }
        } catch (error) {
            debug.error('Add XP', error);
        }
    }

    calculateLevel(totalXP) {
        return Math.floor(Math.pow(totalXP / (100 * this.config.formulaMultiplier), 0.5));
    }

    calculateXPForLevel(level) {
        return Math.floor(Math.pow(level, 2) * 100 * this.config.formulaMultiplier);
    }

    async handleLevelUp(userId, guildId, newLevel, oldLevel) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;
            
            const user = await guild.members.fetch(userId);
            if (!user) return;
            
            let roleAssigned = false;
            
            // Check for role rewards
            if (this.levelRoles[newLevel]) {
                const roleId = this.levelRoles[newLevel];
                const role = guild.roles.cache.get(roleId);
                if (role && !user.roles.cache.has(roleId)) {
                    await user.roles.add(role);
                    roleAssigned = true;
                    debug.levelup(`Added Level ${newLevel} role to ${user.user.username}`);
                }
            }

            // Log level up
            await this.logLevelUp(userId, guildId, oldLevel, newLevel, { roleAssigned });
            
            // Send level up message
            if (this.levelUpConfig.enabled) {
                let channel = null;
                
                if (this.levelUpConfig.channel) {
                    channel = guild.channels.cache.get(this.levelUpConfig.channel);
                }
                
                if (!channel && this.levelUpConfig.channelName) {
                    channel = guild.channels.cache.find(ch => 
                        ch.type === 0 && 
                        ch.name.toLowerCase() === this.levelUpConfig.channelName.toLowerCase()
                    );
                }
                
                if (!channel) {
                    channel = guild.channels.cache.find(ch => 
                        ch.type === 0 && 
                        (ch.name.includes('general') || ch.name.includes('chat') || ch.name.includes('level'))
                    );
                }
                
                if (channel) {
                    const bountyAmount = this.getBountyForLevel(newLevel);
                    const oldBountyAmount = this.getBountyForLevel(oldLevel);
                    
                    let message = this.levelUpConfig.message
                        .replace('{user}', this.levelUpConfig.pingUser ? `<@${userId}>` : user.user.username)
                        .replace('{level}', newLevel.toString())
                        .replace('{oldlevel}', oldLevel.toString())
                        .replace('{bounty}', `₿${bountyAmount}`)
                        .replace('{oldbounty}', `₿${oldBountyAmount}`);
                    
                    const embed = new EmbedBuilder()
                        .setColor('#FF6B00')
                        .setTitle('🏴‍☠️ BOUNTY UPDATE!')
                        .setDescription(message)
                        .setThumbnail(user.user.displayAvatarURL())
                        .setTimestamp()
                        .setFooter({ text: 'World Government • Marine Headquarters' });
                    
                    await channel.send({ embeds: [embed] });
                }
            }
        } catch (error) {
            debug.error('Level Up Handling', error);
        }
    }

    setupCommands() {
        this.client.once('ready', async () => {
            try {
                console.log('Registering slash commands...');
                const commands = this.commandHandler.getCommandDefinitions();
                await this.client.application.commands.set(commands);
                console.log('✅ Slash commands registered successfully');
            } catch (error) {
                console.error('❌ Error registering commands:', error);
            }
        });
    }

    async start() {
        try {
            console.log('🚀 Starting bot...');
            console.log('📁 Using modular command structure');
            await this.client.login(process.env.DISCORD_TOKEN);
        } catch (error) {
            console.error('❌ Failed to start bot:', error);
        }
    }
}

// Start the bot
const bot = new LevelingBot();
bot.start();

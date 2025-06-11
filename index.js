const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, ActivityType } = require('discord.js');
const { Pool } = require('pg');
require('dotenv').config();

// Import our custom modules (comment out if you don't have them yet)
// const debug = require('./debug');
// const LeaderboardManager = require('./leaderboard');

// Simple debug replacement if modules aren't available
const debug = {
    debug: (...args) => console.log('[DEBUG]', ...args),
    voice: (...args) => console.log('[VOICE]', ...args),
    xp: (...args) => console.log('[XP]', ...args),
    database: (...args) => console.log('[DB]', ...args),
    command: (...args) => console.log('[CMD]', ...args),
    levelup: (...args) => console.log('[LEVELUP]', ...args),
    success: (category, ...args) => console.log('[SUCCESS]', category, ...args),
    error: (category, ...args) => console.error('[ERROR]', category, ...args),
    warn: (category, ...args) => console.warn('[WARN]', category, ...args),
    xpTransaction: () => {},
    voiceSession: () => {},
    cooldownCheck: () => {},
    levelUpProcess: () => {},
    commandExecution: () => {},
    dbQuery: () => {},
    getStatus: () => ({ main: false, voice: false, xp: false, database: false, commands: false }),
    getStatusString: () => 'Debug modules not loaded',
    toggle: () => false,
    reload: () => {}
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
        
        // Cooldown tracking (prevent spam)
        this.messageCooldowns = new Map();
        this.reactionCooldowns = new Map();

        // XP Configuration from environment variables
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

        // Level roles from environment variables
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

        // Level up message configuration
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

        debug.debug('Bot Configuration loaded');
        debug.debug('XP Log Config:', this.xpLogConfig);

        this.initializeDatabase();
        this.setupEventHandlers();
        this.setupCommands();
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
            
            this.client.user.setActivity('Leveling System', { type: ActivityType.Watching });
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

        // Slash commands
        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            
            debug.command(`Command: /${interaction.commandName} from ${interaction.user.username}`);
            
            try {
                switch (interaction.commandName) {
                    case 'level':
                        await this.handleLevelCommand(interaction);
                        break;
                    case 'leaderboard':
                        await this.handleLeaderboardCommand(interaction);
                        break;
                    case 'setlevelrole':
                        await this.handleSetLevelRoleCommand(interaction);
                        break;
                    case 'levelroles':
                        await this.handleLevelRolesCommand(interaction);
                        break;
                    case 'settings':
                        await this.handleSettingsCommand(interaction);
                        break;
                    case 'reload':
                        await this.handleReloadCommand(interaction);
                        break;
                    case 'initrookies':
                        await this.handleInitRookiesCommand(interaction);
                        break;
                    case 'debug':
                        await this.handleDebugCommand(interaction);
                        break;
                }
                debug.command(`Command /${interaction.commandName} completed successfully`);
            } catch (error) {
                debug.error('Command Execution', error);
                await interaction.reply({ 
                    content: 'An error occurred while executing the command.', 
                    flags: 64
                });
            }
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

            if (!logChannel) {
                debug.warn('XP Log', 'No XP log channel configured or found');
                return;
            }

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

    async handleLevelCommand(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        
        const result = await this.db.query(
            'SELECT * FROM user_levels WHERE user_id = $1 AND guild_id = $2',
            [targetUser.id, interaction.guild.id]
        );
        
        if (result.rows.length === 0) {
            return await interaction.reply({ 
                content: `${targetUser.username} hasn't started their pirate journey yet! 🏴‍☠️`, 
                flags: 64
            });
        }
        
        const userData = result.rows[0];
        const currentLevelXP = this.calculateXPForLevel(userData.level);
        const nextLevelXP = this.calculateXPForLevel(userData.level + 1);
        const progressXP = userData.total_xp - currentLevelXP;
        const neededXP = nextLevelXP - currentLevelXP;
        const bountyAmount = this.getBountyForLevel(userData.level);
        
        const bountyDisplay = userData.level === 0 ? 'No Bounty Yet' : `₿${bountyAmount}`;
        const statusText = userData.level === 0 ? 'Rookie' : `Level ${userData.level} Pirate`;
        
        const embed = new EmbedBuilder()
            .setColor(userData.level === 0 ? '#95a5a6' : '#FF6B00')
            .setTitle(`🏴‍☠️ ${targetUser.username}'s ${userData.level === 0 ? 'Rookie Profile' : 'Bounty Poster'}`)
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields(
                { name: '💰 Current Bounty', value: bountyDisplay, inline: true },
                { name: '⚔️ Status', value: statusText, inline: true },
                { name: '⭐ Total Reputation', value: userData.total_xp.toLocaleString(), inline: true },
                { name: '📈 Progress to Next Level', value: `${progressXP.toLocaleString()}/${neededXP.toLocaleString()} Rep`, inline: true },
                { name: '💬 Messages Sent', value: userData.messages.toLocaleString(), inline: true },
                { name: '👍 Reactions Given', value: userData.reactions.toLocaleString(), inline: true },
                { name: '🎤 Voice Activity', value: `${Math.floor(userData.voice_time / 60)}h ${userData.voice_time % 60}m`, inline: true }
            )
            .setFooter({ text: userData.level === 0 ? 'ROOKIE • WORLD GOVERNMENT MONITORING' : 'WANTED • DEAD OR ALIVE • World Government' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }

    async handleLeaderboardCommand(interaction) {
        try {
            const guild = interaction.guild;
            const excludeRoleId = this.leaderboardConfig.excludeRole;
            const shortVersion = interaction.options.getBoolean('short_version') || false;
            
            debug.command(`Leaderboard command - Short version: ${shortVersion}`);
            
            const result = await this.db.query(
                'SELECT user_id, level, total_xp FROM user_levels WHERE guild_id = $1 ORDER BY total_xp DESC LIMIT 25',
                [interaction.guild.id]
            );
            
            if (result.rows.length === 0) {
                return await interaction.reply({ 
                    content: 'No pirates have started their journey yet! 🏴‍☠️', 
                    flags: 64
                });
            }

            let pirateEmperors = [];
            let regularPirates = [];
            
            for (const userData of result.rows) {
                try {
                    const member = await guild.members.fetch(userData.user_id);
                    
                    if (excludeRoleId && member.roles.cache.has(excludeRoleId)) {
                        pirateEmperors.push({
                            member,
                            level: userData.level,
                            totalXp: userData.total_xp
                        });
                    } else {
                        regularPirates.push({
                            member,
                            level: userData.level,
                            totalXp: userData.total_xp
                        });
                    }
                } catch (error) {
                    continue;
                }
            }

            // Limit regular pirates based on short_version option
            const maxRegularPirates = shortVersion ? 3 : 10;
            regularPirates = regularPirates.slice(0, maxRegularPirates);

            if (pirateEmperors.length === 0 && regularPirates.length === 0) {
                return await interaction.reply({ 
                    content: 'No eligible pirates found for the leaderboard! 🏴‍☠️', 
                    flags: 64
                });
            }

            const embed = new EmbedBuilder()
                .setColor('#D4AF37')
                .setTitle('📰 WORLD ECONOMIC NEWS PAPER 📰')
                .setDescription(`**═══════════════════════════════════**\n🚨 **${shortVersion ? 'URGENT' : 'EMERGENCY'} BOUNTY UPDATE** 🚨\n**═══════════════════════════════════**`)
                .setFooter({ 
                    text: `⚖️ WORLD GOVERNMENT OFFICIAL PUBLICATION ⚖️ • ${shortVersion ? 'URGENT BULLETIN' : 'MARINE HEADQUARTERS'}`
                })
                .setTimestamp();
            
            let description = shortVersion ? 
                '```\n╔═══════════════════════════════════╗\n║       URGENT BOUNTY BULLETIN      ║\n║      TOP CRIMINALS IDENTIFIED     ║\n╚═══════════════════════════════════╝\n```\n\n' :
                '```\n╔═══════════════════════════════════╗\n║        MOST WANTED CRIMINALS      ║\n║     DEAD OR ALIVE - REWARD SET    ║\n╚═══════════════════════════════════╝\n```\n\n';

            // Add Pirate Kings section
            if (pirateEmperors.length > 0) {
                description += '```diff\n+ ═══════ 👑 PIRATE KING 👑 ═══════\n```\n\n';
                
                for (let i = 0; i < pirateEmperors.length; i++) {
                    const userData = pirateEmperors[i];
                    const bountyAmount = this.getBountyForLevel(userData.level);
                    
                    description += '```yaml\n';
                    description += `WANTED: ${userData.member.user.username.toUpperCase()}\n`;
                    description += `BOUNTY: ₿${bountyAmount}\n`;
                    description += `THREAT LEVEL: EXTREME\n`;
                    description += `STATUS: PIRATE KING\n`;
                    description += '```\n';
                    description += `⚔️ **Level ${userData.level}** | ⭐ **${userData.totalXp.toLocaleString()} Rep**\n\n`;
                }
                
                description += '```\n═══════════════════════════════════\n```\n\n';
            }

            // Add regular competition section
            if (regularPirates.length > 0) {
                const sectionTitle = shortVersion ? 
                    '```diff\n- ═══════ 🔥 TOP THREATS 🔥 ═══════\n```\n\n' :
                    '```diff\n- ═══════ 🏆 ACTIVE BOUNTIES 🏆 ═══════\n```\n\n';
                
                description += sectionTitle;
                
                for (let i = 0; i < regularPirates.length; i++) {
                    const userData = regularPirates[i];
                    const bountyAmount = this.getBountyForLevel(userData.level);
                    
                    let rankEmoji;
                    let threat;
                    if (i === 0) {
                        rankEmoji = '🥇';
                        threat = 'EXTREMELY DANGEROUS';
                    } else if (i === 1) {
                        rankEmoji = '🥈';
                        threat = 'HIGHLY DANGEROUS';
                    } else if (i === 2) {
                        rankEmoji = '🥉';
                        threat = 'VERY DANGEROUS';
                    } else {
                        rankEmoji = `**${i + 1}.**`;
                        threat = 'DANGEROUS';
                    }
                    
                    description += '```css\n';
                    description += `[RANK ${i + 1}] ${userData.member.user.username.toUpperCase()}\n`;
                    description += `BOUNTY: ₿${bountyAmount}\n`;
                    description += `THREAT: ${threat}\n`;
                    description += '```\n';
                    description += `${rankEmoji} ⚔️ **Level ${userData.level}** | ⭐ **${userData.totalXp.toLocaleString()} Rep**\n\n`;
                }
                
                // Add "and X more..." if short version and there are more pirates
                if (shortVersion && result.rows.length > 3 + pirateEmperors.length) {
                    const remainingCount = Math.min(result.rows.length - 3 - pirateEmperors.length, 7);
                    description += `*... and ${remainingCount} more dangerous pirates*\n\n`;
                }
            }
            
            const footerMessage = shortVersion ?
                '```\n╔═══════════════════════════════════╗\n║   USE /leaderboard FOR FULL LIST  ║\n║     STAY VIGILANT, STAY SAFE      ║\n╚═══════════════════════════════════╝\n```\n' :
                '```\n╔═══════════════════════════════════╗\n║  REPORT SIGHTINGS TO YOUR LOCAL   ║\n║        MARINE BASE IMMEDIATELY    ║\n╚═══════════════════════════════════╝\n```\n';
            
            description += footerMessage;
            
            embed.setDescription(description);
            
            let footerText = shortVersion ? 
                '⚖️ WORLD GOVERNMENT URGENT BULLETIN ⚖️ • TOP THREATS ONLY' :
                '⚖️ WORLD GOVERNMENT OFFICIAL PUBLICATION ⚖️ • MARINE HEADQUARTERS';
                
            if (pirateEmperors.length > 0) {
                const kingText = pirateEmperors.length === 1 ? 'Pirate King reigns' : 'Pirate Kings reign';
                footerText = `🚨 ALERT: ${kingText} supreme! 🚨 • ${footerText}`;
            }
            embed.setFooter({ text: footerText });

            await interaction.reply({ embeds: [embed] });
            
        } catch (error) {
            debug.error('Leaderboard Command', error);
            await interaction.reply({ 
                content: 'An error occurred while fetching the leaderboard.', 
                flags: 64
            });
        }
    }

    async handleSetLevelRoleCommand(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return await interaction.reply({ 
                content: 'You need the "Manage Roles" permission to use this command.', 
                flags: 64
            });
        }
        
        await interaction.reply({ 
            content: 'Level roles are configured via environment variables. Use Railway dashboard to set LEVEL_X_ROLE variables.', 
            flags: 64
        });
    }

    async handleLevelRolesCommand(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Level Roles Configuration')
            .setTimestamp();
        
        let description = '';
        for (const [level, roleId] of Object.entries(this.levelRoles)) {
            const role = roleId ? interaction.guild.roles.cache.get(roleId) : null;
            const roleName = role ? role.name : 'Not Set';
            description += `Level ${level}: ${roleName}\n`;
        }
        
        embed.setDescription(description || 'No level roles configured via environment variables');
        embed.setFooter({ text: 'Configure roles using Railway environment variables (LEVEL_X_ROLE)' });
        
        await interaction.reply({ embeds: [embed] });
    }

    async handleSettingsCommand(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🔧 Server Leveling Settings')
            .setTimestamp();
        
        embed.addFields(
            { name: '💬 Message XP', value: `${this.config.messageXPMin}-${this.config.messageXPMax} (${this.config.messageCooldown/1000}s cooldown)`, inline: true },
            { name: '👍 Reaction XP', value: `${this.config.reactionXPMin}-${this.config.reactionXPMax} (${this.config.reactionCooldown/1000}s cooldown)`, inline: true },
            { name: '🎤 Voice XP', value: `${this.config.voiceXPMin}-${this.config.voiceXPMax}/min (${this.config.voiceCooldown/1000}s cooldown)`, inline: true },
            { name: '📊 Formula', value: `${this.config.formulaCurve} (×${this.config.formulaMultiplier})`, inline: true },
            { name: '🎯 Max Level', value: this.config.maxLevel.toString(), inline: true },
            { name: '✨ XP Multiplier', value: `×${this.config.xpMultiplier}`, inline: true },
            { name: '🔊 Voice Requirements', value: `Min ${this.config.voiceMinMembers} members\nAFK Detection: ${this.config.voiceAntiAFK ? '✅' : '❌'}`, inline: true },
            { name: '🎉 Level Up Messages', value: `${this.levelUpConfig.enabled ? '✅ Enabled' : '❌ Disabled'}\nPing User: ${this.levelUpConfig.pingUser ? '✅' : '❌'}`, inline: true }
        );
        
        await interaction.reply({ embeds: [embed] });
    }

    async handleReloadCommand(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return await interaction.reply({ 
                content: 'You need the "Manage Server" permission to use this command.', 
                flags: 64
            });
        }
        
        // Reload configuration from environment variables
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
        
        debug.success('Configuration Reload', 'All configurations reloaded');
        
        await interaction.reply({ 
            content: '✅ Configuration reloaded from environment variables!', 
            flags: 64
        });
    }

    async handleInitRookiesCommand(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ 
                content: 'You need the "Administrator" permission to use this command.', 
                flags: 64
            });
        }

        await interaction.deferReply();

        try {
            const guild = interaction.guild;
            const level0RoleId = this.levelRoles[0];
            
            if (!level0RoleId) {
                return await interaction.editReply({ content: '❌ Level 0 role not configured! Set LEVEL_0_ROLE in environment variables.' });
            }

            const level0Role = guild.roles.cache.get(level0RoleId);
            if (!level0Role) {
                return await interaction.editReply({ content: '❌ Level 0 role not found! Check the role ID in environment variables.' });
            }

            const bountyRoleIds = Object.values(this.levelRoles).filter(id => id !== null);
            await guild.members.fetch();
            
            let processedCount = 0;
            let assignedCount = 0;
            let errorCount = 0;

            for (const [userId, member] of guild.members.cache) {
                processedCount++;
                
                if (member.user.bot) continue;

                const hasBountyRole = member.roles.cache.some(role => bountyRoleIds.includes(role.id));
                
                if (!hasBountyRole) {
                    try {
                        await member.roles.add(level0Role);
                        assignedCount++;
                    } catch (error) {
                        errorCount++;
                    }
                }
            }

            const resultEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Rookie Initialization Complete!')
                .addFields(
                    { name: '👥 Total Members Processed', value: processedCount.toString(), inline: true },
                    { name: '🆕 New Rookies Assigned', value: assignedCount.toString(), inline: true },
                    { name: '❌ Errors', value: errorCount.toString(), inline: true },
                    { name: '🏴‍☠️ Role Assigned', value: level0Role.name, inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [resultEmbed] });

        } catch (error) {
            debug.error('Init Rookies Command', error);
            await interaction.editReply({ content: '❌ An error occurred while initializing rookies.' });
        }
    }

    async handleDebugCommand(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return await interaction.reply({ 
                content: 'You need the "Manage Server" permission to use this command.', 
                flags: 64
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'status') {
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🐛 Debug Status')
                .setDescription('```\nDebug modules not loaded.\nCreate debug.js file for advanced debugging.\n```')
                .setTimestamp();
            
            return await interaction.reply({ embeds: [embed], flags: 64 });
        }

        await interaction.reply({ 
            content: '❌ Debug modules not loaded. Create debug.js file for advanced debugging.', 
            flags: 64
        });
    }

    setupCommands() {
        const commands = [
            new SlashCommandBuilder()
                .setName('level')
                .setDescription('Check your or someone else\'s level')
                .addUserOption(option => 
                    option.setName('user')
                        .setDescription('The user to check')
                        .setRequired(false)
                ),
            
            new SlashCommandBuilder()
                .setName('leaderboard')
                .setDescription('View the server leaderboard')
                .addBooleanOption(option =>
                    option.setName('short_version')
                        .setDescription('Show only top 3 pirates (true) or top 10 pirates (false)')
                        .setRequired(false)
                ),
            
            new SlashCommandBuilder()
                .setName('setlevelrole')
                .setDescription('Set a role reward for a specific level (use environment variables)')
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('The level (5, 10, 15, 20, 25, 30, 35, 40, 45, 50)')
                        .setRequired(true)
                )
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
            
            new SlashCommandBuilder()
                .setName('levelroles')
                .setDescription('View all configured level roles'),
            
            new SlashCommandBuilder()
                .setName('settings')
                .setDescription('View server leveling settings'),
            
            new SlashCommandBuilder()
                .setName('reload')
                .setDescription('Reload configuration from environment variables')
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

            new SlashCommandBuilder()
                .setName('initrookies')
                .setDescription('Assign Level 0 role to all members without bounty roles')
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

            new SlashCommandBuilder()
                .setName('debug')
                .setDescription('Debug system status')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('status')
                        .setDescription('Show current debug status')
                )
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        ];

        this.client.once('ready', async () => {
            try {
                console.log('Registering slash commands...');
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
            await this.client.login(process.env.DISCORD_TOKEN);
        } catch (error) {
            console.error('❌ Failed to start bot:', error);
        }
    }
}

// Start the bot
const bot = new LevelingBot();
bot.start();

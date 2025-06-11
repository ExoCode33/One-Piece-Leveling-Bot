const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, ActivityType } = require('discord.js');
const { Pool } = require('pg');
require('dotenv').config();

class LevelingBot {
    constructor() {
        // Debug configuration from environment variables
        this.debugMode = process.env.DEBUG_MODE === 'true' || false;
        this.debugVoice = process.env.DEBUG_VOICE === 'true' || false;
        this.debugXP = process.env.DEBUG_XP === 'true' || false;
        this.debugDatabase = process.env.DEBUG_DATABASE === 'true' || false;
        this.debugCommands = process.env.DEBUG_COMMANDS === 'true' || false;

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
            // Message XP
            messageXPMin: parseInt(process.env.MESSAGE_XP_MIN) || 25,
            messageXPMax: parseInt(process.env.MESSAGE_XP_MAX) || 35,
            messageCooldown: parseInt(process.env.MESSAGE_COOLDOWN) || 60000, // 60 seconds
            
            // Voice XP  
            voiceXPMin: parseInt(process.env.VOICE_XP_MIN) || 45,
            voiceXPMax: parseInt(process.env.VOICE_XP_MAX) || 55,
            voiceCooldown: parseInt(process.env.VOICE_COOLDOWN) || 180000, // 180 seconds
            voiceMinMembers: parseInt(process.env.VOICE_MIN_MEMBERS) || 2,
            voiceAntiAFK: process.env.VOICE_ANTI_AFK === 'true' || true,
            
            // Reaction XP
            reactionXPMin: parseInt(process.env.REACTION_XP_MIN) || 25,
            reactionXPMax: parseInt(process.env.REACTION_XP_MAX) || 35,
            reactionCooldown: parseInt(process.env.REACTION_COOLDOWN) || 300000, // 300 seconds
            
            // Formula settings
            formulaCurve: process.env.FORMULA_CURVE || 'exponential', // 'linear', 'exponential', 'logarithmic'
            formulaMultiplier: parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75,
            maxLevel: parseInt(process.env.MAX_LEVEL) || 50,
            
            // Global settings
            xpMultiplier: parseFloat(process.env.XP_MULTIPLIER) || 1.0
        };

        // Level roles from environment variables
        this.levelRoles = {
            0: process.env.LEVEL_0_ROLE || null,  // Starter role
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

        // Level up message configuration with One Piece theme
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

        this.debugLog('🤖', 'Bot Configuration:', this.config);
        this.debugLog('🏆', 'Level Roles:', this.levelRoles);
        this.debugLog('🎉', 'Level Up Config:', this.levelUpConfig);
        this.debugLog('🥇', 'Leaderboard Config:', this.leaderboardConfig);

        this.initializeDatabase();
        this.setupEventHandlers();
        this.setupCommands();
    }

    // Enhanced debug logging system
    debugLog(category, ...args) {
        if (!this.debugMode) return;
        
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${category}`, ...args);
    }

    debugVoiceLog(...args) {
        if (!this.debugVoice) return;
        this.debugLog('🎤', ...args);
    }

    debugXPLog(...args) {
        if (!this.debugXP) return;
        this.debugLog('💫', ...args);
    }

    debugDatabaseLog(...args) {
        if (!this.debugDatabase) return;
        this.debugLog('🗄️', ...args);
    }

    debugCommandLog(...args) {
        if (!this.debugCommands) return;
        this.debugLog('⚡', ...args);
    }

    async initializeDatabase() {
        try {
            this.debugDatabaseLog('Initializing database tables...');
            
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

            this.debugDatabaseLog('✅ Database tables initialized successfully');
        } catch (error) {
            console.error('❌ Database initialization error:', error);
        }
    }

    setupEventHandlers() {
        this.client.once('ready', () => {
            console.log(`✅ Logged in as ${this.client.user.tag}`);
            this.debugLog('🚀', `Bot started with debug mode: ${this.debugMode ? 'ON' : 'OFF'}`);
            this.debugLog('🎤', `Voice debug: ${this.debugVoice ? 'ON' : 'OFF'}`);
            this.debugLog('💫', `XP debug: ${this.debugXP ? 'ON' : 'OFF'}`);
            this.debugLog('🗄️', `Database debug: ${this.debugDatabase ? 'ON' : 'OFF'}`);
            this.debugLog('⚡', `Commands debug: ${this.debugCommands ? 'ON' : 'OFF'}`);
            
            this.client.user.setActivity('Leveling System', { type: ActivityType.Watching });
        });

        // Message XP
        this.client.on('messageCreate', async (message) => {
            if (message.author.bot || !message.guild) return;
            
            const cooldownKey = `${message.author.id}-${message.guild.id}`;
            const now = Date.now();
            
            this.debugXPLog(`Message from ${message.author.username} in ${message.guild.name}`);
            
            // 60 second cooldown for message XP (configurable)
            if (this.messageCooldowns.has(cooldownKey)) {
                const cooldownEnd = this.messageCooldowns.get(cooldownKey);
                if (now < cooldownEnd) {
                    this.debugXPLog(`❄️ Message XP on cooldown for ${message.author.username} (${Math.ceil((cooldownEnd - now) / 1000)}s remaining)`);
                    return;
                }
            }
            
            this.messageCooldowns.set(cooldownKey, now + this.config.messageCooldown);
            
            const xpGain = Math.floor(Math.random() * (this.config.messageXPMax - this.config.messageXPMin + 1)) + this.config.messageXPMin;
            this.debugXPLog(`💬 Awarding ${xpGain} XP to ${message.author.username} for message`);
            
            await this.addXP(message.author.id, message.guild.id, xpGain, 'message');
        });

        // Reaction XP
        this.client.on('messageReactionAdd', async (reaction, user) => {
            if (user.bot || !reaction.message.guild) return;
            
            const cooldownKey = `${user.id}-${reaction.message.guild.id}`;
            const now = Date.now();
            
            this.debugXPLog(`Reaction from ${user.username} in ${reaction.message.guild.name}`);
            
            // 30 second cooldown for reaction XP (configurable)
            if (this.reactionCooldowns.has(cooldownKey)) {
                const cooldownEnd = this.reactionCooldowns.get(cooldownKey);
                if (now < cooldownEnd) {
                    this.debugXPLog(`❄️ Reaction XP on cooldown for ${user.username} (${Math.ceil((cooldownEnd - now) / 1000)}s remaining)`);
                    return;
                }
            }
            
            this.reactionCooldowns.set(cooldownKey, now + this.config.reactionCooldown);
            
            const reactionXP = Math.floor(Math.random() * (this.config.reactionXPMax - this.config.reactionXPMin + 1)) + this.config.reactionXPMin;
            this.debugXPLog(`👍 Awarding ${reactionXP} XP to ${user.username} for reaction`);
            
            await this.addXP(user.id, reaction.message.guild.id, reactionXP, 'reaction');
        });

        // Voice XP tracking with AFK detection and ENHANCED DEBUG LOGGING
        this.client.on('voiceStateUpdate', async (oldState, newState) => {
            const userId = newState.id;
            const guildId = newState.guild.id;
            
            this.debugVoiceLog(`Voice State Update: ${newState.member.user.username}`);
            this.debugVoiceLog(`   Old Channel: ${oldState.channelId || 'None'}`);
            this.debugVoiceLog(`   New Channel: ${newState.channelId || 'None'}`);
            this.debugVoiceLog(`   Old State: Muted=${oldState.mute}, Deafened=${oldState.deaf}, SelfMuted=${oldState.selfMute}, SelfDeafened=${oldState.selfDeaf}`);
            this.debugVoiceLog(`   New State: Muted=${newState.mute}, Deafened=${newState.deaf}, SelfMuted=${newState.selfMute}, SelfDeafened=${newState.selfDeaf}`);
            
            // User joined a voice channel
            if (!oldState.channelId && newState.channelId) {
                this.debugVoiceLog(`✅ ${newState.member.user.username} JOINED voice channel ${newState.channelId}`);
                const sessionData = {
                    startTime: Date.now(),
                    channelId: newState.channelId,
                    lastActivity: Date.now()
                };
                this.voiceTracker.set(`${userId}-${guildId}`, sessionData);
                this.debugVoiceLog(`   Voice tracker set:`, sessionData);
            }
            
            // User left a voice channel or switched channels
            if (oldState.channelId && (!newState.channelId || oldState.channelId !== newState.channelId)) {
                this.debugVoiceLog(`❌ ${newState.member.user.username} LEFT voice channel ${oldState.channelId}`);
                const session = this.voiceTracker.get(`${userId}-${guildId}`);
                if (session) {
                    const duration = Math.floor((Date.now() - session.startTime) / 1000);
                    this.debugVoiceLog(`   Session duration: ${duration} seconds`);
                    await this.processVoiceXP(userId, guildId, duration, oldState.channelId);
                    this.voiceTracker.delete(`${userId}-${guildId}`);
                } else {
                    this.debugVoiceLog(`   ⚠️  No session found for ${userId}-${guildId}`);
                }
                
                // If switched channels, start new session
                if (newState.channelId && oldState.channelId !== newState.channelId) {
                    this.debugVoiceLog(`🔄 ${newState.member.user.username} SWITCHED to channel ${newState.channelId}`);
                    const sessionData = {
                        startTime: Date.now(),
                        channelId: newState.channelId,
                        lastActivity: Date.now()
                    };
                    this.voiceTracker.set(`${userId}-${guildId}`, sessionData);
                    this.debugVoiceLog(`   New session started:`, sessionData);
                }
            }
            
            // Update activity for AFK detection (mute/deafen changes)
            if (oldState.channelId && newState.channelId && oldState.channelId === newState.channelId) {
                const session = this.voiceTracker.get(`${userId}-${guildId}`);
                if (session) {
                    // Update activity if user unmutes or undeafens
                    if ((oldState.mute && !newState.mute) || (oldState.deaf && !newState.deaf) || 
                        (oldState.selfMute && !newState.selfMute) || (oldState.selfDeaf && !newState.selfDeaf)) {
                        session.lastActivity = Date.now();
                        this.debugVoiceLog(`🔊 ${newState.member.user.username} became active (unmuted/undeafened)`);
                        this.debugVoiceLog(`   Updated session:`, session);
                    }
                }
            }
        });

        // Slash commands
        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            
            this.debugCommandLog(`Command received: /${interaction.commandName} from ${interaction.user.username} in ${interaction.guild?.name}`);
            
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
                this.debugCommandLog(`✅ Command /${interaction.commandName} completed successfully`);
            } catch (error) {
                console.error('❌ Command error:', error);
                this.debugCommandLog(`❌ Command /${interaction.commandName} failed:`, error.message);
                await interaction.reply({ 
                    content: 'An error occurred while executing the command.', 
                    flags: 64 // MessageFlags.Ephemeral
                });
            }
        });
    }

    getBountyForLevel(level) {
        // Progressive bounty increase every level, respecting role milestones
        if (level <= 0) return '0';
        
        // Level 1-4: Build up to first role
        if (level === 1) return '5,000,000';
        if (level === 2) return '10,000,000';
        if (level === 3) return '18,000,000';
        if (level === 4) return '25,000,000';
        
        // Level 5-9: Build up to second role  
        if (level === 5) return '30,000,000';    // Role milestone
        if (level === 6) return '38,000,000';
        if (level === 7) return '48,000,000';
        if (level === 8) return '60,000,000';
        if (level === 9) return '75,000,000';
        
        // Level 10-14: Build up to third role
        if (level === 10) return '81,000,000';   // Role milestone
        if (level === 11) return '90,000,000';
        if (level === 12) return '100,000,000';
        if (level === 13) return '110,000,000';
        if (level === 14) return '115,000,000';
        
        // Level 15-19: Build up to fourth role
        if (level === 15) return '120,000,000';  // Role milestone
        if (level === 16) return '135,000,000';
        if (level === 17) return '155,000,000';
        if (level === 18) return '177,000,000';
        if (level === 19) return '190,000,000';
        
        // Level 20-24: Build up to fifth role
        if (level === 20) return '200,000,000';  // Role milestone
        if (level === 21) return '230,000,000';
        if (level === 22) return '260,000,000';
        if (level === 23) return '290,000,000';
        if (level === 24) return '310,000,000';
        
        // Level 25-29: Build up to sixth role
        if (level === 25) return '320,000,000';  // Role milestone
        if (level === 26) return '360,000,000';
        if (level === 27) return '410,000,000';
        if (level === 28) return '450,000,000';
        if (level === 29) return '480,000,000';
        
        // Level 30-34: Build up to seventh role
        if (level === 30) return '500,000,000';  // Role milestone
        if (level === 31) return '580,000,000';
        if (level === 32) return '670,000,000';
        if (level === 33) return '760,000,000';
        if (level === 34) return '820,000,000';
        
        // Level 35-39: Build up to eighth role
        if (level === 35) return '860,000,000';  // Role milestone
        if (level === 36) return '920,000,000';
        if (level === 37) return '980,000,000';
        if (level === 38) return '1,020,000,000';
        if (level === 39) return '1,040,000,000';
        
        // Level 40-44: Build up to ninth role
        if (level === 40) return '1,057,000,000'; // Role milestone
        if (level === 41) return '1,150,000,000';
        if (level === 42) return '1,250,000,000';
        if (level === 43) return '1,350,000,000';
        if (level === 44) return '1,450,000,000';
        
        // Level 45-49: Build up to tenth role
        if (level === 45) return '1,500,000,000'; // Role milestone
        if (level === 46) return '1,800,000,000';
        if (level === 47) return '2,200,000,000';
        if (level === 48) return '2,600,000,000';
        if (level === 49) return '2,900,000,000';
        
        // Level 50+: Yonko territory
        if (level === 50) return '3,000,000,000'; // Role milestone
        if (level <= 55) return `${3000 + (level - 50) * 200},000,000`; // +200M per level
        if (level <= 60) return `${4000 + (level - 55) * 120},000,000`; // +120M per level
        
        // Beyond level 60 - legendary territory
        const baseBounty = 4600000000; // 4.6 billion base
        const multiplier = Math.pow(1.1, level - 60);
        const bounty = Math.floor(baseBounty * multiplier);
        return bounty.toLocaleString();
    }

    getFlavorTextForLevel(level) {
        const flavorTexts = {
            0: "*New individual detected. No criminal activity reported. Continue monitoring.*",
            5: "*Criminal activity confirmed in East Blue region. Initial bounty authorized.*",
            10: "*Multiple incidents involving Marine personnel. Elevated threat status.*",
            15: "*Subject has crossed into Grand Line territory. Enhanced surveillance required.*",
            20: "*Dangerous individual. Multiple Marine casualties reported. Caution advised.*",
            25: "*HIGH PRIORITY TARGET: Classified as extremely dangerous. Deploy specialized units.*",
            30: "*ADVANCED COMBATANT: Confirmed use of advanced fighting techniques. Vice Admiral response.*",
            35: "*TERRITORIAL THREAT: Capable of commanding large operations. Fleet mobilization recommended.*",
            40: "*ELITE LEVEL THREAT: Extreme danger to Marine operations. Admiral consultation required.*",
            45: "*EXTRAORDINARY ABILITIES: Unprecedented power levels detected. Maximum security protocols.*",
            50: "*EMPEROR CLASS THREAT: Controls vast territories. Considered one of the most dangerous pirates.*",
            55: "*LEGENDARY THREAT LEVEL: Power exceeds known classifications. Ultimate priority target.*",
            60: "*WORLD-LEVEL THREAT: Potential to challenge global balance. All resources authorized.*"
        };
        
        return flavorTexts[level] || null;
    }

    async processVoiceXP(userId, guildId, duration, channelId) {
        try {
            this.debugVoiceLog(`🎯 Processing voice XP for user ${userId}, duration: ${duration}s`);
            
            const channel = this.client.channels.cache.get(channelId);
            if (!channel) {
                this.debugVoiceLog(`❌ Channel ${channelId} not found`);
                return;
            }
            
            this.debugVoiceLog(`   Channel name: ${channel.name}`);
            
            // Count non-bot members in voice channel AT THE TIME OF LEAVING
            // Note: This might show 0 if everyone left at the same time
            const allMembers = channel.members.size;
            const humanMembers = channel.members.filter(member => !member.user.bot).size;
            this.debugVoiceLog(`   Total members: ${allMembers}, Human members: ${humanMembers}`);
            this.debugVoiceLog(`   Required minimum: ${this.config.voiceMinMembers}`);
            
            // IMPROVED LOGIC: Check if duration was long enough (simplified for testing)
            if (duration >= 60) { // At least 1 minute
                this.debugVoiceLog(`✅ Duration requirement met (${duration}s >= 60s)`);
                
                // Check for AFK if enabled
                let activeTime = duration;
                if (this.config.voiceAntiAFK) {
                    const session = this.voiceTracker.get(`${userId}-${guildId}`);
                    if (session && session.lastActivity) {
                        const timeSinceActivity = (Date.now() - session.lastActivity) / 1000;
                        this.debugVoiceLog(`   Time since last activity: ${timeSinceActivity}s`);
                        // If inactive for more than 10 minutes, reduce XP accordingly
                        if (timeSinceActivity > 600) {
                            activeTime = Math.max(0, duration - timeSinceActivity);
                            this.debugVoiceLog(`   Reduced active time due to AFK: ${activeTime}s`);
                        }
                    }
                }
                
                // Apply cooldown check for voice XP
                const cooldownKey = `voice-${userId}-${guildId}`;
                const now = Date.now();
                const lastVoiceXP = this.voiceTracker.get(cooldownKey) || 0;
                const cooldownRemaining = this.config.voiceCooldown - (now - lastVoiceXP);
                
                this.debugVoiceLog(`   Cooldown check: ${cooldownRemaining}ms remaining`);
                
                if (now - lastVoiceXP >= this.config.voiceCooldown) {
                    const minutes = Math.floor(activeTime / 60);
                    this.debugVoiceLog(`   Active minutes: ${minutes}`);
                    
                    if (minutes > 0) {
                        const baseVoiceXP = Math.floor(Math.random() * (this.config.voiceXPMax - this.config.voiceXPMin + 1)) + this.config.voiceXPMin;
                        const totalVoiceXP = baseVoiceXP * minutes;
                        this.debugVoiceLog(`💰 Awarding ${totalVoiceXP} voice XP (${baseVoiceXP} per minute × ${minutes} minutes)`);
                        
                        await this.addXP(userId, guildId, totalVoiceXP, 'voice');
                        this.voiceTracker.set(cooldownKey, now);
                        this.debugVoiceLog(`✅ Voice XP awarded successfully!`);
                    } else {
                        this.debugVoiceLog(`⏱️  No full minutes of activity (${activeTime}s)`);
                    }
                } else {
                    this.debugVoiceLog(`🚫 Voice XP on cooldown for ${Math.ceil(cooldownRemaining / 1000)} more seconds`);
                }
            } else {
                this.debugVoiceLog(`⏱️  Session too short (${duration}s < 60s minimum)`);
            }
            
            // Log voice session to database
            await this.db.query(
                'INSERT INTO voice_sessions (user_id, guild_id, duration) VALUES ($1, $2, $3)',
                [userId, guildId, duration]
            );
            this.debugVoiceLog(`📊 Voice session logged to database`);
            
        } catch (error) {
            console.error('❌ Voice XP processing error:', error);
            this.debugVoiceLog(`❌ Voice XP processing error:`, error);
        }
    }

    async addXP(userId, guildId, xpAmount, type) {
        try {
            const finalXP = Math.floor(xpAmount * this.config.xpMultiplier);
            this.debugXPLog(`Adding ${finalXP} XP (type: ${type}) for user ${userId}`);
            
            // Calculate voice time in minutes for database
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
            
            this

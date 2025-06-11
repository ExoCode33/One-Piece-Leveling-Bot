const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, ActivityType } = require('discord.js');
const { Pool } = require('pg');
require('dotenv').config();

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

        console.log('Bot Configuration:', this.config);
        console.log('Level Roles:', this.levelRoles);
        console.log('Level Up Config:', this.levelUpConfig);

        this.initializeDatabase();
        this.setupEventHandlers();
        this.setupCommands();
    }

    async initializeDatabase() {
        try {
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

            console.log('Database tables initialized successfully');
        } catch (error) {
            console.error('Database initialization error:', error);
        }
    }

    setupEventHandlers() {
        this.client.once('ready', () => {
            console.log(`Logged in as ${this.client.user.tag}`);
            this.client.user.setActivity('Leveling System', { type: ActivityType.Watching });
        });

        // Message XP
        this.client.on('messageCreate', async (message) => {
            if (message.author.bot || !message.guild) return;
            
            const cooldownKey = `${message.author.id}-${message.guild.id}`;
            const now = Date.now();
            
            // 60 second cooldown for message XP (configurable)
            if (this.messageCooldowns.has(cooldownKey)) {
                const cooldownEnd = this.messageCooldowns.get(cooldownKey);
                if (now < cooldownEnd) return;
            }
            
            this.messageCooldowns.set(cooldownKey, now + this.config.messageCooldown);
            
            const xpGain = Math.floor(Math.random() * (this.config.messageXPMax - this.config.messageXPMin + 1)) + this.config.messageXPMin;
            
            await this.addXP(message.author.id, message.guild.id, xpGain, 'message');
        });

        // Reaction XP
        this.client.on('messageReactionAdd', async (reaction, user) => {
            if (user.bot || !reaction.message.guild) return;
            
            const cooldownKey = `${user.id}-${reaction.message.guild.id}`;
            const now = Date.now();
            
            // 30 second cooldown for reaction XP (configurable)
            if (this.reactionCooldowns.has(cooldownKey)) {
                const cooldownEnd = this.reactionCooldowns.get(cooldownKey);
                if (now < cooldownEnd) return;
            }
            
            this.reactionCooldowns.set(cooldownKey, now + this.config.reactionCooldown);
            
            const reactionXP = Math.floor(Math.random() * (this.config.reactionXPMax - this.config.reactionXPMin + 1)) + this.config.reactionXPMin;
            await this.addXP(user.id, reaction.message.guild.id, reactionXP, 'reaction');
        });

        // Voice XP tracking with AFK detection
        this.client.on('voiceStateUpdate', async (oldState, newState) => {
            const userId = newState.id;
            const guildId = newState.guild.id;
            
            // User joined a voice channel
            if (!oldState.channelId && newState.channelId) {
                this.voiceTracker.set(`${userId}-${guildId}`, {
                    startTime: Date.now(),
                    channelId: newState.channelId,
                    lastActivity: Date.now()
                });
            }
            
            // User left a voice channel or switched channels
            if (oldState.channelId && (!newState.channelId || oldState.channelId !== newState.channelId)) {
                const session = this.voiceTracker.get(`${userId}-${guildId}`);
                if (session) {
                    const duration = Math.floor((Date.now() - session.startTime) / 1000);
                    await this.processVoiceXP(userId, guildId, duration, oldState.channelId);
                    this.voiceTracker.delete(`${userId}-${guildId}`);
                }
                
                // If switched channels, start new session
                if (newState.channelId && oldState.channelId !== newState.channelId) {
                    this.voiceTracker.set(`${userId}-${guildId}`, {
                        startTime: Date.now(),
                        channelId: newState.channelId,
                        lastActivity: Date.now()
                    });
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
                    }
                }
            }
        });

        // Slash commands
        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            
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
                }
            } catch (error) {
                console.error('Command error:', error);
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
            const channel = this.client.channels.cache.get(channelId);
            if (!channel) return;
            
            // Count non-bot members in voice channel
            const humanMembers = channel.members.filter(member => !member.user.bot).size;
            
            // Only give XP if there are enough human members
            if (humanMembers >= this.config.voiceMinMembers) {
                // Check for AFK if enabled
                let activeTime = duration;
                if (this.config.voiceAntiAFK) {
                    const session = this.voiceTracker.get(`${userId}-${guildId}`);
                    if (session && session.lastActivity) {
                        const timeSinceActivity = (Date.now() - session.lastActivity) / 1000;
                        // If inactive for more than 10 minutes, reduce XP accordingly
                        if (timeSinceActivity > 600) {
                            activeTime = Math.max(0, duration - timeSinceActivity);
                        }
                    }
                }
                
                // Apply cooldown check for voice XP
                const cooldownKey = `voice-${userId}-${guildId}`;
                const now = Date.now();
                const lastVoiceXP = this.voiceTracker.get(cooldownKey) || 0;
                
                if (now - lastVoiceXP >= this.config.voiceCooldown) {
                    const minutes = Math.floor(activeTime / 60);
                    if (minutes > 0) {
                        const voiceXP = Math.floor(Math.random() * (this.config.voiceXPMax - this.config.voiceXPMin + 1)) + this.config.voiceXPMin;
                        const totalVoiceXP = voiceXP * minutes;
                        
                        await this.addXP(userId, guildId, totalVoiceXP, 'voice');
                        this.voiceTracker.set(cooldownKey, now);
                    }
                }
            }
            
            // Log voice session
            await this.db.query(
                'INSERT INTO voice_sessions (user_id, guild_id, duration) VALUES ($1, $2, $3)',
                [userId, guildId, duration]
            );
        } catch (error) {
            console.error('Voice XP processing error:', error);
        }
    }

    async addXP(userId, guildId, xpAmount, type) {
        try {
            const finalXP = Math.floor(xpAmount * this.config.xpMultiplier);
            
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
            `, [userId, guildId, finalXP, type === 'voice' ? Math.floor(xpAmount / ((this.config.voiceXPMin + this.config.voiceXPMax) / 2)) : 1]);
            
            const newTotalXP = result.rows[0].total_xp;
            const currentLevel = result.rows[0].level;
            const newLevel = this.calculateLevel(newTotalXP);
            
            if (newLevel > currentLevel) {
                await this.db.query(
                    'UPDATE user_levels SET level = $1 WHERE user_id = $2 AND guild_id = $3',
                    [newLevel, userId, guildId]
                );
                
                await this.handleLevelUp(userId, guildId, newLevel, currentLevel);
            }
        } catch (error) {
            console.error('Add XP error:', error);
        }
    }

    calculateLevel(totalXP) {
        switch (this.config.formulaCurve) {
            case 'linear':
                return Math.floor(totalXP / (1000 * this.config.formulaMultiplier));
            case 'exponential':
                return Math.floor(Math.pow(totalXP / (100 * this.config.formulaMultiplier), 0.5));
            case 'logarithmic':
                return Math.floor(Math.log(totalXP / 100 + 1) * this.config.formulaMultiplier * 10);
            default:
                // Default exponential curve matching your calculator
                return Math.floor(Math.pow(totalXP / (100 * this.config.formulaMultiplier), 0.5));
        }
    }

    calculateXPForLevel(level) {
        switch (this.config.formulaCurve) {
            case 'linear':
                return level * 1000 * this.config.formulaMultiplier;
            case 'exponential':
                return Math.floor(Math.pow(level, 2) * 100 * this.config.formulaMultiplier);
            case 'logarithmic':
                return Math.floor((Math.exp(level / (this.config.formulaMultiplier * 10)) - 1) * 100);
            default:
                // Default exponential curve
                return Math.floor(Math.pow(level, 2) * 100 * this.config.formulaMultiplier);
        }
    }

    async handleLevelUp(userId, guildId, newLevel, oldLevel) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;
            
            const user = await guild.members.fetch(userId);
            if (!user) return;
            
            // Check for role rewards from environment variables
            if (this.levelRoles[newLevel]) {
                const roleId = this.levelRoles[newLevel];
                const role = guild.roles.cache.get(roleId);
                if (role && !user.roles.cache.has(roleId)) {
                    await user.roles.add(role);
                    console.log(`Added Level ${newLevel} role to ${user.user.username} for reaching level ${newLevel}`);
                }
            }
            
            // Send level up message with One Piece theme
            if (this.levelUpConfig.enabled) {
                let channel = null;
                
                // Try to find channel by ID first
                if (this.levelUpConfig.channel) {
                    channel = guild.channels.cache.get(this.levelUpConfig.channel);
                }
                
                // If no ID channel found, try to find by name
                if (!channel && this.levelUpConfig.channelName) {
                    channel = guild.channels.cache.find(ch => 
                        ch.type === 0 && // Text channel
                        ch.name.toLowerCase() === this.levelUpConfig.channelName.toLowerCase() &&
                        ch.permissionsFor(guild.members.me).has(['SendMessages', 'EmbedLinks'])
                    );
                }
                
                // If still no channel, try to find a general channel
                if (!channel) {
                    channel = guild.channels.cache.find(ch => 
                        ch.type === 0 && // Text channel
                        ch.permissionsFor(guild.members.me).has(['SendMessages', 'EmbedLinks']) &&
                        (ch.name.includes('general') || ch.name.includes('chat') || ch.name.includes('level') || ch.name.includes('bounty'))
                    );
                }
                
                if (channel) {
                    // Get bounty amount for current level
                    const bountyAmount = this.getBountyForLevel(newLevel);
                    const oldBountyAmount = this.getBountyForLevel(oldLevel);
                    
                    let message = this.levelUpConfig.message
                        .replace('{user}', this.levelUpConfig.pingUser ? `<@${userId}>` : user.user.username)
                        .replace('{level}', newLevel.toString())
                        .replace('{oldlevel}', oldLevel.toString())
                        .replace('{bounty}', `₿${bountyAmount}`)
                        .replace('{oldbounty}', `₿${oldBountyAmount}`);
                    
                    const embed = new EmbedBuilder()
                        .setColor('#FF6B00') // Orange like One Piece
                        .setTitle('🏴‍☠️ BOUNTY UPDATE!')
                        .setDescription(message)
                        .setThumbnail(user.user.displayAvatarURL())
                        .setTimestamp()
                        .setFooter({ text: 'World Government • Marine Headquarters' });
                    
                    if (this.levelUpConfig.showProgress) {
                        embed.addFields(
                            { name: '⚔️ Previous Bounty', value: `₿${oldBountyAmount}`, inline: true },
                            { name: '💰 New Bounty', value: `₿${bountyAmount}`, inline: true },
                            { name: '🏴‍☠️ Pirate Level', value: `${newLevel}`, inline: true }
                        );
                    }
                    
                    if (this.levelUpConfig.showXP) {
                        const userData = await this.db.query(
                            'SELECT total_xp FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                            [userId, guildId]
                        );
                        if (userData.rows.length > 0) {
                            embed.addFields({ name: '⭐ Total Reputation', value: userData.rows[0].total_xp.toLocaleString(), inline: true });
                        }
                    }
                    
                    if (this.levelUpConfig.showRole && this.levelRoles[newLevel]) {
                        const role = guild.roles.cache.get(this.levelRoles[newLevel]);
                        if (role) {
                            embed.addFields({ name: '🎖️ New Title', value: role.name, inline: true });
                        }
                    }
                    
                    // Add One Piece flavor text based on level
                    const flavorText = this.getFlavorTextForLevel(newLevel);
                    if (flavorText) {
                        embed.addFields({ name: '📰 Marine Report', value: flavorText, inline: false });
                    }
                    
                    await channel.send({ embeds: [embed] });
                }
            }
        } catch (error) {
            console.error('Level up handling error:', error);
        }
    }

    async getGuildSettings(guildId) {
        try {
            const result = await this.db.query(
                'SELECT * FROM guild_settings WHERE guild_id = $1',
                [guildId]
            );
            
            if (result.rows.length === 0) {
                // Create default settings
                await this.db.query(`
                    INSERT INTO guild_settings (guild_id, level_roles, xp_multiplier, voice_xp_rate, message_xp_min, message_xp_max, reaction_xp)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [guildId, JSON.stringify({}), 1.0, 1, 15, 25, 5]);
                
                return {
                    level_roles: {},
                    xp_multiplier: 1.0,
                    voice_xp_rate: 1,
                    message_xp_min: 15,
                    message_xp_max: 25,
                    reaction_xp: 5,
                    level_up_channel: null
                };
            }
            
            return result.rows[0];
        } catch (error) {
            console.error('Get guild settings error:', error);
            return {
                level_roles: {},
                xp_multiplier: 1.0,
                voice_xp_rate: 1,
                message_xp_min: 15,
                message_xp_max: 25,
                reaction_xp: 5,
                level_up_channel: null
            };
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
                flags: 64 // MessageFlags.Ephemeral
            });
        }
        
        const userData = result.rows[0];
        const currentLevelXP = this.calculateXPForLevel(userData.level);
        const nextLevelXP = this.calculateXPForLevel(userData.level + 1);
        const progressXP = userData.total_xp - currentLevelXP;
        const neededXP = nextLevelXP - currentLevelXP;
        const bountyAmount = this.getBountyForLevel(userData.level);
        
        // Handle level 0 display
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
            
            // Get leaderboard data
            const result = await this.db.query(
                'SELECT user_id, level, total_xp FROM user_levels WHERE guild_id = $1 ORDER BY total_xp DESC LIMIT 15',
                [interaction.guild.id]
            );
            
            if (result.rows.length === 0) {
                return await interaction.reply({ 
                    content: 'No pirates have started their journey yet! 🏴‍☠️', 
                    flags: 64 // MessageFlags.Ephemeral
                });
            }

            // Filter out excluded role members and get top 10
            let filteredUsers = [];
            let excludedCount = 0;
            
            for (const userData of result.rows) {
                if (filteredUsers.length >= 10) break;
                
                try {
                    const member = await guild.members.fetch(userData.user_id);
                    
                    // Skip if user has excluded role
                    if (excludeRoleId && member.roles.cache.has(excludeRoleId)) {
                        excludedCount++;
                        continue;
                    }
                    
                    filteredUsers.push({
                        member,
                        level: userData.level,
                        totalXp: userData.total_xp
                    });
                } catch (error) {
                    // User left server, skip
                    continue;
                }
            }

            if (filteredUsers.length === 0) {
                return await interaction.reply({ 
                    content: 'No eligible pirates found for the leaderboard! 🏴‍☠️', 
                    flags: 64 // MessageFlags.Ephemeral
                });
            }

            // Update top player role
            await this.updateTopPlayerRole(guild, filteredUsers[0].member);

            // Create leaderboard embed
            const embed = new EmbedBuilder()
                .setColor('#FF6B00')
                .setTitle('🏴‍☠️ Most Wanted Pirates')
                .setDescription('*The World Government\'s Most Wanted List*')
                .setFooter({ text: 'World Government • Marine Headquarters' })
                .setTimestamp();
            
            let description = '';
            for (let i = 0; i < filteredUsers.length; i++) {
                const userData = filteredUsers[i];
                const bountyAmount = this.getBountyForLevel(userData.level);
                
                let medal;
                if (i === 0) medal = '👑'; // Crown for #1
                else if (i === 1) medal = '🥈';
                else if (i === 2) medal = '🥉';
                else medal = `${i + 1}.`;
                
                description += `${medal} **${userData.member.user.username}**\n💰 Bounty: ₿${bountyAmount} • ⚔️ Level ${userData.level}\n⭐ ${userData.totalXp.toLocaleString()} Reputation\n\n`;
            }
            
            embed.setDescription(description);
            
            // Add footer info about exclusions
            if (excludedCount > 0) {
                embed.addFields({ 
                    name: 'ℹ️ Note', 
                    value: `${excludedCount} member(s) excluded from rankings`, 
                    inline: false 
                });
            }

            await interaction.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Leaderboard command error:', error);
            await interaction.reply({ 
                content: 'An error occurred while fetching the leaderboard.', 
                flags: 64 // MessageFlags.Ephemeral
            });
        }
    }

    async updateTopPlayerRole(guild, topMember) {
        try {
            const topRoleId = this.leaderboardConfig.topRole;
            if (!topRoleId) return; // No top role configured
            
            const topRole = guild.roles.cache.get(topRoleId);
            if (!topRole) return; // Role doesn't exist
            
            // Remove the role from everyone who currently has it
            const membersWithRole = guild.members.cache.filter(member => member.roles.cache.has(topRoleId));
            for (const [, member] of membersWithRole) {
                if (member.id !== topMember.id) {
                    await member.roles.remove(topRole);
                    console.log(`Removed top role from ${member.user.username}`);
                }
            }
            
            // Give the role to the current #1 player
            if (!topMember.roles.cache.has(topRoleId)) {
                await topMember.roles.add(topRole);
                console.log(`Assigned top role to ${topMember.user.username}`);
            }
            
        } catch (error) {
            console.error('Error updating top player role:', error);
        }
    }

    async handleSetLevelRoleCommand(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return await interaction.reply({ 
                content: 'You need the "Manage Roles" permission to use this command.', 
                flags: 64 // MessageFlags.Ephemeral
            });
        }
        
        const level = interaction.options.getInteger('level');
        const role = interaction.options.getRole('role');
        
        if (![5, 10, 15, 20, 25, 30, 35, 40, 45, 50].includes(level)) {
            return await interaction.reply({ 
                content: 'Level must be one of: 5, 10, 15, 20, 25, 30, 35, 40, 45, 50', 
                flags: 64 // MessageFlags.Ephemeral
            });
        }
        
        const settings = await this.getGuildSettings(interaction.guild.id);
        settings.level_roles[level] = role ? role.id : null;
        
        await this.db.query(
            'UPDATE guild_settings SET level_roles = $1 WHERE guild_id = $2',
            [JSON.stringify(settings.level_roles), interaction.guild.id]
        );
        
        const message = role 
            ? `Level ${level} role set to ${role.name}`
            : `Level ${level} role removed`;
            
        await interaction.reply({ 
            content: message, 
            flags: 64 // MessageFlags.Ephemeral
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
        
        // XP Settings
        embed.addFields(
            { name: '💬 Message XP', value: `${this.config.messageXPMin}-${this.config.messageXPMax} (${this.config.messageCooldown/1000}s cooldown)`, inline: true },
            { name: '👍 Reaction XP', value: `${this.config.reactionXPMin}-${this.config.reactionXPMax} (${this.config.reactionCooldown/1000}s cooldown)`, inline: true },
            { name: '🎤 Voice XP', value: `${this.config.voiceXPMin}-${this.config.voiceXPMax}/min (${this.config.voiceCooldown/1000}s cooldown)`, inline: true },
            { name: '📊 Formula', value: `${this.config.formulaCurve} (×${this.config.formulaMultiplier})`, inline: true },
            { name: '🎯 Max Level', value: this.config.maxLevel.toString(), inline: true },
            { name: '✨ XP Multiplier', value: `×${this.config.xpMultiplier}`, inline: true }
        );
        
        // Voice Settings
        embed.addFields(
            { name: '🔊 Voice Requirements', value: `Min ${this.config.voiceMinMembers} members\nAFK Detection: ${this.config.voiceAntiAFK ? '✅' : '❌'}`, inline: true }
        );
        
        // Level Up Settings
        embed.addFields(
            { name: '🎉 Level Up Messages', value: `${this.levelUpConfig.enabled ? '✅ Enabled' : '❌ Disabled'}\nPing User: ${this.levelUpConfig.pingUser ? '✅' : '❌'}`, inline: true }
        );
        
        // Level Roles
        let rolesText = '';
        let roleCount = 0;
        for (const [level, roleId] of Object.entries(this.levelRoles)) {
            if (roleId) {
                const role = interaction.guild.roles.cache.get(roleId);
                if (role && roleCount < 5) { // Show max 5 roles
                    rolesText += `Level ${level}: ${role.name}\n`;
                    roleCount++;
                }
            }
        }
        
        if (rolesText) {
            embed.addFields({ name: '🏆 Level Roles', value: rolesText + (roleCount === 5 ? '...' : ''), inline: false });
        }
        
        await interaction.reply({ embeds: [embed] });
    }

    async handleReloadCommand(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return await interaction.reply({ 
                content: 'You need the "Manage Server" permission to use this command.', 
                flags: 64 // MessageFlags.Ephemeral
            });
        }
        
        // Reload configuration from environment variables
        this.config = {
            // Message XP
            messageXPMin: parseInt(process.env.MESSAGE_XP_MIN) || 25,
            messageXPMax: parseInt(process.env.MESSAGE_XP_MAX) || 35,
            messageCooldown: parseInt(process.env.MESSAGE_COOLDOWN) || 60000,
            
            // Voice XP  
            voiceXPMin: parseInt(process.env.VOICE_XP_MIN) || 45,
            voiceXPMax: parseInt(process.env.VOICE_XP_MAX) || 55,
            voiceCooldown: parseInt(process.env.VOICE_COOLDOWN) || 180000,
            voiceMinMembers: parseInt(process.env.VOICE_MIN_MEMBERS) || 2,
            voiceAntiAFK: process.env.VOICE_ANTI_AFK === 'true' || true,
            
            // Reaction XP
            reactionXPMin: parseInt(process.env.REACTION_XP_MIN) || 25,
            reactionXPMax: parseInt(process.env.REACTION_XP_MAX) || 35,
            reactionCooldown: parseInt(process.env.REACTION_COOLDOWN) || 300000,
            
            // Formula settings
            formulaCurve: process.env.FORMULA_CURVE || 'exponential',
            formulaMultiplier: parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75,
            maxLevel: parseInt(process.env.MAX_LEVEL) || 50,
            
            // Global settings
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

        this.leaderboardConfig = {
            topRole: process.env.LEADERBOARD_TOP_ROLE || null,
            excludeRole: process.env.LEADERBOARD_EXCLUDE_ROLE || null
        };
        
        console.log('Configuration reloaded:', this.config);
        console.log('Level roles reloaded:', this.levelRoles);
        console.log('Level up config reloaded:', this.levelUpConfig);
        
        await interaction.reply({ 
            content: '✅ Configuration reloaded from environment variables!', 
            flags: 64 // MessageFlags.Ephemeral
        });
    }

    async handleInitRookiesCommand(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ 
                content: 'You need the "Administrator" permission to use this command.', 
                flags: 64 // MessageFlags.Ephemeral
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

            // Get all bounty role IDs
            const bountyRoleIds = Object.values(this.levelRoles).filter(id => id !== null);
            
            // Fetch all guild members
            await guild.members.fetch();
            
            let processedCount = 0;
            let assignedCount = 0;
            let errorCount = 0;

            const embed = new EmbedBuilder()
                .setColor('#FF6B00')
                .setTitle('🏴‍☠️ Initializing Rookie Pirates...')
                .setDescription('Processing server members...')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            for (const [userId, member] of guild.members.cache) {
                processedCount++;
                
                // Skip bots
                if (member.user.bot) continue;

                // Check if user already has any bounty role
                const hasBountyRole = member.roles.cache.some(role => bountyRoleIds.includes(role.id));
                
                // If they don't have any bounty role, give them Level 0
                if (!hasBountyRole) {
                    try {
                        await member.roles.add(level0Role);
                        assignedCount++;
                        console.log(`Assigned Level 0 role to ${member.user.username}`);
                    } catch (error) {
                        errorCount++;
                        console.error(`Failed to assign role to ${member.user.username}:`, error);
                    }
                }

                // Update progress every 50 members
                if (processedCount % 50 === 0) {
                    const progressEmbed = new EmbedBuilder()
                        .setColor('#FF6B00')
                        .setTitle('🏴‍☠️ Initializing Rookie Pirates...')
                        .setDescription(`Processed: ${processedCount} members\nAssigned: ${assignedCount} rookies`)
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [progressEmbed] });
                }
            }

            // Final result
            const resultEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Rookie Initialization Complete!')
                .addFields(
                    { name: '👥 Total Members Processed', value: processedCount.toString(), inline: true },
                    { name: '🆕 New Rookies Assigned', value: assignedCount.toString(), inline: true },
                    { name: '❌ Errors', value: errorCount.toString(), inline: true },
                    { name: '🏴‍☠️ Role Assigned', value: level0Role.name, inline: false }
                )
                .setFooter({ text: 'All eligible members now have bounty roles!' })
                .setTimestamp();

            await interaction.editReply({ embeds: [resultEmbed] });

        } catch (error) {
            console.error('Init rookies command error:', error);
            await interaction.editReply({ content: '❌ An error occurred while initializing rookies. Check console for details.' });
        }
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
                .setDescription('View the server leaderboard'),
            
            new SlashCommandBuilder()
                .setName('setlevelrole')
                .setDescription('Set a role reward for a specific level')
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('The level (5, 10, 15, 20, 25, 30, 35, 40, 45, 50)')
                        .setRequired(true)
                        .addChoices(
                            { name: '5', value: 5 },
                            { name: '10', value: 10 },
                            { name: '15', value: 15 },
                            { name: '20', value: 20 },
                            { name: '25', value: 25 },
                            { name: '30', value: 30 },
                            { name: '35', value: 35 },
                            { name: '40', value: 40 },
                            { name: '45', value: 45 },
                            { name: '50', value: 50 }
                        )
                )
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to give (leave empty to remove)')
                        .setRequired(false)
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
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        ];

        this.client.once('ready', async () => {
            try {
                console.log('Registering slash commands...');
                await this.client.application.commands.set(commands);
                console.log('Slash commands registered successfully');
            } catch (error) {
                console.error('Error registering commands:', error);
            }
        });
    }

    async start() {
        try {
            await this.client.login(process.env.DISCORD_TOKEN);
        } catch (error) {
            console.error('Failed to start bot:', error);
        }
    }
}

// Start the bot
const bot = new LevelingBot();
bot.start();

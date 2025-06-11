// index.js - Main entry point for Discord Leveling Bot
require('dotenv').config();
const { Client, GatewayIntentBits, Events, Collection, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { Pool } = require('pg');

// Simple logging utility
const log = {
    info: (...args) => console.log('[INFO]', new Date().toISOString(), ...args),
    error: (...args) => console.error('[ERROR]', new Date().toISOString(), ...args),
    warn: (...args) => console.warn('[WARN]', new Date().toISOString(), ...args),
    debug: (...args) => process.env.NODE_ENV !== 'production' && console.log('[DEBUG]', new Date().toISOString(), ...args)
};

class DiscordLevelingBot {
    constructor() {
        // Initialize Discord client
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.MessageContent
            ]
        });

        // Initialize database
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });

        // Command collection
        this.commands = new Collection();

        // Cooldown tracking
        this.messageCooldowns = new Map();
        this.reactionCooldowns = new Map();
        this.voiceCooldowns = new Map();

        // Voice session tracking
        this.voiceSessions = new Map();

        // Configuration with defaults
        this.config = {
            MESSAGE_XP_MIN: parseInt(process.env.MESSAGE_XP_MIN) || 15,
            MESSAGE_XP_MAX: parseInt(process.env.MESSAGE_XP_MAX) || 25,
            MESSAGE_COOLDOWN: parseInt(process.env.MESSAGE_COOLDOWN) || 60000,
            
            VOICE_XP_MIN: parseInt(process.env.VOICE_XP_MIN) || 30,
            VOICE_XP_MAX: parseInt(process.env.VOICE_XP_MAX) || 50,
            VOICE_COOLDOWN: parseInt(process.env.VOICE_COOLDOWN) || 60000,
            VOICE_MIN_MEMBERS: parseInt(process.env.VOICE_MIN_MEMBERS) || 2,
            VOICE_ANTI_AFK: process.env.VOICE_ANTI_AFK !== 'false',
            
            REACTION_XP_MIN: parseInt(process.env.REACTION_XP_MIN) || 5,
            REACTION_XP_MAX: parseInt(process.env.REACTION_XP_MAX) || 10,
            REACTION_COOLDOWN: parseInt(process.env.REACTION_COOLDOWN) || 30000,
            
            XP_MULTIPLIER: parseFloat(process.env.XP_MULTIPLIER) || 1.0,
            MAX_LEVEL: parseInt(process.env.MAX_LEVEL) || 50,
            
            LEVELUP_ENABLED: process.env.LEVELUP_ENABLED !== 'false',
            LEVELUP_SHOW_XP: process.env.LEVELUP_SHOW_XP !== 'false',
            LEVELUP_PING_USER: process.env.LEVELUP_PING_USER === 'true'
        };

        this.setupEventHandlers();
        this.setupCommands();
    }

    // Initialize database tables
    async initializeDatabase() {
        try {
            // Create user_levels table
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS user_levels (
                    user_id BIGINT NOT NULL,
                    guild_id BIGINT NOT NULL,
                    messages INTEGER DEFAULT 0,
                    reactions INTEGER DEFAULT 0,
                    voice_time INTEGER DEFAULT 0,
                    total_xp INTEGER DEFAULT 0,
                    level INTEGER DEFAULT 0,
                    last_message_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_reaction_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, guild_id)
                );
            `);

            // Create guild_settings table
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS guild_settings (
                    guild_id BIGINT PRIMARY KEY,
                    level_roles JSONB DEFAULT '{}',
                    xp_multiplier DECIMAL DEFAULT 1.0,
                    levelup_channel BIGINT,
                    levelup_enabled BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Create voice_sessions table
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS voice_sessions (
                    id SERIAL PRIMARY KEY,
                    user_id BIGINT NOT NULL,
                    guild_id BIGINT NOT NULL,
                    channel_id BIGINT NOT NULL,
                    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    end_time TIMESTAMP,
                    duration INTEGER DEFAULT 0,
                    xp_awarded INTEGER DEFAULT 0
                );
            `);

            // Create indexes for performance
            await this.db.query(`
                CREATE INDEX IF NOT EXISTS idx_user_levels_guild_xp ON user_levels (guild_id, total_xp DESC);
                CREATE INDEX IF NOT EXISTS idx_voice_sessions_user_guild ON voice_sessions (user_id, guild_id);
            `);

            log.info('Database initialized successfully');
        } catch (error) {
            log.error('Database initialization failed:', error);
            process.exit(1);
        }
    }

    // Setup event handlers
    setupEventHandlers() {
        this.client.once(Events.ClientReady, () => {
            log.info(`Bot logged in as ${this.client.user.tag}`);
            this.registerSlashCommands();
        });

        this.client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            await this.handleCommand(interaction);
        });

        this.client.on(Events.MessageCreate, async (message) => {
            if (message.author.bot || !message.guild) return;
            await this.handleMessage(message);
        });

        this.client.on(Events.MessageReactionAdd, async (reaction, user) => {
            if (user.bot || !reaction.message.guild) return;
            await this.handleReaction(reaction, user);
        });

        this.client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
            await this.handleVoiceStateUpdate(oldState, newState);
        });

        this.client.on(Events.Error, (error) => {
            log.error('Discord client error:', error);
        });
    }

    // Setup slash commands
    setupCommands() {
        const commands = [
            {
                name: 'level',
                description: 'Check your or someone\'s level and XP',
                options: [
                    {
                        name: 'user',
                        type: 6, // USER type
                        description: 'User to check level for',
                        required: false
                    }
                ]
            },
            {
                name: 'leaderboard',
                description: 'View the top users by XP in this server'
            },
            {
                name: 'setlevelrole',
                description: 'Set or remove a role reward for a specific level (Admin only)',
                options: [
                    {
                        name: 'level',
                        type: 4, // INTEGER type
                        description: 'Level to set role for',
                        required: true,
                        min_value: 1,
                        max_value: 100
                    },
                    {
                        name: 'role',
                        type: 8, // ROLE type
                        description: 'Role to assign (leave empty to remove)',
                        required: false
                    }
                ]
            },
            {
                name: 'levelroles',
                description: 'View all configured level role rewards'
            },
            {
                name: 'settings',
                description: 'View server leveling settings'
            }
        ];

        commands.forEach(cmd => this.commands.set(cmd.name, cmd));
    }

    // Register slash commands with Discord
    async registerSlashCommands() {
        try {
            const commandsArray = Array.from(this.commands.values());
            await this.client.application.commands.set(commandsArray);
            log.info(`Registered ${commandsArray.length} slash commands globally`);
        } catch (error) {
            log.error('Failed to register slash commands:', error);
        }
    }

    // Handle slash command execution
    async handleCommand(interaction) {
        const { commandName } = interaction;

        try {
            switch (commandName) {
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
                default:
                    await interaction.reply({ content: 'Unknown command!', ephemeral: true });
            }
        } catch (error) {
            log.error(`Command ${commandName} error:`, error);
            const errorMsg = 'An error occurred while executing the command.';
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: errorMsg, ephemeral: true });
            } else if (interaction.deferred) {
                await interaction.editReply({ content: errorMsg });
            }
        }
    }

    // Handle level command
    async handleLevelCommand(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userData = await this.getUserData(targetUser.id, interaction.guild.id);
        
        const level = this.calculateLevel(userData.total_xp);
        const xpForCurrentLevel = this.calculateXPForLevel(level);
        const xpForNextLevel = this.calculateXPForLevel(level + 1);
        const progressXP = userData.total_xp - xpForCurrentLevel;
        const neededXP = xpForNextLevel - xpForCurrentLevel;

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle(`${targetUser.username}'s Level`)
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields(
                { name: 'Level', value: level.toString(), inline: true },
                { name: 'Total XP', value: userData.total_xp.toLocaleString(), inline: true },
                { name: 'Progress', value: `${progressXP}/${neededXP} XP`, inline: true },
                { name: 'Messages', value: userData.messages.toString(), inline: true },
                { name: 'Reactions', value: userData.reactions.toString(), inline: true },
                { name: 'Voice Time', value: `${Math.floor(userData.voice_time / 60)}h ${userData.voice_time % 60}m`, inline: true }
            );

        await interaction.reply({ embeds: [embed] });
    }

    // Handle leaderboard command
    async handleLeaderboardCommand(interaction) {
        const result = await this.db.query(`
            SELECT user_id, total_xp, level, messages, reactions, voice_time
            FROM user_levels 
            WHERE guild_id = $1 
            ORDER BY total_xp DESC 
            LIMIT 10
        `, [interaction.guild.id]);

        if (result.rows.length === 0) {
            return await interaction.reply({ content: 'No users found in the leaderboard yet!', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`🏆 ${interaction.guild.name} Leaderboard`)
            .setDescription('Top 10 users by XP');

        for (let i = 0; i < result.rows.length; i++) {
            const user = result.rows[i];
            const discordUser = this.client.users.cache.get(user.user_id);
            const username = discordUser ? discordUser.username : `User ${user.user_id}`;
            const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
            
            embed.addFields({
                name: `${medal} ${username}`,
                value: `Level ${user.level} • ${user.total_xp.toLocaleString()} XP`,
                inline: false
            });
        }

        await interaction.reply({ embeds: [embed] });
    }

    // Handle set level role command
    async handleSetLevelRoleCommand(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return await interaction.reply({ content: 'You need the "Manage Roles" permission to use this command.', ephemeral: true });
        }

        const level = interaction.options.getInteger('level');
        const role = interaction.options.getRole('role');

        // Get or create guild settings
        let guildSettings = await this.getGuildSettings(interaction.guild.id);
        let levelRoles = guildSettings.level_roles || {};

        if (role) {
            // Set role for level
            levelRoles[level] = role.id;
            await this.db.query(`
                INSERT INTO guild_settings (guild_id, level_roles, updated_at)
                VALUES ($1, $2, CURRENT_TIMESTAMP)
                ON CONFLICT (guild_id) 
                DO UPDATE SET level_roles = $2, updated_at = CURRENT_TIMESTAMP
            `, [interaction.guild.id, JSON.stringify(levelRoles)]);

            await interaction.reply({ content: `Level ${level} role set to ${role.name}!`, ephemeral: true });
        } else {
            // Remove role for level
            delete levelRoles[level];
            await this.db.query(`
                UPDATE guild_settings 
                SET level_roles = $2, updated_at = CURRENT_TIMESTAMP
                WHERE guild_id = $1
            `, [interaction.guild.id, JSON.stringify(levelRoles)]);

            await interaction.reply({ content: `Level ${level} role removed!`, ephemeral: true });
        }
    }

    // Handle level roles command
    async handleLevelRolesCommand(interaction) {
        const guildSettings = await this.getGuildSettings(interaction.guild.id);
        const levelRoles = guildSettings.level_roles || {};

        if (Object.keys(levelRoles).length === 0) {
            return await interaction.reply({ content: 'No level roles configured yet! Use `/setlevelrole` to add some.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#9932CC')
            .setTitle('🎭 Level Role Rewards')
            .setDescription('Roles earned at each level:');

        const sortedLevels = Object.keys(levelRoles).sort((a, b) => parseInt(a) - parseInt(b));
        
        for (const level of sortedLevels) {
            const roleId = levelRoles[level];
            const role = interaction.guild.roles.cache.get(roleId);
            const roleName = role ? role.name : 'Unknown Role';
            embed.addFields({
                name: `Level ${level}`,
                value: roleName,
                inline: true
            });
        }

        await interaction.reply({ embeds: [embed] });
    }

    // Handle settings command
    async handleSettingsCommand(interaction) {
        const guildSettings = await this.getGuildSettings(interaction.guild.id);
        
        const embed = new EmbedBuilder()
            .setColor('#4169E1')
            .setTitle('⚙️ Server Settings')
            .addFields(
                { name: 'Message XP', value: `${this.config.MESSAGE_XP_MIN}-${this.config.MESSAGE_XP_MAX} (${this.config.MESSAGE_COOLDOWN/1000}s cooldown)`, inline: true },
                { name: 'Voice XP', value: `${this.config.VOICE_XP_MIN}-${this.config.VOICE_XP_MAX}/min (${this.config.VOICE_MIN_MEMBERS}+ members)`, inline: true },
                { name: 'Reaction XP', value: `${this.config.REACTION_XP_MIN}-${this.config.REACTION_XP_MAX} (${this.config.REACTION_COOLDOWN/1000}s cooldown)`, inline: true },
                { name: 'XP Multiplier', value: `${this.config.XP_MULTIPLIER}x`, inline: true },
                { name: 'Max Level', value: this.config.MAX_LEVEL.toString(), inline: true },
                { name: 'Level Up Messages', value: this.config.LEVELUP_ENABLED ? 'Enabled' : 'Disabled', inline: true }
            );

        await interaction.reply({ embeds: [embed] });
    }

    // Message XP handler
    async handleMessage(message) {
        const cooldownKey = `${message.author.id}-${message.guild.id}`;
        const now = Date.now();
        
        if (this.messageCooldowns.has(cooldownKey)) {
            const cooldownEnd = this.messageCooldowns.get(cooldownKey) + this.config.MESSAGE_COOLDOWN;
            if (now < cooldownEnd) return;
        }

        this.messageCooldowns.set(cooldownKey, now);
        
        const xp = this.randomBetween(this.config.MESSAGE_XP_MIN, this.config.MESSAGE_XP_MAX);
        await this.addXP(message.author.id, message.guild.id, xp, 'message');
    }

    // Reaction XP handler
    async handleReaction(reaction, user) {
        const cooldownKey = `${user.id}-${reaction.message.guild.id}`;
        const now = Date.now();
        
        if (this.reactionCooldowns.has(cooldownKey)) {
            const cooldownEnd = this.reactionCooldowns.get(cooldownKey) + this.config.REACTION_COOLDOWN;
            if (now < cooldownEnd) return;
        }

        this.reactionCooldowns.set(cooldownKey, now);
        
        const xp = this.randomBetween(this.config.REACTION_XP_MIN, this.config.REACTION_XP_MAX);
        await this.addXP(user.id, reaction.message.guild.id, xp, 'reaction');
    }

    // Voice state update handler
    async handleVoiceStateUpdate(oldState, newState) {
        const userId = newState.id || oldState.id;
        const guildId = newState.guild.id;
        const sessionKey = `${userId}-${guildId}`;

        // User left voice channel
        if (oldState.channel && !newState.channel) {
            if (this.voiceSessions.has(sessionKey)) {
                const session = this.voiceSessions.get(sessionKey);
                const duration = Math.floor((Date.now() - session.startTime) / 1000); // seconds
                
                if (duration >= 60) { // Minimum 1 minute
                    const minutes = Math.floor(duration / 60);
                    const xp = minutes * this.randomBetween(this.config.VOICE_XP_MIN, this.config.VOICE_XP_MAX);
                    await this.addXP(userId, guildId, xp, 'voice', minutes);
                }
                
                this.voiceSessions.delete(sessionKey);
            }
        }
        // User joined voice channel
        else if (!oldState.channel && newState.channel) {
            const memberCount = newState.channel.members.filter(member => !member.user.bot).size;
            
            if (memberCount >= this.config.VOICE_MIN_MEMBERS) {
                this.voiceSessions.set(sessionKey, {
                    startTime: Date.now(),
                    channelId: newState.channel.id
                });
            }
        }
    }

    // Add XP to user
    async addXP(userId, guildId, xp, source = 'unknown', extraData = 0) {
        const adjustedXP = Math.floor(xp * this.config.XP_MULTIPLIER);
        
        try {
            const result = await this.db.query(`
                INSERT INTO user_levels (user_id, guild_id, total_xp, messages, reactions, voice_time, level, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, guild_id)
                DO UPDATE SET 
                    total_xp = user_levels.total_xp + $3,
                    messages = user_levels.messages + $4,
                    reactions = user_levels.reactions + $5,
                    voice_time = user_levels.voice_time + $6,
                    level = $7,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING total_xp, level
            `, [
                userId, 
                guildId, 
                adjustedXP,
                source === 'message' ? 1 : 0,
                source === 'reaction' ? 1 : 0,
                source === 'voice' ? extraData : 0,
                0 // Will be updated below
            ]);

            const newTotalXP = result.rows[0].total_xp;
            const oldLevel = result.rows[0].level;
            const newLevel = this.calculateLevel(newTotalXP);

            // Update level if it changed
            if (newLevel !== oldLevel) {
                await this.db.query(`
                    UPDATE user_levels 
                    SET level = $1 
                    WHERE user_id = $2 AND guild_id = $3
                `, [newLevel, userId, guildId]);

                // Handle level up
                await this.handleLevelUp(userId, guildId, oldLevel, newLevel);
            }

        } catch (error) {
            log.error('Error adding XP:', error);
        }
    }

    // Handle level up
    async handleLevelUp(userId, guildId, oldLevel, newLevel) {
        if (!this.config.LEVELUP_ENABLED) return;

        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;

            const user = this.client.users.cache.get(userId);
            if (!user) return;

            const member = guild.members.cache.get(userId);
            if (!member) return;

            // Check for role rewards
            const guildSettings = await this.getGuildSettings(guildId);
            const levelRoles = guildSettings.level_roles || {};
            
            if (levelRoles[newLevel]) {
                const role = guild.roles.cache.get(levelRoles[newLevel]);
                if (role && !member.roles.cache.has(role.id)) {
                    try {
                        await member.roles.add(role);
                        log.info(`Added role ${role.name} to ${user.username} for reaching level ${newLevel}`);
                    } catch (error) {
                        log.error('Error adding role:', error);
                    }
                }
            }

            // Send level up message
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🎉 Level Up!')
                .setDescription(this.config.LEVELUP_PING_USER ? `<@${userId}>` : user.username)
                .addFields(
                    { name: 'New Level', value: newLevel.toString(), inline: true },
                    { name: 'Old Level', value: oldLevel.toString(), inline: true }
                );

            if (levelRoles[newLevel]) {
                const role = guild.roles.cache.get(levelRoles[newLevel]);
                if (role) {
                    embed.addFields({ name: 'Role Earned', value: role.name, inline: true });
                }
            }

            // Find channel to send message
            let channel = null;
            if (guildSettings.levelup_channel) {
                channel = guild.channels.cache.get(guildSettings.levelup_channel);
            }
            
            if (!channel) {
                // Find a general channel
                channel = guild.channels.cache.find(ch => 
                    ch.type === 0 && // Text channel
                    (ch.name.includes('general') || ch.name.includes('chat') || ch.name.includes('level'))
                ) || guild.systemChannel;
            }

            if (channel && channel.permissionsFor(guild.members.me).has(['SendMessages', 'EmbedLinks'])) {
                await channel.send({ embeds: [embed] });
            }

        } catch (error) {
            log.error('Error handling level up:', error);
        }
    }

    // Utility functions
    calculateLevel(xp) {
        return Math.floor(Math.sqrt(xp / 100));
    }

    calculateXPForLevel(level) {
        return level * level * 100;
    }

    randomBetween(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    async getUserData(userId, guildId) {
        const result = await this.db.query(`
            SELECT * FROM user_levels 
            WHERE user_id = $1 AND guild_id = $2
        `, [userId, guildId]);

        if (result.rows.length === 0) {
            return {
                user_id: userId,
                guild_id: guildId,
                messages: 0,
                reactions: 0,
                voice_time: 0,
                total_xp: 0,
                level: 0
            };
        }

        return result.rows[0];
    }

    async getGuildSettings(guildId) {
        const result = await this.db.query(`
            SELECT * FROM guild_settings WHERE guild_id = $1
        `, [guildId]);

        if (result.rows.length === 0) {
            // Create default settings
            await this.db.query(`
                INSERT INTO guild_settings (guild_id) VALUES ($1)
            `, [guildId]);
            
            return {
                guild_id: guildId,
                level_roles: {},
                xp_multiplier: 1.0,
                levelup_channel: null,
                levelup_enabled: true
            };
        }

        return result.rows[0];
    }

    // Start the bot
    async start() {
        try {
            await this.initializeDatabase();
            await this.client.login(process.env.DISCORD_TOKEN);
        } catch (error) {
            log.error('Failed to start bot:', error);
            process.exit(1);
        }
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    log.info('Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    log.info('Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

// Start the bot
const bot = new DiscordLevelingBot();
bot.start();

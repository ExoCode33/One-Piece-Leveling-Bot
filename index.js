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

        // Level roles configuration (editable per guild)
        this.defaultLevelRoles = {
            5: null, 10: null, 15: null, 20: null, 25: null,
            30: null, 35: null, 40: null, 45: null, 50: null
        };

        this.initializeDatabase();
        this.setupEventHandlers();
        this.setupCommands();
    }

    async initializeDatabase() {
        try {
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS user_levels (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    guild_id VARCHAR(20) NOT NULL,
                    messages INTEGER DEFAULT 0,
                    reactions INTEGER DEFAULT 0,
                    voice_time INTEGER DEFAULT 0,
                    total_xp INTEGER DEFAULT 0,
                    level INTEGER DEFAULT 0,
                    last_message_time TIMESTAMP DEFAULT NOW(),
                    last_reaction_time TIMESTAMP DEFAULT NOW(),
                    UNIQUE(user_id, guild_id)
                );
            `);

            await this.db.query(`
                CREATE TABLE IF NOT EXISTS guild_settings (
                    guild_id VARCHAR(20) PRIMARY KEY,
                    level_roles JSONB DEFAULT '{}',
                    xp_multiplier FLOAT DEFAULT 1.0,
                    voice_xp_rate INTEGER DEFAULT 1,
                    message_xp_min INTEGER DEFAULT 15,
                    message_xp_max INTEGER DEFAULT 25,
                    reaction_xp INTEGER DEFAULT 5,
                    level_up_channel VARCHAR(20),
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);

            await this.db.query(`
                CREATE TABLE IF NOT EXISTS voice_sessions (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    guild_id VARCHAR(20) NOT NULL,
                    start_time TIMESTAMP DEFAULT NOW(),
                    end_time TIMESTAMP,
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
            
            // 60 second cooldown for message XP
            if (this.messageCooldowns.has(cooldownKey)) {
                const cooldownEnd = this.messageCooldowns.get(cooldownKey);
                if (now < cooldownEnd) return;
            }
            
            this.messageCooldowns.set(cooldownKey, now + 60000);
            
            const settings = await this.getGuildSettings(message.guild.id);
            const xpGain = Math.floor(Math.random() * (settings.message_xp_max - settings.message_xp_min + 1)) + settings.message_xp_min;
            
            await this.addXP(message.author.id, message.guild.id, xpGain, 'message');
        });

        // Reaction XP
        this.client.on('messageReactionAdd', async (reaction, user) => {
            if (user.bot || !reaction.message.guild) return;
            
            const cooldownKey = `${user.id}-${reaction.message.guild.id}`;
            const now = Date.now();
            
            // 30 second cooldown for reaction XP
            if (this.reactionCooldowns.has(cooldownKey)) {
                const cooldownEnd = this.reactionCooldowns.get(cooldownKey);
                if (now < cooldownEnd) return;
            }
            
            this.reactionCooldowns.set(cooldownKey, now + 30000);
            
            const settings = await this.getGuildSettings(reaction.message.guild.id);
            await this.addXP(user.id, reaction.message.guild.id, settings.reaction_xp, 'reaction');
        });

        // Voice XP tracking
        this.client.on('voiceStateUpdate', async (oldState, newState) => {
            const userId = newState.id;
            const guildId = newState.guild.id;
            
            // User joined a voice channel
            if (!oldState.channelId && newState.channelId) {
                this.voiceTracker.set(`${userId}-${guildId}`, {
                    startTime: Date.now(),
                    channelId: newState.channelId
                });
            }
            
            // User left a voice channel
            if (oldState.channelId && !newState.channelId) {
                const session = this.voiceTracker.get(`${userId}-${guildId}`);
                if (session) {
                    const duration = Math.floor((Date.now() - session.startTime) / 1000);
                    await this.processVoiceXP(userId, guildId, duration, oldState.channelId);
                    this.voiceTracker.delete(`${userId}-${guildId}`);
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
                }
            } catch (error) {
                console.error('Command error:', error);
                await interaction.reply({ content: 'An error occurred while executing the command.', ephemeral: true });
            }
        });
    }

    async processVoiceXP(userId, guildId, duration, channelId) {
        try {
            const channel = this.client.channels.cache.get(channelId);
            if (!channel) return;
            
            // Count non-bot members in voice channel
            const humanMembers = channel.members.filter(member => !member.user.bot).size;
            
            // Only give XP if there are 2+ human members (excluding bots)
            if (humanMembers >= 2) {
                const settings = await this.getGuildSettings(guildId);
                const voiceXP = Math.floor(duration / 60) * settings.voice_xp_rate; // XP per minute
                
                if (voiceXP > 0) {
                    await this.addXP(userId, guildId, voiceXP, 'voice');
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
            const settings = await this.getGuildSettings(guildId);
            const finalXP = Math.floor(xpAmount * settings.xp_multiplier);
            
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
            `, [userId, guildId, finalXP, type === 'voice' ? Math.floor(xpAmount / settings.voice_xp_rate) : 1]);
            
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
        // Based on your formula: roughly 25,427.5 XP needed for level 50
        // Using a curve that matches your requirements
        return Math.floor(Math.sqrt(totalXP / 100));
    }

    calculateXPForLevel(level) {
        return level * level * 100;
    }

    async handleLevelUp(userId, guildId, newLevel, oldLevel) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;
            
            const user = await guild.members.fetch(userId);
            if (!user) return;
            
            const settings = await this.getGuildSettings(guildId);
            
            // Check for role rewards
            if (settings.level_roles && settings.level_roles[newLevel]) {
                const roleId = settings.level_roles[newLevel];
                const role = guild.roles.cache.get(roleId);
                if (role && !user.roles.cache.has(roleId)) {
                    await user.roles.add(role);
                }
            }
            
            // Send level up message
            if (settings.level_up_channel) {
                const channel = guild.channels.cache.get(settings.level_up_channel);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('🎉 Level Up!')
                        .setDescription(`Congratulations ${user}! You've reached **Level ${newLevel}**!`)
                        .addFields(
                            { name: 'Previous Level', value: oldLevel.toString(), inline: true },
                            { name: 'New Level', value: newLevel.toString(), inline: true }
                        )
                        .setThumbnail(user.user.displayAvatarURL())
                        .setTimestamp();
                    
                    if (settings.level_roles && settings.level_roles[newLevel]) {
                        const role = guild.roles.cache.get(settings.level_roles[newLevel]);
                        if (role) {
                            embed.addFields({ name: 'Role Reward', value: role.name, inline: true });
                        }
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
                `, [guildId, JSON.stringify(this.defaultLevelRoles), 1.0, 1, 15, 25, 5]);
                
                return {
                    level_roles: this.defaultLevelRoles,
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
                level_roles: this.defaultLevelRoles,
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
            return await interaction.reply({ content: `${targetUser.username} hasn't gained any XP yet!`, ephemeral: true });
        }
        
        const userData = result.rows[0];
        const currentLevelXP = this.calculateXPForLevel(userData.level);
        const nextLevelXP = this.calculateXPForLevel(userData.level + 1);
        const progressXP = userData.total_xp - currentLevelXP;
        const neededXP = nextLevelXP - currentLevelXP;
        
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`${targetUser.username}'s Level`)
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields(
                { name: 'Level', value: userData.level.toString(), inline: true },
                { name: 'Total XP', value: userData.total_xp.toLocaleString(), inline: true },
                { name: 'Progress', value: `${progressXP}/${neededXP} XP`, inline: true },
                { name: 'Messages', value: userData.messages.toLocaleString(), inline: true },
                { name: 'Reactions', value: userData.reactions.toLocaleString(), inline: true },
                { name: 'Voice Time', value: `${Math.floor(userData.voice_time / 60)}h ${userData.voice_time % 60}m`, inline: true }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }

    async handleLeaderboardCommand(interaction) {
        const result = await this.db.query(
            'SELECT user_id, level, total_xp FROM user_levels WHERE guild_id = $1 ORDER BY total_xp DESC LIMIT 10',
            [interaction.guild.id]
        );
        
        if (result.rows.length === 0) {
            return await interaction.reply({ content: 'No users have gained XP yet!', ephemeral: true });
        }
        
        const embed = new EmbedBuilder()
            .setColor('#gold')
            .setTitle('🏆 Leaderboard')
            .setTimestamp();
        
        let description = '';
        for (let i = 0; i < result.rows.length; i++) {
            const userData = result.rows[i];
            const user = await interaction.guild.members.fetch(userData.user_id).catch(() => null);
            const username = user ? user.user.username : 'Unknown User';
            
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            description += `${medal} **${username}** - Level ${userData.level} (${userData.total_xp.toLocaleString()} XP)\n`;
        }
        
        embed.setDescription(description);
        await interaction.reply({ embeds: [embed] });
    }

    async handleSetLevelRoleCommand(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return await interaction.reply({ content: 'You need the "Manage Roles" permission to use this command.', ephemeral: true });
        }
        
        const level = interaction.options.getInteger('level');
        const role = interaction.options.getRole('role');
        
        if (![5, 10, 15, 20, 25, 30, 35, 40, 45, 50].includes(level)) {
            return await interaction.reply({ content: 'Level must be one of: 5, 10, 15, 20, 25, 30, 35, 40, 45, 50', ephemeral: true });
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
            
        await interaction.reply({ content: message, ephemeral: true });
    }

    async handleLevelRolesCommand(interaction) {
        const settings = await this.getGuildSettings(interaction.guild.id);
        
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Level Roles Configuration')
            .setTimestamp();
        
        let description = '';
        for (const [level, roleId] of Object.entries(settings.level_roles)) {
            const role = roleId ? interaction.guild.roles.cache.get(roleId) : null;
            const roleName = role ? role.name : 'Not Set';
            description += `Level ${level}: ${roleName}\n`;
        }
        
        embed.setDescription(description || 'No level roles configured');
        await interaction.reply({ embeds: [embed] });
    }

    async handleSettingsCommand(interaction) {
        const settings = await this.getGuildSettings(interaction.guild.id);
        
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Server Settings')
            .addFields(
                { name: 'XP Multiplier', value: settings.xp_multiplier.toString(), inline: true },
                { name: 'Voice XP Rate', value: `${settings.voice_xp_rate}/min`, inline: true },
                { name: 'Message XP Range', value: `${settings.message_xp_min}-${settings.message_xp_max}`, inline: true },
                { name: 'Reaction XP', value: settings.reaction_xp.toString(), inline: true }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
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
                .setDescription('View server leveling settings')
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

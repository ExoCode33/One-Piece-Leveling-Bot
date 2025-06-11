// src/commands/utility.js - Utility Command Handlers
const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

// Simple debug replacement
const debug = {
    command: (...args) => console.log('[CMD]', ...args),
    error: (category, ...args) => console.error('[ERROR]', category, ...args)
};

class UtilityCommands {
    constructor(bot) {
        this.bot = bot;
        this.client = bot.client;
        this.db = bot.db;
        this.updateConfig();
    }

    // Update configuration references
    updateConfig() {
        this.config = this.bot.config;
        this.levelRoles = this.bot.levelRoles;
        this.levelUpConfig = this.bot.levelUpConfig;
        this.leaderboardConfig = this.bot.leaderboardConfig;
        this.xpLogConfig = this.bot.xpLogConfig;
    }

    // Get command definitions
    getDefinitions() {
        return [
            new SlashCommandBuilder()
                .setName('levelroles')
                .setDescription('View all configured level roles'),
            
            new SlashCommandBuilder()
                .setName('settings')
                .setDescription('View server leveling settings'),

            new SlashCommandBuilder()
                .setName('debug')
                .setDescription('Debug system status and information')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('status')
                        .setDescription('Show current debug and system status')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('config')
                        .setDescription('Show detailed configuration information')
                )
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        ];
    }

    // Handle levelroles command
    async handleLevelRoles(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🏆 Level Roles Configuration')
            .setDescription('Current level role rewards configured via environment variables')
            .setTimestamp();
        
        let rolesConfigured = 0;
        let rolesList = '';
        
        for (const [level, roleId] of Object.entries(this.levelRoles)) {
            const role = roleId ? interaction.guild.roles.cache.get(roleId) : null;
            
            if (role) {
                rolesConfigured++;
                const bountyAmount = this.bot.getBountyForLevel(parseInt(level));
                rolesList += `**Level ${level}:** ${role.name} • ₿${bountyAmount}\n`;
            } else if (roleId) {
                rolesList += `**Level ${level}:** ⚠️ Role not found (ID: ${roleId})\n`;
            } else {
                rolesList += `**Level ${level}:** ❌ Not configured\n`;
            }
        }
        
        embed.addFields(
            { 
                name: '📊 Summary', 
                value: `✅ **${rolesConfigured}** roles configured\n❌ **${Object.keys(this.levelRoles).length - rolesConfigured}** roles missing`, 
                inline: false 
            },
            { 
                name: '🎯 Level Rewards', 
                value: rolesList || 'No level roles configured', 
                inline: false 
            }
        );
        
        if (rolesConfigured === 0) {
            embed.addFields({
                name: '⚙️ Setup Instructions',
                value: '1. Go to Railway Dashboard\n2. Set environment variables like `LEVEL_5_ROLE=role_id`\n3. Use `/reload` to apply changes\n4. Use `/setlevelrole` for guidance',
                inline: false
            });
        }
        
        embed.setFooter({ text: 'Configure roles using Railway environment variables (LEVEL_X_ROLE)' });
        
        await interaction.reply({ embeds: [embed] });
    }

    // Handle settings command
    async handleSettings(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🔧 Server Leveling Settings')
            .setDescription('Current bot configuration and settings')
            .setTimestamp();
        
        // XP Settings
        embed.addFields(
            { 
                name: '💬 Message XP', 
                value: `${this.config.messageXPMin}-${this.config.messageXPMax} XP\n${this.config.messageCooldown/1000}s cooldown`, 
                inline: true 
            },
            { 
                name: '👍 Reaction XP', 
                value: `${this.config.reactionXPMin}-${this.config.reactionXPMax} XP\n${this.config.reactionCooldown/1000}s cooldown`, 
                inline: true 
            },
            { 
                name: '🎤 Voice XP', 
                value: `${this.config.voiceXPMin}-${this.config.voiceXPMax} XP/min\n${this.config.voiceCooldown/1000}s cooldown`, 
                inline: true 
            }
        );

        // Formula Settings
        embed.addFields(
            { 
                name: '📊 Level Formula', 
                value: `Type: ${this.config.formulaCurve}\nMultiplier: ×${this.config.formulaMultiplier}`, 
                inline: true 
            },
            { 
                name: '🎯 Level Limits', 
                value: `Max Level: ${this.config.maxLevel}\nXP Multiplier: ×${this.config.xpMultiplier}`, 
                inline: true 
            },
            { 
                name: '🔊 Voice Requirements', 
                value: `Min ${this.config.voiceMinMembers} members\nAFK Detection: ${this.config.voiceAntiAFK ? '✅' : '❌'}`, 
                inline: true 
            }
        );

        // Feature Settings
        embed.addFields(
            { 
                name: '🎉 Level Up Messages', 
                value: `Status: ${this.levelUpConfig.enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                       `Ping User: ${this.levelUpConfig.pingUser ? '✅' : '❌'}\n` +
                       `Channel: ${this.levelUpConfig.channelName || 'Auto-detect'}`, 
                inline: true 
            },
            { 
                name: '📊 XP Logging', 
                value: `Status: ${this.xpLogConfig.enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                       `Messages: ${this.xpLogConfig.logMessages ? '✅' : '❌'}\n` +
                       `Reactions: ${this.xpLogConfig.logReactions ? '✅' : '❌'}\n` +
                       `Voice: ${this.xpLogConfig.logVoice ? '✅' : '❌'}\n` +
                       `Level Ups: ${this.xpLogConfig.logLevelUps ? '✅' : '❌'}\n` +
                       `Cooldowns: ${this.xpLogConfig.showCooldowns ? '✅' : '❌'}`, 
                inline: true 
            },
            { 
                name: '🏆 Leaderboard', 
                value: `Exclude Role: ${this.leaderboardConfig.excludeRole ? '✅ Set' : '❌ Not Set'}\n` +
                       `Top Role: ${this.leaderboardConfig.topRole ? '✅ Set' : '❌ Not Set'}`, 
                inline: true 
            }
        );

        // Level Roles Summary
        const configuredRoles = Object.values(this.levelRoles).filter(id => id !== null).length;
        const totalRoles = Object.keys(this.levelRoles).length;
        
        embed.addFields({
            name: '🎭 Level Roles',
            value: `${configuredRoles}/${totalRoles} roles configured\nUse \`/levelroles\` for details`,
            inline: true
        });

        embed.setFooter({ text: 'Use /reload to refresh settings • Configure via Railway environment variables' });
        
        await interaction.reply({ embeds: [embed] });
    }

    // Handle debug command
    async handleDebug(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return await interaction.reply({ 
                content: '❌ You need the "Manage Server" permission to use this command.', 
                flags: 64
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'status') {
            await this.handleDebugStatus(interaction);
        } else if (subcommand === 'config') {
            await this.handleDebugConfig(interaction);
        }
    }

    // Handle debug status subcommand
    async handleDebugStatus(interaction) {
        try {
            // Get database statistics
            const userCountResult = await this.db.query(
                'SELECT COUNT(*) as total FROM user_levels WHERE guild_id = $1',
                [interaction.guild.id]
            );
            
            const topUserResult = await this.db.query(
                'SELECT total_xp, level FROM user_levels WHERE guild_id = $1 ORDER BY total_xp DESC LIMIT 1',
                [interaction.guild.id]
            );

            const totalXPResult = await this.db.query(
                'SELECT SUM(total_xp) as total FROM user_levels WHERE guild_id = $1',
                [interaction.guild.id]
            );

            const userCount = userCountResult.rows[0]?.total || 0;
            const topUser = topUserResult.rows[0];
            const totalXP = totalXPResult.rows[0]?.total || 0;

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🐛 Debug Status & System Information')
                .setDescription('Current system status and statistics')
                .setTimestamp();

            // Bot Status
            embed.addFields(
                {
                    name: '🤖 Bot Status',
                    value: `Uptime: ${this.formatUptime(this.client.uptime)}\n` +
                           `Guilds: ${this.client.guilds.cache.size}\n` +
                           `Users: ${this.client.users.cache.size}\n` +
                           `Ping: ${this.client.ws.ping}ms`,
                    inline: true
                },
                {
                    name: '💾 Database Stats',
                    value: `Total Users: ${userCount}\n` +
                           `Total XP: ${totalXP.toLocaleString()}\n` +
                           `Highest Level: ${topUser?.level || 0}\n` +
                           `Highest XP: ${topUser?.total_xp?.toLocaleString() || 0}`,
                    inline: true
                },
                {
                    name: '⚙️ Configuration',
                    value: `Debug Mode: Basic\n` +
                           `XP Logging: ${this.xpLogConfig.enabled ? '✅' : '❌'}\n` +
                           `Level Up: ${this.levelUpConfig.enabled ? '✅' : '❌'}\n` +
                           `Voice Tracking: ✅`,
                    inline: true
                }
            );

            // Environment Variables Status
            const envStatus = this.checkEnvironmentVariables();
            embed.addFields({
                name: '🔧 Environment Variables',
                value: `Required: ${envStatus.required.total - envStatus.required.missing}/${envStatus.required.total}\n` +
                       `Optional: ${envStatus.optional.total - envStatus.optional.missing}/${envStatus.optional.total}\n` +
                       `Missing: ${envStatus.required.missing + envStatus.optional.missing} total`,
                inline: false
            });

            embed.setFooter({ text: 'Use /debug config for detailed configuration information' });

            await interaction.reply({ embeds: [embed], flags: 64 });

        } catch (error) {
            debug.error('Debug Status', error);
            await interaction.reply({ 
                content: '❌ An error occurred while fetching debug information.', 
                flags: 64
            });
        }
    }

    // Handle debug config subcommand
    async handleDebugConfig(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('🔧 Detailed Configuration Information')
            .setDescription('Complete configuration details and environment variables')
            .setTimestamp();

        // XP Configuration Details
        embed.addFields(
            {
                name: '💫 XP Configuration',
                value: `\`\`\`yaml\nMessage XP: ${this.config.messageXPMin}-${this.config.messageXPMax}\n` +
                       `Message Cooldown: ${this.config.messageCooldown}ms\n` +
                       `Voice XP: ${this.config.voiceXPMin}-${this.config.voiceXPMax}\n` +
                       `Voice Cooldown: ${this.config.voiceCooldown}ms\n` +
                       `Reaction XP: ${this.config.reactionXPMin}-${this.config.reactionXPMax}\n` +
                       `Reaction Cooldown: ${this.config.reactionCooldown}ms\n` +
                       `XP Multiplier: ${this.config.xpMultiplier}\`\`\``,
                inline: false
            },
            {
                name: '📊 Formula Configuration',
                value: `\`\`\`yaml\nCurve Type: ${this.config.formulaCurve}\n` +
                       `Multiplier: ${this.config.formulaMultiplier}\n` +
                       `Max Level: ${this.config.maxLevel}\n` +
                       `Voice Min Members: ${this.config.voiceMinMembers}\n` +
                       `Voice Anti-AFK: ${this.config.voiceAntiAFK}\`\`\``,
                inline: false
            }
        );

        // Environment Variables Check
        const envCheck = this.checkEnvironmentVariables();
        let envStatus = '**Required Variables:**\n';
        envCheck.required.list.forEach(env => {
            const status = process.env[env] ? '✅' : '❌';
            envStatus += `${status} ${env}\n`;
        });
        
        envStatus += '\n**Optional Variables:**\n';
        envCheck.optional.list.forEach(env => {
            const status = process.env[env] ? '✅' : '❌';
            envStatus += `${status} ${env}\n`;
        });

        embed.addFields({
            name: '🔍 Environment Variables Status',
            value: envStatus,
            inline: false
        });

        embed.setFooter({ text: 'Missing variables may cause features to not work properly' });

        await interaction.reply({ embeds: [embed], flags: 64 });
    }

    // Helper method to format uptime
    formatUptime(uptime) {
        const days = Math.floor(uptime / (24 * 60 * 60 * 1000));
        const hours = Math.floor((uptime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const minutes = Math.floor((uptime % (60 * 60 * 1000)) / (60 * 1000));
        
        if (days > 0) return `${days}d ${hours}h ${minutes}m`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }

    // Helper method to check environment variables
    checkEnvironmentVariables() {
        const required = [
            'DISCORD_TOKEN',
            'DATABASE_URL',
            'NODE_ENV'
        ];

        const optional = [
            'MESSAGE_XP_MIN', 'MESSAGE_XP_MAX', 'MESSAGE_COOLDOWN',
            'VOICE_XP_MIN', 'VOICE_XP_MAX', 'VOICE_COOLDOWN',
            'REACTION_XP_MIN', 'REACTION_XP_MAX', 'REACTION_COOLDOWN',
            'FORMULA_CURVE', 'FORMULA_MULTIPLIER', 'MAX_LEVEL',
            'XP_MULTIPLIER', 'VOICE_MIN_MEMBERS', 'VOICE_ANTI_AFK',
            'LEVELUP_ENABLED', 'LEVELUP_CHANNEL', 'LEVELUP_CHANNEL_NAME',
            'LEADERBOARD_EXCLUDE_ROLE', 'LEADERBOARD_TOP_ROLE',
            'XP_LOG_ENABLED', 'XP_LOG_CHANNEL', 'XP_LOG_CHANNEL_NAME',
            ...Object.keys(this.levelRoles).map(level => `LEVEL_${level}_ROLE`)
        ];

        const requiredMissing = required.filter(env => !process.env[env]).length;
        const optionalMissing = optional.filter(env => !process.env[env]).length;

        return {
            required: {
                list: required,
                total: required.length,
                missing: requiredMissing
            },
            optional: {
                list: optional,
                total: optional.length,
                missing: optionalMissing
            }
        };
    }
}

module.exports = UtilityCommands;

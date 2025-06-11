// src/commands/admin.js - Admin Command Handlers
const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

// Simple debug replacement
const debug = {
    command: (...args) => console.log('[CMD]', ...args),
    error: (category, ...args) => console.error('[ERROR]', category, ...args),
    success: (category, ...args) => console.log('[SUCCESS]', category, ...args)
};

class AdminCommands {
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
                .setName('setlevelrole')
                .setDescription('Set a role reward for a specific level (use environment variables)')
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('The level (0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50)')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Level 0 (Rookie)', value: 0 },
                            { name: 'Level 5', value: 5 },
                            { name: 'Level 10', value: 10 },
                            { name: 'Level 15', value: 15 },
                            { name: 'Level 20', value: 20 },
                            { name: 'Level 25', value: 25 },
                            { name: 'Level 30', value: 30 },
                            { name: 'Level 35', value: 35 },
                            { name: 'Level 40', value: 40 },
                            { name: 'Level 45', value: 45 },
                            { name: 'Level 50', value: 50 }
                        )
                )
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
            
            new SlashCommandBuilder()
                .setName('reload')
                .setDescription('Reload configuration from environment variables')
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

            new SlashCommandBuilder()
                .setName('initrookies')
                .setDescription('Assign Level 0 role to all members without bounty roles')
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        ];
    }

    // Handle setlevelrole command
    async handleSetLevelRole(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return await interaction.reply({ 
                content: '❌ You need the "Manage Roles" permission to use this command.', 
                flags: 64
            });
        }

        const level = interaction.options.getInteger('level');
        const currentRoleId = this.levelRoles[level];
        const currentRole = currentRoleId ? interaction.guild.roles.cache.get(currentRoleId) : null;

        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle(`🔧 Level ${level} Role Configuration`)
            .setDescription('Level roles are configured via environment variables in Railway.')
            .addFields(
                { 
                    name: '📋 Current Configuration', 
                    value: currentRole ? `✅ **${currentRole.name}**` : '❌ No role set', 
                    inline: false 
                },
                { 
                    name: '⚙️ How to Configure', 
                    value: `1. Go to Railway Dashboard\n2. Select your bot service\n3. Go to **Variables** tab\n4. Set \`LEVEL_${level}_ROLE=role_id_here\`\n5. Use \`/reload\` to apply changes`, 
                    inline: false 
                },
                { 
                    name: '🆔 Getting Role ID', 
                    value: '1. Enable Developer Mode in Discord\n2. Right-click the role\n3. Select "Copy ID"', 
                    inline: false 
                }
            )
            .setFooter({ text: 'Environment Variable: LEVEL_' + level + '_ROLE' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: 64 });
    }

    // Handle reload command
    async handleReload(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return await interaction.reply({ 
                content: '❌ You need the "Manage Server" permission to use this command.', 
                flags: 64
            });
        }

        try {
            // Reload bot configuration
            this.bot.reloadConfiguration();
            
            debug.success('Configuration Reload', 'All configurations reloaded');
            
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ Configuration Reloaded!')
                .setDescription('All settings have been reloaded from environment variables.')
                .addFields(
                    { 
                        name: '🔄 Updated Settings', 
                        value: `Message XP: ${this.config.messageXPMin}-${this.config.messageXPMax}\n` +
                               `Voice XP: ${this.config.voiceXPMin}-${this.config.voiceXPMax}\n` +
                               `Reaction XP: ${this.config.reactionXPMin}-${this.config.reactionXPMax}\n` +
                               `XP Multiplier: ×${this.config.xpMultiplier}`, 
                        inline: true 
                    },
                    { 
                        name: '🏆 Leaderboard Config', 
                        value: `Exclude Role: ${this.leaderboardConfig.excludeRole ? '✅ Set' : '❌ Not Set'}\n` +
                               `Top Role: ${this.leaderboardConfig.topRole ? '✅ Set' : '❌ Not Set'}`, 
                        inline: true 
                    }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed], flags: 64 });
            
        } catch (error) {
            debug.error('Reload Command', error);
            await interaction.reply({ 
                content: '❌ An error occurred while reloading configuration.', 
                flags: 64
            });
        }
    }

    // Handle initrookies command
    async handleInitRookies(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ 
                content: '❌ You need the "Administrator" permission to use this command.', 
                flags: 64
            });
        }

        await interaction.deferReply();

        try {
            const guild = interaction.guild;
            const level0RoleId = this.levelRoles[0];
            
            if (!level0RoleId) {
                return await interaction.editReply({ 
                    content: '❌ Level 0 role not configured!\n\n**Setup Instructions:**\n1. Go to Railway Dashboard\n2. Set `LEVEL_0_ROLE=your_rookie_role_id`\n3. Use `/reload` to apply changes' 
                });
            }

            const level0Role = guild.roles.cache.get(level0RoleId);
            if (!level0Role) {
                return await interaction.editReply({ 
                    content: '❌ Level 0 role not found!\n\nThe role ID in your environment variables doesn\'t exist in this server. Please check the role ID and use `/reload`.' 
                });
            }

            // Get all configured bounty role IDs
            const bountyRoleIds = Object.values(this.levelRoles).filter(id => id !== null);
            
            // Fetch all guild members
            await guild.members.fetch();
            
            let processedCount = 0;
            let assignedCount = 0;
            let errorCount = 0;
            let skippedBots = 0;
            let alreadyHadRole = 0;

            const statusEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('🔄 Initializing Rookies...')
                .setDescription('Processing server members...')
                .setTimestamp();

            await interaction.editReply({ embeds: [statusEmbed] });

            for (const [userId, member] of guild.members.cache) {
                processedCount++;
                
                // Skip bots
                if (member.user.bot) {
                    skippedBots++;
                    continue;
                }

                // Check if user already has any bounty role
                const hasBountyRole = member.roles.cache.some(role => bountyRoleIds.includes(role.id));
                
                if (!hasBountyRole) {
                    // Check if user already has level 0 role
                    if (member.roles.cache.has(level0RoleId)) {
                        alreadyHadRole++;
                    } else {
                        try {
                            await member.roles.add(level0Role);
                            assignedCount++;
                        } catch (error) {
                            errorCount++;
                            debug.error(`Failed to assign role to ${member.user.username}:`, error);
                        }
                    }
                }

                // Update progress every 50 members
                if (processedCount % 50 === 0) {
                    const progressEmbed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('🔄 Initializing Rookies...')
                        .setDescription(`Processing... ${processedCount}/${guild.members.cache.size} members`)
                        .addFields(
                            { name: '🆕 New Rookies', value: assignedCount.toString(), inline: true },
                            { name: '❌ Errors', value: errorCount.toString(), inline: true },
                            { name: '🤖 Bots Skipped', value: skippedBots.toString(), inline: true }
                        )
                        .setTimestamp();

                    await interaction.editReply({ embeds: [progressEmbed] });
                }
            }

            // Final results
            const resultEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ Rookie Initialization Complete!')
                .setDescription(`Successfully processed all ${guild.members.cache.size} server members.`)
                .addFields(
                    { name: '👥 Total Members', value: guild.members.cache.size.toString(), inline: true },
                    { name: '🆕 New Rookies Assigned', value: assignedCount.toString(), inline: true },
                    { name: '👤 Already Had Role', value: alreadyHadRole.toString(), inline: true },
                    { name: '🤖 Bots Skipped', value: skippedBots.toString(), inline: true },
                    { name: '❌ Errors', value: errorCount.toString(), inline: true },
                    { name: '🏴‍☠️ Role Assigned', value: level0Role.name, inline: false }
                )
                .setFooter({ text: 'All eligible members are now ready to start their pirate journey!' })
                .setTimestamp();

            await interaction.editReply({ embeds: [resultEmbed] });

            // Log the action
            debug.success('Init Rookies', `Assigned ${assignedCount} rookie roles, ${errorCount} errors`);

        } catch (error) {
            debug.error('Init Rookies Command', error);
            await interaction.editReply({ 
                content: '❌ An error occurred while initializing rookies. Please check the console logs for details.' 
            });
        }
    }
}

module.exports = AdminCommands;

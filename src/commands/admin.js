// src/commands/admin.js - Updated for your original system with red Marine theme

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Bot administration commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('settings')
                .setDescription('Configure server settings')
                .addChannelOption(option =>
                    option.setName('levelup-channel')
                        .setDescription('Channel for level up announcements')
                        .setRequired(false))
                .addRoleOption(option =>
                    option.setName('excluded-role')
                        .setDescription('Role to exclude from XP gain')
                        .setRequired(false))
                .addNumberOption(option =>
                    option.setName('xp-multiplier')
                        .setDescription('XP multiplier for this server (default: 1.0)')
                        .setMinValue(0.1)
                        .setMaxValue(5.0)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add-xp')
                .setDescription('Add XP to a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to give XP to')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount of XP to add')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for XP adjustment')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove-xp')
                .setDescription('Remove XP from a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to remove XP from')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount of XP to remove')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for XP adjustment')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-level')
                .setDescription('Set a user to a specific level')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to set level for')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('Level to set (0-50)')
                        .setMinValue(0)
                        .setMaxValue(50)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for level adjustment')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset-user')
                .setDescription('Reset all XP and levels for a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to reset')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for reset')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('View server statistics')),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'settings':
                    await this.handleSettings(interaction);
                    break;
                case 'add-xp':
                    await this.handleAddXP(interaction);
                    break;
                case 'remove-xp':
                    await this.handleRemoveXP(interaction);
                    break;
                case 'set-level':
                    await this.handleSetLevel(interaction);
                    break;
                case 'reset-user':
                    await this.handleResetUser(interaction);
                    break;
                case 'stats':
                    await this.handleStats(interaction);
                    break;
                default:
                    await interaction.reply({ content: 'Unknown admin command.', ephemeral: true });
            }

        } catch (error) {
            console.error('Admin command error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ MARINE COMMAND FAILED')
                .setDescription('An error occurred while executing the admin command.')
                .setColor('#DC143C')
                .setTimestamp();

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },

    async handleSettings(interaction) {
        const levelupChannel = interaction.options.getChannel('levelup-channel');
        const excludedRole = interaction.options.getRole('excluded-role');
        const xpMultiplier = interaction.options.getNumber('xp-multiplier');
        const guildId = interaction.guild.id;

        try {
            await interaction.deferReply({ ephemeral: true });

            // Update database
            await global.db.query(`
                INSERT INTO guild_settings (guild_id, levelup_channel, excluded_role, xp_multiplier)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (guild_id)
                DO UPDATE SET
                    levelup_channel = COALESCE($2, guild_settings.levelup_channel),
                    excluded_role = COALESCE($3, guild_settings.excluded_role),
                    xp_multiplier = COALESCE($4, guild_settings.xp_multiplier),
                    updated_at = CURRENT_TIMESTAMP
            `, [guildId, levelupChannel?.id, excludedRole?.id, xpMultiplier]);

            // Update global cache
            const currentSettings = global.guildSettings.get(guildId) || {};
            global.guildSettings.set(guildId, {
                levelupChannel: levelupChannel?.id || currentSettings.levelupChannel,
                excludedRole: excludedRole?.id || currentSettings.excludedRole,
                xpMultiplier: xpMultiplier || currentSettings.xpMultiplier || 1.0
            });

            const embed = new EmbedBuilder()
                .setTitle('🚨 MARINE COMMAND EXECUTED 🚨')
                .setDescription('**MARINE INTELLIGENCE BUREAU - SETTINGS UPDATE**')
                .addFields(
                    { name: '📢 Level-up Channel', value: levelupChannel ? `<#${levelupChannel.id}>` : 'Not changed', inline: true },
                    { name: '👑 Excluded Role', value: excludedRole ? `<@&${excludedRole.id}>` : 'Not changed', inline: true },
                    { name: '⚡ XP Multiplier', value: xpMultiplier ? xpMultiplier.toString() : 'Not changed', inline: true }
                )
                .setColor('#DC143C')
                .setTimestamp()
                .setFooter({ text: '⚓ World Government Marine Intelligence Division' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Settings update error:', error);
            
            const embed = new EmbedBuilder()
                .setTitle('❌ MARINE COMMAND FAILED')
                .setDescription('Failed to update settings. Please try again.')
                .setColor('#DC143C');

            await interaction.editReply({ embeds: [embed] });
        }
    },

    async handleAddXP(interaction) {
        const user = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const reason = interaction.options.getString('reason') || 'Manual adjustment by Marine officer';
        const guildId = interaction.guild.id;

        try {
            await interaction.deferReply({ ephemeral: true });

            // Get current user stats
            const currentStats = await global.db.query(
                'SELECT total_xp, level FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                [user.id, guildId]
            );

            const oldXP = currentStats.rows.length > 0 ? currentStats.rows[0].total_xp : 0;
            const oldLevel = currentStats.rows.length > 0 ? currentStats.rows[0].level : 0;
            const newXP = oldXP + amount;

            // Update or insert user stats
            await global.db.query(`
                INSERT INTO user_levels (user_id, guild_id, total_xp, level)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, guild_id)
                DO UPDATE SET
                    total_xp = user_levels.total_xp + $3,
                    updated_at = CURRENT_TIMESTAMP
            `, [user.id, guildId, amount, 0]);

            // Calculate new level
            const newLevel = this.calculateLevel(newXP);
            
            // Update level in database
            await global.db.query(
                'UPDATE user_levels SET level = $1 WHERE user_id = $2 AND guild_id = $3',
                [newLevel, user.id, guildId]
            );

            // RED Marine admin confirmation embed
            const confirmEmbed = new EmbedBuilder()
                .setColor('#DC143C')
                .setTitle('🚨 MARINE COMMAND EXECUTED 🚨')
                .setDescription(`**MARINE INTELLIGENCE BUREAU - XP MODIFICATION**`)
                .addFields([
                    {
                        name: '👤 SUBJECT',
                        value: `${user}`,
                        inline: true
                    },
                    {
                        name: '📊 XP MODIFICATION',
                        value: `**Added:** ${amount.toLocaleString()} XP\n**New Total:** ${newXP.toLocaleString()} XP\n**Level:** ${oldLevel} → ${newLevel}`,
                        inline: true
                    },
                    {
                        name: '⚓ AUTHORIZED BY',
                        value: `Marine Officer: ${interaction.user.tag}`,
                        inline: false
                    },
                    {
                        name: '

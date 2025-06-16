// src/commands/admin.js
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
                .setTitle('❌ Admin Command Error')
                .setDescription('An error occurred while executing the admin command.')
                .setColor('#FF0000')
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
                .setTitle('✅ Settings Updated')
                .setDescription('Server settings have been updated successfully.')
                .addFields(
                    { name: 'Level-up Channel', value: levelupChannel ? `<#${levelupChannel.id}>` : 'Not changed', inline: true },
                    { name: 'Excluded Role', value: excludedRole ? `<@&${excludedRole.id}>` : 'Not changed', inline: true },
                    { name: 'XP Multiplier', value: xpMultiplier ? xpMultiplier.toString() : 'Not changed', inline: true }
                )
                .setColor('#00FF00')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Settings update error:', error);
            
            const embed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Failed to update settings. Please try again.')
                .setColor('#FF0000');

            await interaction.editReply({ embeds: [embed] });
        }
    },

    async handleAddXP(interaction) {
        const user = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const reason = interaction.options.getString('reason') || 'Manual adjustment by admin';
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

            // Log the action
            console.log(`[ADMIN] ${interaction.user.username} added ${amount} XP to ${user.username}: ${oldXP} → ${newXP}`);

            const embed = new EmbedBuilder()
                .setTitle('✅ XP Added')
                .setDescription(`Successfully added ${amount} XP to ${user.username}`)
                .addFields(
                    { name: 'User', value: `<@${user.id}>`, inline: true },
                    { name: 'XP Added', value: amount.toString(), inline: true },
                    { name: 'New Total XP', value: newXP.toString(), inline: true },
                    { name: 'Old Level', value: oldLevel.toString(), inline: true },
                    { name: 'New Level', value: newLevel.toString(), inline: true },
                    { name: 'Reason', value: reason, inline: false }
                )
                .setColor('#00FF00')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Add XP error:', error);
            
            const embed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Failed to add XP. Please try again.')
                .setColor('#FF0000');

            await interaction.editReply({ embeds: [embed] });
        }
    },

    async handleRemoveXP(interaction) {
        const user = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const reason = interaction.options.getString('reason') || 'Manual adjustment by admin';
        const guildId = interaction.guild.id;

        try {
            await interaction.deferReply({ ephemeral: true });

            // Get current user stats
            const currentStats = await global.db.query(
                'SELECT total_xp, level FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                [user.id, guildId]
            );

            if (currentStats.rows.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ User Not Found')
                    .setDescription(`${user.username} has no XP data in this server.`)
                    .setColor('#FF0000');
                
                return await interaction.editReply({ embeds: [embed] });
            }

            const oldXP = currentStats.rows[0].total_xp;
            const oldLevel = currentStats.rows[0].level;
            const newXP = Math.max(0, oldXP - amount); // Prevent negative XP

            // Update XP
            await global.db.query(
                'UPDATE user_levels SET total_xp = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND guild_id = $3',
                [newXP, user.id, guildId]
            );

            // Calculate new level
            const newLevel = this.calculateLevel(newXP);
            await global.db.query(
                'UPDATE user_levels SET level = $1 WHERE user_id = $2 AND guild_id = $3',
                [newLevel, user.id, guildId]
            );

            // Log the action
            console.log(`[ADMIN] ${interaction.user.username} removed ${amount} XP from ${user.username}: ${oldXP} → ${newXP}`);

            const embed = new EmbedBuilder()
                .setTitle('✅ XP Removed')
                .setDescription(`Successfully removed ${amount} XP from ${user.username}`)
                .addFields(
                    { name: 'User', value: `<@${user.id}>`, inline: true },
                    { name: 'XP Removed', value: amount.toString(), inline: true },
                    { name: 'New Total XP', value: newXP.toString(), inline: true },
                    { name: 'Old Level', value: oldLevel.toString(), inline: true },
                    { name: 'New Level', value: newLevel.toString(), inline: true },
                    { name: 'Reason', value: reason, inline: false }
                )
                .setColor('#00FF00')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Remove XP error:', error);
            
            const embed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Failed to remove XP. Please try again.')
                .setColor('#FF0000');

            await interaction.editReply({ embeds: [embed] });
        }
    },

    async handleSetLevel(interaction) {
        const user = interaction.options.getUser('user');
        const targetLevel = interaction.options.getInteger('level');
        const reason = interaction.options.getString('reason') || 'Manual level set by admin';
        const guildId = interaction.guild.id;

        try {
            await interaction.deferReply({ ephemeral: true });

            // Calculate required XP for target level
            const requiredXP = this.getXPForLevel(targetLevel);

            // Get current stats
            const currentStats = await global.db.query(
                'SELECT total_xp, level FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                [user.id, guildId]
            );

            const oldXP = currentStats.rows.length > 0 ? currentStats.rows[0].total_xp : 0;
            const oldLevel = currentStats.rows.length > 0 ? currentStats.rows[0].level : 0;

            // Update or insert user stats
            await global.db.query(`
                INSERT INTO user_levels (user_id, guild_id, total_xp, level)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, guild_id)
                DO UPDATE SET
                    total_xp = $3,
                    level = $4,
                    updated_at = CURRENT_TIMESTAMP
            `, [user.id, guildId, requiredXP, targetLevel]);

            // Log the action
            console.log(`[ADMIN] ${interaction.user.username} set ${user.username} to level ${targetLevel} (${requiredXP} XP)`);

            const embed = new EmbedBuilder()
                .setTitle('✅ Level Set')
                .setDescription(`Successfully set ${user.username} to level ${targetLevel}`)
                .addFields(
                    { name: 'User', value: `<@${user.id}>`, inline: true },
                    { name: 'Old Level', value: oldLevel.toString(), inline: true },
                    { name: 'New Level', value: targetLevel.toString(), inline: true },
                    { name: 'Old XP', value: oldXP.toString(), inline: true },
                    { name: 'New XP', value: requiredXP.toString(), inline: true },
                    { name: 'Reason', value: reason, inline: false }
                )
                .setColor('#00FF00')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Set level error:', error);
            
            const embed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Failed to set level. Please try again.')
                .setColor('#FF0000');

            await interaction.editReply({ embeds: [embed] });
        }
    },

    async handleResetUser(interaction) {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'User reset by admin';
        const guildId = interaction.guild.id;

        try {
            await interaction.deferReply({ ephemeral: true });

            // Delete user data
            const result = await global.db.query(
                'DELETE FROM user_levels WHERE user_id = $1 AND guild_id = $2 RETURNING *',
                [user.id, guildId]
            );

            if (result.rows.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ User Not Found')
                    .setDescription(`${user.username} has no XP data in this server.`)
                    .setColor('#FF0000');
                
                return await interaction.editReply({ embeds: [embed] });
            }

            // Log the action
            console.log(`[ADMIN] ${interaction.user.username} reset ${user.username}'s data`);

            const embed = new EmbedBuilder()
                .setTitle('✅ User Reset')
                .setDescription(`Successfully reset all data for ${user.username}`)
                .addFields(
                    { name: 'User', value: `<@${user.id}>`, inline: true },
                    { name: 'Previous XP', value: result.rows[0].total_xp.toString(), inline: true },
                    { name: 'Previous Level', value: result.rows[0].level.toString(), inline: true },
                    { name: 'Reason', value: reason, inline: false }
                )
                .setColor('#00FF00')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Reset user error:', error);
            
            const embed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Failed to reset user. Please try again.')
                .setColor('#FF0000');

            await interaction.editReply({ embeds: [embed] });
        }
    },

    async handleStats(interaction) {
        const guildId = interaction.guild.id;

        try {
            await interaction.deferReply({ ephemeral: true });

            // Get server statistics
            const totalUsers = await global.db.query(
                'SELECT COUNT(*) FROM user_levels WHERE guild_id = $1',
                [guildId]
            );

            const totalXP = await global.db.query(
                'SELECT SUM(total_xp) FROM user_levels WHERE guild_id = $1',
                [guildId]
            );

            const totalMessages = await global.db.query(
                'SELECT SUM(messages) FROM user_levels WHERE guild_id = $1',
                [guildId]
            );

            const topUser = await global.db.query(
                'SELECT user_id, total_xp, level FROM user_levels WHERE guild_id = $1 ORDER BY total_xp DESC LIMIT 1',
                [guildId]
            );

            const settings = global.guildSettings.get(guildId) || {};

            const embed = new EmbedBuilder()
                .setTitle('📊 Server Statistics')
                .addFields(
                    { name: 'Total Users', value: totalUsers.rows[0].count || '0', inline: true },
                    { name: 'Total XP', value: (totalXP.rows[0].sum || 0).toLocaleString(), inline: true },
                    { name: 'Total Messages', value: (totalMessages.rows[0].sum || 0).toLocaleString(), inline: true },
                    { name: 'XP Multiplier', value: (settings.xpMultiplier || 1.0).toString(), inline: true },
                    { name: 'Levelup Channel', value: settings.levelupChannel ? `<#${settings.levelupChannel}>` : 'Not set', inline: true },
                    { name: 'Excluded Role', value: settings.excludedRole ? `<@&${settings.excludedRole}>` : 'None', inline: true }
                )
                .setColor('#0099FF')
                .setTimestamp();

            if (topUser.rows.length > 0) {
                embed.addFields({
                    name: 'Top User',
                    value: `<@${topUser.rows[0].user_id}> - Level ${topUser.rows[0].level} (${topUser.rows[0].total_xp.toLocaleString()} XP)`,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Stats error:', error);
            
            const embed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Failed to retrieve statistics. Please try again.')
                .setColor('#FF0000');

            await interaction.editReply({ embeds: [embed] });
        }
    },

    calculateLevel(totalXP) {
        const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
        const curve = process.env.FORMULA_CURVE || 'exponential';
        const maxLevel = parseInt(process.env.MAX_LEVEL) || 50;

        for (let level = 1; level <= maxLevel; level++) {
            let requiredXP;
            
            if (curve === 'exponential') {
                requiredXP = Math.floor(100 * Math.pow(level, multiplier));
            } else if (curve === 'linear') {
                requiredXP = 100 * level * multiplier;
            } else if (curve === 'logarithmic') {
                requiredXP = Math.floor(100 * Math.log(level + 1) * multiplier * 10);
            }

            if (totalXP < requiredXP) {
                return level - 1;
            }
        }

        return maxLevel;
    },

    getXPForLevel(level) {
        const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
        const curve = process.env.FORMULA_CURVE || 'exponential';
        
        if (curve === 'exponential') {
            return Math.floor(100 * Math.pow(level, multiplier));
        } else if (curve === 'linear') {
            return 100 * level * multiplier;
        } else if (curve === 'logarithmic') {
            return Math.floor(100 * Math.log(level + 1) * multiplier * 10);
        }
        
        return Math.floor(100 * Math.pow(level, multiplier));
    }
};

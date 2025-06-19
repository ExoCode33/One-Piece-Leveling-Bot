// src/commands/admin.js - Updated with XP logging for admin actions

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

    async handleSettings(interaction) {
        const levelupChannel = interaction.options.getChannel('levelup-channel');
        const excludedRole = interaction.options.getRole('excluded-role');
        const xpMultiplier = interaction.options.getNumber('xp-multiplier');
        const guildId = interaction.guild.id;

        try {
            await interaction.deferReply({ ephemeral: true });

            // Get XP tracker and database
            const xpTracker = global.xpTracker;
            if (!xpTracker || !xpTracker.db) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ MARINE COMMAND FAILED')
                    .setDescription('XP Tracker not initialized.')
                    .setColor('#DC143C');
                return await interaction.editReply({ embeds: [embed] });
            }

            // Update database
            await xpTracker.db.query(`
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
            const currentSettings = global.guildSettings?.get(guildId) || {};
            global.guildSettings = global.guildSettings || new Map();
            global.guildSettings.set(guildId, {
                ...currentSettings,
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

            // Get XP tracker
            const xpTracker = global.xpTracker;
            if (!xpTracker || !xpTracker.db) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ MARINE COMMAND FAILED')
                    .setDescription('XP Tracker not initialized.')
                    .setColor('#DC143C');
                return await interaction.editReply({ embeds: [embed] });
            }

            // Get current user stats
            const currentStats = await xpTracker.db.query(
                'SELECT total_xp, level FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                [user.id, guildId]
            );

            const oldXP = currentStats.rows.length > 0 ? currentStats.rows[0].total_xp : 0;
            const oldLevel = currentStats.rows.length > 0 ? currentStats.rows[0].level : 0;
            const newXP = oldXP + amount;

            // Update or insert user stats
            await xpTracker.db.query(`
                INSERT INTO user_levels (user_id, guild_id, total_xp, level)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, guild_id)
                DO UPDATE SET
                    total_xp = user_levels.total_xp + $3,
                    updated_at = CURRENT_TIMESTAMP
            `, [user.id, guildId, amount, oldLevel]);

            // Calculate new level
            const newLevel = this.calculateLevel(newXP);
            
            // Update level in database
            await xpTracker.db.query(
                'UPDATE user_levels SET level = $1 WHERE user_id = $2 AND guild_id = $3',
                [newLevel, user.id, guildId]
            );

            // Log admin XP adjustment
            await xpTracker.logXPActivity('admin', user, guildId, amount, {
                adminUser: interaction.user,
                reason,
                totalXP: newXP,
                currentLevel: newLevel
            });

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
                        name: '📝 REASON',
                        value: reason,
                        inline: false
                    }
                ])
                .setTimestamp()
                .setFooter({ text: '⚓ World Government Marine Intelligence Division' });

            await interaction.editReply({ embeds: [confirmEmbed] });

            // FIXED: Check if user leveled up and trigger Marine level-up for EVERY level
            if (newLevel > oldLevel) {
                console.log(`[ADMIN] User ${user.username} gained ${newLevel - oldLevel} levels from admin command`);
                
                // Announce each level individually
                for (let level = oldLevel + 1; level <= newLevel; level++) {
                    const levelXP = xpTracker.getXPForLevel(level);
                    await xpTracker.handleLevelUp(user.id, guildId, level - 1, level, levelXP - 100, levelXP, user);
                    
                    // Small delay between announcements
                    if (level < newLevel) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }

            // Log the action
            console.log(`[ADMIN] ${interaction.user.username} added ${amount} XP to ${user.username}: ${oldXP} → ${newXP}`);

        } catch (error) {
            console.error('Add XP error:', error);
            
            const embed = new EmbedBuilder()
                .setTitle('❌ MARINE COMMAND FAILED')
                .setDescription('Failed to add XP. Please try again.')
                .setColor('#DC143C');

            await interaction.editReply({ embeds: [embed] });
        }
    },

    async handleRemoveXP(interaction) {
        const user = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const reason = interaction.options.getString('reason') || 'Disciplinary action by Marine officer';
        const guildId = interaction.guild.id;

        try {
            await interaction.deferReply({ ephemeral: true });

            // Get XP tracker
            const xpTracker = global.xpTracker;
            if (!xpTracker || !xpTracker.db) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ MARINE COMMAND FAILED')
                    .setDescription('XP Tracker not initialized.')
                    .setColor('#DC143C');
                return await interaction.editReply({ embeds: [embed] });
            }

            // Get current user stats
            const currentStats = await xpTracker.db.query(
                'SELECT total_xp, level FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                [user.id, guildId]
            );

            if (currentStats.rows.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ MARINE INTELLIGENCE ERROR')
                    .setDescription(`${user.username} has no criminal record in this server.`)
                    .setColor('#DC143C');
                
                return await interaction.editReply({ embeds: [embed] });
            }

            const oldXP = currentStats.rows[0].total_xp;
            const oldLevel = currentStats.rows[0].level;
            const newXP = Math.max(0, oldXP - amount); // Prevent negative XP

            // Update XP
            await xpTracker.db.query(
                'UPDATE user_levels SET total_xp = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND guild_id = $3',
                [newXP, user.id, guildId]
            );

            // Calculate new level
            const newLevel = this.calculateLevel(newXP);
            await xpTracker.db.query(
                'UPDATE user_levels SET level = $1 WHERE user_id = $2 AND guild_id = $3',
                [newLevel, user.id, guildId]
            );

            // Log admin XP removal
            await xpTracker.logXPActivity('admin', user, guildId, -amount, {
                adminUser: interaction.user,
                reason,
                totalXP: newXP,
                currentLevel: newLevel
            });

            const embed = new EmbedBuilder()
                .setTitle('🚨 MARINE DISCIPLINARY ACTION 🚨')
                .setDescription(`**MARINE INTELLIGENCE BUREAU - XP REDUCTION**`)
                .addFields([
                    {
                        name: '👤 SUBJECT',
                        value: `${user}`,
                        inline: true
                    },
                    {
                        name: '📊 XP MODIFICATION',
                        value: `**Removed:** ${amount.toLocaleString()} XP\n**New Total:** ${newXP.toLocaleString()} XP\n**Level:** ${oldLevel} → ${newLevel}`,
                        inline: true
                    },
                    {
                        name: '⚓ AUTHORIZED BY',
                        value: `Marine Officer: ${interaction.user.tag}`,
                        inline: false
                    },
                    {
                        name: '📝 REASON',
                        value: reason,
                        inline: false
                    }
                ])
                .setColor('#DC143C')
                .setTimestamp()
                .setFooter({ text: '⚓ World Government Marine Intelligence Division' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Remove XP error:', error);
            
            const embed = new EmbedBuilder()
                .setTitle('❌ MARINE COMMAND FAILED')
                .setDescription('Failed to remove XP. Please try again.')
                .setColor('#DC143C');

            await interaction.editReply({ embeds: [embed] });
        }
    },

    async handleSetLevel(interaction) {
        const user = interaction.options.getUser('user');
        const targetLevel = interaction.options.getInteger('level');
        const reason = interaction.options.getString('reason') || 'Manual level adjustment by Marine officer';
        const guildId = interaction.guild.id;

        try {
            await interaction.deferReply({ ephemeral: true });

            // Get XP tracker
            const xpTracker = global.xpTracker;
            if (!xpTracker || !xpTracker.db) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ MARINE COMMAND FAILED')
                    .setDescription('XP Tracker not initialized.')
                    .setColor('#DC143C');
                return await interaction.editReply({ embeds: [embed] });
            }

            // Calculate required XP for target level
            const requiredXP = this.getXPForLevel(targetLevel);

            // Get current stats
            const currentStats = await xpTracker.db.query(
                'SELECT total_xp, level FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                [user.id, guildId]
            );

            const oldXP = currentStats.rows.length > 0 ? currentStats.rows[0].total_xp : 0;
            const oldLevel = currentStats.rows.length > 0 ? currentStats.rows[0].level : 0;
            const xpDifference = requiredXP - oldXP;

            // Update or insert user stats
            await xpTracker.db.query(`
                INSERT INTO user_levels (user_id, guild_id, total_xp, level)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, guild_id)
                DO UPDATE SET
                    total_xp = $3,
                    level = $4,
                    updated_at = CURRENT_TIMESTAMP
            `, [user.id, guildId, requiredXP, targetLevel]);

            // Log admin level set
            await xpTracker.logXPActivity('admin', user, guildId, xpDifference, {
                adminUser: interaction.user,
                reason: `${reason} (Set to Level ${targetLevel})`,
                totalXP: requiredXP,
                currentLevel: targetLevel
            });

            const embed = new EmbedBuilder()
                .setTitle('🚨 MARINE RANK ADJUSTMENT 🚨')
                .setDescription(`**MARINE INTELLIGENCE BUREAU - LEVEL OVERRIDE**`)
                .addFields([
                    {
                        name: '👤 SUBJECT',
                        value: `${user}`,
                        inline: true
                    },
                    {
                        name: '📊 RANK CHANGE',
                        value: `**Level:** ${oldLevel} → ${targetLevel}\n**Total XP:** ${requiredXP.toLocaleString()}`,
                        inline: true
                    },
                    {
                        name: '⚓ AUTHORIZED BY',
                        value: `Marine Officer: ${interaction.user.tag}`,
                        inline: false
                    },
                    {
                        name: '📝 REASON',
                        value: reason,
                        inline: false
                    }
                ])
                .setColor('#DC143C')
                .setTimestamp()
                .setFooter({ text: '⚓ World Government Marine Intelligence Division' });

            await interaction.editReply({ embeds: [embed] });

            // FIXED: Trigger Marine level-up for EVERY level gained
            if (targetLevel > oldLevel) {
                console.log(`[ADMIN] User ${user.username} set to level ${targetLevel} from ${oldLevel}`);
                
                // Announce each level individually
                for (let level = oldLevel + 1; level <= targetLevel; level++) {
                    const levelXP = xpTracker.getXPForLevel(level);
                    await xpTracker.handleLevelUp(user.id, guildId, level - 1, level, levelXP - 100, levelXP, user);
                    
                    // Small delay between announcements
                    if (level < targetLevel) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }

        } catch (error) {
            console.error('Set level error:', error);
            
            const embed = new EmbedBuilder()
                .setTitle('❌ MARINE COMMAND FAILED')
                .setDescription('Failed to set level. Please try again.')
                .setColor('#DC143C');

            await interaction.editReply({ embeds: [embed] });
        }
    },

    async handleResetUser(interaction) {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'Data purge by Marine officer';
        const guildId = interaction.guild.id;

        try {
            await interaction.deferReply({ ephemeral: true });

            // Get XP tracker
            const xpTracker = global.xpTracker;
            if (!xpTracker || !xpTracker.db) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ MARINE COMMAND FAILED')
                    .setDescription('XP Tracker not initialized.')
                    .setColor('#DC143C');
                return await interaction.editReply({ embeds: [embed] });
            }

            // Get current stats before deletion for logging
            const currentStats = await xpTracker.db.query(
                'SELECT total_xp, level FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                [user.id, guildId]
            );

            // Delete user data
            const result = await xpTracker.db.query(
                'DELETE FROM user_levels WHERE user_id = $1 AND guild_id = $2 RETURNING *',
                [user.id, guildId]
            );

            if (result.rows.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ MARINE INTELLIGENCE ERROR')
                    .setDescription(`${user.username} has no criminal record in this server.`)
                    .setColor('#DC143C');
                
                return await interaction.editReply({ embeds: [embed] });
            }

            // Log admin reset
            const oldXP = currentStats.rows.length > 0 ? currentStats.rows[0].total_xp : 0;
            await xpTracker.logXPActivity('admin', user, guildId, -oldXP, {
                adminUser: interaction.user,
                reason: `${reason} (Complete Reset)`,
                totalXP: 0,
                currentLevel: 0
            });

            const embed = new EmbedBuilder()
                .setTitle('🚨 MARINE DATA PURGE 🚨')
                .setDescription(`**MARINE INTELLIGENCE BUREAU - COMPLETE RESET**`)
                .addFields([
                    {
                        name: '👤 SUBJECT',
                        value: `${user}`,
                        inline: true
                    },
                    {
                        name: '🔄 RESET COMPLETE',
                        value: `**Previous Level:** ${result.rows[0].level}\n**Previous XP:** ${result.rows[0].total_xp.toLocaleString()}\n**All activity stats cleared**`,
                        inline: true
                    },
                    {
                        name: '⚓ AUTHORIZED BY',
                        value: `Marine Officer: ${interaction.user.tag}`,
                        inline: false
                    },
                    {
                        name: '📝 REASON',
                        value: reason,
                        inline: false
                    }
                ])
                .setColor('#DC143C')
                .setTimestamp()
                .setFooter({ text: '⚓ World Government Marine Intelligence Division' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Reset user error:', error);
            
            const embed = new EmbedBuilder()
                .setTitle('❌ MARINE COMMAND FAILED')
                .setDescription('Failed to reset user. Please try again.')
                .setColor('#DC143C');

            await interaction.editReply({ embeds: [embed] });
        }
    },

    async handleStats(interaction) {
        const guildId = interaction.guild.id;

        try {
            await interaction.deferReply({ ephemeral: true });

            // Get XP tracker
            const xpTracker = global.xpTracker;
            if (!xpTracker || !xpTracker.db) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ MARINE COMMAND FAILED')
                    .setDescription('XP Tracker not initialized.')
                    .setColor('#DC143C');
                return await interaction.editReply({ embeds: [embed] });
            }

            // Get server statistics
            const totalUsers = await xpTracker.db.query(
                'SELECT COUNT(*) FROM user_levels WHERE guild_id = $1',
                [guildId]
            );

            const totalXP = await xpTracker.db.query(
                'SELECT SUM(total_xp) FROM user_levels WHERE guild_id = $1',
                [guildId]
            );

            const totalMessages = await xpTracker.db.query(
                'SELECT SUM(messages) FROM user_levels WHERE guild_id = $1',
                [guildId]
            );

            const topUser = await xpTracker.db.query(
                'SELECT user_id, total_xp, level FROM user_levels WHERE guild_id = $1 ORDER BY total_xp DESC LIMIT 1',
                [guildId]
            );

            const settings = global.guildSettings?.get(guildId) || {};

            const embed = new EmbedBuilder()
                .setTitle('🚨 MARINE INTELLIGENCE REPORT 🚨')
                .setDescription(`**SURVEILLANCE DATA - ${interaction.guild.name}**`)
                .addFields([
                    { name: '👥 Total Subjects', value: totalUsers.rows[0].count || '0', inline: true },
                    { name: '📊 Total XP', value: (totalXP.rows[0].sum || 0).toLocaleString(), inline: true },
                    { name: '💬 Total Messages', value: (totalMessages.rows[0].sum || 0).toLocaleString(), inline: true },
                    { name: '⚡ XP Multiplier', value: (settings.xpMultiplier || 1.0).toString(), inline: true },
                    { name: '📢 Levelup Channel', value: settings.levelupChannel ? `<#${settings.levelupChannel}>` : 'Not set', inline: true },
                    { name: '👑 Excluded Role', value: settings.excludedRole ? `<@&${settings.excludedRole}>` : 'None', inline: true }
                ])
                .setColor('#DC143C')
                .setTimestamp()
                .setFooter({ text: '⚓ World Government Marine Intelligence Division' });

            if (topUser.rows.length > 0) {
                embed.addFields({
                    name: '🎯 Highest Threat',
                    value: `<@${topUser.rows[0].user_id}> - Level ${topUser.rows[0].level} (${topUser.rows[0].total_xp.toLocaleString()} XP)`,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Stats error:', error);
            
            const embed = new EmbedBuilder()
                .setTitle('❌ MARINE COMMAND FAILED')
                .setDescription('Failed to retrieve statistics. Please try again.')
                .setColor('#DC143C');

            await interaction.editReply({ embeds: [embed] });
        }
    },

// src/commands/admin.js - Complete admin command with dropdown options and proper permissions

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('⚓ Marine Command Center - XP Management (Administrator only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option
                .setName('action')
                .setDescription('What action would you like to perform?')
                .setRequired(true)
                .addChoices(
                    { name: '📈 Add XP to User', value: 'add-xp' },
                    { name: '📉 Remove XP from User', value: 'remove-xp' },
                    { name: '🔄 Set User XP Total', value: 'set-xp' },
                    { name: '🗑️ Reset User Completely', value: 'reset-user' },
                    { name: '📊 View User Stats', value: 'stats' }
                )
        )
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to perform the action on')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('XP amount (for add/remove/set actions)')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(100000)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for this action')
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            // Double-check administrator permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.reply({
                    content: '❌ **Access Denied**\n\n⚓ **Marine Command Center** requires **Administrator** permissions.\n\nOnly high-ranking Marine officers may access these commands.',
                    ephemeral: true
                });
            }

            const action = interaction.options.getString('action');
            const targetUser = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            const reason = interaction.options.getString('reason') || 'No reason specified';

            // Prevent targeting bots
            if (targetUser && targetUser.bot) {
                return await interaction.reply({
                    content: '❌ **Invalid Target**\n\nCannot modify XP for bot accounts.',
                    ephemeral: true
                });
            }

            switch (action) {
                case 'add-xp':
                    if (!amount || amount < 1 || amount > 10000) {
                        return await interaction.reply({
                            content: '❌ **Invalid Amount**\n\nPlease specify an amount between 1 and 10,000 XP.',
                            ephemeral: true
                        });
                    }
                    await this.handleAddXP(interaction, targetUser, amount, reason);
                    break;

                case 'remove-xp':
                    if (!amount || amount < 1 || amount > 10000) {
                        return await interaction.reply({
                            content: '❌ **Invalid Amount**\n\nPlease specify an amount between 1 and 10,000 XP.',
                            ephemeral: true
                        });
                    }
                    await this.handleRemoveXP(interaction, targetUser, amount, reason);
                    break;

                case 'set-xp':
                    if (amount === null || amount < 0 || amount > 100000) {
                        return await interaction.reply({
                            content: '❌ **Invalid Amount**\n\nPlease specify an amount between 0 and 100,000 XP.',
                            ephemeral: true
                        });
                    }
                    await this.handleSetXP(interaction, targetUser, amount, reason);
                    break;

                case 'reset-user':
                    await this.handleResetUser(interaction, targetUser, reason);
                    break;

                case 'stats':
                    await this.handleStats(interaction, targetUser);
                    break;

                default:
                    return await interaction.reply({
                        content: '❌ **Unknown Action**\n\nPlease use a valid action from the dropdown.',
                        ephemeral: true
                    });
            }

        } catch (error) {
            console.error('Admin command error:', error);
            
            if (!interaction.replied) {
                return await interaction.reply({
                    content: '❌ **Command Failed**\n\nAn error occurred while executing the admin command. Please try again.',
                    ephemeral: true
                });
            }
        }
    },

    async handleAddXP(interaction, targetUser, amount, reason) {
        try {
            await interaction.deferReply();

            if (!global.xpTracker) {
                return await interaction.editReply({
                    content: '❌ **System Error**\n\nXP tracking system is not available.'
                });
            }

            // Get current user stats
            const currentStats = await global.xpTracker.getUserStats(targetUser.id, interaction.guild.id);
            const oldLevel = currentStats?.level || 0;
            const oldTotalXP = currentStats?.total_xp || 0;

            // Award XP using the admin source
            await global.xpTracker.awardXP(targetUser.id, interaction.guild.id, amount, 'admin', targetUser);

            // Get updated stats
            const updatedStats = await global.xpTracker.getUserStats(targetUser.id, interaction.guild.id);
            const newLevel = updatedStats?.level || 0;
            const newTotalXP = updatedStats?.total_xp || 0;

            // Log admin action
            await global.xpTracker.logXPActivity('admin', targetUser, interaction.guild.id, amount, {
                adminUser: interaction.user,
                reason,
                totalXP: newTotalXP,
                currentLevel: newLevel
            });

            // Create response embed
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('⚓ MARINE COMMAND CENTER')
                .setDescription('**XP AWARDED SUCCESSFULLY**')
                .addFields(
                    {
                        name: '🎯 Target',
                        value: `${targetUser.username} (${targetUser.id})`,
                        inline: true
                    },
                    {
                        name: '📈 XP Change',
                        value: `+${amount.toLocaleString()} XP`,
                        inline: true
                    },
                    {
                        name: '📊 Results',
                        value: `**Before:** ${oldTotalXP.toLocaleString()} XP (Level ${oldLevel})\n**After:** ${newTotalXP.toLocaleString()} XP (Level ${newLevel})`,
                        inline: false
                    },
                    {
                        name: '📝 Reason',
                        value: reason,
                        inline: false
                    }
                )
                .setFooter({ text: `⚓ Authorized by ${interaction.user.username} • Marine Intelligence` })
                .setTimestamp();

            // Add level up notification if level changed
            if (newLevel > oldLevel) {
                embed.addFields({
                    name: '🚨 Level Up Detected',
                    value: `${targetUser.username} gained ${newLevel - oldLevel} level(s)! Check announcements for bounty updates.`,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Add XP error:', error);
            await interaction.editReply({
                content: '❌ **Operation Failed**\n\nFailed to award XP. Please try again.'
            });
        }
    },

    async handleRemoveXP(interaction, targetUser, amount, reason) {
        try {
            await interaction.deferReply();

            if (!global.xpTracker) {
                return await interaction.editReply({
                    content: '❌ **System Error**\n\nXP tracking system is not available.'
                });
            }

            // Get current user stats
            const currentStats = await global.xpTracker.getUserStats(targetUser.id, interaction.guild.id);
            if (!currentStats) {
                return await interaction.editReply({
                    content: '❌ **User Not Found**\n\nThis user has no XP data in this server.'
                });
            }

            const oldLevel = currentStats.level;
            const oldTotalXP = currentStats.total_xp;

            // Remove XP by awarding negative amount
            await global.xpTracker.awardXP(targetUser.id, interaction.guild.id, -amount, 'admin', targetUser);

            // Get updated stats
            const updatedStats = await global.xpTracker.getUserStats(targetUser.id, interaction.guild.id);
            const newLevel = updatedStats?.level || 0;
            const newTotalXP = updatedStats?.total_xp || 0;

            // Log admin action
            await global.xpTracker.logXPActivity('admin', targetUser, interaction.guild.id, -amount, {
                adminUser: interaction.user,
                reason,
                totalXP: newTotalXP,
                currentLevel: newLevel
            });

            // Create response embed
            const embed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('⚓ MARINE COMMAND CENTER')
                .setDescription('**XP REMOVED SUCCESSFULLY**')
                .addFields(
                    {
                        name: '🎯 Target',
                        value: `${targetUser.username} (${targetUser.id})`,
                        inline: true
                    },
                    {
                        name: '📉 XP Change',
                        value: `-${amount.toLocaleString()} XP`,
                        inline: true
                    },
                    {
                        name: '📊 Results',
                        value: `**Before:** ${oldTotalXP.toLocaleString()} XP (Level ${oldLevel})\n**After:** ${newTotalXP.toLocaleString()} XP (Level ${newLevel})`,
                        inline: false
                    },
                    {
                        name: '📝 Reason',
                        value: reason,
                        inline: false
                    }
                )
                .setFooter({ text: `⚓ Authorized by ${interaction.user.username} • Marine Intelligence` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Remove XP error:', error);
            await interaction.editReply({
                content: '❌ **Operation Failed**\n\nFailed to remove XP. Please try again.'
            });
        }
    },

    async handleSetXP(interaction, targetUser, amount, reason) {
        try {
            await interaction.deferReply();

            if (!global.xpTracker || !global.xpTracker.db) {
                return await interaction.editReply({
                    content: '❌ **System Error**\n\nXP tracking system is not available.'
                });
            }

            // Get current stats
            const currentStats = await global.xpTracker.getUserStats(targetUser.id, interaction.guild.id);
            const oldLevel = currentStats?.level || 0;
            const oldTotalXP = currentStats?.total_xp || 0;

            // Calculate new level
            const newLevel = global.xpTracker.calculateLevel(amount);

            // Set XP directly in database
            await global.xpTracker.db.query(`
                INSERT INTO user_levels (user_id, guild_id, total_xp, level, messages, reactions, voice_time)
                VALUES ($1, $2, $3, $4, 0, 0, 0)
                ON CONFLICT (user_id, guild_id)
                DO UPDATE SET
                    total_xp = $3,
                    level = $4,
                    updated_at = CURRENT_TIMESTAMP
            `, [targetUser.id, interaction.guild.id, amount, newLevel]);

            // Log admin action
            await global.xpTracker.logXPActivity('admin', targetUser, interaction.guild.id, amount - oldTotalXP, {
                adminUser: interaction.user,
                reason: `Set XP to ${amount.toLocaleString()} (${reason})`,
                totalXP: amount,
                currentLevel: newLevel
            });

            // Create response embed
            const embed = new EmbedBuilder()
                .setColor('#4A90E2')
                .setTitle('⚓ MARINE COMMAND CENTER')
                .setDescription('**XP SET SUCCESSFULLY**')
                .addFields(
                    {
                        name: '🎯 Target',
                        value: `${targetUser.username} (${targetUser.id})`,
                        inline: true
                    },
                    {
                        name: '🔄 XP Change',
                        value: `Set to ${amount.toLocaleString()} XP`,
                        inline: true
                    },
                    {
                        name: '📊 Results',
                        value: `**Before:** ${oldTotalXP.toLocaleString()} XP (Level ${oldLevel})\n**After:** ${amount.toLocaleString()} XP (Level ${newLevel})`,
                        inline: false
                    },
                    {
                        name: '📝 Reason',
                        value: reason,
                        inline: false
                    }
                )
                .setFooter({ text: `⚓ Authorized by ${interaction.user.username} • Marine Intelligence` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Set XP error:', error);
            await interaction.editReply({
                content: '❌ **Operation Failed**\n\nFailed to set XP. Please try again.'
            });
        }
    },

    async handleResetUser(interaction, targetUser, reason) {
        try {
            await interaction.deferReply();

            if (!global.xpTracker || !global.xpTracker.db) {
                return await interaction.editReply({
                    content: '❌ **System Error**\n\nXP tracking system is not available.'
                });
            }

            // Get current stats before reset
            const currentStats = await global.xpTracker.getUserStats(targetUser.id, interaction.guild.id);
            const oldLevel = currentStats?.level || 0;
            const oldTotalXP = currentStats?.total_xp || 0;

            // Reset user data
            await global.xpTracker.db.query(
                'DELETE FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                [targetUser.id, interaction.guild.id]
            );

            // Log admin action
            await global.xpTracker.logXPActivity('admin', targetUser, interaction.guild.id, -oldTotalXP, {
                adminUser: interaction.user,
                reason: `User reset (${reason})`,
                totalXP: 0,
                currentLevel: 0
            });

            // Create response embed
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('⚓ MARINE COMMAND CENTER')
                .setDescription('**USER RESET SUCCESSFULLY**')
                .addFields(
                    {
                        name: '🎯 Target',
                        value: `${targetUser.username} (${targetUser.id})`,
                        inline: true
                    },
                    {
                        name: '🔄 Action',
                        value: 'Complete Reset',
                        inline: true
                    },
                    {
                        name: '📊 Previous Data',
                        value: `**XP:** ${oldTotalXP.toLocaleString()}\n**Level:** ${oldLevel}`,
                        inline: false
                    },
                    {
                        name: '📝 Reason',
                        value: reason,
                        inline: false
                    }
                )
                .setFooter({ text: `⚓ Authorized by ${interaction.user.username} • Marine Intelligence` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Reset user error:', error);
            await interaction.editReply({
                content: '❌ **Operation Failed**\n\nFailed to reset user. Please try again.'
            });
        }
    },

    async handleStats(interaction, targetUser) {
        try {
            await interaction.deferReply();

            if (!global.xpTracker) {
                return await interaction.editReply({
                    content: '❌ **System Error**\n\nXP tracking system is not available.'
                });
            }

            // Get user stats
            const userStats = await global.xpTracker.getUserStats(targetUser.id, interaction.guild.id);
            if (!userStats) {
                return await interaction.editReply({
                    content: '❌ **No Data Found**\n\nThis user has no XP data in this server.'
                });
            }

            // Get user rank
            const rank = await global.xpTracker.getUserRank(targetUser.id, interaction.guild.id);

            // Calculate bounty
            const { getBountyForLevel } = require('../utils/bountySystem');
            const bounty = getBountyForLevel(userStats.level);

            // Create detailed stats embed
            const embed = new EmbedBuilder()
                .setColor('#4A90E2')
                .setTitle('⚓ MARINE INTELLIGENCE DOSSIER')
                .setDescription(`**${targetUser.username}** • Detailed Criminal Profile`)
                .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
                .addFields(
                    {
                        name: '🎯 Subject Information',
                        value: `**User ID:** ${targetUser.id}\n**Rank:** #${rank || 'Unknown'}\n**Bounty:** ฿${bounty.toLocaleString()}`,
                        inline: false
                    },
                    {
                        name: '📊 Criminal Activity',
                        value: `**Total XP:** ${userStats.total_xp.toLocaleString()}\n**Current Level:** ${userStats.level}\n**Next Level XP:** ${global.xpTracker.getXPForLevel(userStats.level + 1).toLocaleString()}`,
                        inline: true
                    },
                    {
                        name: '📈 Activity Breakdown',
                        value: `**Messages:** ${userStats.messages.toLocaleString()}\n**Reactions:** ${userStats.reactions.toLocaleString()}\n**Voice Time:** ${userStats.voice_time.toLocaleString()} minutes`,
                        inline: true
                    },
                    {
                        name: '📅 Timeline',
                        value: `**First Seen:** ${new Date(userStats.created_at).toLocaleDateString()}\n**Last Active:** ${new Date(userStats.updated_at).toLocaleDateString()}`,
                        inline: false
                    }
                )
                .setFooter({ text: `⚓ Marine Intelligence • Dossier compiled by ${interaction.user.username}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Stats error:', error);
            await interaction.editReply({
                content: '❌ **Operation Failed**\n\nFailed to retrieve user stats. Please try again.'
            });
        }
    }
};

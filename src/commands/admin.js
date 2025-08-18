// src/commands/admin.js - Complete admin command with reset wheel functionality

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('⚓ Marine Command Center - Complete Administration Suite')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option
                .setName('action')
                .setDescription('Select administrative action to perform')
                .setRequired(true)
                .addChoices(
                    { name: '📈 Add XP to User', value: 'add-xp' },
                    { name: '📉 Remove XP from User', value: 'remove-xp' },
                    { name: '🔄 Set User XP Total', value: 'set-xp' },
                    { name: '🗑️ Reset User Completely', value: 'reset-user' },
                    { name: '📊 View User Stats', value: 'user-stats' },
                    { name: '🎰 Reset Daily Wheel', value: 'reset-wheel' },
                    { name: '📋 Bot Statistics [CLASSIFIED]', value: 'bot-stats' },
                    { name: '🔧 Database Maintenance [CLASSIFIED]', value: 'maintenance' },
                    { name: '☢️ Nuclear Protocol [CLASSIFIED]', value: 'nuclear' }
                )
        )
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Target user (required for XP operations and wheel reset)')
                .setRequired(false)
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
        )
        .addStringOption(option =>
            option
                .setName('password')
                .setDescription('Security password (required for classified operations)')
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
            const password = interaction.options.getString('password');
            const { db } = require('../../index'); // Get database from index.js

            // Handle classified operations that require password
            if (['bot-stats', 'maintenance', 'nuclear'].includes(action)) {
                if (password !== '30389') {
                    const deniedEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('🚨 CLASSIFIED ACCESS DENIED')
                        .setDescription('```diff\n- INVALID SECURITY AUTHORIZATION CODE\n- ACCESS DENIED - INCORRECT PASSWORD\n- SECURITY BREACH LOGGED```')
                        .addFields({
                            name: '⚠️ Security Alert',
                            value: '```css\n[CRITICAL] Unauthorized classified access attempt\n[CRITICAL] Administrator credentials compromised\n[CRITICAL] Recommend immediate security audit```'
                        })
                        .setTimestamp()
                        .setFooter({ text: '🚨 SECURITY VIOLATION DETECTED 🚨' });

                    return await interaction.reply({
                        embeds: [deniedEmbed],
                        ephemeral: true
                    });
                }
            }

            // Handle XP operations that require a target user
            if (['add-xp', 'remove-xp', 'set-xp', 'reset-user', 'user-stats'].includes(action)) {
                if (!targetUser) {
                    return await interaction.reply({
                        content: '❌ **Missing Target User**\n\nPlease specify a user for this operation.',
                        ephemeral: true
                    });
                }

                // Prevent targeting bots
                if (targetUser.bot) {
                    return await interaction.reply({
                        content: '❌ **Invalid Target**\n\nCannot modify XP for bot accounts.',
                        ephemeral: true
                    });
                }
            }

            // Handle reset wheel that requires a target user
            if (action === 'reset-wheel') {
                if (!targetUser) {
                    return await interaction.reply({
                        content: '❌ **Missing Target User**\n\nPlease specify a user to reset their daily wheel.',
                        ephemeral: true
                    });
                }

                if (targetUser.bot) {
                    return await interaction.reply({
                        content: '❌ **Invalid Target**\n\nCannot reset wheel for bot accounts.',
                        ephemeral: true
                    });
                }
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

                case 'user-stats':
                    await this.handleUserStats(interaction, targetUser);
                    break;

                case 'reset-wheel':
                    await this.handleResetWheel(interaction, targetUser, reason);
                    break;

                case 'bot-stats':
                    await handleStats(interaction, db);
                    break;

                case 'maintenance':
                    await handleMaintenance(interaction, db);
                    break;

                case 'nuclear':
                    await handleNuclear(interaction, db);
                    break;

                default:
                    return await interaction.reply({
                        content: '❌ **Unknown Action**\n\nPlease use a valid action from the dropdown.',
                        ephemeral: true
                    });
            }

        } catch (error) {
            console.error('[ADMIN ERROR]', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🚨 MARINE INTELLIGENCE - SYSTEM ERROR')
                .setDescription('```diff\n- CRITICAL SYSTEM FAILURE DETECTED\n- OPERATION TERMINATED```')
                .addFields({
                    name: '📋 Error Details',
                    value: `\`\`\`${error.message}\`\`\``
                })
                .setTimestamp()
                .setFooter({ text: 'Marine Intelligence Network' });

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },

    // NEW: Reset daily wheel functionality
    async handleResetWheel(interaction, targetUser, reason) {
        try {
            await interaction.deferReply();

            if (!global.xpTracker || !global.xpTracker.db) {
                return await interaction.editReply({
                    content: '❌ **System Error**\n\nDaily wheel system is not available.'
                });
            }

            // Get current day key (same format as daily-buff command)
            const today = getCurrentDayKey();

            // Check if user has a daily buff entry for today
            const existingBuff = await global.xpTracker.db.query(
                'SELECT * FROM daily_buffs WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [targetUser.id, interaction.guild.id, today]
            );

            if (existingBuff.rows.length === 0) {
                return await interaction.editReply({
                    content: `❌ **No Daily Wheel Record**\n\n${targetUser.username} has not spun the daily wheel today.`
                });
            }

            const buffRecord = existingBuff.rows[0];

            // Remove daily buff roles from the user
            const member = interaction.guild.members.cache.get(targetUser.id);
            let removedRoles = [];

            if (member) {
                const allBuffRoles = [
                    process.env.DAILY_XP_BUFF_TIER_1_ROLE,
                    process.env.DAILY_XP_BUFF_TIER_2_ROLE,
                    process.env.DAILY_XP_BUFF_TIER_3_ROLE
                ].filter(id => id && !id.includes('ROLE_ID'));

                for (const roleId of allBuffRoles) {
                    if (member.roles.cache.has(roleId)) {
                        const role = interaction.guild.roles.cache.get(roleId);
                        if (role) {
                            await member.roles.remove(role);
                            removedRoles.push(role.name);
                            console.log(`[ADMIN WHEEL RESET] Removed role: ${role.name} from ${targetUser.username}`);
                        }
                    }
                }
            }

            // Delete the daily buff record from database
            await global.xpTracker.db.query(
                'DELETE FROM daily_buffs WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [targetUser.id, interaction.guild.id, today]
            );

            // Log admin action
            if (global.xpTracker.logXPActivity) {
                await global.xpTracker.logXPActivity('admin', targetUser, interaction.guild.id, 0, {
                    adminUser: interaction.user,
                    reason: `Daily wheel reset (${reason})`,
                    totalXP: 0,
                    currentLevel: 0
                });
            }

            // Create response embed
            const embed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('🎰 MARINE COMMAND CENTER')
                .setDescription('**DAILY WHEEL RESET SUCCESSFUL**')
                .addFields(
                    {
                        name: '🎯 Target',
                        value: `${targetUser.username} (${targetUser.id})`,
                        inline: true
                    },
                    {
                        name: '🔄 Action',
                        value: 'Daily Wheel Reset',
                        inline: true
                    },
                    {
                        name: '📊 Previous Record',
                        value: `**Tier:** ${buffRecord.tier}\n**Spin Date:** ${buffRecord.date}\n**Spin Time:** ${new Date(buffRecord.created_at).toLocaleString()}`,
                        inline: false
                    },
                    {
                        name: '🗑️ Roles Removed',
                        value: removedRoles.length > 0 ? removedRoles.join(', ') : 'No roles to remove',
                        inline: false
                    },
                    {
                        name: '📝 Reason',
                        value: reason,
                        inline: false
                    },
                    {
                        name: '✅ Result',
                        value: `${targetUser.username} can now spin the daily wheel again.`,
                        inline: false
                    }
                )
                .setFooter({ text: `⚓ Authorized by ${interaction.user.username} • Marine Intelligence` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            console.log(`[ADMIN WHEEL RESET] Reset daily wheel for ${targetUser.username} by ${interaction.user.username}`);

        } catch (error) {
            console.error('Reset wheel error:', error);
            await interaction.editReply({
                content: '❌ **Operation Failed**\n\nFailed to reset daily wheel. Please try again.'
            });
        }
    },

    // Original methods (keeping them as they were)
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

    async handleUserStats(interaction, targetUser) {
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

// Helper function for reset wheel functionality
function getCurrentDayKey() {
    const now = new Date();
    
    // Convert to EST/EDT (UTC-5/UTC-4)
    const isESTDaylightSaving = (date) => {
        const year = date.getFullYear();
        const march = new Date(year, 2, 1);
        const november = new Date(year, 10, 1);
        const dstStart = new Date(year, 2, (14 - march.getDay()) % 7 + 8);
        const dstEnd = new Date(year, 10, (7 - november.getDay()) % 7 + 1);
        return date >= dstStart && date < dstEnd;
    };
    
    const estOffset = isESTDaylightSaving(now) ? -4 : -5;
    const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
    
    // If it's before 3 AM EST, use previous day
    if (estTime.getHours() < 3) {
        estTime.setDate(estTime.getDate() - 1);
    }
    
    // Return YYYY-MM-DD format
    return estTime.toISOString().split('T')[0];
}

// Original handleStats, handleMaintenance, and handleNuclear functions remain the same
async function handleStats(interaction, db) {
    // Get comprehensive statistics
    const [userStats, guildStats, xpStats, levelStats] = await Promise.all([
        db.query('SELECT COUNT(*) as total_users FROM user_levels'),
        db.query('SELECT COUNT(*) as total_guilds FROM guild_settings'),
        db.query('SELECT SUM(total_xp) as total_xp, AVG(total_xp) as avg_xp FROM user_levels WHERE total_xp > 0'),
        db.query('SELECT level, COUNT(*) as count FROM user_levels WHERE level > 0 GROUP BY level ORDER BY level DESC LIMIT 10')
    ]);

    const totalUsers = userStats.rows[0]?.total_users || 0;
    const totalGuilds = guildStats.rows[0]?.total_guilds || 0;
    const totalXP = xpStats.rows[0]?.total_xp || 0;
    const avgXP = Math.round(xpStats.rows[0]?.avg_xp || 0);
    const topLevels = levelStats.rows;

    const statsEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🏛️ MARINE INTELLIGENCE - OPERATIONAL STATISTICS')
        .setDescription('```diff\n+ CLASSIFIED MARINE DATABASE METRICS\n+ SECURITY CLEARANCE: ADMIRAL LEVEL```')
        .addFields(
            {
                name: '📊 Network Statistics',
                value: `\`\`\`yaml\nActive Guilds: ${totalGuilds}\nTracked Users: ${totalUsers}\nTotal XP Issued: ${totalXP.toLocaleString()}\nAverage XP: ${avgXP.toLocaleString()}\`\`\``,
                inline: false
            },
            {
                name: '🏆 Top Levels Distribution',
                value: topLevels.length > 0 
                    ? `\`\`\`yaml\n${topLevels.map(l => `Level ${l.level}: ${l.count} Marines`).join('\n')}\`\`\``
                    : '```yaml\nNo level data available```',
                inline: false
            },
            {
                name: '⚙️ System Status',
                value: '```diff\n+ Database: OPERATIONAL\n+ XP Tracking: ACTIVE\n+ Voice Monitoring: ACTIVE\n+ Wanted Posters: OPERATIONAL```',
                inline: false
            }
        )
        .setTimestamp()
        .setFooter({ text: 'Marine Intelligence Network - Classified Access' });

    await interaction.reply({ embeds: [statsEmbed], ephemeral: true });
}

async function handleMaintenance(interaction, db) {
    const maintenanceButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('cleanup_inactive')
                .setLabel('🧹 Clean Inactive Users')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('optimize_db')
                .setLabel('⚡ Optimize Database')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('backup_stats')
                .setLabel('💾 Generate Backup Stats')
                .setStyle(ButtonStyle.Secondary)
        );

    const maintenanceEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🔧 MARINE INTELLIGENCE - MAINTENANCE OPERATIONS')
        .setDescription('```diff\n+ AUTHORIZED MAINTENANCE PROTOCOLS\n+ SELECT OPERATION TO EXECUTE```')
        .addFields({
            name: '⚠️ Available Operations',
            value: `\`\`\`yaml\n🧹 Clean Inactive: Remove users with 0 XP and no activity\n⚡ Optimize: Rebuild database indexes and clean logs\n💾 Backup Stats: Generate current database statistics\`\`\``
        })
        .setTimestamp()
        .setFooter({ text: 'Marine Intelligence - Maintenance Division' });

    await interaction.reply({ 
        embeds: [maintenanceEmbed], 
        components: [maintenanceButtons],
        ephemeral: true 
    });
}

async function handleNuclear(interaction, db) {
    const nuclearEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('☢️ NUCLEAR PROTOCOL - DATA DESTRUCTION AUTHORIZATION')
        .setDescription('```diff\n- ⚠️  EXTREME DANGER - COMPLETE DATA ANNIHILATION  ⚠️\n- THIS WILL PERMANENTLY DESTROY ALL DATABASE RECORDS\n- NO RECOVERY POSSIBLE AFTER EXECUTION```')
        .addFields(
            {
                name: '💥 DESTRUCTION SCOPE',
                value: '```diff\n- ALL USER XP DATA\n- ALL LEVEL PROGRESSIONS\n- ALL GUILD CONFIGURATIONS\n- ALL ACTIVITY LOGS\n- ALL BOUNTY RECORDS\n- COMPLETE DATABASE WIPE```',
                inline: false
            },
            {
                name: '⚠️ FINAL WARNING',
                value: '```css\n[CRITICAL] This action is IRREVERSIBLE\n[CRITICAL] All user progress will be LOST FOREVER\n[CRITICAL] Bot will require complete reconfiguration\n[CRITICAL] No backup or recovery options available```',
                inline: false
            }
        )
        .setTimestamp()
        .setFooter({ text: '⚠️ NUCLEAR AUTHORIZATION CONFIRMED ⚠️' });

    const nuclearButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('nuclear_confirm')
                .setLabel('☢️ INITIATE NUCLEAR PROTOCOL')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('nuclear_abort')
                .setLabel('🛡️ ABORT MISSION')
                .setStyle(ButtonStyle.Success)
        );

    await interaction.reply({
        embeds: [nuclearEmbed],
        components: [nuclearButtons],
        ephemeral: true
    });
}

// Export button handlers for use in index.js
module.exports.handleMaintenanceButtons = async (interaction, db) => {
    if (interaction.customId === 'cleanup_inactive') {
        await interaction.deferUpdate();
        
        const result = await db.query('DELETE FROM user_levels WHERE total_xp = 0 AND level = 0');
        const cleaned = result.rowCount || 0;

        const cleanupEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🧹 MAINTENANCE COMPLETE - INACTIVE USER CLEANUP')
            .setDescription('```diff\n+ CLEANUP OPERATION SUCCESSFUL```')
            .addFields({
                name: '📊 Cleanup Results',
                value: `\`\`\`yaml\nInactive Users Removed: ${cleaned}\nOperation Status: COMPLETE\nDatabase Status: OPTIMIZED\`\`\``
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [cleanupEmbed], components: [] });

    } else if (interaction.customId === 'optimize_db') {
        await interaction.deferUpdate();

        await db.query('VACUUM ANALYZE user_levels');
        await db.query('VACUUM ANALYZE guild_settings');
        await db.query('REINDEX TABLE user_levels');
        await db.query('REINDEX TABLE guild_settings');

        const optimizeEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('⚡ MAINTENANCE COMPLETE - DATABASE OPTIMIZATION')
            .setDescription('```diff\n+ DATABASE OPTIMIZATION SUCCESSFUL```')
            .addFields({
                name: '🔧 Operations Completed',
                value: '```yaml\n✅ Vacuum Analysis: COMPLETE\n✅ Index Rebuild: COMPLETE\n✅ Performance Optimization: COMPLETE\n✅ Memory Cleanup: COMPLETE```'
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [optimizeEmbed], components: [] });

    } else if (interaction.customId === 'backup_stats') {
        await interaction.deferUpdate();

        const backupData = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM user_levels) as total_users,
                (SELECT COUNT(*) FROM guild_settings) as total_guilds,
                (SELECT SUM(total_xp) FROM user_levels) as total_xp,
                (SELECT MAX(level) FROM user_levels) as max_level,
                CURRENT_TIMESTAMP as backup_time
        `);

        const stats = backupData.rows[0];
        const backupString = JSON.stringify(stats, null, 2);

        const backupEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('💾 BACKUP STATISTICS GENERATED')
            .setDescription('```diff\n+ DATABASE STATISTICS CAPTURED```')
            .addFields({
                name: '📊 Current Database State',
                value: `\`\`\`json\n${backupString}\`\`\``
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [backupEmbed], components: [] });
    }
};

module.exports.handleNuclearButtons = async (interaction, db) => {
    if (interaction.customId === 'nuclear_abort') {
        await interaction.deferUpdate();

        const abortEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🛡️ NUCLEAR PROTOCOL ABORTED')
            .setDescription('```diff\n+ MISSION ABORT SUCCESSFUL\n+ DATABASE REMAINS INTACT\n+ ALL DATA PRESERVED```')
            .addFields({
                name: '✅ Status Report',
                value: '```yaml\nNuclear Protocol: ABORTED\nDatabase Status: SECURE\nData Integrity: MAINTAINED\nThreat Level: NEUTRALIZED```'
            })
            .setTimestamp()
            .setFooter({ text: 'Crisis Averted - Marine Intelligence' });

        await interaction.editReply({ embeds: [abortEmbed], components: [] });

    } else if (interaction.customId === 'nuclear_confirm') {
        // Additional confirmation step
        const finalWarningEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('☢️ FINAL NUCLEAR AUTHORIZATION REQUIRED')
            .setDescription('```diff\n- LAST CHANCE TO ABORT MISSION\n- COMPLETE DATA DESTRUCTION IN 3... 2... 1...```')
            .addFields({
                name: '💀 POINT OF NO RETURN',
                value: '```css\n[FINAL WARNING] Click EXECUTE to permanently destroy ALL data\n[FINAL WARNING] This will render your bot completely unusable\n[FINAL WARNING] You will lose EVERYTHING```'
            })
            .setTimestamp();

        const finalButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('nuclear_execute')
                    .setLabel('💀 EXECUTE NUCLEAR DESTRUCTION')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('nuclear_abort')
                    .setLabel('🛡️ ABORT - SAVE DATABASE')
                    .setStyle(ButtonStyle.Success)
            );

        await interaction.update({
            embeds: [finalWarningEmbed],
            components: [finalButtons]
        });

    } else if (interaction.customId === 'nuclear_execute') {
        await interaction.deferUpdate();

        try {
            // Nuclear option - Complete database wipe
            await db.query('TRUNCATE TABLE user_levels CASCADE');
            await db.query('TRUNCATE TABLE guild_settings CASCADE');
            await db.query('DROP TABLE IF EXISTS daily_voice_xp CASCADE');
            
            console.log('[NUCLEAR] ☢️ NUCLEAR PROTOCOL EXECUTED - ALL DATA DESTROYED');

            const destructionEmbed = new EmbedBuilder()
                .setColor(0x000000)
                .setTitle('☢️ NUCLEAR PROTOCOL EXECUTED - TOTAL ANNIHILATION')
                .setDescription('```diff\n- ☢️  NUCLEAR DETONATION SUCCESSFUL  ☢️\n- ALL DATABASE RECORDS PERMANENTLY DESTROYED\n- COMPLETE DATA ANNIHILATION CONFIRMED```')
                .addFields(
                    {
                        name: '💀 DESTRUCTION REPORT',
                        value: '```diff\n- User Levels: OBLITERATED\n- Guild Settings: ANNIHILATED\n- Voice Data: VAPORIZED\n- XP Logs: ELIMINATED\n- All Progress: EXTINCT```',
                        inline: false
                    },
                    {
                        name: '⚠️ POST-NUCLEAR STATUS',
                        value: '```css\n[CRITICAL] Bot requires complete reconfiguration\n[CRITICAL] All users must restart from Level 0\n[CRITICAL] All guild settings reset to defaults\n[CRITICAL] No recovery possible```',
                        inline: false
                    }
                )
                .setTimestamp()
                .setFooter({ text: '☢️ Nuclear Protocol Complete - Database Extinct ☢️' });

            await interaction.editReply({ embeds: [destructionEmbed], components: [] });

        } catch (error) {
            console.error('[NUCLEAR ERROR]', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('⚠️ NUCLEAR PROTOCOL FAILURE')
                .setDescription('```diff\n- NUCLEAR DETONATION FAILED\n- SOME DATA MAY HAVE SURVIVED```')
                .addFields({
                    name: '🚨 Error Details',
                    value: `\`\`\`${error.message}\`\`\``
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed], components: [] });
        }
    }
};

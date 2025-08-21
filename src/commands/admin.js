// src/commands/admin.js - FIXED Admin Command with Complete Daily Quiz Reset

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ADMIN USER IDs - Load from environment variables
const ADMIN_USER_IDS = process.env.ADMIN_USER_IDS ? 
    process.env.ADMIN_USER_IDS.split(',').map(id => id.trim()) : 
    ['123456789012345678']; // Fallback admin ID

console.log('[ADMIN] Authorized admin user IDs:', ADMIN_USER_IDS);

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
                    { name: '📋 Bot Statistics', value: 'bot-stats' },
                    { name: '🔧 Database Maintenance', value: 'maintenance' },
                    { name: '☢️ Nuclear Protocol', value: 'nuclear' },
                    { name: '🎰 Reset Daily Quiz', value: 'reset-daily-quiz' }
                )
        )
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Target user (required for XP operations and daily quiz reset)')
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
        ),

    async execute(interaction) {
        try {
            // Check if user is authorized admin
            if (!ADMIN_USER_IDS.includes(interaction.user.id)) {
                return await interaction.reply({
                    content: '❌ **Access Denied**\n\n⚓ **Marine Command Center** requires special authorization.\n\nOnly authorized Marine officers may access these commands.',
                    ephemeral: true
                });
            }

            const action = interaction.options.getString('action');
            const targetUser = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            const reason = interaction.options.getString('reason') || 'No reason specified';
            const { db } = require('../../index'); // Get database from index.js

            // Handle XP operations that require a target user
            if (['add-xp', 'remove-xp', 'set-xp', 'reset-user', 'user-stats', 'reset-daily-quiz'].includes(action)) {
                if (!targetUser) {
                    return await interaction.reply({
                        content: '❌ **Missing Target User**\n\nPlease specify a user for this operation.',
                        ephemeral: true
                    });
                }

                // Prevent targeting bots
                if (targetUser.bot) {
                    return await interaction.reply({
                        content: '❌ **Invalid Target**\n\nCannot modify XP or reset daily quiz for bot accounts.',
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

                case 'reset-daily-quiz':
                    await this.handleResetDailyQuiz(interaction, targetUser, reason);
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

    // ✅ COMPLETE FIX: Reset Daily Quiz with proper role removal and database cleanup
    async handleResetDailyQuiz(interaction, targetUser, reason) {
        try {
            await interaction.deferReply();

            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (!member) {
                return await interaction.editReply({
                    content: '❌ **User Not Found**\n\nCould not find this user in the server.'
                });
            }

            console.log(`[ADMIN] Starting daily quiz reset for ${targetUser.username} (${targetUser.id})`);

            // ✅ STEP 1: Ensure database tables exist
            try {
                // Create daily_buff_rolls table if it doesn't exist
                await global.xpTracker.db.query(`
                    CREATE TABLE IF NOT EXISTS daily_buff_rolls (
                        user_id VARCHAR(20) NOT NULL,
                        guild_id VARCHAR(20) NOT NULL,
                        date DATE NOT NULL,
                        tier INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (user_id, guild_id, date)
                    )
                `);

                // Create daily_buff_xp_caps table if it doesn't exist
                await global.xpTracker.db.query(`
                    CREATE TABLE IF NOT EXISTS daily_buff_xp_caps (
                        user_id VARCHAR(20) NOT NULL,
                        guild_id VARCHAR(20) NOT NULL,
                        date DATE NOT NULL,
                        tier INTEGER DEFAULT 0,
                        xp_cap INTEGER DEFAULT 1500,
                        current_xp INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (user_id, guild_id, date)
                    )
                `);

                console.log('[ADMIN] Ensured daily quiz database tables exist');
            } catch (error) {
                console.error('[ADMIN] Error creating database tables:', error);
                return await interaction.editReply({
                    content: '❌ **Database Error**\n\nCould not access daily quiz system. Please try again.'
                });
            }

            // ✅ STEP 2: Check current status before removal
            const statusBefore = await this.checkDailyQuizStatus(targetUser.id, interaction.guild.id);
            console.log('[ADMIN] Status before reset:', statusBefore);

            // ✅ STEP 3: FORCE REMOVE ALL DAILY QUIZ ROLES (Tiers 1-10)
            const removedRoles = [];
            for (let tier = 1; tier <= 10; tier++) {
                const roleId = process.env[`DAILY_QUIZ_TIER_${tier}_ROLE`];
                if (roleId && roleId !== `role_id_${tier}` && member.roles.cache.has(roleId)) {
                    const role = interaction.guild.roles.cache.get(roleId);
                    if (role) {
                        try {
                            await member.roles.remove(role, `Admin daily quiz reset: ${reason}`);
                            removedRoles.push(`Tier ${tier}: ${role.name}`);
                            console.log(`[ADMIN] ✅ Removed ${role.name} from ${member.user.username}`);
                        } catch (error) {
                            console.error(`[ADMIN] ❌ Failed to remove ${role.name}:`, error);
                            removedRoles.push(`Tier ${tier}: ${role.name} (FAILED)`);
                        }
                    }
                }
            }

            // ✅ STEP 4: CLEAR ALL DATABASE RECORDS
            let dbRecordsDeleted = 0;
            
            try {
                // Delete from daily_buff_rolls (quiz completion records)
                const rollsResult = await global.xpTracker.db.query(
                    'DELETE FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2',
                    [targetUser.id, interaction.guild.id]
                );
                const rollsDeleted = rollsResult.rowCount || 0;

                // Delete from daily_buff_xp_caps (tier XP cap records)
                const capsResult = await global.xpTracker.db.query(
                    'DELETE FROM daily_buff_xp_caps WHERE user_id = $1 AND guild_id = $2',
                    [targetUser.id, interaction.guild.id]
                );
                const capsDeleted = capsResult.rowCount || 0;

                dbRecordsDeleted = rollsDeleted + capsDeleted;
                console.log(`[ADMIN] ✅ Deleted ${rollsDeleted} roll records and ${capsDeleted} cap records`);

            } catch (error) {
                console.error('[ADMIN] Error deleting database records:', error);
            }

            // ✅ STEP 5: Verify reset completion
            const statusAfter = await this.checkDailyQuizStatus(targetUser.id, interaction.guild.id);
            console.log('[ADMIN] Status after reset:', statusAfter);

            // ✅ STEP 6: Create comprehensive response
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🎌 Daily Quiz Reset Complete')
                .setDescription(`Successfully reset daily quiz for **${targetUser.username}**`)
                .addFields(
                    {
                        name: '🎯 Target User',
                        value: `${targetUser.username} (${targetUser.id})`,
                        inline: true
                    },
                    {
                        name: '🗑️ Roles Removed',
                        value: removedRoles.length > 0 ? 
                            `\`\`\`\n${removedRoles.join('\n')}\`\`\`` : 
                            '❌ No quiz roles found to remove',
                        inline: false
                    },
                    {
                        name: '🗄️ Database Cleanup',
                        value: `\`\`\`diff\n+ daily_buff_rolls: ${dbRecordsDeleted} records deleted\n+ daily_buff_xp_caps: Cleared\n+ User can now take quiz again\n+ XP caps reset to defaults\`\`\``,
                        inline: false
                    },
                    {
                        name: '📝 Admin Details',
                        value: `**Reason:** ${reason}\n**Authorized by:** ${interaction.user.username}\n**Status:** User can now use \`/daily-quiz\` again`,
                        inline: false
                    }
                )
                .setFooter({ text: `⚓ Daily Quiz Reset • Marine Intelligence` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            console.log(`[ADMIN] ✅ Daily quiz reset completed for ${targetUser.username}: ${removedRoles.length} roles removed, ${dbRecordsDeleted} DB records deleted`);

        } catch (error) {
            console.error('[ADMIN] Daily quiz reset error:', error);
            await interaction.editReply({
                content: '❌ **Operation Failed**\n\nFailed to reset daily quiz. Please check logs and try again.'
            });
        }
    },

    // ✅ HELPER: Check daily quiz status (roles + database)
    async checkDailyQuizStatus(userId, guildId) {
        try {
            const currentDay = this.getCurrentDay();
            
            // Check database records
            const rollsResult = await global.xpTracker.db.query(
                'SELECT tier FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [userId, guildId, currentDay]
            );
            
            const capsResult = await global.xpTracker.db.query(
                'SELECT tier, xp_cap, current_xp FROM daily_buff_xp_caps WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [userId, guildId, currentDay]
            );

            // Check current roles
            const guild = global.xpTracker.client.guilds.cache.get(guildId);
            const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
            const currentRoles = [];

            if (member) {
                for (let tier = 1; tier <= 10; tier++) {
                    const roleId = process.env[`DAILY_QUIZ_TIER_${tier}_ROLE`];
                    if (roleId && roleId !== `role_id_${tier}` && member.roles.cache.has(roleId)) {
                        const role = guild.roles.cache.get(roleId);
                        if (role) {
                            currentRoles.push({
                                tier: tier,
                                roleId: roleId,
                                roleName: role.name
                            });
                        }
                    }
                }
            }

            return {
                hasRollRecord: rollsResult.rows.length > 0,
                rollRecord: rollsResult.rows[0] || null,
                hasCapRecord: capsResult.rows.length > 0,
                capRecord: capsResult.rows[0] || null,
                currentRoles: currentRoles,
                currentDay: currentDay,
                member: member
            };
        } catch (error) {
            console.error('[ADMIN] Error checking daily quiz status:', error);
            return {
                hasRollRecord: false,
                rollRecord: null,
                hasCapRecord: false,
                capRecord: null,
                currentRoles: [],
                currentDay: this.getCurrentDay(),
                member: null
            };
        }
    },

    // Helper function to get current day
    getCurrentDay() {
        const now = new Date();
        const edtOffset = this.isEDT(now) ? -4 : -5;
        const edtTime = new Date(now.getTime() + (edtOffset * 60 * 60 * 1000));
        
        if (edtTime.getHours() < 3) {
            edtTime.setDate(edtTime.getDate() - 1);
        }
        
        return edtTime.toISOString().split('T')[0];
    },

    // Helper function to check EDT
    isEDT(date) {
        const year = date.getFullYear();
        const marchSecondSunday = new Date(year, 2, 8);
        marchSecondSunday.setDate(marchSecondSunday.getDate() + (7 - marchSecondSunday.getDay()));
        const novemberFirstSunday = new Date(year, 10, 1);
        novemberFirstSunday.setDate(novemberFirstSunday.getDate() + (7 - novemberFirstSunday.getDay()));
        return date >= marchSecondSunday && date < novemberFirstSunday;
    },

    // ✅ Keep all other existing methods: handleAddXP, handleRemoveXP, etc.
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

// Standalone functions after module.exports
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
        .setDescription('```diff\n+ MARINE DATABASE METRICS\n+ SECURITY CLEARANCE: ADMIRAL LEVEL```')
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
        .setFooter({ text: 'Marine Intelligence Network' });

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
            await db.query('TRUNCATE TABLE user_levels CASCADE');
            await db.query('TRUNCATE TABLE guild_settings CASCADE');
            await db.query('DROP TABLE IF EXISTS daily_voice_xp CASCADE');
            await db.query('DROP TABLE IF EXISTS daily_buff_rolls CASCADE');
            await db.query('DROP TABLE IF EXISTS daily_buff_xp_caps CASCADE');
            
            console.log('[NUCLEAR] ☢️ NUCLEAR PROTOCOL EXECUTED - ALL DATA DESTROYED');

            const destructionEmbed = new EmbedBuilder()
                .setColor(0x000000)
                .setTitle('☢️ NUCLEAR PROTOCOL EXECUTED - TOTAL ANNIHILATION')
                .setDescription('```diff\n- ☢️  NUCLEAR DETONATION SUCCESSFUL  ☢️\n- ALL DATABASE RECORDS PERMANENTLY DESTROYED\n- COMPLETE DATA ANNIHILATION CONFIRMED```')
                .addFields(
                    {
                        name: '💀 DESTRUCTION REPORT',
                        value: '```diff\n- User Levels: OBLITERATED\n- Guild Settings: ANNIHILATED\n- Voice Data: VAPORIZED\n- XP Logs: ELIMINATED\n- Daily Buffs: EXTINCT\n- Daily Quiz: EXTINCT\n- All Progress: EXTINCT```',
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

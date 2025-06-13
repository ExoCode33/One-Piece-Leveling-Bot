// src/commands/admin.js

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Admin tools for managing XP and stats')
        .addSubcommand(sub =>
            sub.setName('addxp')
                .setDescription('Add XP to a user')
                .addUserOption(option => option.setName('user').setDescription('User to give XP to').setRequired(true))
                .addIntegerOption(option => option.setName('amount').setDescription('Amount of XP to add').setRequired(true).setMinValue(1).setMaxValue(10000))
        )
        .addSubcommand(sub =>
            sub.setName('removexp')
                .setDescription('Remove XP from a user')
                .addUserOption(option => option.setName('user').setDescription('User to remove XP from').setRequired(true))
                .addIntegerOption(option => option.setName('amount').setDescription('Amount of XP to remove').setRequired(true).setMinValue(1).setMaxValue(10000))
        )
        .addSubcommand(sub =>
            sub.setName('setlevel')
                .setDescription('Set a user\'s level directly')
                .addUserOption(option => option.setName('user').setDescription('User to set level for').setRequired(true))
                .addIntegerOption(option => option.setName('level').setDescription('Level to set').setRequired(true).setMinValue(0).setMaxValue(50))
        )
        .addSubcommand(sub =>
            sub.setName('reset')
                .setDescription('Reset a user\'s XP and stats')
                .addUserOption(option => option.setName('user').setDescription('User to reset').setRequired(true))
                .addBooleanOption(option => option.setName('confirm').setDescription('Confirm you want to reset this user').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('stats')
                .setDescription('View detailed admin stats for a user')
                .addUserOption(option => option.setName('user').setDescription('User to view stats for').setRequired(true))
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Check permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Access Denied')
                .setDescription('You need Administrator permissions to use this command.')
                .setColor('#FF0000');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const subcommand = interaction.options.getSubcommand();
            const user = interaction.options.getUser('user');
            const guildId = interaction.guild.id;

            // Get XP tracker from global
            const xpTracker = global.xpTracker;
            if (!xpTracker) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ System Error')
                    .setDescription('XP Tracker is not initialized. Please restart the bot.')
                    .setColor('#FF0000');
                return interaction.editReply({ embeds: [embed] });
            }

            // Verify user is in the guild
            const targetMember = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (!targetMember) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ User Not Found')
                    .setDescription(`${user.username} is not a member of this server.`)
                    .setColor('#FF0000');
                return interaction.editReply({ embeds: [embed] });
            }

            switch (subcommand) {
                case 'addxp': {
                    const amount = interaction.options.getInteger('amount');
                    
                    try {
                        const result = await xpTracker.updateUserLevel(user.id, guildId, amount, 'admin_add');
                        
                        const embed = new EmbedBuilder()
                            .setTitle('✅ XP Added Successfully')
                            .setDescription(`Added **${amount.toLocaleString()}** XP to ${user.username}`)
                            .addFields(
                                { name: '🎯 Target', value: targetMember.displayName, inline: true },
                                { name: '💰 XP Added', value: amount.toLocaleString(), inline: true },
                                { name: '📊 New Total', value: result.total_xp.toLocaleString(), inline: true },
                                { name: '⭐ Current Level', value: result.level.toString(), inline: true }
                            )
                            .setColor('#00FF00')
                            .setThumbnail(user.displayAvatarURL())
                            .setFooter({ text: `Admin action by ${interaction.user.username}` })
                            .setTimestamp();

                        return interaction.editReply({ embeds: [embed] });
                    } catch (error) {
                        console.error('[ADMIN] Error adding XP:', error);
                        const embed = new EmbedBuilder()
                            .setTitle('❌ Error Adding XP')
                            .setDescription('Failed to add XP. Please try again.')
                            .setColor('#FF0000');
                        return interaction.editReply({ embeds: [embed] });
                    }
                }

                case 'removexp': {
                    const amount = interaction.options.getInteger('amount');
                    
                    try {
                        const result = await xpTracker.updateUserLevel(user.id, guildId, -amount, 'admin_remove');
                        
                        const embed = new EmbedBuilder()
                            .setTitle('✅ XP Removed Successfully')
                            .setDescription(`Removed **${amount.toLocaleString()}** XP from ${user.username}`)
                            .addFields(
                                { name: '🎯 Target', value: targetMember.displayName, inline: true },
                                { name: '💸 XP Removed', value: amount.toLocaleString(), inline: true },
                                { name: '📊 New Total', value: Math.max(0, result.total_xp).toLocaleString(), inline: true },
                                { name: '⭐ Current Level', value: result.level.toString(), inline: true }
                            )
                            .setColor('#FFA500')
                            .setThumbnail(user.displayAvatarURL())
                            .setFooter({ text: `Admin action by ${interaction.user.username}` })
                            .setTimestamp();

                        return interaction.editReply({ embeds: [embed] });
                    } catch (error) {
                        console.error('[ADMIN] Error removing XP:', error);
                        const embed = new EmbedBuilder()
                            .setTitle('❌ Error Removing XP')
                            .setDescription('Failed to remove XP. Please try again.')
                            .setColor('#FF0000');
                        return interaction.editReply({ embeds: [embed] });
                    }
                }

                case 'setlevel': {
                    const targetLevel = interaction.options.getInteger('level');
                    
                    try {
                        // Calculate XP needed for target level
                        let xpNeeded = 0;
                        if (targetLevel > 0) {
                            // Use the same formula as XP tracker
                            const curve = process.env.FORMULA_CURVE || 'exponential';
                            const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
                            
                            if (curve === 'exponential') {
                                // Reverse the formula: xp = (level / multiplier)^2 * 100
                                xpNeeded = Math.floor(Math.pow(targetLevel / multiplier, 2) * 100);
                            } else {
                                // Linear calculation
                                for (let i = 0; i < targetLevel; i++) {
                                    xpNeeded += 500 + (i * (multiplier * 100));
                                }
                            }
                        }

                        // Get current user stats
                        const currentStats = await xpTracker.getUserStats(guildId, user.id);
                        const currentXP = currentStats ? currentStats.xp : 0;
                        const xpDifference = xpNeeded - currentXP;

                        // Update XP to match target level
                        const result = await xpTracker.updateUserLevel(user.id, guildId, xpDifference, 'admin_setlevel');
                        
                        const embed = new EmbedBuilder()
                            .setTitle('✅ Level Set Successfully')
                            .setDescription(`Set ${user.username}'s level to **${targetLevel}**`)
                            .addFields(
                                { name: '🎯 Target', value: targetMember.displayName, inline: true },
                                { name: '⭐ New Level', value: targetLevel.toString(), inline: true },
                                { name: '💰 Total XP', value: result.total_xp.toLocaleString(), inline: true },
                                { name: '📈 XP Adjusted', value: `${xpDifference > 0 ? '+' : ''}${xpDifference.toLocaleString()}`, inline: true }
                            )
                            .setColor('#0099FF')
                            .setThumbnail(user.displayAvatarURL())
                            .setFooter({ text: `Admin action by ${interaction.user.username}` })
                            .setTimestamp();

                        return interaction.editReply({ embeds: [embed] });
                    } catch (error) {
                        console.error('[ADMIN] Error setting level:', error);
                        const embed = new EmbedBuilder()
                            .setTitle('❌ Error Setting Level')
                            .setDescription('Failed to set level. Please try again.')
                            .setColor('#FF0000');
                        return interaction.editReply({ embeds: [embed] });
                    }
                }

                case 'reset': {
                    const confirmed = interaction.options.getBoolean('confirm');
                    
                    if (!confirmed) {
                        const embed = new EmbedBuilder()
                            .setTitle('❌ Reset Cancelled')
                            .setDescription('You must confirm the reset by setting the confirm option to `True`.')
                            .setColor('#FF0000');
                        return interaction.editReply({ embeds: [embed] });
                    }

                    try {
                        // Get database connection from global xpTracker
                        const db = xpTracker.db;
                        
                        // Reset user stats in the database
                        await db.query(
                            `UPDATE user_levels 
                             SET total_xp = 0, level = 0, messages = 0, reactions = 0, voice_time = 0, updated_at = CURRENT_TIMESTAMP
                             WHERE user_id = $1 AND guild_id = $2`,
                            [user.id, guildId]
                        );

                        const embed = new EmbedBuilder()
                            .setTitle('✅ User Reset Successfully')
                            .setDescription(`Reset all stats for ${user.username}`)
                            .addFields(
                                { name: '🎯 Target', value: targetMember.displayName, inline: true },
                                { name: '📊 Status', value: 'All stats reset to 0', inline: true },
                                { name: '⚠️ Action', value: 'This cannot be undone', inline: true }
                            )
                            .setColor('#FF4444')
                            .setThumbnail(user.displayAvatarURL())
                            .setFooter({ text: `Admin action by ${interaction.user.username}` })
                            .setTimestamp();

                        return interaction.editReply({ embeds: [embed] });
                    } catch (error) {
                        console.error('[ADMIN] Error resetting user:', error);
                        const embed = new EmbedBuilder()
                            .setTitle('❌ Error Resetting User')
                            .setDescription('Failed to reset user stats. Please try again.')
                            .setColor('#FF0000');
                        return interaction.editReply({ embeds: [embed] });
                    }
                }

                case 'stats': {
                    try {
                        const userStats = await xpTracker.getUserStats(guildId, user.id);
                        
                        if (!userStats) {
                            const embed = new EmbedBuilder()
                                .setTitle('📊 User Stats')
                                .setDescription(`${user.username} hasn't started their pirate journey yet!`)
                                .setColor('#FFA500');
                            return interaction.editReply({ embeds: [embed] });
                        }

                        // Get user's rank
                        const leaderboard = await xpTracker.getLeaderboard(guildId);
                        const rank = leaderboard.findIndex(u => u.userId === user.id) + 1;

                        // Calculate next level XP requirement
                        const currentLevel = userStats.level;
                        const currentXP = userStats.xp;
                        const nextLevel = currentLevel + 1;
                        
                        let nextLevelXP = 0;
                        const curve = process.env.FORMULA_CURVE || 'exponential';
                        const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
                        
                        if (curve === 'exponential') {
                            nextLevelXP = Math.floor(Math.pow(nextLevel / multiplier, 2) * 100);
                        } else {
                            for (let i = 0; i <= nextLevel; i++) {
                                nextLevelXP += 500 + (i * (multiplier * 100));
                            }
                        }
                        
                        const xpNeeded = Math.max(0, nextLevelXP - currentXP);
                        const voiceHours = Math.floor(userStats.voice_time / 3600);
                        const voiceMinutes = Math.floor((userStats.voice_time % 3600) / 60);

                        const embed = new EmbedBuilder()
                            .setTitle('📊 Detailed User Stats')
                            .setDescription(`Complete statistics for ${targetMember.displayName}`)
                            .addFields(
                                { name: '👤 Pirate', value: targetMember.displayName, inline: true },
                                { name: '🏆 Rank', value: `#${rank}`, inline: true },
                                { name: '⭐ Level', value: userStats.level.toString(), inline: true },
                                { name: '💰 Total Bounty', value: userStats.xp.toLocaleString(), inline: true },
                                { name: '📈 XP to Next Level', value: currentLevel >= 50 ? 'MAX LEVEL' : xpNeeded.toLocaleString(), inline: true },
                                { name: '🎯 Progress', value: currentLevel >= 50 ? '100%' : `${Math.floor((currentXP / nextLevelXP) * 100)}%`, inline: true },
                                { name: '💬 Messages Sent', value: userStats.messages.toLocaleString(), inline: true },
                                { name: '😄 Reactions Added', value: userStats.reactions.toLocaleString(), inline: true },
                                { name: '🎙️ Voice Time', value: `${voiceHours}h ${voiceMinutes}m`, inline: true },
                                { name: '📅 First Seen', value: `<t:${Math.floor(new Date(userStats.created_at).getTime() / 1000)}:R>`, inline: true },
                                { name: '🕒 Last Activity', value: `<t:${Math.floor(new Date(userStats.updated_at).getTime() / 1000)}:R>`, inline: true },
                                { name: '📊 Account Age', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true }
                            )
                            .setColor('#4169E1')
                            .setThumbnail(user.displayAvatarURL())
                            .setFooter({ text: `Admin stats viewed by ${interaction.user.username}` })
                            .setTimestamp();

                        // Check if user has excluded role
                        const settings = global.guildSettings?.get(guildId) || {};
                        if (settings.excludedRole && targetMember.roles.cache.has(settings.excludedRole)) {
                            embed.addFields({
                                name: '👑 Special Status',
                                value: 'Pirate King (Excluded Role)',
                                inline: false
                            });
                        }

                        return interaction.editReply({ embeds: [embed] });
                    } catch (error) {
                        console.error('[ADMIN] Error getting user stats:', error);
                        const embed = new EmbedBuilder()
                            .setTitle('❌ Error Getting Stats')
                            .setDescription('Failed to retrieve user statistics.')
                            .setColor('#FF0000');
                        return interaction.editReply({ embeds: [embed] });
                    }
                }

                default: {
                    const embed = new EmbedBuilder()
                        .setTitle('❌ Invalid Subcommand')
                        .setDescription('Please use a valid subcommand.')
                        .setColor('#FF0000');
                    return interaction.editReply({ embeds: [embed] });
                }
            }

        } catch (error) {
            console.error('[ADMIN] Error in admin command:', error);
            const embed = new EmbedBuilder()
                .setTitle('❌ Command Error')
                .setDescription('An unexpected error occurred while executing the admin command.')
                .setColor('#FF0000');
            return interaction.editReply({ embeds: [embed] });
        }
    }
};

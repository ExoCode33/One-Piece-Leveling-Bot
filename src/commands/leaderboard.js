// src/commands/leaderboard.js - One Piece Themed Leaderboard (Fixed Duplicate IDs)

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the Grand Line Bounty Board')
        .addStringOption(option =>
            option.setName('view')
                .setDescription('Bounty board view type')
                .setRequired(false)
                .addChoices(
                    { name: '📋 Short View (Top 3)', value: 'short' },
                    { name: '📜 Long View (Full Board)', value: 'long' }
                )
        )
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page number for long view (default: 1)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Bounty ranking type')
                .setRequired(false)
                .addChoices(
                    { name: '💰 Total Bounty (XP)', value: 'xp' },
                    { name: '⭐ Pirate Level', value: 'level' },
                    { name: '💬 Messages Sent', value: 'messages' },
                    { name: '👍 Crew Reactions', value: 'reactions' },
                    { name: '🎙️ Voice Time', value: 'voice' }
                )
        ),

    async execute(interaction, client, xpTracker) {
        try {
            // IMMEDIATELY defer the interaction to prevent timeout
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply();
            }

            const view = interaction.options.getString('view') || 'short';
            const page = Math.max(1, interaction.options.getInteger('page') || 1);
            const type = interaction.options.getString('type') || 'xp';
            const guildId = interaction.guildId;

            // Quick validation before heavy database operations
            if (!guildId) {
                const responseMethod = interaction.deferred || interaction.replied ? 'editReply' : 'reply';
                return await interaction[responseMethod]('❌ This command can only be used in a server.');
            }

            // Get Pirate King (excluded role user) - optimize this query
            let pirateKing = null;
            const pirateKingRoleId = process.env.LEADERBOARD_EXCLUDE_ROLE;

            if (pirateKingRoleId && pirateKingRoleId !== 'your_exclude_role_id') {
                try {
                    const role = interaction.guild.roles.cache.get(pirateKingRoleId);
                    if (role && role.members.size > 0) {
                        const pirateKingMember = role.members.first();
                        const pirateKingStats = await xpTracker.getUserStats(pirateKingMember.id, guildId);
                        
                        if (pirateKingStats) {
                            pirateKing = {
                                member: pirateKingMember,
                                data: pirateKingStats
                            };
                        }
                    }
                } catch (error) {
                    console.error('Error fetching Pirate King:', error);
                    // Continue without Pirate King rather than failing
                }
            }

            if (view === 'short') {
                return await this.handleShortView(interaction, client, xpTracker, pirateKing, type);
            } else {
                return await this.handleLongView(interaction, client, xpTracker, pirateKing, page, type);
            }

        } catch (error) {
            console.error('Error in leaderboard command:', error);
            try {
                const responseMethod = interaction.deferred || interaction.replied ? 'editReply' : 'reply';
                await interaction[responseMethod]('❌ An error occurred while fetching the bounty board.');
            } catch (responseError) {
                console.error('Error sending error response:', responseError);
            }
        }
    },

    async handleShortView(interaction, client, xpTracker, pirateKing, type) {
        const guildId = interaction.guildId;
        
        try {
            // Get leaderboard data using XP Tracker
            const leaderboardData = await xpTracker.getLeaderboard(guildId, type, 1, 3);
            
            if (!leaderboardData) {
                const responseMethod = interaction.deferred || interaction.replied ? 'editReply' : 'reply';
                return await interaction[responseMethod]('❌ Could not fetch leaderboard data.');
            }

            // Create One Piece themed embed
            const embed = new EmbedBuilder()
                .setTitle('🏴‍☠️ GRAND LINE BOUNTY BOARD 🏴‍☠️')
                .setColor(0xC41E3A) // Deep Red
                .setDescription('*The most notorious pirates sailing the Grand Line...*')
                .setAuthor({ 
                    name: 'World Government Bounty Office', 
                    iconURL: interaction.guild.iconURL() 
                });

            // Add Pirate King section
            if (pirateKing) {
                const pirateKingValue = this.formatBountyValue(type, pirateKing.data);
                const pirateKingTitle = pirateKing.data.level >= 50 ? 'Yonko' : this.getPirateTitle(pirateKing.data.level);
                embed.addFields({
                    name: '👑 THE PIRATE KING 👑',
                    value: `**${pirateKing.member.displayName}** - *${pirateKingTitle}*\n${pirateKingValue}\n*🌟 Ruler of the Grand Line 🌟*`,
                    inline: false
                });
            }

            // Build top 3 display with error handling
            if (leaderboardData.users.length > 0) {
                let top3Text = '';
                const emojis = ['🥇', '🥈', '🥉'];

                for (let i = 0; i < leaderboardData.users.length; i++) {
                    const row = leaderboardData.users[i];
                    try {
                        const member = await interaction.guild.members.fetch(row.user_id);
                        const bountyValue = this.formatBountyValue(type, row);
                        const pirateTitle = this.getPirateTitle(row.level);
                        top3Text += `${emojis[i]} **${member.displayName}** - *${pirateTitle}*\n${bountyValue}\n\n`;
                    } catch (error) {
                        // User left server - handle gracefully
                        const bountyValue = this.formatBountyValue(type, row);
                        const pirateTitle = this.getPirateTitle(row.level);
                        top3Text += `${emojis[i]} **User Left** - *${pirateTitle}*\n${bountyValue}\n\n`;
                    }
                }

                embed.addFields({
                    name: '⚡ TOP WANTED PIRATES ⚡',
                    value: top3Text || 'No bounties found...',
                    inline: false
                });
            } else {
                embed.addFields({
                    name: '⚡ TOP WANTED PIRATES ⚡',
                    value: '*The seas are quiet... no bounties have been set.*',
                    inline: false
                });
            }

            // Generate unique timestamp for button IDs
            const timestamp = Date.now();

            // Add view switching buttons (ROW 1)
            const viewButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`lb_short_${timestamp}_${type}`)
                        .setLabel('📋 Short View')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🏴‍☠️'),
                    new ButtonBuilder()
                        .setCustomId(`lb_long_${timestamp}_${type}`)
                        .setLabel('📜 Full Board')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📜'),
                    new ButtonBuilder()
                        .setCustomId(`lb_refresh_short_${timestamp}`)
                        .setLabel('🔄 Refresh')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⚓')
                );

            // Add type selection buttons (ROW 2)
            const typeButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`lb_type_short_xp_${timestamp}`)
                        .setLabel('Bounty')
                        .setStyle(type === 'xp' ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setEmoji('💰'),
                    new ButtonBuilder()
                        .setCustomId(`lb_type_short_level_${timestamp}`)
                        .setLabel('Level')
                        .setStyle(type === 'level' ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setEmoji('⭐'),
                    new ButtonBuilder()
                        .setCustomId(`lb_type_short_messages_${timestamp}`)
                        .setLabel('Messages')
                        .setStyle(type === 'messages' ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setEmoji('💬'),
                    new ButtonBuilder()
                        .setCustomId(`lb_type_short_reactions_${timestamp}`)
                        .setLabel('Reactions')
                        .setStyle(type === 'reactions' ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setEmoji('👍'),
                    new ButtonBuilder()
                        .setCustomId(`lb_type_short_voice_${timestamp}`)
                        .setLabel('Voice')
                        .setStyle(type === 'voice' ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setEmoji('🎙️')
                );

            embed.setFooter({ 
                text: '⚓ Marine Intelligence • Updated', 
                iconURL: client.user.displayAvatarURL() 
            });

            const responseMethod = interaction.deferred || interaction.replied ? 'editReply' : 'reply';
            await interaction[responseMethod]({ 
                embeds: [embed], 
                components: [viewButtons, typeButtons],
                allowedMentions: { users: [] } 
            });

        } catch (error) {
            console.error('Error in handleShortView:', error);
            const responseMethod = interaction.deferred || interaction.replied ? 'editReply' : 'reply';
            await interaction[responseMethod]('❌ An error occurred while fetching the short bounty view.');
        }
    },

    async handleLongView(interaction, client, xpTracker, pirateKing, page, type) {
        const guildId = interaction.guildId;
        const usersPerPage = 10;

        try {
            // Get leaderboard data using XP Tracker
            const leaderboardData = await xpTracker.getLeaderboard(guildId, type, page, usersPerPage);
            
            if (!leaderboardData) {
                const responseMethod = interaction.deferred || interaction.replied ? 'editReply' : 'reply';
                return await interaction[responseMethod]('❌ Could not fetch leaderboard data.');
            }

            if (page > leaderboardData.totalPages && leaderboardData.totalPages > 0) {
                const responseMethod = interaction.deferred || interaction.replied ? 'editReply' : 'reply';
                return await interaction[responseMethod](`❌ Page ${page} doesn't exist. There are only ${leaderboardData.totalPages} pages in this bounty ledger.`);
            }

            // Create One Piece themed embed
            const { displayName } = this.getSortConfig(type);
            const embed = new EmbedBuilder()
                .setTitle(`🏴‍☠️ WANTED PIRATES LEDGER - ${displayName.toUpperCase()} 🏴‍☠️`)
                .setColor(0x8B5A00) // Brown/Gold
                .setDescription('*A comprehensive list of all wanted pirates in these waters...*')
                .setAuthor({ 
                    name: 'Marine Headquarters Bounty Division', 
                    iconURL: interaction.guild.iconURL() 
                });

            // Add Pirate King section (always at top of long view)
            if (pirateKing) {
                const pirateKingValue = this.formatBountyValue(type, pirateKing.data);
                const pirateKingTitle = pirateKing.data.level >= 50 ? 'Yonko' : this.getPirateTitle(pirateKing.data.level);
                embed.addFields({
                    name: '👑 THE PIRATE KING 👑',
                    value: `**${pirateKing.member.displayName}** - *${pirateKingTitle}*\n${pirateKingValue}`,
                    inline: false
                });
            }

            // Build bounty list
            if (leaderboardData.users.length > 0) {
                let bountyList = '';
                for (let i = 0; i < leaderboardData.users.length; i++) {
                    const row = leaderboardData.users[i];
                    const rank = ((page - 1) * usersPerPage) + i + 1;

                    // Get rank emoji/icon
                    let rankIcon = '';
                    if (rank === 1) rankIcon = '🥇';
                    else if (rank === 2) rankIcon = '🥈';
                    else if (rank === 3) rankIcon = '🥉';
                    else if (rank <= 10) rankIcon = '⚔️';
                    else rankIcon = '🗡️';

                    try {
                        const member = await interaction.guild.members.fetch(row.user_id);
                        const bountyValue = this.formatBountyValue(type, row);
                        bountyList += `${rankIcon} **#${rank}** ${member.displayName}\n${bountyValue}\n\n`;
                    } catch (error) {
                        const bountyValue = this.formatBountyValue(type, row);
                        bountyList += `${rankIcon} **#${rank}** *Pirate Fled*\n${bountyValue}\n\n`;
                    }
                }

                embed.addFields({
                    name: `⚡ WANTED PIRATES - PAGE ${page} ⚡`,
                    value: bountyList,
                    inline: false
                });
            } else {
                embed.addFields({
                    name: '⚡ WANTED PIRATES ⚡',
                    value: '*No bounties found on this page...*',
                    inline: false
                });
            }

            // Generate unique timestamp for button IDs
            const timestamp = Date.now();
            const components = [];

            // Create navigation buttons (ROW 1) - only if multiple pages
            if (leaderboardData.totalPages > 1) {
                const navButtons = new ActionRowBuilder();

                // Previous page
                if (page > 1) {
                    navButtons.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`lb_nav_prev_${page - 1}_${type}_${timestamp}`)
                            .setLabel('◀ Previous')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('📜')
                    );
                }

                // Page info
                navButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`lb_page_info_${timestamp}`)
                        .setLabel(`${page}/${leaderboardData.totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );

                // Next page
                if (page < leaderboardData.totalPages) {
                    navButtons.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`lb_nav_next_${page + 1}_${type}_${timestamp}`)
                            .setLabel('Next ▶')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('📜')
                    );
                }

                components.push(navButtons);
            }

            // View switching buttons (ROW 2)
            const viewButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`lb_view_short_${timestamp}_${type}`)
                        .setLabel('📋 Short View')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🏴‍☠️'),
                    new ButtonBuilder()
                        .setCustomId(`lb_view_long_${page}_${type}_${timestamp}`)
                        .setLabel('📜 Long View')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('📜'),
                    new ButtonBuilder()
                        .setCustomId(`lb_refresh_long_${timestamp}`)
                        .setLabel('🔄 Refresh')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⚓')
                );

            // Type selection buttons (ROW 3)
            const typeButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`lb_type_long_xp_${page}_${timestamp}`)
                        .setLabel('Bounty')
                        .setStyle(type === 'xp' ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setEmoji('💰'),
                    new ButtonBuilder()
                        .setCustomId(`lb_type_long_level_${page}_${timestamp}`)
                        .setLabel('Level')
                        .setStyle(type === 'level' ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setEmoji('⭐'),
                    new ButtonBuilder()
                        .setCustomId(`lb_type_long_messages_${page}_${timestamp}`)
                        .setLabel('Messages')
                        .setStyle(type === 'messages' ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setEmoji('💬'),
                    new ButtonBuilder()
                        .setCustomId(`lb_type_long_reactions_${page}_${timestamp}`)
                        .setLabel('Reactions')
                        .setStyle(type === 'reactions' ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setEmoji('👍'),
                    new ButtonBuilder()
                        .setCustomId(`lb_type_long_voice_${page}_${timestamp}`)
                        .setLabel('Voice')
                        .setStyle(type === 'voice' ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setEmoji('🎙️')
                );

            components.push(viewButtons, typeButtons);

            embed.setFooter({ 
                text: `⚓ Marine Intelligence • Page ${page}/${leaderboardData.totalPages} • ${leaderboardData.totalUsers} total bounties`, 
                iconURL: client.user.displayAvatarURL() 
            });

            const responseMethod = interaction.deferred || interaction.replied ? 'editReply' : 'reply';
            await interaction[responseMethod]({ 
                embeds: [embed], 
                components: components,
                allowedMentions: { users: [] } 
            });

        } catch (error) {
            console.error('Error in handleLongView:', error);
            const responseMethod = interaction.deferred || interaction.replied ? 'editReply' : 'reply';
            await interaction[responseMethod]('❌ An error occurred while fetching the long bounty view.');
        }
    },

    getSortConfig(type) {
        switch (type) {
            case 'level':
                return {
                    sortField: 'level',
                    displayName: 'Pirate Level',
                    formatValue: (val) => `⭐ Level ${val}`
                };
            case 'messages':
                return {
                    sortField: 'messages',
                    displayName: 'Messages',
                    formatValue: (val) => `💬 ${val.toLocaleString()} messages`
                };
            case 'reactions':
                return {
                    sortField: 'reactions',
                    displayName: 'Reactions',
                    formatValue: (val) => `👍 ${val.toLocaleString()} reactions`
                };
            case 'voice':
                return {
                    sortField: 'voice_time',
                    displayName: 'Voice Time',
                    formatValue: (val) => `🎙️ ${Math.floor(val / 60)}h ${val % 60}m`
                };
            case 'xp':
            default:
                return {
                    sortField: 'total_xp',
                    displayName: 'Total Bounty',
                    formatValue: (val, level) => `💰 ${val.toLocaleString()} ⚡ (Level ${level})`
                };
        }
    },

    formatBountyValue(type, row) {
        const { formatValue } = this.getSortConfig(type);
        if (type === 'xp') {
            return formatValue(row.total_xp, row.level);
        } else {
            return formatValue(row[this.getSortConfig(type).sortField]);
        }
    },

    getPirateTitle(level) {
        if (level >= 50) return 'Yonko';
        if (level >= 45) return 'Yonko Commander';
        if (level >= 40) return 'Warlord';
        if (level >= 35) return 'First Mate';
        if (level >= 30) return 'Navigator';
        if (level >= 25) return 'Boatswain';
        if (level >= 20) return 'Helmsman';
        if (level >= 15) return 'Gunner';
        if (level >= 10) return 'Powder Monkey';
        if (level >= 5) return 'Deckhand';
        return 'Cabin Boy';
    }
};

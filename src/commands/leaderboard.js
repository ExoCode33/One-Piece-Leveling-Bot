// src/commands/leaderboard.js - Fixed Leaderboard Command

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Show the server leaderboard')
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page number (default: 1)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Leaderboard type')
                .setRequired(false)
                .addChoices(
                    { name: 'Total XP', value: 'xp' },
                    { name: 'Level', value: 'level' },
                    { name: 'Messages', value: 'messages' },
                    { name: 'Reactions', value: 'reactions' },
                    { name: 'Voice Time', value: 'voice' }
                )
        ),

    async execute(interaction, client) {
        try {
            await interaction.deferReply();

            const page = Math.max(1, interaction.options.getInteger('page') || 1);
            const type = interaction.options.getString('type') || 'xp';
            const guildId = interaction.guildId;
            const usersPerPage = 10;
            const offset = (page - 1) * usersPerPage;

            // Check for leaderboard exclude role
            const excludeRoleId = process.env.LEADERBOARD_EXCLUDE_ROLE;
            
            // Determine sort field and display format
            let sortField, displayName, formatValue;
            switch (type) {
                case 'level':
                    sortField = 'level';
                    displayName = 'Level';
                    formatValue = (val) => `Level ${val}`;
                    break;
                case 'messages':
                    sortField = 'messages';
                    displayName = 'Messages';
                    formatValue = (val) => `${val.toLocaleString()} messages`;
                    break;
                case 'reactions':
                    sortField = 'reactions';
                    displayName = 'Reactions';
                    formatValue = (val) => `${val.toLocaleString()} reactions`;
                    break;
                case 'voice':
                    sortField = 'voice_time';
                    displayName = 'Voice Time';
                    formatValue = (val) => `${Math.floor(val / 60)}h ${val % 60}m`;
                    break;
                case 'xp':
                default:
                    sortField = 'total_xp';
                    displayName = 'Total XP';
                    formatValue = (val, level) => `${val.toLocaleString()} XP (Level ${level})`;
                    break;
            }

            // Get total count for pagination
            const countQuery = `
                SELECT COUNT(*) as total
                FROM user_levels
                WHERE guild_id = $1 AND ${sortField} > 0
            `;
            const countResult = await client.db.query(countQuery, [guildId]);
            const totalUsers = parseInt(countResult.rows[0].total);
            const totalPages = Math.ceil(totalUsers / usersPerPage);

            if (page > totalPages && totalPages > 0) {
                return await interaction.editReply(`❌ Page ${page} doesn't exist. There are only ${totalPages} pages.`);
            }

            // Fetch leaderboard data
            const query = `
                SELECT user_id, total_xp, level, messages, reactions, voice_time
                FROM user_levels
                WHERE guild_id = $1 AND ${sortField} > 0
                ORDER BY ${sortField} DESC, total_xp DESC
                LIMIT $2 OFFSET $3
            `;
            const result = await client.db.query(query, [guildId, usersPerPage, offset]);

            if (!result.rows.length) {
                const embed = new EmbedBuilder()
                    .setTitle('🏆 Server Leaderboard')
                    .setDescription('No users found on the leaderboard. Start chatting to appear here!')
                    .setColor(0xFFD700);
                
                return await interaction.editReply({ embeds: [embed] });
            }

            // Build leaderboard string
            let leaderboard = '';
            let validEntries = 0;

            for (let i = 0; i < result.rows.length; i++) {
                const row = result.rows[i];
                const rank = offset + validEntries + 1;

                // Check if user has exclude role
                if (excludeRoleId && excludeRoleId !== 'your_exclude_role_id') {
                    try {
                        const member = await interaction.guild.members.fetch(row.user_id);
                        if (member && member.roles.cache.has(excludeRoleId)) {
                            continue; // Skip this user
                        }
                    } catch (error) {
                        // User might have left the server, continue anyway
                    }
                }

                // Get rank emoji
                let rankEmoji = '';
                if (rank === 1) rankEmoji = '🥇';
                else if (rank === 2) rankEmoji = '🥈';
                else if (rank === 3) rankEmoji = '🥉';
                else rankEmoji = `**#${rank}**`;

                // Format the value based on type
                let valueText;
                if (type === 'xp') {
                    valueText = formatValue(row.total_xp, row.level);
                } else {
                    valueText = formatValue(row[sortField]);
                }

                // Check if user is still in server
                let userDisplay;
                try {
                    const member = await interaction.guild.members.fetch(row.user_id);
                    userDisplay = member.displayName;
                } catch (error) {
                    userDisplay = `User Left (${row.user_id})`;
                }

                leaderboard += `${rankEmoji} **${userDisplay}** — ${valueText}\n`;
                validEntries++;
            }

            // Create embed
            const embed = new EmbedBuilder()
                .setTitle(`🏆 ${displayName} Leaderboard`)
                .setDescription(leaderboard || 'No users found.')
                .setColor(0xFFD700)
                .setFooter({ 
                    text: `Page ${page}/${totalPages} • ${totalUsers} total users`,
                    iconURL: interaction.guild.iconURL()
                });

            // Add top user highlight
            if (page === 1 && result.rows.length > 0) {
                const topUser = result.rows[0];
                try {
                    const member = await interaction.guild.members.fetch(topUser.user_id);
                    embed.setThumbnail(member.user.displayAvatarURL({ size: 128 }));
                } catch (error) {
                    // User might have left
                }
            }

            // Create navigation buttons (only if multiple pages)
            const components = [];
            if (totalPages > 1) {
                const buttons = new ActionRowBuilder();

                // Previous page button
                if (page > 1) {
                    buttons.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`leaderboard_${type}_${page - 1}`)
                            .setLabel('◀ Previous')
                            .setStyle(ButtonStyle.Primary)
                    );
                }

                // Page info button (disabled)
                buttons.addComponents(
                    new ButtonBuilder()
                        .setCustomId('page_info')
                        .setLabel(`${page}/${totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );

                // Next page button
                if (page < totalPages) {
                    buttons.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`leaderboard_${type}_${page + 1}`)
                            .setLabel('Next ▶')
                            .setStyle(ButtonStyle.Primary)
                    );
                }

                components.push(buttons);
            }

            // Type selection buttons
            const typeButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`leaderboard_xp_1`)
                        .setLabel('XP')
                        .setStyle(type === 'xp' ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setEmoji('⭐'),
                    new ButtonBuilder()
                        .setCustomId(`leaderboard_level_1`)
                        .setLabel('Level')
                        .setStyle(type === 'level' ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setEmoji('📊'),
                    new ButtonBuilder()
                        .setCustomId(`leaderboard_messages_1`)
                        .setLabel('Messages')
                        .setStyle(type === 'messages' ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setEmoji('💬'),
                    new ButtonBuilder()
                        .setCustomId(`leaderboard_reactions_1`)
                        .setLabel('Reactions')
                        .setStyle(type === 'reactions' ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setEmoji('👍'),
                    new ButtonBuilder()
                        .setCustomId(`leaderboard_voice_1`)
                        .setLabel('Voice')
                        .setStyle(type === 'voice' ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setEmoji('🔊')
                );

            components.push(typeButtons);

            await interaction.editReply({ 
                embeds: [embed], 
                components: components,
                allowedMentions: { users: [] } 
            });

        } catch (error) {
            console.error('Error in leaderboard command:', error);
            try {
                await interaction.editReply('❌ An error occurred while fetching the leaderboard.');
            } catch {}
        }
    }
};

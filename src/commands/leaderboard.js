// src/commands/leaderboard.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

// Register custom fonts for wanted posters
try {
    registerFont(path.join(__dirname, '../../assets/fonts/Roboto-Bold.ttf'), { family: 'Roboto Bold' });
    registerFont(path.join(__dirname, '../../assets/fonts/Roboto-Regular.ttf'), { family: 'Roboto' });
    console.log('[DEBUG] Successfully registered custom fonts for wanted posters');
} catch (error) {
    console.log('[INFO] Custom fonts not found, using system fonts for wanted posters');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the server leaderboard')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of leaderboard')
                .addChoices(
                    { name: 'Total XP', value: 'xp' },
                    { name: 'Level', value: 'level' },
                    { name: 'Messages', value: 'messages' },
                    { name: 'Reactions', value: 'reactions' },
                    { name: 'Voice Time', value: 'voice' },
                    { name: 'Wanted Posters', value: 'posters' }
                )
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page number to view')
                .setMinValue(1)
                .setRequired(false)),

    async execute(interaction, client, xpTracker) {
        try {
            const type = interaction.options.getString('type') || 'xp';
            const page = interaction.options.getInteger('page') || 1;
            const guildId = interaction.guild.id;

            console.log(`[DEBUG] Leaderboard type: ${type}`);

            await interaction.deferReply();

            // Get guild settings to check for excluded role
            const guildSettings = global.guildSettings?.get(guildId) || {};
            const excludedRoleId = guildSettings.excludedRole;
            
            console.log(`[DEBUG] Excluded role ID: ${excludedRoleId}`);

            console.log('[DEBUG] Getting leaderboard from XP tracker...');

            // Get leaderboard data
            const leaderboardData = await xpTracker.getLeaderboard(guildId, page, 10);
            
            console.log(`[DEBUG] Raw users from database: ${leaderboardData?.users?.length || 0}`);

            if (!leaderboardData || !leaderboardData.users || leaderboardData.users.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('📊 Server Leaderboard')
                    .setDescription('No users found with XP data.')
                    .setColor('#FF0000')
                    .setTimestamp();
                
                return await interaction.editReply({ embeds: [embed] });
            }

            console.log('[DEBUG] Processing users...');

            // Filter out users with excluded role (if any)
            let filteredUsers = leaderboardData.users;
            if (excludedRoleId) {
                const guild = interaction.guild;
                filteredUsers = [];
                
                for (const user of leaderboardData.users) {
                    try {
                        const member = await guild.members.fetch(user.userId).catch(() => null);
                        if (!member || !member.roles.cache.has(excludedRoleId)) {
                            filteredUsers.push(user);
                        }
                    } catch (error) {
                        // If we can't fetch the member, include them in the leaderboard
                        filteredUsers.push(user);
                    }
                }
            }

            // Fix: Ensure filteredUsers is always an array
            if (!Array.isArray(filteredUsers)) {
                console.log('[DEBUG] filteredUsers is not an array, fixing...');
                filteredUsers = leaderboardData.users || [];
            }

            console.log(`[DEBUG] Filtered users count: ${filteredUsers.length}`);

            if (filteredUsers.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('📊 Server Leaderboard')
                    .setDescription('No eligible users found for the leaderboard.')
                    .setColor('#FF0000')
                    .setTimestamp();
                
                return await interaction.editReply({ embeds: [embed] });
            }

            if (type === 'posters') {
                // Generate wanted posters for top users
                await this.generateWantedPosters(interaction, filteredUsers.slice(0, 5));
            } else {
                // Create regular leaderboard embed
                const embed = await this.createLeaderboardEmbed(
                    interaction.guild,
                    filteredUsers,
                    type,
                    leaderboardData.pagination
                );

                // Create pagination buttons
                const buttons = this.createPaginationButtons(
                    leaderboardData.pagination.currentPage,
                    leaderboardData.pagination.totalPages,
                    type
                );

                await interaction.editReply({ 
                    embeds: [embed], 
                    components: buttons.length > 0 ? [buttons] : [] 
                });
            }

        } catch (error) {
            console.error('[ERROR] Error in leaderboard command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Failed to retrieve leaderboard. Please try again later.')
                .setColor('#FF0000')
                .setTimestamp();

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },

    async createLeaderboardEmbed(guild, users, type, pagination) {
        const typeLabels = {
            xp: 'Total XP',
            level: 'Level',
            messages: 'Messages',
            reactions: 'Reactions',
            voice: 'Voice Time'
        };

        const embed = new EmbedBuilder()
            .setTitle(`📊 ${typeLabels[type]} Leaderboard`)
            .setColor('#DC143C') // Marine red
            .setTimestamp()
            .setFooter({ 
                text: `Page ${pagination.currentPage} of ${pagination.totalPages} • ${pagination.totalUsers} total users` 
            });

        let description = '';
        
        // Ensure users is an array
        if (!Array.isArray(users)) {
            console.error('[ERROR] Users is not an array in createLeaderboardEmbed:', typeof users);
            users = [];
        }
        
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const member = guild.members.cache.get(user.userId);
            const username = member ? member.displayName : `Unknown User`;
            
            let value;
            switch (type) {
                case 'xp':
                    value = `${user.totalXP.toLocaleString()} XP`;
                    break;
                case 'level':
                    value = `Level ${user.level}`;
                    break;
                case 'messages':
                    value = `${user.messages.toLocaleString()} messages`;
                    break;
                case 'reactions':
                    value = `${user.reactions.toLocaleString()} reactions`;
                    break;
                case 'voice':
                    value = this.formatVoiceTime(user.voiceTime);
                    break;
                default:
                    value = `${user.totalXP.toLocaleString()} XP`;
            }

            // Add rank emoji for top 3
            let rankEmoji = '';
            if (user.rank === 1) rankEmoji = '🥇 ';
            else if (user.rank === 2) rankEmoji = '🥈 ';
            else if (user.rank === 3) rankEmoji = '🥉 ';

            description += `${rankEmoji}**${user.rank}.** ${username}\n${value}\n\n`;
        }

        embed.setDescription(description || 'No users found.');

        return embed;
    },

    async generateWantedPosters(interaction, topUsers) {
        try {
            if (!Array.isArray(topUsers)) {
                console.error('[ERROR] topUsers is not an array in generateWantedPosters:', typeof topUsers);
                topUsers = [];
            }

            if (topUsers.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('📜 Most Wanted Pirates')
                    .setDescription('No pirates found for wanted posters.')
                    .setColor('#DC143C');
                
                return await interaction.editReply({ embeds: [embed] });
            }

            const posters = [];
            
            for (let i = 0; i < Math.min(topUsers.length, 3); i++) {
                const user = topUsers[i];
                const member = interaction.guild.members.cache.get(user.userId);
                
                if (member) {
                    const posterBuffer = await this.createWantedPoster(member.user, user);
                    posters.push(new AttachmentBuilder(posterBuffer, { 
                        name: `wanted_${member.user.username.toLowerCase()}.png` 
                    }));
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('📜 **MOST WANTED PIRATES**')
                .setDescription(`The World Government has issued bounties for these dangerous criminals!`)
                .setColor('#DC143C')
                .setFooter({ text: 'Marine Intelligence • World Government Authorized' })
                .setTimestamp();

            await interaction.editReply({ 
                embeds: [embed], 
                files: posters 
            });

        } catch (error) {
            console.error('[ERROR] Error generating wanted posters:', error);
            
            const embed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Failed to generate wanted posters.')
                .setColor('#FF0000');

            await interaction.editReply({ embeds: [embed] });
        }
    },

    async createWantedPoster(user, userStats) {
        const canvas = createCanvas(400, 500);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#D2B48C'; // Parchment color
        ctx.fillRect(0, 0, 400, 500);

        // Border
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 8;
        ctx.strokeRect(10, 10, 380, 480);

        // Title
        ctx.fillStyle = '#8B0000';
        ctx.font = 'bold 36px Roboto Bold, Arial';
        ctx.textAlign = 'center';
        ctx.fillText('WANTED', 200, 60);

        // User avatar
        try {
            const avatar = await loadImage(user.displayAvatarURL({ extension: 'png', size: 256 }));
            ctx.drawImage(avatar, 100, 80, 200, 200);
        } catch (error) {
            // Placeholder if avatar fails to load
            ctx.fillStyle = '#7289DA';
            ctx.fillRect(100, 80, 200, 200);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '60px Arial';
            ctx.fillText('👤', 200, 200);
        }

        // "DEAD OR ALIVE"
        ctx.fillStyle = '#8B0000';
        ctx.font = 'bold 24px Roboto Bold, Arial';
        ctx.fillText('DEAD OR ALIVE', 200, 320);

        // Username
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 28px Roboto Bold, Arial';
        const username = user.username.toUpperCase();
        ctx.fillText(username, 200, 360);

        // Bounty
        const bounty = userStats.totalXP * 1000;
        ctx.fillStyle = '#8B0000';
        ctx.font = 'bold 32px Roboto Bold, Arial';
        ctx.fillText(`฿ ${bounty.toLocaleString()}`, 200, 410);

        // Level
        ctx.fillStyle = '#000000';
        ctx.font = '16px Roboto, Arial';
        ctx.fillText(`Level ${userStats.level}`, 200, 440);

        // Marine seal
        ctx.fillStyle = '#000000';
        ctx.font = '12px Roboto, Arial';
        ctx.fillText('MARINE HEADQUARTERS', 200, 470);

        return canvas.toBuffer('image/png');
    },

    createPaginationButtons(currentPage, totalPages, type) {
        if (totalPages <= 1) return [];

        const row = new ActionRowBuilder();

        // Previous button
        if (currentPage > 1) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`leaderboard_prev_${currentPage - 1}_${type}`)
                    .setLabel('← Previous')
                    .setStyle(ButtonStyle.Secondary)
            );
        }

        // Page info
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('leaderboard_info')
                .setLabel(`${currentPage}/${totalPages}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );

        // Next button
        if (currentPage < totalPages) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`leaderboard_next_${currentPage + 1}_${type}`)
                    .setLabel('Next →')
                    .setStyle(ButtonStyle.Secondary)
            );
        }

        return row;
    },

    formatVoiceTime(minutes) {
        if (!minutes || minutes === 0) return '0 minutes';
        
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        if (hours >= 24) {
            const days = Math.floor(hours / 24);
            const remainingHours = hours % 24;
            return `${days}d ${remainingHours}h`;
        } else if (hours > 0) {
            return `${hours}h ${remainingMinutes}m`;
        }
        return `${remainingMinutes}m`;
    }
};

// Handle button interactions for pagination
module.exports.handleButtonInteraction = async function(interaction, xpTracker) {
    if (!interaction.customId.startsWith('leaderboard_')) return;

    const parts = interaction.customId.split('_');
    if (parts.length < 3) return;

    const action = parts[1]; // prev, next, or info
    if (action === 'info') return; // Info button is disabled

    const page = parseInt(parts[2]);
    const type = parts[3] || 'xp';
    const guildId = interaction.guild.id;

    try {
        await interaction.deferUpdate();

        // Get leaderboard data for new page
        const leaderboardData = await xpTracker.getLeaderboard(guildId, page, 10);
        
        if (!leaderboardData || !leaderboardData.users || !Array.isArray(leaderboardData.users)) {
            return;
        }

        // Create updated embed
        const embed = await module.exports.createLeaderboardEmbed(
            interaction.guild,
            leaderboardData.users,
            type,
            leaderboardData.pagination
        );

        // Create updated buttons
        const buttons = module.exports.createPaginationButtons(
            leaderboardData.pagination.currentPage,
            leaderboardData.pagination.totalPages,
            type
        );

        await interaction.editReply({ 
            embeds: [embed], 
            components: buttons.length > 0 ? [buttons] : [] 
        });

    } catch (error) {
        console.error('[ERROR] Button interaction error:', error);
    }
};

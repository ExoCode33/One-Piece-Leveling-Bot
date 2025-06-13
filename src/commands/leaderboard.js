const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
// Get XP tracker instance from global
const getXPTracker = () => {
    return global.xpTracker;
};
const path = require('path');

// Register custom fonts
try {
    registerFont(path.join(__dirname, '../assets/fonts/onePiece.ttf'), { family: 'OnePiece' });
    registerFont(path.join(__dirname, '../assets/fonts/pirata.ttf'), { family: 'Pirata' });
} catch (error) {
    console.log('[DEBUG] Font registration failed, using system fonts');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Show server leaderboard')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of leaderboard to show')
                .setRequired(false)
                .addChoices(
                    { name: 'Top 3 Bounties', value: 'posters' },
                    { name: 'Top 10 Bounties', value: 'long' },
                    { name: 'All The Bounties', value: 'full' }
                )),

    async execute(interaction) {
        const isButton = interaction.isButton ? interaction.isButton() : false;
        const type = isButton ? interaction.customId.split('_')[1] : (interaction.options?.getString('type') || 'posters');

        console.log('[DEBUG] Leaderboard type:', type);

        try {
            // Get top users from database
            // Get excluded role ID from guild settings
            const settings = global.guildSettings?.get(interaction.guild.id) || {};
            const excludedRoleId = settings.excludedRole;

            if (!topUsers || topUsers.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('🏴‍☠️ No Bounties Found')
                    .setDescription('No pirates have earned bounties yet!')
                    .setColor('#FF6B35');

                if (isButton) {
                    return await interaction.update({ embeds: [embed], components: [] });
                } else {
                    return await interaction.reply({ embeds: [embed] });
                }
            }

            // Filter users and separate Pirate King
            const filteredUsers = [];
            let pirateKing = null;

            for (const user of topUsers) {
                try {
                    const member = await interaction.guild.members.fetch(user.userId).catch(() => null);
                    if (!member) continue;

                    if (excludedRoleId && member.roles.cache.has(excludedRoleId)) {
                        pirateKing = { ...user, member };
                    } else {
                        filteredUsers.push({ ...user, member });
                    }
                } catch (error) {
                    console.log('[DEBUG] Error fetching member:', user.userId);
                    continue;
                }
            }

            console.log('[DEBUG] Filtered users:', filteredUsers.length);
            console.log('[DEBUG] Pirate King found:', !!pirateKing);

            // Create navigation buttons
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('leaderboard_posters_1_xp')
                        .setLabel('Top 3 Bounties')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🏆'),
                    new ButtonBuilder()
                        .setCustomId('leaderboard_long_1_xp')
                        .setLabel('Top 10 Bounties')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📊'),
                    new ButtonBuilder()
                        .setCustomId('leaderboard_full_1_xp')
                        .setLabel('All The Bounties')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('📜')
                );

            if (type === 'posters') {
                // TOP 3 BOUNTIES - Show Pirate King + Top 3 with canvas and embeds
                const headerEmbed = new EmbedBuilder()
                    .setTitle('🏆 Top 3 Bounties')
                    .setDescription('The most notorious pirates in the server!')
                    .setColor('#FFD700');

                // Send header first
                if (isButton) {
                    await interaction.update({ embeds: [headerEmbed], components: [buttons] });
                } else {
                    await interaction.reply({ embeds: [headerEmbed], components: [buttons] });
                }

                // Create posters for Pirate King + Top 3
                const postersToShow = [];
                if (pirateKing) postersToShow.push(pirateKing);
                postersToShow.push(...filteredUsers.slice(0, 3));

                // Send each poster with embed
                for (let i = 0; i < postersToShow.length; i++) {
                    const userData = postersToShow[i];
                    const rank = pirateKing && userData === pirateKing ? 'PIRATE KING' : `RANK ${i + (pirateKing ? 0 : 1)}`;
                    
                    try {
                        const canvas = await createWantedPoster(userData, interaction.guild);
                        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `wanted_${userData.userId}.png` });
                        
                        // Create detailed embed for each poster
                        const embed = new EmbedBuilder()
                            .setColor(pirateKing && userData === pirateKing ? '#FF0000' : '#FF6B35')
                            .addFields(
                                { name: '🏴‍☠️ Rank', value: rank, inline: true },
                                { name: '🏴‍☠️ Pirate', value: userData.member.displayName, inline: true },
                                { name: '💰 Bounty', value: `฿${userData.xp.toLocaleString()}`, inline: true },
                                { name: '⚔️ Level', value: userData.level.toString(), inline: true },
                                { name: '💎 Total XP', value: userData.xp.toLocaleString(), inline: true },
                                { name: '⚡ Status', value: pirateKing && userData === pirateKing ? 'Excluded Role' : 'Notorious Criminal', inline: true }
                            )
                            .setImage(`attachment://wanted_${userData.userId}.png`)
                            .setFooter({ text: `Marine Intelligence • Report any sightings immediately • Bounty #${String(i + 1).padStart(3, '0')}` });

                        await interaction.followUp({ embeds: [embed], files: [attachment] });
                    } catch (error) {
                        console.log('[DEBUG] Error creating poster:', error);
                        continue;
                    }
                }

            } else if (type === 'long') {
                // TOP 10 BOUNTIES - Show Pirate King + Top 10 with canvas and embeds
                const headerEmbed = new EmbedBuilder()
                    .setTitle('📊 Top 10 Bounties')
                    .setDescription('The most wanted pirates in the server!')
                    .setColor('#4169E1');

                // Add Pirate King info to header if exists
                if (pirateKing) {
                    headerEmbed.addFields({
                        name: '👑 Pirate King',
                        value: `${pirateKing.member.displayName} - ฿${pirateKing.xp.toLocaleString()} (Level ${pirateKing.level}) - **Excluded Role**`,
                        inline: false
                    });
                }

                // Send header first
                if (isButton) {
                    await interaction.update({ embeds: [headerEmbed], components: [buttons] });
                } else {
                    await interaction.reply({ embeds: [headerEmbed], components: [buttons] });
                }

                // Create posters for Pirate King + Top 10
                const postersToShow = [];
                if (pirateKing) postersToShow.push(pirateKing);
                postersToShow.push(...filteredUsers.slice(0, 10));

                // Send each poster with embed
                for (let i = 0; i < postersToShow.length; i++) {
                    const userData = postersToShow[i];
                    const rank = pirateKing && userData === pirateKing ? 'PIRATE KING' : `RANK ${i + (pirateKing ? 0 : 1)}`;
                    
                    try {
                        const canvas = await createWantedPoster(userData, interaction.guild);
                        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `wanted_${userData.userId}.png` });
                        
                        // Create detailed embed for each poster
                        const embed = new EmbedBuilder()
                            .setColor(pirateKing && userData === pirateKing ? '#FF0000' : '#FF6B35')
                            .addFields(
                                { name: '🏴‍☠️ Rank', value: rank, inline: true },
                                { name: '🏴‍☠️ Pirate', value: userData.member.displayName, inline: true },
                                { name: '💰 Bounty', value: `฿${userData.xp.toLocaleString()}`, inline: true },
                                { name: '⚔️ Level', value: userData.level.toString(), inline: true },
                                { name: '💎 Total XP', value: userData.xp.toLocaleString(), inline: true },
                                { name: '⚡ Status', value: pirateKing && userData === pirateKing ? 'Excluded Role' : 'Notorious Criminal', inline: true }
                            )
                            .setImage(`attachment://wanted_${userData.userId}.png`)
                            .setFooter({ text: `Marine Intelligence • Report any sightings immediately • Bounty #${String(i + 1).padStart(3, '0')}` });

                        await interaction.followUp({ embeds: [embed], files: [attachment] });
                    } catch (error) {
                        console.log('[DEBUG] Error creating poster:', error);
                        continue;
                    }
                }

            } else if (type === 'full') {
                // ALL THE BOUNTIES - Text only, no canvas, level 1+
                const level1Plus = filteredUsers.filter(user => user.level >= 1);
                
                let content = '```\n📜 ALL THE BOUNTIES 📜\n';
                content += '═══════════════════════════════════════\n\n';

                if (pirateKing) {
                    content += `👑 PIRATE KING: ${pirateKing.member.displayName}\n`;
                    content += `   ฿${pirateKing.xp.toLocaleString()} | Level ${pirateKing.level} | Excluded Role\n\n`;
                }

                content += '🏴‍☠️ NOTORIOUS PIRATES:\n';
                content += '───────────────────────────────────────\n';

                level1Plus.forEach((user, index) => {
                    content += `${index + 1}. ${user.member.displayName}\n`;
                    content += `   ฿${user.xp.toLocaleString()} | Level ${user.level}\n`;
                });

                content += '\n═══════════════════════════════════════\n';
                content += `Total Pirates: ${level1Plus.length + (pirateKing ? 1 : 0)}\n`;
                content += '```';

                if (isButton) {
                    await interaction.update({ 
                        content: content, 
                        embeds: [], 
                        files: [], 
                        components: [buttons] 
                    });
                } else {
                    await interaction.reply({ 
                        content: content, 
                        components: [buttons] 
                    });
                }
            }

        } catch (error) {
            console.error('Error in leaderboard command:', error);
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Failed to load leaderboard. Please try again.')
                .setColor('#FF0000');

            if (isButton) {
                await interaction.update({ embeds: [errorEmbed], components: [] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }
};

async function createWantedPoster(userData, guild) {
    const canvas = createCanvas(400, 600);
    const ctx = canvas.getContext('2d');

    try {
        // Load background scroll texture
        const scrollPath = path.join(__dirname, '../assets/scroll.png');
        const scroll = await loadImage(scrollPath);
        console.log('[DEBUG] Successfully loaded scroll texture background');
        
        // Draw scroll background
        ctx.drawImage(scroll, 0, 0, 400, 600);
    } catch (error) {
        console.log('[DEBUG] Could not load scroll texture, using fallback background');
        // Fallback background
        const gradient = ctx.createLinearGradient(0, 0, 0, 600);
        gradient.addColorStop(0, '#8B4513');
        gradient.addColorStop(0.5, '#D2691E');
        gradient.addColorStop(1, '#8B4513');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 400, 600);
    }

    // Add wanted poster styling
    ctx.fillStyle = '#000';
    ctx.font = 'bold 28px OnePiece, serif';
    ctx.textAlign = 'center';
    ctx.fillText('WANTED', 200, 60);

    // User avatar
    try {
        const avatarUrl = userData.member.user.displayAvatarURL({ format: 'png', size: 256 });
        const avatar = await loadImage(avatarUrl);
        
        // Create circular mask for avatar
        ctx.save();
        ctx.beginPath();
        ctx.arc(200, 215, 125, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        
        // Draw avatar
        ctx.drawImage(avatar, 75, 90, 250, 250);
        ctx.restore();
        
        // Draw circular border
        ctx.beginPath();
        ctx.arc(200, 215, 125, 0, Math.PI * 2, true);
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 8;
        ctx.stroke();
        
        // Inner border
        ctx.beginPath();
        ctx.arc(200, 215, 125, 0, Math.PI * 2, true);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.stroke();
    } catch (error) {
        console.log('[DEBUG] Could not load user avatar');
        // Fallback avatar
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.arc(200, 215, 125, 0, Math.PI * 2, true);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.font = '48px Arial';
        ctx.fillText('?', 200, 230);
    }

    // "DEAD OR ALIVE" text
    ctx.fillStyle = '#000';
    ctx.font = 'bold 20px Pirata, serif';
    ctx.fillText('DEAD OR ALIVE', 200, 380);

    // Username
    ctx.font = 'bold 24px OnePiece, serif';
    const username = userData.member.displayName.toUpperCase();
    ctx.fillText(username, 200, 420);

    // Bounty amount
    ctx.fillStyle = '#8B0000';
    ctx.font = 'bold 32px OnePiece, serif';
    ctx.fillText(`฿ ${userData.xp.toLocaleString()}`, 200, 480);

    // Level indicator
    ctx.fillStyle = '#000';
    ctx.font = '16px Arial';
    ctx.fillText(`Level ${userData.level}`, 200, 520);

    // Marine stamp/signature
    ctx.font = '12px Arial';
    ctx.fillStyle = '#666';
    ctx.fillText('MARINE INTELLIGENCE', 200, 560);
    ctx.fillText('REPORT IMMEDIATELY', 200, 580);

    return canvas;
}

// Database functions - these now use the XP tracker class
async function getTopUsers(guildId, limit = 15) {
    const xpTracker = getXPTracker();
    if (!xpTracker) {
        console.error('[ERROR] XP Tracker not initialized');
        return [];
    }
    
    try {
        const users = await xpTracker.getLeaderboard(guildId);
        return users.slice(0, limit); // Limit results
    } catch (error) {
        console.error('[ERROR] Failed to get top users:', error);
        return [];
    }
}

async function getUserData(guildId, userId) {
    const xpTracker = getXPTracker();
    if (!xpTracker) {
        console.error('[ERROR] XP Tracker not initialized');
        return null;
    }
    
    try {
        return await xpTracker.getUserStats(userId, guildId);
    } catch (error) {
        console.error('[ERROR] Failed to get user data:', error);
        return null;
    }
}

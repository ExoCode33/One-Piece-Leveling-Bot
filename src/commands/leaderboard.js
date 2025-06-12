// src/commands/leaderboard.js - One Piece Themed Leaderboard with Custom Fonts
const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getBountyForLevel, PIRATE_KING_BOUNTY } = require('../utils/bountySystem');
const Canvas = require('canvas');
const path = require('path');

const LEADERBOARD_EXCLUDE_ROLE = process.env.LEADERBOARD_EXCLUDE_ROLE; // Pirate King Role ID
const berryPath = path.join(__dirname, '../../assets/berry.png'); // Make sure your berry.png is here
const onePieceLogoPath = path.join(__dirname, '../../assets/one-piece-symbol.png'); // One Piece logo

// Register custom fonts
try {
    Canvas.registerFont(path.join(__dirname, '../../assets/fonts/captkd.ttf'), { family: 'CaptainKiddNF' });
    Canvas.registerFont(path.join(__dirname, '../../assets/fonts/Cinzel-Regular.otf'), { family: 'Cinzel' });
    Canvas.registerFont(path.join(__dirname, '../../assets/fonts/Times New Normal Regular.ttf'), { family: 'TimesNewNormal' });
    console.log('[DEBUG] Successfully registered custom fonts for wanted posters');
} catch (error) {
    console.error('[ERROR] Failed to register custom fonts:', error.message);
    console.log('[INFO] Falling back to system fonts');
}

function pirateRankEmoji(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '🏴‍☠️';
}

// Utility: draw wanted poster with PERFECT layout matching specifications
async function createWantedPoster(user, rank, bounty, guild) {
    const width = 600, height = 900;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Clean parchment background - flat color, no heavy grain
    ctx.fillStyle = '#f5e6c5'; // Light tan parchment color
    ctx.fillRect(0, 0, width, height);
    
    // Only essential borders - thin red/black as in reference
    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, width, height);
    
    ctx.strokeStyle = '#CD853F';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, width - 20, height - 20);
    
    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, width - 36, height - 36);

    // WANTED title - Size 24, Horiz 55, Vert 93 (93% from bottom = near top)
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '72px CaptainKiddNF, Arial, sans-serif'; // Size 24/100 * 300 = 72px
    const wantedY = height * (1 - 93/100); // Vert 93: 93% from bottom = 7% from top
    const wantedX = (55/100) * width; // Horiz 55: 55% from left
    ctx.fillText('WANTED', wantedX, wantedY);

    // Image Box - Size 62, Horiz 50, Vert 73 (73% from bottom = upper middle)
    const photoSize = (62/100) * 400; // Size 62/100 * reasonable max = 248px
    const photoX = ((50/100) * width) - (photoSize/2); // Horiz 50: centered
    const photoY = height * (1 - 73/100) - (photoSize/2); // Vert 73: 73% from bottom
    
    // Single thin black border only
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(photoX, photoY, photoSize, photoSize);
    
    // White background
    ctx.fillStyle = '#fff';
    ctx.fillRect(photoX + 1, photoY + 1, photoSize - 2, photoSize - 2);

    let member = null;
    try {
        if (guild && user.userId) member = await guild.members.fetch(user.userId);
    } catch {}
    
    const avatarArea = { x: photoX + 5, y: photoY + 5, width: photoSize - 10, height: photoSize - 10 };
    if (member) {
        try {
            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true });
            const avatar = await Canvas.loadImage(avatarURL);
            
            ctx.save();
            ctx.beginPath();
            ctx.rect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
            ctx.clip();
            
            // Subtle weathering effect
            ctx.filter = 'contrast(0.95) sepia(0.05)';
            ctx.drawImage(avatar, avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
            ctx.filter = 'none';
            
            ctx.restore();
        } catch {
            ctx.fillStyle = '#ddd';
            ctx.fillRect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
        }
    } else {
        ctx.fillStyle = '#ddd';
        ctx.fillRect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
    }

    // "DEAD OR ALIVE" - Size 20, Horiz 50, Vert 45 (45% from bottom = middle)
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '60px CaptainKiddNF, Arial, sans-serif'; // Size 20/100 * 300 = 60px
    const deadOrAliveY = height * (1 - 45/100); // Vert 45: 45% from bottom
    const deadOrAliveX = (50/100) * width; // Horiz 50: centered
    ctx.fillText('DEAD OR ALIVE', deadOrAliveX, deadOrAliveY);

    // Name ("SHANKS") - Size 20, Horiz 50, Vert 35 (35% from bottom = lower middle)
    ctx.font = '60px CaptainKiddNF, Arial, sans-serif'; // Size 20/100 * 300 = 60px
    let displayName = 'UNKNOWN PIRATE';
    if (member) displayName = member.displayName.replace(/[^\w\s-]/g, '').toUpperCase().substring(0, 16);
    else if (user.userId) displayName = `PIRATE ${user.userId.slice(-4)}`;
    
    // Check if name is too long and adjust
    ctx.textAlign = 'center';
    let nameWidth = ctx.measureText(displayName).width;
    if (nameWidth > width - 60) {
        ctx.font = '48px CaptainKiddNF, Arial, sans-serif';
    }
    
    const nameY = height * (1 - 35/100); // Vert 35: 35% from bottom
    const nameX = (50/100) * width; // Horiz 50: centered
    ctx.fillText(displayName, nameX, nameY);

    // Berry Symbol - Size 16, Horiz 42, Vert 25 (25% from bottom = lower area)
    const berrySize = (16/100) * 150; // Size 16/100 * reasonable max = 24px
    const berryX = ((42/100) * width) - (berrySize/2); // Horiz 42: left of center
    const berryY = height * (1 - 25/100) - (berrySize/2); // Vert 25: 25% from bottom
    
    let berryImg;
    try {
        berryImg = await Canvas.loadImage(berryPath);
    } catch {
        // Create simple berry symbol
        const berryCanvas = Canvas.createCanvas(berrySize, berrySize);
        const berryCtx = berryCanvas.getContext('2d');
        berryCtx.fillStyle = '#111';
        berryCtx.font = `bold ${berrySize}px serif`;
        berryCtx.textAlign = 'center';
        berryCtx.textBaseline = 'middle';
        berryCtx.fillText('฿', berrySize/2, berrySize/2);
        berryImg = berryCanvas;
    }
    
    ctx.drawImage(berryImg, berryX, berryY, berrySize, berrySize);

    // Bounty Numbers - Size 20, Horiz 58, Vert 25 (25% from bottom = same level as berry)
    const bountyStr = bounty.toLocaleString();
    ctx.font = '60px Cinzel, Georgia, serif'; // Size 20/100 * 300 = 60px
    const bountyX = (58/100) * width; // Horiz 58: right of center
    const bountyY = height * (1 - 25/100); // Vert 25: 25% from bottom
    
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111';
    ctx.fillText(bountyStr, bountyX, bountyY);

    // One Piece logo - Size 12, Horiz 50, Vert 10 (10% from bottom = near bottom)
    try {
        const onePieceLogo = await Canvas.loadImage(onePieceLogoPath);
        const logoSize = (12/100) * 200; // Size 12/100 * reasonable max = 24px
        const logoX = ((50/100) * width) - (logoSize/2); // Horiz 50: centered
        const logoY = height * (1 - 10/100) - (logoSize/2); // Vert 10: 10% from bottom
        
        ctx.globalAlpha = 0.6;
        ctx.filter = 'sepia(0.2) brightness(0.9)';
        ctx.drawImage(onePieceLogo, logoX, logoY, logoSize, logoSize);
        ctx.globalAlpha = 1.0;
        ctx.filter = 'none';
    } catch {
        console.log('One Piece logo not found at assets/one-piece-symbol.png');
    }

    // "MARINE" - Size 6, Horiz 98, Vert 3 (3% from bottom = very bottom right)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font = '18px TimesNewNormal, Times, serif'; // Size 6/100 * 300 = 18px
    ctx.fillStyle = '#111';
    
    const marineText = 'M A R I N E';
    const marineX = (98/100) * width; // Horiz 98: far right
    const marineY = height * (1 - 3/100); // Vert 3: 3% from bottom
    ctx.fillText(marineText, marineX, marineY);

    return canvas.toBuffer('image/png');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the most notorious pirates!')
        .addStringOption(option =>
            option.setName('view')
                .setDescription('Leaderboard type')
                .setRequired(false)
                .addChoices(
                    { name: 'Top 3 Wanted Posters', value: 'posters' },
                    { name: 'Top 10 List', value: 'long' },
                    { name: 'Full Leaderboard', value: 'full' }
                )
        ),
    async execute(interaction, client, xpTracker) {
        let guild = interaction.guild;
        let guildId = interaction.guildId;
        if (!guild && guildId) {
            try {
                guild = await client.guilds.fetch(guildId);
            } catch (err) {
                return interaction.reply({ content: "Could not resolve server info.", ephemeral: true });
            }
        }
        if (!guild || !guildId) {
            return interaction.reply({ content: "This command can only be used in a server, not in DMs.", ephemeral: true });
        }

        const view = interaction.options.getString('view') || 'posters';

        let leaderboard;
        try {
            leaderboard = await xpTracker.getLeaderboard(guildId);
        } catch (err) {
            return interaction.reply({ content: "Database error occurred. Please try again later.", ephemeral: true });
        }
        if (!leaderboard || !Array.isArray(leaderboard)) {
            return interaction.reply({ content: "No leaderboard data available.", ephemeral: true });
        }

        // Pirate King detection
        let pirateKingUser = null;
        if (LEADERBOARD_EXCLUDE_ROLE) {
            try {
                const members = await guild.members.fetch();
                const king = members.find(m => m.roles.cache.has(LEADERBOARD_EXCLUDE_ROLE));
                if (king) {
                    pirateKingUser = leaderboard.find(u => u.userId === king.user.id);
                    if (pirateKingUser) {
                        leaderboard = leaderboard.filter(u => u.userId !== king.user.id);
                    }
                }
            } catch { pirateKingUser = null; }
        }
        if (!pirateKingUser && leaderboard.length > 0 && leaderboard[0].level >= 50) {
            pirateKingUser = leaderboard[0];
            leaderboard = leaderboard.slice(1);
        }

        leaderboard = leaderboard.filter(user => user && typeof user.xp === 'number');
        leaderboard.sort((a, b) => b.xp - a.xp);

        // Create navigation buttons
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('leaderboard_posters_1_xp')
                .setLabel('🎯 Top 3 Posters')
                .setStyle(view === 'posters' ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('leaderboard_long_1_xp')
                .setLabel('📋 Top 10 List')
                .setStyle(view === 'long' ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('leaderboard_full_1_xp')
                .setLabel('📜 Full Board')
                .setStyle(view === 'full' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        );

        if (view === 'posters') {
            // Top 3 posters (Pirate King + 3 best)
            const topThree = leaderboard.slice(0, 3);
            const allPirates = [];
            if (pirateKingUser) allPirates.push({ user: pirateKingUser, rank: 'KING', isPirateKing: true });
            for (let i = 0; i < topThree.length; i++) {
                allPirates.push({ user: topThree[i], rank: i + 1, isPirateKing: false });
            }
            // Header
            const headerEmbed = new EmbedBuilder()
                .setColor(0x8B0000)
                .setTitle('🏴‍☠️ MOST WANTED PIRATES 🏴‍☠️')
                .setDescription('The World Government has issued these bounties for the most dangerous criminals on the Grand Line.\n\u200B')
                .setFooter({ text: 'World Government • Marine Headquarters • Justice Will Prevail' })
                .setTimestamp();
            await interaction.reply({ embeds: [headerEmbed], components: [row] });

            // Posters
            for (let i = 0; i < Math.min(allPirates.length, 4); i++) {
                const pirate = allPirates[i];
                const user = pirate.user;
                const rank = pirate.rank;
                const bounty = pirate.isPirateKing ? PIRATE_KING_BOUNTY : getBountyForLevel(user.level);
                try {
                    const posterBuffer = await createWantedPoster(user, rank, bounty, guild);
                    if (posterBuffer) {
                        const attachment = new AttachmentBuilder(posterBuffer, { name: `wanted_poster_${i + 1}.png` });
                        const posterEmbed = new EmbedBuilder()
                            .setColor(pirate.isPirateKing ? 0xFFD700 : 0x8B0000)
                            .setTitle(pirate.isPirateKing ? '👑 PIRATE KING' : `${pirateRankEmoji(rank)} RANK ${rank}`)
                            .addFields(
                                { name: '🏴‍☠️ Pirate', value: `<@${user.userId}>`, inline: true },
                                { name: '💰 Bounty', value: `${bounty.toLocaleString()}`, inline: true },
                                { name: '⚔️ Level', value: `${user.level}`, inline: true },
                                { name: '💎 Total XP', value: `${user.xp.toLocaleString()}`, inline: true },
                                { name: '📍 Status', value: pirate.isPirateKing ? 'Ruler of the Grand Line' :
                                    rank === 1 ? 'Most Dangerous Pirate' : 
                                    rank === 2 ? 'Rising Star' : 'Notorious Criminal', inline: true }
                            )
                            .setImage(`attachment://wanted_poster_${i + 1}.png`)
                            .setFooter({ text: `Marine Intelligence • Report any sightings immediately • Bounty #${String(i + 1).padStart(3, '0')}` });
                        await interaction.followUp({ embeds: [posterEmbed], files: [attachment] });
                    }
                } catch (e) { 
                    console.error('Error creating poster:', e);
                }
            }
            return;
        } else if (view === 'full') {
            // Full text list
            let text = '🏴‍☠️ **COMPLETE PIRATE REGISTRY** 🏴‍☠️\n\n';
            let rank = 1;
            if (pirateKingUser) {
                text += `👑 **PIRATE KING**: <@${pirateKingUser.userId}> - Level ${pirateKingUser.level} - ฿${PIRATE_KING_BOUNTY.toLocaleString()}\n\n`;
            }
            for (const user of leaderboard) {
                const bounty = getBountyForLevel(user.level);
                text += `${pirateRankEmoji(rank)} **${rank}.** <@${user.userId}> — Level **${user.level}** — ฿**${bounty.toLocaleString()}**\n`;
                rank++;
            }
            if (leaderboard.length === 0) {
                text += "No pirates have earned any bounty yet! Set sail and make your mark on the Grand Line!";
            }
            const finalText = text.length > 1900 ? text.slice(0, 1900) + '\n... (truncated)' : text;
            return interaction.reply({ content: finalText, components: [row], embeds: [] });
        } else {
            // Top 10 embed
            const embed = new EmbedBuilder()
                .setColor(0x8B0000)
                .setTitle('🏴‍☠️ Top 10 Most Wanted Pirates')
                .setDescription('The most notorious criminals on the Grand Line!')
                .setFooter({ text: 'Marine Intelligence • World Government Bounty Board' })
                .setTimestamp();
            let description = '';
            if (pirateKingUser) {
                description += `👑 **PIRATE KING**: <@${pirateKingUser.userId}>\nLevel ${pirateKingUser.level} • ฿${PIRATE_KING_BOUNTY.toLocaleString()}\n\n`;
            }
            const topTen = leaderboard.slice(0, 10);
            for (let i = 0; i < topTen.length; i++) {
                const user = topTen[i];
                const rank = i + 1;
                const bounty = getBountyForLevel(user.level);
                description += `${pirateRankEmoji(rank)} **${rank}.** <@${user.userId}>\nLevel ${user.level} • ฿${bounty.toLocaleString()}\n\n`;
            }
            if (topTen.length === 0) {
                description = "No pirates have earned any bounty yet! Set sail and make your mark on the Grand Line!";
            }
            embed.setDescription(description);
            return interaction.reply({ embeds: [embed], components: [row] });
        }
    },
};

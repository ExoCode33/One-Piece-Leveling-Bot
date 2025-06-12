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

// Utility: draw wanted poster with CUSTOM FONTS and enhanced styling
async function createWantedPoster(user, rank, bounty, guild) {
    const width = 600, height = 900;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Create aged parchment background with subtle texture
    ctx.fillStyle = '#F5DEB3';
    ctx.fillRect(0, 0, width, height);
    
    // Add subtle aging texture
    for (let i = 0; i < 150; i++) {
        ctx.fillStyle = `rgba(139, 69, 19, ${Math.random() * 0.08})`;
        ctx.fillRect(Math.random() * width, Math.random() * height, Math.random() * 3, Math.random() * 3);
    }
    
    // Outer red border
    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, width, height);
    
    // Thin inner border for softening
    ctx.strokeStyle = '#CD853F';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, width - 24, height - 24);
    
    // Main inner border
    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    // WANTED header - Using Captain Kidd NF font with refined spacing and positioning
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '80px CaptainKiddNF, Arial, sans-serif'; // Captain Kidd NF font for WANTED
    const wantedY = height * 0.05 + 40; // Position at 5% from top edge
    
    // Measure and adjust letter spacing for visual balance
    ctx.letterSpacing = '-2px'; // Reduce kerning slightly
    ctx.fillText('WANTED', width / 2, wantedY);

    // Profile picture - Perfectly square with enhanced framing (35-40% of poster height)
    const photoSize = Math.floor(height * 0.37); // 37% of total height for perfect proportions
    const photoX = (width - photoSize) / 2;
    const photoY = wantedY + 50; // Positioned with equal margins
    
    // Outer red border
    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 7;
    ctx.strokeRect(photoX, photoY, photoSize, photoSize);
    
    // Thin black outline for double-framed border effect
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(photoX - 2, photoY - 2, photoSize + 4, photoSize + 4);
    
    // Inner thin black border for inked look
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(photoX + 5, photoY + 5, photoSize - 10, photoSize - 10);
    
    // White background
    ctx.fillStyle = '#fff';
    ctx.fillRect(photoX, photoY, photoSize, photoSize);

    let member = null;
    try {
        if (guild && user.userId) member = await guild.members.fetch(user.userId);
    } catch {}
    const avatarArea = { x: photoX + 7, y: photoY + 7, width: photoSize - 14, height: photoSize - 14 };
    if (member) {
        try {
            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true });
            const avatar = await Canvas.loadImage(avatarURL);
            
            // Apply weathered effect to image
            ctx.save();
            ctx.beginPath();
            ctx.rect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
            ctx.clip();
            
            // Slightly reduce contrast and add sepia tone for weathered look
            ctx.filter = 'contrast(0.9) sepia(0.1)';
            ctx.drawImage(avatar, avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
            
            // Add subtle paper texture overlay
            ctx.filter = 'none';
            ctx.fillStyle = 'rgba(245, 222, 179, 0.15)'; // Very light parchment overlay
            ctx.fillRect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
            
            ctx.restore();
        } catch {
            ctx.fillStyle = '#ddd';
            ctx.fillRect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
        }
    } else {
        ctx.fillStyle = '#ddd';
        ctx.fillRect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
    }

    // DEAD OR ALIVE - Refined sizing and spacing
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '51px CaptainKiddNF, Arial, sans-serif'; // Reduced to 90% of 57px
    ctx.letterSpacing = '-1px'; // Reduce letter spacing by 10-15%
    const deadOrAliveY = photoY + photoSize + 20;
    ctx.fillText('DEAD OR ALIVE', width / 2, deadOrAliveY);

    // Pirate name - Increased size and closer positioning with pixel-perfect centering
    ctx.font = '71px CaptainKiddNF, Arial, sans-serif'; // Increased by 15% from 62px
    ctx.letterSpacing = '0px'; // Reset letter spacing for name
    let displayName = 'UNKNOWN PIRATE';
    if (member) displayName = member.displayName.replace(/[^\w\s-]/g, '').toUpperCase().substring(0, 16);
    else if (user.userId) displayName = `PIRATE ${user.userId.slice(-4)}`;
    
    // Check if name is too long and adjust font size
    ctx.textAlign = 'center';
    let nameWidth = ctx.measureText(displayName).width;
    if (nameWidth > width - 80) {
        ctx.font = '58px CaptainKiddNF, Arial, sans-serif'; // Increased proportionally from 50px
        nameWidth = ctx.measureText(displayName).width;
    }
    
    const nameY = deadOrAliveY + 55; // Pulled closer to "DEAD OR ALIVE"
    ctx.fillStyle = '#111';
    // Pixel-perfect horizontal centering
    const nameX = width / 2;
    ctx.fillText(displayName, nameX, nameY);

    // Bounty section - Properly positioned on separate line, centered
    const bountyY = nameY + 80; // Proper spacing below the name
    let berryImg;
    try {
        berryImg = await Canvas.loadImage(berryPath);
    } catch {
        console.log('Berry icon not found, creating placeholder...');
        const berryCanvas = Canvas.createCanvas(50, 50);
        const berryCtx = berryCanvas.getContext('2d');
        berryCtx.fillStyle = '#111';
        berryCtx.font = 'bold 40px serif';
        berryCtx.textAlign = 'center';
        berryCtx.textBaseline = 'middle';
        berryCtx.fillText('฿', 25, 25);
        berryImg = berryCanvas;
    }
    
    // Bounty with Cinzel font, properly centered
    const berryHeight = 45, berryWidth = 45;
    const bountyStr = bounty.toLocaleString();
    ctx.font = '63px Cinzel, Georgia, serif'; // Reduced size as requested
    ctx.letterSpacing = '0px';
    const gap = 12;
    
    // Center the entire bounty line (berry + number)
    const bountyTextWidth = ctx.measureText(bountyStr).width;
    const totalBountyWidth = berryWidth + gap + bountyTextWidth;
    const bountyStartX = (width - totalBountyWidth) / 2;
    
    // Draw berry icon with proper vertical alignment
    const textMetrics = ctx.measureText(bountyStr);
    const textHeight = textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent;
    const berryY = bountyY - (textHeight / 2) - (berryHeight / 2) + 8;
    
    ctx.drawImage(berryImg, bountyStartX, berryY, berryWidth, berryHeight);
    
    // Draw bounty text properly aligned
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111';
    ctx.fillText(bountyStr, bountyStartX + berryWidth + gap, bountyY);

    // MARINE text - More subtle, tighter spacing, better positioning
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font = '18px TimesNewNormal, Times, serif'; // Reduced by 18% (22px → 18px)
    ctx.letterSpacing = '-0.5px'; // Tighter letter spacing
    
    // Create tighter letter-spaced effect for MARINE text
    const marineText = 'M A R I N E';
    // Move in from edge with more padding (15px instead of 5px from calculations)
    ctx.fillText(marineText, width - 55, height - 50);

    // Add One Piece logo at bottom center - smaller and with parchment tone
    try {
        const onePieceLogo = await Canvas.loadImage(onePieceLogoPath);
        const logoSize = 48; // Reduced to 80% of 60px
        const logoX = (width - logoSize) / 2;
        const logoY = height - 120; // Position above MARINE text with more space
        
        // Apply parchment tone and slight transparency for authentic integration
        ctx.globalAlpha = 0.7;
        ctx.filter = 'sepia(0.3) brightness(0.9)'; // Yellowed/parchment effect
        ctx.drawImage(onePieceLogo, logoX, logoY, logoSize, logoSize);
        ctx.globalAlpha = 1.0; // Reset transparency
        ctx.filter = 'none'; // Reset filter
    } catch {
        // Logo not found, continue without it
        console.log('One Piece logo not found at assets/one-piece-symbol.png');
    }

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

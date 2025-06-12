// src/commands/leaderboard.js - One Piece Themed Leaderboard with Canvas Poster

const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getBountyForLevel, PIRATE_KING_BOUNTY } = require('../utils/bountySystem');
const Canvas = require('canvas');
const path = require('path');

const LEADERBOARD_EXCLUDE_ROLE = process.env.LEADERBOARD_EXCLUDE_ROLE; // Pirate King Role ID

// Register custom pirate font if available
try {
    Canvas.registerFont(path.join(__dirname, '../../assets/fonts/pirate.ttf'), { family: 'PirateFont' });
} catch {
    // Will fallback to Impact/Arial
}

function pirateRankEmoji(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '🏴‍☠️';
}

function getThreatLevelShort(level) {
    if (level >= 50) return 'YONKO CLASS';
    if (level >= 45) return 'DEVIL FRUIT USER';
    if (level >= 40) return 'VICE ADMIRAL RIVAL';
    if (level >= 35) return 'CREW CAPTAIN';
    if (level >= 30) return 'MASTER COMBATANT';
    if (level >= 25) return 'EXTREMELY DANGEROUS';
    if (level >= 20) return 'CAPTAIN LEVEL';
    if (level >= 15) return 'GRAND LINE PIRATE';
    if (level >= 10) return 'SQUAD DESTROYER';
    if (level >= 5) return 'WANTED CRIMINAL';
    return 'ROOKIE PIRATE';
}

// Utility to format numbers with commas
function formatCommas(n) {
    return n.toLocaleString();
}

// Utility to draw text safely
function drawTextSafe(ctx, text, x, y, maxWidth = null) {
    try {
        if (maxWidth) {
            ctx.fillText(text, x, y, maxWidth);
        } else {
            ctx.fillText(text, x, y);
        }
    } catch (e) {}
}

// Poster generation function (matching HTML styling exactly)
async function createWantedPoster(user, rank, bounty, guild) {
    const CANVAS_WIDTH = 400;
    const CANVAS_HEIGHT = 600;
    const ctxFont = (style, size) => `${style ? style + ' ' : ''}${size}px PirateFont, Impact, serif, sans-serif`;

    try {
        const canvas = Canvas.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
        const ctx = canvas.getContext('2d');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // --- Background (F5DEB3 - wheat color) ---
        ctx.fillStyle = '#F5DEB3';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // --- Main border (8px solid #8B0000) ---
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, CANVAS_WIDTH - 8, CANVAS_HEIGHT - 8);

        // --- Inner border area (10px margin from main border) ---
        const innerX = 14;
        const innerY = 14;
        const innerWidth = CANVAS_WIDTH - 28;
        const innerHeight = CANVAS_HEIGHT - 28;
        ctx.fillStyle = '#F5DEB3';
        ctx.fillRect(innerX, innerY, innerWidth, innerHeight);

        // --- Header: WANTED (56px, bold, centered, letter-spacing) ---
        ctx.font = ctxFont('bold', 56);
        ctx.fillStyle = '#8B0000';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.shadowBlur = 4;
        
        // Manual letter spacing for WANTED
        const wantedText = 'WANTED';
        const letterSpacing = 6;
        let totalWidth = 0;
        for (let i = 0; i < wantedText.length; i++) {
            totalWidth += ctx.measureText(wantedText[i]).width + (i < wantedText.length - 1 ? letterSpacing : 0);
        }
        let startX = (CANVAS_WIDTH - totalWidth) / 2;
        for (let i = 0; i < wantedText.length; i++) {
            ctx.fillText(wantedText[i], startX, 94); // Height: 80px from top + half
            startX += ctx.measureText(wantedText[i]).width + letterSpacing;
        }
        
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // --- Photo Frame (280x200, 4px border, centered) ---
        const photoY = 94 + 40; // After WANTED text + spacing
        const photoW = 280;
        const photoH = 200;
        const photoX = (CANVAS_WIDTH - photoW) / 2;
        
        // White background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(photoX, photoY, photoW, photoH);
        
        // 4px border
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 4;
        ctx.strokeRect(photoX, photoY, photoW, photoH);

        // Avatar inside frame
        let member = null;
        try {
            if (guild && user.userId) member = await guild.members.fetch(user.userId);
        } catch {}
        
        const avatarArea = { x: photoX + 4, y: photoY + 4, width: photoW - 8, height: photoH - 8 };
        if (member) {
            try {
                const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
                const avatar = await Canvas.loadImage(avatarURL);
                ctx.save();
                ctx.beginPath();
                ctx.rect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
                ctx.clip();
                ctx.drawImage(avatar, avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
                ctx.restore();
            } catch {
                ctx.fillStyle = '#ddd'; 
                ctx.fillRect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
            }
        } else {
            ctx.fillStyle = '#ddd'; 
            ctx.fillRect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
        }

        // --- DEAD OR ALIVE (32px, bold, letter-spacing: 2px) ---
        ctx.font = ctxFont('bold', 32);
        ctx.fillStyle = '#8B0000';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.shadowBlur = 2;
        
        const deadOrAliveText = 'DEAD OR ALIVE';
        const deadLetterSpacing = 2;
        let deadTotalWidth = 0;
        for (let i = 0; i < deadOrAliveText.length; i++) {
            deadTotalWidth += ctx.measureText(deadOrAliveText[i]).width + (i < deadOrAliveText.length - 1 ? deadLetterSpacing : 0);
        }
        let deadStartX = (CANVAS_WIDTH - deadTotalWidth) / 2;
        const deadY = photoY + photoH + 25;
        for (let i = 0; i < deadOrAliveText.length; i++) {
            ctx.fillText(deadOrAliveText[i], deadStartX, deadY);
            deadStartX += ctx.measureText(deadOrAliveText[i]).width + deadLetterSpacing;
        }

        // --- Name (48px, bold, letter-spacing: 6px) ---
        ctx.font = ctxFont('bold', 48);
        ctx.fillStyle = '#8B0000';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.shadowBlur = 4;
        
        let displayName = 'UNKNOWN PIRATE';
        if (member) displayName = member.displayName.replace(/[^\w\s-]/g, '').toUpperCase().substring(0, 16);
        else if (user.userId) displayName = `PIRATE ${user.userId.slice(-4)}`;
        
        const nameLetterSpacing = 6;
        let nameTotalWidth = 0;
        for (let i = 0; i < displayName.length; i++) {
            nameTotalWidth += ctx.measureText(displayName[i]).width + (i < displayName.length - 1 ? nameLetterSpacing : 0);
        }
        let nameStartX = (CANVAS_WIDTH - nameTotalWidth) / 2;
        const nameY = deadY + 48;
        for (let i = 0; i < displayName.length; i++) {
            ctx.fillText(displayName[i], nameStartX, nameY);
            nameStartX += ctx.measureText(displayName[i]).width + nameLetterSpacing;
        }

        // --- Bounty (44px + 48px berry symbol, bold) ---
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.shadowBlur = 4;
        
        const bountyY = nameY + 50;
        
        // Berry symbol (48px)
        ctx.font = ctxFont('bold', 48);
        ctx.fillStyle = '#8B0000';
        const berrySymbol = '₿';
        const berryWidth = ctx.measureText(berrySymbol).width;
        
        // Bounty amount (44px)
        ctx.font = ctxFont('bold', 44);
        const bountyText = formatCommas(bounty);
        const bountyWidth = ctx.measureText(bountyText).width;
        
        // Center both with 8px gap
        const gap = 8;
        const totalBountyWidth = berryWidth + gap + bountyWidth;
        const bountyStartX = (CANVAS_WIDTH - totalBountyWidth) / 2;
        
        // Draw berry symbol
        ctx.font = ctxFont('bold', 48);
        ctx.fillText(berrySymbol, bountyStartX + berryWidth/2, bountyY);
        
        // Draw bounty amount
        ctx.font = ctxFont('bold', 44);
        ctx.fillText(bountyText, bountyStartX + berryWidth + gap + bountyWidth/2, bountyY);

        // --- MARINE text (bottom right, 18px, bold) ---
        ctx.font = ctxFont('bold', 18);
        ctx.fillStyle = '#8B0000';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.shadowBlur = 2;
        ctx.textAlign = 'right';
        ctx.fillText('MARINE', CANVAS_WIDTH - 25, CANVAS_HEIGHT - 15);
        
        // Reset shadow
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        return canvas.toBuffer('image/png');
    } catch (error) {
        console.error('Poster error:', error);
        return null;
    }
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
                                { name: '💰 Bounty', value: `₿${bounty.toLocaleString()}`, inline: true },
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
                } catch (e) { }
            }
            return;
        } else if (view === 'full') {
            // Full text list
            let text = '🏴‍☠️ **COMPLETE PIRATE REGISTRY** 🏴‍☠️\n\n';
            let rank = 1;
            if (pirateKingUser) {
                text += `👑 **PIRATE KING**: <@${pirateKingUser.userId}> - Level ${pirateKingUser.level} - ₿${PIRATE_KING_BOUNTY.toLocaleString()}\n\n`;
            }
            for (const user of leaderboard) {
                const bounty = getBountyForLevel(user.level);
                text += `${pirateRankEmoji(rank)} **${rank}.** <@${user.userId}> — Level **${user.level}** — ₿**${bounty.toLocaleString()}**\n`;
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
                description += `👑 **PIRATE KING**: <@${pirateKingUser.userId}>\nLevel ${pirateKingUser.level} • ₿${PIRATE_KING_BOUNTY.toLocaleString()}\n\n`;
            }
            const topTen = leaderboard.slice(0, 10);
            for (let i = 0; i < topTen.length; i++) {
                const user = topTen[i];
                const rank = i + 1;
                const bounty = getBountyForLevel(user.level);
                description += `${pirateRankEmoji(rank)} **${rank}.** <@${user.userId}>\nLevel ${user.level} • ₿${bounty.toLocaleString()} • ${getThreatLevelShort(user.level)}\n\n`;
            }
            if (topTen.length === 0) {
                description = "No pirates have earned any bounty yet! Set sail and make your mark on the Grand Line!";
            }
            embed.setDescription(description);
            return interaction.reply({ embeds: [embed], components: [row] });
        }
    },
};

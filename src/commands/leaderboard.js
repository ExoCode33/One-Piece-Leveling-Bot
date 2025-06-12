// src/commands/leaderboard.js - One Piece Themed Leaderboard Poster

const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getBountyForLevel, PIRATE_KING_BOUNTY } = require('../utils/bountySystem');
const Canvas = require('canvas');
const path = require('path');

const LEADERBOARD_EXCLUDE_ROLE = process.env.LEADERBOARD_EXCLUDE_ROLE; // Pirate King Role ID

// Register custom pirate font if available
try {
    Canvas.registerFont(path.join(__dirname, '../../assets/fonts/pirate.ttf'), { family: 'PirateFont' });
} catch {
    // Fallback to Impact/Arial if not found
}

function pirateRankEmoji(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '🏴‍☠️';
}

function formatCommas(n) {
    return n.toLocaleString();
}

// Minimal wanted poster, matching HTML
async function createWantedPoster(user, rank, bounty, guild) {
    const width = 600;
    const height = 900;
    const ctxFont = (style, size) => `${style ? style + ' ' : ''}${size}px PirateFont, Impact, Arial, sans-serif`;

    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // === Background and Borders ===
    ctx.fillStyle = '#F5DEB3';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, width, height);
    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    // === WANTED Header ===
    ctx.font = ctxFont('bold', 90);
    ctx.fillStyle = '#8B0000';
    ctx.textAlign = 'center';
    ctx.fillText('WANTED', width / 2, 110);

    // === Avatar Frame ===
    const photoW = 380, photoH = 230;
    const photoX = (width - photoW) / 2;
    const photoY = 150;
    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 6;
    ctx.strokeRect(photoX, photoY, photoW, photoH);
    ctx.fillStyle = '#fff';
    ctx.fillRect(photoX, photoY, photoW, photoH);

    // Draw avatar
    let member = null;
    try {
        if (guild && user.userId) member = await guild.members.fetch(user.userId);
    } catch {}
    const avatarArea = { x: photoX+5, y: photoY+5, width: photoW-10, height: photoH-10 };
    if (member) {
        try {
            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true });
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

    // === DEAD OR ALIVE ===
    ctx.font = ctxFont('bold', 38);
    ctx.fillStyle = '#8B0000';
    ctx.textAlign = 'center';
    ctx.fillText('DEAD OR ALIVE', width / 2, photoY + photoH + 56);

    // === Pirate Name ===
    ctx.font = ctxFont('bold', 64);
    let displayName = 'UNKNOWN PIRATE';
    if (member) displayName = member.displayName.replace(/[^\w\s-]/g, '').toUpperCase().substring(0, 16);
    else if (user.userId) displayName = `PIRATE ${user.userId.slice(-4)}`;
    ctx.fillText(displayName, width / 2, photoY + photoH + 128);

    // === Bounty (big, red, centered) ===
    ctx.font = ctxFont('bold', 70);
    ctx.fillStyle = '#8B0000';
    ctx.fillText(formatCommas(bounty), width / 2, photoY + photoH + 210);

    // === DE3F Box on left ===
    ctx.font = ctxFont('bold', 36);
    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 4;
    const boxX = 48, boxY = photoY + photoH + 140, boxW = 65, boxH = 80;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle = '#8B0000';
    ctx.textAlign = 'left';
    ctx.fillText('DE', boxX + 10, boxY + 35);
    ctx.fillText('3F', boxX + 10, boxY + 75);
    ctx.textAlign = 'center';

    // === MARINE (bottom right) ===
    ctx.font = ctxFont('bold', 40);
    ctx.fillStyle = '#8B0000';
    ctx.textAlign = 'right';
    ctx.fillText('MARINE', width - 50, height - 40);

    // Center text for rest
    ctx.textAlign = 'center';

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

        // Navigation buttons
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
                description += `${pirateRankEmoji(rank)} **${rank}.** <@${user.userId}>\nLevel ${user.level} • ₿${bounty.toLocaleString()}\n\n`;
            }
            if (topTen.length === 0) {
                description = "No pirates have earned any bounty yet! Set sail and make your mark on the Grand Line!";
            }
            embed.setDescription(description);
            return interaction.reply({ embeds: [embed], components: [row] });
        }
    },
};

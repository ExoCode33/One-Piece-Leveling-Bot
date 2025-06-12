// src/commands/leaderboard.js

const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getBountyForLevel, PIRATE_KING_BOUNTY } = require('../utils/bountySystem');
const Canvas = require('canvas');
const path = require('path');

const LEADERBOARD_EXCLUDE_ROLE = process.env.LEADERBOARD_EXCLUDE_ROLE; // Pirate King Role ID

// Register custom pirate font if available
try {
    Canvas.registerFont(path.join(__dirname, '../../assets/fonts/pirate.ttf'), { family: 'PirateFont' });
} catch {
    // Fallback to Impact/Arial if not present
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

// Poster generation (latest version)
async function createWantedPoster(user, rank, bounty, guild) {
    const width = 600, height = 900;
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
    ctx.font = ctxFont('bold', 86);
    ctx.fillStyle = '#8B0000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('WANTED', width / 2, 70);

    // === Avatar (square, perfectly centered) ===
    const photoW = 340, photoH = 340;
    const photoX = (width - photoW) / 2;
    const photoY = 180;
    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 7;
    ctx.strokeRect(photoX, photoY, photoW, photoH);
    ctx.fillStyle = '#fff';
    ctx.fillRect(photoX, photoY, photoW, photoH);

    // Draw avatar
    let member = null;
    try {
        if (guild && user.userId) member = await guild.members.fetch(user.userId);
    } catch {}
    const avatarArea = { x: photoX + 7, y: photoY + 7, width: photoW - 14, height: photoH - 14 };
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
    ctx.font = ctxFont('bold', 42);
    ctx.fillStyle = '#8B0000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('DEAD OR ALIVE', width / 2, photoY + photoH + 30);

    // === Pirate Name ===
    ctx.font = ctxFont('bold', 68);
    let displayName = 'UNKNOWN PIRATE';
    if (member) displayName = member.displayName.replace(/[^\w\s-]/g, '').toUpperCase().substring(0, 16);
    else if (user.userId) displayName = `PIRATE ${user.userId.slice(-4)}`;
    ctx.fillText(displayName, width / 2, photoY + photoH + 90);

    // === Bounty (Berry symbol smaller and aligned) ===
    const bountyY = photoY + photoH + 175;
    const berryFontSize = 60;
    ctx.font = ctxFont('bold', berryFontSize);
    const berry = '₿';
    const berryWidth = ctx.measureText(berry).width;

    // Bounty amount
    ctx.font = ctxFont('bold', 78);
    const bountyStr = bounty.toLocaleString();
    const bountyWidth = ctx.measureText(bountyStr).width;

    // Calculate total width
    const gap = 16;
    const totalBountyWidth = berryWidth + gap + bountyWidth;
    const startX = (width - totalBountyWidth) / 2;

    // Berry symbol
    ctx.font = ctxFont('bold', berryFontSize);
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(berry, startX + berryWidth / 2, bountyY + 78);

    // If ₿ doesn't show: use a small image instead!
    // const berryImg = await Canvas.loadImage(path.join(__dirname, '../../assets/berry_symbol.png'));
    // ctx.drawImage(berryImg, startX, bountyY + 8, 45, 55);

    // Bounty number
    ctx.font = ctxFont('bold', 78);
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(bountyStr, startX + berryWidth + gap + bountyWidth / 2, bountyY + 78);

    // === MARINE (smaller, bottom right) ===
    ctx.font = ctxFont('bold', 38);
    ctx.fillStyle = '#8B0000';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('MARINE', width - 45, height - 35);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

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

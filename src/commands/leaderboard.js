// src/commands/leaderboard.js - One Piece Wanted Poster Replica

const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getBountyForLevel, PIRATE_KING_BOUNTY } = require('../utils/bountySystem');
const Canvas = require('canvas');
const path = require('path');

const LEADERBOARD_EXCLUDE_ROLE = process.env.LEADERBOARD_EXCLUDE_ROLE; // Pirate King Role ID

// Register pirate font if available (not required, will fallback)
try {
    Canvas.registerFont(path.join(__dirname, '../../assets/fonts/pirate.ttf'), { family: 'PirateFont' });
} catch { /* fallback to Impact */ }

// Number formatting
const formatCommas = n => n.toLocaleString();

async function createWantedPoster(user, bounty, guild) {
    const W = 400, H = 600;
    const ctxFont = (style, size) => `${style ? style + ' ' : ''}${size}px PirateFont, Impact, serif, sans-serif`;
    const canvas = Canvas.createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Background & Borders
    ctx.fillStyle = '#F5DEB3';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, W-8, H-8);
    ctx.fillStyle = '#F5DEB3';
    ctx.fillRect(14, 14, W-28, H-28);

    // WANTED Header
    ctx.font = ctxFont('bold', 56);
    ctx.fillStyle = '#8B0000';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2; ctx.shadowBlur = 4;
    const wanted = 'WANTED';
    // Manual letter-spacing
    let lsp = 6, x = 0;
    for (let c of wanted) x += ctx.measureText(c).width + lsp;
    let wx = (W - x + lsp) / 2;
    for (let c of wanted) {
        ctx.fillText(c, wx + ctx.measureText(c).width/2, 70);
        wx += ctx.measureText(c).width + lsp;
    }
    ctx.shadowBlur = ctx.shadowOffsetX = ctx.shadowOffsetY = 0;

    // Photo Frame
    const pW = 280, pH = 200, pX = (W-pW)/2, pY = 100;
    ctx.fillStyle = '#fff';
    ctx.fillRect(pX, pY, pW, pH);
    ctx.strokeStyle = '#8B0000'; ctx.lineWidth = 4;
    ctx.strokeRect(pX, pY, pW, pH);

    // Avatar
    let member = null;
    try {
        if (guild && user.userId) member = await guild.members.fetch(user.userId);
    } catch {}
    const a = { x: pX+4, y: pY+4, w: pW-8, h: pH-8 };
    if (member) {
        try {
            const url = member.user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
            const img = await Canvas.loadImage(url);
            ctx.save();
            ctx.beginPath();
            ctx.rect(a.x, a.y, a.w, a.h);
            ctx.clip();
            // Center-crop avatar
            const scale = Math.max(a.w / img.width, a.h / img.height);
            const sw = img.width * scale, sh = img.height * scale;
            ctx.drawImage(img, a.x + (a.w-sw)/2, a.y + (a.h-sh)/2, sw, sh);
            ctx.restore();
        } catch {
            ctx.fillStyle = '#ddd'; ctx.fillRect(a.x, a.y, a.w, a.h);
        }
    } else { ctx.fillStyle = '#ddd'; ctx.fillRect(a.x, a.y, a.w, a.h); }

    // DEAD OR ALIVE
    ctx.font = ctxFont('bold', 32);
    ctx.fillStyle = '#8B0000';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1; ctx.shadowBlur = 2;
    const doa = 'DEAD OR ALIVE';
    lsp = 2; x = 0;
    for (let c of doa) x += ctx.measureText(c).width + lsp;
    wx = (W - x + lsp) / 2;
    for (let c of doa) {
        ctx.fillText(c, wx + ctx.measureText(c).width/2, pY + pH + 25);
        wx += ctx.measureText(c).width + lsp;
    }
    ctx.shadowBlur = ctx.shadowOffsetX = ctx.shadowOffsetY = 0;

    // Pirate Name
    ctx.font = ctxFont('bold', 48);
    ctx.fillStyle = '#8B0000';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2; ctx.shadowBlur = 4;
    let name = member 
        ? member.displayName.replace(/[^\w\s-]/g, '').toUpperCase().slice(0, 16)
        : user.userId ? `PIRATE ${user.userId.slice(-4)}` : 'UNKNOWN PIRATE';
    lsp = 6; x = 0;
    for (let c of name) x += ctx.measureText(c).width + lsp;
    wx = (W - x + lsp) / 2;
    for (let c of name) {
        ctx.fillText(c, wx + ctx.measureText(c).width/2, pY + pH + 75);
        wx += ctx.measureText(c).width + lsp;
    }
    ctx.shadowBlur = ctx.shadowOffsetX = ctx.shadowOffsetY = 0;

    // Bounty - symbol + amount with gap, NO YELLOW CIRCLE!
    ctx.font = ctxFont('bold', 48);
    ctx.fillStyle = '#8B0000';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2; ctx.shadowBlur = 4;
    const bountySymbol = '฿';
    const bountyText = formatCommas(bounty);
    const berryW = ctx.measureText(bountySymbol).width, bountyW = ctx.measureText(bountyText).width;
    const gap = 8, totalW = berryW + gap + bountyW;
    ctx.fillText(bountySymbol, (W-totalW)/2 + berryW/2, pY + pH + 135);
    ctx.font = ctxFont('bold', 44);
    ctx.fillText(bountyText, (W-totalW)/2 + berryW + gap + bountyW/2, pY + pH + 135);
    ctx.shadowBlur = ctx.shadowOffsetX = ctx.shadowOffsetY = 0;

    // MARINE label (bottom right)
    ctx.font = ctxFont('bold', 18);
    ctx.fillStyle = '#8B0000';
    ctx.textAlign = 'right';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1; ctx.shadowBlur = 2;
    ctx.fillText('MARINE', W-25, H-15);
    ctx.shadowBlur = ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
    ctx.textAlign = 'center';

    return canvas.toBuffer('image/png');
}

function pirateRankEmoji(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '🏴‍☠️';
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
            try { guild = await client.guilds.fetch(guildId); } catch { }
        }
        if (!guild || !guildId) return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });

        const view = interaction.options.getString('view') || 'posters';
        let leaderboard;
        try { leaderboard = await xpTracker.getLeaderboard(guildId); }
        catch { return interaction.reply({ content: "Database error occurred. Please try again later.", ephemeral: true }); }
        if (!Array.isArray(leaderboard)) return interaction.reply({ content: "No leaderboard data available.", ephemeral: true });

        // Detect Pirate King
        let pirateKingUser = null;
        if (LEADERBOARD_EXCLUDE_ROLE) {
            try {
                const members = await guild.members.fetch();
                const king = members.find(m => m.roles.cache.has(LEADERBOARD_EXCLUDE_ROLE));
                if (king) {
                    pirateKingUser = leaderboard.find(u => u.userId === king.user.id);
                    if (pirateKingUser) leaderboard = leaderboard.filter(u => u.userId !== king.user.id);
                }
            } catch {}
        }
        if (!pirateKingUser && leaderboard.length > 0 && leaderboard[0].level >= 50) {
            pirateKingUser = leaderboard[0];
            leaderboard = leaderboard.slice(1);
        }
        leaderboard = leaderboard.filter(user => user && typeof user.xp === 'number');
        leaderboard.sort((a, b) => b.xp - a.xp);

        // Buttons
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('leaderboard_posters_1_xp').setLabel('🎯 Top 3 Posters').setStyle(view === 'posters' ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('leaderboard_long_1_xp').setLabel('📋 Top 10 List').setStyle(view === 'long' ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('leaderboard_full_1_xp').setLabel('📜 Full Board').setStyle(view === 'full' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        );

        if (view === 'posters') {
            const topThree = leaderboard.slice(0, 3);
            const allPirates = [];
            if (pirateKingUser) allPirates.push({ user: pirateKingUser, isPirateKing: true });
            for (let i = 0; i < topThree.length; i++) allPirates.push({ user: topThree[i], isPirateKing: false });
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
                const pirate = allPirates[i], user = pirate.user;
                const bounty = pirate.isPirateKing ? PIRATE_KING_BOUNTY : getBountyForLevel(user.level);
                try {
                    const posterBuffer = await createWantedPoster(user, bounty, guild);
                    if (posterBuffer) {
                        const attachment = new AttachmentBuilder(posterBuffer, { name: `wanted_poster_${i + 1}.png` });
                        const posterEmbed = new EmbedBuilder()
                            .setColor(pirate.isPirateKing ? 0xFFD700 : 0x8B0000)
                            .setTitle(pirate.isPirateKing ? '👑 PIRATE KING' : `${pirateRankEmoji(i + 1)} RANK ${i + 1}`)
                            .addFields(
                                { name: '🏴‍☠️ Pirate', value: `<@${user.userId}>`, inline: true },
                                { name: '💰 Bounty', value: `฿${bounty.toLocaleString()}`, inline: true },
                                { name: '⚔️ Level', value: `${user.level}`, inline: true },
                                { name: '💎 Total XP', value: `${user.xp.toLocaleString()}`, inline: true }
                            )
                            .setImage(`attachment://wanted_poster_${i + 1}.png`)
                            .setFooter({ text: `Marine Intelligence • Report any sightings immediately • Bounty #${String(i + 1).padStart(3, '0')}` });
                        await interaction.followUp({ embeds: [posterEmbed], files: [attachment] });
                    }
                } catch { }
            }
            return;
        } else if (view === 'full') {
            // Full text list
            let text = '🏴‍☠️ **COMPLETE PIRATE REGISTRY** 🏴‍☠️\n\n', rank = 1;
            if (pirateKingUser)
                text += `👑 **PIRATE KING**: <@${pirateKingUser.userId}> - Level ${pirateKingUser.level} - ฿${PIRATE_KING_BOUNTY.toLocaleString()}\n\n`;
            for (const user of leaderboard) {
                const bounty = getBountyForLevel(user.level);
                text += `${pirateRankEmoji(rank)} **${rank}.** <@${user.userId}> — Level **${user.level}** — ฿**${bounty.toLocaleString()}**\n`;
                rank++;
            }
            if (leaderboard.length === 0) text += "No pirates have earned any bounty yet! Set sail and make your mark on the Grand Line!";
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
            let description = '', rank = 1;
            if (pirateKingUser)
                description += `👑 **PIRATE KING**: <@${pirateKingUser.userId}>\nLevel ${pirateKingUser.level} • ฿${PIRATE_KING_BOUNTY.toLocaleString()}\n\n`;
            const topTen = leaderboard.slice(0, 10);
            for (const user of topTen) {
                const bounty = getBountyForLevel(user.level);
                description += `${pirateRankEmoji(rank)} **${rank}.** <@${user.userId}>\nLevel ${user.level} • ฿${bounty.toLocaleString()}\n\n`;
                rank++;
            }
            if (topTen.length === 0)
                description = "No pirates have earned any bounty yet! Set sail and make your mark on the Grand Line!";
            embed.setDescription(description);
            return interaction.reply({ embeds: [embed], components: [row] });
        }
    },
};

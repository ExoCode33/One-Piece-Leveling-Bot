// src/commands/leaderboard.js - One Piece Leaderboard with Styled Canvas Wanted Posters

const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getBountyForLevel, PIRATE_KING_BOUNTY } = require('../utils/bountySystem');
const Canvas = require('canvas');

const LEADERBOARD_EXCLUDE_ROLE = process.env.LEADERBOARD_EXCLUDE_ROLE; // Role ID for Pirate King

// Register custom font (ensure font file is present as instructed below)
try {
    Canvas.registerFont('./assets/fonts/pirate.ttf', { family: 'PirateFont' });
} catch (e) {
    console.log('Custom font not found, using system fonts');
}

// Helper functions
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
function drawTextSafe(ctx, text, x, y, maxWidth = null) {
    try {
        if (maxWidth) ctx.fillText(text, x, y, maxWidth);
        else ctx.fillText(text, x, y);
        return true;
    } catch (error) {
        return false;
    }
}
function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// Core: Wanted Poster Generator (tuned for better layout & font use)
async function createWantedPoster(user, rank, bounty, threatLevel, guild) {
    const CANVAS_WIDTH = 320;
    const CANVAS_HEIGHT = 450;

    try {
        const canvas = Canvas.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
        const ctx = canvas.getContext('2d');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Background + borders
        const bgGradient = ctx.createRadialGradient(
            CANVAS_WIDTH/2, CANVAS_HEIGHT/2, 0,
            CANVAS_WIDTH/2, CANVAS_HEIGHT/2, Math.max(CANVAS_WIDTH, CANVAS_HEIGHT)/2
        );
        bgGradient.addColorStop(0, '#F5DEB3');
        bgGradient.addColorStop(0.7, '#DEB887');
        bgGradient.addColorStop(1, '#D2B48C');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = 'rgba(139, 69, 19, 0.07)';
        for (let i = 0; i < 200; i++) {
            const x = Math.random() * CANVAS_WIDTH, y = Math.random() * CANVAS_HEIGHT, s = Math.random() * 3;
            ctx.fillRect(x, y, s, s);
        }
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 8;
        roundRect(ctx, 10, 10, CANVAS_WIDTH - 20, CANVAS_HEIGHT - 20, 15);
        ctx.stroke();
        ctx.strokeStyle = '#DC143C';
        ctx.lineWidth = 3;
        roundRect(ctx, 18, 18, CANVAS_WIDTH - 36, CANVAS_HEIGHT - 36, 10);
        ctx.stroke();

        // Header: WANTED
        const headerY = 35, headerHeight = 40;
        ctx.fillStyle = '#8B0000';
        roundRect(ctx, 40, headerY - 5, CANVAS_WIDTH - 80, headerHeight, 8);
        ctx.fill();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        roundRect(ctx, 40, headerY - 5, CANVAS_WIDTH - 80, headerHeight, 8);
        ctx.stroke();
        ctx.font = 'bold 30px PirateFont, Arial, sans-serif';
        ctx.fillStyle = '#FFF';
        drawTextSafe(ctx, 'WANTED', CANVAS_WIDTH/2, headerY + headerHeight/2 + 2);

        // Subtitle
        ctx.fillStyle = '#111';
        ctx.font = 'bold 13px Arial, sans-serif';
        drawTextSafe(ctx, 'DEAD OR ALIVE', CANVAS_WIDTH/2, headerY + headerHeight + 16);

        // Avatar/photo section
        const photoY = headerY + headerHeight + 30, photoX = (CANVAS_WIDTH - 120) / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(photoX + 3, photoY + 3, 120, 140);
        ctx.fillStyle = '#fff';
        ctx.fillRect(photoX, photoY, 120, 140);
        ctx.strokeStyle = '#8B0000'; ctx.lineWidth = 4;
        ctx.strokeRect(photoX, photoY, 120, 140);

        // Draw avatar
        let member = null;
        try { if (guild && user.userId) member = await guild.members.fetch(user.userId); } catch {}
        const avatarArea = { x: photoX + 5, y: photoY + 5, width: 110, height: 105 };
        if (member) {
            try {
                const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
                const avatar = await Canvas.loadImage(avatarURL);
                ctx.save(); ctx.beginPath(); ctx.rect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height); ctx.clip();
                const scale = Math.max(avatarArea.width / avatar.width, avatarArea.height / avatar.height);
                const sw = avatar.width * scale, sh = avatar.height * scale;
                ctx.drawImage(avatar, avatarArea.x + (avatarArea.width - sw)/2, avatarArea.y + (avatarArea.height - sh)/2, sw, sh);
                ctx.restore();
            } catch {
                ctx.fillStyle = '#DDD'; ctx.fillRect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
                ctx.fillStyle = '#666'; ctx.font = '20px Arial'; drawTextSafe(ctx, '👤', avatarArea.x + avatarArea.width/2, avatarArea.y + avatarArea.height/2);
            }
        } else {
            ctx.fillStyle = '#DDD'; ctx.fillRect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
            ctx.fillStyle = '#666'; ctx.font = '20px Arial'; drawTextSafe(ctx, '👤', avatarArea.x + avatarArea.width/2, avatarArea.y + avatarArea.height/2);
        }

        // Pirate name under photo
        let displayName = member
            ? member.displayName.replace(/[^\w\s-]/g, '').toUpperCase().substring(0, 15)
            : user.userId ? `PIRATE ${user.userId.slice(-4)}` : "UNKNOWN PIRATE";
        ctx.font = 'bold 17px PirateFont, Arial, sans-serif';
        ctx.fillStyle = '#222';
        drawTextSafe(ctx, displayName, CANVAS_WIDTH/2, photoY + 140 + 18);

        // Bounty Section
        const bountyY = photoY + 140 + 40;
        ctx.fillStyle = '#8B0000';
        roundRect(ctx, 60, bountyY - 16, CANVAS_WIDTH - 120, 52, 10);
        ctx.fill();
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2;
        roundRect(ctx, 60, bountyY - 16, CANVAS_WIDTH - 120, 52, 10);
        ctx.stroke();
        let bountyText = bounty >= 1e9 ? `${(bounty / 1e9).toFixed(1)}B`
            : bounty >= 1e6 ? `${Math.floor(bounty / 1e6)}M`
            : bounty >= 1e3 ? `${Math.floor(bounty / 1e3)}K`
            : bounty.toString();
        ctx.font = 'bold 32px PirateFont, Arial, sans-serif';
        ctx.fillStyle = '#FFD700';
        drawTextSafe(ctx, `₿${bountyText}`, CANVAS_WIDTH/2, bountyY + 6);
        ctx.font = 'bold 14px Arial, sans-serif';
        ctx.fillStyle = '#FFF';
        drawTextSafe(ctx, 'BERRY', CANVAS_WIDTH/2, bountyY + 28);

        // Threat Assessment
        const threatY = bountyY + 50;
        ctx.fillStyle = 'rgba(255,255,255,0.98)';
        roundRect(ctx, 30, threatY, CANVAS_WIDTH - 60, 54, 8);
        ctx.fill();
        ctx.strokeStyle = '#8B0000'; ctx.lineWidth = 2;
        roundRect(ctx, 30, threatY, CANVAS_WIDTH - 60, 54, 8);
        ctx.stroke();
        ctx.font = 'bold 12px PirateFont, Arial, sans-serif';
        ctx.fillStyle = '#8B0000';
        drawTextSafe(ctx, 'THREAT ASSESSMENT', CANVAS_WIDTH/2, threatY + 14);
        ctx.font = 'bold 11px Arial, sans-serif';
        ctx.fillStyle = '#222';
        drawTextSafe(ctx, getThreatLevelShort(user.level), CANVAS_WIDTH/2, threatY + 36);

        // Footer bar
        const footerY = CANVAS_HEIGHT - 38;
        ctx.fillStyle = '#111';
        roundRect(ctx, 25, footerY, CANVAS_WIDTH - 50, 24, 5);
        ctx.fill();
        ctx.font = 'bold 13px Arial, sans-serif';
        ctx.fillStyle = '#FFF';
        let xpText = user.xp >= 1e6 ? `${Math.floor(user.xp / 1e6)}M XP`
            : user.xp >= 1e3 ? `${Math.floor(user.xp / 1e3)}K XP`
            : `${user.xp} XP`;
        drawTextSafe(ctx, `Level ${user.level} • ${xpText}`, CANVAS_WIDTH/2, footerY + 12);

        // Decorative corners
        [[25,25],[CANVAS_WIDTH-25,25],[25,CANVAS_HEIGHT-25],[CANVAS_WIDTH-25,CANVAS_HEIGHT-25]].forEach(([x,y]) => {
            ctx.fillStyle = '#8B0000'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI*2); ctx.fill();
        });

        return canvas.toBuffer('image/png');
    } catch (error) {
        // Fallback to simple version
        try {
            const c = Canvas.createCanvas(300,400), ctx = c.getContext('2d');
            ctx.fillStyle = '#F5DEB3'; ctx.fillRect(0,0,300,400);
            ctx.strokeStyle = '#8B0000'; ctx.lineWidth = 5;
            ctx.strokeRect(10,10,280,380);
            ctx.fillStyle = '#8B0000'; ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center';
            ctx.fillText('WANTED',150,50);
            ctx.fillStyle = '#000'; ctx.font = 'bold 16px Arial';
            ctx.fillText(`Level ${user.level}`,150,200);
            ctx.fillText(`₿${getBountyForLevel(user.level).toLocaleString()}`,150,250);
            return c.toBuffer('image/png');
        } catch { return null; }
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
        const isButtonInteraction = interaction.deferred;
        let guild = interaction.guild, guildId = interaction.guildId;
        if (!guild && guildId) { try { guild = await client.guilds.fetch(guildId); } catch {} }
        if (!guild || !guildId) {
            const msg = "This command can only be used in a server, not in DMs.";
            return isButtonInteraction
                ? interaction.editReply({ content: msg })
                : interaction.reply({ content: msg, ephemeral: true });
        }
        const view = interaction.options.getString('view') || 'posters';
        let leaderboard;
        try { leaderboard = await xpTracker.getLeaderboard(guildId); } catch {
            const msg = "Database error occurred. Please try again later.";
            return isButtonInteraction
                ? interaction.editReply({ content: msg })
                : interaction.reply({ content: msg, ephemeral: true });
        }
        if (!leaderboard || !Array.isArray(leaderboard)) {
            const msg = "No leaderboard data available.";
            return isButtonInteraction
                ? interaction.editReply({ content: msg })
                : interaction.reply({ content: msg, ephemeral: true });
        }
        // Pirate King detection
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
        if (!pirateKingUser && leaderboard.length > 0) {
            const topUser = leaderboard[0];
            if (topUser.level >= 50) {
                pirateKingUser = topUser;
                leaderboard = leaderboard.slice(1);
            }
        }
        leaderboard = leaderboard.filter(user => user && typeof user.xp === 'number');
        leaderboard.sort((a, b) => b.xp - a.xp);

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
            // Top 3 posters
            const topThree = leaderboard.slice(0, 3);
            const allPirates = [];
            if (pirateKingUser) allPirates.push({ user: pirateKingUser, rank: 'KING', isPirateKing: true });
            for (let i = 0; i < topThree.length; i++) allPirates.push({ user: topThree[i], rank: i+1, isPirateKing: false });
            const headerEmbed = new EmbedBuilder()
                .setColor(0x8B0000)
                .setTitle('🏴‍☠️ MOST WANTED PIRATES 🏴‍☠️')
                .setDescription('**The World Government has issued these bounties for the most dangerous criminals on the Grand Line.**\n\u200B')
                .setFooter({ text: 'World Government • Marine HQ • Justice Will Prevail' })
                .setTimestamp();
            if (isButtonInteraction) await interaction.editReply({ embeds: [headerEmbed], components: [row] });
            else await interaction.reply({ embeds: [headerEmbed], components: [row] });

            // Now post each wanted poster (as follow-ups)
            for (let i = 0; i < Math.min(allPirates.length, 4); i++) {
                const pirate = allPirates[i], user = pirate.user, rank = pirate.rank;
                const bounty = pirate.isPirateKing ? PIRATE_KING_BOUNTY : getBountyForLevel(user.level);
                const threat = pirate.isPirateKing ? 'PIRATE KING CLASS' : getThreatLevelShort(user.level);
                try {
                    const posterBuffer = await createWantedPoster(user, rank, bounty, threat, guild);
                    if (posterBuffer) {
                        const attachment = new AttachmentBuilder(posterBuffer, { name: `wanted_poster_${i+1}.png` });
                        const posterEmbed = new EmbedBuilder()
                            .setColor(pirate.isPirateKing ? 0xFFD700 : 0x8B0000)
                            .setTitle(pirate.isPirateKing ? '👑 **PIRATE KING**' : `${pirateRankEmoji(rank)} **RANK ${rank}** WANTED PIRATE`)
                            .addFields(
                                { name: '🏴‍☠️ Pirate', value: `<@${user.userId}>`, inline: true },
                                { name: '💰 Bounty', value: `₿${bounty.toLocaleString()}`, inline: true },
                                { name: '⚔️ Level', value: `${user.level}`, inline: true },
                                { name: '⚠️ Threat Level', value: threat, inline: true },
                                { name: '💎 Total XP', value: `${user.xp.toLocaleString()}`, inline: true },
                                { name: '📍 Status', value: pirate.isPirateKing ? 'Ruler of the Grand Line' :
                                    rank === 1 ? 'Most Dangerous Pirate' : rank === 2 ? 'Rising Star' : 'Notorious Criminal', inline: true }
                            )
                            .setImage(`attachment://wanted_poster_${i+1}.png`)
                            .setFooter({ text: `Marine Intelligence • Report sightings • Bounty #${String(i+1).padStart(3, '0')}` });
                        await interaction.followUp({ embeds: [posterEmbed], files: [attachment] });
                    }
                } catch {}
            }
            return;
        } else if (view === 'full') {
            let text = '🏴‍☠️ **COMPLETE PIRATE REGISTRY** 🏴‍☠️\n\n', rank = 1;
            if (pirateKingUser) text += `👑 **PIRATE KING**: <@${pirateKingUser.userId}> - Level ${pirateKingUser.level} - ₿${PIRATE_KING_BOUNTY.toLocaleString()}\n\n`;
            for (const user of leaderboard) {
                const bounty = getBountyForLevel(user.level);
                text += `${pirateRankEmoji(rank)} **${rank}.** <@${user.userId}> — Level **${user.level}** — ₿**${bounty.toLocaleString()}**\n`;
                rank++;
            }
            if (leaderboard.length === 0)
                text += "No pirates have earned any bounty yet! Set sail and make your mark on the Grand Line!";
            const finalText = text.length > 1900 ? text.slice(0, 1900) + '\n... (truncated)' : text;
            const responseData = { content: finalText, components: [row], embeds: [] };
            return isButtonInteraction ? interaction.editReply(responseData) : interaction.reply(responseData);
        } else {
            // Top 10
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
                const user = topTen[i], rank = i + 1, bounty = getBountyForLevel(user.level), threat = getThreatLevelShort(user.level);
                description += `${pirateRankEmoji(rank)} **${rank}.** <@${user.userId}>\nLevel ${user.level} • ₿${bounty.toLocaleString()} • ${threat}\n\n`;
            }
            if (topTen.length === 0) description = "No pirates have earned any bounty yet! Set sail and make your mark on the Grand Line!";
            embed.setDescription(description);
            const responseData = { embeds: [embed], components: [row] };
            return isButtonInteraction ? interaction.editReply(responseData) : interaction.reply(responseData);
        }
    }
};

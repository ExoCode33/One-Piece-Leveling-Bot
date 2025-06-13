// src/commands/level.js - Debug version with explicit bounty calculation

const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

// Import bounty system
let getBountyForLevel;
try {
    const bountySystem = require('../utils/bountySystem');
    getBountyForLevel = bountySystem.getBountyForLevel;
    console.log('[LEVEL] Successfully imported getBountyForLevel');
} catch (error) {
    console.error('[LEVEL] Failed to import bountySystem:', error);
    // Fallback bounty calculation
    getBountyForLevel = function(level) {
        const BOUNTY_LADDER = {
            0: 0, 1: 1000000, 2: 3000000, 3: 5000000, 4: 8000000, 5: 30000000,
            6: 35000000, 7: 42000000, 8: 50000000, 9: 65000000, 10: 81000000,
            11: 90000000, 12: 100000000, 13: 108000000, 14: 115000000, 15: 120000000,
            16: 135000000, 17: 150000000, 18: 170000000, 19: 185000000, 20: 200000000,
            21: 220000000, 22: 240000000, 23: 260000000, 24: 280000000, 25: 320000000,
            26: 350000000, 27: 380000000, 28: 420000000, 29: 460000000, 30: 500000000,
            31: 550000000, 32: 600000000, 33: 660000000, 34: 720000000, 35: 860000000,
            36: 900000000, 37: 950000000, 38: 1000000000, 39: 1030000000, 40: 1057000000,
            41: 1100000000, 42: 1200000000, 43: 1300000000, 44: 1400000000, 45: 1500000000,
            46: 1800000000, 47: 2100000000, 48: 2500000000, 49: 2800000000, 50: 3000000000,
            51: 3500000000, 52: 4000000000, 53: 4200000000, 54: 4500000000, 55: 5000000000
        };
        return BOUNTY_LADDER[level] || 0;
    };
}

// Register custom fonts
try {
    registerFont(path.join(__dirname, '../../assets/fonts/captkd.ttf'), { family: 'CaptainKiddNF' });
    registerFont(path.join(__dirname, '../../assets/fonts/Cinzel-Bold.otf'), { family: 'Cinzel' });
    registerFont(path.join(__dirname, '../../assets/fonts/Times New Normal Regular.ttf'), { family: 'TimesNewNormal' });
    console.log('[DEBUG] Successfully registered custom fonts for level command');
} catch (error) {
    console.error('[ERROR] Failed to register custom fonts:', error.message);
    console.log('[INFO] Falling back to system fonts');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Check your or another pirate\'s bounty level')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The pirate to check')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            if (!targetMember) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ Pirate Not Found')
                    .setDescription('Could not find that pirate in this server!')
                    .setColor('#FF0000');
                return interaction.editReply({ embeds: [embed] });
            }

            const xpTracker = global.xpTracker;
            if (!xpTracker) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ System Error')
                    .setDescription('XP Tracker is not initialized. Please restart the bot.')
                    .setColor('#FF0000');
                return interaction.editReply({ embeds: [embed] });
            }

            const userStats = await xpTracker.getUserStats(interaction.guildId, targetUser.id);
            
            if (!userStats) {
                const embed = new EmbedBuilder()
                    .setTitle('🏴‍☠️ New Pirate Detected')
                    .setDescription(`${targetUser.username} hasn't started their pirate journey yet!`)
                    .addFields(
                        { name: '💰 Current Bounty', value: '฿0', inline: true },
                        { name: '⭐ Current Level', value: '0', inline: true },
                        { name: '🎯 Next Action', value: 'Send a message to get started!', inline: true }
                    )
                    .setColor('#FFA500')
                    .setThumbnail(targetUser.displayAvatarURL());
                
                return interaction.editReply({ embeds: [embed] });
            }

            console.log(`[LEVEL] User stats - Level: ${userStats.level}, XP: ${userStats.xp}`);

            // Get user's rank
            const leaderboard = await xpTracker.getLeaderboard(interaction.guildId);
            const rank = leaderboard.findIndex(u => u.userId === targetUser.id) + 1;

            // Check Pirate King status
            const settings = global.guildSettings?.get(interaction.guild.id) || {};
            const excludedRoleId = settings.excludedRole;
            const isPirateKing = excludedRoleId && targetMember.roles.cache.has(excludedRoleId);

            // Calculate bounty amount
            const bountyAmount = getBountyForLevel(userStats.level);
            console.log(`[LEVEL] Level ${userStats.level} = Bounty ฿${bountyAmount.toLocaleString()}`);

            // Create wanted poster
            const canvas = await createWantedPoster(userStats, targetMember);
            const attachment = new AttachmentBuilder(canvas, { name: `wanted_${targetUser.id}.png` });

            // Create embed
            const embed = new EmbedBuilder()
                .setColor(isPirateKing ? '#FF0000' : '#FF6B35')
                .setTitle(`${isPirateKing ? '👑' : '🏴‍☠️'} ${targetMember.displayName}'s Bounty`)
                .addFields(
                    { name: '🏆 Rank', value: isPirateKing ? 'PIRATE KING' : `#${rank}`, inline: true },
                    { name: '⭐ Level', value: userStats.level.toString(), inline: true },
                    { name: '💰 Current Bounty', value: `฿${bountyAmount.toLocaleString()}`, inline: true },
                    { name: '💎 Total XP', value: userStats.xp.toLocaleString(), inline: true },
                    { name: '💬 Messages', value: userStats.messages.toLocaleString(), inline: true },
                    { name: '😄 Reactions', value: userStats.reactions.toLocaleString(), inline: true }
                )
                .setImage(`attachment://wanted_${targetUser.id}.png`)
                .setFooter({ text: 'Marine Intelligence • BOUNTY POSTER' })
                .setTimestamp();

            if (isPirateKing) {
                embed.addFields({
                    name: '👑 Special Status',
                    value: 'Ruler of the Grand Line - Excluded from XP tracking',
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed], files: [attachment] });

        } catch (error) {
            console.error('[ERROR] Error in level command:', error);
            const embed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Failed to create wanted poster.')
                .setColor('#FF0000');
            await interaction.editReply({ embeds: [embed] });
        }
    }
};

async function createWantedPoster(userStats, member) {
    const width = 600, height = 900;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    try {
        const scrollTexture = await loadImage(path.join(__dirname, '../../assets/scroll_texture.jpg'));
        ctx.drawImage(scrollTexture, 0, 0, width, height);
    } catch (error) {
        ctx.fillStyle = '#f5e6c5';
        ctx.fillRect(0, 0, width, height);
    }
    
    // Borders
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, width, height);
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, width - 20, height - 20);
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, width - 36, height - 36);

    // WANTED title
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '81px CaptainKiddNF, Arial, sans-serif';
    ctx.fillText('WANTED', width/2, height * 0.08);

    // Photo area
    const photoSize = 380;
    const photoX = (width - photoSize) / 2;
    const photoY = height * 0.35 - photoSize/2;
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeRect(photoX, photoY, photoSize, photoSize);

    // Avatar
    if (member) {
        try {
            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true });
            const avatar = await loadImage(avatarURL);
            
            ctx.save();
            ctx.beginPath();
            ctx.rect(photoX + 3, photoY + 3, photoSize - 6, photoSize - 6);
            ctx.clip();
            ctx.filter = 'contrast(0.95) sepia(0.05)';
            ctx.drawImage(avatar, photoX + 3, photoY + 3, photoSize - 6, photoSize - 6);
            ctx.filter = 'none';
            ctx.restore();
        } catch {
            console.log('[DEBUG] No avatar loaded');
        }
    }

    // DEAD OR ALIVE
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.font = '57px CaptainKiddNF, Arial, sans-serif';
    ctx.fillText('DEAD OR ALIVE', width/2, height * 0.61);

    // Name
    ctx.font = '69px CaptainKiddNF, Arial, sans-serif';
    let displayName = member.displayName.replace(/[^\w\s-]/g, '').toUpperCase().substring(0, 16);
    let nameWidth = ctx.measureText(displayName).width;
    if (nameWidth > width - 60) {
        ctx.font = '55px CaptainKiddNF, Arial, sans-serif';
    }
    ctx.fillText(displayName, width/2, height * 0.70);

    // BOUNTY AMOUNT - FIXED TO USE ACTUAL BOUNTY
    const bountyAmount = getBountyForLevel(userStats.level);
    const bountyStr = bountyAmount.toLocaleString();
    
    console.log(`[CANVAS] Drawing bounty for level ${userStats.level}: ฿${bountyStr}`);
    
    ctx.font = '54px Cinzel, Georgia, serif';
    const bountyTextWidth = ctx.measureText(bountyStr).width;
    
    const berrySize = 48;
    const gap = 30;
    const totalWidth = berrySize + gap + bountyTextWidth;
    const startX = (width - totalWidth) / 2;
    
    // Berry symbol
    let berryImg;
    try {
        berryImg = await loadImage(path.join(__dirname, '../../assets/berry.png'));
    } catch {
        const berryCanvas = createCanvas(berrySize, berrySize);
        const berryCtx = berryCanvas.getContext('2d');
        berryCtx.fillStyle = '#111';
        berryCtx.font = `bold ${berrySize}px serif`;
        berryCtx.textAlign = 'center';
        berryCtx.textBaseline = 'middle';
        berryCtx.fillText('฿', berrySize/2, berrySize/2);
        berryImg = berryCanvas;
    }
    
    ctx.drawImage(berryImg, startX, height * 0.78 - berrySize/2, berrySize, berrySize);

    // Bounty numbers
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111';
    ctx.fillText(bountyStr, startX + berrySize + gap, height * 0.78);

    // One Piece logo
    try {
        const logo = await loadImage(path.join(__dirname, '../../assets/one-piece-symbol.png'));
        const logoSize = 52;
        ctx.globalAlpha = 0.6;
        ctx.drawImage(logo, (width - logoSize)/2, height * 0.955 - logoSize/2, logoSize, logoSize);
        ctx.globalAlpha = 1.0;
    } catch {
        console.log('[DEBUG] One Piece logo not found');
    }

    // MARINE text
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font = '24px TimesNewNormal, Times, serif';
    ctx.fillStyle = '#111';
    ctx.fillText('M A R I N E', width * 0.96, height * 0.98);

    return canvas.toBuffer();
}

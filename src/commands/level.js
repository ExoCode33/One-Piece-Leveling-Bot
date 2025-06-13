// src/commands/level.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');
const { getBountyForLevel } = require('../utils/bountySystem');

// Register custom fonts for wanted posters
try {
    registerFont(path.join(__dirname, '../../assets/fonts/captkd.ttf'), { family: 'CaptainKiddNF' });
    registerFont(path.join(__dirname, '../../assets/fonts/Cinzel-Bold.otf'), { family: 'Cinzel' });
    registerFont(path.join(__dirname, '../../assets/fonts/Times New Normal Regular.ttf'), { family: 'TimesNewNormal' });
    console.log('[DEBUG] Successfully registered custom fonts for level command');
} catch (error) {
    console.warn('[WARNING] Could not register custom fonts for level command:', error.message);
}

// Bounty calculation with fallback
function calculateBountyForLevel(level) {
    const bountyLadder = {
        0: 0, 1: 1000000, 2: 3000000, 3: 5000000, 4: 8000000, 5: 30000000,
        6: 35000000, 7: 42000000, 8: 50000000, 9: 60000000, 10: 81000000,
        11: 88000000, 12: 95000000, 13: 105000000, 14: 110000000, 15: 120000000,
        16: 130000000, 17: 140000000, 18: 170000000, 19: 200000000, 20: 200000000,
        21: 210000000, 22: 230000000, 23: 250000000, 24: 280000000, 25: 320000000,
        26: 340000000, 27: 370000000, 28: 400000000, 29: 450000000, 30: 500000000,
        31: 520000000, 32: 550000000, 33: 600000000, 34: 700000000, 35: 860000000,
        36: 900000000, 37: 950000000, 38: 1000000000, 39: 1030000000, 40: 1057000000,
        41: 1100000000, 42: 1200000000, 43: 1300000000, 44: 1400000000, 45: 1500000000,
        46: 1800000000, 47: 2100000000, 48: 2400000000, 49: 2700000000, 50: 3000000000,
        51: 3500000000, 52: 4000000000, 53: 4200000000, 54: 4500000000, 55: 5000000000
    };
    return bountyLadder[level] || 0;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Check your bounty and wanted poster')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Check another pirate\'s bounty')
                .setRequired(false)),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            // Get target user
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const targetMember = await interaction.guild.members.fetch(targetUser.id);

            // Get XP tracker from global
            const xpTracker = global.xpTracker;
            if (!xpTracker) {
                return await interaction.editReply({ 
                    content: '❌ XP tracking system is not available.', 
                    ephemeral: true 
                });
            }

            // Get user stats
            const userStats = await xpTracker.getUserStats(interaction.guild.id, targetUser.id);
            if (!userStats) {
                return await interaction.editReply({ 
                    content: '❌ No bounty record found for this pirate.', 
                    ephemeral: true 
                });
            }

            console.log(`[LEVEL] User stats - Level: ${userStats.level}, XP: ${userStats.xp}`);

            // Get bounty amount
            let bountyAmount;
            try {
                bountyAmount = getBountyForLevel(userStats.level);
            } catch (error) {
                bountyAmount = calculateBountyForLevel(userStats.level);
            }

            console.log(`[LEVEL] Level ${userStats.level} = Bounty ฿${bountyAmount.toLocaleString()}`);

            // Get leaderboard position
            const leaderboard = await xpTracker.getLeaderboard(interaction.guild.id, 100);
            const rank = leaderboard.findIndex(user => user.userId === targetUser.id) + 1;

            // Check for Pirate King status
            const settings = global.guildSettings?.get(interaction.guild.id) || {};
            const excludedRoleId = settings.excludedRole;
            const isPirateKing = excludedRoleId && targetMember.roles.cache.has(excludedRoleId);

            // Create wanted poster
            const attachment = await createWantedPoster(userStats, targetUser, interaction.guild);

            // Calculate next level progress
            const currentLevel = userStats.level;
            const currentXP = userStats.xp;
            let nextLevelXP = 0;
            let xpNeeded = 0;
            let progressPercentage = 100;

            if (currentLevel < 55) {
                const curve = process.env.FORMULA_CURVE || 'exponential';
                const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
                
                if (curve === 'exponential') {
                    nextLevelXP = Math.floor(Math.pow((currentLevel + 1) / multiplier, 2) * 100);
                } else {
                    for (let i = 0; i <= currentLevel; i++) {
                        nextLevelXP += 500 + (i * (multiplier * 100));
                    }
                }
                
                xpNeeded = Math.max(0, nextLevelXP - currentXP);
                progressPercentage = nextLevelXP > 0 ? Math.floor((currentXP / nextLevelXP) * 100) : 100;
            }

            // Get threat level name
            function getThreatLevelName(level) {
                if (level >= 55) return "LEGENDARY THREAT";
                if (level >= 50) return "EMPEROR CLASS";
                if (level >= 45) return "EXTRAORDINARY";
                if (level >= 40) return "ELITE LEVEL";
                if (level >= 35) return "TERRITORIAL";
                if (level >= 30) return "ADVANCED COMBATANT";
                if (level >= 25) return "HIGH PRIORITY";
                if (level >= 20) return "DANGEROUS";
                if (level >= 15) return "GRAND LINE";
                if (level >= 10) return "ELEVATED";
                if (level >= 5) return "CONFIRMED CRIMINAL";
                return "MONITORING";
            }

            // Calculate activity breakdown
            const voiceHours = Math.floor(userStats.voice_time / 3600);
            const voiceMinutes = Math.floor((userStats.voice_time % 3600) / 60);
            const totalActivity = userStats.messages + userStats.reactions + Math.floor(userStats.voice_time / 60);

            // Create One Piece themed embed
            const embed = new EmbedBuilder()
                .setTitle('🚨 WORLD GOVERNMENT BOUNTY RECORD 🚨')
                .setDescription(`**Marine Intelligence Report** • *Classification: ${getThreatLevelName(userStats.level)}*`)
                .setColor(isPirateKing ? '#FF0000' : userStats.level >= 40 ? '#FF4500' : userStats.level >= 25 ? '#FF8C00' : userStats.level >= 10 ? '#FFD700' : '#4169E1')
                .addFields(
                    { 
                        name: '🏴‍☠️ Criminal Identity', 
                        value: `**${targetMember.displayName}**\n*Alias: ${targetUser.username}*`, 
                        inline: true 
                    },
                    { 
                        name: '🏆 Current Standing', 
                        value: isPirateKing ? '**PIRATE KING**\n*Ruler of Grand Line*' : `**Rank #${rank}**\n*Most Wanted List*`, 
                        inline: true 
                    },
                    { 
                        name: '💰 Active Bounty', 
                        value: `**฿${bountyAmount.toLocaleString()}**\n*Level ${userStats.level} Threat*`, 
                        inline: true 
                    }
                );

            // Add progress section for active pirates
            if (currentLevel < 55 && !isPirateKing) {
                let nextBounty;
                try {
                    nextBounty = getBountyForLevel(currentLevel + 1);
                } catch (error) {
                    nextBounty = calculateBountyForLevel(currentLevel + 1);
                }
                const bountyIncrease = nextBounty - bountyAmount;
                
                embed.addFields(
                    { 
                        name: '📈 Threat Assessment', 
                        value: `**Next Bounty:** ฿${nextBounty.toLocaleString()}\n**Increase:** +฿${bountyIncrease.toLocaleString()}`, 
                        inline: true 
                    },
                    { 
                        name: '⚡ Criminal Progress', 
                        value: `**${progressPercentage}%** to Level ${currentLevel + 1}\n**${xpNeeded.toLocaleString()}** XP remaining`, 
                        inline: true 
                    },
                    { 
                        name: '🎯 Threat Level', 
                        value: `**${getThreatLevelName(currentLevel)}**\n*Escalation: ${getThreatLevelName(currentLevel + 1)}*`, 
                        inline: true 
                    }
                );
            } else if (currentLevel >= 55) {
                embed.addFields(
                    { 
                        name: '👑 Maximum Threat', 
                        value: '**LEGENDARY STATUS**\n*Beyond Classification*', 
                        inline: true 
                    },
                    { 
                        name: '🌟 Achievement', 
                        value: '**ULTIMATE PIRATE**\n*Seas Conquered*', 
                        inline: true 
                    },
                    { 
                        name: '⚠️ Warning Level', 
                        value: '**EXTREME CAUTION**\n*Fleet Response Required*', 
                        inline: true 
                    }
                );
            }

            // Criminal Activity Report
            embed.addFields(
                { 
                    name: '📊 Criminal Activity Report', 
                    value: `**Communications:** ${userStats.messages.toLocaleString()} intercepted\n**Social Network:** ${userStats.reactions.toLocaleString()} connections\n**Operations Time:** ${voiceHours}h ${voiceMinutes}m monitored\n**Total Activity:** ${totalActivity.toLocaleString()} incidents`, 
                    inline: false 
                }
            );

            // Special status for Pirate King
            if (isPirateKing) {
                embed.addFields({
                    name: '👑 Special Classification',
                    value: '**PIRATE KING STATUS**\n*Ruler of the Grand Line • Excluded from Active Bounty Tracking*\n⚠️ *Approach with Ultimate Caution* ⚠️',
                    inline: false
                });
            }

            // Add Marine footer
            embed.setImage(`attachment://wanted_${targetUser.id}.png`)
                .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
                .setFooter({ 
                    text: `⚓ Marine Headquarters • Intelligence Division • ${isPirateKing ? 'EMPEROR THREAT' : `Case #${String(rank).padStart(4, '0')}`}` 
                })
                .setTimestamp();

            // Add author field for official look
            embed.setAuthor({ 
                name: isPirateKing ? 'PIRATE KING MONITORING REPORT' : 'BOUNTY ASSESSMENT REPORT'
            });

            await interaction.editReply({ embeds: [embed], files: [attachment] });

        } catch (error) {
            console.error('[LEVEL] Error executing level command:', error);
            await interaction.editReply({ 
                content: '❌ An error occurred while generating your bounty poster.', 
                ephemeral: true 
            });
        }
    }
};

async function createWantedPoster(userStats, user, guild) {
    console.log(`[CANVAS] Creating wanted poster for level ${userStats.level}`);
    
    const width = 600, height = 900;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Get bounty amount for level instead of XP
    let bountyAmount;
    try {
        bountyAmount = getBountyForLevel(userStats.level);
    } catch (error) {
        bountyAmount = calculateBountyForLevel(userStats.level);
    }
    
    console.log(`[CANVAS] Drawing bounty for level ${userStats.level}: ฿${bountyAmount.toLocaleString()}`);

    // Background - old paper texture
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#F4E4BC');
    gradient.addColorStop(0.5, '#E8D5A3');
    gradient.addColorStop(1, '#D4C299');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Add paper texture with noise
    for (let i = 0; i < 2000; i++) {
        ctx.fillStyle = `rgba(139, 119, 101, ${Math.random() * 0.1})`;
        ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
    }

    // WANTED header
    ctx.fillStyle = '#8B0000';
    ctx.font = 'bold 72px CaptainKiddNF, serif';
    ctx.textAlign = 'center';
    const wantedWidth = ctx.measureText('WANTED').width;
    ctx.fillText('WANTED', width / 2, 80);

    // Underline for WANTED
    ctx.beginPath();
    ctx.moveTo((width - wantedWidth) / 2, 90);
    ctx.lineTo((width + wantedWidth) / 2, 90);
    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Main portrait area
    const portraitSize = 280;
    const portraitX = (width - portraitSize) / 2;
    const portraitY = 120;

    // Portrait background (dark frame)
    ctx.fillStyle = '#2C1810';
    ctx.fillRect(portraitX - 10, portraitY - 10, portraitSize + 20, portraitSize + 20);

    try {
        // Load and draw user avatar
        const avatar = await loadImage(user.displayAvatarURL({ extension: 'png', size: 512 }));
        
        // Create circular clipping path
        ctx.save();
        ctx.beginPath();
        ctx.arc(portraitX + portraitSize/2, portraitY + portraitSize/2, portraitSize/2, 0, Math.PI * 2);
        ctx.clip();
        
        ctx.drawImage(avatar, portraitX, portraitY, portraitSize, portraitSize);
        ctx.restore();
        
        // Portrait border
        ctx.beginPath();
        ctx.arc(portraitX + portraitSize/2, portraitY + portraitSize/2, portraitSize/2, 0, Math.PI * 2);
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 6;
        ctx.stroke();
        
    } catch (error) {
        console.warn('[CANVAS] Could not load avatar, using placeholder');
        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(portraitX, portraitY, portraitSize, portraitSize);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('NO PHOTO', portraitX + portraitSize/2, portraitY + portraitSize/2);
    }

    // Pirate name
    ctx.fillStyle = '#2C1810';
    ctx.font = 'bold 48px CaptainKiddNF, serif';
    ctx.textAlign = 'center';
    const name = user.displayName || user.username;
    ctx.fillText(name, width / 2, portraitY + portraitSize + 60);

    // Bounty amount background
    const bountyBgY = portraitY + portraitSize + 100;
    ctx.fillStyle = '#8B0000';
    ctx.fillRect(50, bountyBgY, width - 100, 120);
    
    // Bounty border
    ctx.strokeStyle = '#2C1810';
    ctx.lineWidth = 4;
    ctx.strokeRect(50, bountyBgY, width - 100, 120);

    // Bounty text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '32px CaptainKiddNF, serif';
    ctx.textAlign = 'center';
    ctx.fillText('BOUNTY', width / 2, bountyBgY + 35);

    // Bounty amount
    ctx.font = '54px Cinzel, Georgia, serif';
    const bountyStr = `฿${bountyAmount.toLocaleString()}`;
    const bountyTextWidth = ctx.measureText(bountyStr).width;
    const bountyX = width / 2;
    const bountyY = bountyBgY + 85;
    
    // Bounty amount shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillText(bountyStr, bountyX + 2, bountyY + 2);
    
    // Bounty amount main text
    ctx.fillStyle = '#FFD700';
    ctx.fillText(bountyStr, bountyX, bountyY);

    // DEAD OR ALIVE text
    ctx.fillStyle = '#8B0000';
    ctx.font = 'bold 36px CaptainKiddNF, serif';
    ctx.textAlign = 'center';
    ctx.fillText('DEAD OR ALIVE', width / 2, bountyBgY + 160);

    // Marine seal/logo area
    const sealY = bountyBgY + 200;
    ctx.fillStyle = '#2C4B8C';
    ctx.font = '24px TimesNewNormal, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MARINE', width / 2, sealY);
    
    ctx.font = '18px TimesNewNormal, Arial, sans-serif';
    ctx.fillText('WORLD GOVERNMENT', width / 2, sealY + 25);

    // Level indicator
    ctx.fillStyle = '#8B0000';
    ctx.font = 'bold 28px CaptainKiddNF, serif';
    ctx.textAlign = 'center';
    ctx.fillText(`THREAT LEVEL: ${userStats.level}`, width / 2, sealY + 60);

    // Create attachment
    const buffer = canvas.toBuffer('image/png');
    const attachment = {
        attachment: buffer,
        name: `wanted_${user.id}.png`
    };

    return attachment;
}

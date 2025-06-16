// src/commands/level.js - Enhanced Marine themed version with Canvas
const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { getBountyForLevel } = require('../utils/bountySystem');
const path = require('path');

// Register custom fonts
try {
    registerFont(path.join(__dirname, '../../assets/fonts/captkd.ttf'), { family: 'CaptainKiddNF' });
    registerFont(path.join(__dirname, '../../assets/fonts/Cinzel-Bold.otf'), { family: 'Cinzel' });
    registerFont(path.join(__dirname, '../../assets/fonts/Times New Normal Regular.ttf'), { family: 'TimesNewNormal' });
    console.log('[DEBUG] Level command: Successfully registered custom fonts');
} catch (error) {
    console.error('[ERROR] Level command: Failed to register custom fonts:', error.message);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('View level information and stats')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to check level for')
                .setRequired(false)),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const member = interaction.guild.members.cache.get(targetUser.id);
            
            if (!member) {
                return await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('MARINE INTELLIGENCE BUREAU')
                        .setDescription('```diff\n- TARGET NOT FOUND IN DATABASE\n- INSUFFICIENT INTELLIGENCE DATA\n```')
                        .setFooter({ text: 'World Government Intelligence Division' })
                        .setTimestamp()],
                    ephemeral: true
                });
            }

            // Check if xpTracker exists
            if (!global.xpTracker) {
                console.error('[ERROR] XP Tracker not initialized');
                return await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('MARINE INTELLIGENCE BUREAU')
                        .setDescription('```diff\n- INTELLIGENCE SYSTEM OFFLINE\n- XP TRACKER NOT INITIALIZED\n```')
                        .setFooter({ text: 'World Government Intelligence Division' })
                        .setTimestamp()],
                    ephemeral: true
                });
            }

            // Defer reply for Canvas processing
            await interaction.deferReply();

            // Get user stats from database directly
            console.log(`[DEBUG] Getting stats for user ${targetUser.id} in guild ${interaction.guild.id}`);
            
            const userStats = await global.xpTracker.db.query(
                'SELECT * FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                [targetUser.id, interaction.guild.id]
            );
            
            if (!userStats.rows || userStats.rows.length === 0) {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('MARINE INTELLIGENCE BUREAU')
                        .setDescription('```diff\n- NO CRIMINAL RECORD FOUND\n- TARGET NOT IN DATABASE\n```')
                        .setFooter({ text: 'World Government Intelligence Division' })
                        .setTimestamp()]
                });
            }

            const userData = userStats.rows[0];
            const currentLevel = global.xpTracker.calculateLevel(userData.total_xp);
            const totalXP = userData.total_xp;
            const currentBounty = getBountyForLevel(currentLevel);
            const nextBounty = getBountyForLevel(currentLevel + 1);
            
            // Calculate XP needed for next level
            const currentLevelXP = global.xpTracker.getXPForLevel(currentLevel);
            const nextLevelXP = global.xpTracker.getXPForLevel(currentLevel + 1);
            const neededXP = nextLevelXP - totalXP;

            // Get user rank
            const rankQuery = await global.xpTracker.db.query(
                'SELECT COUNT(*) + 1 as rank FROM user_levels WHERE guild_id = $1 AND total_xp > $2',
                [interaction.guild.id, totalXP]
            );
            const userRank = rankQuery.rows[0]?.rank || 'Unknown';

            // Create Canvas level card
            const canvas = await createLevelCard(userData, member, currentLevel, currentBounty, totalXP, userRank, neededXP, nextBounty);
            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `level_${targetUser.id}.png` });

            // Create Marine Intelligence report with single-line format
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('MARINE INTELLIGENCE BUREAU')
                .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
                .setDescription('```diff\n- CRIMINAL PROFILE: ' + member.displayName.toUpperCase() + '\n- THREAT ASSESSMENT COMPLETE\n```')
                .addFields(
                    {
                        name: 'CURRENT BOUNTY',
                        value: '```diff\n- ' + currentBounty.toLocaleString() + ' BERRIES\n```',
                        inline: true
                    },
                    {
                        name: 'THREAT LEVEL',
                        value: '```diff\n- LEVEL ' + currentLevel + '\n```',
                        inline: true
                    },
                    {
                        name: 'FLEET RANKING',
                        value: '```diff\n- RANK #' + userRank + '\n```',
                        inline: true
                    },
                    {
                        name: 'TOTAL CRIMINAL ACTIVITY',
                        value: '```diff\n- ' + totalXP.toLocaleString() + ' XP ACCUMULATED\n```',
                        inline: true
                    },
                    {
                        name: 'ADVANCEMENT PROGRESS',
                        value: '```diff\n- ' + neededXP.toLocaleString() + ' XP REQUIRED\n```',
                        inline: true
                    },
                    {
                        name: 'NEXT BOUNTY INCREASE',
                        value: '```diff\n- ' + nextBounty.toLocaleString() + ' BERRIES\n```',
                        inline: true
                    }
                )
                .setImage(`attachment://level_${targetUser.id}.png`)
                .setFooter({ 
                    text: 'WORLD GOVERNMENT INTELLIGENCE DIVISION',
                    iconURL: interaction.guild.iconURL() 
                })
                .setTimestamp();

            // Add threat assessment based on level
            let threatLevel = '';
            if (currentLevel >= 50) {
                threatLevel = '```diff\n- EXTREMELY DANGEROUS\n- SUPERNOVA THREAT\n- IMMEDIATE CAPTURE REQUIRED\n```';
            } else if (currentLevel >= 30) {
                threatLevel = '```diff\n- HIGH THREAT LEVEL\n- EXPERIENCED CRIMINAL\n- PROCEED WITH CAUTION\n```';
            } else if (currentLevel >= 15) {
                threatLevel = '```diff\n- MODERATE THREAT\n- ACTIVE PIRATE\n- STANDARD OPERATIONS\n```';
            } else if (currentLevel >= 5) {
                threatLevel = '```diff\n- LOW THREAT LEVEL\n- ROOKIE PIRATE\n- ROUTINE MONITORING\n```';
            } else {
                threatLevel = '```diff\n- MINIMAL THREAT\n- CIVILIAN ACTIVITY\n- BASIC SURVEILLANCE\n```';
            }

            embed.addFields({
                name: 'INTELLIGENCE ASSESSMENT',
                value: threatLevel,
                inline: false
            });

            await interaction.editReply({ embeds: [embed], files: [attachment] });

        } catch (error) {
            console.error('[ERROR] Error in level command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('MARINE INTELLIGENCE BUREAU')
                .setDescription('```diff\n- INTELLIGENCE SYSTEM ERROR\n- DATA RETRIEVAL FAILED\n- CONTACT MARINE HEADQUARTERS\n```')
                .setFooter({ text: 'World Government Intelligence Division' })
                .setTimestamp();

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }
};

// Create level card with Canvas (similar to leaderboard wanted posters)
async function createLevelCard(userData, member, level, bounty, totalXP, rank, neededXP, nextBounty) {
    const width = 800, height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Load and draw scroll texture background
    try {
        const scrollTexture = await loadImage(path.join(__dirname, '../../assets/scroll_texture.jpg'));
        ctx.drawImage(scrollTexture, 0, 0, width, height);
    } catch (error) {
        // Fallback to parchment background
        ctx.fillStyle = '#f5e6c5';
        ctx.fillRect(0, 0, width, height);
    }
    
    // All borders black
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, width, height);
    
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, width - 20, height - 20);
    
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, width - 36, height - 36);

    // "LEVEL REPORT" title
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '60px CaptainKiddNF, Arial, sans-serif';
    ctx.fillText('LEVEL REPORT', width/2, 80);

    // Avatar box
    const avatarSize = 200;
    const avatarX = 60;
    const avatarY = 120;
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeRect(avatarX, avatarY, avatarSize, avatarSize);
    
    // Draw avatar
    if (member) {
        try {
            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true });
            const avatar = await loadImage(avatarURL);
            
            ctx.save();
            ctx.beginPath();
            ctx.rect(avatarX + 3, avatarY + 3, avatarSize - 6, avatarSize - 6);
            ctx.clip();
            ctx.filter = 'contrast(0.95) sepia(0.05)';
            ctx.drawImage(avatar, avatarX + 3, avatarY + 3, avatarSize - 6, avatarSize - 6);
            ctx.filter = 'none';
            ctx.restore();
        } catch {
            console.log('[DEBUG] No avatar found for level card');
        }
    }

    // Name
    ctx.font = '48px CaptainKiddNF, Arial, sans-serif';
    ctx.textAlign = 'left';
    let displayName = member ? member.displayName.replace(/[^\w\s-]/g, '').toUpperCase().substring(0, 16) : 'UNKNOWN PIRATE';
    ctx.fillText(displayName, avatarX + avatarSize + 40, avatarY + 40);

    // Level
    ctx.font = '36px Cinzel, Georgia, serif';
    ctx.fillText(`LEVEL ${level}`, avatarX + avatarSize + 40, avatarY + 80);

    // Rank
    ctx.font = '30px Cinzel, Georgia, serif';
    ctx.fillText(`RANK #${rank}`, avatarX + avatarSize + 40, avatarY + 120);

    // Bounty section
    const bountyY = avatarY + 180;
    ctx.font = '32px CaptainKiddNF, Arial, sans-serif';
    ctx.fillText('CURRENT BOUNTY:', 60, bountyY);
    
    // Berry symbol and bounty amount
    let berryImg;
    try {
        berryImg = await loadImage(path.join(__dirname, '../../assets/berry.png'));
    } catch {
        // Create simple berry symbol
        const berryCanvas = createCanvas(40, 40);
        const berryCtx = berryCanvas.getContext('2d');
        berryCtx.fillStyle = '#111';
        berryCtx.font = 'bold 40px serif';
        berryCtx.textAlign = 'center';
        berryCtx.textBaseline = 'middle';
        berryCtx.fillText('฿', 20, 20);
        berryImg = berryCanvas;
    }
    
    ctx.drawImage(berryImg, 60, bountyY + 20, 40, 40);
    ctx.font = '36px Cinzel, Georgia, serif';
    ctx.fillText(bounty.toLocaleString(), 120, bountyY + 45);

    // Stats section
    const statsY = bountyY + 100;
    ctx.font = '24px TimesNewNormal, Times, serif';
    
    ctx.fillText(`Total XP: ${totalXP.toLocaleString()}`, 60, statsY);
    ctx.fillText(`XP Required: ${neededXP.toLocaleString()}`, 60, statsY + 40);
    ctx.fillText(`Next Bounty: ฿${nextBounty.toLocaleString()}`, 60, statsY + 80);

    // Progress bar
    const progressBarX = 60;
    const progressBarY = statsY + 120;
    const progressBarWidth = width - 120;
    const progressBarHeight = 30;
    
    // Calculate progress
    const currentLevelXP = global.xpTracker.getXPForLevel(level);
    const nextLevelXP = global.xpTracker.getXPForLevel(level + 1);
    const progressXP = totalXP - currentLevelXP;
    const totalLevelXP = nextLevelXP - currentLevelXP;
    const progressPercent = Math.max(0, Math.min(1, progressXP / totalLevelXP));
    
    // Progress bar background
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight);
    
    // Progress bar fill
    ctx.fillStyle = '#DC143C';
    ctx.fillRect(progressBarX, progressBarY, progressBarWidth * progressPercent, progressBarHeight);
    
    // Progress bar border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight);
    
    // Progress text
    ctx.fillStyle = '#111';
    ctx.font = '20px TimesNewNormal, Times, serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(progressPercent * 100)}% TO NEXT LEVEL`, width/2, progressBarY + 55);

    // Marine watermark
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font = '18px TimesNewNormal, Times, serif';
    ctx.fillStyle = '#666';
    ctx.fillText('M A R I N E   I N T E L L I G E N C E', width - 30, height - 30);

    return canvas;
}

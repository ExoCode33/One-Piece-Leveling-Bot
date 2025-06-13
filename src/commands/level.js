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

            // Create wanted poster using the same function as leaderboard
            const attachment = await createWantedPoster(userStats, targetMember, interaction.guild);

            // Calculate next level progress (XP-based)
            const currentLevel = userStats.level;
            const currentXP = userStats.xp;
            let nextLevelXP = 0;
            let xpNeeded = 0;
            let progressText = 'MAX LEVEL';

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
                progressText = `${currentXP.toLocaleString()}/${nextLevelXP.toLocaleString()}`;
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

            // Calculate voice activity
            const voiceHours = Math.floor(userStats.voice_time / 3600);
            const voiceMinutes = Math.floor((userStats.voice_time % 3600) / 60);

            // Create minimalist red Marine Intelligence Report embed
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: '🌐 WORLD GOVERNMENT INTELLIGENCE BUREAU'
                })
                .setTitle(`📋 BOUNTY ASSESSMENT REPORT #${String(rank).padStart(4, '0')}`)
                .setDescription(`\`\`\`diff\n${isPirateKing ? '+ EMPEROR-CLASS THREAT DETECTED' : '- ACTIVE CRIMINAL SURVEILLANCE'}\n\`\`\``)
                .setColor(0xFF0000); // Red color

            // Intelligence header section
            embed.addFields({
                name: '📊 INTELLIGENCE SUMMARY',
                value: `\`\`\`css\nUsername: ${targetUser.username}\nAlias: ${targetMember.displayName}\nThreat Classification: ${getThreatLevelName(userStats.level)}\nBounty Status: ${isPirateKing ? 'EMPEROR EXCLUSION' : 'ACTIVE SURVEILLANCE'}\nBounty Amount: ฿${bountyAmount.toLocaleString()}\nProgress to Next Level: ${progressText}\nThreat Level: Level ${userStats.level}\nRanking: #${rank}\n\n[Communication Intercepts]\nMessages = ${userStats.messages.toLocaleString()}\nReactions = ${userStats.reactions.toLocaleString()}\n\n[Operational Monitoring]\nVoice Activity = ${voiceHours}h ${voiceMinutes}m\n\n[Behavioral Analysis]\nActivity Level = ${userStats.messages + userStats.reactions + Math.floor(userStats.voice_time / 60) > 1000 ? 'HIGH' : userStats.messages + userStats.reactions + Math.floor(userStats.voice_time / 60) > 500 ? 'MODERATE' : userStats.messages + userStats.reactions + Math.floor(userStats.voice_time / 60) > 100 ? 'LOW' : 'MINIMAL'}\nThreat Assessment = ${getThreatLevelName(userStats.level)}\n\`\`\``,
                inline: false
            });

            // Special classifications
            if (isPirateKing) {
                embed.addFields({
                    name: '👑 SPECIAL CLASSIFICATION',
                    value: `\`\`\`diff\n+ EMPEROR STATUS CONFIRMED\n+ EXCLUDED FROM BOUNTY TRACKING\n+ MAXIMUM THREAT DESIGNATION\n! APPROACH WITH EXTREME CAUTION\n\`\`\``,
                    inline: false
                });
            }

            // Professional footer with case information
            embed.setImage(`attachment://wanted_${targetUser.id}.png`)
                .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
                .setFooter({ 
                    text: `⚓ Marine Intelligence Division • Sector Analysis Unit • Classification: ${isPirateKing ? 'EMPEROR' : getThreatLevelName(userStats.level)}`
                })
                .setTimestamp();

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

async function createWantedPoster(userStats, member, guild) {
    console.log(`[CANVAS] Creating wanted poster for level ${userStats.level}`);
    
    const width = 600, height = 900;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Load and draw scroll texture background
    try {
        const scrollTexture = await loadImage(path.join(__dirname, '../../assets/scroll_texture.jpg'));
        
        // Draw the texture to fill the entire canvas
        ctx.drawImage(scrollTexture, 0, 0, width, height);
        
        console.log('[DEBUG] Successfully loaded scroll texture background');
    } catch (error) {
        console.log('[DEBUG] Scroll texture not found, using fallback parchment color');
        // Fallback to original parchment background if texture fails to load
        ctx.fillStyle = '#f5e6c5';
        ctx.fillRect(0, 0, width, height);
    }
    
    // All borders and elements go on top of the texture
    // All borders now black for consistency
    ctx.strokeStyle = '#000000'; // Outer border - black
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, width, height);
    
    ctx.strokeStyle = '#000000'; // Middle border - black
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, width - 20, height - 20);
    
    ctx.strokeStyle = '#000000'; // Inner border - black
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, width - 36, height - 36);

    // WANTED title - Size 27, Horiz 50, Vert 92
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '81px CaptainKiddNF, Arial, sans-serif'; // Size 27/100 * 300 = 81px
    const wantedY = height * (1 - 92/100); // Vert 92: 92% from bottom = 8% from top
    const wantedX = (50/100) * width; // Horiz 50: centered
    ctx.fillText('WANTED', wantedX, wantedY);

    // Image Box - Size 95, Horiz 50, Vert 65 with slightly wider border
    const photoSize = (95/100) * 400; // Size 95/100 * reasonable max = 380px
    const photoX = ((50/100) * width) - (photoSize/2); // Horiz 50: centered
    const photoY = height * (1 - 65/100) - (photoSize/2); // Vert 65: 65% from bottom
    
    // Slightly wider black border
    ctx.strokeStyle = '#000000'; // Black border
    ctx.lineWidth = 3; // Increased from 1 to 3 for wider border
    ctx.strokeRect(photoX, photoY, photoSize, photoSize);
    
    // No white background - image goes directly on texture

    const avatarArea = { x: photoX + 3, y: photoY + 3, width: photoSize - 6, height: photoSize - 6 }; // Adjusted for wider border
    if (member) {
        try {
            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true });
            const avatar = await loadImage(avatarURL);
            
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
            // If no avatar, just leave the texture showing through with border
            console.log('[DEBUG] No avatar found, texture will show through');
        }
    }

    // "DEAD OR ALIVE" - Size 19, Horiz 50, Vert 39
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '57px CaptainKiddNF, Arial, sans-serif'; // Size 19/100 * 300 = 57px
    const deadOrAliveY = height * (1 - 39/100); // Vert 39: 39% from bottom
    const deadOrAliveX = (50/100) * width; // Horiz 50: centered
    ctx.fillText('DEAD OR ALIVE', deadOrAliveX, deadOrAliveY);

    // Name ("SHANKS") - Size 23, Horiz 50, Vert 30
    ctx.font = '69px CaptainKiddNF, Arial, sans-serif'; // Size 23/100 * 300 = 69px
    let displayName = 'UNKNOWN PIRATE';
    if (member) displayName = member.displayName.replace(/[^\w\s-]/g, '').toUpperCase().substring(0, 16);
    
    // Check if name is too long and adjust
    ctx.textAlign = 'center';
    let nameWidth = ctx.measureText(displayName).width;
    if (nameWidth > width - 60) {
        ctx.font = '55px CaptainKiddNF, Arial, sans-serif';
    }
    
    const nameY = height * (1 - 30/100); // Vert 30: 30% from bottom
    const nameX = (50/100) * width; // Horiz 50: centered
    ctx.fillText(displayName, nameX, nameY);

    // Berry Symbol and Bounty Numbers - FIXED TO USE BOUNTY AMOUNTS
    const berryBountyGap = 5; // Fixed gap in our 1-100 scale
    
    // FIXED: Get BOUNTY amount for user's level instead of XP
    const bountyAmount = getBountyForLevel(userStats.level);
    const bountyStr = bountyAmount.toLocaleString();
    
    console.log(`[LEVEL] Level ${userStats.level} = Bounty ฿${bountyStr}`);
    
    ctx.font = '54px Cinzel, Georgia, serif'; // Set font to measure text
    const bountyTextWidth = ctx.measureText(bountyStr).width;
    
    // Berry symbol size
    const berrySize = (32/100) * 150; // Size 32/100 * reasonable max = 48px
    
    // Calculate total width of the bounty unit (berry + gap + text)
    const gapPixels = (berryBountyGap/100) * width; // Convert gap to pixels
    const totalBountyWidth = berrySize + gapPixels + bountyTextWidth;
    
    // Center the entire bounty unit horizontally
    const bountyUnitStartX = (width - totalBountyWidth) / 2;
    
    // Position berry symbol at the start of the centered unit
    const berryX = bountyUnitStartX + (berrySize/2); // Center of berry symbol
    const berryY = height * (1 - 22/100) - (berrySize/2); // Vert 22: 22% from bottom
    
    let berryImg;
    try {
        const berryPath = path.join(__dirname, '../../assets/berry.png');
        berryImg = await loadImage(berryPath);
    } catch {
        // Create simple berry symbol
        const berryCanvas = createCanvas(berrySize, berrySize);
        const berryCtx = berryCanvas.getContext('2d');
        berryCtx.fillStyle = '#111';
        berryCtx.font = `bold ${berrySize}px serif`;
        berryCtx.textAlign = 'center';
        berryCtx.textBaseline = 'middle';
        berryCtx.fillText('฿', berrySize/2, berrySize/2);
        berryImg = berryCanvas;
    }
    
    ctx.drawImage(berryImg, berryX - (berrySize/2), berryY, berrySize, berrySize);

    // Position bounty numbers with fixed gap from berry
    const bountyX = bountyUnitStartX + berrySize + gapPixels; // Start after berry + gap
    const bountyY = height * (1 - 22/100); // Vert 22: 22% from bottom (same as berry)
    
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111';
    ctx.fillText(bountyStr, bountyX, bountyY);

    // One Piece logo - Size 26, Horiz 50, Vert 4.5
    try {
        const onePieceLogoPath = path.join(__dirname, '../../assets/one-piece-symbol.png');
        const onePieceLogo = await loadImage(onePieceLogoPath);
        const logoSize = (26/100) * 200; // Size 26/100 * reasonable max = 52px
        const logoX = ((50/100) * width) - (logoSize/2); // Horiz 50: centered
        const logoY = height * (1 - 4.5/100) - (logoSize/2); // Vert 4.5: 4.5% from bottom
        
        ctx.globalAlpha = 0.6;
        ctx.filter = 'sepia(0.2) brightness(0.9)';
        ctx.drawImage(onePieceLogo, logoX, logoY, logoSize, logoSize);
        ctx.globalAlpha = 1.0;
        ctx.filter = 'none';
    } catch {
        console.log('[DEBUG] One Piece logo not found at assets/one-piece-symbol.png');
    }

    // "MARINE" - Size 8, Horiz 96, Vert 2
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font = '24px TimesNewNormal, Times, serif'; // Size 8/100 * 300 = 24px
    ctx.fillStyle = '#111';
    
    const marineText = 'M A R I N E';
    const marineX = (96/100) * width; // Horiz 96: very far right
    const marineY = height * (1 - 2/100); // Vert 2: 2% from bottom
    ctx.fillText(marineText, marineX, marineY);

    // Create attachment
    const buffer = canvas.toBuffer('image/png');
    const attachment = {
        attachment: buffer,
        name: `wanted_${member.user.id}.png`
    };

    return attachment;
}

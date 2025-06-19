// src/commands/level.js - Enhanced Marine themed version with Pirate King support
const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { getBountyForLevel } = require('../utils/bountySystem');
const path = require('path');

// Register custom fonts - Keep your original font loading
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

            // Check if user has excluded role (Pirate King)
            const settings = global.guildSettings?.get(interaction.guild.id) || {};
            const excludedRoleId = settings.excludedRole || process.env.LEADERBOARD_EXCLUDE_ROLE;
            const isPirateKing = excludedRoleId && member.roles.cache.has(excludedRoleId);

            let userData;
            let currentLevel;
            let totalXP;
            let currentBounty;
            let nextBounty;
            let neededXP = 0;
            let userRank = 'Unknown';

            if (isPirateKing) {
                // Pirate King data - fixed level 55
                console.log(`[LEVEL] Displaying Pirate King data for ${targetUser.username}`);
                
                currentLevel = 55;
                totalXP = 999999999; // High XP for display
                currentBounty = getBountyForLevel(currentLevel, true); // true = isPirateKing
                nextBounty = currentBounty; // No next level for Pirate King
                userRank = 'PIRATE KING';
                
                userData = {
                    userId: targetUser.id,
                    level: currentLevel,
                    total_xp: totalXP,
                    messages: 0,
                    reactions: 0,
                    voice_time: 0,
                    member: member,
                    isPirateKing: true
                };
            } else {
                // Regular user data from database
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

                const dbData = userStats.rows[0];
                currentLevel = global.xpTracker.calculateLevel(dbData.total_xp);
                totalXP = dbData.total_xp;
                currentBounty = getBountyForLevel(currentLevel);
                nextBounty = getBountyForLevel(currentLevel + 1);
                
                // Calculate XP needed for next level
                const currentLevelXP = global.xpTracker.getXPForLevel(currentLevel);
                const nextLevelXP = global.xpTracker.getXPForLevel(currentLevel + 1);
                neededXP = nextLevelXP - totalXP;

                // Get user rank
                const rankQuery = await global.xpTracker.db.query(
                    'SELECT COUNT(*) + 1 as rank FROM user_levels WHERE guild_id = $1 AND total_xp > $2',
                    [interaction.guild.id, totalXP]
                );
                userRank = rankQuery.rows[0]?.rank || 'Unknown';

                userData = {
                    userId: targetUser.id,
                    level: currentLevel,
                    total_xp: totalXP,
                    messages: dbData.messages || 0,
                    reactions: dbData.reactions || 0,
                    voice_time: dbData.voice_time || 0,
                    member: member,
                    isPirateKing: false
                };
            }

            // Create Canvas wanted poster (EXACT SAME as leaderboard)
            const canvas = await createWantedPoster(userData, interaction.guild);
            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `wanted_${targetUser.id}.png` });

            // Helper function to get threat level name (same as leaderboard)
            function getThreatLevelName(level, isPirateKingCheck = false) {
                if (isPirateKingCheck) return "PIRATE KING";
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

            // Create Marine Intelligence report with EXACT SAME format as leaderboard
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: '🌐 WORLD GOVERNMENT INTELLIGENCE BUREAU'
                })
                .setColor(0xFF0000);

            // Intelligence summary for this pirate - ALL RED TEXT
            let intelligenceValue = `\`\`\`diff\n- Alias: ${member.displayName}\n- Bounty: ฿${currentBounty.toLocaleString()}\n- Level: ${currentLevel} | Rank: ${isPirateKing ? 'PIRATE KING' : `#${userRank}`}\n- Threat: ${getThreatLevelName(currentLevel, isPirateKing)}\n- Activity: ${userData.messages + userData.reactions + Math.floor(userData.voice_time / 60) > 1000 ? 'HIGH' : userData.messages + userData.reactions + Math.floor(userData.voice_time / 60) > 500 ? 'MODERATE' : userData.messages + userData.reactions + Math.floor(userData.voice_time / 60) > 100 ? 'LOW' : 'MINIMAL'}\n\`\`\``;

            embed.addFields({
                name: '📊 INTELLIGENCE SUMMARY',
                value: intelligenceValue,
                inline: false
            });

            // Add progress to next level (only for regular users)
            if (!isPirateKing) {
                const currentLevelXP = global.xpTracker.getXPForLevel(currentLevel);
                const nextLevelXP = global.xpTracker.getXPForLevel(currentLevel + 1);
                const progressXP = totalXP - currentLevelXP;
                const totalLevelXP = nextLevelXP - currentLevelXP;
                const progressPercent = Math.max(0, Math.min(100, Math.round((progressXP / totalLevelXP) * 100)));

                embed.addFields({
                    name: '📈 ADVANCEMENT ANALYSIS',
                    value: `\`\`\`diff\n- Progress to Next Level: ${progressPercent}%\n- XP Required: ${neededXP.toLocaleString()}\n- Next Bounty: ฿${nextBounty.toLocaleString()}\n- Total Criminal Activity: ${totalXP.toLocaleString()} XP\n\`\`\``,
                    inline: false
                });
            }

            if (isPirateKing) {
                // FIXED: Remove "EXCLUDED FROM BOUNTY TRACKING" and make all text red
                embed.addFields({
                    name: '👑 SPECIAL CLASSIFICATION',
                    value: `\`\`\`diff\n- EMPEROR STATUS CONFIRMED\n- MAXIMUM THREAT DESIGNATION\n- APPROACH WITH EXTREME CAUTION\n\`\`\``,
                    inline: false
                });
            }

            embed.setImage(`attachment://wanted_${targetUser.id}.png`)
                .setFooter({ 
                    text: `⚓ Marine Intelligence Division • Classification: ${isPirateKing ? 'EMPEROR' : getThreatLevelName(currentLevel)}`
                })
                .setTimestamp();

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

// EXACT SAME createWantedPoster function from leaderboard.js with Pirate King support
async function createWantedPoster(userData, guild) {
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

    let member = null;
    try {
        if (guild && userData.userId) member = await guild.members.fetch(userData.userId);
    } catch {}
    
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
    else if (userData.userId) displayName = `PIRATE ${userData.userId.slice(-4)}`;
    
    // Check if name is too long and adjust
    ctx.textAlign = 'center';
    let nameWidth = ctx.measureText(displayName).width;
    if (nameWidth > width - 60) {
        ctx.font = '55px CaptainKiddNF, Arial, sans-serif';
    }
    
    const nameY = height * (1 - 30/100); // Vert 30: 30% from bottom
    const nameX = (50/100) * width; // Horiz 50: centered
    ctx.fillText(displayName, nameX, nameY);

    // Berry Symbol and Bounty Numbers - FIXED TO USE BOUNTY AMOUNTS WITH PIRATE KING SUPPORT
    const berryBountyGap = 5; // Fixed gap in our 1-100 scale
    
    // FIXED: Get BOUNTY amount for user's level and check if Pirate King
    const isPirateKingData = userData.isPirateKing || false;
    const bountyAmount = getBountyForLevel(userData.level, isPirateKingData);
    const bountyStr = bountyAmount.toLocaleString();
    
    console.log(`[LEVEL] Level ${userData.level} ${isPirateKingData ? '(PIRATE KING)' : ''} = Bounty ฿${bountyStr}`);
    
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

    return canvas;
}

const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

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

            // Get XP tracker from global
            const xpTracker = global.xpTracker;
            if (!xpTracker) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ System Error')
                    .setDescription('XP Tracker is not initialized. Please restart the bot.')
                    .setColor('#FF0000');
                return interaction.editReply({ embeds: [embed] });
            }

            // Get user stats - FIXED: Use correct parameter order (guildId, userId)
            const userStats = await xpTracker.getUserStats(interaction.guildId, targetUser.id);
            
            if (!userStats) {
                // Check if user exists in database at all
                console.log(`[LEVEL] No stats found for user ${targetUser.id} in guild ${interaction.guildId}`);
                
                const embed = new EmbedBuilder()
                    .setTitle('🏴‍☠️ New Pirate Detected')
                    .setDescription(`${targetUser.username} hasn't started their pirate journey yet!\n\nThey need to send a message, add a reaction, or join a voice channel to begin earning bounty.`)
                    .addFields(
                        { name: '💰 Current Bounty', value: '฿0', inline: true },
                        { name: '⭐ Current Level', value: '0', inline: true },
                        { name: '🎯 Next Action', value: 'Send a message to get started!', inline: true }
                    )
                    .setColor('#FFA500')
                    .setThumbnail(targetUser.displayAvatarURL())
                    .setFooter({ text: 'Marine Intelligence • No criminal activity detected yet' });
                
                return interaction.editReply({ embeds: [embed] });
            }

            console.log(`[LEVEL] Found stats for ${targetUser.username}: Level ${userStats.level}, XP ${userStats.xp}`);

            // Get user's rank in the leaderboard
            const leaderboard = await xpTracker.getLeaderboard(interaction.guildId);
            const rank = leaderboard.findIndex(u => u.userId === targetUser.id) + 1;

            // Check if user has Pirate King role
            const settings = global.guildSettings?.get(interaction.guild.id) || {};
            const excludedRoleId = settings.excludedRole;
            const isPirateKing = excludedRoleId && targetMember.roles.cache.has(excludedRoleId);

            // Calculate next level progress
            const currentLevel = userStats.level;
            const currentXP = userStats.xp;
            let nextLevelXP = 0;
            let xpNeeded = 0;
            let progressPercentage = 100;

            if (currentLevel < 50) {
                const curve = process.env.FORMULA_CURVE || 'exponential';
                const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
                
                if (curve === 'exponential') {
                    nextLevelXP = Math.floor(Math.pow((currentLevel + 1) / multiplier, 2) * 100);
                } else {
                    // Calculate XP needed for next level using same formula as tracker
                    for (let i = 0; i <= currentLevel; i++) {
                        nextLevelXP += 500 + (i * (multiplier * 100));
                    }
                }
                
                xpNeeded = Math.max(0, nextLevelXP - currentXP);
                progressPercentage = nextLevelXP > 0 ? Math.floor((currentXP / nextLevelXP) * 100) : 100;
            }

            // Create the wanted poster
            console.log('[LEVEL] Creating wanted poster...');
            const canvas = await createWantedPoster(userStats, targetMember);
            const attachment = new AttachmentBuilder(canvas, { name: `wanted_${targetUser.id}.png` });

            // Create the embed with all the information
            const embed = new EmbedBuilder()
                .setColor(isPirateKing ? '#FF0000' : '#FF6B35')
                .setTitle(`${isPirateKing ? '👑' : '🏴‍☠️'} ${targetMember.displayName}'s Bounty`)
                .addFields(
                    { name: '🏆 Rank', value: isPirateKing ? 'PIRATE KING' : `#${rank}`, inline: true },
                    { name: '⭐ Level', value: userStats.level.toString(), inline: true },
                    { name: '💰 Total Bounty', value: `฿${userStats.xp.toLocaleString()}`, inline: true }
                );

            // Add progress information if not max level
            if (currentLevel < 50) {
                embed.addFields(
                    { name: '📈 Next Level', value: `${xpNeeded.toLocaleString()} XP needed`, inline: true },
                    { name: '📊 Progress', value: `${progressPercentage}%`, inline: true },
                    { name: '🎯 Target Level', value: (currentLevel + 1).toString(), inline: true }
                );
            } else {
                embed.addFields(
                    { name: '🌟 Status', value: 'MAX LEVEL REACHED!', inline: true },
                    { name: '👑 Achievement', value: 'Legendary Pirate', inline: true },
                    { name: '🎊 Congratulations!', value: 'You\'ve mastered the seas!', inline: true }
                );
            }

            // Add activity breakdown
            const voiceHours = Math.floor(userStats.voice_time / 3600);
            const voiceMinutes = Math.floor((userStats.voice_time % 3600) / 60);
            
            embed.addFields(
                { name: '💬 Messages', value: userStats.messages.toLocaleString(), inline: true },
                { name: '😄 Reactions', value: userStats.reactions.toLocaleString(), inline: true },
                { name: '🎙️ Voice Time', value: `${voiceHours}h ${voiceMinutes}m`, inline: true }
            );

            // Add special status if Pirate King
            if (isPirateKing) {
                embed.addFields({
                    name: '👑 Special Status',
                    value: 'Ruler of the Grand Line - Excluded from XP tracking',
                    inline: false
                });
            }

            embed.setImage(`attachment://wanted_${targetUser.id}.png`)
                .setFooter({ 
                    text: `Marine Intelligence • ${isPirateKing ? 'EMPEROR CLASS THREAT' : `Bounty #${String(rank).padStart(3, '0')}`}` 
                })
                .setTimestamp();

            console.log('[LEVEL] Sending wanted poster and embed...');
            await interaction.editReply({ embeds: [embed], files: [attachment] });

        } catch (error) {
            console.error('[ERROR] Error in level command:', error);
            const embed = new EmbedBuilder()
                .setTitle('❌ Wanted Poster Creation Failed')
                .setDescription('An error occurred while creating the wanted poster. The Marines are having technical difficulties!')
                .addFields(
                    { name: '🔧 Error Details', value: error.message || 'Unknown error', inline: false },
                    { name: '💡 Try Again', value: 'Please try the command again in a moment.', inline: false }
                )
                .setColor('#FF0000')
                .setFooter({ text: 'If this persists, contact a server administrator' });
            
            await interaction.editReply({ embeds: [embed] });
        }
    }
};

async function createWantedPoster(userStats, member) {
    const width = 600, height = 900;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Load and draw scroll texture background
    try {
        const scrollTexture = await loadImage(path.join(__dirname, '../../assets/scroll_texture.jpg'));
        ctx.drawImage(scrollTexture, 0, 0, width, height);
        console.log('[DEBUG] Successfully loaded scroll texture background');
    } catch (error) {
        console.log('[DEBUG] Scroll texture not found, using fallback parchment color');
        ctx.fillStyle = '#f5e6c5';
        ctx.fillRect(0, 0, width, height);
    }
    
    // All borders black
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, width, height);
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, width - 20, height - 20);
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, width - 36, height - 36);

    // WANTED title
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '81px CaptainKiddNF, Arial, sans-serif';
    const wantedY = height * (1 - 92/100);
    const wantedX = (50/100) * width;
    ctx.fillText('WANTED', wantedX, wantedY);

    // Image Box
    const photoSize = (95/100) * 400;
    const photoX = ((50/100) * width) - (photoSize/2);
    const photoY = height * (1 - 65/100) - (photoSize/2);
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeRect(photoX, photoY, photoSize, photoSize);

    // Avatar
    const avatarArea = { x: photoX + 3, y: photoY + 3, width: photoSize - 6, height: photoSize - 6 };
    if (member) {
        try {
            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true });
            const avatar = await loadImage(avatarURL);
            
            ctx.save();
            ctx.beginPath();
            ctx.rect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
            ctx.clip();
            
            ctx.filter = 'contrast(0.95) sepia(0.05)';
            ctx.drawImage(avatar, avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
            ctx.filter = 'none';
            
            ctx.restore();
        } catch {
            console.log('[DEBUG] No avatar found, texture will show through');
        }
    }

    // DEAD OR ALIVE
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '57px CaptainKiddNF, Arial, sans-serif';
    const deadOrAliveY = height * (1 - 39/100);
    const deadOrAliveX = (50/100) * width;
    ctx.fillText('DEAD OR ALIVE', deadOrAliveX, deadOrAliveY);

    // Name
    ctx.font = '69px CaptainKiddNF, Arial, sans-serif';
    let displayName = member.displayName.replace(/[^\w\s-]/g, '').toUpperCase().substring(0, 16);
    
    ctx.textAlign = 'center';
    let nameWidth = ctx.measureText(displayName).width;
    if (nameWidth > width - 60) {
        ctx.font = '55px CaptainKiddNF, Arial, sans-serif';
    }
    
    const nameY = height * (1 - 30/100);
    const nameX = (50/100) * width;
    ctx.fillText(displayName, nameX, nameY);

    // Berry Symbol and Bounty
    const berryBountyGap = 5;
    const bountyStr = userStats.xp.toLocaleString();
    ctx.font = '54px Cinzel, Georgia, serif';
    const bountyTextWidth = ctx.measureText(bountyStr).width;
    
    const berrySize = (32/100) * 150;
    const gapPixels = (berryBountyGap/100) * width;
    const totalBountyWidth = berrySize + gapPixels + bountyTextWidth;
    const bountyUnitStartX = (width - totalBountyWidth) / 2;
    
    const berryX = bountyUnitStartX + (berrySize/2);
    const berryY = height * (1 - 22/100) - (berrySize/2);
    
    // Berry symbol
    let berryImg;
    try {
        const berryPath = path.join(__dirname, '../../assets/berry.png');
        berryImg = await loadImage(berryPath);
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
    
    ctx.drawImage(berryImg, berryX - (berrySize/2), berryY, berrySize, berrySize);

    // Bounty numbers
    const bountyX = bountyUnitStartX + berrySize + gapPixels;
    const bountyY = height * (1 - 22/100);
    
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111';
    ctx.fillText(bountyStr, bountyX, bountyY);

    // One Piece logo
    try {
        const onePieceLogoPath = path.join(__dirname, '../../assets/one-piece-symbol.png');
        const onePieceLogo = await loadImage(onePieceLogoPath);
        const logoSize = (26/100) * 200;
        const logoX = ((50/100) * width) - (logoSize/2);
        const logoY = height * (1 - 4.5/100) - (logoSize/2);
        
        ctx.globalAlpha = 0.6;
        ctx.filter = 'sepia(0.2) brightness(0.9)';
        ctx.drawImage(onePieceLogo, logoX, logoY, logoSize, logoSize);
        ctx.globalAlpha = 1.0;
        ctx.filter = 'none';
    } catch {
        console.log('[DEBUG] One Piece logo not found');
    }

    // MARINE text
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font = '24px TimesNewNormal, Times, serif';
    ctx.fillStyle = '#111';
    
    const marineText = 'M A R I N E';
    const marineX = (96/100) * width;
    const marineY = height * (1 - 2/100);
    ctx.fillText(marineText, marineX, marineY);

    return canvas.toBuffer();
}

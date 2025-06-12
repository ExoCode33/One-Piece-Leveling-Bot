// src/commands/leaderboard.js - Enhanced One Piece Themed Leaderboard with Robust Canvas Generation

const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getBountyForLevel, PIRATE_KING_BOUNTY } = require('../utils/bountySystem');
const Canvas = require('canvas');

const LEADERBOARD_EXCLUDE_ROLE = process.env.LEADERBOARD_EXCLUDE_ROLE; // Role ID for Pirate King

// Register fonts if available
try {
    Canvas.registerFont('./assets/fonts/pirate.ttf', { family: 'PirateFont' });
} catch (e) {
    console.log('Custom font not found, using system fonts');
}

function pirateRankEmoji(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '🏴‍☠️';
}

// Enhanced threat levels with One Piece flavor
function getThreatLevel(level) {
    const threatLevels = {
        0: "Rookie pirate spotted in East Blue waters",
        5: "Wanted for theft and disturbing the peace",
        10: "Defeated multiple Marine squads",
        15: "Entered the Grand Line - Dangerous individual",
        20: "Defeated Marine Captain - High combat ability",
        25: "WANTED: Extremely dangerous - Avoid confrontation",
        30: "Mastered advanced combat techniques",
        35: "Commands large crew - Territorial threat",
        40: "Rival to Marine Vice Admiral level",
        45: "Possesses rare Devil Fruit abilities",
        50: "YONKO LEVEL THREAT - Avoid at all costs"
    };

    let applicableLevel = 0;
    for (let threatLevel of Object.keys(threatLevels).map(Number).sort((a, b) => b - a)) {
        if (level >= threatLevel) {
            applicableLevel = threatLevel;
            break;
        }
    }
    
    return threatLevels[applicableLevel];
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

// Utility function to safely draw text with fallbacks
function drawTextSafe(ctx, text, x, y, maxWidth = null) {
    try {
        if (maxWidth) {
            ctx.fillText(text, x, y, maxWidth);
        } else {
            ctx.fillText(text, x, y);
        }
        return true;
    } catch (error) {
        console.error('Text drawing failed:', error);
        return false;
    }
}

// Utility function to create rounded rectangle
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

// Enhanced wanted poster creation with better error handling
async function createWantedPoster(user, rank, bounty, threatLevel, guild) {
    const CANVAS_WIDTH = 320;
    const CANVAS_HEIGHT = 450;
    
    try {
        const canvas = Canvas.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
        const ctx = canvas.getContext('2d');

        // Set default text properties
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // === BACKGROUND AND BORDERS ===
        
        // Create aged paper background
        const bgGradient = ctx.createRadialGradient(
            CANVAS_WIDTH/2, CANVAS_HEIGHT/2, 0,
            CANVAS_WIDTH/2, CANVAS_HEIGHT/2, Math.max(CANVAS_WIDTH, CANVAS_HEIGHT)/2
        );
        bgGradient.addColorStop(0, '#F5DEB3'); // Wheat
        bgGradient.addColorStop(0.7, '#DEB887'); // BurlyWood
        bgGradient.addColorStop(1, '#D2B48C'); // Tan
        
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Add paper texture
        ctx.fillStyle = 'rgba(139, 69, 19, 0.05)';
        for (let i = 0; i < 200; i++) {
            const x = Math.random() * CANVAS_WIDTH;
            const y = Math.random() * CANVAS_HEIGHT;
            const size = Math.random() * 3;
            ctx.fillRect(x, y, size, size);
        }

        // Main decorative border
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 8;
        roundRect(ctx, 10, 10, CANVAS_WIDTH - 20, CANVAS_HEIGHT - 20, 15);
        ctx.stroke();

        // Inner border
        ctx.strokeStyle = '#DC143C';
        ctx.lineWidth = 3;
        roundRect(ctx, 18, 18, CANVAS_WIDTH - 36, CANVAS_HEIGHT - 36, 10);
        ctx.stroke();

        // === HEADER SECTION ===
        
        // "WANTED" banner
        const headerY = 35;
        const headerHeight = 40;
        
        // Banner background
        ctx.fillStyle = '#8B0000';
        roundRect(ctx, 40, headerY - 5, CANVAS_WIDTH - 80, headerHeight, 8);
        ctx.fill();
        
        // Banner border
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        roundRect(ctx, 40, headerY - 5, CANVAS_WIDTH - 80, headerHeight, 8);
        ctx.stroke();

        // "WANTED" text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 28px Arial, sans-serif';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        drawTextSafe(ctx, 'WANTED', CANVAS_WIDTH/2, headerY + headerHeight/2);
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // "DEAD OR ALIVE" subtitle
        const subtitleY = headerY + headerHeight + 15;
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 12px Arial, sans-serif';
        drawTextSafe(ctx, 'DEAD OR ALIVE', CANVAS_WIDTH/2, subtitleY);

        // === PHOTO SECTION ===
        
        const photoY = subtitleY + 25;
        const photoWidth = 120;
        const photoHeight = 140;
        const photoX = (CANVAS_WIDTH - photoWidth) / 2;

        // Photo frame shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(photoX + 3, photoY + 3, photoWidth, photoHeight);

        // Photo frame background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(photoX, photoY, photoWidth, photoHeight);

        // Photo frame border
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 4;
        ctx.strokeRect(photoX, photoY, photoWidth, photoHeight);

        // Load and draw avatar
        let member = null;
        try {
            if (guild && user.userId) {
                member = await guild.members.fetch(user.userId);
            }
        } catch (err) {
            console.log('Could not fetch member:', err.message);
        }

        // Avatar area (leave space for name at bottom)
        const avatarArea = {
            x: photoX + 5,
            y: photoY + 5,
            width: photoWidth - 10,
            height: photoHeight - 35
        };

        if (member) {
            try {
                const avatarURL = member.user.displayAvatarURL({ 
                    extension: 'png', 
                    size: 256,
                    forceStatic: true
                });
                
                const avatar = await Canvas.loadImage(avatarURL);
                
                // Create clipping path for avatar
                ctx.save();
                ctx.beginPath();
                ctx.rect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
                ctx.clip();
                
                // Calculate scaling to fill the area while maintaining aspect ratio
                const scale = Math.max(
                    avatarArea.width / avatar.width,
                    avatarArea.height / avatar.height
                );
                
                const scaledWidth = avatar.width * scale;
                const scaledHeight = avatar.height * scale;
                
                const drawX = avatarArea.x + (avatarArea.width - scaledWidth) / 2;
                const drawY = avatarArea.y + (avatarArea.height - scaledHeight) / 2;
                
                ctx.drawImage(avatar, drawX, drawY, scaledWidth, scaledHeight);
                ctx.restore();
                
            } catch (avatarError) {
                console.log('Avatar loading failed:', avatarError.message);
                // Draw placeholder
                ctx.fillStyle = '#CCCCCC';
                ctx.fillRect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
                
                ctx.fillStyle = '#666666';
                ctx.font = '20px Arial, sans-serif';
                drawTextSafe(ctx, '👤', avatarArea.x + avatarArea.width/2, avatarArea.y + avatarArea.height/2);
            }
        } else {
            // Draw placeholder for unknown user
            ctx.fillStyle = '#CCCCCC';
            ctx.fillRect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
            
            ctx.fillStyle = '#666666';
            ctx.font = '20px Arial, sans-serif';
            drawTextSafe(ctx, '👤', avatarArea.x + avatarArea.width/2, avatarArea.y + avatarArea.height/2);
        }

        // Name plate
        const nameY = photoY + photoHeight - 25;
        ctx.fillStyle = '#000000';
        ctx.fillRect(photoX + 5, nameY, photoWidth - 10, 20);

        // Pirate name
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px Arial, sans-serif';
        
        let displayName = 'UNKNOWN PIRATE';
        if (member) {
            displayName = member.displayName.replace(/[^\w\s-]/g, '').toUpperCase().substring(0, 15);
        } else if (user.userId) {
            displayName = `PIRATE ${user.userId.slice(-4)}`;
        }
        
        drawTextSafe(ctx, displayName, CANVAS_WIDTH/2, nameY + 10, photoWidth - 20);

        // === BOUNTY SECTION ===
        
        const bountyY = photoY + photoHeight + 30;
        
        // Bounty background
        ctx.fillStyle = '#8B0000';
        roundRect(ctx, 60, bountyY - 10, CANVAS_WIDTH - 120, 50, 10);
        ctx.fill();
        
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        roundRect(ctx, 60, bountyY - 10, CANVAS_WIDTH - 120, 50, 10);
        ctx.stroke();

        // Format bounty amount
        let bountyText = '';
        if (bounty >= 1000000000) {
            bountyText = `${(bounty / 1000000000).toFixed(1)}B`;
        } else if (bounty >= 1000000) {
            bountyText = `${Math.floor(bounty / 1000000)}M`;
        } else if (bounty >= 1000) {
            bountyText = `${Math.floor(bounty / 1000)}K`;
        } else {
            bountyText = bounty.toString();
        }

        // Bounty amount
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px Arial, sans-serif';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 2;
        drawTextSafe(ctx, `₿${bountyText}`, CANVAS_WIDTH/2, bountyY + 10);
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // "BERRY" label
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 12px Arial, sans-serif';
        drawTextSafe(ctx, 'BERRY', CANVAS_WIDTH/2, bountyY + 30);

        // === RANK BADGE ===
        
        const badgeX = CANVAS_WIDTH - 50;
        const badgeY = 60;
        const badgeRadius = 22;

        // Badge shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(badgeX + 2, badgeY + 2, badgeRadius, 0, Math.PI * 2);
        ctx.fill();

        // Badge background
        ctx.fillStyle = rank === 'KING' ? '#FFD700' : '#C0C0C0';
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
        ctx.fill();

        // Badge border
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Badge text
        ctx.fillStyle = '#8B0000';
        ctx.font = 'bold 16px Arial, sans-serif';
        const badgeText = rank === 'KING' ? '👑' : `#${rank}`;
        drawTextSafe(ctx, badgeText, badgeX, badgeY);

        // === THREAT ASSESSMENT ===
        
        const threatY = bountyY + 70;
        
        // Threat box
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        roundRect(ctx, 30, threatY, CANVAS_WIDTH - 60, 60, 8);
        ctx.fill();
        
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 2;
        roundRect(ctx, 30, threatY, CANVAS_WIDTH - 60, 60, 8);
        ctx.stroke();

        // Threat header
        ctx.fillStyle = '#8B0000';
        ctx.font = 'bold 10px Arial, sans-serif';
        drawTextSafe(ctx, 'THREAT ASSESSMENT', CANVAS_WIDTH/2, threatY + 15);

        // Threat level
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 9px Arial, sans-serif';
        const shortThreat = getThreatLevelShort(user.level);
        drawTextSafe(ctx, shortThreat, CANVAS_WIDTH/2, threatY + 35, CANVAS_WIDTH - 80);

        // === FOOTER INFO ===
        
        const footerY = CANVAS_HEIGHT - 50;
        
        // Footer background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        roundRect(ctx, 25, footerY, CANVAS_WIDTH - 50, 30, 5);
        ctx.fill();

        // Level and XP info
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px Arial, sans-serif';
        
        let xpText = '';
        if (user.xp >= 1000000) {
            xpText = `${Math.floor(user.xp / 1000000)}M XP`;
        } else if (user.xp >= 1000) {
            xpText = `${Math.floor(user.xp / 1000)}K XP`;
        } else {
            xpText = `${user.xp} XP`;
        }
        
        drawTextSafe(ctx, `Level ${user.level} • ${xpText}`, CANVAS_WIDTH/2, footerY + 15);

        // === DECORATIVE ELEMENTS ===
        
        // Corner decorations
        const corners = [
            {x: 25, y: 25}, {x: CANVAS_WIDTH - 25, y: 25},
            {x: 25, y: CANVAS_HEIGHT - 25}, {x: CANVAS_WIDTH - 25, y: CANVAS_HEIGHT - 25}
        ];
        
        ctx.fillStyle = '#8B0000';
        corners.forEach(corner => {
            ctx.beginPath();
            ctx.arc(corner.x, corner.y, 4, 0, Math.PI * 2);
            ctx.fill();
        });

        return canvas.toBuffer('image/png');

    } catch (error) {
        console.error('Error creating wanted poster:', error);
        
        // Create a fallback simple poster
        try {
            const fallbackCanvas = Canvas.createCanvas(300, 400);
            const fallbackCtx = fallbackCanvas.getContext('2d');
            
            // Simple fallback design
            fallbackCtx.fillStyle = '#F5DEB3';
            fallbackCtx.fillRect(0, 0, 300, 400);
            
            fallbackCtx.strokeStyle = '#8B0000';
            fallbackCtx.lineWidth = 5;
            fallbackCtx.strokeRect(10, 10, 280, 380);
            
            fallbackCtx.fillStyle = '#8B0000';
            fallbackCtx.font = 'bold 24px Arial';
            fallbackCtx.textAlign = 'center';
            fallbackCtx.fillText('WANTED', 150, 50);
            
            fallbackCtx.fillStyle = '#000000';
            fallbackCtx.font = 'bold 16px Arial';
            fallbackCtx.fillText(`Level ${user.level}`, 150, 200);
            
            const fallbackBounty = getBountyForLevel(user.level);
            fallbackCtx.fillText(`₿${fallbackBounty.toLocaleString()}`, 150, 250);
            
            return fallbackCanvas.toBuffer('image/png');
        } catch (fallbackError) {
            console.error('Fallback poster creation failed:', fallbackError);
            return null;
        }
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
        
        let guild = interaction.guild;
        let guildId = interaction.guildId;
        
        if (!guild && guildId) {
            try {
                guild = await client.guilds.fetch(guildId);
            } catch (err) {
                console.error('Failed to fetch guild:', err);
            }
        }
        
        if (!guild || !guildId) {
            const errorMessage = "This command can only be used in a server, not in DMs.";
            return isButtonInteraction 
                ? interaction.editReply({ content: errorMessage })
                : interaction.reply({ content: errorMessage, ephemeral: true });
        }

        const view = interaction.options.getString('view') || 'posters';

        let leaderboard;
        try {
            leaderboard = await xpTracker.getLeaderboard(guildId);
        } catch (err) {
            console.error('Database error in leaderboard:', err);
            const errorMessage = "Database error occurred. Please try again later.";
            return isButtonInteraction 
                ? interaction.editReply({ content: errorMessage })
                : interaction.reply({ content: errorMessage, ephemeral: true });
        }

        if (!leaderboard || !Array.isArray(leaderboard)) {
            const errorMessage = "No leaderboard data available.";
            return isButtonInteraction 
                ? interaction.editReply({ content: errorMessage })
                : interaction.reply({ content: errorMessage, ephemeral: true });
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
            } catch (err) {
                console.error('Error finding Pirate King:', err);
                pirateKingUser = null;
            }
        }

        // If no role-based Pirate King, check if top user has reached level 50
        if (!pirateKingUser && leaderboard.length > 0) {
            const topUser = leaderboard[0];
            if (topUser.level >= 50) {
                pirateKingUser = topUser;
                leaderboard = leaderboard.slice(1);
            }
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
            // Create wanted posters for top pirates
            const topThree = leaderboard.slice(0, 3);
            const allPirates = [];
            
            // Add Pirate King first if exists
            if (pirateKingUser) {
                allPirates.push({
                    user: pirateKingUser,
                    rank: 'KING',
                    isPirateKing: true
                });
            }
            
            // Add top 3 pirates
            for (let i = 0; i < topThree.length; i++) {
                allPirates.push({
                    user: topThree[i],
                    rank: i + 1,
                    isPirateKing: false
                });
            }
            
            // Create header embed
            const headerEmbed = new EmbedBuilder()
                .setColor(0x8B0000)
                .setTitle('🏴‍☠️ MOST WANTED PIRATES 🏴‍☠️')
                .setDescription('**The World Government has issued these bounties for the most dangerous criminals on the Grand Line.**\n\u200B')
                .setFooter({ text: 'World Government • Marine Headquarters • Justice Will Prevail' })
                .setTimestamp();

            // Send initial message
            if (isButtonInteraction) {
                await interaction.editReply({ 
                    embeds: [headerEmbed], 
                    components: [row]
                });
            } else {
                await interaction.reply({ 
                    embeds: [headerEmbed], 
                    components: [row]
                });
            }

            // Create and send posters
            for (let i = 0; i < Math.min(allPirates.length, 4); i++) {
                const pirate = allPirates[i];
                const user = pirate.user;
                const rank = pirate.rank;
                
                const bounty = pirate.isPirateKing ? PIRATE_KING_BOUNTY : getBountyForLevel(user.level);
                const threatLevel = pirate.isPirateKing ? 'PIRATE KING - Supreme ruler of all pirates' : getThreatLevel(user.level);
                const threat = pirate.isPirateKing ? 'PIRATE KING CLASS' : getThreatLevelShort(user.level);
                
                try {
                    const posterBuffer = await createWantedPoster(user, rank, bounty, threatLevel, guild);
                    
                    if (posterBuffer) {
                        const attachment = new AttachmentBuilder(posterBuffer, { 
                            name: `wanted_poster_${i + 1}.png` 
                        });
                        
                        const posterEmbed = new EmbedBuilder()
                            .setColor(pirate.isPirateKing ? 0xFFD700 : 0x8B0000)
                            .setTitle(pirate.isPirateKing ? '👑 **PIRATE KING**' : `${pirateRankEmoji(rank)} **RANK ${rank}** WANTED PIRATE`)
                            .addFields(
                                {
                                    name: '🏴‍☠️ Pirate',
                                    value: `<@${user.userId}>`,
                                    inline: true
                                },
                                {
                                    name: '💰 Bounty',
                                    value: `₿${bounty.toLocaleString()}`,
                                    inline: true
                                },
                                {
                                    name: '⚔️ Level',
                                    value: `${user.level}`,
                                    inline: true
                                },
                                {
                                    name: '⚠️ Threat Level',
                                    value: threat,
                                    inline: true
                                },
                                {
                                    name: '💎 Total XP',
                                    value: `${user.xp.toLocaleString()}`,
                                    inline: true
                                },
                                {
                                    name: '📍 Status',
                                    value: pirate.isPirateKing ? 'Ruler of the Grand Line' :
                                           rank === 1 ? 'Most Dangerous Pirate' : 
                                           rank === 2 ? 'Rising Star' : 
                                           'Notorious Criminal',
                                    inline: true
                                }
                            )
                            .setImage(`attachment://wanted_poster_${i + 1}.png`)
                            .setFooter({ 
                                text: `Marine Intelligence • Report any sightings immediately • Bounty #${String(i + 1).padStart(3, '0')}` 
                            });
                        
                        await interaction.followUp({ 
                            embeds: [posterEmbed], 
                            files: [attachment]
                        });
                    }
                } catch (posterError) {
                    console.error(`Failed to create poster for rank ${rank}:`, posterError);
                }
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
            
            const responseData = { 
                content: finalText, 
                components: [row],
                embeds: []
            };
            

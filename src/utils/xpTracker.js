// src/utils/xpTracker.js - Enhanced with Marine Level-Up System
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { getBountyForLevel } = require('./bountySystem');
const path = require('path');

// Register fonts for level-up posters
try {
    registerFont(path.join(__dirname, '../../assets/fonts/captkd.ttf'), { family: 'CaptainKiddNF' });
    registerFont(path.join(__dirname, '../../assets/fonts/Cinzel-Bold.otf'), { family: 'Cinzel' });
    registerFont(path.join(__dirname, '../../assets/fonts/Times New Normal Regular.ttf'), { family: 'TimesNewNormal' });
    console.log('[XP-TRACKER] Successfully registered fonts for level-up system');
} catch (error) {
    console.log('[XP-TRACKER] Font registration failed, using fallback fonts');
}

class XPTracker {
    constructor(client, db) {
        this.client = client;
        this.db = db;
        this.voiceSessions = new Map(); // userId -> { guildId, channelId, joinTime, lastActivity }
        this.messageCooldowns = new Map(); // userId_guildId -> timestamp
        this.reactionCooldowns = new Map(); // userId_guildId -> timestamp
        this.dailyVoiceXP = new Map(); // userId_guildId -> { xp, date }
    }

    // Enhanced level-up handler with Marine theming
    async handleLevelUp(member, oldLevel, newLevel, newXP, guildId) {
        try {
            console.log(`[LEVELUP] ${member.displayName} leveled up: ${oldLevel} → ${newLevel}`);

            // Get level-up channel
            const levelupChannelId = process.env.LEVELUP_CHANNEL;
            if (!levelupChannelId || levelupChannelId === 'your_levelup_channel_id') {
                console.log('[LEVELUP] No level-up channel configured');
                return;
            }

            const channel = member.guild.channels.cache.get(levelupChannelId);
            if (!channel) {
                console.log('[LEVELUP] Level-up channel not found:', levelupChannelId);
                return;
            }

            // Create user data for wanted poster
            const userData = {
                userId: member.id,
                level: newLevel,
                total_xp: newXP,
                messages: 0, // We'll get real stats if needed
                reactions: 0,
                voice_time: 0,
                member: member
            };

            // Try to get real user stats for activity assessment
            try {
                const stats = await this.db.query(
                    'SELECT messages, reactions, voice_time FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                    [member.id, guildId]
                );
                if (stats.rows.length > 0) {
                    userData.messages = stats.rows[0].messages || 0;
                    userData.reactions = stats.rows[0].reactions || 0;
                    userData.voice_time = stats.rows[0].voice_time || 0;
                }
            } catch (error) {
                console.log('[LEVELUP] Could not fetch user stats for level-up');
            }

            // Create wanted poster canvas
            const canvas = await this.createLevelUpPoster(userData, member.guild, oldLevel, newLevel);
            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `levelup_${member.id}.png` });

            // Get bounty amounts
            const oldBounty = getBountyForLevel(oldLevel);
            const newBounty = getBountyForLevel(newLevel);
            const bountyIncrease = newBounty - oldBounty;

            // Helper function for threat level
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

            // Get threat level upgrade message
            function getThreatUpgradeMessage(oldLevel, newLevel) {
                const oldThreat = getThreatLevelName(oldLevel);
                const newThreat = getThreatLevelName(newLevel);
                
                if (oldThreat !== newThreat) {
                    return `\n- THREAT CLASSIFICATION UPGRADED\n- FROM: ${oldThreat}\n- TO: ${newThreat}`;
                }
                return `\n- THREAT LEVEL: ${newThreat}`;
            }

            // Check if user has excluded role (Pirate King)
            const settings = global.guildSettings?.get(guildId) || {};
            const excludedRoleId = settings.excludedRole;
            const isPirateKing = excludedRoleId && member.roles.cache.has(excludedRoleId);

            // Create Marine Intelligence level-up embed
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: '🌐 WORLD GOVERNMENT INTELLIGENCE BUREAU'
                })
                .setColor(0xFF0000)
                .setTitle('🚨 WORLD GOVERNMENT BOUNTY UPDATE')
                .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
                .setDescription(`**${member.displayName}** has reached a new level of infamy!`);

            // Main intelligence briefing
            let briefingValue = `Subject has crossed into ${newLevel >= 50 ? 'Emperor' : newLevel >= 30 ? 'Grand Line' : newLevel >= 15 ? 'Paradise' : newLevel >= 5 ? 'East Blue' : 'civilian'} territory. Enhanced surveillance required.`;
            
            embed.addFields({
                name: '📋 INTELLIGENCE BRIEFING',
                value: briefingValue,
                inline: false
            });

            // Bounty information in organized layout
            embed.addFields(
                {
                    name: 'Previous Bounty',
                    value: `Level ${oldLevel}\n฿${oldBounty.toLocaleString()}`,
                    inline: true
                },
                {
                    name: 'NEW BOUNTY',
                    value: `Level ${newLevel}\n฿${newBounty.toLocaleString()}`,
                    inline: true
                },
                {
                    name: 'Bounty Increase',
                    value: `+฿${bountyIncrease.toLocaleString()}`,
                    inline: true
                }
            );

            // Marine Intelligence Report
            let reportValue = `Multiple incidents involving Marine personnel. Elevated threat status.${getThreatUpgradeMessage(oldLevel, newLevel)}`;
            
            embed.addFields({
                name: '📊 Marine Intelligence Report',
                value: `\`\`\`diff\n- ${reportValue}\n\`\`\``,
                inline: false
            });

            // Add special classification for Pirate King
            if (isPirateKing) {
                embed.addFields({
                    name: '👑 SPECIAL CLASSIFICATION',
                    value: `\`\`\`diff\n+ EMPEROR STATUS CONFIRMED\n+ EXCLUDED FROM BOUNTY TRACKING\n+ MAXIMUM THREAT DESIGNATION\n! APPROACH WITH EXTREME CAUTION\n\`\`\``,
                    inline: false
                });
            }

            // Set the wanted poster image
            embed.setImage(`attachment://levelup_${member.id}.png`)
                .setFooter({ 
                    text: `Marine Intelligence • BOUNTY INCREASE CONFIRMED • ${new Date().toLocaleDateString()} • Today at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                })
                .setTimestamp();

            // Send the level-up message
            await channel.send({ 
                embeds: [embed], 
                files: [attachment]
            });

            // Handle role rewards if configured
            await this.handleRoleRewards(member, newLevel);

            console.log(`[LEVELUP] Marine bounty update sent for ${member.displayName} (Level ${newLevel})`);

        } catch (error) {
            console.error('[LEVELUP] Error sending Marine level-up message:', error);
        }
    }

    // Create level-up wanted poster (enhanced version of the level command poster)
    async createLevelUpPoster(userData, guild, oldLevel, newLevel) {
        const width = 600, height = 900;
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

        // "BOUNTY UPDATE" title instead of "WANTED"
        ctx.fillStyle = '#111';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '65px CaptainKiddNF, Arial, sans-serif'; // Slightly smaller to fit
        const titleY = height * (1 - 92/100);
        const titleX = (50/100) * width;
        ctx.fillText('BOUNTY UPDATE', titleX, titleY);

        // Image Box - same as original
        const photoSize = (95/100) * 400;
        const photoX = ((50/100) * width) - (photoSize/2);
        const photoY = height * (1 - 65/100) - (photoSize/2);
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeRect(photoX, photoY, photoSize, photoSize);

        // Draw avatar
        const member = userData.member;
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
                console.log('[LEVELUP] No avatar found for level-up poster');
            }
        }

        // "LEVEL UP!" instead of "DEAD OR ALIVE"
        ctx.font = '57px CaptainKiddNF, Arial, sans-serif';
        const levelUpY = height * (1 - 39/100);
        const levelUpX = (50/100) * width;
        ctx.fillText('LEVEL UP!', levelUpX, levelUpY);

        // Name
        ctx.font = '69px CaptainKiddNF, Arial, sans-serif';
        let displayName = 'UNKNOWN PIRATE';
        if (member) displayName = member.displayName.replace(/[^\w\s-]/g, '').toUpperCase().substring(0, 16);
        else if (userData.userId) displayName = `PIRATE ${userData.userId.slice(-4)}`;
        
        ctx.textAlign = 'center';
        let nameWidth = ctx.measureText(displayName).width;
        if (nameWidth > width - 60) {
            ctx.font = '55px CaptainKiddNF, Arial, sans-serif';
        }
        
        const nameY = height * (1 - 30/100);
        const nameX = (50/100) * width;
        ctx.fillText(displayName, nameX, nameY);

        // New bounty amount
        const berryBountyGap = 5;
        const bountyAmount = getBountyForLevel(userData.level);
        const bountyStr = bountyAmount.toLocaleString();
        
        ctx.font = '54px Cinzel, Georgia, serif';
        const bountyTextWidth = ctx.measureText(bountyStr).width;
        
        // Berry symbol
        const berrySize = (32/100) * 150;
        const gapPixels = (berryBountyGap/100) * width;
        const totalBountyWidth = berrySize + gapPixels + bountyTextWidth;
        const bountyUnitStartX = (width - totalBountyWidth) / 2;
        
        const berryX = bountyUnitStartX + (berrySize/2);
        const berryY = height * (1 - 22/100) - (berrySize/2);
        
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
        
        ctx.drawImage(berryImg, berryX - (berrySize/2), berryY, berrySize, berrySize);

        // Bounty amount
        const bountyX = bountyUnitStartX + berrySize + gapPixels;
        const bountyY = height * (1 - 22/100);
        
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#111';
        ctx.fillText(bountyStr, bountyX, bountyY);

        // Level progression indicator (NEW FEATURE)
        ctx.font = '24px TimesNewNormal, Times, serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#444';
        const progressY = height * (1 - 14/100);
        ctx.fillText(`LEVEL ${oldLevel} → ${newLevel}`, width/2, progressY);

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
            console.log('[LEVELUP] One Piece logo not found');
        }

        // "MARINE" watermark
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.font = '24px TimesNewNormal, Times, serif';
        ctx.fillStyle = '#111';
        
        const marineText = 'M A R I N E';
        const marineX = (96/100) * width;
        const marineY = height * (1 - 2/100);
        ctx.fillText(marineText, marineX, marineY);

        return canvas;
    }

    // Handle role rewards for level-ups
    async handleRoleRewards(member, level) {
        try {
            const roleVarName = `LEVEL_${level}_ROLE`;
            const roleId = process.env[roleVarName];
            
            if (roleId && roleId !== 'role_id_' + level) {
                const role = member.guild.roles.cache.get(roleId);
                if (role) {
                    try {
                        await member.roles.add(role);
                        console.log(`[LEVELUP] Added role ${role.name} to ${member.displayName} for reaching level ${level}`);
                    } catch (error) {
                        console.error(`[LEVELUP] Failed to add role ${role.name}:`, error);
                    }
                } else {
                    console.log(`[LEVELUP] Role ${roleId} not found for level ${level}`);
                }
            }
        } catch (error) {
            console.error('[LEVELUP] Error handling role rewards:', error);
        }
    }

    // [Keep all existing XP tracking methods - handleMessageXP, handleReactionXP, etc.]
    // ... [rest of your existing XPTracker methods would go here]
}

module.exports = XPTracker;

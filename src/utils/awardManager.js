// src/utils/awardManager.js - XP Awarding and Level Management

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

async function awardXP(xpTracker, userId, guildId, xpAmount, source, user, skipMultiplier = false) {
    try {
        const guild = xpTracker.client.guilds.cache.get(guildId);
        const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
        
        let finalXP = xpAmount;
        
        if (xpAmount === null) {
            finalXP = getRandomXP(source);
            console.log(`[XP CALC] Generated base XP for ${source}: ${finalXP}`);
        }
        
        if (!skipMultiplier) {
            if (global.xpBoostManager && member) {
                try {
                    const boostResult = await global.xpBoostManager.calculateUserBoost(guildId, member);
                    if (boostResult.multiplier > 1.0) {
                        const boostedXP = Math.round(finalXP * boostResult.multiplier);
                        console.log(`[XP BOOST] ${user.username} ${source}: ${finalXP} base → ${boostedXP} boosted`);
                        finalXP = boostedXP;
                    }
                } catch (error) {
                    console.error('[XP BOOST ERROR] Failed to calculate user boost:', error);
                }
            }
            
            const guildSettings = global.guildSettings?.get(guildId) || { xpMultiplier: 1.0 };
            const multiplier = guildSettings.xpMultiplier || parseFloat(process.env.XP_MULTIPLIER) || 1.0;
            
            if (multiplier !== 1.0) {
                const rawFinalXP = finalXP * multiplier;
                const afterGlobal = Math.round(rawFinalXP);
                console.log(`[XP CALC] ${user.username} ${source}: ${finalXP} boosted → ${afterGlobal} final`);
                finalXP = afterGlobal;
            }
        }
        
        const actualXP = (xpAmount > 0 && finalXP === 0) ? 1 : finalXP;

        console.log(`[XP AWARD] Final XP to award: ${actualXP} (source: ${source}, skipMultiplier: ${skipMultiplier})`);

        const beforeResult = await xpTracker.db.query(
            'SELECT total_xp, level FROM user_levels WHERE user_id = $1 AND guild_id = $2',
            [userId, guildId]
        );

        const oldLevel = beforeResult.rows.length > 0 ? beforeResult.rows[0].level : 0;
        const oldTotalXP = beforeResult.rows.length > 0 ? beforeResult.rows[0].total_xp : 0;

        await xpTracker.db.query(`
            INSERT INTO user_levels (user_id, guild_id, total_xp, messages, reactions, voice_time, level)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (user_id, guild_id)
            DO UPDATE SET
                total_xp = user_levels.total_xp + $3,
                messages = user_levels.messages + $4,
                reactions = user_levels.reactions + $5,
                voice_time = user_levels.voice_time + $6,
                updated_at = CURRENT_TIMESTAMP
        `, [
            userId, guildId, actualXP,
            source === 'message' ? 1 : 0,
            source === 'reaction' ? 1 : 0,
            (source === 'voice' || source === 'voice_silent') ? 1 : 0,
            oldLevel
        ]);

        const afterResult = await xpTracker.db.query(
            'SELECT total_xp FROM user_levels WHERE user_id = $1 AND guild_id = $2',
            [userId, guildId]
        );

        const newTotalXP = afterResult.rows[0].total_xp;
        const newLevel = calculateLevel(newTotalXP);

        await xpTracker.db.query(
            'UPDATE user_levels SET level = $1 WHERE user_id = $2 AND guild_id = $3',
            [newLevel, userId, guildId]
        );

        if (source !== 'admin' && source !== 'voice' && source !== 'voice_silent') {
            await logXPActivity(xpTracker, source, user, guildId, actualXP, {
                totalXP: newTotalXP,
                currentLevel: newLevel
            });
        }

        console.log(`[XP] ${user.username}: ${oldTotalXP} + ${actualXP} = ${newTotalXP} XP (Level ${oldLevel} → ${newLevel})`);

        if (newLevel > oldLevel) {
            console.log(`[LEVEL UP] ${user.username} gained ${newLevel - oldLevel} levels: ${oldLevel} → ${newLevel}!`);
            
            for (let level = oldLevel + 1; level <= newLevel; level++) {
                const levelXP = getXPForLevel(level);
                const levelUpSource = source === 'voice_silent' ? 'voice' : source;
                await handleLevelUp(xpTracker, userId, guildId, level - 1, level, levelXP - 100, levelXP, user, levelUpSource);
                
                if (level < newLevel) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

    } catch (error) {
        console.error('Error awarding XP:', error);
    }
}

async function handleLevelUp(xpTracker, userId, guildId, oldLevel, newLevel, oldTotalXP, newTotalXP, user, xpSource = 'unknown') {
    try {
        console.log(`[LEVEL UP] Processing level up for ${user.username}: ${oldLevel} → ${newLevel}`);

        const roleReward = await awardLevelRoles(xpTracker, userId, guildId, newLevel);

        await sendMarineLevelUpNotification(xpTracker, userId, guildId, oldLevel, newLevel, oldTotalXP, newTotalXP, user, roleReward);

        await logXPActivity(xpTracker, 'levelup', user, guildId, 0, {
            oldLevel,
            newLevel,
            totalXP: newTotalXP,
            roleReward,
            xpSource: xpSource.toUpperCase()
        });

        console.log(`[LEVEL UP] Completed level up processing for ${user.username}`);

    } catch (error) {
        console.error('Error handling level up:', error);
    }
}

async function sendMarineLevelUpNotification(xpTracker, userId, guildId, oldLevel, newLevel, oldTotalXP, newTotalXP, user, roleReward = null) {
    try {
        console.log(`[LEVEL UP] Sending notification for ${user.username}: ${oldLevel} → ${newLevel}`);

        const guild = xpTracker.client.guilds.cache.get(guildId);
        if (!guild) {
            console.log('[LEVEL UP] Guild not found');
            return;
        }

        const guildSettings = global.guildSettings?.get(guildId);
        
        const levelupEnabled = guildSettings?.levelupEnabled !== false;
        if (!levelupEnabled) {
            console.log('[LEVEL UP] Level up announcements disabled for this guild');
            return;
        }

        let channelId = guildSettings?.levelupChannel;
        
        if (!channelId) {
            channelId = process.env.LEVELUP_CHANNEL;
        }

        if (!channelId || channelId === 'your_levelup_channel_id') {
            const defaultChannel = guild.channels.cache.find(ch => 
                ch.name.toLowerCase().includes('bounty-notices') && ch.isTextBased()
            );
            
            if (defaultChannel) {
                channelId = defaultChannel.id;
                console.log(`[LEVEL UP] Using default bounty channel: ${defaultChannel.name}`);
            } else {
                const fallbackChannels = ['general', 'chat', 'levelup', 'announcements'];
                for (const name of fallbackChannels) {
                    const foundChannel = guild.channels.cache.find(ch => 
                        ch.name.toLowerCase().includes(name) && ch.isTextBased()
                    );
                    if (foundChannel) {
                        channelId = foundChannel.id;
                        console.log(`[LEVEL UP] Using fallback channel: ${foundChannel.name}`);
                        break;
                    }
                }
            }
        }

        if (!channelId) {
            console.log('[LEVEL UP] No suitable channel found for announcements');
            return;
        }

        const channel = guild.channels.cache.get(channelId);
        if (!channel || !channel.isTextBased()) {
            console.log(`[LEVEL UP] Channel ${channelId} not found or not text-based`);
            return;
        }

        const wantedPosterData = {
            userId: user.id,
            level: newLevel,
            total_xp: newTotalXP,
            messages: 0,
            reactions: 0,
            voice_time: 0,
            member: await guild.members.fetch(user.id).catch(() => null)
        };

        let canvas = null;
        let attachment = null;
        
        try {
            canvas = await createWantedPoster(wantedPosterData, guild);
            attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `wanted_${user.id}.png` });
        } catch (canvasError) {
            console.error('[LEVEL UP] Error creating wanted poster:', canvasError);
        }

        const embed = createMarineLevelUpEmbed(user, oldLevel, newLevel, oldTotalXP, newTotalXP, roleReward);
        
        if (attachment) {
            embed.setImage(`attachment://wanted_${user.id}.png`);
        }

        const pingUser = process.env.LEVELUP_PING_USER !== 'false';
        
        const messageOptions = { 
            embeds: [embed] 
        };
        
        if (pingUser) {
            messageOptions.content = `<@${userId}>`;
        }
        
        if (attachment) {
            messageOptions.files = [attachment];
        }
        
        const message = await channel.send(messageOptions);
        console.log(`[LEVEL UP] Notification sent successfully for ${user.username} in #${channel.name}${pingUser ? ' with user ping' : ' without ping'}`);

        return message;

    } catch (error) {
        console.error('Error sending Marine level up notification:', error);
    }
}

function createMarineLevelUpEmbed(user, oldLevel, newLevel, oldTotalXP, newTotalXP, roleReward = null) {
    try {
        const { getBountyForLevel } = require('./bountySystem');
        
        const oldBounty = getBountyForLevel(oldLevel);
        const newBounty = getBountyForLevel(newLevel);

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

        const embed = new EmbedBuilder()
            .setColor('#DC143C')
            .setTitle('🚨 WORLD GOVERNMENT BOUNTY UPDATE 🚨')
            .setDescription(`**${user.username}** has reached a new level of infamy!\n\n*${getThreatLevelName(newLevel)} threat level confirmed. Enhanced surveillance protocols activated.*`)
            .setThumbnail(user.displayAvatarURL({ size: 128 }))
            .addFields(
                {
                    name: '💰 BOUNTY PROGRESSION',
                    value: `\`\`\`diff\n- OLD BOUNTY: ฿${oldBounty.toLocaleString()} (Level ${oldLevel})\n- NEW BOUNTY: ฿${newBounty.toLocaleString()} (Level ${newLevel})\n\`\`\``,
                    inline: false
                },
                {
                    name: '📊 Intelligence Summary',
                    value: `\`\`\`diff\n- Total Criminal Activity: ${newTotalXP.toLocaleString()} XP (Level ${newLevel})\n- Threat Classification: ${getThreatLevelName(newLevel)}\n\`\`\``,
                    inline: false
                }
            );

        if (roleReward) {
            embed.addFields({
                name: '👑 New Authority Granted',
                value: `\`\`\`diff\n- **${roleReward}** role assigned for reaching Level ${newLevel}\n\`\`\``,
                inline: false
            });
        }

        embed.setFooter({ 
            text: `⚓ Marine Intelligence • BOUNTY INCREASE CONFIRMED • ${new Date().toLocaleDateString()}` 
        })
        .setTimestamp();

        return embed;
    } catch (error) {
        console.error('Error creating Marine level up embed:', error);
        
        return new EmbedBuilder()
            .setColor('#DC143C')
            .setTitle('🚨 LEVEL UP! 🚨')
            .setDescription(`**${user.username}** leveled up from ${oldLevel} to ${newLevel}!`)
            .setThumbnail(user.displayAvatarURL({ size: 128 }))
            .setTimestamp();
    }
}

async function awardLevelRoles(xpTracker, userId, guildId, level) {
    try {
        const guild = xpTracker.client.guilds.cache.get(guildId);
        if (!guild) return null;

        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return null;

        const levelRoles = [
            { level: 5, roleId: process.env.LEVEL_5_ROLE },
            { level: 10, roleId: process.env.LEVEL_10_ROLE },
            { level: 15, roleId: process.env.LEVEL_15_ROLE },
            { level: 20, roleId: process.env.LEVEL_20_ROLE },
            { level: 25, roleId: process.env.LEVEL_25_ROLE },
            { level: 30, roleId: process.env.LEVEL_30_ROLE },
            { level: 35, roleId: process.env.LEVEL_35_ROLE },
            { level: 40, roleId: process.env.LEVEL_40_ROLE },
            { level: 45, roleId: process.env.LEVEL_45_ROLE },
            { level: 50, roleId: process.env.LEVEL_50_ROLE }
        ];

        let roleReward = null;

        for (const { level: reqLevel, roleId } of levelRoles) {
            if (level >= reqLevel && roleId && roleId !== `role_id_${reqLevel}`) {
                const role = guild.roles.cache.get(roleId);
                if (role && !member.roles.cache.has(roleId)) {
                    await member.roles.add(role);
                    roleReward = role.name;
                    console.log(`[LEVEL UP] Added level ${reqLevel} role (${role.name}) to ${member.user.username}`);
                    break;
                }
            }
        }

        return roleReward;

    } catch (error) {
        console.error('Error awarding level roles:', error);
        return null;
    }
}

// ALL RED XP logging with Marine Intelligence theme and dynamic cap info
async function logXPActivity(xpTracker, type, user, guildId, xpGain, additionalInfo = {}) {
    try {
        const guildSettings = global.guildSettings?.get(guildId);
        
        const logEnabled = guildSettings?.xpLogEnabled === true;
        if (!logEnabled) return;

        let logChannelId = guildSettings?.xpLogChannel;
        
        if (!logChannelId) {
            const guild = xpTracker.client.guilds.cache.get(guildId);
            if (guild) {
                const defaultLogChannel = guild.channels.cache.find(ch => 
                    ch.name.toLowerCase().includes('leveling-event-log') && ch.isTextBased()
                );
                
                if (defaultLogChannel) {
                    logChannelId = defaultLogChannel.id;
                    console.log(`[XP LOG] Using default log channel: ${defaultLogChannel.name}`);
                }
            }
        }
        
        if (!logChannelId) return;

        const logSettings = {
            message: process.env.XP_LOG_MESSAGES !== 'false',
            reaction: process.env.XP_LOG_REACTIONS !== 'false',
            voice: process.env.XP_LOG_VOICE !== 'false',
            levelup: process.env.XP_LOG_LEVELUP !== 'false',
            admin: process.env.XP_LOG_ADMIN !== 'false'
        };

        if (!logSettings[type]) return;

        const guild = xpTracker.client.guilds.cache.get(guildId);
        const channel = await xpTracker.client.channels.fetch(logChannelId).catch(() => null);
        
        if (!channel || !channel.isTextBased()) return;

        const formatLevel = (level) => {
            return level !== undefined && level !== null ? level.toString() : '0';
        };

        const formatXP = (xp) => {
            return xp !== undefined && xp !== null ? xp.toLocaleString() : '0';
        };

        const embed = new EmbedBuilder()
            .setColor(0xFF0000) // FORCE RED - Always Marine red
            .setTimestamp()
            .setFooter({ text: '⚓ Marine Intelligence Division • Activity Monitor' });

        // Get daily cap info for voice activities with 3 AM EST reset and dynamic caps
        let dailyCapInfo = '';
        if (type === 'voice' || type === 'voice_silent') {
            const today = xpTracker.getCurrentDayKey(); // Use 3 AM EST reset
            const dailyXP = xpTracker.getDailyVoiceXP(user.id, guildId, today);
            
            // Get user's dynamic cap info
            const member = guild ? await guild.members.fetch(user.id).catch(() => null) : null;
            if (member) {
                const capInfo = xpTracker.getUserDailyXPCap(member);
                dailyCapInfo = `\n- DAILY VOICE XP: ${dailyXP}/${capInfo.cap} (${capInfo.source})`;
                
                if (dailyXP >= capInfo.cap) {
                    dailyCapInfo += ' [CAP REACHED]';
                }
            } else {
                const defaultCap = parseInt(process.env.DAILY_VOICE_XP_CAP_DEFAULT) || 1500;
                dailyCapInfo = `\n- DAILY VOICE XP: ${dailyXP}/${defaultCap} (Default)`;
            }
            
            // Add reset time info
            const nextReset = xpTracker.getNextResetTime();
            dailyCapInfo += `\n- NEXT RESET: ${nextReset}`;
        }

        switch (type) {
            case 'message':
                embed
                    .setAuthor({ 
                        name: '🔴 MARINE INTELLIGENCE BUREAU',
                        iconURL: user.displayAvatarURL({ size: 32 })
                    })
                    .setTitle('🔴 MESSAGE ACTIVITY DETECTED')
                    .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${formatXP(additionalInfo.totalXP)}\n- CURRENT LEVEL: ${formatLevel(additionalInfo.currentLevel)}\n- THREAT STATUS: ACTIVE\n\`\`\``);
                break;

            case 'reaction':
                embed
                    .setAuthor({ 
                        name: '🔴 MARINE INTELLIGENCE BUREAU',
                        iconURL: user.displayAvatarURL({ size: 32 })
                    })
                    .setTitle('🔴 REACTION ACTIVITY DETECTED')
                    .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${formatXP(additionalInfo.totalXP)}\n- CURRENT LEVEL: ${formatLevel(additionalInfo.currentLevel)}\n- THREAT STATUS: ACTIVE\n\`\`\``);
                break;

            case 'voice':
            case 'voice_silent':
                embed
                    .setAuthor({ 
                        name: '🔴 MARINE INTELLIGENCE BUREAU',
                        iconURL: user.displayAvatarURL({ size: 32 })
                    })
                    .setTitle('🔴 VOICE ACTIVITY DETECTED')
                    .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${formatXP(additionalInfo.totalXP)}\n- CURRENT LEVEL: ${formatLevel(additionalInfo.currentLevel)}${dailyCapInfo}\n- THREAT STATUS: ACTIVE\n\`\`\``);
                break;

            case 'levelup':
                embed
                    .setAuthor({ 
                        name: '🔴 MARINE INTELLIGENCE BUREAU',
                        iconURL: user.displayAvatarURL({ size: 32 })
                    })
                    .setTitle('🔴 ⚠️ THREAT LEVEL INCREASED ⚠️')
                    .setDescription(`\`\`\`diff\n- BOUNTY UPDATE CONFIRMED\n- SUBJECT: ${user.username} (${user.id})\n- LEVEL: ${formatLevel(additionalInfo.oldLevel)} → ${formatLevel(additionalInfo.newLevel)}\n- TOTAL XP: ${formatXP(additionalInfo.totalXP)}\n- XP SOURCE: ${additionalInfo.xpSource || 'UNKNOWN'}\n- THREAT STATUS: ESCALATED\n${additionalInfo.roleReward ? `- ROLE AWARDED: ${additionalInfo.roleReward}\n` : ''}\`\`\``);
                break;

            case 'admin':
                embed
                    .setAuthor({ 
                        name: '🔴 MARINE COMMAND CENTER',
                        iconURL: additionalInfo.adminUser?.displayAvatarURL({ size: 32 }) || null
                    })
                    .setTitle('🔴 MANUAL XP ADJUSTMENT')
                    .setDescription(`\`\`\`diff\n- ADMINISTRATIVE ACTION\n- TARGET: ${user.username} (${user.id})\n- AUTHORIZED BY: ${additionalInfo.adminUser?.username || 'Unknown'}\n- ADJUSTMENT: ${xpGain > 0 ? '+' : ''}${xpGain} XP\n- REASON: ${additionalInfo.reason || 'No reason'}\n- NEW TOTAL: ${formatXP(additionalInfo.totalXP)}\n- NEW LEVEL: ${formatLevel(additionalInfo.currentLevel)}\n- AUTHORIZATION: CONFIRMED\n\`\`\``);
                break;
        }

        await channel.send({ embeds: [embed] });

    } catch (error) {
        console.error('[XP LOG] Failed to send XP log:', error);
    }
}

// Utility functions
function getRandomXP(type) {
    let min, max;
    
    switch (type) {
        case 'message':
            min = parseInt(process.env.MESSAGE_XP_MIN) || 25;
            max = parseInt(process.env.MESSAGE_XP_MAX) || 35;
            break;
        case 'voice':
            min = parseInt(process.env.VOICE_XP_MIN) || 45;
            max = parseInt(process.env.VOICE_XP_MAX) || 55;
            break;
        case 'reaction':
            min = parseInt(process.env.REACTION_XP_MIN) || 25;
            max = parseInt(process.env.REACTION_XP_MAX) || 35;
            break;
        default:
            min = 25;
            max = 35;
    }
    
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateLevel(totalXP) {
    const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
    const curve = process.env.FORMULA_CURVE || 'exponential';
    const maxLevel = parseInt(process.env.MAX_LEVEL) || 50;
    const baseXP = parseInt(process.env.FORMULA_BASE_XP) || 500;
    
    const earlyLevelPenalty = parseFloat(process.env.EARLY_LEVEL_PENALTY) || 1.0;
    const earlyLevelThreshold = parseInt(process.env.EARLY_LEVEL_THRESHOLD) || 0;

    for (let level = 1; level <= maxLevel; level++) {
        let requiredXP;
        
        if (curve === 'exponential') {
            requiredXP = Math.floor(baseXP * Math.pow(level, multiplier));
        } else if (curve === 'linear') {
            requiredXP = baseXP * level * multiplier;
        } else if (curve === 'logarithmic') {
            requiredXP = Math.floor(baseXP * Math.log(level + 1) * multiplier * 2);
        } else {
            requiredXP = Math.floor(baseXP * Math.pow(level, multiplier));
        }
        
        if (level <= earlyLevelThreshold && earlyLevelPenalty > 1.0) {
            const penaltyStrength = 1 + ((earlyLevelPenalty - 1) * (earlyLevelThreshold - level + 1) / earlyLevelThreshold);
            requiredXP = Math.floor(requiredXP * penaltyStrength);
        }

        if (totalXP < requiredXP) {
            return level - 1;
        }
    }

    return maxLevel;
}

function getXPForLevel(level) {
    const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
    const curve = process.env.FORMULA_CURVE || 'exponential';
    const baseXP = parseInt(process.env.FORMULA_BASE_XP) || 500;
    
    const earlyLevelPenalty = parseFloat(process.env.EARLY_LEVEL_PENALTY) || 1.0;
    const earlyLevelThreshold = parseInt(process.env.EARLY_LEVEL_THRESHOLD) || 0;
    
    let xpRequired;
    
    if (curve === 'exponential') {
        xpRequired = Math.floor(baseXP * Math.pow(level, multiplier));
    } else if (curve === 'linear') {
        xpRequired = baseXP * level * multiplier;
    } else if (curve === 'logarithmic') {
        xpRequired = Math.floor(baseXP * Math.log(level + 1) * multiplier * 2);
    } else {
        xpRequired = Math.floor(baseXP * Math.pow(level, multiplier));
    }
    
    if (level <= earlyLevelThreshold && earlyLevelPenalty > 1.0) {
        const penaltyStrength = 1 + ((earlyLevelPenalty - 1) * (earlyLevelThreshold - level + 1) / earlyLevelThreshold);
        const originalXP = xpRequired;
        xpRequired = Math.floor(xpRequired * penaltyStrength);
    }
    
    return xpRequired;
}

async function createWantedPoster(userData, guild) {
    const { createCanvas, loadImage } = require('canvas');
    const path = require('path');
    
    const width = 600, height = 900;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

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
    ctx.font = '81px Arial, sans-serif';
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
            // No avatar, texture shows through
        }
    }

    // DEAD OR ALIVE
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '57px Arial, sans-serif';
    const deadOrAliveY = height * (1 - 39/100);
    const deadOrAliveX = (50/100) * width;
    ctx.fillText('DEAD OR ALIVE', deadOrAliveX, deadOrAliveY);

    // Name
    ctx.font = '69px Arial, sans-serif';
    let displayName = 'UNKNOWN PIRATE';
    if (member) displayName = member.displayName.replace(/[^\w\s-]/g, '').toUpperCase().substring(0, 16);
    else if (userData.userId) displayName = `PIRATE ${userData.userId.slice(-4)}`;
    
    ctx.textAlign = 'center';
    let nameWidth = ctx.measureText(displayName).width;
    if (nameWidth > width - 60) {
        ctx.font = '55px Arial, sans-serif';
    }
    
    const nameY = height * (1 - 30/100);
    const nameX = (50/100) * width;
    ctx.fillText(displayName, nameX, nameY);

    // Bounty
    const { getBountyForLevel } = require('./bountySystem');
    const bountyAmount = getBountyForLevel(userData.level);
    const bountyStr = bountyAmount.toLocaleString();
    
    ctx.font = '54px serif';
    const bountyTextWidth = ctx.measureText(bountyStr).width;
    
    const berrySize = (32/100) * 150;
    const gapPixels = (5/100) * width;
    const totalBountyWidth = berrySize + gapPixels + bountyTextWidth;
    const bountyUnitStartX = (width - totalBountyWidth) / 2;
    
    const berryX = bountyUnitStartX + (berrySize/2);
    const berryY = height * (1 - 22/100) - (berrySize/2);
    
    // Simple berry symbol
    const berryCanvas = createCanvas(berrySize, berrySize);
    const berryCtx = berryCanvas.getContext('2d');
    berryCtx.fillStyle = '#111';
    berryCtx.font = `bold ${berrySize}px serif`;
    berryCtx.textAlign = 'center';
    berryCtx.textBaseline = 'middle';
    berryCtx.fillText('฿', berrySize/2, berrySize/2);
    
    ctx.drawImage(berryCanvas, berryX - (berrySize/2), berryY, berrySize, berrySize);

    const bountyX = bountyUnitStartX + berrySize + gapPixels;
    const bountyY = height * (1 - 22/100);
    
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111';
    ctx.fillText(bountyStr, bountyX, bountyY);

    // MARINE text
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font = '24px serif';
    ctx.fillStyle = '#111';
    
    const marineText = 'M A R I N E';
    const marineX = (96/100) * width;
    const marineY = height * (1 - 2/100);
    ctx.fillText(marineText, marineX, marineY);

    return canvas;
}

module.exports = {
    awardXP,
    handleLevelUp,
    sendMarineLevelUpNotification,
    createMarineLevelUpEmbed,
    awardLevelRoles,
    logXPActivity,
    getRandomXP,
    calculateLevel,
    getXPForLevel,
    createWantedPoster
};

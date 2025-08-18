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
                        name: '🔴 MARINE INTELLIGENCE

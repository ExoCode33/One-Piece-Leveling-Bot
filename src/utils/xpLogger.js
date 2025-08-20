// src/utils/xpLogger.js - FIXED with all red text, no progress bar, tier-specific caps

const { EmbedBuilder } = require('discord.js');

/**
 * Send comprehensive XP logs to designated channel
 * @param {Client} client - Discord client
 * @param {string} type - Type of XP gain (message, reaction, voice, levelup)
 * @param {User} user - Discord user
 * @param {number} xpGain - Amount of XP gained
 * @param {Object} additionalInfo - Additional information for logging
 */
async function sendXPLog(client, type, user, xpGain, additionalInfo = {}) {
    // Check if XP logging is enabled
    const logChannelId = process.env.XP_LOG_CHANNEL;
    const logEnabled = process.env.XP_LOG_ENABLED === 'true';
    
    if (!logChannelId || !logEnabled) {
        console.log('[XP LOG] XP logging disabled or no channel set');
        return;
    }

    // Check specific logging settings (default to true if not specified)
    const logSettings = {
        message: process.env.XP_LOG_MESSAGES !== 'false',
        reaction: process.env.XP_LOG_REACTIONS !== 'false', 
        voice: process.env.XP_LOG_VOICE !== 'false',
        levelup: process.env.XP_LOG_LEVELUP !== 'false'
    };

    if (!logSettings[type]) {
        console.log(`[XP LOG] ${type} logging disabled`);
        return;
    }

    try {
        const channel = await client.channels.fetch(logChannelId);
        if (!channel || !channel.isTextBased()) {
            console.error('[XP LOG] Invalid log channel');
            return;
        }

        // Create Marine Intelligence embed with red theme
        const embed = new EmbedBuilder()
            .setColor(0xFF0000) // Marine red
            .setTimestamp()
            .setFooter({ text: '⚓ Marine Intelligence Division • Activity Monitor' });

        // Helper function to properly handle level 0
        const formatLevel = (level) => {
            return level !== undefined && level !== null ? level.toString() : '0';
        };

        // Helper function to format XP totals
        const formatXP = (xp) => {
            return xp !== undefined && xp !== null ? xp.toLocaleString() : '0';
        };

        // ✅ NEW: Helper function to get user's tier-specific daily cap
        const getUserTierCap = async (userId, guildId) => {
            try {
                // Try to get tier-specific cap from daily quiz
                const dailyQuizCommand = require('../commands/daily-quiz');
                if (dailyQuizCommand && dailyQuizCommand.getTierXPCap) {
                    const tierCapInfo = await dailyQuizCommand.getTierXPCap(userId, guildId);
                    if (tierCapInfo.hasCustomCap && tierCapInfo.cap > 0) {
                        return {
                            cap: tierCapInfo.cap,
                            currentXP: tierCapInfo.currentXP,
                            tier: tierCapInfo.tier,
                            hasCustomCap: true
                        };
                    }
                }
                
                // Fall back to default cap
                const defaultCap = parseInt(process.env.DAILY_VOICE_XP_CAP) || 1500;
                return {
                    cap: defaultCap,
                    currentXP: 0,
                    tier: 0,
                    hasCustomCap: false
                };
            } catch (error) {
                console.error('[XP LOG] Error getting tier cap:', error);
                const defaultCap = parseInt(process.env.DAILY_VOICE_XP_CAP) || 1500;
                return {
                    cap: defaultCap,
                    currentXP: 0,
                    tier: 0,
                    hasCustomCap: false
                };
            }
        };

        // Configure embed based on XP type
        switch (type) {
            case 'message':
                embed
                    .setAuthor({ 
                        name: '🚨 MARINE INTELLIGENCE BUREAU',
                        iconURL: user.displayAvatarURL({ size: 32 })
                    })
                    .setTitle('MESSAGE ACTIVITY DETECTED')
                    .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- GUILD: ${additionalInfo.guildName || 'Unknown'}\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${formatXP(additionalInfo.totalXP)}\n- CURRENT LEVEL: ${formatLevel(additionalInfo.currentLevel)}\n\`\`\``);
                break;

            case 'reaction':
                embed
                    .setAuthor({ 
                        name: '🚨 MARINE INTELLIGENCE BUREAU',
                        iconURL: user.displayAvatarURL({ size: 32 })
                    })
                    .setTitle('REACTION ACTIVITY DETECTED')
                    .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- GUILD: ${additionalInfo.guildName || 'Unknown'}\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${formatXP(additionalInfo.totalXP)}\n- CURRENT LEVEL: ${formatLevel(additionalInfo.currentLevel)}\n\`\`\``);
                break;

            case 'voice':
                // ✅ FIXED: Get user's tier-specific daily cap
                const tierCapInfo = await getUserTierCap(user.id, additionalInfo.guildId);
                const dailyCap = tierCapInfo.cap;
                const dailyXP = tierCapInfo.currentXP;
                const remainingXP = Math.max(0, dailyCap - dailyXP);
                const capPercentage = Math.round((dailyXP / dailyCap) * 100);
                
                const sessionDuration = additionalInfo.sessionDuration || 1;
                const dailyCapped = additionalInfo.dailyCapped ? ' (DAILY CAP REACHED)' : '';
                const memberCount = additionalInfo.memberCount || 'Unknown';
                
                embed
                    .setAuthor({ 
                        name: '🚨 MARINE INTELLIGENCE BUREAU',
                        iconURL: user.displayAvatarURL({ size: 32 })
                    })
                    .setTitle('🔴 🎤 VOICE ACTIVITY DETECTED')
                    .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- GUILD: ${additionalInfo.guildName || 'Unknown'}\n- VOICE CHANNEL: ${additionalInfo.channelName || 'Unknown'}\n- DURATION: ${sessionDuration} minute(s)\n- MEMBERS PRESENT: ${memberCount}\n- XP AWARDED: +${xpGain}${dailyCapped}\n- NEW TOTAL: ${formatXP(additionalInfo.totalXP)}\n- CURRENT LEVEL: ${formatLevel(additionalInfo.currentLevel)}\n\`\`\``)
                    .addFields(
                        {
                            name: '📊 Daily Voice XP Progress',
                            value: `\`\`\`diff\n- Daily XP: ${dailyXP.toLocaleString()}/${dailyCap.toLocaleString()} (${capPercentage}%)\n- Remaining: ${remainingXP.toLocaleString()} XP\n- Tier: ${tierCapInfo.hasCustomCap ? `Tier ${tierCapInfo.tier}` : 'Default'}\n- Reset Day: ${getCurrentDay()}\n\`\`\``,
                            inline: true
                        },
                        {
                            name: '🎯 Status',
                            value: `\`\`\`diff\n${dailyXP >= dailyCap ? '- 🚨 DAILY CAP REACHED' : `- ⏱️ ${remainingXP.toLocaleString()} XP until cap`}\n\`\`\``,
                            inline: true
                        }
                    );
                break;
                
            case 'levelup':
                const { getBountyForLevel } = require('./bountySystem');
                const oldLevel = additionalInfo.oldLevel !== undefined ? additionalInfo.oldLevel : 0;
                const newLevel = additionalInfo.newLevel !== undefined ? additionalInfo.newLevel : 0;
                const oldBounty = getBountyForLevel(oldLevel);
                const newBounty = getBountyForLevel(newLevel);
                const bountyIncrease = newBounty - oldBounty;
                const xpSource = additionalInfo.xpSource || 'UNKNOWN';
                
                embed
                    .setAuthor({ 
                        name: '🚨 MARINE INTELLIGENCE BUREAU',
                        iconURL: user.displayAvatarURL({ size: 32 })
                    })
                    .setTitle('⚠️ THREAT LEVEL INCREASED ⚠️')
                    .setDescription(`\`\`\`diff\n- BOUNTY UPDATE CONFIRMED\n- SUBJECT: ${user.username} (${user.id})\n- GUILD: ${additionalInfo.guildName || 'Unknown'}\n- LEVEL PROGRESSION: ${oldLevel} → ${newLevel}\n- TOTAL XP: ${formatXP(additionalInfo.totalXP)}\n- OLD BOUNTY: ฿${oldBounty.toLocaleString()}\n- NEW BOUNTY: ฿${newBounty.toLocaleString()}\n- BOUNTY INCREASE: +฿${bountyIncrease.toLocaleString()}\n- XP SOURCE: ${xpSource.toUpperCase()}\n${additionalInfo.roleReward ? `- ROLE AWARDED: ${additionalInfo.roleReward}\n` : ''}\`\`\``);
                break;

            case 'admin':
                embed
                    .setAuthor({ 
                        name: '⚓ MARINE COMMAND CENTER',
                        iconURL: additionalInfo.adminUser?.displayAvatarURL({ size: 32 }) || null
                    })
                    .setTitle('MANUAL XP ADJUSTMENT')
                    .setDescription(`\`\`\`diff\n- ADMINISTRATIVE ACTION\n- TARGET: ${user.username}\n- TARGET ID: ${user.id}\n- AUTHORIZED BY: ${additionalInfo.adminUser?.username || 'Unknown Officer'}\n- ADJUSTMENT: ${xpGain > 0 ? '+' : ''}${xpGain} XP\n- REASON: ${additionalInfo.reason || 'No reason specified'}\n- NEW TOTAL: ${formatXP(additionalInfo.totalXP)}\n- NEW LEVEL: ${formatLevel(additionalInfo.currentLevel)}\n- XP SOURCE: ADMIN COMMAND\n\`\`\``);
                break;

            default:
                embed
                    .setAuthor({ 
                        name: '❓ MARINE INTELLIGENCE BUREAU',
                        iconURL: user.displayAvatarURL({ size: 32 })
                    })
                    .setTitle('UNKNOWN ACTIVITY DETECTED')
                    .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- ACTIVITY TYPE: ${type.toUpperCase()}\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${formatXP(additionalInfo.totalXP)}\n- CURRENT LEVEL: ${formatLevel(additionalInfo.currentLevel)}\n- XP SOURCE: ${type.toUpperCase()}\n\`\`\``);
                break;
        }

        // Send the log
        await channel.send({ embeds: [embed] });
        console.log(`[XP LOG] Logged ${type} XP for ${user.username}: +${xpGain}`);

    } catch (error) {
        console.error('[XP LOG] Failed to send XP log:', error);
    }
}

/**
 * Log XP activity with automatic user stats fetching
 * @param {Client} client - Discord client
 * @param {string} type - XP type
 * @param {User} user - Discord user
 * @param {string} guildId - Guild ID
 * @param {number} xpGain - XP gained
 * @param {Object} extraInfo - Additional info
 */
async function logXPActivity(client, type, user, guildId, xpGain, extraInfo = {}) {
    try {
        // Get guild info
        const guild = client.guilds.cache.get(guildId);
        const guildName = guild?.name || 'Unknown Guild';

        // Get user's current stats
        let totalXP = 0;
        let currentLevel = 0;
        
        if (global.xpTracker && global.xpTracker.db) {
            try {
                const userStats = await global.xpTracker.db.query(
                    'SELECT total_xp, level FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                    [user.id, guildId]
                );
                
                if (userStats.rows.length > 0) {
                    totalXP = userStats.rows[0].total_xp;
                    currentLevel = userStats.rows[0].level;
                }
            } catch (dbError) {
                console.error('[XP LOG] Error fetching user stats:', dbError);
            }
        }

        // Combine info
        const logInfo = {
            guildName,
            guildId, // ✅ FIXED: Add guildId for tier cap checking
            totalXP,
            currentLevel,
            ...extraInfo
        };

        await sendXPLog(client, type, user, xpGain, logInfo);
    } catch (error) {
        console.error('[XP LOG] Error in logXPActivity:', error);
    }
}

// ✅ NEW: Helper function to get current day
function getCurrentDay() {
    const now = new Date();
    const edtOffset = isEDT(now) ? -4 : -5;
    const edtTime = new Date(now.getTime() + (edtOffset * 60 * 60 * 1000));
    
    if (edtTime.getHours() < 3) {
        edtTime.setDate(edtTime.getDate() - 1);
    }
    
    return edtTime.toISOString().split('T')[0];
}

// ✅ NEW: Helper function to check EDT
function isEDT(date) {
    const year = date.getFullYear();
    const marchSecondSunday = new Date(year, 2, 8);
    marchSecondSunday.setDate(marchSecondSunday.getDate() + (7 - marchSecondSunday.getDay()));
    const novemberFirstSunday = new Date(year, 10, 1);
    novemberFirstSunday.setDate(novemberFirstSunday.getDate() + (7 - novemberFirstSunday.getDay()));
    return date >= marchSecondSunday && date < novemberFirstSunday;
}

/**
 * Quick logging functions for easy use
 */
const quickLog = {
    message: async (client, user, guildId, xpGain, channel, messageLength = 0) => {
        await logXPActivity(client, 'message', user, guildId, xpGain, {
            channelName: channel?.name || 'Unknown',
            messageLength,
            xpSource: 'message'
        });
    },

    reaction: async (client, user, guildId, xpGain, channel, emoji = '❓') => {
        await logXPActivity(client, 'reaction', user, guildId, xpGain, {
            channelName: channel?.name || 'Unknown',
            emoji,
            xpSource: 'reaction'
        });
    },

    voice: async (client, user, guildId, xpGain, channel, sessionDuration = 1, memberCount = 0, dailyCapped = false) => {
        await logXPActivity(client, 'voice', user, guildId, xpGain, {
            channelName: channel?.name || 'Unknown',
            sessionDuration,
            memberCount,
            dailyCapped,
            xpSource: 'voice'
        });
    },

    levelup: async (client, user, guildId, oldLevel, newLevel, totalXP, roleReward = null, xpSource = 'unknown') => {
        await logXPActivity(client, 'levelup', user, guildId, 0, {
            oldLevel,
            newLevel,
            totalXP,
            roleReward,
            xpSource
        });
    },

    admin: async (client, user, guildId, xpGain, adminUser, reason = 'No reason specified') => {
        await logXPActivity(client, 'admin', user, guildId, xpGain, {
            adminUser,
            reason,
            xpSource: 'admin'
        });
    }
};

module.exports = { 
    sendXPLog,
    logXPActivity,
    quickLog
};

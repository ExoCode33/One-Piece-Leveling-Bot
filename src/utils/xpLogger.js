// src/utils/xpLogger.js - Enhanced Marine XP Logging with comprehensive tracking

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

        // Configure embed based on XP type
        switch (type) {
            case 'message':
                embed
                    .setAuthor({ 
                        name: '📝 MARINE INTELLIGENCE BUREAU',
                        iconURL: user.displayAvatarURL({ size: 32 })
                    })
                    .setTitle('MESSAGE ACTIVITY DETECTED')
                    .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- GUILD: ${additionalInfo.guildName || 'Unknown'}\n- CHANNEL: ${additionalInfo.channelName || 'Unknown'}\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${additionalInfo.totalXP?.toLocaleString() || 'Unknown'}\n- CURRENT LEVEL: ${additionalInfo.currentLevel || 'Unknown'}\n- MESSAGE LENGTH: ${additionalInfo.messageLength || 'Unknown'} chars\n\`\`\``);
                break;

            case 'reaction':
                embed
                    .setAuthor({ 
                        name: '😄 MARINE INTELLIGENCE BUREAU',
                        iconURL: user.displayAvatarURL({ size: 32 })
                    })
                    .setTitle('REACTION ACTIVITY DETECTED')
                    .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- GUILD: ${additionalInfo.guildName || 'Unknown'}\n- CHANNEL: ${additionalInfo.channelName || 'Unknown'}\n- REACTION: ${additionalInfo.emoji || '❓'}\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${additionalInfo.totalXP?.toLocaleString() || 'Unknown'}\n- CURRENT LEVEL: ${additionalInfo.currentLevel || 'Unknown'}\n\`\`\``);
                break;

            case 'voice':
                const sessionDuration = additionalInfo.sessionDuration || 1;
                const dailyCap = additionalInfo.dailyCapped ? ' (DAILY CAP REACHED)' : '';
                const memberCount = additionalInfo.memberCount || 'Unknown';
                
                embed
                    .setAuthor({ 
                        name: '🎙️ MARINE INTELLIGENCE BUREAU',
                        iconURL: user.displayAvatarURL({ size: 32 })
                    })
                    .setTitle('VOICE ACTIVITY DETECTED')
                    .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- GUILD: ${additionalInfo.guildName || 'Unknown'}\n- VOICE CHANNEL: ${additionalInfo.channelName || 'Unknown'}\n- DURATION: ${sessionDuration} minute(s)\n- MEMBERS PRESENT: ${memberCount}\n- XP AWARDED: +${xpGain}${dailyCap}\n- NEW TOTAL: ${additionalInfo.totalXP?.toLocaleString() || 'Unknown'}\n- CURRENT LEVEL: ${additionalInfo.currentLevel || 'Unknown'}\n\`\`\``);
                break;

            case 'levelup':
                const { getBountyForLevel } = require('./bountySystem');
                const oldBounty = getBountyForLevel(additionalInfo.oldLevel || 0);
                const newBounty = getBountyForLevel(additionalInfo.newLevel || 0);
                const bountyIncrease = newBounty - oldBounty;
                
                embed
                    .setAuthor({ 
                        name: '🚨 MARINE INTELLIGENCE BUREAU',
                        iconURL: user.displayAvatarURL({ size: 32 })
                    })
                    .setTitle('⚠️ THREAT LEVEL INCREASED ⚠️')
                    .setDescription(`\`\`\`diff\n+ BOUNTY UPDATE CONFIRMED\n+ SUBJECT: ${user.username} (${user.id})\n+ GUILD: ${additionalInfo.guildName || 'Unknown'}\n+ LEVEL PROGRESSION: ${additionalInfo.oldLevel || 0} → ${additionalInfo.newLevel || 0}\n+ TOTAL XP: ${additionalInfo.totalXP?.toLocaleString() || 'Unknown'}\n+ OLD BOUNTY: ฿${oldBounty.toLocaleString()}\n+ NEW BOUNTY: ฿${newBounty.toLocaleString()}\n+ BOUNTY INCREASE: +฿${bountyIncrease.toLocaleString()}\n${additionalInfo.roleReward ? `+ ROLE AWARDED: ${additionalInfo.roleReward}\n` : ''}! ENHANCED SURVEILLANCE REQUIRED\n\`\`\``);
                break;

            case 'admin':
                embed
                    .setAuthor({ 
                        name: '⚓ MARINE COMMAND CENTER',
                        iconURL: additionalInfo.adminUser?.displayAvatarURL({ size: 32 }) || null
                    })
                    .setTitle('MANUAL XP ADJUSTMENT')
                    .setDescription(`\`\`\`diff\n- ADMINISTRATIVE ACTION\n- TARGET: ${user.username} (${user.id})\n- AUTHORIZED BY: ${additionalInfo.adminUser?.username || 'Unknown Officer'}\n- ADJUSTMENT: ${xpGain > 0 ? '+' : ''}${xpGain} XP\n- REASON: ${additionalInfo.reason || 'No reason specified'}\n- NEW TOTAL: ${additionalInfo.totalXP?.toLocaleString() || 'Unknown'}\n- NEW LEVEL: ${additionalInfo.currentLevel || 'Unknown'}\n\`\`\``);
                break;

            default:
                embed
                    .setAuthor({ 
                        name: '❓ MARINE INTELLIGENCE BUREAU',
                        iconURL: user.displayAvatarURL({ size: 32 })
                    })
                    .setTitle('UNKNOWN ACTIVITY DETECTED')
                    .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- ACTIVITY TYPE: ${type.toUpperCase()}\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${additionalInfo.totalXP?.toLocaleString() || 'Unknown'}\n- CURRENT LEVEL: ${additionalInfo.currentLevel || 'Unknown'}\n\`\`\``);
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
        let totalXP = 'Unknown';
        let currentLevel = 'Unknown';
        
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
            totalXP,
            currentLevel,
            ...extraInfo
        };

        await sendXPLog(client, type, user, xpGain, logInfo);
    } catch (error) {
        console.error('[XP LOG] Error in logXPActivity:', error);
    }
}

/**
 * Quick logging functions for easy use
 */
const quickLog = {
    message: async (client, user, guildId, xpGain, channel, messageLength = 0) => {
        await logXPActivity(client, 'message', user, guildId, xpGain, {
            channelName: channel?.name || 'Unknown',
            messageLength
        });
    },

    reaction: async (client, user, guildId, xpGain, channel, emoji = '❓') => {
        await logXPActivity(client, 'reaction', user, guildId, xpGain, {
            channelName: channel?.name || 'Unknown',
            emoji
        });
    },

    voice: async (client, user, guildId, xpGain, channel, sessionDuration = 1, memberCount = 0, dailyCapped = false) => {
        await logXPActivity(client, 'voice', user, guildId, xpGain, {
            channelName: channel?.name || 'Unknown',
            sessionDuration,
            memberCount,
            dailyCapped
        });
    },

    levelup: async (client, user, guildId, oldLevel, newLevel, totalXP, roleReward = null) => {
        await logXPActivity(client, 'levelup', user, guildId, 0, {
            oldLevel,
            newLevel,
            totalXP,
            roleReward
        });
    },

    admin: async (client, user, guildId, xpGain, adminUser, reason = 'No reason specified') => {
        await logXPActivity(client, 'admin', user, guildId, xpGain, {
            adminUser,
            reason
        });
    }
};

module.exports = { 
    sendXPLog,
    logXPActivity,
    quickLog
};

// src/utils/xpLogger.js - Professional Red XP Logging (No Emojis)

const { EmbedBuilder } = require('discord.js');

// === Professional Red XP Logging Function ===
async function sendXPLog(client, type, user, xpGain, additionalInfo = {}) {
    const logChannelId = process.env.XP_LOG_CHANNEL;
    if (!logChannelId || process.env.XP_LOG_ENABLED !== 'true') return;

    // Check specific logging settings
    const logSettings = {
        message: process.env.XP_LOG_MESSAGES !== 'false', // Default to true unless explicitly disabled
        reaction: process.env.XP_LOG_REACTIONS !== 'false', // Default to true unless explicitly disabled
        voice: process.env.XP_LOG_VOICE !== 'false', // Default to true unless explicitly disabled
        levelup: true // Always log level ups if logging is enabled
    };

    if (!logSettings[type]) return;

    try {
        const channel = await client.channels.fetch(logChannelId);
        if (!channel || !channel.isTextBased()) return;

        // Create professional red embed
        const embed = new EmbedBuilder()
            .setColor(0xFF0000) // Red color
            .setTimestamp()
            .setFooter({ text: 'Marine Bounty Tracking System' });

        switch (type) {
            case 'message':
                embed
                    .setAuthor({ 
                        name: 'WORLD GOVERNMENT INTELLIGENCE BUREAU'
                    })
                    .addFields({
                        name: 'Message XP',
                        value: `\`\`\`diff\n- Pirate: ${user.username}\n- XP Earned: +${xpGain}\n- Channel: ${additionalInfo.channelId ? `<#${additionalInfo.channelId}>` : 'Unknown'}\n\`\`\``,
                        inline: false
                    });
                break;

            case 'reaction':
                embed
                    .setAuthor({ 
                        name: 'WORLD GOVERNMENT INTELLIGENCE BUREAU'
                    })
                    .addFields({
                        name: 'Reaction XP',
                        value: `\`\`\`diff\n- Pirate: ${user.username}\n- XP Earned: +${xpGain}\n- Channel: ${additionalInfo.channelId ? `<#${additionalInfo.channelId}>` : 'Unknown'}\n\`\`\``,
                        inline: false
                    });
                break;

            case 'voice':
                let voiceValue = `\`\`\`diff\n- Pirate: ${user.username}\n- XP Earned: +${xpGain}\n- Duration: ${additionalInfo.sessionDuration || 1}m\n`;
                
                // Add daily cap warning if applicable
                if (additionalInfo.dailyCapped) {
                    voiceValue += `- Status: Daily cap reached\n`;
                }
                voiceValue += `\`\`\``;

                embed
                    .setAuthor({ 
                        name: 'WORLD GOVERNMENT INTELLIGENCE BUREAU'
                    })
                    .addFields({
                        name: 'Voice XP',
                        value: voiceValue,
                        inline: false
                    });
                break;

            case 'levelup':
                let levelUpValue = `\`\`\`diff\n- Pirate: ${user.username}\n- Progress: Level ${additionalInfo.oldLevel} -> ${additionalInfo.newLevel}\n- Total XP: ${additionalInfo.totalXP.toLocaleString()}\n`;
                
                if (additionalInfo.rolesAssigned && additionalInfo.rolesAssigned > 0) {
                    levelUpValue += `- New Roles: ${additionalInfo.rolesAssigned} assigned\n`;
                }
                if (additionalInfo.roleReward) {
                    levelUpValue += `- Role Reward: ${additionalInfo.roleReward}\n`;
                }
                levelUpValue += `\`\`\``;

                embed
                    .setAuthor({ 
                        name: 'WORLD GOVERNMENT INTELLIGENCE BUREAU'
                    })
                    .addFields({
                        name: 'Level Up',
                        value: levelUpValue,
                        inline: false
                    });
                break;

            default:
                // Handle any other log types
                embed
                    .setAuthor({ 
                        name: 'WORLD GOVERNMENT INTELLIGENCE BUREAU'
                    })
                    .addFields({
                        name: `${type.charAt(0).toUpperCase() + type.slice(1)} Activity`,
                        value: `\`\`\`diff\n- Pirate: ${user.username}\n- XP Earned: +${xpGain}\n- Type: ${type}\n\`\`\``,
                        inline: false
                    });
                break;
        }

        await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error('[XP LOG] Failed to send log:', err);
    }
}

// Helper function to get color based on type (keeping for compatibility)
function getTypeColor(type) {
    // Always return red for the professional theme
    return 0xFF0000;
}

module.exports = { 
    sendXPLog,
    getTypeColor // Export for compatibility if other files use it
};

// src/utils/xpLogger.js - Minimalist Professional XP Logging

const { EmbedBuilder } = require('discord.js');

// === Minimalist Professional XP Logging Function ===
async function sendXPLog(client, type, user, xpGain, additionalInfo = {}) {
    const logChannelId = process.env.XP_LOG_CHANNEL;
    if (!logChannelId || process.env.XP_LOG_ENABLED !== 'true') return;

    // Check specific logging settings
    const logSettings = {
        message: process.env.XP_LOG_MESSAGES === 'true',
        reaction: process.env.XP_LOG_REACTIONS === 'true',
        voice: process.env.XP_LOG_VOICE === 'true',
        levelup: true // Always log level ups if logging is enabled
    };

    if (!logSettings[type]) return;

    try {
        const channel = await client.channels.fetch(logChannelId);
        if (!channel || !channel.isTextBased()) return;

        // Create minimalist professional embed
        const embed = new EmbedBuilder()
            .setColor(getTypeColor(type))
            .setTimestamp()
            .setFooter({ text: '⚓ Marine Bounty Tracking System' });

        switch (type) {
            case 'message':
                embed
                    .setTitle('📜 Message XP')
                    .addFields(
                        { name: '🏴‍☠️ Pirate', value: user.username, inline: true },
                        { name: '💰 XP Earned', value: `+${xpGain}`, inline: true },
                        { name: '📍 Channel', value: `<#${additionalInfo.channelId}>`, inline: true }
                    );
                break;

            case 'reaction':
                embed
                    .setTitle('⚡ Reaction XP')
                    .addFields(
                        { name: '🏴‍☠️ Pirate', value: user.username, inline: true },
                        { name: '💰 XP Earned', value: `+${xpGain}`, inline: true },
                        { name: '📍 Channel', value: `<#${additionalInfo.channelId}>`, inline: true }
                    );
                break;

            case 'voice':
                embed
                    .setTitle('🎙️ Voice XP')
                    .addFields(
                        { name: '🏴‍☠️ Pirate', value: user.username, inline: true },
                        { name: '💰 XP Earned', value: `+${xpGain}`, inline: true },
                        { name: '⏱️ Duration', value: `${additionalInfo.sessionDuration || 1}m`, inline: true }
                    );

                // Add daily cap warning if applicable
                if (additionalInfo.dailyCapped) {
                    embed.addFields({
                        name: '⚠️ Status',
                        value: 'Daily cap reached',
                        inline: true
                    });
                }
                break;

            case 'levelup':
                embed
                    .setTitle('🎯 Level Up')
                    .setDescription(`**${user.username}** reached Level ${additionalInfo.newLevel}`)
                    .addFields(
                        { name: '📊 Progress', value: `Level ${additionalInfo.oldLevel} → ${additionalInfo.newLevel}`, inline: true },
                        { name: '💎 Total XP', value: additionalInfo.totalXP.toLocaleString(), inline: true }
                    )
                    .setColor('#FFD700');

                if (additionalInfo.rolesAssigned && additionalInfo.rolesAssigned > 0) {
                    embed.addFields({ 
                        name: '🏆 Roles', 
                        value: `${additionalInfo.rolesAssigned} new role(s)`, 
                        inline: true 
                    });
                }
                break;
        }

        await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error('[XP LOG] Failed to send log:', err);
    }
}

// Helper function to get color based on type
function getTypeColor(type) {
    const colors = {
        message: 0x3B82F6,    // Blue
        reaction: 0xF59E0B,   // Orange
        voice: 0x10B981,      // Green
        levelup: 0xFFD700     // Gold
    };
    return colors[type] || 0x6B7280;
}

module.exports = { sendXPLog };

// src/utils/xpLogger.js - Professional XP Logging System

const { EmbedBuilder } = require('discord.js');

class XPLogger {
    constructor(client) {
        this.client = client;
    }

    // Professional embed logging function
    async sendXPLog(type, user, xpGain, additionalInfo = {}) {
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
            const channel = await this.client.channels.fetch(logChannelId);
            if (!channel || !channel.isTextBased()) return;

            // Create professional embed based on type
            const embed = new EmbedBuilder()
                .setTimestamp()
                .setFooter({ 
                    text: 'XP Tracking System', 
                    iconURL: this.client.user.displayAvatarURL() 
                });

            switch (type) {
                case 'message':
                    embed
                        .setTitle('💬 Message XP Awarded')
                        .setColor(0x5865F2) // Discord Blurple
                        .addFields(
                            { name: 'User', value: `${user.username}`, inline: true },
                            { name: 'XP Gained', value: `+${xpGain}`, inline: true },
                            { name: 'Channel', value: `<#${additionalInfo.channelId}>`, inline: true }
                        );
                    
                    if (additionalInfo.totalXP) {
                        embed.addFields({ 
                            name: 'Total XP', 
                            value: additionalInfo.totalXP.toLocaleString(), 
                            inline: true 
                        });
                    }
                    if (additionalInfo.level) {
                        embed.addFields({ 
                            name: 'Current Level', 
                            value: additionalInfo.level.toString(), 
                            inline: true 
                        });
                    }
                    if (additionalInfo.messageLength) {
                        embed.addFields({ 
                            name: 'Message Length', 
                            value: `${additionalInfo.messageLength} chars`, 
                            inline: true 
                        });
                    }
                    break;

                case 'reaction':
                    embed
                        .setTitle('👍 Reaction XP Awarded')
                        .setColor(0xFEE75C) // Yellow
                        .addFields(
                            { name: 'User', value: `${user.username}`, inline: true },
                            { name: 'XP Gained', value: `+${xpGain}`, inline: true },
                            { name: 'Channel', value: `<#${additionalInfo.channelId}>`, inline: true }
                        );

                    if (additionalInfo.emoji) {
                        embed.addFields({ 
                            name: 'Reaction', 
                            value: additionalInfo.emoji, 
                            inline: true 
                        });
                    }
                    if (additionalInfo.totalXP) {
                        embed.addFields({ 
                            name: 'Total XP', 
                            value: additionalInfo.totalXP.toLocaleString(), 
                            inline: true 
                        });
                    }
                    if (additionalInfo.level) {
                        embed.addFields({ 
                            name: 'Current Level', 
                            value: additionalInfo.level.toString(), 
                            inline: true 
                        });
                    }
                    if (additionalInfo.messageAuthor) {
                        embed.addFields({ 
                            name: 'Message Author', 
                            value: additionalInfo.messageAuthor, 
                            inline: true 
                        });
                    }
                    break;

                case 'voice':
                    embed
                        .setTitle('🔊 Voice XP Awarded')
                        .setColor(0x57F287) // Green
                        .addFields(
                            { name: 'User', value: `${user.username}`, inline: true },
                            { name: 'XP Gained', value: `+${xpGain}`, inline: true },
                            { name: 'Voice Channel', value: additionalInfo.channelName || 'Unknown', inline: true }
                        );

                    if (additionalInfo.memberCount) {
                        embed.addFields({ 
                            name: 'Members in Voice', 
                            value: additionalInfo.memberCount.toString(), 
                            inline: true 
                        });
                    }
                    if (additionalInfo.sessionDuration) {
                        embed.addFields({ 
                            name: 'Session Duration', 
                            value: `${additionalInfo.sessionDuration} min`, 
                            inline: true 
                        });
                    }
                    if (additionalInfo.totalXP) {
                        embed.addFields({ 
                            name: 'Total XP', 
                            value: additionalInfo.totalXP.toLocaleString(), 
                            inline: true 
                        });
                    }
                    break;

                case 'levelup':
                    embed
                        .setTitle('🎉 Level Up Achievement!')
                        .setColor(0xED4245) // Red
                        .setDescription(`**${user.username}** has leveled up!`)
                        .addFields(
                            { name: 'Previous Level', value: additionalInfo.oldLevel.toString(), inline: true },
                            { name: 'New Level', value: `**${additionalInfo.newLevel}**`, inline: true },
                            { name: 'Total XP', value: additionalInfo.totalXP.toLocaleString(), inline: true }
                        );

                    if (additionalInfo.roleReward && additionalInfo.roleReward !== 'your_role_id_here') {
                        embed.addFields({ 
                            name: '🏆 Role Unlocked', 
                            value: `<@&${additionalInfo.roleReward}>`, 
                            inline: false 
                        });
                        embed.setColor(0xFFD700); // Gold for role rewards
                    }

                    // Calculate XP progress to next level
                    if (additionalInfo.nextLevelXP) {
                        const progress = Math.floor((additionalInfo.totalXP / additionalInfo.nextLevelXP) * 100);
                        embed.addFields({ 
                            name: 'Progress to Next Level', 
                            value: `${progress}%`, 
                            inline: true 
                        });
                    }
                    break;

                case 'voice_session':
                    embed
                        .setTitle('🔊 Voice Session Completed')
                        .setColor(0x9932CC) // Purple
                        .addFields(
                            { name: 'User', value: `${user.username}`, inline: true },
                            { name: 'Channel', value: additionalInfo.channelName || 'Unknown', inline: true },
                            { name: 'Duration', value: `${additionalInfo.duration} minutes`, inline: true }
                        );

                    if (additionalInfo.totalXPGained) {
                        embed.addFields({ 
                            name: 'Total XP Gained', 
                            value: `+${additionalInfo.totalXPGained}`, 
                            inline: true 
                        });
                    }
                    break;
            }

            // Add user avatar as thumbnail
            if (user.displayAvatarURL) {
                embed.setThumbnail(user.displayAvatarURL({ size: 64 }));
            }

            // Add server icon as author
            if (additionalInfo.guildIcon) {
                embed.setAuthor({ 
                    name: additionalInfo.guildName || 'Server', 
                    iconURL: additionalInfo.guildIcon 
                });
            }

            await channel.send({ embeds: [embed] });
        } catch (err) {
            console.error('[XP LOG] Failed to send professional log:', err);
        }
    }

    // Log voice session start/end
    async logVoiceSession(type, user, sessionInfo) {
        if (process.env.XP_LOG_VOICE_SESSIONS !== 'true') return;

        const logChannelId = process.env.XP_LOG_CHANNEL;
        if (!logChannelId) return;

        try {
            const channel = await this.client.channels.fetch(logChannelId);
            if (!channel || !channel.isTextBased()) return;

            const embed = new EmbedBuilder()
                .setTimestamp()
                .setFooter({ 
                    text: 'Voice Session Tracker', 
                    iconURL: this.client.user.displayAvatarURL() 
                });

            if (type === 'start') {
                embed
                    .setTitle('🎙️ Voice Session Started')
                    .setColor(0x57F287) // Green
                    .addFields(
                        { name: 'User', value: user.username, inline: true },
                        { name: 'Channel', value: sessionInfo.channelName, inline: true },
                        { name: 'Members Present', value: sessionInfo.memberCount.toString(), inline: true }
                    );
            } else if (type === 'end') {
                embed
                    .setTitle('🔇 Voice Session Ended')
                    .setColor(0xED4245) // Red
                    .addFields(
                        { name: 'User', value: user.username, inline: true },
                        { name: 'Duration', value: `${sessionInfo.duration} minutes`, inline: true },
                        { name: 'XP Gained', value: `+${sessionInfo.xpGained}`, inline: true }
                    );
            }

            if (user.displayAvatarURL) {
                embed.setThumbnail(user.displayAvatarURL({ size: 64 }));
            }

            await channel.send({ embeds: [embed] });
        } catch (err) {
            console.error('[XP LOG] Failed to log voice session:', err);
        }
    }

    // Log daily/weekly statistics
    async logStatistics(type, stats) {
        if (process.env.XP_LOG_STATS !== 'true') return;

        const logChannelId = process.env.XP_LOG_CHANNEL;
        if (!logChannelId) return;

        try {
            const channel = await this.client.channels.fetch(logChannelId);
            if (!channel || !channel.isTextBased()) return;

            const embed = new EmbedBuilder()
                .setTimestamp()
                .setFooter({ 
                    text: 'XP Statistics', 
                    iconURL: this.client.user.displayAvatarURL() 
                });

            if (type === 'daily') {
                embed
                    .setTitle('📊 Daily XP Statistics')
                    .setColor(0x00D4AA)
                    .addFields(
                        { name: 'Total XP Awarded', value: stats.totalXP.toLocaleString(), inline: true },
                        { name: 'Active Users', value: stats.activeUsers.toString(), inline: true },
                        { name: 'Level Ups', value: stats.levelUps.toString(), inline: true },
                        { name: 'Messages Sent', value: stats.messages.toLocaleString(), inline: true },
                        { name: 'Reactions Given', value: stats.reactions.toLocaleString(), inline: true },
                        { name: 'Voice Minutes', value: stats.voiceMinutes.toLocaleString(), inline: true }
                    );
            }

            await channel.send({ embeds: [embed] });
        } catch (err) {
            console.error('[XP LOG] Failed to log statistics:', err);
        }
    }

    // Debug logging helper
    async debugLog(message, data = null) {
        if (process.env.DEBUG_MODE !== 'true') return;

        console.log(`[DEBUG XP] ${message}`, data ? JSON.stringify(data, null, 2) : '');

        // Optionally send debug info to a separate debug channel
        const debugChannelId = process.env.DEBUG_CHANNEL;
        if (debugChannelId && process.env.DEBUG_TO_CHANNEL === 'true') {
            try {
                const channel = await this.client.channels.fetch(debugChannelId);
                if (channel && channel.isTextBased()) {
                    const embed = new EmbedBuilder()
                        .setTitle('🐛 Debug Log')
                        .setDescription(`\`\`\`${message}\`\`\``)
                        .setColor(0x36393F) // Dark grey
                        .setTimestamp()
                        .setFooter({ text: 'Debug System' });

                    if (data) {
                        embed.addFields({ 
                            name: 'Data', 
                            value: `\`\`\`json\n${JSON.stringify(data, null, 2)}\`\`\``.slice(0, 1024) 
                        });
                    }

                    await channel.send({ embeds: [embed] });
                }
            } catch (err) {
                console.error('[DEBUG] Failed to send debug log to channel:', err);
            }
        }
    }

    // Error logging
    async logError(error, context = '') {
        console.error(`[XP ERROR] ${context}:`, error);

        const errorChannelId = process.env.ERROR_LOG_CHANNEL;
        if (errorChannelId && process.env.LOG_ERRORS_TO_CHANNEL === 'true') {
            try {
                const channel = await this.client.channels.fetch(errorChannelId);
                if (channel && channel.isTextBased()) {
                    const embed = new EmbedBuilder()
                        .setTitle('❌ XP System Error')
                        .setColor(0xFF0000) // Red
                        .addFields(
                            { name: 'Context', value: context || 'Unknown', inline: true },
                            { name: 'Error', value: `\`\`\`${error.message}\`\`\``.slice(0, 1024), inline: false }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Error Tracking System' });

                    if (error.stack) {
                        embed.addFields({ 
                            name: 'Stack Trace', 
                            value: `\`\`\`${error.stack}\`\`\``.slice(0, 1024) 
                        });
                    }

                    await channel.send({ embeds: [embed] });
                }
            } catch (err) {
                console.error('[ERROR LOG] Failed to send error to channel:', err);
            }
        }
    }
}

module.exports = XPLogger;

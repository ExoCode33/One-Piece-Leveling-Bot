// src/utils/xpLogger.js - One Piece Themed Professional XP Logging

const { EmbedBuilder } = require('discord.js');

// === One Piece Themed Professional XP Logging Function ===
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

        // Create One Piece themed embed based on type
        const embed = new EmbedBuilder()
            .setTimestamp()
            .setFooter({ 
                text: '⚓ Marine Bounty Tracking System', 
                iconURL: client.user.displayAvatarURL() 
            });

        switch (type) {
            case 'message':
                embed
                    .setTitle('📜 Pirate\'s Message Bounty')
                    .setColor(0x1E3A8A) // Navy Blue
                    .setDescription('*A pirate\'s words carry weight on the Grand Line...*')
                    .addFields(
                        { name: '🏴‍☠️ Pirate', value: `**${user.username}**`, inline: true },
                        { name: '💰 Bounty Earned', value: `**+${xpGain}** ⚡`, inline: true },
                        { name: '🗺️ Location', value: `<#${additionalInfo.channelId}>`, inline: true }
                    );
                
                if (additionalInfo.totalXP) {
                    embed.addFields({ 
                        name: '💎 Total Bounty', 
                        value: `**${additionalInfo.totalXP.toLocaleString()}** ⚡`, 
                        inline: true 
                    });
                }
                if (additionalInfo.level) {
                    embed.addFields({ 
                        name: '⭐ Pirate Rank', 
                        value: `**Level ${additionalInfo.level}**`, 
                        inline: true 
                    });
                }
                embed.setAuthor({ 
                    name: 'Marine Intelligence Report'
                });
                break;

            case 'reaction':
                embed
                    .setTitle('😄 Crew Member\'s Reaction')
                    .setColor(0xF59E0B) // Amber/Gold
                    .setDescription('*Even a simple reaction shows the bond between crew members!*')
                    .addFields(
                        { name: '🏴‍☠️ Pirate', value: `**${user.username}**`, inline: true },
                        { name: '💰 Bounty Earned', value: `**+${xpGain}** ⚡`, inline: true },
                        { name: '🗺️ Location', value: `<#${additionalInfo.channelId}>`, inline: true }
                    );

                if (additionalInfo.emoji) {
                    embed.addFields({ 
                        name: '⚓ Reaction', 
                        value: additionalInfo.emoji, 
                        inline: true 
                    });
                }
                if (additionalInfo.totalXP) {
                    embed.addFields({ 
                        name: '💎 Total Bounty', 
                        value: `**${additionalInfo.totalXP.toLocaleString()}** ⚡`, 
                        inline: true 
                    });
                }
                if (additionalInfo.level) {
                    embed.addFields({ 
                        name: '⭐ Pirate Rank', 
                        value: `**Level ${additionalInfo.level}**`, 
                        inline: true 
                    });
                }
                embed.setAuthor({ 
                    name: 'Crew Bond Strengthened'
                });
                break;

            case 'voice':
                embed
                    .setTitle('🎙️ Crew Assembly Bounty')
                    .setColor(0x10B981) // Emerald Green
                    .setDescription('*Gathering with fellow pirates strengthens the crew!*')
                    .addFields(
                        { name: '🏴‍☠️ Pirate', value: `**${user.username}**`, inline: true },
                        { name: '💰 Bounty Earned', value: `**+${xpGain}** ⚡`, inline: true },
                        { name: '🚢 Ship Deck', value: additionalInfo.channelName || 'Unknown Waters', inline: true }
                    );

                if (additionalInfo.memberCount) {
                    embed.addFields({ 
                        name: '👥 Crew Members', 
                        value: `${additionalInfo.memberCount} pirates`, 
                        inline: true 
                    });
                }
                if (additionalInfo.sessionDuration) {
                    embed.addFields({ 
                        name: '⏰ Time on Deck', 
                        value: `${additionalInfo.sessionDuration} minutes`, 
                        inline: true 
                    });
                }
                if (additionalInfo.totalXP) {
                    embed.addFields({ 
                        name: '💎 Total Bounty', 
                        value: `**${additionalInfo.totalXP.toLocaleString()}** ⚡`, 
                        inline: true 
                    });
                }
                embed.setAuthor({ 
                    name: 'Ship Assembly Log'
                });
                break;

            case 'levelup':
                embed
                    .setTitle('🌟 BOUNTY INCREASE! 🌟')
                    .setColor(0xDC2626) // Red
                    .setDescription(`**${user.username}** has reached a new level of infamy!\n*The Marines have increased their bounty!*`)
                    .addFields(
                        { name: '📰 Previous Bounty Level', value: `**Level ${additionalInfo.oldLevel}**`, inline: true },
                        { name: '🔥 NEW BOUNTY LEVEL', value: `**Level ${additionalInfo.newLevel}**`, inline: true },
                        { name: '💎 Total Bounty', value: `**${additionalInfo.totalXP.toLocaleString()}** ⚡`, inline: true }
                    );

                if (additionalInfo.roleReward && additionalInfo.roleReward !== 'your_role_id_here') {
                    embed.addFields({ 
                        name: '🏆 New Title Earned', 
                        value: `<@&${additionalInfo.roleReward}>`, 
                        inline: false 
                    });
                    embed.setColor(0xFFD700); // Gold for role rewards
                    embed.setDescription(`**${user.username}** has gained a new title!\n*🎉 The World Government recognizes their growing threat! 🎉*`);
                }

                // Add special level milestone messages
                if (additionalInfo.newLevel === 50) {
                    embed.setDescription(`**${user.username}** has reached the legendary Level 50!\n*🏴‍☠️ They've ascended to YONKO status! One of the Four Emperors! 🏴‍☠️*`);
                } else if (additionalInfo.newLevel === 45) {
                    embed.setDescription(`**${user.username}** has reached Level 45!\n*⚡ They've become a feared Yonko Commander! ⚡*`);
                } else if (additionalInfo.newLevel === 40) {
                    embed.setDescription(`**${user.username}** has reached Level 40!\n*🗡️ They've achieved Warlord status! 🗡️*`);
                } else if (additionalInfo.newLevel === 35) {
                    embed.setDescription(`**${user.username}** has reached Level 35!\n*🧭 They've become a trusted First Mate! 🧭*`);
                } else if (additionalInfo.newLevel === 30) {
                    embed.setDescription(`**${user.username}** has reached Level 30!\n*🗺️ They've mastered navigation of the Grand Line! 🗺️*`);
                } else if (additionalInfo.newLevel === 25) {
                    embed.setDescription(`**${user.username}** has reached Level 25!\n*⚓ They've earned the rank of Boatswain! ⚓*`);
                } else if (additionalInfo.newLevel === 20) {
                    embed.setDescription(`**${user.username}** has reached Level 20!\n*⚓ They've become the ship's Helmsman! ⚓*`);
                } else if (additionalInfo.newLevel === 15) {
                    embed.setDescription(`**${user.username}** has reached Level 15!\n*💣 They've proven themselves as a skilled Gunner! 💣*`);
                } else if (additionalInfo.newLevel === 10) {
                    embed.setDescription(`**${user.username}** has reached Level 10!\n*🧨 They've advanced to Powder Monkey! 🧨*`);
                } else if (additionalInfo.newLevel === 5) {
                    embed.setDescription(`**${user.username}** has reached Level 5!\n*🔨 They've become a reliable Deckhand! 🔨*`);
                }
                
                embed.setAuthor({ 
                    name: 'WORLD GOVERNMENT BOUNTY UPDATE'
                });
                break;
        }

        // Add user avatar as thumbnail with One Piece frame effect
        if (user.displayAvatarURL) {
            embed.setThumbnail(user.displayAvatarURL({ size: 128 }));
        }

        await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error('[BOUNTY LOG] Failed to send professional log:', err);
    }
}

module.exports = { sendXPLog };

// src/utils/levelUpManager.js - Level Up System

const { EmbedBuilder } = require('discord.js');

class LevelUpManager {
    constructor(xpTracker) {
        this.xpTracker = xpTracker;
        this.client = xpTracker.client;
        this.db = xpTracker.db;
    }

    // Handle level up
    async handleLevelUp(userId, guildId, oldLevel, newLevel, totalXP, user, xpSource = 'unknown') {
        try {
            console.log(`[LEVEL UP] Processing level up for ${user.username}: ${oldLevel} → ${newLevel}`);

            // Award level roles
            const roleReward = await this.awardLevelRoles(userId, guildId, newLevel);

            // Send level up notification
            await this.sendLevelUpNotification(userId, guildId, oldLevel, newLevel, totalXP, user, roleReward);

            // Log level up
            await this.logLevelUp(user, guildId, oldLevel, newLevel, totalXP, roleReward, xpSource);

        } catch (error) {
            console.error('Error handling level up:', error);
        }
    }

    // Award level roles
    async awardLevelRoles(userId, guildId, level) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
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

    // Send level up notification
    async sendLevelUpNotification(userId, guildId, oldLevel, newLevel, totalXP, user, roleReward = null) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;

            const guildSettings = global.guildSettings?.get(guildId);
            
            const levelupEnabled = guildSettings?.levelupEnabled !== false;
            if (!levelupEnabled) {
                console.log('[LEVEL UP] Level up announcements disabled for this guild');
                return;
            }

            let channelId = guildSettings?.levelupChannel;
            
            if (!channelId) {
                // Find a suitable channel
                const defaultChannel = guild.channels.cache.find(ch => 
                    (ch.name.toLowerCase().includes('general') || 
                     ch.name.toLowerCase().includes('chat') ||
                     ch.name.toLowerCase().includes('level') ||
                     ch.name.toLowerCase().includes('bounty')) && ch.isTextBased()
                );
                
                if (defaultChannel) {
                    channelId = defaultChannel.id;
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

            // Create Marine Intelligence embed
            const embed = this.createLevelUpEmbed(user, oldLevel, newLevel, totalXP, roleReward);

            const messageOptions = { embeds: [embed] };
            
            // Ping user if enabled
            const pingUser = process.env.LEVELUP_PING_USER !== 'false';
            if (pingUser) {
                messageOptions.content = `<@${userId}>`;
            }
            
            await channel.send(messageOptions);
            console.log(`[LEVEL UP] ✅ Level up notification sent for ${user.username} in #${channel.name}`);

        } catch (error) {
            console.error('❌ Error sending level up notification:', error);
        }
    }

    // Create level up embed
    createLevelUpEmbed(user, oldLevel, newLevel, totalXP, roleReward = null) {
        try {
            const { getBountyForLevel } = require('./bountySystem');
            
            const oldBounty = getBountyForLevel(oldLevel);
            const newBounty = getBountyForLevel(newLevel);

            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: '🌐 WORLD GOVERNMENT INTELLIGENCE BUREAU'
                })
                .setColor(0xFF0000)
                .setTitle('🚨 WORLD GOVERNMENT BOUNTY UPDATE 🚨')
                .setDescription(`**${user.username}** has reached a new level of infamy!`)
                .addFields({
                    name: '📊 INTELLIGENCE SUMMARY',
                    value: `\`\`\`diff\n- Subject: ${user.username}\n- Previous Bounty: ฿${oldBounty.toLocaleString()}\n- New Bounty: ฿${newBounty.toLocaleString()}\n- Level: ${oldLevel} → ${newLevel}\n- Total XP: ${totalXP.toLocaleString()}\n${roleReward ? `- Role Awarded: ${roleReward}\n` : ''}\`\`\``,
                    inline: false
                })
                .setFooter({ text: '⚓ Marine Intelligence Division • Bounty System' })
                .setTimestamp();

            return embed;
        } catch (error) {
            console.error('Error creating level up embed:', error);
            
            return new EmbedBuilder()
                .setColor('#DC143C')
                .setTitle('🚨 LEVEL UP! 🚨')
                .setDescription(`**${user.username}** leveled up from ${oldLevel} to ${newLevel}!`)
                .setThumbnail(user.displayAvatarURL({ size: 128 }))
                .setTimestamp();
        }
    }

    // Log level up
    async logLevelUp(user, guildId, oldLevel, newLevel, totalXP, roleReward, xpSource) {
        try {
            const guildSettings = global.guildSettings?.get(guildId);
            
            if (!guildSettings?.xpLogEnabled || !guildSettings?.xpLogChannel) return;

            const channel = await this.client.channels.fetch(guildSettings.xpLogChannel).catch(() => null);
            if (!channel || !channel.isTextBased()) return;

            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setAuthor({ 
                    name: '🔴 MARINE INTELLIGENCE BUREAU',
                    iconURL: user.displayAvatarURL({ size: 32 })
                })
                .setTitle('🔴 ⚠️ THREAT LEVEL INCREASED ⚠️')
                .setDescription(`\`\`\`diff\n- BOUNTY UPDATE CONFIRMED\n- SUBJECT: ${user.username} (${user.id})\n- LEVEL: ${oldLevel} → ${newLevel}\n- TOTAL XP: ${totalXP.toLocaleString()}\n- XP SOURCE: ${xpSource.toUpperCase()}\n${roleReward ? `- ROLE AWARDED: ${roleReward}\n` : ''}\`\`\``)
                .setTimestamp()
                .setFooter({ text: '⚓ Marine Intelligence Division' });

            await channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('[XP LOG] Failed to send level up log:', error);
        }
    }
}

module.exports = LevelUpManager;

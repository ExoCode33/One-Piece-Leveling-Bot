// src/commands/level.js - Fixed Marine themed version
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBountyForLevel } = require('../utils/bountySystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('View level information and stats')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to check level for')
                .setRequired(false)),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const guildId = interaction.guild.id;

            await interaction.deferReply();

            // Get XP tracker from global
            const xpTracker = global.xpTracker;
            if (!xpTracker) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ System Error')
                    .setDescription('XP Tracker not initialized. Please restart the bot.')
                    .setColor('#FF0000');
                return await interaction.editReply({ embeds: [embed] });
            }

            // Get user stats using XP tracker
            const userStats = await xpTracker.getUserStats(targetUser.id, guildId);
            
            if (!userStats) {
                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: '🌐 WORLD GOVERNMENT INTELLIGENCE BUREAU'
                    })
                    .setTitle('❌ No Intelligence Found')
                    .setDescription(`${targetUser.username} hasn't earned any bounty yet!`)
                    .setColor(0xFF0000)
                    .setTimestamp();
                
                return await interaction.editReply({ embeds: [embed] });
            }

            // Get user's rank
            const userRank = await xpTracker.getUserRank(targetUser.id, guildId);

            // Create Marine-themed embed
            const embed = await this.createMarineEmbed(targetUser, userStats, userRank);
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Level command error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setAuthor({ 
                    name: '🌐 WORLD GOVERNMENT INTELLIGENCE BUREAU'
                })
                .setTitle('❌ Intelligence Error')
                .setDescription('Failed to retrieve bounty information. Please try again later.')
                .setColor(0xFF0000)
                .setTimestamp();

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },

    async createMarineEmbed(user, userStats, userRank) {
        // Calculate progress to next level
        const currentLevelXP = userStats.total_xp - this.getXPForLevel(userStats.level);
        const nextLevelXP = this.getXPForLevel(userStats.level + 1) - this.getXPForLevel(userStats.level);
        const progressPercent = Math.min((currentLevelXP / nextLevelXP) * 100, 100);

        // Get Marine rank and bounty
        const marineRank = this.getMarineRank(userStats.level);
        const bountyAmount = getBountyForLevel(userStats.level);
        const threatLevel = this.getThreatLevel(userStats.level);

        const embed = new EmbedBuilder()
            .setAuthor({ 
                name: '🌐 WORLD GOVERNMENT INTELLIGENCE BUREAU'
            })
            .setColor(0xFF0000)
            .setDescription(`**INDIVIDUAL THREAT ASSESSMENT**\n\n\`\`\`diff\n- Subject: ${user.username}\n- Classification: ${threatLevel.classification}\n- Surveillance Priority: ${threatLevel.priority}\n- Current Threat Level: ${threatLevel.level}/10\n\`\`\``)
            .setThumbnail(user.displayAvatarURL({ size: 128 }))
            .addFields(
                {
                    name: '📊 CURRENT STATUS',
                    value: `\`\`\`diff\n- Marine Rank: ${marineRank}\n- Combat Level: ${userStats.level}\n- Server Position: #${userRank || 'Unknown'}\n- Active Bounty: ฿${bountyAmount.toLocaleString()}\n\`\`\``,
                    inline: true
                },
                {
                    name: '⚡ THREAT ANALYSIS',
                    value: `\`\`\`diff\n- Threat Level: ${threatLevel.level}/10\n- Alert Status: ${threatLevel.status}\n- Required Action: ${threatLevel.action}\n- Response Priority: ${threatLevel.priority}\n\`\`\``,
                    inline: true
                },
                {
                    name: '📈 ADVANCEMENT PROGRESS',
                    value: `\`\`\`diff\n- Current XP: ${this.formatNumber(currentLevelXP)}\n- Required XP: ${this.formatNumber(nextLevelXP)}\n- Progress: ${progressPercent.toFixed(1)}%\n- Next Rank: ${this.getMarineRank(userStats.level + 1)}\n\`\`\``,
                    inline: false
                },
                {
                    name: '📋 ACTIVITY REPORT',
                    value: `\`\`\`diff\n- Messages Transmitted: ${this.formatNumber(userStats.messages)}\n- Reactions Recorded: ${this.formatNumber(userStats.reactions)}\n- Voice Communications: ${this.formatTime(userStats.voice_time)}\n- Total Experience: ${this.formatNumber(userStats.total_xp)} XP\n\`\`\``,
                    inline: false
                },
                {
                    name: '📅 SERVICE RECORD',
                    value: `\`\`\`diff\n- Enlisted Date: ${new Date(userStats.created_at).toLocaleDateString()}\n- Last Activity: ${new Date(userStats.updated_at).toLocaleDateString()}\n- Days of Service: ${this.calculateDaysActive(userStats.created_at)}\n- Status: ACTIVE SURVEILLANCE\n\`\`\``,
                    inline: false
                }
            )
            .setFooter({ 
                text: `⚓ Marine Intelligence Division • Individual Assessment Report • Classification: ${threatLevel.classification}`
            })
            .setTimestamp();

        return embed;
    },

    getMarineRank(level) {
        const ranks = {
            0: 'Seaman Recruit',
            5: 'Seaman Apprentice',
            10: 'Seaman',
            15: 'Petty Officer 3rd Class',
            20: 'Petty Officer 2nd Class',
            25: 'Petty Officer 1st Class',
            30: 'Chief Petty Officer',
            35: 'Lieutenant',
            40: 'Lieutenant Commander',
            45: 'Commander',
            50: 'Captain'
        };

        let currentRank = ranks[0];
        for (const [minLevel, rank] of Object.entries(ranks)) {
            if (level >= parseInt(minLevel)) {
                currentRank = rank;
            } else {
                break;
            }
        }
        return currentRank;
    },

    getThreatLevel(level) {
        if (level >= 45) {
            return {
                level: 10,
                classification: 'EXTREME THREAT',
                status: 'MAXIMUM ALERT',
                action: 'Admiral deployment authorized',
                priority: 'CRITICAL'
            };
        } else if (level >= 35) {
            return {
                level: 8,
                classification: 'HIGH THREAT',
                status: 'ACTIVE MONITORING',
                action: 'Captain-level response required',
                priority: 'HIGH'
            };
        } else if (level >= 25) {
            return {
                level: 6,
                classification: 'MODERATE THREAT',
                status: 'ROUTINE SURVEILLANCE',
                action: 'Lieutenant oversight required',
                priority: 'MEDIUM'
            };
        } else if (level >= 15) {
            return {
                level: 4,
                classification: 'MINOR THREAT',
                status: 'BASIC MONITORING',
                action: 'Standard patrol coverage',
                priority: 'LOW'
            };
        } else if (level >= 5) {
            return {
                level: 2,
                classification: 'CONFIRMED CRIMINAL',
                status: 'MINIMAL SURVEILLANCE',
                action: 'Routine observation',
                priority: 'MINIMAL'
            };
        } else {
            return {
                level: 1,
                classification: 'UNDER OBSERVATION',
                status: 'TRACKING INITIATED',
                action: 'Monitor for development',
                priority: 'MINIMAL'
            };
        }
    },

    getXPForLevel(level) {
        const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
        const curve = process.env.FORMULA_CURVE || 'exponential';
        
        if (curve === 'exponential') {
            return Math.floor(100 * Math.pow(level, multiplier));
        } else if (curve === 'linear') {
            return 100 * level * multiplier;
        } else if (curve === 'logarithmic') {
            return Math.floor(100 * Math.log(level + 1) * multiplier * 10);
        }
        
        return Math.floor(100 * Math.pow(level, multiplier));
    },

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    },

    formatTime(minutes) {
        if (!minutes) return '0 minutes';
        
        if (minutes >= 1440) {
            const days = Math.floor(minutes / 1440);
            return `${days} day${days > 1 ? 's' : ''}`;
        } else if (minutes >= 60) {
            const hours = Math.floor(minutes / 60);
            return `${hours} hour${hours > 1 ? 's' : ''}`;
        }
        return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    },

    calculateDaysActive(createdAt) {
        const now = new Date();
        const created = new Date(createdAt);
        const diffTime = Math.abs(now - created);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }
};

// src/commands/level.js - Marine themed version
const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');

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

            // Get user stats from database
            const userStats = await this.getUserStats(targetUser.id, guildId);
            
            if (!userStats) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ No Intelligence Found')
                    .setDescription(`${targetUser.username} hasn't earned any bounty yet!`)
                    .setColor('#FF0000')
                    .setTimestamp();
                
                return await interaction.editReply({ embeds: [embed] });
            }

            // Get user's rank
            userStats.rank = await this.getUserRank(targetUser.id, guildId);

            // Create Marine-themed embed
            const embed = await this.createMarineEmbed(targetUser, userStats);
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Level command error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Intelligence Error')
                .setDescription('Failed to retrieve bounty information. Please try again later.')
                .setColor('#FF0000')
                .setTimestamp();

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },

    async getUserStats(userId, guildId) {
        try {
            const result = await global.db.query(
                `SELECT user_id, guild_id, total_xp, level, messages, reactions, voice_time, 
                        created_at, updated_at
                 FROM user_levels 
                 WHERE user_id = $1 AND guild_id = $2`,
                [userId, guildId]
            );
            
            if (result.rows.length === 0) {
                return null;
            }
            
            return result.rows[0];
        } catch (error) {
            console.error('Error fetching user stats:', error);
            throw error;
        }
    },

    async getUserRank(userId, guildId) {
        try {
            const result = await global.db.query(
                `SELECT COUNT(*) + 1 as rank
                 FROM user_levels 
                 WHERE guild_id = $1 AND total_xp > (
                     SELECT total_xp FROM user_levels 
                     WHERE user_id = $2 AND guild_id = $1
                 )`,
                [guildId, userId]
            );
            
            return parseInt(result.rows[0].rank);
        } catch (error) {
            console.error('Error fetching user rank:', error);
            return null;
        }
    },

    async createMarineEmbed(user, userStats) {
        // Calculate progress to next level
        const currentLevelXP = userStats.total_xp - this.getXPForLevel(userStats.level);
        const nextLevelXP = this.getXPForLevel(userStats.level + 1) - this.getXPForLevel(userStats.level);
        const progressPercent = Math.min((currentLevelXP / nextLevelXP) * 100, 100);
        
        // Create Marine progress bar
        const barLength = 20;
        const filledBars = Math.floor((progressPercent / 100) * barLength);
        const emptyBars = barLength - filledBars;
        const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

        // Get Marine rank
        const marineRank = this.getMarineRank(userStats.level);
        const bounty = this.formatBounty(userStats.total_xp);
        const threatLevel = this.getThreatLevel(userStats.level);

        const embed = new EmbedBuilder()
            .setTitle(`🚨 **MARINE INTELLIGENCE REPORT** 🚨`)
            .setDescription(`**Subject:** ${user.username}\n**Classification:** ${threatLevel.classification}`)
            .setThumbnail(user.displayAvatarURL({ size: 128 }))
            .setColor('#FF0000')
            .addFields(
                {
                    name: '🏆 Military Rank & Position',
                    value: `**Rank:** ${marineRank}\n**Level:** ${userStats.level}\n**Position:** #${userStats.rank || 'N/A'}`,
                    inline: true
                },
                {
                    name: '💰 Current Bounty Value',
                    value: `**Total Bounty:** ฿${bounty}\n**Current XP:** ${this.formatNumber(currentLevelXP)}/${this.formatNumber(nextLevelXP)}\n**Threat Level:** ${threatLevel.level}/10`,
                    inline: true
                },
                {
                    name: '📈 Advancement Progress',
                    value: `\`${progressBar}\` ${progressPercent.toFixed(1)}%\n**Next Promotion:** ${this.getMarineRank(userStats.level + 1)}`,
                    inline: false
                },
                {
                    name: '📊 Combat Statistics',
                    value: `**Messages:** ${this.formatNumber(userStats.messages)}\n**Reactions:** ${this.formatNumber(userStats.reactions)}\n**Voice Operations:** ${this.formatTime(userStats.voice_time)}`,
                    inline: true
                },
                {
                    name: '🚨 Threat Assessment',
                    value: `**Status:** ${threatLevel.status}\n**Recommendation:** ${threatLevel.action}\n**Priority:** ${threatLevel.priority}`,
                    inline: true
                },
                {
                    name: '📅 Service Record',
                    value: `**Enlisted:** ${new Date(userStats.created_at).toLocaleDateString()}\n**Last Activity:** ${new Date(userStats.updated_at).toLocaleDateString()}\n**Days Active:** ${this.calculateDaysActive(userStats.created_at)}`,
                    inline: true
                }
            )
            .setFooter({ 
                text: 'Marine Intelligence • World Government Authorized Personnel Only',
                iconURL: user.displayAvatarURL({ size: 32 })
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
            50: 'Captain',
            60: 'Commodore',
            70: 'Rear Admiral',
            80: 'Vice Admiral',
            90: 'Admiral',
            100: 'Fleet Admiral'
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
        if (level >= 90) {
            return {
                level: 10,
                classification: 'CATASTROPHIC THREAT',
                status: 'EXTREME CAUTION ADVISED',
                action: 'Deploy Admiral-class forces',
                priority: 'MAXIMUM'
            };
        } else if (level >= 70) {
            return {
                level: 8,
                classification: 'MAJOR THREAT',
                status: 'HIGH PRIORITY TARGET',
                action: 'Vice Admiral response required',
                priority: 'HIGH'
            };
        } else if (level >= 50) {
            return {
                level: 6,
                classification: 'MODERATE THREAT',
                status: 'ACTIVE MONITORING',
                action: 'Commodore oversight authorized',
                priority: 'MEDIUM'
            };
        } else if (level >= 25) {
            return {
                level: 4,
                classification: 'MINOR THREAT',
                status: 'ROUTINE SURVEILLANCE',
                action: 'Captain-level supervision',
                priority: 'LOW'
            };
        } else {
            return {
                level: 2,
                classification: 'LOW PRIORITY',
                status: 'BASIC MONITORING',
                action: 'Standard patrol coverage',
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

    formatBounty(xp) {
        const bounty = xp * 1000;
        if (bounty >= 1000000000) {
            return `${(bounty / 1000000000).toFixed(1)}B`;
        } else if (bounty >= 1000000) {
            return `${(bounty / 1000000).toFixed(1)}M`;
        } else if (bounty >= 1000) {
            return `${(bounty / 1000).toFixed(1)}K`;
        }
        return bounty.toLocaleString();
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
        if (!minutes) return 'No record';
        
        if (minutes >= 1440) {
            return Math.floor(minutes / 1440) + ' days';
        } else if (minutes >= 60) {
            return Math.floor(minutes / 60) + ' hours';
        }
        return minutes + ' minutes';
    },

    calculateDaysActive(createdAt) {
        const now = new Date();
        const created = new Date(createdAt);
        const diffTime = Math.abs(now - created);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }
};

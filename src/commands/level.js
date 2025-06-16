// src/commands/level.js - Enhanced Marine themed version with Canvas
const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { getBountyForLevel } = require('../utils/bountySystem');
const path = require('path');

// Register custom fonts
try {
    registerFont(path.join(__dirname, '../../assets/fonts/captkd.ttf'), { family: 'CaptainKiddNF' });
    registerFont(path.join(__dirname, '../../assets/fonts/Cinzel-Bold.otf'), { family: 'Cinzel' });
    registerFont(path.join(__dirname, '../../assets/fonts/Times New Normal Regular.ttf'), { family: 'TimesNewNormal' });
    console.log('[DEBUG] Level command: Successfully registered custom fonts');
} catch (error) {
    console.log('[INFO] Level command: Using system fonts');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('View level information and stats')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to check level for')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('card')
                .setDescription('Show as visual card instead of text')
                .setRequired(false)),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const showCard = interaction.options.getBoolean('card') || false;
            const guildId = interaction.guild.id;

            await interaction.deferReply();

            // Get user stats from XP tracker
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
                    .setTitle('❌ No Intelligence Found')
                    .setDescription(`${targetUser.username} hasn't earned any bounty yet!`)
                    .setColor('#FF0000')
                    .setTimestamp();
                
                return await interaction.editReply({ embeds: [embed] });
            }

            // Get user's rank
            const userRank = await xpTracker.getUserRank(targetUser.id, guildId);

            if (showCard) {
                // Create and send visual level card
                await this.sendLevelCard(interaction, targetUser, userStats, userRank);
            } else {
                // Create Marine-themed embed
                const embed = await this.createMarineEmbed(targetUser, userStats, userRank);
                await interaction.editReply({ embeds: [embed] });
            }

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

    async sendLevelCard(interaction, user, userStats, userRank) {
        try {
            // Create level card canvas
            const canvas = await this.createLevelCard(user, userStats, userRank);
            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `level_card_${user.id}.png` });
            
            // Get bounty for display
            const bountyAmount = getBountyForLevel(userStats.level);
            const threatLevel = this.getThreatLevel(userStats.level);
            
            // Create red intelligence embed
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: '🌐 WORLD GOVERNMENT INTELLIGENCE BUREAU'
                })
                .setColor(0xFF0000)
                .setDescription(`**INDIVIDUAL THREAT PROFILE**\n\n\`\`\`diff\n- Subject: ${user.username}\n- Classification: ${threatLevel.classification}\n- Current Bounty: ฿${bountyAmount.toLocaleString()}\n- Threat Level: ${threatLevel.level}/10\n- Surveillance Status: ${threatLevel.status}\n\`\`\``)
                .setImage(`attachment://level_card_${user.id}.png`)
                .setFooter({ 
                    text: `⚓ Marine Intelligence Division • Individual Profile Assessment`
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], files: [attachment] });

        } catch (error) {
            console.error('Error creating level card:', error);
            // Fallback to text embed
            const embed = await this.createMarineEmbed(user, userStats, userRank);
            await interaction.editReply({ embeds: [embed] });
        }
    },

    async createLevelCard(user, userStats, userRank) {
        const width = 800, height = 400;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Load background texture
        try {
            const scrollTexture = await loadImage(path.join(__dirname, '../../assets/scroll_texture.jpg'));
            ctx.drawImage(scrollTexture, 0, 0, width, height);
        } catch (error) {
            // Fallback gradient background
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, '#2C3E50');
            gradient.addColorStop(1, '#34495E');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
        }

        // Draw borders
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6;
        ctx.strokeRect(0, 0, width, height);
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(8, 8, width - 16, height - 16);

        // Marine Intelligence Header
        ctx.fillStyle = '#111';
        ctx.font = '24px CaptainKiddNF, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('MARINE INTELLIGENCE PROFILE', width / 2, 40);

        // User avatar
        let avatarSize = 120;
        let avatarX = 50;
        let avatarY = 80;
        
        try {
            const avatar = await loadImage(user.displayAvatarURL({ extension: 'png', size: 256 }));
            
            // Circular avatar
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
            ctx.restore();
            
            // Avatar border
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
            ctx.stroke();
        } catch (error) {
            // Placeholder avatar
            ctx.fillStyle = '#7289DA';
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '48px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('👤', avatarX + avatarSize/2, avatarY + avatarSize/2 + 16);
        }

        // User information
        const infoX = 220;
        const infoY = 80;
        
        // Username
        ctx.fillStyle = '#111';
        ctx.font = 'bold 32px CaptainKiddNF, Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(user.username.toUpperCase(), infoX, infoY);

        // Rank and Level
        const marineRank = this.getMarineRank(userStats.level);
        ctx.font = '20px Cinzel, serif';
        ctx.fillText(`${marineRank} | Level ${userStats.level}`, infoX, infoY + 35);

        // Bounty
        const bountyAmount = getBountyForLevel(userStats.level);
        ctx.font = 'bold 24px Cinzel, serif';
        ctx.fillText(`Bounty: ฿${bountyAmount.toLocaleString()}`, infoX, infoY + 65);

        // Server rank
        ctx.font = '18px TimesNewNormal, serif';
        ctx.fillText(`Server Rank: #${userRank || 'N/A'}`, infoX, infoY + 90);

        // Progress bar
        const currentLevelXP = userStats.total_xp - this.getXPForLevel(userStats.level);
        const nextLevelXP = this.getXPForLevel(userStats.level + 1) - this.getXPForLevel(userStats.level);
        const progress = Math.min(currentLevelXP / nextLevelXP, 1);

        const barX = infoX;
        const barY = infoY + 120;
        const barWidth = 350;
        const barHeight = 20;

        // Progress bar background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Progress bar fill
        if (progress > 0) {
            const gradient = ctx.createLinearGradient(barX, barY, barX + barWidth * progress, barY);
            gradient.addColorStop(0, '#FF0000');
            gradient.addColorStop(1, '#FF6B6B');
            ctx.fillStyle = gradient;
            ctx.fillRect(barX, barY, barWidth * progress, barHeight);
        }

        // Progress text
        ctx.fillStyle = '#111';
        ctx.font = '14px TimesNewNormal, serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${this.formatNumber(currentLevelXP)} / ${this.formatNumber(nextLevelXP)} XP (${(progress * 100).toFixed(1)}%)`, 
                     barX + barWidth/2, barY + barHeight/2 + 5);

        // Stats section
        const statsY = 280;
        const statsSpacing = 130;
        
        ctx.font = '16px TimesNewNormal, serif';
        ctx.textAlign = 'center';
        
        // Messages
        ctx.fillStyle = '#111';
        ctx.fillText('MESSAGES', 100, statsY);
        ctx.font = 'bold 20px Cinzel, serif';
        ctx.fillText(this.formatNumber(userStats.messages), 100, statsY + 25);

        // Reactions  
        ctx.font = '16px TimesNewNormal, serif';
        ctx.fillText('REACTIONS', 230, statsY);
        ctx.font = 'bold 20px Cinzel, serif';
        ctx.fillText(this.formatNumber(userStats.reactions), 230, statsY + 25);

        // Voice Time
        ctx.font = '16px TimesNewNormal, serif';
        ctx.fillText('VOICE TIME', 360, statsY);
        ctx.font = 'bold 20px Cinzel, serif';
        ctx.fillText(this.formatTime(userStats.voice_time), 360, statsY + 25);

        // Total XP
        ctx.font = '16px TimesNewNormal, serif';
        ctx.fillText('TOTAL XP', 490, statsY);
        ctx.font = 'bold 20px Cinzel, serif';
        ctx.fillText(this.formatNumber(userStats.total_xp), 490, statsY + 25);

        // Threat level indicator
        const threatLevel = this.getThreatLevel(userStats.level);
        ctx.font = '14px TimesNewNormal, serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = this.getThreatColor(threatLevel.level);
        ctx.fillText(`THREAT LEVEL: ${threatLevel.level}/10`, width - 30, height - 30);

        // Marine stamp
        ctx.font = '12px TimesNewNormal, serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#111';
        ctx.fillText('M A R I N E', width - 30, height - 10);

        return canvas;
    },

    async createMarineEmbed(user, userStats, userRank) {
        // Calculate progress to next level
        const currentLevelXP = userStats.total_xp - this.getXPForLevel(userStats.level);
        const nextLevelXP = this.getXPForLevel(userStats.level + 1) - this.getXPForLevel(userStats.level);
        const progressPercent = Math.min((currentLevelXP / nextLevelXP) * 100, 100);
        
        // Create Marine progress bar
        const barLength = 20;
        const filledBars = Math.floor((progressPercent / 100) * barLength);
        const emptyBars = barLength - filledBars;
        const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

        // Get Marine rank and bounty
        const marineRank = this.getMarineRank(userStats.level);
        const bountyAmount = getBountyForLevel(userStats.level);
        const threatLevel = this.getThreatLevel(userStats.level);

        const embed = new EmbedBuilder()
            .setAuthor({ 
                name: '🌐 WORLD GOVERNMENT INTELLIGENCE BUREAU'
            })
            .setColor(0xFF0000)
            .setDescription(`**INDIVIDUAL THREAT ASSESSMENT**\n\n\`\`\`diff\n- Subject: ${user.username}\n- Classification: ${threatLevel.classification}\n- Surveillance Priority: ${threatLevel.priority}\n\`\`\``)
            .setThumbnail(user.displayAvatarURL({ size: 128 }))
            .addFields(
                {
                    name: '📊 CURRENT STATUS',
                    value: `\`\`\`diff\n- Rank: ${marineRank}\n- Level: ${userStats.level}\n- Server Position: #${userRank || 'N/A'}\n- Bounty: ฿${bountyAmount.toLocaleString()}\n\`\`\``,
                    inline: true
                },
                {
                    name: '⚡ THREAT ANALYSIS',
                    value: `\`\`\`diff\n- Threat Level: ${threatLevel.level}/10\n- Status: ${threatLevel.status}\n- Action Required: ${threatLevel.action}\n- Priority: ${threatLevel.priority}\n\`\`\``,
                    inline: true
                },
                {
                    name: '📈 ADVANCEMENT PROGRESS',
                    value: `\`${progressBar}\` ${progressPercent.toFixed(1)}%\n**XP:** ${this.formatNumber(currentLevelXP)}/${this.formatNumber(nextLevelXP)}\n**Next Rank:** ${this.getMarineRank(userStats.level + 1)}`,
                    inline: false
                },
                {
                    name: '📋 ACTIVITY REPORT',
                    value: `\`\`\`diff\n- Messages Sent: ${this.formatNumber(userStats.messages)}\n- Reactions Given: ${this.formatNumber(userStats.reactions)}\n- Voice Operations: ${this.formatTime(userStats.voice_time)}\n- Total Experience: ${this.formatNumber(userStats.total_xp)}\n\`\`\``,
                    inline: false
                },
                {
                    name: '📅 SERVICE RECORD',
                    value: `\`\`\`diff\n- Enlisted: ${new Date(userStats.created_at).toLocaleDateString()}\n- Last Activity: ${new Date(userStats.updated_at).toLocaleDateString()}\n- Days Active: ${this.calculateDaysActive(userStats.created_at)}\n\`\`\``,
                    inline: false
                }
            )
            .setFooter({ 
                text: `⚓ Marine Intelligence Division • Individual Assessment Report`
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
                action: 'Captain-level response',
                priority: 'HIGH'
            };
        } else if (level >= 25) {
            return {
                level: 6,
                classification: 'MODERATE THREAT',
                status: 'ROUTINE SURVEILLANCE',
                action: 'Lieutenant oversight',
                priority: 'MEDIUM'
            };
        } else if (level >= 15) {
            return {
                level: 4,
                classification: 'MINOR THREAT',
                status: 'BASIC MONITORING',
                action: 'Standard patrol',
                priority: 'LOW'
            };
        } else {
            return {
                level: 2,
                classification: 'LOW PRIORITY',
                status: 'MINIMAL SURVEILLANCE',
                action: 'Routine observation',
                priority: 'MINIMAL'
            };
        }
    },

    getThreatColor(threatLevel) {
        if (threatLevel >= 9) return '#FF0000';
        if (threatLevel >= 7) return '#FF4500';
        if (threatLevel >= 5) return '#FF8C00';
        if (threatLevel >= 3) return '#FFA500';
        return '#FFD700';
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
        if (!minutes) return '0m';
        
        if (minutes >= 1440) {
            return Math.floor(minutes / 1440) + 'd';
        } else if (minutes >= 60) {
            return Math.floor(minutes / 60) + 'h';
        }
        return minutes + 'm';
    },

    calculateDaysActive(createdAt) {
        const now = new Date();
        const created = new Date(createdAt);
        const diffTime = Math.abs(now - created);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }
};

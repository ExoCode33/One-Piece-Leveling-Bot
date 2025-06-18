// src/utils/xpTracker.js - Add these methods INSIDE your XPTracker class

const { createCanvas, loadImage, registerFont } = require('canvas');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { Pool } = require('pg');

class XPTracker {
    constructor() {
        // Your existing constructor code...
    }

    // Your existing methods (addXP, getUserXP, etc.)...

    // ADD THESE METHODS INSIDE THE CLASS:

    async sendMarineLevelUp(levelUpData) {
        try {
            const { userId, guildId, oldLevel, newLevel, totalXP, member, channel } = levelUpData;

            // Calculate bounties
            const oldBounty = this.getBountyForLevel(oldLevel);
            const newBounty = this.getBountyForLevel(newLevel);
            const bountyIncrease = newBounty - oldBounty;

            // Get user data for activity stats
            const userData = await this.getUserXP(userId, guildId);
            
            // Create wanted poster canvas
            const canvas = await this.createLevelUpPoster({
                userId: userId,
                level: newLevel,
                oldLevel: oldLevel,
                total_xp: totalXP,
                messages: userData.messages || 0,
                reactions: userData.reactions || 0,
                voice_time: userData.voice_time || 0,
                member: member
            });

            const attachment = new AttachmentBuilder(canvas.toBuffer(), { 
                name: `bounty-update-${userId}.png` 
            });

            // Get threat classifications
            const oldThreat = this.getThreatLevelName(oldLevel);
            const newThreat = this.getThreatLevelName(newLevel);
            const threatUpgrade = oldThreat !== newThreat;

            // Special classifications
            const isPirateKing = newLevel >= 200;
            const isEmperor = newLevel >= 150 && newLevel < 200;
            const isWarlord = newLevel >= 100 && newLevel < 150;

            // Territory progression
            const getTerritory = (level) => {
                if (level >= 200) return "📍 **New World - Raftel**";
                if (level >= 150) return "📍 **New World - Yonko Territory**";
                if (level >= 100) return "📍 **New World - Paradise**";
                if (level >= 50) return "📍 **Grand Line**";
                if (level >= 25) return "📍 **Paradise**";
                return "📍 **East Blue**";
            };

            // Create Marine Intelligence embed
            const embed = new EmbedBuilder()
                .setColor('#DC143C')
                .setTitle('🚨 WORLD GOVERNMENT BOUNTY UPDATE 🚨')
                .setDescription(`**MARINE INTELLIGENCE BUREAU**\n*Classified Report - Level ${newLevel} Threat*`)
                .addFields([
                    {
                        name: '👤 SUBJECT IDENTIFICATION',
                        value: `**Name:** ${member.displayName}\n**Previous Classification:** Level ${oldLevel} ${oldThreat}\n**New Classification:** Level ${newLevel} ${newThreat}`,
                        inline: false
                    },
                    {
                        name: '💰 BOUNTY ASSESSMENT',
                        value: `**Previous Bounty:** ${oldBounty.toLocaleString()} Berries\n**New Bounty:** ${newBounty.toLocaleString()} Berries\n**Increase:** +${bountyIncrease.toLocaleString()} Berries`,
                        inline: true
                    },
                    {
                        name: '📊 INTELLIGENCE SUMMARY',
                        value: `**Activity Assessment:** ${this.getActivityLevel(userData)}\n**Territory:** ${getTerritory(newLevel)}\n**Threat Level:** ${threatUpgrade ? `⬆️ UPGRADED` : '📊 Maintained'}`,
                        inline: true
                    }
                ])
                .setImage('attachment://bounty-update-' + userId + '.png')
                .setTimestamp()
                .setFooter({ 
                    text: '⚓ World Government Marine Intelligence Division'
                });

            // Add special classifications
            if (isPirateKing) {
                embed.addFields([{
                    name: '👑 SPECIAL CLASSIFICATION',
                    value: '**🏴‍☠️ PIRATE KING DETECTED 🏴‍☠️**\n*Highest threat level achieved. All marines advised to exercise extreme caution.*',
                    inline: false
                }]);
            } else if (isEmperor) {
                embed.addFields([{
                    name: '⚡ EMPEROR STATUS',
                    value: '**🔥 YONKO-LEVEL THREAT 🔥**\n*Subject has achieved Emperor-class power level. Fleet Admiral notified.*',
                    inline: false
                }]);
            } else if (isWarlord) {
                embed.addFields([{
                    name: '⚔️ WARLORD STATUS',
                    value: '**🏴‍☠️ SHICHIBUKAI-LEVEL THREAT 🏴‍☠️**\n*Subject qualifies for Warlord consideration. Monitoring increased.*',
                    inline: false
                }]);
            }

            // Add threat upgrade message
            if (threatUpgrade) {
                embed.addFields([{
                    name: '🔺 THREAT ESCALATION',
                    value: `**Classification upgraded from ${oldThreat} to ${newThreat}**\n*All Marine units in the area have been notified of the threat level increase.*`,
                    inline: false
                }]);
            }

            // Send the level-up message
            await channel.send({
                content: `🚨 **MARINE HQ ALERT** 🚨\n${member} has been reclassified as a **Level ${newLevel}** threat!`,
                embeds: [embed],
                files: [attachment]
            });

            // Handle role rewards if method exists
            if (this.handleRoleRewards) {
                await this.handleRoleRewards(member, newLevel);
            }

        } catch (error) {
            console.error('Error sending Marine level-up:', error);
        }
    }

    async createLevelUpPoster(wantedPosterData) {
        const canvas = createCanvas(800, 1000);
        const ctx = canvas.getContext('2d');

        try {
            // Fallback gradient background (no external image dependency)
            const gradient = ctx.createLinearGradient(0, 0, 0, 1000);
            gradient.addColorStop(0, '#F4E4BC');
            gradient.addColorStop(0.5, '#E8D5A3');
            gradient.addColorStop(1, '#D4C18A');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 800, 1000);

            // Border
            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth = 15;
            ctx.strokeRect(15, 15, 770, 970);

            // Inner border
            ctx.strokeStyle = '#A0522D';
            ctx.lineWidth = 8;
            ctx.strokeRect(25, 25, 750, 950);

            // Title - "BOUNTY UPDATE"
            ctx.font = 'bold 48px Arial';
            ctx.fillStyle = '#8B0000';
            ctx.textAlign = 'center';
            ctx.fillText('BOUNTY UPDATE', 400, 80);

            // Level progression
            ctx.font = 'bold 32px Arial';
            ctx.fillStyle = '#2F4F4F';
            ctx.fillText(`LEVEL ${wantedPosterData.oldLevel} → ${wantedPosterData.level}`, 400, 130);

            // User avatar
            try {
                const avatar = await loadImage(wantedPosterData.member.displayAvatarURL({ extension: 'png', size: 256 }));
                
                // Create circular mask
                ctx.save();
                ctx.beginPath();
                ctx.arc(400, 320, 120, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(avatar, 280, 200, 240, 240);
                ctx.restore();

                // Avatar border
                ctx.strokeStyle = '#8B0000';
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.arc(400, 320, 120, 0, Math.PI * 2);
                ctx.stroke();
            } catch (error) {
                console.error('Error loading avatar:', error);
                // Fallback placeholder
                ctx.fillStyle = '#DDD';
                ctx.beginPath();
                ctx.arc(400, 320, 120, 0, Math.PI * 2);
                ctx.fill();
            }

            // Name
            ctx.font = 'bold 36px Arial';
            ctx.fillStyle = '#000';
            ctx.textAlign = 'center';
            ctx.fillText(wantedPosterData.member.displayName.toUpperCase(), 400, 490);

            // "LEVEL UP!" instead of "DEAD OR ALIVE"
            ctx.font = 'bold 42px Arial';
            ctx.fillStyle = '#8B0000';
            ctx.fillText('LEVEL UP!', 400, 540);

            // Bounty amount
            const bounty = this.getBountyForLevel(wantedPosterData.level);
            ctx.font = 'bold 48px Arial';
            ctx.fillStyle = '#FF6B35';
            ctx.fillText(`${bounty.toLocaleString()}`, 400, 620);

            // Berry symbol
            ctx.font = 'bold 36px Arial';
            ctx.fillStyle = '#FF8C00';
            ctx.fillText('BERRIES', 400, 670);

            // Stats section
            ctx.font = 'bold 24px Arial';
            ctx.fillStyle = '#2F4F4F';
            ctx.textAlign = 'left';
            
            const stats = [
                `Messages: ${wantedPosterData.messages}`,
                `Reactions: ${wantedPosterData.reactions}`,
                `Voice: ${Math.floor(wantedPosterData.voice_time / 60)}min`
            ];

            stats.forEach((stat, index) => {
                ctx.fillText(stat, 100, 750 + (index * 35));
            });

            // Threat level
            ctx.font = 'bold 28px Arial';
            ctx.fillStyle = '#8B0000';
            ctx.textAlign = 'center';
            ctx.fillText(`THREAT: ${this.getThreatLevelName(wantedPosterData.level)}`, 400, 880);

            // Marine watermark
            ctx.font = 'bold 20px Arial';
            ctx.fillStyle = 'rgba(139, 0, 0, 0.3)';
            ctx.textAlign = 'center';
            ctx.fillText('MARINE', 400, 940);

            return canvas;
        } catch (error) {
            console.error('Canvas error:', error);
            // Return a simple fallback canvas
            ctx.fillStyle = '#F4E4BC';
            ctx.fillRect(0, 0, 800, 1000);
            ctx.fillStyle = '#000';
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('LEVEL UP!', 400, 400);
            ctx.fillText(`Level ${wantedPosterData.level}`, 400, 500);
            return canvas;
        }
    }

    getBountyForLevel(level) {
        if (level >= 200) return 5000000000; // Pirate King
        if (level >= 150) return 3000000000; // Emperor
        if (level >= 100) return 1000000000; // Warlord
        if (level >= 75) return 500000000;   // Supernova
        if (level >= 50) return 100000000;   // Notorious
        if (level >= 25) return 50000000;    // Wanted
        if (level >= 10) return 10000000;    // Known
        return level * 1000000; // Base bounty
    }

    getThreatLevelName(level) {
        if (level >= 200) return "PIRATE KING";
        if (level >= 150) return "EMPEROR";
        if (level >= 100) return "WARLORD";
        if (level >= 75) return "SUPERNOVA";
        if (level >= 50) return "NOTORIOUS";
        if (level >= 25) return "WANTED";
        if (level >= 10) return "KNOWN";
        return "ROOKIE";
    }

    getActivityLevel(userData) {
        const totalActivity = (userData.messages || 0) + (userData.reactions || 0) + Math.floor((userData.voice_time || 0) / 60);
        
        if (totalActivity >= 5000) return "Extremely Active";
        if (totalActivity >= 2000) return "Highly Active";
        if (totalActivity >= 1000) return "Very Active";
        if (totalActivity >= 500) return "Active";
        if (totalActivity >= 100) return "Moderately Active";
        return "Low Activity";
    }

    // Your existing methods continue here...
}

module.exports = XPTracker;

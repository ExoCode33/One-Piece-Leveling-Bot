// src/commands/leaderboard.js - Enhanced One Piece Themed Leaderboard

const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getBountyForLevel, PIRATE_KING_BOUNTY } = require('../utils/bountySystem');
const Canvas = require('canvas');
const path = require('path');

const LEADERBOARD_EXCLUDE_ROLE = process.env.LEADERBOARD_EXCLUDE_ROLE; // Role ID for Pirate King

function pirateRankEmoji(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '🏴‍☠️';
}

// Threat levels based on level from bountySystem.js
function getThreatLevel(level) {
    const threatLevels = {
        0: "New individual detected. No criminal activity reported.",
        5: "Criminal activity confirmed in East Blue region.",
        10: "Multiple incidents involving Marine personnel.",
        15: "Subject has crossed into Grand Line territory.",
        20: "Dangerous individual. Multiple Marine casualties reported.",
        25: "HIGH PRIORITY TARGET: Classified as extremely dangerous.",
        30: "ADVANCED COMBATANT: Confirmed use of advanced fighting techniques.",
        35: "TERRITORIAL THREAT: Capable of commanding large operations.",
        40: "ELITE LEVEL THREAT: Extreme danger to Marine operations.",
        45: "EXTRAORDINARY ABILITIES: Unprecedented power levels detected.",
        50: "EMPEROR CLASS THREAT: Controls vast territories."
    };

    // Find the appropriate threat level based on user's level
    let applicableLevel = 0;
    for (let threatLevel of Object.keys(threatLevels).map(Number).sort((a, b) => b - a)) {
        if (level >= threatLevel) {
            applicableLevel = threatLevel;
            break;
        }
    }
    
    return threatLevels[applicableLevel];
}

function getThreatLevelShort(level) {
    if (level >= 50) return 'EMPEROR CLASS';
    if (level >= 45) return 'EXTRAORDINARY';
    if (level >= 40) return 'ELITE THREAT';
    if (level >= 35) return 'TERRITORIAL';
    if (level >= 30) return 'ADVANCED COMBATANT';
    if (level >= 25) return 'HIGH PRIORITY';
    if (level >= 20) return 'DANGEROUS';
    if (level >= 15) return 'GRAND LINE';
    if (level >= 10) return 'MARINE THREAT';
    if (level >= 5) return 'EAST BLUE';
    return 'MONITORING';
}

// Function to create wanted poster with profile picture
async function createWantedPoster(user, rank, bounty, threatLevel, guild) {
    try {
        const canvas = Canvas.createCanvas(400, 500);
        const ctx = canvas.getContext('2d');

        // Background (parchment/wanted poster style)
        ctx.fillStyle = '#F4E4BC';
        ctx.fillRect(0, 0, 400, 500);

        // Red border
        ctx.strokeStyle = '#DC143C';
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, 392, 492);

        // Inner border
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 20, 360, 460);

        // WANTED text
        ctx.fillStyle = '#8B0000';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('WANTED', 200, 60);

        // Dead or Alive
        ctx.font = 'bold 16px Arial';
        ctx.fillText('DEAD OR ALIVE', 200, 85);

        // Get user avatar
        let member;
        try {
            member = await guild.members.fetch(user.userId);
        } catch (err) {
            member = null;
        }

        if (member) {
            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            const avatar = await Canvas.loadImage(avatarURL);
            
            // Draw circular avatar
            ctx.save();
            ctx.beginPath();
            ctx.arc(200, 200, 80, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, 120, 120, 160, 160);
            ctx.restore();

            // Avatar border
            ctx.strokeStyle = '#8B0000';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(200, 200, 80, 0, Math.PI * 2, true);
            ctx.stroke();
        }

        // Pirate name
        const displayName = member ? member.displayName : `User ${user.userId}`;
        ctx.fillStyle = '#000';
        ctx.font = 'bold 24px Arial';
        ctx.fillText(displayName.toUpperCase(), 200, 320);

        // Bounty
        ctx.fillStyle = '#8B0000';
        ctx.font = 'bold 32px Arial';
        ctx.fillText(`฿${bounty.toLocaleString()}`, 200, 360);

        // Threat level
        ctx.fillStyle = '#000';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(threatLevel, 200, 390);

        // Level and XP
        ctx.font = '14px Arial';
        ctx.fillText(`Level ${user.level} • ${user.xp} XP`, 200, 420);

        // Rank badge
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(350, 50, 25, 0, Math.PI * 2, true);
        ctx.fill();
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = '#8B0000';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(`#${rank}`, 350, 55);

        return canvas.toBuffer();
    } catch (error) {
        console.error('Error creating wanted poster:', error);
        return null;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the most notorious pirates!')
        .addStringOption(option =>
            option.setName('view')
                .setDescription('Leaderboard type')
                .setRequired(false)
                .addChoices(
                    { name: 'Top 3', value: 'short' },
                    { name: 'Top 10', value: 'long' },
                    { name: 'Full Leaderboard', value: 'full' }
                )
        ),
    async execute(interaction, client, xpTracker) {
        // Check if this is a button interaction (deferred) or initial command
        const isButtonInteraction = interaction.deferred;
        
        // Multiple ways to get guild information
        let guild = interaction.guild;
        let guildId = interaction.guildId;
        
        // If interaction.guild is undefined, try to fetch it
        if (!guild && guildId) {
            try {
                guild = await client.guilds.fetch(guildId);
            } catch (err) {
                console.error('Failed to fetch guild:', err);
            }
        }
        
        // If still no guild, check if this is a DM
        if (!guild || !guildId) {
            console.log('Command used outside of guild context:', {
                hasGuild: !!guild,
                guildId: guildId,
                channelType: interaction.channel?.type
            });
            const errorMessage = "This command can only be used in a server, not in DMs.";
            return isButtonInteraction 
                ? interaction.editReply({ content: errorMessage })
                : interaction.reply({ content: errorMessage, ephemeral: true });
        }

        const view = interaction.options.getString('view') || 'short';

        // Fetch all users from database
        let leaderboard;
        try {
            leaderboard = await xpTracker.getLeaderboard(guildId);
        } catch (err) {
            console.error('Database error in leaderboard:', err);
            const errorMessage = "Database error occurred. Please try again later.";
            return isButtonInteraction 
                ? interaction.editReply({ content: errorMessage })
                : interaction.reply({ content: errorMessage, ephemeral: true });
        }

        // Check if leaderboard data exists
        if (!leaderboard || !Array.isArray(leaderboard)) {
            console.error('Invalid leaderboard data:', leaderboard);
            const errorMessage = "No leaderboard data available.";
            return isButtonInteraction 
                ? interaction.editReply({ content: errorMessage })
                : interaction.reply({ content: errorMessage, ephemeral: true });
        }

        // Pirate King detection (fully error proof)
        let pirateKingUser = null;
        let members = null;
        if (LEADERBOARD_EXCLUDE_ROLE) {
            try {
                members = await guild.members.fetch();
                if (members && members.size) {
                    const king = members.find(m => m.roles.cache.has(LEADERBOARD_EXCLUDE_ROLE));
                    if (king && king.user && king.user.id) {
                        pirateKingUser = leaderboard.find(u => u.userId === king.user.id);
                        leaderboard = leaderboard.filter(u => u.userId !== king.user.id);
                    }
                }
            } catch (err) {
                pirateKingUser = null; // Explicitly no pirate king if error
            }
        }

        // Sort leaderboard safely
        leaderboard = leaderboard.filter(user => user && typeof user.xp === 'number');
        leaderboard.sort((a, b) => b.xp - a.xp);

        // Create buttons
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('leaderboard_short_1_xp')
                .setLabel('Top 3')
                .setStyle(view === 'short' ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('leaderboard_long_1_xp')
                .setLabel('Top 10')
                .setStyle(view === 'long' ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('leaderboard_full_1_xp')
                .setLabel('Full Leaderboard')
                .setStyle(view === 'full' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        );

        if (view === 'full') {
            // Full view: Display list without embed
            let text = '🏴‍☠️ **FULL PIRATE LEADERBOARD** 🏴‍☠️\n\n';
            let rank = 1;

            if (pirateKingUser) {
                text += `👑 **PIRATE KING**: <@${pirateKingUser.userId}> - Level ${pirateKingUser.level} - ฿${PIRATE_KING_BOUNTY.toLocaleString()}\n\n`;
            }

            for (const user of leaderboard) {
                const bounty = getBountyForLevel(user.level);
                text += `${pirateRankEmoji(rank)} **${rank}.** <@${user.userId}> — Level **${user.level}** — ฿**${bounty.toLocaleString()}**\n`;
                rank++;
            }

            if (leaderboard.length === 0) {
                text += "No pirates have earned any bounty yet! Be the first to make your mark on the seas.";
            }
            
            // Truncate if too long
            const finalText = text.length > 1900 ? text.slice(0, 1900) + '\n... (truncated)' : text;
            
            // Return ONLY content and components for full view - NO EMBEDS
            const responseData = { 
                content: finalText, 
                components: [row],
                embeds: [] // Explicitly clear embeds
            };
            
            return isButtonInteraction 
                ? interaction.editReply(responseData)
                : interaction.reply(responseData);
                
        } else {
            // Short/Long view: Display embed ONLY
            let entriesToShow = [];
            if (view === 'short') {
                entriesToShow = leaderboard.slice(0, 3);
            } else if (view === 'long') {
                entriesToShow = leaderboard.slice(0, 10);
            }

            // Create the newspaper-style embed with RED theme
            const embed = new EmbedBuilder()
                .setColor(0xDC143C) // Crimson red color
                .setThumbnail('https://i.imgur.com/YourOnePieceLogo.png'); // Optional: Add One Piece logo

            let description = '';

            // Header with skull and crossbones
            description += '💀 **WORLD GOVERNMENT BOUNTY BULLETIN** 💀\n\n';
            description += '```ansi\n';
            description += '\u001b[31m┌─────────────────────────────────────┐\n';
            description += '│     🚨 URGENT BOUNTY ALERT 🚨     │\n';
            description += '│    EXTREMELY DANGEROUS PIRATES     │\n';
            description += '│        APPROACH WITH CAUTION       │\n';
            description += '└─────────────────────────────────────┘\u001b[0m\n';
            description += '```\n\n';

            // Enhanced TOP THREATS section with red styling
            description += '```ansi\n';
            description += '\u001b[31m═══════ 🔥 TOP THREATS 🔥 ═══════\u001b[0m\n';
            description += '```\n\n';

            let rank = 1;
            for (const user of entriesToShow) {
                let member = null;
                let memberName = null;
                
                try {
                    member = await guild.members.fetch(user.userId).catch(() => null);
                    memberName = member ? member.displayName : `User_${user.userId}`;
                } catch (err) {
                    memberName = `User_${user.userId}`;
                }

                const bounty = getBountyForLevel(user.level);
                const threatLevel = getThreatLevelShort(user.level);
                const fullThreat = getThreatLevel(user.level);

                // Compact wanted poster
                description += `${pirateRankEmoji(rank)} **[RANK ${rank}]** <@${user.userId}>\n`;
                description += '```ansi\n';
                description += `\u001b[31m┌────── WANTED ──────┐\n`;
                description += `│ ${memberName.toUpperCase().padEnd(17)} │\n`;
                description += `│                    │\n`;
                description += `│      [PHOTO]       │\n`;
                description += `│       WANTED       │\n`;
                description += `│                    │\n`;
                description += `│ ฿${bounty.toLocaleString().padEnd(15)} │\n`;
                description += `│ ${threatLevel.padEnd(17)} │\n`;
                description += `└────────────────────┘\u001b[0m\n`;
                description += '```';
                
                // Compact info below
                description += `⚔️ **Lv.${user.level}** • ⭐ **${user.xp}** • 🚨 *${fullThreat}*\n\n`;

                rank++;
            }

            // Show remaining count
            if (view === 'short' && leaderboard.length > 3) {
                const remaining = leaderboard.length - 3;
                description += `\n🏴‍☠️ *... and ${remaining} more notorious pirates roaming the seas...*\n\n`;
            } else if (view === 'long' && leaderboard.length > 10) {
                const remaining = leaderboard.length - 10;
                description += `\n🏴‍☠️ *... and ${remaining} more notorious pirates roaming the seas...*\n\n`;
            }

            // Enhanced footer
            description += '```ansi\n';
            description += '\u001b[31m┌─────────────────────────────────┐\n';
            description += '│  ⚠️  REPORT SIGHTINGS NOW  ⚠️   │\n';
            description += '│   USE /leaderboard FOR MORE    │\n';
            description += '└─────────────────────────────────┘\u001b[0m\n';
            description += '```\n';

            const currentTime = new Date().toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
            });
            
            description += `🌊 **MARINE HQ** • ${currentTime} • **JUSTICE PREVAILS** 🦅`;

            embed.setDescription(description);
            
            // Add footer with World Government seal
            embed.setFooter({ 
                text: 'World Government • Marine HQ',
                iconURL: 'https://i.imgur.com/YourMarineIcon.png' // Optional: Add Marine logo
            });

            // Add timestamp
            embed.setTimestamp();

            // Return ONLY embeds and components for short/long view - NO CONTENT
            const responseData = { 
                content: '', // Explicitly clear content
                embeds: [embed], 
                components: [row] 
            };
            
            return isButtonInteraction 
                ? interaction.editReply(responseData)
                : interaction.reply(responseData);
        }
    }
};

// src/commands/leaderboard.js - One Piece Themed Leaderboard

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBountyForLevel, PIRATE_KING_BOUNTY } = require('../utils/bountySystem');

const LEADERBOARD_EXCLUDE_ROLE = process.env.LEADERBOARD_EXCLUDE_ROLE; // Role ID for Pirate King

function pirateRankEmoji(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '🏴‍☠️';
}

function getThreatLevel(rank) {
    if (rank === 1) return 'EXTREMELY DANGEROUS';
    if (rank === 2) return 'HIGHLY DANGEROUS';
    if (rank === 3) return 'VERY DANGEROUS';
    return 'DANGEROUS';
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

            // Create the newspaper-style embed
            const embed = new EmbedBuilder()
                .setColor(0x2f3136); // Dark color to match screenshot

            let description = '';

            // Header
            description += '📰 **WORLD ECONOMIC NEWS PAPER** 📰\n\n';
            description += '```\n';
            description += '┌─────────────────────────────────────┐\n';
            description += '│     URGENT BOUNTY BULLETIN         │\n';
            description += '│    TOP CRIMINALS IDENTIFIED        │\n';
            description += '└─────────────────────────────────────┘\n';
            description += '```\n\n';

            // Top Threats section
            description += '━━━━━━━━ 🔥 **TOP THREATS** 🔥 ━━━━━━━━\n\n';

            let rank = 1;
            for (const user of entriesToShow) {
                let memberName = null;
                try {
                    const member = await guild.members.fetch(user.userId).catch(() => null);
                    memberName = member ? member.displayName.toUpperCase() : `UNKNOWN_PIRATE_${user.userId}`;
                } catch (err) {
                    memberName = `UNKNOWN_PIRATE_${user.userId}`;
                }

                const bounty = getBountyForLevel(user.level);
                const threatLevel = getThreatLevel(rank);

                description += '```\n';
                description += `[RANK ${rank}] ${memberName}\n`;
                description += `BOUNTY: ฿${bounty.toLocaleString()}\n`;
                description += `THREAT: ${threatLevel}\n`;
                description += '```\n';

                // Add level and rep info below each wanted poster
                description += `🏴‍☠️ ⚔️ Level ${user.level} | ⭐ ${user.xp} Rep\n\n`;

                rank++;
            }

            // Show remaining count for short view
            if (view === 'short' && leaderboard.length > 3) {
                const remaining = leaderboard.length - 3;
                description += `*... and ${remaining} more dangerous pirates*\n\n`;
            } else if (view === 'long' && leaderboard.length > 10) {
                const remaining = leaderboard.length - 10;
                description += `*... and ${remaining} more dangerous pirates*\n\n`;
            }

            // Footer
            description += '```\n';
            description += '┌─────────────────────────────────────┐\n';
            description += '│  USE /leaderboard FOR FULL LIST    │\n';
            description += '│     STAY VIGILANT, STAY SAFE       │\n';
            description += '└─────────────────────────────────────┘\n';
            description += '```\n';

            const currentTime = new Date().toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
            });
            description += `⚠️ **WORLD GOVERNMENT URGENT BULLETIN** ⚠️ • **TOP THREATS ONLY** • Today at ${currentTime}`;

            embed.setDescription(description);

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

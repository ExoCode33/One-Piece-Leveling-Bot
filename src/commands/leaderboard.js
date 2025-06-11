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
        const guild = interaction.guild;
        const view = interaction.options.getString('view') || 'short';

        // Check if guild exists
        if (!guild || !guild.id) {
            console.error('Guild is undefined or missing ID:', guild);
            return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
        }

        // Fetch all users from database
        let leaderboard;
        try {
            leaderboard = await xpTracker.getLeaderboard(guild.id);
        } catch (err) {
            console.error('Database error in leaderboard:', err);
            return interaction.reply({ content: "Database error occurred. Please try again later.", ephemeral: true });
        }

        // Check if leaderboard data exists
        if (!leaderboard || !Array.isArray(leaderboard)) {
            console.error('Invalid leaderboard data:', leaderboard);
            return interaction.reply({ content: "No leaderboard data available.", ephemeral: true });
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

        let entriesToShow = [];
        if (view === 'short') {
            entriesToShow = leaderboard.slice(0, 3);
        } else if (view === 'long') {
            entriesToShow = leaderboard.slice(0, 10);
        } else {
            // Full view, display all in plaintext (not embed)
            let text = '';
            let rank = 1;

            if (pirateKingUser) {
                text += `👑 **PIRATE KING**: <@${pirateKingUser.userId}> - ฿${PIRATE_KING_BOUNTY.toLocaleString()}\n\n`;
            }

            for (const user of leaderboard) {
                text += `${pirateRankEmoji(rank)} ${rank}. <@${user.userId}> — Level ${user.level} — ฿${getBountyForLevel(user.level).toLocaleString()}\n`;
                rank++;
            }

            if (text.length === 0) text = "No pirates have earned any bounty yet! Be the first to make your mark on the seas.";
            return interaction.reply({ content: text.length > 1900 ? text.slice(0, 1900) + '\n... (truncated)' : text });
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

        await interaction.reply({ embeds: [embed], components: [row] });
    }
};

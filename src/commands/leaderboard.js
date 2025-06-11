// src/commands/leaderboard.js - One Piece Themed Leaderboard

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getBountyForLevel, PIRATE_KING_BOUNTY } = require('../utils/bountySystem');

const LEADERBOARD_EXCLUDE_ROLE = process.env.LEADERBOARD_EXCLUDE_ROLE; // Role ID for Pirate King

function pirateRankEmoji(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '🏴‍☠️';
}

function getThreatLevel(rank) {
    if (rank === 1) return "Emperor-Class Threat";
    if (rank === 2) return "Fleet Admiral Target";
    if (rank === 3) return "Warlord-Level Pirate";
    if (rank <= 10) return "Grand Line Menace";
    return "Wanted Pirate";
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

        // Fetch all users from database
        let leaderboard;
        try {
            leaderboard = await xpTracker.getLeaderboard(guild.id);
        } catch (err) {
            console.error(err);
            return interaction.reply({ content: "Database error occurred. Please try again later.", ephemeral: true });
        }

        // Safe Pirate King handling
        let pirateKingUser = null;
        let kingMember = null;
        if (LEADERBOARD_EXCLUDE_ROLE && guild && guild.members) {
            try {
                const members = await guild.members.fetch();
                const king = members.find(m => m.roles && m.roles.cache && m.roles.cache.has(LEADERBOARD_EXCLUDE_ROLE));
                if (king && king.user && king.user.id) {
                    kingMember = king;
                    pirateKingUser = leaderboard.find(u => u.userId === king.user.id) || { userId: king.user.id, level: 0, xp: 0 };
                    leaderboard = leaderboard.filter(u => u.userId !== king.user.id);
                }
            } catch (err) {
                // Just leave pirateKingUser and kingMember null if any error happens
            }
        }

        leaderboard.sort((a, b) => b.xp - a.xp);

        let entriesToShow = [];
        let title = '🏴‍☠️ One Piece Pirate Leaderboard';
        if (view === 'short') {
            entriesToShow = leaderboard.slice(0, 3);
            title = '🥇 Top 3 Pirates';
        } else if (view === 'long') {
            entriesToShow = leaderboard.slice(0, 10);
            title = '🏅 Top 10 Pirates';
        } else {
            // Full view, display all in plaintext (not embed)
            let text = '';
            let rank = 1;

            if (pirateKingUser) {
                const kingDisplay = kingMember ? kingMember.displayName : `Pirate King (ID: ${pirateKingUser.userId})`;
                text += `👑 **PIRATE KING**: <@${pirateKingUser.userId}> — Level ${pirateKingUser.level} — ฿${PIRATE_KING_BOUNTY.toLocaleString()}\n\n`;
            }

            for (const user of leaderboard) {
                const member = await guild.members.fetch(user.userId).catch(() => null);
                const name = member ? member.displayName : `Unknown Pirate (ID: ${user.userId})`;
                text += `${pirateRankEmoji(rank)} ${rank}. **${name}** — Level ${user.level} — ฿${getBountyForLevel(user.level).toLocaleString()} — [${getThreatLevel(rank)}]\n`;
                rank++;
            }

            if (text.length === 0) text = "No pirates have earned any bounty yet! Be the first to make your mark on the seas.";
            return interaction.reply({ content: text.length > 1900 ? text.slice(0, 1900) + '\n... (truncated)' : text });
        }

        // Build embed for Top 3/Top 10
        const embed = new EmbedBuilder()
            .setColor(0xf7d560)
            .setTitle(title);

        let desc = '';
        let rank = 1;

        if (pirateKingUser) {
            const kingDisplay = kingMember ? kingMember.displayName : `Pirate King (ID: ${pirateKingUser.userId})`;
            desc += `👑 **PIRATE KING**: <@${pirateKingUser.userId}> — Level ${pirateKingUser.level} — ฿${PIRATE_KING_BOUNTY.toLocaleString()}\n\n`;
        }

        for (const user of entriesToShow) {
            let memberName = null;
            try {
                const member = await guild.members.fetch(user.userId).catch(() => null);
                memberName = member ? member.displayName : `Unknown Pirate (ID: ${user.userId})`;
            } catch (err) {
                memberName = `Unknown Pirate (ID: ${user.userId})`;
            }
            desc += `${pirateRankEmoji(rank)} ${rank}. **${memberName}** — Level ${user.level} — ฿${getBountyForLevel(user.level).toLocaleString()} — [${getThreatLevel(rank)}]\n`;
            rank++;
        }

        embed.setDescription(desc && desc.length > 0
            ? desc
            : "No pirates have earned any bounty yet! Be the first to make your mark on the seas."
        );

        // Buttons to switch view
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

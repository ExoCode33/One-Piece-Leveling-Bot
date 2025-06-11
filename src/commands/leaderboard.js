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
        let leaderboard = await xpTracker.getLeaderboard(guild.id);

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
                text += `👑 **PIRATE KING**: <@${pirateKingUser.userId}> - ฿${PIRATE_KING_BOUNTY.toLocaleString()}\n\n`;
            }

            for (const user of leaderboard) {
                text += `${pirateRankEmoji(rank)} ${rank}. <@${user.userId}> — Level ${user.level} — ฿${getBountyForLevel(user.level).toLocaleString()}\n`;
                rank++;
            }

            if (text.length === 0) text = "No pirates have earned any bounty yet! Be the first to make your mark on the seas.";
            return interaction.reply({ content: text.length > 1900 ? text.slice(0, 1900) + '\n... (truncated)' : text });
        }

        const embed = new EmbedBuilder()
            .setColor(0xf7d560)
            .setTitle(title);

        let desc = '';
        let rank = 1;

        if (pirateKingUser) {
            desc += `👑 **PIRATE KING**: <@${pirateKingUser.userId}> — Level ${pirateKingUser.level} — ฿${PIRATE_KING_BOUNTY.toLocaleString()}\n\n`;
        }

        for (const user of entriesToShow) {
            desc += `${pirateRankEmoji(rank)} ${rank}. <@${user.userId}> — Level ${user.level} — ฿${getBountyForLevel(user.level).toLocaleString()}\n`;
            rank++;
        }

        // Never send empty description
        embed.setDescription(desc && desc.length > 0
            ? desc
            : "No pirates have earned any bounty yet! Be the first to make your mark on the seas."
        );

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

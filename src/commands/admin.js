// src/commands/leaderboard.js - One Piece Themed Leaderboard

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBountyForLevel, PIRATE_KING_BOUNTY } = require('../utils/bountySystem');

const LEADERBOARD_EXCLUDE_ROLE = process.env.LEADERBOARD_EXCLUDE_ROLE; // Role ID for Pirate King

function pirateRankEmoji(rank) {
    // For extra flair
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

        // Find Pirate King(s) (user(s) with the Pirate King role)
        let pirateKingUser = null;
        if (LEADERBOARD_EXCLUDE_ROLE) {
            const members = await guild.members.fetch();
            const king = members.find(m => m.roles.cache.has(LEADERBOARD_EXCLUDE_ROLE));
            if (king) {
                pirateKingUser = leaderboard.find(u => u.userId === king.user.id);
                // Remove Pirate King from the regular board
                leaderboard = leaderboard.filter(u => u.userId !== king.user.id);
            }
        }

        // Sort leaderboard by XP descending (already sorted from getLeaderboard, but just in case)
        leaderboard.sort((a, b) => b.xp - a.xp);

        // Prepare leaderboard slices
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
                const kingMember = await guild.members.fetch(pirateKingUser.userId).catch(() => null);
                text += `👑 **PIRATE KING**: <@${pirateKingUser.userId}> - ฿${PIRATE_KING_BOUNTY.toLocaleString()}\n\n`;
            }

            for (const user of leaderboard) {
                const member = await guild.members.fetch(user.userId).catch(() => null);
                const name = member ? member.displayName : `(Unknown User)`;
                text += `${pirateRankEmoji(rank)} ${rank}. **${name}** — Level ${user.level} — ฿${getBountyForLevel(user.level).toLocaleString()}\n`;
                rank++;
            }

            return interaction.reply({ content: text.length > 1900 ? text.slice(0, 1900) + '\n... (truncated)' : text });
        }

        // Build embed for Top 3/Top 10
        const embed = new EmbedBuilder()
            .setColor(0xf7d560)
            .setTitle(title)
            .setDescription('The most feared and notorious pirates on the seas!\n\n');

        let desc = '';
        let rank = 1;

        if (pirateKingUser) {
            const kingMember = await guild.members.fetch(pirateKingUser.userId).catch(() => null);
            const kingName = kingMember ? kingMember.displayName : `(Unknown User)`;
            desc += `👑 **PIRATE KING**: <@${pirateKingUser.userId}> — Level ${pirateKingUser.level} — ฿${PIRATE_KING_BOUNTY.toLocaleString()}\n\n`;
        }

        for (const user of entriesToShow) {
            const member = await guild.members.fetch(user.userId).catch(() => null);
            const name = member ? member.displayName : `(Unknown User)`;
            desc += `${pirateRankEmoji(rank)} ${rank}. **${name}** — Level ${user.level} — ฿${getBountyForLevel(user.level).toLocaleString()}\n`;
            rank++;
        }

        embed.setDescription(desc);

        // Add buttons to switch view
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

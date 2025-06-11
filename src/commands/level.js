// src/commands/level.js - One Piece Themed Level Command

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBountyForLevel, getLevelUpMessage } = require('../utils/bountySystem');

function getPirateTitle(level) {
    if (level >= 50) return '👑 Yonko';
    if (level >= 45) return '⚡ Yonko Commander';
    if (level >= 40) return '🗡️ Warlord';
    if (level >= 35) return '🧭 First Mate';
    if (level >= 30) return '🗺️ Navigator';
    if (level >= 25) return '⚓ Boatswain';
    if (level >= 20) return '⚓ Helmsman';
    if (level >= 15) return '💣 Gunner';
    if (level >= 10) return '🧨 Powder Monkey';
    if (level >= 5) return '🔨 Deckhand';
    return '👶 Cabin Boy';
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Show your current level, bounty, and rank!')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Check another pirate\'s profile')
                .setRequired(false)
        ),
    async execute(interaction, client, xpTracker) {
        const user = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guild.id;

        // Fetch stats using the tracker (which uses DB)
        const stats = await xpTracker.getUserStats(user.id, guildId);

        if (!stats) {
            return interaction.reply({
                content: `No stats found for <@${user.id}>. Start chatting to earn XP!`,
                ephemeral: true
            });
        }

        const { level, xp, messages, reactions, voiceTime } = stats;
        const bounty = getBountyForLevel(level);
        const title = getPirateTitle(level);
        const bountyMessage = getLevelUpMessage(level);

        const embed = new EmbedBuilder()
            .setColor(0xf7d560)
            .setAuthor({ name: `${user.username}'s Pirate Profile`, iconURL: user.displayAvatarURL({ dynamic: true }) })
            .setDescription(`**${title}**\n${bountyMessage}`)
            .addFields(
                { name: '🪙 Level', value: `${level}`, inline: true },
                { name: '💰 Bounty', value: `฿${bounty.toLocaleString()}`, inline: true },
                { name: '⭐ XP', value: `${xp}`, inline: true },
                { name: '💬 Messages', value: `${messages}`, inline: true },
                { name: '🔁 Reactions', value: `${reactions}`, inline: true },
                { name: '🎤 Voice Time', value: `${Math.floor((voiceTime || 0) / 60)} min`, inline: true },
            )
            .setFooter({ text: `Check the /leaderboard to see the Top Pirates!` });

        await interaction.reply({ embeds: [embed] });
    }
};

// src/commands/admin.js

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Admin tools for managing XP and stats')
        .addSubcommand(sub =>
            sub.setName('addxp')
                .setDescription('Add XP to a user')
                .addUserOption(option => option.setName('user').setDescription('User').setRequired(true))
                .addIntegerOption(option => option.setName('amount').setDescription('Amount of XP').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('removexp')
                .setDescription('Remove XP from a user')
                .addUserOption(option => option.setName('user').setDescription('User').setRequired(true))
                .addIntegerOption(option => option.setName('amount').setDescription('Amount of XP').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('reset')
                .setDescription('Reset a user\'s XP and stats')
                .addUserOption(option => option.setName('user').setDescription('User').setRequired(true))
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client, xpTracker) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();
        const user = interaction.options.getUser('user');
        const guildId = interaction.guild.id;

        if (subcommand === 'addxp') {
            const amount = interaction.options.getInteger('amount');
            await xpTracker.updateUserLevel(user.id, guildId, amount, 'admin');
            return interaction.reply({ content: `Added ${amount} XP to ${user.tag}.`, ephemeral: true });
        }
        if (subcommand === 'removexp') {
            const amount = interaction.options.getInteger('amount');
            await xpTracker.updateUserLevel(user.id, guildId, -amount, 'admin');
            return interaction.reply({ content: `Removed ${amount} XP from ${user.tag}.`, ephemeral: true });
        }
        if (subcommand === 'reset') {
            // Reset user stats in the DB
            await client.db.query(
                `UPDATE user_levels SET total_xp = 0, level = 0, messages = 0, reactions = 0, voice_time = 0, rep = 0
                 WHERE user_id = $1 AND guild_id = $2`, [user.id, guildId]
            );
            return interaction.reply({ content: `Reset all stats for ${user.tag}.`, ephemeral: true });
        }

        return interaction.reply({ content: 'Invalid subcommand.', ephemeral: true });
    }
};

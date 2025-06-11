const { SlashCommandBuilder } = require('discord.js');

// Existing level role export for /levelroles, from earlier fix
module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Shows your current level and XP.'),

    async execute(interaction, client) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const userId = interaction.user.id;
            const guildId = interaction.guildId;
            // Fetch user from DB
            const query = `
                SELECT total_xp, level
                FROM user_levels
                WHERE user_id = $1 AND guild_id = $2
                LIMIT 1
            `;
            const result = await client.db.query(query, [userId, guildId]);

            if (!result.rows.length) {
                return await interaction.editReply("You have no XP yet! Send messages to start leveling up.");
            }

            const row = result.rows[0];
            await interaction.editReply(
                `You are Level **${row.level}** with **${row.total_xp} XP**!`
            );
        } catch (err) {
            console.error('Error in /level:', err);
            try {
                await interaction.editReply('An error occurred while showing your level.');
            } catch {}
        }
    },

    // Also include your levelroles code here if you want both in the same file,
    // or keep them in separate exports/files if your bot uses one command per file.
};

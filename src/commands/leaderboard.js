const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Shows the top users by XP.'),

    async execute(interaction, client) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // Fetch top 10 users by XP in this guild
            const guildId = interaction.guildId;
            const query = `
                SELECT user_id, total_xp, level
                FROM user_levels
                WHERE guild_id = $1
                ORDER BY total_xp DESC
                LIMIT 10
            `;
            const result = await client.db.query(query, [guildId]);

            if (!result.rows.length) {
                return await interaction.editReply("No users found on the leaderboard.");
            }

            let leaderboard = result.rows
                .map((row, i) => 
                    `#${i+1} <@${row.user_id}> — Level ${row.level} (${row.total_xp} XP)`
                ).join('\n');

            await interaction.editReply({
                content: `**Server Leaderboard**\n${leaderboard}`,
                allowedMentions: { users: [] }
            });
        } catch (err) {
            console.error('Error in /leaderboard:', err);
            try {
                await interaction.editReply('An error occurred while showing the leaderboard.');
            } catch {}
        }
    }
};

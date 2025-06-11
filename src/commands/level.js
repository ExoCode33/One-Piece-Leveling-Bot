// Inside your level.js (assuming you have module.exports = { ... } below)

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('levelroles')
        .setDescription('Shows all level roles in this server'),

    async execute(interaction, client) {
        // Defer reply to prevent Discord timeout
        await interaction.deferReply({ ephemeral: true });

        // Fetch roles and format them (replace this with your real logic)
        const guild = interaction.guild;
        if (!guild) {
            return await interaction.editReply("Could not find server.");
        }

        // Collect all level role variables from your environment
        const levelRoleIds = [
            { level: 0,  id: process.env.LEVEL_0_ROLE },
            { level: 5,  id: process.env.LEVEL_5_ROLE },
            { level: 10, id: process.env.LEVEL_10_ROLE },
            { level: 15, id: process.env.LEVEL_15_ROLE },
            { level: 20, id: process.env.LEVEL_20_ROLE },
            { level: 25, id: process.env.LEVEL_25_ROLE },
            { level: 30, id: process.env.LEVEL_30_ROLE },
            { level: 35, id: process.env.LEVEL_35_ROLE },
            { level: 40, id: process.env.LEVEL_40_ROLE },
            { level: 45, id: process.env.LEVEL_45_ROLE },
            { level: 50, id: process.env.LEVEL_50_ROLE },
        ].filter(r => r.id);

        let description = "";

        for (const role of levelRoleIds) {
            const guildRole = guild.roles.cache.get(role.id);
            if (guildRole) {
                description += `Level **${role.level}**: <@&${role.id}>\n`;
            } else {
                description += `Level **${role.level}**: *(role not found)*\n`;
            }
        }

        if (!description) {
            description = "No level roles are set up for this server.";
        }

        await interaction.editReply({
            content: `**Level Roles:**\n${description}`
        });
    },
};

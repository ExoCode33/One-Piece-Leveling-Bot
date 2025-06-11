// src/commands/level.js - Enhanced Level Command

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

function calculateLevel(xp) {
    const curve = process.env.FORMULA_CURVE || 'exponential';
    const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
    const maxLevel = parseInt(process.env.MAX_LEVEL) || 50;
    
    let level;
    switch (curve) {
        case 'linear':
            level = Math.floor(xp / (1000 * multiplier));
            break;
        case 'logarithmic':
            level = Math.floor(Math.log(xp / 100 + 1) * multiplier);
            break;
        case 'exponential':
        default:
            level = Math.floor(Math.sqrt(xp / 100) * multiplier);
            break;
    }
    
    return Math.min(level, maxLevel);
}

function calculateXPForLevel(level) {
    const curve = process.env.FORMULA_CURVE || 'exponential';
    const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
    
    switch (curve) {
        case 'linear':
            return Math.floor(level * 1000 * multiplier);
        case 'logarithmic':
            return Math.floor((Math.exp(level / multiplier) - 1) * 100);
        case 'exponential':
        default:
            return Math.floor(Math.pow(level / multiplier, 2) * 100);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Check your or someone\'s level and stats')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to check (optional)')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        try {
            await interaction.deferReply();

            const targetUser = interaction.options.getUser('user') || interaction.user;
            const userId = targetUser.id;
            const guildId = interaction.guildId;
            
            const query = `
                SELECT total_xp, level, messages, reactions, voice_time, last_updated
                FROM user_levels
                WHERE user_id = $1 AND guild_id = $2
            `;
            const result = await client.db.query(query, [userId, guildId]);

            if (!result.rows.length) {
                const embed = new EmbedBuilder()
                    .setTitle(`${targetUser.username}'s Level`)
                    .setDescription(`${targetUser === interaction.user ? 'You have' : `${targetUser.username} has`} no XP yet! Send messages, react to posts, or join voice channels to start leveling up.`)
                    .setThumbnail(targetUser.displayAvatarURL())
                    .setColor(0xFF0000);
                
                return await interaction.editReply({ embeds: [embed] });
            }

            const row = result.rows[0];
            const currentLevelXP = calculateXPForLevel(row.level);
            const nextLevelXP = calculateXPForLevel(row.level + 1);
            const progressXP = row.total_xp - currentLevelXP;
            const neededXP = nextLevelXP - currentLevelXP;
            const progressPercentage = Math.floor((progressXP / neededXP) * 100);
            
            // Create progress bar
            const progressBarLength = 20;
            const filledBars = Math.floor((progressXP / neededXP) * progressBarLength);
            const emptyBars = progressBarLength - filledBars;
            const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

            const embed = new EmbedBuilder()
                .setTitle(`${targetUser.username}'s Level Stats`)
                .setThumbnail(targetUser.displayAvatarURL())
                .setColor(0x00AE86)
                .addFields(
                    { name: '📊 Level', value: `**${row.level}**/${process.env.MAX_LEVEL || 50}`, inline: true },
                    { name: '⭐ Total XP', value: `**${row.total_xp.toLocaleString()}**`, inline: true },
                    { name: '🎯 Progress', value: `${progressPercentage}%`, inline: true },
                    { name: '📈 Next Level Progress', value: `\`${progressBar}\`\n${progressXP.toLocaleString()}/${neededXP.toLocaleString()} XP`, inline: false },
                    { name: '💬 Messages', value: row.messages.toLocaleString(), inline: true },
                    { name: '👍 Reactions', value: row.reactions.toLocaleString(), inline: true },
                    { name: '🔊 Voice Time', value: `${Math.floor(row.voice_time / 60)}h ${row.voice_time % 60}m`, inline: true }
                );

            // Add rank if possible
            try {
                const rankQuery = `
                    SELECT COUNT(*) + 1 as rank
                    FROM user_levels
                    WHERE guild_id = $1 AND total_xp > $2
                `;
                const rankResult = await client.db.query(rankQuery, [guildId, row.total_xp]);
                if (rankResult.rows.length > 0) {
                    embed.addFields({ name: '🏆 Server Rank', value: `#${rankResult.rows[0].rank}`, inline: true });
                }
            } catch (error) {
                console.error('Error getting rank:', error);
            }

            // Add timestamp
            const lastActive = new Date(row.last_updated);
            embed.setFooter({ text: `Last active: ${lastActive.toLocaleDateString()}` });

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('Error in /level:', err);
            try {
                await interaction.editReply('An error occurred while showing level information.');
            } catch {}
        }
    },

    // Helper functions for other files to use
    giveXP: async function(message, client) {
        const userId = message.author.id;
        const guildId = message.guildId;
        const minXP = parseInt(process.env.MESSAGE_XP_MIN) || 25;
        const maxXP = parseInt(process.env.MESSAGE_XP_MAX) || 35;
        
        const xpAmount = Math.floor(Math.random() * (maxXP - minXP + 1)) + minXP;
        
        // This would call the updateUserLevel function from main index.js
        // For now, return the XP amount
        return xpAmount;
    },

    giveReactionXP: async function(reaction, user, client) {
        const userId = user.id;
        const guildId = reaction.message.guildId;
        const minXP = parseInt(process.env.REACTION_XP_MIN) || 25;
        const maxXP = parseInt(process.env.REACTION_XP_MAX) || 35;
        
        const xpAmount = Math.floor(Math.random() * (maxXP - minXP + 1)) + minXP;
        
        // This would call the updateUserLevel function from main index.js
        // For now, return the XP amount
        return xpAmount;
    },

    calculateLevel,
    calculateXPForLevel
};

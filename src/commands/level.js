// src/commands/level.js - One Piece Themed Level Command

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

function getBountyDescription(level, totalXP) {
    if (level >= 50) {
        return '*One of the Four Emperors! This legendary Yonko rules over vast territories in the New World!*';
    } else if (level >= 45) {
        return '*A fearsome commander serving under a Yonko! Their strength rivals that of admirals!*';
    } else if (level >= 40) {
        return '*A Shichibukai! This Warlord has made a pact with the World Government!*';
    } else if (level >= 35) {
        return '*The trusted right hand of a great captain! This First Mate commands respect across the seas!*';
    } else if (level >= 30) {
        return '*The ship\'s Navigator! Their knowledge of the Grand Line\'s treacherous waters is unmatched!*';
    } else if (level >= 25) {
        return '*The ship\'s Boatswain! They keep the crew in line and the ship running smoothly!*';
    } else if (level >= 20) {
        return '*The ship\'s Helmsman! They guide the vessel through the most dangerous waters!*';
    } else if (level >= 15) {
        return '*A skilled Gunner! Their cannon fire strikes fear into enemy ships!*';
    } else if (level >= 10) {
        return '*A reliable Powder Monkey! They keep the cannons loaded and ready for battle!*';
    } else if (level >= 5) {
        return '*A hardworking Deckhand! They\'ve proven their worth aboard the ship!*';
    } else {
        return '*A rookie Cabin Boy just starting their pirate adventure!*';
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Check your or someone\'s pirate bounty and reputation')
        .addUserOption(option =>
            option.setName('pirate')
                .setDescription('Which pirate\'s bounty to check (optional)')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        try {
            await interaction.deferReply();

            const targetUser = interaction.options.getUser('pirate') || interaction.user;
            const userId = targetUser.id;
            const guildId = interaction.guildId;
            
            const query = `
                SELECT total_xp, level, messages, reactions, voice_time
                FROM user_levels
                WHERE user_id = $1 AND guild_id = $2
            `;
            const result = await client.db.query(query, [userId, guildId]);

            if (!result.rows.length) {
                const embed = new EmbedBuilder()
                    .setTitle(`🏴‍☠️ ${targetUser.username}'s Bounty Poster`)
                    .setDescription(`${targetUser === interaction.user ? 'You haven\'t' : `${targetUser.username} hasn't`} started your pirate journey yet!\n\n*Set sail by sending messages, reacting to posts, or joining voice channels to begin earning your bounty!*`)
                    .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
                    .setColor(0x8B4513)
                    .setAuthor({ 
                        name: 'Marine Bounty Office', 
                        iconURL: interaction.guild.iconURL() 
                    })
                    .addFields(
                        { name: '💰 Current Bounty', value: '**0 ⚡**', inline: true },
                        { name: '⭐ Pirate Rank', value: '**👶 Cabin Boy**', inline: true },
                        { name: '🗺️ Journey Status', value: '**Not Started**', inline: true }
                    )
                    .setFooter({ text: '⚓ Start your adventure today!' });
                
                return await interaction.editReply({ embeds: [embed] });
            }

            const row = result.rows[0];
            const currentLevelXP = calculateXPForLevel(row.level);
            const nextLevelXP = calculateXPForLevel(row.level + 1);
            const progressXP = row.total_xp - currentLevelXP;
            const neededXP = nextLevelXP - currentLevelXP;
            const progressPercentage = Math.floor((progressXP / neededXP) * 100);
            
            // Create One Piece themed progress bar
            const progressBarLength = 20;
            const filledBars = Math.floor((progressXP / neededXP) * progressBarLength);
            const emptyBars = progressBarLength - filledBars;
            const progressBar = '🟨'.repeat(filledBars) + '⬜'.repeat(emptyBars);

            // Get pirate title and description
            const pirateTitle = getPirateTitle(row.level);
            const bountyDescription = getBountyDescription(row.level, row.total_xp);

            // Determine embed color based on level
            let embedColor = 0x8B4513; // Brown (default)
            if (row.level >= 50) embedColor = 0xFFD700; // Gold (Yonko)
            else if (row.level >= 45) embedColor = 0x8A2BE2; // Blue Violet (Yonko Commander)
            else if (row.level >= 40) embedColor = 0xDC143C; // Crimson (Warlord)
            else if (row.level >= 35) embedColor = 0xFF4500; // Orange Red (First Mate)
            else if (row.level >= 30) embedColor = 0x1E90FF; // Dodger Blue (Navigator)
            else if (row.level >= 25) embedColor = 0x32CD32; // Lime Green (Boatswain)
            else if (row.level >= 20) embedColor = 0x9932CC; // Dark Orchid (Helmsman)
            else if (row.level >= 15) embedColor = 0xFF6347; // Tomato (Gunner)
            else if (row.level >= 10) embedColor = 0xFFA500; // Orange (Powder Monkey)
            else if (row.level >= 5) embedColor = 0x20B2AA; // Light Sea Green (Deckhand)

            const embed = new EmbedBuilder()
                .setTitle(`🏴‍☠️ ${targetUser.username}'s Bounty Poster`)
                .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
                .setColor(embedColor)
                .setDescription(bountyDescription)
                .setAuthor({ 
                    name: 'World Government Bounty Division', 
                    iconURL: interaction.guild.iconURL() 
                })
                .addFields(
                    { name: '💰 Current Bounty', value: `**${row.total_xp.toLocaleString()} ⚡**`, inline: true },
                    { name: '⭐ Pirate Rank', value: `**${pirateTitle}**`, inline: true },
                    { name: '📊 Level Progress', value: `**${row.level}**/${process.env.MAX_LEVEL || 50}`, inline: true },
                    { 
                        name: '🗺️ Journey to Next Rank', 
                        value: `${progressBar}\n**${progressXP.toLocaleString()}**/**${neededXP.toLocaleString()}** ⚡ (${progressPercentage}%)`, 
                        inline: false 
                    },
                    { name: '💬 Messages Sent', value: `**${row.messages.toLocaleString()}**`, inline: true },
                    { name: '👍 Crew Bonds', value: `**${row.reactions.toLocaleString()}**`, inline: true },
                    { name: '🎙️ Time on Deck', value: `**${Math.floor(row.voice_time / 60)}h ${row.voice_time % 60}m**`, inline: true }
                );

            // Add rank information
            try {
                const rankQuery = `
                    SELECT COUNT(*) + 1 as rank
                    FROM user_levels
                    WHERE guild_id = $1 AND total_xp > $2
                `;
                const rankResult = await client.db.query(rankQuery, [guildId, row.total_xp]);
                if (rankResult.rows.length > 0) {
                    let rankIcon = '';
                    const rank = parseInt(rankResult.rows[0].rank);
                    if (rank === 1) rankIcon = '🥇';
                    else if (rank === 2) rankIcon = '🥈';
                    else if (rank === 3) rankIcon = '🥉';
                    else if (rank <= 10) rankIcon = '⚔️';
                    else rankIcon = '🗡️';
                    
                    embed.addFields({ 
                        name: '🏆 Fleet Ranking', 
                        value: `${rankIcon} **#${rank}** in the crew`, 
                        inline: true 
                    });
                }
            } catch (error) {
                console.error('Error getting rank:', error);
            }

            // Add special level milestone information
            if (row.level === 50) {
                embed.addFields({
                    name: '👑 YONKO STATUS',
                    value: '**You have reached the pinnacle! One of the Four Emperors ruling the New World!**',
                    inline: false
                });
            } else if (row.level >= 45) {
                embed.addFields({
                    name: '⚡ YONKO COMMANDER STATUS',
                    value: '**A fearsome commander! Your strength rivals that of Marine Admirals!**',
                    inline: false
                });
            } else if (row.level >= 40) {
                embed.addFields({
                    name: '🗡️ WARLORD STATUS',
                    value: '**One of the Seven Warlords of the Sea! The World Government acknowledges your power!**',
                    inline: false
                });
            } else if (row.level >= 35) {
                embed.addFields({
                    name: '🧭 FIRST MATE STATUS',
                    value: '**The trusted right hand! You command respect across all crews!**',
                    inline: false
                });
            }

            // Add next level preview
            if (row.level < (parseInt(process.env.MAX_LEVEL) || 50)) {
                const nextTitle = getPirateTitle(row.level + 1);
                embed.addFields({
                    name: '🎯 Next Rank',
                    value: `**${nextTitle}** awaits at Level ${row.level + 1}`,
                    inline: false
                });
            }

            embed.setFooter({ text: '⚓ Marine Intelligence Report • Bounty Active' });

            // Add image border effect (if you have custom images)
            // embed.setImage('https://i.imgur.com/wanted-border.png');

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('Error in /level:', err);
            try {
                await interaction.editReply('❌ An error occurred while fetching the bounty information.');
            } catch {}
        }
    },

    // Export helper functions for use in main bot
    calculateLevel,
    calculateXPForLevel,
    getPirateTitle,
    getBountyDescription
};

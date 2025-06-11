// src/commands/level.js - One Piece Themed Level Command

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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

    async execute(interaction, client, xpTracker) {
        try {
            await interaction.deferReply();

            const targetUser = interaction.options.getUser('pirate') || interaction.user;
            const userId = targetUser.id;
            const guildId = interaction.guildId;
            
            // Get user stats using XP Tracker
            const userStats = await xpTracker.getUserStats(userId, guildId);

            if (!userStats) {
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

            const progressPercentage = userStats.progressPercentage;
            
            // Create One Piece themed progress bar
            const progressBarLength = 20;
            const filledBars = Math.floor((userStats.progressXP / userStats.neededXP) * progressBarLength);
            const emptyBars = progressBarLength - filledBars;
            const progressBar = '🟨'.repeat(filledBars) + '⬜'.repeat(emptyBars);

            // Get pirate title and description
            const pirateTitle = getPirateTitle(userStats.level);
            const bountyDescription = getBountyDescription(userStats.level, userStats.total_xp);

            // Determine embed color based on level
            let embedColor = 0x8B4513; // Brown (default)
            if (userStats.level >= 50) embedColor = 0xFFD700; // Gold (Yonko)
            else if (userStats.level >= 45) embedColor = 0x8A2BE2; // Blue Violet (Yonko Commander)
            else if (userStats.level >= 40) embedColor = 0xDC143C; // Crimson (Warlord)
            else if (userStats.level >= 35) embedColor = 0xFF4500; // Orange Red (First Mate)
            else if (userStats.level >= 30) embedColor = 0x1E90FF; // Dodger Blue (Navigator)
            else if (userStats.level >= 25) embedColor = 0x32CD32; // Lime Green (Boatswain)
            else if (userStats.level >= 20) embedColor = 0x9932CC; // Dark Orchid (Helmsman)
            else if (userStats.level >= 15) embedColor = 0xFF6347; // Tomato (Gunner)
            else if (userStats.level >= 10) embedColor = 0xFFA500; // Orange (Powder Monkey)
            else if (userStats.level >= 5) embedColor = 0x20B2AA; // Light Sea Green (Deckhand)

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
                    { name: '💰 Current Bounty', value: `**${userStats.total_xp.toLocaleString()} ⚡**`, inline: true },
                    { name: '⭐ Pirate Rank', value: `**${pirateTitle}**`, inline: true },
                    { name: '📊 Level Progress', value: `**${userStats.level}**/${process.env.MAX_LEVEL || 50}`, inline: true },
                    { 
                        name: '🗺️ Journey to Next Rank', 
                        value: `${progressBar}\n**${userStats.progressXP.toLocaleString()}**/**${userStats.neededXP.toLocaleString()}** ⚡ (${progressPercentage}%)`, 
                        inline: false 
                    },
                    { name: '💬 Messages Sent', value: `**${userStats.messages.toLocaleString()}**`, inline: true },
                    { name: '👍 Crew Bonds', value: `**${userStats.reactions.toLocaleString()}**`, inline: true },
                    { name: '🎙️ Time on Deck', value: `**${Math.floor(userStats.voice_time / 60)}h ${userStats.voice_time % 60}m**`, inline: true }
                );

            // Add rank information
            try {
                const rankQuery = `
                    SELECT COUNT(*) + 1 as rank
                    FROM user_levels
                    WHERE guild_id = $1 AND total_xp > $2
                `;
                const rankResult = await client.db.query(rankQuery, [guildId, userStats.total_xp]);
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
            if (userStats.level === 50) {
                embed.addFields({
                    name: '👑 YONKO STATUS',
                    value: '**You have reached the pinnacle! One of the Four Emperors ruling the New World!**',
                    inline: false
                });
            } else if (userStats.level >= 45) {
                embed.addFields({
                    name: '⚡ YONKO COMMANDER STATUS',
                    value: '**A fearsome commander! Your strength rivals that of Marine Admirals!**',
                    inline: false
                });
            } else if (userStats.level >= 40) {
                embed.addFields({
                    name: '🗡️ WARLORD STATUS',
                    value: '**One of the Seven Warlords of the Sea! The World Government acknowledges your power!**',
                    inline: false
                });
            } else if (userStats.level >= 35) {
                embed.addFields({
                    name: '🧭 FIRST MATE STATUS',
                    value: '**The trusted right hand! You command respect across all crews!**',
                    inline: false
                });
            }

            // Add next level preview
            if (userStats.level < (parseInt(process.env.MAX_LEVEL) || 50)) {
                const nextTitle = getPirateTitle(userStats.level + 1);
                embed.addFields({
                    name: '🎯 Next Rank',
                    value: `**${nextTitle}** awaits at Level ${userStats.level + 1}`,
                    inline: false
                });
            }

            embed.setFooter({ text: '⚓ Marine Intelligence Report • Bounty Active' });

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('Error in /level:', err);
            try {
                await interaction.editReply('❌ An error occurred while fetching the bounty information.');
            } catch {}
        }
    }
};

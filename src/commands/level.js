// src/commands/level.js - Complete Marine themed version
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBountyForLevel } = require('../utils/bountySystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('View level information and stats')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to check level for')
                .setRequired(false)),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const member = interaction.guild.members.cache.get(targetUser.id);
            
            if (!member) {
                return await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('MARINE INTELLIGENCE BUREAU')
                        .setDescription('```diff\n- TARGET NOT FOUND IN DATABASE\n- INSUFFICIENT INTELLIGENCE DATA\n```')
                        .setFooter({ text: 'World Government Intelligence Division' })
                        .setTimestamp()],
                    ephemeral: true
                });
            }

            // Check if xpTracker exists
            if (!global.xpTracker) {
                console.error('[ERROR] XP Tracker not initialized');
                return await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('MARINE INTELLIGENCE BUREAU')
                        .setDescription('```diff\n- INTELLIGENCE SYSTEM OFFLINE\n- XP TRACKER NOT INITIALIZED\n```')
                        .setFooter({ text: 'World Government Intelligence Division' })
                        .setTimestamp()],
                    ephemeral: true
                });
            }

            // Get user stats from database directly
            console.log(`[DEBUG] Getting stats for user ${targetUser.id} in guild ${interaction.guild.id}`);
            
            const userStats = await global.xpTracker.db.query(
                'SELECT * FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                [targetUser.id, interaction.guild.id]
            );
            
            if (!userStats.rows || userStats.rows.length === 0) {
                return await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('MARINE INTELLIGENCE BUREAU')
                        .setDescription('```diff\n- NO CRIMINAL RECORD FOUND\n- TARGET NOT IN DATABASE\n```')
                        .setFooter({ text: 'World Government Intelligence Division' })
                        .setTimestamp()],
                    ephemeral: true
                });
            }

            const userData = userStats.rows[0];
            const currentLevel = global.xpTracker.calculateLevel(userData.total_xp);
            const totalXP = userData.total_xp;
            const currentBounty = getBountyForLevel(currentLevel);
            const nextBounty = getBountyForLevel(currentLevel + 1);
            
            // Calculate XP needed for next level
            const currentLevelXP = global.xpTracker.getXPForLevel(currentLevel);
            const nextLevelXP = global.xpTracker.getXPForLevel(currentLevel + 1);
            const progressXP = totalXP - currentLevelXP;
            const neededXP = nextLevelXP - totalXP;
            const progressPercent = Math.round((progressXP / (nextLevelXP - currentLevelXP)) * 100);

            // Get user rank
            const rankQuery = await global.xpTracker.db.query(
                'SELECT COUNT(*) + 1 as rank FROM user_levels WHERE guild_id = $1 AND total_xp > $2',
                [interaction.guild.id, totalXP]
            );
            const userRank = rankQuery.rows[0]?.rank || 'Unknown';

            // Create Marine Intelligence report
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('MARINE INTELLIGENCE BUREAU')
                .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
                .setDescription(`\`\`\`diff\n- CRIMINAL PROFILE: ${member.displayName.toUpperCase()}\n- THREAT ASSESSMENT COMPLETE\n\`\`\``)
                .addFields(
                    {
                        name: 'CURRENT BOUNTY',
                        value: `\`\`\`diff\n- ${currentBounty.toLocaleString()} BERRIES\n\`\`\``,
                        inline: true
                    },
                    {
                        name: 'THREAT LEVEL',
                        value: `\`\`\`diff\n- LEVEL ${currentLevel}\n\`\`\``,
                        inline: true
                    },
                    {
                        name: 'FLEET RANKING',
                        value: `\`\`\`diff\n- RANK #${userRank}\n\`\`\``,
                        inline: true
                    },
                    {
                        name: 'TOTAL CRIMINAL ACTIVITY',
                        value: `\`\`\`diff\n- ${totalXP.toLocaleString()} XP ACCUMULATED\n\`\`\``,
                        inline: true
                    },
                    {
                        name: 'ADVANCEMENT PROGRESS',
                        value: `\`\`\`diff\n- ${neededXP.toLocaleString()} XP REQUIRED\n\`\`\``,
                        inline: true
                    },
                    {
                        name: 'NEXT BOUNTY INCREASE',
                        value: `\`\`\`diff\n- ${nextBounty.toLocaleString()} BERRIES\n\`\`\``,
                        inline: true
                    }
                )
                .setFooter({ 
                    text: 'WORLD GOVERNMENT INTELLIGENCE DIVISION',
                    iconURL: interaction.guild.iconURL() 
                })
                .setTimestamp();

            // Add threat assessment based on level
            let threatLevel = '';
            if (currentLevel >= 50) {
                threatLevel = '```diff\n- EXTREMELY DANGEROUS\n- SUPERNOVA THREAT\n- IMMEDIATE CAPTURE REQUIRED\n```';
            } else if (currentLevel >= 30) {
                threatLevel = '```diff\n- HIGH THREAT LEVEL\n- EXPERIENCED CRIMINAL\n- PROCEED WITH CAUTION\n```';
            } else if (currentLevel >= 15) {
                threatLevel = '```diff\n- MODERATE THREAT\n- ACTIVE PIRATE\n- STANDARD OPERATIONS\n```';
            } else if (currentLevel >= 5) {
                threatLevel = '```diff\n- LOW THREAT LEVEL\n- ROOKIE PIRATE\n- ROUTINE MONITORING\n```';
            } else {
                threatLevel = '```diff\n- MINIMAL THREAT\n- CIVILIAN ACTIVITY\n- BASIC SURVEILLANCE\n```';
            }

            embed.addFields({
                name: 'INTELLIGENCE ASSESSMENT',
                value: threatLevel,
                inline: false
            });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('[ERROR] Error in level command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('MARINE INTELLIGENCE BUREAU')
                .setDescription('```diff\n- INTELLIGENCE SYSTEM ERROR\n- DATA RETRIEVAL FAILED\n- CONTACT MARINE HEADQUARTERS\n```')
                .setFooter({ text: 'World Government Intelligence Division' })
                .setTimestamp();

            if (interaction.replied) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }
};

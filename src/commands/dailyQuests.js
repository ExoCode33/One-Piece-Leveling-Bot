// src/commands/daily-quest.js - Complete Daily Quest Command

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily-quest')
        .setDescription('📋 View your daily missions and progress')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('View another user\'s daily quests')
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const userId = targetUser.id;
            const guildId = interaction.guild.id;

            // Check if daily quest system is available
            if (!global.dailyQuests) {
                return await interaction.reply({
                    content: '❌ **Daily Quest System Offline**\n\nThe daily quest system is not currently available.',
                    ephemeral: true
                });
            }

            await interaction.deferReply();

            // Generate quests if user doesn't have any for today
            await global.dailyQuests.generateDailyQuests(userId, guildId);

            // Get user's daily quests
            const userQuests = await global.dailyQuests.getUserDailyQuests(userId, guildId);

            if (userQuests.length === 0) {
                return await interaction.editReply({
                    content: '❌ **No Daily Quests**\n\nNo daily quests found. Please try again later.',
                });
            }

            // Check quest completion status
            const completedQuests = userQuests.filter(q => q.completed).length;
            const totalQuests = userQuests.length;
            const allCompleted = completedQuests === totalQuests;

            // Get quest types for descriptions
            const { getQuestTypes } = require('../utils/questTypes');
            const questTypes = getQuestTypes();

            // Create quest display embed
            const embed = new EmbedBuilder()
                .setColor(allCompleted ? 0x00FF00 : 0x4A90E2)
                .setAuthor({ 
                    name: '🔴 MARINE INTELLIGENCE BUREAU',
                    iconURL: targetUser.displayAvatarURL({ size: 32 })
                })
                .setTitle('📋 DAILY MISSION BRIEFING')
                .setDescription(`\`\`\`diff\n${allCompleted ? '+ ALL MISSIONS COMPLETED!' : '- DAILY MISSION STATUS'}\n- AGENT: ${targetUser.username}\n- COMPLETION: ${completedQuests}/${totalQuests} missions\n- RESET TIME: ${getNextResetTime()}\n\`\`\``)
                .setThumbnail(targetUser.displayAvatarURL({ size: 128 }));

            // Add quest fields
            userQuests.forEach((quest, index) => {
                const questConfig = questTypes[quest.quest_type];
                const status = quest.completed ? '✅ COMPLETE' : '🔄 IN PROGRESS';
                const progress = `${quest.progress}/${quest.target}`;
                const progressBar = createProgressBar(quest.progress, quest.target);
                
                embed.addFields({
                    name: `${index + 1}. ${questConfig ? questConfig.name : quest.quest_type}`,
                    value: `\`\`\`diff\n${quest.completed ? '+' : '-'} ${questConfig ? questConfig.description : 'Quest description'}\n${quest.completed ? '+' : '-'} Progress: ${progress} ${progressBar}\n${quest.completed ? '+' : '-'} XP Reward: ${quest.xp_reward}\n${quest.completed ? '+' : '-'} Status: ${status}\n\`\`\``,
                    inline: false
                });
            });

            // Add completion bonus info
            if (allCompleted) {
                embed.addFields({
                    name: '🏆 MISSION COMPLETE BONUS',
                    value: `\`\`\`diff\n+ ALL MISSIONS ACCOMPLISHED!\n+ Quest Master Role Awarded\n+ Tier-2 XP Cap Unlocked (${parseInt(process.env.DAILY_VOICE_XP_CAP_TIER_2) || 3000} XP)\n+ Outstanding performance, Marine!\n\`\`\``,
                    inline: false
                });
            } else {
                const remaining = totalQuests - completedQuests;
                embed.addFields({
                    name: '📈 COMPLETION REWARD',
                    value: `\`\`\`yaml\nComplete ALL daily missions to unlock:\n• Quest Master Role\n• Tier-2 XP Cap (${parseInt(process.env.DAILY_VOICE_XP_CAP_TIER_2) || 3000} daily XP)\n• Special recognition in quest channel\n\nRemaining: ${remaining} mission${remaining !== 1 ? 's' : ''}\n\`\`\``,
                    inline: false
                });
            }

            embed.setFooter({ text: '⚓ Marine Intelligence • Daily Mission System' })
                 .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[DAILY QUEST] Error in daily-quest command:', error);
            
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ **System Error**\n\nFailed to retrieve daily quest information.'
                }).catch(() => {});
            } else {
                await interaction.reply({
                    content: '❌ **System Error**\n\nFailed to retrieve daily quest information.',
                    ephemeral: true
                }).catch(() => {});
            }
        }
    }
};

// Helper function to create a progress bar
function createProgressBar(current, max, length = 10) {
    const percentage = Math.min(current / max, 1);
    const filled = Math.round(percentage * length);
    const empty = length - filled;
    
    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
}

// Helper function to get next reset time
function getNextResetTime() {
    const now = new Date();
    const isESTDaylightSaving = (date) => {
        const year = date.getFullYear();
        const march = new Date(year, 2, 1);
        const november = new Date(year, 10, 1);
        const dstStart = new Date(year, 2, (14 - march.getDay()) % 7 + 8);
        const dstEnd = new Date(year, 10, (7 - november.getDay()) % 7 + 1);
        return date >= dstStart && date < dstEnd;
    };
    
    const estOffset = isESTDaylightSaving(now) ? -4 : -5;
    const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
    
    const nextReset = new Date(estTime);
    nextReset.setHours(3, 0, 0, 0);
    
    if (estTime.getHours() >= 3) {
        nextReset.setDate(nextReset.getDate() + 1);
    }
    
    const localReset = new Date(nextReset.getTime() - (estOffset * 60 * 60 * 1000));
    
    return localReset.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
    });
}

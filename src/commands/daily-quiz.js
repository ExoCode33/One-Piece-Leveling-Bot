// src/commands/daily-quiz.js - FIXED Main Command File (Split Architecture)

const { SlashCommandBuilder } = require('discord.js');
const QuizManager = require('../utils/quiz/QuizManager');
const { isTestingMode, getCurrentDayKey } = require('../utils/quiz/timezone');

// Initialize quiz manager
let quizManager;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily-quiz')
        .setDescription('🎌 Ultimate anime challenge! 10 questions, Divine mastery awaits!'),

    async execute(interaction) {
        try {
            // Initialize quiz manager if not already done
            if (!quizManager) {
                quizManager = new QuizManager(global.xpTracker);
            }

            const testingMode = isTestingMode();
            const userId = interaction.user.id;
            
            // Check channel restriction
            const allowedChannelId = process.env.DAILY_QUIZ_CHANNEL;
            if (allowedChannelId && interaction.channel.id !== allowedChannelId) {
                const allowedChannel = interaction.guild.channels.cache.get(allowedChannelId);
                const channelMention = allowedChannel ? `<#${allowedChannelId}>` : `channel ID: ${allowedChannelId}`;
                
                return await interaction.reply({
                    content: `❌ **Wrong Channel${testingMode ? ' [Testing Mode]' : ''}**\n\nThe daily quiz can only be used in ${channelMention}.${testingMode ? '\n\n🧪 **Testing Mode Active** - but channel restriction still applies!' : ''}\n\nPlease go to the correct channel to take the challenge!`,
                    ephemeral: true
                });
            }

            // Check for active quiz
            if (quizManager.hasActiveQuiz(userId)) {
                return await interaction.reply({
                    content: '❌ **Quiz Already Active**\n\nYou already have an active daily quiz session. Please complete it first.',
                    ephemeral: true
                });
            }

            const guildId = interaction.guild.id;
            const member = interaction.member;
            
            // Check XP tracker availability (skip in testing mode)
            if (!global.xpTracker?.db && !testingMode) {
                return await interaction.reply({ 
                    content: '❌ System unavailable - XP tracker not initialized', 
                    ephemeral: true 
                });
            }

            // Check if already completed today (skip in testing mode)
            if (!testingMode) {
                const existingRecord = await quizManager.checkExistingQuiz(userId, guildId);
                
                if (existingRecord && existingRecord.tier >= 0) {
                    const buff = await quizManager.getCurrentBuff(userId, guildId, member);
                    const nextReset = quizManager.getNextResetTimestamp();
                    
                    return await interaction.reply({
                        content: `You've already completed today's challenge!\n\n**Current Enhancement:** ${buff.name}\n**Next Challenge:** <t:${nextReset}:R>`,
                        ephemeral: true
                    });
                }
            } else {
                console.log(`[DAILY QUIZ] Testing mode - allowing unlimited attempts for ${interaction.user.username}`);
            }
            
            // Start the quiz
            await quizManager.startQuiz(interaction, userId, guildId, member);
            
        } catch (error) {
            console.error('[DAILY QUIZ] Execute error:', error);
            
            // Clean up on error
            if (quizManager && interaction.user?.id) {
                quizManager.cleanupQuiz(interaction.user.id);
            }
            
            const content = '❌ Error occurred. Please try again.';
            try {
                if (interaction.deferred) {
                    await interaction.editReply({ content });
                } else {
                    await interaction.reply({ content, ephemeral: true });
                }
            } catch (replyError) {
                console.error('[DAILY QUIZ] Reply error:', replyError);
            }
        }
    }
};

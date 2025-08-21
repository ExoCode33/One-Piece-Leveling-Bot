// src/commands/daily-quiz.js - COMPLETE FIXED Main Command File (Split Architecture)

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
            // ✅ FIXED: Better error handling for initialization
            if (!quizManager) {
                try {
                    quizManager = new QuizManager(global.xpTracker);
                    console.log('[DAILY QUIZ] Quiz manager initialized successfully');
                } catch (initError) {
                    console.error('[DAILY QUIZ] Failed to initialize quiz manager:', initError);
                    return await interaction.reply({
                        content: '❌ **Quiz System Error**\n\nThe quiz system failed to initialize. Please try again in a few moments.',
                        ephemeral: true
                    });
                }
            }

            const testingMode = isTestingMode();
            const userId = interaction.user.id;
            const guildId = interaction.guild.id; // ✅ FIXED: Get guild ID here to pass to quiz manager
            
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
                try {
                    const existingRecord = await quizManager.checkExistingQuiz(userId, guildId);
                    
                    if (existingRecord && existingRecord.tier >= 0) {
                        const buff = await quizManager.getCurrentBuff(userId, guildId, member);
                        const nextReset = quizManager.getNextResetTimestamp();
                        
                        return await interaction.reply({
                            content: `You've already completed today's challenge!\n\n**Current Enhancement:** ${buff.name}\n**Next Challenge:** <t:${nextReset}:R>`,
                            ephemeral: true
                        });
                    }
                } catch (checkError) {
                    console.error('[DAILY QUIZ] Error checking existing quiz:', checkError);
                    // Continue anyway in case it's a database issue
                }
            } else {
                console.log(`[DAILY QUIZ] Testing mode - allowing unlimited attempts for ${interaction.user.username}`);
            }
            
            // ✅ FIXED: Pass guildId explicitly to startQuiz
            try {
                await quizManager.startQuiz(interaction, userId, guildId, member);
            } catch (startError) {
                console.error('[DAILY QUIZ] Error starting quiz:', startError);
                
                // Clean up on error
                if (quizManager && interaction.user?.id) {
                    quizManager.cleanupQuiz(interaction.user.id);
                }
                
                return await interaction.reply({
                    content: '❌ **Quiz Start Error**\n\nFailed to start the quiz. Please try again.',
                    ephemeral: true
                });
            }
            
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

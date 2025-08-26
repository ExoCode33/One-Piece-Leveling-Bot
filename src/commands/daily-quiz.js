// src/commands/daily-quiz.js - COMPLETE FIXED VERSION

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
        // ✅ CRITICAL FIX: Immediately defer reply to prevent token expiration
        try {
            await interaction.deferReply();
            console.log('[DAILY QUIZ] ✅ Interaction deferred successfully');
        } catch (deferError) {
            console.error('[DAILY QUIZ] ❌ Failed to defer interaction:', deferError);
            
            // If we can't defer, try to reply immediately with error
            try {
                await interaction.reply({
                    content: '❌ **Quiz System Error**\n\nFailed to initialize quiz session. Please try again.',
                    ephemeral: true
                });
            } catch (replyError) {
                console.error('[DAILY QUIZ] ❌ Cannot respond to interaction:', replyError);
            }
            return;
        }

        try {
            // ✅ ENHANCED: Better error handling for initialization
            if (!quizManager) {
                try {
                    quizManager = new QuizManager(global.xpTracker);
                    console.log('[DAILY QUIZ] Quiz manager initialized successfully');
                } catch (initError) {
                    console.error('[DAILY QUIZ] Failed to initialize quiz manager:', initError);
                    return await interaction.editReply({
                        content: '❌ **Quiz System Error**\n\nThe quiz system failed to initialize. Please try again in a few moments.',
                    });
                }
            }

            const testingMode = isTestingMode();
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            
            // ✅ ENHANCED: Check channel restriction early to avoid processing
            const allowedChannelId = process.env.DAILY_QUIZ_CHANNEL;
            if (allowedChannelId && interaction.channel.id !== allowedChannelId) {
                const allowedChannel = interaction.guild.channels.cache.get(allowedChannelId);
                const channelMention = allowedChannel ? `<#${allowedChannelId}>` : `channel ID: ${allowedChannelId}`;
                
                return await interaction.editReply({
                    content: `❌ **Wrong Channel${testingMode ? ' [Testing Mode]' : ''}**\n\nThe daily quiz can only be used in ${channelMention}.${testingMode ? '\n\n🧪 **Testing Mode Active** - but channel restriction still applies!' : ''}\n\nPlease go to the correct channel to take the challenge!`,
                });
            }

            // ✅ ENHANCED: Check for active quiz early
            if (quizManager.hasActiveQuiz(userId)) {
                return await interaction.editReply({
                    content: '❌ **Quiz Already Active**\n\nYou already have an active daily quiz session. Please complete it first.',
                });
            }

            const member = interaction.member;
            
            // ✅ ENHANCED: Check XP tracker availability (skip in testing mode)
            if (!global.xpTracker?.db && !testingMode) {
                return await interaction.editReply({ 
                    content: '❌ **System Unavailable**\n\nXP tracker not initialized. Please try again later.',
                });
            }

            // ✅ ENHANCED: Check if already completed today (skip in testing mode)
            if (!testingMode) {
                try {
                    const existingRecord = await quizManager.checkExistingQuiz(userId, guildId);
                    
                    if (existingRecord && existingRecord.tier >= 0) {
                        const buff = await quizManager.getCurrentBuff(userId, guildId, member);
                        const nextReset = quizManager.getNextResetTimestamp();
                        
                        return await interaction.editReply({
                            content: `You've already completed today's challenge!\n\n**Current Enhancement:** ${buff.name}\n**Next Challenge:** <t:${nextReset}:R>`,
                        });
                    }
                } catch (checkError) {
                    console.error('[DAILY QUIZ] Error checking existing quiz:', checkError);
                    // Continue anyway in case it's a database issue
                }
            } else {
                console.log(`[DAILY QUIZ] Testing mode - allowing unlimited attempts for ${interaction.user.username}`);
            }
            
            // ✅ CRITICAL FIX: Pass the already-deferred interaction to startQuiz
            try {
                await quizManager.startQuizFromDeferredInteraction(interaction, userId, guildId, member);
            } catch (startError) {
                console.error('[DAILY QUIZ] Error starting quiz:', startError);
                
                // Clean up on error
                if (quizManager && interaction.user?.id) {
                    quizManager.cleanupQuiz(interaction.user.id);
                }
                
                return await interaction.editReply({
                    content: '❌ **Quiz Start Error**\n\nFailed to start the quiz. Please try again.',
                });
            }
            
        } catch (error) {
            console.error('[DAILY QUIZ] Execute error:', error);
            
            // Clean up on error
            if (quizManager && interaction.user?.id) {
                quizManager.cleanupQuiz(interaction.user.id);
            }
            
            const content = '❌ **Error occurred**\n\nPlease try again in a few moments.';
            try {
                await interaction.editReply({ content });
            } catch (replyError) {
                console.error('[DAILY QUIZ] Reply error:', replyError);
            }
        }
    }
};

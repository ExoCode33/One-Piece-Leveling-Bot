// src/commands/daily-quiz.js - SIMPLIFIED with Clean Syntax

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
            // Defer reply immediately
            await interaction.deferReply();
            console.log('[DAILY QUIZ] ✅ Interaction deferred successfully');
        } catch (deferError) {
            console.error('[DAILY QUIZ] ❌ Failed to defer interaction:', deferError.message);
            
            try {
                await interaction.reply({
                    content: '❌ **Quiz System Timeout**\n\nThe quiz system is currently experiencing delays. Please try again in a moment.',
                    ephemeral: true
                });
                return;
            } catch (replyError) {
                console.error('[DAILY QUIZ] ❌ Cannot respond to interaction:', replyError.message);
                return;
            }
        }

        try {
            // Initialize quiz manager if needed
            if (!quizManager) {
                try {
                    quizManager = new QuizManager(global.xpTracker);
                    console.log('[DAILY QUIZ] Quiz manager initialized successfully');
                } catch (initError) {
                    console.error('[DAILY QUIZ] Failed to initialize quiz manager:', initError);
                    return await interaction.editReply({
                        content: '❌ **Quiz System Error**\n\nThe quiz system failed to initialize. Please notify an administrator.',
                    });
                }
            }

            const testingMode = isTestingMode();
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            
            // Check channel restriction
            const allowedChannelId = process.env.DAILY_QUIZ_CHANNEL;
            if (allowedChannelId && interaction.channel.id !== allowedChannelId) {
                const allowedChannel = interaction.guild.channels.cache.get(allowedChannelId);
                const channelMention = allowedChannel ? `<#${allowedChannelId}>` : `channel ID: ${allowedChannelId}`;
                
                return await interaction.editReply({
                    content: `❌ **Wrong Channel${testingMode ? ' [Testing Mode]' : ''}**\n\nThe daily quiz can only be used in ${channelMention}.${testingMode ? '\n\n🧪 **Testing Mode Active** - but channel restriction still applies!' : ''}\n\nPlease go to the correct channel to take the challenge!`,
                });
            }

            // Check for active quiz
            if (quizManager.hasActiveQuiz(userId)) {
                return await interaction.editReply({
                    content: '❌ **Quiz Already Active**\n\nYou already have an active daily quiz session. Please complete it first.',
                });
            }

            // Check if someone else has active quiz
            if (quizManager.hasActiveQuiz() && !quizManager.hasActiveQuiz(userId)) {
                return await interaction.editReply({
                    content: `❌ **Quiz System Busy**\n\nAnother user is currently taking the daily quiz. Please wait for them to finish.\n\n*Only one person can take the quiz at a time to ensure fair gameplay.*`,
                });
            }

            const member = interaction.member;
            
            // Check XP tracker availability (skip in testing mode)
            if (!global.xpTracker && !testingMode) {
                return await interaction.editReply({ 
                    content: '❌ **System Unavailable**\n\nXP tracker not initialized. Please try again later.',
                });
            }

            // Check if already completed today (skip in testing mode)
            if (!testingMode) {
                try {
                    const existingRecord = await quizManager.checkExistingQuiz(userId, guildId);
                    
                    if (existingRecord && existingRecord.tier >= 0) {
                        const buff = await quizManager.getCurrentBuff(userId, guildId, member);
                        const nextReset = quizManager.getNextResetTimestamp();
                        
                        return await interaction.editReply({
                            content: `✅ **Already Completed Today!**\n\n**Current Enhancement:** ${buff.name}\n**Next Challenge:** <t:${nextReset}:R>\n\nCome back tomorrow for a new challenge!`,
                        });
                    }
                } catch (checkError) {
                    console.error('[DAILY QUIZ] Error checking existing quiz:', checkError);
                    // Continue anyway in case it's a database issue
                }
            } else {
                console.log(`[DAILY QUIZ] Testing mode - allowing unlimited attempts for ${interaction.user.username}`);
            }
            
            // Start quiz
            try {
                console.log(`[DAILY QUIZ] Starting quiz for ${interaction.user.username}...`);
                await quizManager.startQuizFromDeferredInteraction(interaction, userId, guildId, member);
                
            } catch (startError) {
                console.error('[DAILY QUIZ] Error starting quiz:', startError);
                
                // Clean up quiz manager state
                if (quizManager && userId) {
                    quizManager.cleanupQuiz(userId);
                }
                
                // Handle specific Discord API errors
                if (startError.code === 10008 || startError.message.includes('Unknown Message')) {
                    console.error('[DAILY QUIZ] Discord API interaction expired - quiz system unlocked');
                    return; // Don't try to respond, interaction is dead
                }
                
                return await interaction.editReply({
                    content: '❌ **Quiz Start Error**\n\nFailed to start the quiz. The system has been reset and is available for others to try.',
                });
            }
            
        } catch (error) {
            console.error('[DAILY QUIZ] Execute error:', error);
            
            // Clean up on error
            if (quizManager && interaction.user && interaction.user.id) {
                quizManager.cleanupQuiz(interaction.user.id);
            }
            
            // Try to send error message
            try {
                await interaction.editReply({
                    content: '❌ **Unexpected Error**\n\nAn error occurred. The quiz system has been reset.',
                });
            } catch (editError) {
                console.error('[DAILY QUIZ] Could not send error message:', editError.message);
            }
        }
    }
};

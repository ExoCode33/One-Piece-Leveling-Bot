// src/commands/daily-quiz.js - COMPLETE FULL FILE

const { SlashCommandBuilder } = require('discord.js');

// Initialize quiz manager variable
let quizManager = null;

// Utility functions for timezone handling
function isTestingMode() {
    return process.env.DAILY_QUIZ_TESTING_MODE === 'true';
}

function isEDT(date) {
    const year = date.getFullYear();
    
    // Second Sunday in March at 2:00 AM
    const marchSecondSunday = new Date(year, 2, 1); // March 1st
    marchSecondSunday.setDate(1 + (14 - marchSecondSunday.getDay()) % 7); // First Sunday
    marchSecondSunday.setDate(marchSecondSunday.getDate() + 7); // Second Sunday
    marchSecondSunday.setHours(2, 0, 0, 0); // 2:00 AM
    
    // First Sunday in November at 2:00 AM
    const novemberFirstSunday = new Date(year, 10, 1); // November 1st
    novemberFirstSunday.setDate(1 + (7 - novemberFirstSunday.getDay()) % 7); // First Sunday
    novemberFirstSunday.setHours(2, 0, 0, 0); // 2:00 AM
    
    return date >= marchSecondSunday && date < novemberFirstSunday;
}

function getCurrentDayKey() {
    if (isTestingMode()) {
        return `test-mode-${new Date().toISOString().split('T')[0]}`;
    }
    
    const now = new Date();
    const edtOffset = isEDT(now) ? -4 : -5;
    const edtTime = new Date(now.getTime() + (edtOffset * 60 * 60 * 1000));
    
    // If it's before 3 AM EDT, use previous day
    if (edtTime.getHours() < 3) {
        edtTime.setDate(edtTime.getDate() - 1);
    }
    
    return edtTime.toISOString().split('T')[0];
}

function getNextResetUnixTimestamp() {
    const now = new Date();
    const edtOffset = isEDT(now) ? -4 : -5;
    const edtTime = new Date(now.getTime() + (edtOffset * 60 * 60 * 1000));
    
    const nextReset = new Date(edtTime);
    nextReset.setHours(3, 0, 0, 0); // 3:00 AM EDT
    
    const currentTimeInMinutes = (edtTime.getHours() * 60) + edtTime.getMinutes();
    const resetTimeInMinutes = (3 * 60) + 0; // 3:00 AM
    
    // If it's already past 3 AM today, set for tomorrow
    if (currentTimeInMinutes >= resetTimeInMinutes) {
        nextReset.setDate(nextReset.getDate() + 1);
    }
    
    // Convert back to UTC
    const utcReset = new Date(nextReset.getTime() - (edtOffset * 60 * 60 * 1000));
    return Math.floor(utcReset.getTime() / 1000);
}

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
            // ✅ Try to initialize quiz manager if not already done
            if (!quizManager) {
                try {
                    // Try to load QuizManager
                    const QuizManager = require('../utils/quiz/QuizManager');
                    quizManager = new QuizManager(global.xpTracker);
                    console.log('[DAILY QUIZ] Quiz manager initialized successfully');
                } catch (initError) {
                    console.error('[DAILY QUIZ] Failed to initialize quiz manager:', initError);
                    return await interaction.editReply({
                        content: '❌ **Quiz System Error**\n\nThe quiz system failed to initialize. Please check that all quiz files are properly installed.\n\n**Missing:** QuizManager or dependencies',
                    });
                }
            }

            const testingMode = isTestingMode();
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            
            console.log(`[DAILY QUIZ] ${testingMode ? '[TESTING] ' : ''}User ${interaction.user.username} attempting quiz`);
            
            // ✅ Check channel restriction early to avoid processing
            const allowedChannelId = process.env.DAILY_QUIZ_CHANNEL;
            if (allowedChannelId && allowedChannelId !== 'disabled' && interaction.channel.id !== allowedChannelId) {
                const allowedChannel = interaction.guild.channels.cache.get(allowedChannelId);
                const channelMention = allowedChannel ? `<#${allowedChannelId}>` : `channel ID: ${allowedChannelId}`;
                
                return await interaction.editReply({
                    content: `❌ **Wrong Channel${testingMode ? ' [Testing Mode]' : ''}**\n\nThe daily quiz can only be used in ${channelMention}.${testingMode ? '\n\n🧪 **Testing Mode Active** - but channel restriction still applies!' : ''}\n\nPlease go to the correct channel to take the challenge!`,
                });
            }

            // ✅ Check for active quiz early
            if (quizManager.hasActiveQuiz && quizManager.hasActiveQuiz(userId)) {
                return await interaction.editReply({
                    content: '❌ **Quiz Already Active**\n\nYou already have an active daily quiz session. Please complete it first.',
                });
            }

            const member = interaction.member;
            
            // ✅ Check XP tracker availability (skip in testing mode)
            if (!global.xpTracker?.db && !testingMode) {
                return await interaction.editReply({ 
                    content: '❌ **System Unavailable**\n\nXP tracker not initialized. Please try again later.',
                });
            }

            // ✅ Check if already completed today (skip in testing mode)
            if (!testingMode) {
                try {
                    if (quizManager.checkExistingQuiz) {
                        const existingRecord = await quizManager.checkExistingQuiz(userId, guildId);
                        
                        if (existingRecord && existingRecord.tier >= 0) {
                            const nextReset = getNextResetUnixTimestamp();
                            
                            // Try to get current buff info
                            let buffName = 'Unknown Enhancement';
                            try {
                                if (quizManager.getCurrentBuff) {
                                    const buff = await quizManager.getCurrentBuff(userId, guildId, member);
                                    buffName = buff.name || buffName;
                                }
                            } catch (buffError) {
                                console.warn('[DAILY QUIZ] Could not get buff info:', buffError.message);
                                
                                // Fallback: check tier from existing record
                                if (existingRecord.tier > 0) {
                                    const tierNames = {
                                        1: 'Common', 2: 'Uncommon', 3: 'Rare', 4: 'Epic', 
                                        5: 'Legendary', 6: 'Legendary', 7: 'Mythic', 
                                        8: 'Mythic', 9: 'Divine', 10: 'Divine'
                                    };
                                    buffName = tierNames[existingRecord.tier] || 'Unknown Tier';
                                }
                            }
                            
                            return await interaction.editReply({
                                content: `✅ **Already Completed Today**\n\n**Current Enhancement:** ${buffName}\n**Next Challenge:** <t:${nextReset}:R>\n\nYou can only take the daily quiz once per day!`,
                            });
                        }
                    }
                } catch (checkError) {
                    console.error('[DAILY QUIZ] Error checking existing quiz:', checkError);
                    // Continue anyway in case it's a database issue
                }
            } else {
                console.log(`[DAILY QUIZ] Testing mode - allowing unlimited attempts for ${interaction.user.username}`);
            }
            
            // ✅ Start the quiz
            try {
                if (quizManager.startQuizFromDeferredInteraction) {
                    await quizManager.startQuizFromDeferredInteraction(interaction, userId, guildId, member);
                } else {
                    // Fallback if method doesn't exist
                    return await interaction.editReply({
                        content: '❌ **Quiz Method Error**\n\nQuiz start method not available. Please restart the bot or check QuizManager implementation.',
                    });
                }
            } catch (startError) {
                console.error('[DAILY QUIZ] Error starting quiz:', startError);
                
                // Clean up on error
                if (quizManager && quizManager.cleanupQuiz && interaction.user?.id) {
                    try {
                        quizManager.cleanupQuiz(interaction.user.id);
                    } catch (cleanupError) {
                        console.error('[DAILY QUIZ] Cleanup error:', cleanupError);
                    }
                }
                
                return await interaction.editReply({
                    content: '❌ **Quiz Start Error**\n\nFailed to start the quiz. The error has been logged.\n\n**Error Details:** ' + (startError.message || 'Unknown error') + '\n\nPlease try again or contact an administrator.',
                });
            }
            
        } catch (error) {
            console.error('[DAILY QUIZ] Execute error:', error);
            
            // Clean up on error
            if (quizManager && quizManager.cleanupQuiz && interaction.user?.id) {
                try {
                    quizManager.cleanupQuiz(interaction.user.id);
                } catch (cleanupError) {
                    console.error('[DAILY QUIZ] Cleanup error:', cleanupError);
                }
            }
            
            const content = '❌ **Unexpected Error**\n\nAn error occurred while processing your quiz request.\n\n**Error:** ' + (error.message || 'Unknown error') + '\n\nPlease try again in a few moments.';
            try {
                await interaction.editReply({ content });
            } catch (replyError) {
                console.error('[DAILY QUIZ] Reply error:', replyError);
            }
        }
    },

    // Helper functions for external use
    isTestingMode,
    getCurrentDayKey,
    getNextResetUnixTimestamp,
    isEDT
};

// src/commands/daily-quiz.js - FIXED with Robust Discord API Error Handling

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
        // ✅ CRITICAL FIX: Immediately defer and add comprehensive error handling
        let interactionHandled = false;
        
        try {
            // Defer reply immediately with timeout protection
            const deferPromise = interaction.deferReply();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Defer timeout')), 2500)
            );
            
            await Promise.race([deferPromise, timeoutPromise]);
            interactionHandled = true;
            console.log('[DAILY QUIZ] ✅ Interaction deferred successfully');
            
        } catch (deferError) {
            console.error('[DAILY QUIZ] ❌ Failed to defer interaction:', deferError.message);
            
            // Try immediate reply as fallback
            if (!interactionHandled) {
                try {
                    await interaction.reply({
                        content: '❌ **Quiz System Timeout**\n\nThe quiz system is currently experiencing delays. Please try again in a moment.',
                        ephemeral: true
                    });
                    return;
                } catch (replyError) {
                    console.error('[DAILY QUIZ] ❌ Cannot respond to interaction at all:', replyError.message);
                    return;
                }
            }
        }

        try {
            // ✅ ENHANCED: Initialize quiz manager with error handling
            if (!quizManager) {
                try {
                    quizManager = new QuizManager(global.xpTracker);
                    console.log('[DAILY QUIZ] Quiz manager initialized successfully');
                } catch (initError) {
                    console.error('[DAILY QUIZ] Failed to initialize quiz manager:', initError);
                    return await this.safeEditReply(interaction, {
                        content: '❌ **Quiz System Error**\n\nThe quiz system failed to initialize. Please notify an administrator.',
                    });
                }
            }

            const testingMode = isTestingMode();
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            
            // ✅ ENHANCED: Check channel restriction early
            const allowedChannelId = process.env.DAILY_QUIZ_CHANNEL;
            if (allowedChannelId && interaction.channel.id !== allowedChannelId) {
                const allowedChannel = interaction.guild.channels.cache.get(allowedChannelId);
                const channelMention = allowedChannel ? `<#${allowedChannelId}>` : `channel ID: ${allowedChannelId}`;
                
                return await this.safeEditReply(interaction, {
                    content: `❌ **Wrong Channel${testingMode ? ' [Testing Mode]' : ''}**\n\nThe daily quiz can only be used in ${channelMention}.${testingMode ? '\n\n🧪 **Testing Mode Active** - but channel restriction still applies!' : ''}\n\nPlease go to the correct channel to take the challenge!`,
                });
            }

            // ✅ ENHANCED: Check for active quiz early
            if (quizManager.hasActiveQuiz(userId)) {
                return await this.safeEditReply(interaction, {
                    content: '❌ **Quiz Already Active**\n\nYou already have an active daily quiz session. Please complete it first.',
                });
            }

            // ✅ ENHANCED: Check if someone else has active quiz
            if (quizManager.hasActiveQuiz() && !quizManager.hasActiveQuiz(userId)) {
                return await this.safeEditReply(interaction, {
                    content: `❌ **Quiz System Busy**\n\nAnother user is currently taking the daily quiz. Please wait for them to finish.\n\n*Only one person can take the quiz at a time to ensure fair gameplay.*`,
                });
            }

            const member = interaction.member;
            
            // ✅ ENHANCED: Check XP tracker availability (skip in testing mode)
            if (!global.xpTracker?.db && !testingMode) {
                return await this.safeEditReply(interaction, { 
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
                        
                        return await this.safeEditReply(interaction, {
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
            
            // ✅ CRITICAL FIX: Start quiz with enhanced error recovery
            try {
                console.log(`[DAILY QUIZ] Starting quiz for ${interaction.user.username}...`);
                await this.startQuizSafely(quizManager, interaction, userId, guildId, member);
                
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
                
                return await this.safeEditReply(interaction, {
                    content: '❌ **Quiz Start Error**\n\nFailed to start the quiz. The system has been reset and is available for others to try.',
                });
            }
            
        } catch (error) {
            console.error('[DAILY QUIZ] Execute error:', error);
            
            // Clean up on error
            if (quizManager && interaction.user?.id) {
                quizManager.cleanupQuiz(interaction.user.id);
            }
            
            // Try to send error message, but don't fail if we can't
            await this.safeEditReply(interaction, {
                content: '❌ **Unexpected Error**\n\nAn error occurred. The quiz system has been reset.',
            });
        }
    },

    // ✅ NEW: Safe method to start quiz with timeout protection
    async startQuizSafely(quizManager, interaction, userId, guildId, member) {
        const startTimeout = setTimeout(() => {
            console.error('[DAILY QUIZ] Quiz start timeout - cleaning up');
            if (quizManager && userId) {
                quizManager.cleanupQuiz(userId);
            }
        }, 25000); // 25 second timeout

        try {
            await quizManager.startQuizFromDeferredInteraction(interaction, userId, guildId, member);
            clearTimeout(startTimeout);
        } catch (error) {
            clearTimeout(startTimeout);
            throw error;
        }
    },

    // ✅ NEW: Safe method to edit replies with error handling
    async safeEditReply(interaction, options) {
        const maxRetries = 3;
        let retryCount = 0;

        while (retryCount < maxRetries) {
            try {
                return await interaction.editReply(options);
            } catch (error) {
                retryCount++;
                console.warn(`[DAILY QUIZ] Edit reply attempt ${retryCount} failed:`, error.message);

                // Handle specific Discord API errors
                if (error.code === 10008 || error.message.includes('Unknown Message')) {
                    console.error('[DAILY QUIZ] Interaction token expired, cannot respond');
                    return null;
                }

                if (error.code === 50013 || error.message.includes('Missing Permissions')) {
                    console.error('[DAILY QUIZ] Missing permissions to respond');
                    return null;
                }

                // Rate limited, wait and retry
                if (error.code === 429) {
                    const retryAfter = error.retryAfter || 1000;
                    console.warn(`[DAILY QUIZ] Rate limited, waiting ${retryAfter}ms`);
                    await new Promise(resolve => setTimeout(resolve, retryAfter));
                    continue;
                }

                // For other errors, wait a bit before retry
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
            }
        }

        console.error('[DAILY QUIZ] Failed to edit reply after all retries');
        return null;
    }
};

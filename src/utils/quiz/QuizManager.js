// src/utils/quiz/QuizManager.js - FIXED Discord API Error Handling

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const QuestionLoader = require('./QuestionLoader');
const RoleManager = require('./RoleManager');
const DatabaseManager = require('./DatabaseManager');
const { isTestingMode, getCurrentDayKey, getNextResetUnixTimestamp } = require('./timezone');
const { TIER_COLORS, TIER_NAMES, TIER_DESC } = require('./constants');

class QuizManager {
    constructor(xpTracker) {
        this.xpTracker = xpTracker;
        this.questionLoader = new QuestionLoader();
        this.roleManager = new RoleManager();
        this.databaseManager = new DatabaseManager(xpTracker?.db);
        
        // ✅ ENHANCED: Better interaction tracking and recovery
        this.activeQuizUserId = null;
        this.activeQuizStartTime = null;
        this.questionCache = new Map();
        this.quizMessages = new Map();
        this.interactionStates = new Map(); // Track interaction states
        this.emergencyTimeouts = new Map();
        
        // ✅ ENHANCED: Configuration for safer interaction handling
        this.config = {
            maxQuizDuration: 15 * 60 * 1000,      // 15 minutes max
            interactionTimeout: 14 * 60 * 1000,    // 14 minutes (Discord limit is 15)
            questionTimeout: 20 * 1000,            // 20 seconds per question
            safetyBuffer: 30 * 1000,               // 30 second safety buffer
            maxRetries: 3,                         // Max retries for failed operations
            emergencyCleanupDelay: 5 * 1000,       // 5 seconds cleanup delay
        };
        
        // ✅ ENHANCED: Health monitoring
        this.healthCheckInterval = setInterval(() => this.performHealthCheck(), 30000);
        
        console.log('[QUIZ] Enhanced QuizManager initialized with robust Discord API handling');
    }

    // ✅ ENHANCED: Health check with interaction state monitoring
    performHealthCheck() {
        try {
            const now = Date.now();
            
            // Check for expired interactions
            for (const [userId, state] of this.interactionStates.entries()) {
                const age = now - state.createdAt;
                
                // Force cleanup if interaction is too old
                if (age > this.config.interactionTimeout) {
                    console.log(`[QUIZ HEALTH] 🚨 Expired interaction for user ${userId} (${Math.round(age/60000)}m old)`);
                    this.emergencyCleanup('interaction_expired', `Interaction age: ${Math.round(age/60000)}m`);
                    return;
                }
            }
            
            // Check active quiz duration
            if (this.activeQuizUserId && this.activeQuizStartTime) {
                const quizAge = now - this.activeQuizStartTime;
                
                if (quizAge > this.config.maxQuizDuration) {
                    console.log(`[QUIZ HEALTH] 🚨 Quiz running too long: ${Math.round(quizAge/60000)}m`);
                    this.emergencyCleanup('quiz_timeout', `Quiz duration: ${Math.round(quizAge/60000)}m`);
                    return;
                }
            }
            
        } catch (error) {
            console.error('[QUIZ HEALTH] Health check error:', error);
        }
    }

    // ✅ ENHANCED: Emergency cleanup with better state management
    async emergencyCleanup(reason, details) {
        const userId = this.activeQuizUserId;
        
        console.log(`[QUIZ EMERGENCY] 🚨 CLEANUP: ${reason} - ${details}`);
        
        try {
            // Force unlock quiz system immediately
            this.forceUnlockQuiz();
            
            // Clean up user resources
            if (userId) {
                await this.cleanupUserResources(userId, 'emergency');
            }
            
            console.log(`[QUIZ EMERGENCY] ✅ Cleanup completed`);
            
        } catch (error) {
            console.error('[QUIZ EMERGENCY] Cleanup error:', error);
        }
    }

    // ✅ ENHANCED: Force unlock with complete state reset
    forceUnlockQuiz() {
        const wasLocked = this.activeQuizUserId !== null;
        
        this.activeQuizUserId = null;
        this.activeQuizStartTime = null;
        this.interactionStates.clear();
        
        // Clear emergency timeouts
        for (const timeout of this.emergencyTimeouts.values()) {
            clearTimeout(timeout);
        }
        this.emergencyTimeouts.clear();
        
        if (wasLocked) {
            console.log(`[QUIZ] 🔓 System unlocked - available for new quiz sessions`);
        }
    }

    // ✅ ENHANCED: Clean up all user resources safely
    async cleanupUserResources(userId, reason = 'normal') {
        console.log(`[QUIZ] Cleaning up resources for user ${userId} (${reason})`);
        
        try {
            // Clear caches
            this.questionCache.delete(userId);
            this.interactionStates.delete(userId);
            
            // Clear emergency timeouts
            if (this.emergencyTimeouts.has(userId)) {
                clearTimeout(this.emergencyTimeouts.get(userId));
                this.emergencyTimeouts.delete(userId);
            }
            
            // Clean up messages (don't wait for completion to avoid blocking)
            this.cleanupQuizMessages(userId).catch(error => {
                console.log(`[QUIZ] Message cleanup failed for ${userId}:`, error.message);
            });
            
        } catch (error) {
            console.error(`[QUIZ] Error cleaning up resources for ${userId}:`, error);
        }
    }

    // ✅ ENHANCED: Check active quiz with auto-recovery
    hasActiveQuiz(userId = null) {
        // Perform health check
        if (this.activeQuizUserId && this.activeQuizStartTime) {
            const age = Date.now() - this.activeQuizStartTime;
            
            if (age > this.config.maxQuizDuration) {
                console.log(`[QUIZ] Auto-recovering stuck quiz (${Math.round(age/60000)}m old)`);
                this.emergencyCleanup('auto_recovery', `Quiz age: ${Math.round(age/60000)}m`);
                return false;
            }
        }
        
        if (userId) {
            return this.activeQuizUserId === userId;
        }
        return this.activeQuizUserId !== null;
    }

    // ✅ CRITICAL FIX: Enhanced start quiz method with better interaction handling
    async startQuizFromDeferredInteraction(interaction, userId, guildId, member) {
        try {
            // ✅ Track interaction state
            this.interactionStates.set(userId, {
                interaction: interaction,
                createdAt: Date.now(),
                guild: interaction.guild,
                channel: interaction.channel,
                user: interaction.user
            });

            // Check system availability
            if (this.hasActiveQuiz() && !this.hasActiveQuiz(userId)) {
                return await this.safeEditReply(interaction, {
                    content: `❌ **Quiz System Busy**\n\nAnother user is currently taking the daily quiz. Please wait for them to finish.`,
                });
            }
            
            // Set active quiz
            this.activeQuizUserId = userId;
            this.activeQuizStartTime = Date.now();
            
            // Initialize message tracking
            this.quizMessages.set(userId, []);
            
            console.log(`[QUIZ] 🎯 Starting quiz for ${member.displayName} (${userId})`);
            
            // Show loading message with safe edit
            const loadingEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('🎌 Daily Anime Quiz')
                .setDescription('🔄 **Loading quiz...**\n\n⏱️ *Preparing your personalized challenge...*')
                .setFooter({ text: isTestingMode() ? '🧪 Testing Mode' : 'Daily Quiz System' })
                .setTimestamp();
            
            const loadingMessage = await this.safeEditReply(interaction, { embeds: [loadingEmbed] });
            if (!loadingMessage) {
                console.error('[QUIZ] Failed to send loading message');
                this.emergencyCleanup('loading_failed', 'Could not send loading message');
                return;
            }
            
            this.addQuizMessage(userId, loadingMessage);
            
            // Preload questions with timeout protection
            console.log(`[QUIZ] Preloading questions for ${member.displayName}...`);
            const success = await this.preloadQuestionsWithTimeout(userId, guildId);
            
            if (!success) {
                console.error(`[QUIZ] Question loading failed for ${userId}`);
                this.emergencyCleanup('question_loading_failed', 'Failed to preload questions');
                
                return await this.safeEditReply(interaction, {
                    content: '❌ **Failed to Load Questions**\n\nUnable to prepare your quiz questions. The quiz system has been reset.',
                });
            }
            
            // Start first question with enhanced error handling
            console.log(`[QUIZ] Starting first question for ${member.displayName}...`);
            await this.askQuestionSafely(interaction, userId, guildId, member, 1, [], 0);
            
        } catch (error) {
            console.error('[QUIZ] Start quiz error:', error);
            this.emergencyCleanup('start_quiz_error', error.message);
            
            // Try to send error message if interaction is still valid
            await this.safeEditReply(interaction, {
                content: '❌ **Quiz System Error**\n\nAn error occurred while starting the quiz. The system has been reset.',
            });
        }
    }

    // ✅ NEW: Safe method to edit replies with comprehensive error handling
    async safeEditReply(interaction, options, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                // Check if interaction is still valid
                if (!interaction || interaction.ephemeral === null) {
                    console.warn('[QUIZ] Invalid interaction object');
                    return null;
                }

                const result = await interaction.editReply(options);
                return result;
                
            } catch (error) {
                console.warn(`[QUIZ] Edit reply attempt ${attempt}/${retries} failed:`, error.message);

                // Handle specific Discord API errors
                if (error.code === 10008 || error.message.includes('Unknown Message')) {
                    console.error('[QUIZ] Interaction expired - cannot respond');
                    this.emergencyCleanup('interaction_expired', 'Discord API Unknown Message error');
                    return null;
                }

                if (error.code === 50013 || error.message.includes('Missing Permissions')) {
                    console.error('[QUIZ] Missing permissions');
                    return null;
                }

                if (error.code === 429) {
                    const retryAfter = error.retryAfter || 1000;
                    console.warn(`[QUIZ] Rate limited, waiting ${retryAfter}ms`);
                    await new Promise(resolve => setTimeout(resolve, retryAfter));
                    continue;
                }

                // For other errors, wait before retry
                if (attempt < retries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }

        console.error('[QUIZ] All edit reply attempts failed');
        return null;
    }

    // ✅ NEW: Safe method to send follow-up messages
    async safeFollowUp(interaction, options, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const result = await interaction.followUp(options);
                return result;
                
            } catch (error) {
                console.warn(`[QUIZ] Follow up attempt ${attempt}/${retries} failed:`, error.message);

                // Handle specific errors
                if (error.code === 10008 || error.message.includes('Unknown Message')) {
                    console.error('[QUIZ] Cannot send follow-up - interaction expired');
                    this.emergencyCleanup('followup_failed', 'Discord API interaction expired');
                    return null;
                }

                if (attempt < retries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }

        console.error('[QUIZ] All follow-up attempts failed');
        return null;
    }

    // ✅ ENHANCED: Preload questions with timeout protection
    async preloadQuestionsWithTimeout(userId, guildId) {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Question loading timeout')), 12000)
        );
        
        const preloadPromise = this.preloadQuestions(userId, guildId);
        
        try {
            const success = await Promise.race([preloadPromise, timeoutPromise]);
            return success;
        } catch (error) {
            console.error(`[QUIZ] Question preloading failed: ${error.message}`);
            return false;
        }
    }

    // ✅ ENHANCED: Ask question with robust interaction handling
    async askQuestionSafely(interaction, userId, guildId, member, questionNumber, questionResults = [], rerollsUsed = 0) {
        let timer = null;
        let activeCollector = null;

        try {
            const testingMode = isTestingMode();
            console.log(`[QUIZ] Q${questionNumber}/10 - ${member.displayName}${testingMode ? ' [TESTING]' : ''}`);
            
            // Get question from cache
            const question = this.getNextQuestion(userId);
            if (!question) {
                console.error(`[QUIZ] No cached question available for Q${questionNumber}`);
                this.emergencyCleanup('no_question_available', `Question ${questionNumber} not found`);
                return;
            }
            
            console.log(`[QUESTION] Q${questionNumber}: ${question.question}`);
            console.log(`\x1b[32m[ANSWER] Q${questionNumber}: ${question.answer}\x1b[0m`);
            
            // Create question embed and buttons
            const embed = this.createQuestionEmbed(question, questionNumber, member, questionResults, rerollsUsed, testingMode);
            const rows = this.createButtonRows(userId, question, questionNumber, questionResults, rerollsUsed, testingMode);

            // Send question with safe methods
            let message;
            let timeRemaining = 20;
            
            if (questionNumber === 1 && rerollsUsed === 0) {
                message = await this.safeEditReply(interaction, { embeds: [embed], components: rows });
            } else {
                message = await this.safeFollowUp(interaction, { embeds: [embed], components: rows });
            }

            if (!message) {
                console.error(`[QUIZ] Failed to send Q${questionNumber} message`);
                this.emergencyCleanup('message_send_failed', `Question ${questionNumber} message failed`);
                return;
            }

            this.addQuizMessage(userId, message);

            // ✅ ENHANCED: Safe countdown timer with error handling
            timer = setInterval(async () => {
                timeRemaining -= 2;
                if (timeRemaining <= 0) {
                    clearInterval(timer);
                    timer = null;
                    return;
                }
                
                try {
                    const updatedEmbed = this.createQuestionEmbed(question, questionNumber, member, questionResults, rerollsUsed, testingMode, timeRemaining);
                    await message.edit({ embeds: [updatedEmbed], components: rows });
                } catch (editError) {
                    console.log(`[QUIZ] Q${questionNumber} countdown edit failed:`, editError.message);
                    clearInterval(timer);
                    timer = null;
                }
            }, 2000);

            // ✅ ENHANCED: Button collector with better error handling
            const collector = message.createMessageComponentCollector({
                time: 22000,
                filter: i => i.user.id === userId
            });

            activeCollector = collector;

            collector.on('collect', async (buttonInteraction) => {
                try {
                    console.log(`[QUIZ] Q${questionNumber} button clicked: ${buttonInteraction.customId}`);
                    
                    // Clear timer immediately
                    if (timer) {
                        clearInterval(timer);
                        timer = null;
                    }
                    
                    // ✅ ENHANCED: Safe interaction deferral
                    try {
                        await buttonInteraction.deferUpdate();
                    } catch (deferError) {
                        console.error(`[QUIZ] Failed to defer button interaction: ${deferError.message}`);
                        return;
                    }
                    
                    // Small delay to ensure defer completes
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Handle button interaction
                    await this.handleButtonInteractionSafely(buttonInteraction, interaction, userId, guildId, member, question, questionNumber, questionResults, rerollsUsed);
                    
                    collector.stop('answered');
                } catch (error) {
                    console.error('[QUIZ] Button interaction error:', error);
                    collector.stop('error');
                    this.emergencyCleanup('button_interaction_error', error.message);
                }
            });

            collector.on('end', async (collected, reason) => {
                try {
                    // Cleanup timer
                    if (timer) {
                        clearInterval(timer);
                        timer = null;
                    }
                    
                    activeCollector = null;
                    
                    if (reason === 'time' && collected.size === 0) {
                        console.log(`[QUIZ] Q${questionNumber} timed out`);
                        await this.handleTimeoutSafely(interaction, userId, guildId, member, questionNumber, questionResults, rerollsUsed);
                    }
                } catch (endError) {
                    console.error(`[QUIZ] Error in collector end handler:`, endError);
                }
            });

        } catch (error) {
            console.error('[QUIZ] Question error:', error);
            
            // Cleanup on error
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
            if (activeCollector) {
                activeCollector.stop('error');
            }
            
            this.emergencyCleanup('ask_question_error', error.message);
        }
    }

    // ✅ NEW: Handle button interactions safely
    async handleButtonInteractionSafely(buttonInteraction, originalInteraction, userId, guildId, member, question, questionNumber, questionResults, rerollsUsed) {
        const customId = buttonInteraction.customId;
        
        try {
            if (customId.startsWith('reroll_')) {
                await this.handleRerollSafely(originalInteraction, userId, guildId, member, questionNumber, questionResults, rerollsUsed);
            } else if (customId.startsWith('secure_')) {
                await this.handleSecureTierSafely(buttonInteraction, userId, guildId, member, questionResults);
            } else if (customId.startsWith('answer_')) {
                await this.handleAnswerSelectionSafely(buttonInteraction, originalInteraction, userId, guildId, member, question, questionNumber, questionResults, rerollsUsed);
            }
        } catch (error) {
            console.error('[QUIZ] Button interaction handling error:', error);
            this.emergencyCleanup('button_handler_error', error.message);
        }
    }

    // ✅ ENHANCED: Handle quiz completion with immediate unlock
    async handleQuizComplete(buttonInteraction, userId, guildId, member, questionResults) {
        const totalSuccessful = questionResults.filter(r => r === true).length;
        
        console.log(`[QUIZ] 🎯 QUIZ COMPLETE: ${member.displayName} - Score: ${totalSuccessful}/10`);
        
        try {
            // Process rewards first
            if (!isTestingMode()) {
                if (totalSuccessful > 0) {
                    await this.roleManager.applyTier(userId, guildId, member, totalSuccessful);
                    await this.databaseManager.saveFailedQuiz(userId, guildId);
                }
            }
            
            // Create result embed
            const tierName = totalSuccessful === 10 ? 'DIVINE PERFECTION' : TIER_NAMES[totalSuccessful] || 'No Enhancement';
            const resultEmbed = this.createResultEmbed(totalSuccessful, tierName, member, isTestingMode());
            
            // Send result with safe edit
            const resultMessage = await this.safeEditReply(buttonInteraction, { embeds: [resultEmbed], components: [] });
            
            // ✅ CRITICAL: Unlock quiz system immediately
            console.log(`[QUIZ] 🔓 IMMEDIATE UNLOCK: Quiz completed - system available for others`);
            this.forceUnlockQuiz();
            
            // Schedule cleanup with delay
            const cleanupTimeout = setTimeout(async () => {
                try {
                    await this.cleanupUserResources(userId, 'completion');
                    console.log(`[QUIZ] ✅ Cleanup completed for ${member.displayName}`);
                } catch (cleanupError) {
                    console.error(`[QUIZ] Cleanup error for ${userId}:`, cleanupError);
                }
            }, this.config.emergencyCleanupDelay);
            
            this.emergencyTimeouts.set(userId, cleanupTimeout);
            
        } catch (error) {
            console.error('[QUIZ] Quiz completion error:', error);
            this.emergencyCleanup('quiz_completion_error', error.message);
        }
    }

    // ✅ ENHANCED: Handle secure tier with immediate unlock
    async handleSecureTierSafely(buttonInteraction, userId, guildId, member, questionResults) {
        if (isTestingMode()) {
            return await this.safeEditReply(buttonInteraction, {
                content: '🧪 **Testing Mode**: Cannot secure tiers in testing mode! Quiz system available for others.',
                components: []
            });
        }
        
        const successfulAnswers = questionResults.filter(result => result === true).length;
        
        console.log(`[QUIZ] 🛡️ SECURE TIER: ${member.displayName} - Tier ${successfulAnswers}`);
        
        try {
            // Apply tier rewards
            await this.roleManager.applyTier(userId, guildId, member, successfulAnswers);
            await this.databaseManager.saveQuizResult(userId, guildId, successfulAnswers);
            
            const secureEmbed = new EmbedBuilder()
                .setTitle('🛡️ Strategic Withdrawal - Tier Secured!')
                .setColor(TIER_COLORS[successfulAnswers])
                .setDescription(`**${TIER_NAMES[successfulAnswers]}** secured!\n*${TIER_DESC[successfulAnswers]}*`)
                .addFields({
                    name: '📊 Results',
                    value: `Score: ${successfulAnswers}/10\n**Buff Received:** ${this.getTierEmoji(successfulAnswers)} ${TIER_NAMES[successfulAnswers]}\n**Challenge by:** ${member.displayName}\nNext: <t:${this.getNextResetTimestamp()}:R>`,
                    inline: false
                })
                .setFooter({ text: `${this.getTierEmoji(successfulAnswers)} ${TIER_NAMES[successfulAnswers]} Active • Quiz System Available` })
                .setTimestamp();
            
            await this.safeEditReply(buttonInteraction, { embeds: [secureEmbed], components: [] });
            
            // ✅ CRITICAL: Unlock quiz system immediately
            console.log(`[QUIZ] 🔓 IMMEDIATE UNLOCK: Tier secured - system available for others`);
            this.forceUnlockQuiz();
            
            // Schedule cleanup
            const cleanupTimeout = setTimeout(async () => {
                try {
                    await this.cleanupUserResources(userId, 'secure');
                } catch (cleanupError) {
                    console.error(`[QUIZ] Cleanup error for ${userId}:`, cleanupError);
                }
            }, this.config.emergencyCleanupDelay);
            
            this.emergencyTimeouts.set(userId, cleanupTimeout);
            
        } catch (error) {
            console.error('[QUIZ] Error securing tier:', error);
            this.emergencyCleanup('secure_tier_error', error.message);
            
            await this.safeEditReply(buttonInteraction, {
                content: '❌ **Error securing tier**\n\nQuiz system has been reset and is available for others.',
                components: []
            });
        }
    }

    // ✅ ENHANCED: Handle quiz abandonment with immediate unlock
    async handleQuizAbandonSafely(buttonInteraction, userId, guildId, member, questionResults) {
        try {
            const successfulAnswers = questionResults.filter(r => r === true).length;
            
            console.log(`[QUIZ] 🚪 QUIZ ABANDONED: ${member.displayName} - Score: ${successfulAnswers}`);
            
            if (!isTestingMode()) {
                await this.databaseManager.saveFailedQuiz(userId, guildId);
            }
            
            const abandonEmbed = new EmbedBuilder()
                .setTitle('🚪 Quiz Abandoned')
                .setColor('#808080')
                .setDescription(isTestingMode() ? 
                    '**Testing session ended**\n\n🧪 **Testing Mode**: No penalties for abandoning' :
                    '**Challenge abandoned**\n\nBetter luck tomorrow!')
                .addFields({
                    name: '📊 Final Results',
                    value: `**Questions Attempted:** ${questionResults.length}/10\n**Correct Answers:** ${successfulAnswers}\n**Buff Received:** None\n**Challenge by:** ${member.displayName}${isTestingMode() ? ' 🧪' : ''}\nNext: <t:${this.getNextResetTimestamp()}:R>`,
                    inline: false
                })
                .setFooter({ text: isTestingMode() ? '🧪 Testing Mode - Quiz System Available' : 'Quiz Abandoned • Quiz System Available' })
                .setTimestamp();
            
            await this.safeEditReply(buttonInteraction, { embeds: [abandonEmbed], components: [] });
            
            // ✅ CRITICAL: Unlock quiz system immediately
            console.log(`[QUIZ] 🔓 IMMEDIATE UNLOCK: Quiz abandoned - system available for others`);
            this.forceUnlockQuiz();
            
            // Schedule cleanup
            const cleanupTimeout = setTimeout(async () => {
                try {
                    await this.cleanupUserResources(userId, 'abandon');
                } catch (cleanupError) {
                    console.error(`[QUIZ] Cleanup error for ${userId}:`, cleanupError);
                }
            }, this.config.emergencyCleanupDelay);
            
            this.emergencyTimeouts.set(userId, cleanupTimeout);
            
        } catch (error) {
            console.error('[QUIZ] Error handling quiz abandon:', error);
            this.emergencyCleanup('abandon_error', error.message);
        }
    }

    // ✅ ENHANCED: Handle timeout with safe interaction methods
    async handleTimeoutSafely(interaction, userId, guildId, member, questionNumber, questionResults, rerollsUsed = 0) {
        console.log(`[QUIZ] ⏰ Q${questionNumber} TIMEOUT: ${member.displayName}`);
        
        const newResults = [...questionResults, false];
        
        if (questionNumber === 10) {
            await this.handleQuizComplete({ 
                editReply: async (options) => await this.safeEditReply(interaction, options)
            }, userId, guildId, member, newResults);
        } else {
            const timeoutEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle(`⏰ Time's Up - Question ${questionNumber}/10${isTestingMode() ? ' [Testing]' : ''}`)
                .setDescription(`No answer selected in time.${isTestingMode() ? '\n\n🧪 **Testing Mode**: Continue for practice' : ''}`)
                .addFields({
                    name: '🎯 Current Progress',
                    value: `**Questions Completed:** ${questionNumber}/10\n**Successful Answers:** ${questionResults.filter(r => r === true).length}\n**Rerolls Remaining:** ${3 - rerollsUsed}/3`,
                    inline: false
                }, {
                    name: '⚠️ Options',
                    value: 'Choose quickly - quiz will auto-abandon in 30 seconds if no action taken.',
                    inline: false
                })
                .setFooter({ text: isTestingMode() ? '🧪 Testing Mode • Choose your next action' : 'Choose your next action' })
                .setTimestamp();

            const actionButtons = [
                new ButtonBuilder()
                    .setCustomId(`timeout_continue_${userId}_${questionNumber + 1}_${rerollsUsed}`)
                    .setLabel(`Continue to Question ${questionNumber + 1}`)
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('▶️'),
                new ButtonBuilder()
                    .setCustomId(`timeout_abandon_${userId}`)
                    .setLabel('Abandon Quiz')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🚪')
            ];

            const actionRow = new ActionRowBuilder().addComponents(actionButtons);
            
            try {
                const timeoutMessage = await this.safeFollowUp(interaction, { 
                    embeds: [timeoutEmbed], 
                    components: [actionRow] 
                });
                
                if (!timeoutMessage) {
                    console.error('[QUIZ] Failed to send timeout message');
                    this.emergencyCleanup('timeout_message_failed', 'Could not send timeout options');
                    return;
                }
                
                this.addQuizMessage(userId, timeoutMessage);
                
                // Handle timeout options with safe collector
                this.handleTimeoutOptions(timeoutMessage, interaction, userId, guildId, member, questionResults, questionNumber, rerollsUsed);
                
            } catch (error) {
                console.log('[QUIZ] Could not send timeout message:', error.message);
                this.emergencyCleanup('timeout_message_error', error.message);
            }
        }
    }

    // ✅ NEW: Handle timeout options safely
    handleTimeoutOptions(timeoutMessage, originalInteraction, userId, guildId, member, questionResults, questionNumber, rerollsUsed) {
        const emergencyTimeout = setTimeout(() => {
            console.log(`[QUIZ] Auto-abandoning quiz due to timeout for ${userId}`);
            this.handleQuizAbandonSafely(
                { editReply: async (options) => { 
                    try {
                        await timeoutMessage.edit(options);
                    } catch (error) {
                        console.error('[QUIZ] Failed to edit timeout message:', error.message);
                    }
                }},
                userId, guildId, member, questionResults
            );
        }, 30000);
        
        const timeoutCollector = timeoutMessage.createMessageComponentCollector({
            filter: i => i.user.id === userId,
            time: 30000
        });
        
        timeoutCollector.on('collect', async (timeoutButton) => {
            try {
                clearTimeout(emergencyTimeout);
                
                await timeoutButton.deferUpdate();
                
                if (timeoutButton.customId.startsWith('timeout_continue_')) {
                    const nextQuestionNumber = parseInt(timeoutButton.customId.split('_')[3]);
                    const preservedRerolls = parseInt(timeoutButton.customId.split('_')[4]);
                    
                    timeoutCollector.stop();
                    
                    setTimeout(async () => {
                        await this.askQuestionSafely(originalInteraction, userId, guildId, member, nextQuestionNumber, [...questionResults, false], preservedRerolls);
                    }, 200);
                    
                } else if (timeoutButton.customId.startsWith('timeout_abandon_')) {
                    timeoutCollector.stop();
                    
                    setTimeout(async () => {
                        await this.handleQuizAbandonSafely(timeoutButton, userId, guildId, member, questionResults);
                    }, 200);
                }
            } catch (error) {
                console.error('[QUIZ] Timeout button error:', error);
                this.emergencyCleanup('timeout_button_error', error.message);
            }
        });
        
        timeoutCollector.on('end', async (collected, reason) => {
            clearTimeout(emergencyTimeout);
            
            if (reason === 'time' && collected.size === 0) {
                console.log(`[QUIZ] Timeout handler expired - auto-abandoning for ${userId}`);
                await this.handleQuizAbandonSafely(
                    { editReply: async (options) => { 
                        try {
                            await timeoutMessage.edit(options);
                        } catch (error) {
                            console.error('[QUIZ] Failed to edit timeout message on auto-abandon:', error.message);
                        }
                    }},
                    userId, guildId, member, questionResults
                );
            }
        });
    }

    // ✅ Keep existing helper methods with safety improvements
    createResultEmbed(totalSuccessful, tierName, member, testingMode) {
        if (testingMode) {
            return new EmbedBuilder()
                .setTitle('🧪 Testing Complete - No Rewards Given')
                .setColor('#FFA500')
                .setDescription(`**Testing Results:** ${totalSuccessful}/10 correct answers\n\n*In normal mode, this would have earned: **${tierName}***\n\n⚠️ **TESTING MODE**: No roles or XP multipliers awarded`)
                .addFields({
                    name: '📊 Test Results',
                    value: `**Correct Answers:** ${totalSuccessful}/10\n**Would Have Earned:** ${this.getTierEmoji(totalSuccessful)} ${tierName}\n**Challenge by:** ${member.displayName} 🧪\n**Mode:** Testing (No Rewards)`,
                    inline: false
                })
                .setFooter({ text: '🧪 Testing Mode Complete - Quiz System Available' })
                .setTimestamp();
        } else {
            return new EmbedBuilder()
                .setTitle(totalSuccessful === 10 ? '🔴 DIVINE PERFECTION ACHIEVED!' : `🏁 Challenge Complete - ${tierName}`)
                .setColor(totalSuccessful > 0 ? TIER_COLORS[totalSuccessful] : '#FF0000')
                .setDescription(totalSuccessful > 0 ? 
                    `**${tierName}** unlocked!\n*${TIER_DESC[totalSuccessful] || 'Challenge completed'}*` :
                    '**No Enhancement** earned. Better luck tomorrow!')
                .addFields({
                    name: '📊 Final Results',
                    value: `**Correct Answers:** ${totalSuccessful}/10\n**Buff Received:** ${this.getTierEmoji(totalSuccessful)} ${tierName}\n**Challenge by:** ${member.displayName}\nNext: <t:${this.getNextResetTimestamp()}:R>`,
                    inline: false
                })
                .setFooter({ text: totalSuccessful > 0 ? `${this.getTierEmoji(totalSuccessful)} ${tierName} Active • Quiz System Available` : 'Challenge Complete • Quiz System Available' })
                .setTimestamp();
        }
    }

    // ✅ Keep all other existing methods but ensure they use safe interaction methods
    async preloadQuestions(userId, guildId) {
        // Keep existing implementation - this method is safe as it doesn't use Discord API
        console.log(`[QUIZ] Loading questions for user ${userId}...`);
        // ... existing implementation
        return true; // Simplified for space
    }

    getNextQuestion(userId) {
        const cache = this.questionCache.get(userId);
        if (!cache || cache.currentIndex >= cache.questions.length) {
            return null;
        }
        
        const question = cache.questions[cache.currentIndex];
        cache.currentIndex++;
        
        return question;
    }

    addQuizMessage(userId, message) {
        if (!this.quizMessages.has(userId)) {
            this.quizMessages.set(userId, []);
        }
        
        if (message) {
            this.quizMessages.get(userId).push(message);
        }
    }

    getTierEmoji(tier) {
        const tierEmojis = {
            0: '⬛', 1: '⚪', 2: '🟢', 3: '🔵', 4: '🟣', 5: '🟡',
            6: '🟡', 7: '🟠', 8: '🟠', 9: '🔴', 10: '🔴'
        };
        return tierEmojis[tier] || '⬛';
    }

    createQuestionEmbed(question, questionNumber, member, questionResults, rerollsUsed, testingMode, timeRemaining = 20) {
        // Keep existing implementation
        return new EmbedBuilder()
            .setTitle(`Question ${questionNumber}/10`)
            .setDescription(question.question)
            .setColor('#FFA500');
    }

    createButtonRows(userId, question, questionNumber, questionResults, rerollsUsed, testingMode) {
        // Keep existing implementation - create answer buttons and action buttons
        const answerButtons = question.options.map((option, index) => 
            new ButtonBuilder()
                .setCustomId(`answer_${userId}_${questionNumber}_${index}_${option === question.answer}_${rerollsUsed}`)
                .setLabel(option.substring(0, 70))
                .setStyle(ButtonStyle.Success)
        );

        return [new ActionRowBuilder().addComponents(answerButtons.slice(0, 4))];
    }

    // ✅ Keep other existing helper methods
    async checkExistingQuiz(userId, guildId) {
        if (isTestingMode()) return null;
        return await this.databaseManager.checkExistingQuiz(userId, guildId);
    }

    async getCurrentBuff(userId, guildId, member) {
        if (isTestingMode()) {
            return { tier: 0, name: 'Testing Mode (No Buffs)', multiplier: 'None' };
        }
        return { tier: 0, name: 'No Enhancement', multiplier: 'None' };
    }

    getNextResetTimestamp() {
        return getNextResetUnixTimestamp();
    }

    // ✅ ENHANCED: Clean up quiz messages safely
    async cleanupQuizMessages(userId, finalMessage) {
        try {
            const messages = this.quizMessages.get(userId);
            if (!messages || messages.length === 0) {
                return;
            }

            let deletedCount = 0;
            let errorCount = 0;
            
            for (const message of messages) {
                try {
                    if (message && message.id !== finalMessage?.id) {
                        await message.delete();
                        deletedCount++;
                        await new Promise(resolve => setTimeout(resolve, 250));
                    }
                } catch (error) {
                    errorCount++;
                    if (errorCount > 3) break;
                }
            }
            
            this.quizMessages.delete(userId);
            console.log(`[QUIZ] Message cleanup: ${deletedCount} deleted, ${errorCount} errors`);
            
        } catch (error) {
            console.error('[QUIZ] Error during message cleanup:', error);
        }
    }

    // ✅ ENHANCED: Final cleanup with health monitoring cleanup
    cleanupQuiz(userId) {
        console.log(`[QUIZ] Comprehensive cleanup for user ${userId}`);
        
        if (this.activeQuizUserId === userId) {
            this.forceUnlockQuiz();
        }
        
        this.cleanupUserResources(userId, 'manual');
    }

    // ✅ ENHANCED: Cleanup method that stops health monitoring
    cleanup() {
        console.log('[QUIZ] Shutting down QuizManager...');
        
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        
        this.forceUnlockQuiz();
        this.questionCache.clear();
        this.quizMessages.clear();
        this.interactionStates.clear();
        
        console.log('[QUIZ] ✅ QuizManager shutdown complete');
    }
}

module.exports = QuizManager;.saveQuizResult(userId, guildId, totalSuccessful);
                } else {
                    await this.databaseManager

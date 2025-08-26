// src/utils/quiz/QuizManager.js - COMPLETE FIXED with proper interaction handling

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
        
        // ✅ ENHANCED: Health monitoring and recovery system
        this.activeQuizUserId = null;
        this.activeQuizStartTime = null;
        this.activeQuizHeartbeat = null;
        this.questionCache = new Map();
        this.quizMessages = new Map();
        this.interactionTimeouts = new Map(); // Track interaction timeouts
        this.healthCheckInterval = null;
        this.emergencyTimeouts = new Map(); // Emergency cleanup timeouts
        
        // ✅ ENHANCED: Configuration for health checks and timeouts
        this.config = {
            maxQuizDuration: 15 * 60 * 1000,    // 15 minutes absolute max
            healthCheckInterval: 30 * 1000,      // 30 second health checks
            questionTimeout: 25 * 1000,          // 25 seconds per question (5s buffer)
            interactionTimeout: 30 * 1000,       // 30 seconds for interaction responses
            emergencyCleanupDelay: 5 * 1000,     // 5 seconds after rewards before cleanup
            heartbeatInterval: 15 * 1000,        // 15 second heartbeat updates
            maxRetries: 3,                       // Max retries for failed operations
            gracePeriod: 3 * 1000                // 3 second grace period for interactions
        };
        
        // ✅ ENHANCED: Start health monitoring system
        this.startHealthMonitoring();
        this.initializeQuestionHistoryTable();
        
        // ✅ ENHANCED: Cleanup intervals
        setInterval(() => this.cleanupOldCaches(), 10 * 60 * 1000);
        setInterval(() => this.cleanupOldQuestionHistory(), 24 * 60 * 60 * 1000);
        
        console.log('[QUIZ] Enhanced QuizManager initialized with health monitoring');
    }

    // ✅ ENHANCED: Comprehensive health monitoring system
    startHealthMonitoring() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval);

        console.log('[QUIZ HEALTH] Health monitoring started - checking every 30 seconds');
    }

    // ✅ ENHANCED: Comprehensive health check with auto-recovery
    async performHealthCheck() {
        try {
            const now = Date.now();
            
            // Check if there's an active quiz that's been running too long
            if (this.activeQuizUserId && this.activeQuizStartTime) {
                const quizDuration = now - this.activeQuizStartTime;
                
                if (quizDuration > this.config.maxQuizDuration) {
                    console.log(`[QUIZ HEALTH] 🚨 EMERGENCY: Quiz for user ${this.activeQuizUserId} has been running for ${Math.round(quizDuration / 60000)}m - forcing cleanup`);
                    await this.emergencyCleanup('health_check_timeout', 'Quiz exceeded maximum duration');
                    return;
                }
                
                // Check if heartbeat is stale
                if (this.activeQuizHeartbeat && (now - this.activeQuizHeartbeat) > (this.config.heartbeatInterval * 3)) {
                    console.log(`[QUIZ HEALTH] 🚨 WARNING: Quiz heartbeat stale for ${Math.round((now - this.activeQuizHeartbeat) / 1000)}s - may be stuck`);
                    
                    // If heartbeat is very stale, force cleanup
                    if ((now - this.activeQuizHeartbeat) > (this.config.heartbeatInterval * 6)) {
                        console.log(`[QUIZ HEALTH] 🚨 EMERGENCY: Heartbeat too stale - forcing cleanup`);
                        await this.emergencyCleanup('heartbeat_timeout', 'Quiz heartbeat failed');
                        return;
                    }
                }
                
                // Update heartbeat
                this.updateHeartbeat();
            }
            
            // Check for stale question caches
            for (const [userId, cache] of this.questionCache.entries()) {
                const cacheAge = now - cache.createdAt;
                if (cacheAge > (30 * 60 * 1000)) { // 30 minutes
                    console.log(`[QUIZ HEALTH] Cleaning stale cache for user ${userId} (${Math.round(cacheAge / 60000)}m old)`);
                    this.questionCache.delete(userId);
                    
                    if (this.activeQuizUserId === userId) {
                        await this.emergencyCleanup('stale_cache', 'Question cache became stale');
                    }
                }
            }
            
            // Check for stuck interaction timeouts
            for (const [userId, timeoutTime] of this.interactionTimeouts.entries()) {
                if (now > timeoutTime) {
                    console.log(`[QUIZ HEALTH] Cleaning expired interaction timeout for user ${userId}`);
                    this.interactionTimeouts.delete(userId);
                }
            }
            
            // Log health status periodically (every 5 minutes)
            if (now % (5 * 60 * 1000) < this.config.healthCheckInterval) {
                this.logHealthStatus();
            }
            
        } catch (error) {
            console.error('[QUIZ HEALTH] Error in health check:', error);
        }
    }

    // ✅ ENHANCED: Update heartbeat for active quiz
    updateHeartbeat() {
        if (this.activeQuizUserId) {
            this.activeQuizHeartbeat = Date.now();
        }
    }

    // ✅ ENHANCED: Log comprehensive health status
    logHealthStatus() {
        const now = Date.now();
        const activeQuizDuration = this.activeQuizUserId && this.activeQuizStartTime ? 
            Math.round((now - this.activeQuizStartTime) / 1000) : 0;
        
        console.log(`[QUIZ HEALTH] Status Report:`);
        console.log(`  Active Quiz: ${this.activeQuizUserId || 'None'}`);
        console.log(`  Quiz Duration: ${activeQuizDuration}s`);
        console.log(`  Cached Questions: ${this.questionCache.size}`);
        console.log(`  Tracked Messages: ${this.quizMessages.size}`);
        console.log(`  Pending Timeouts: ${this.interactionTimeouts.size}`);
        console.log(`  Emergency Timeouts: ${this.emergencyTimeouts.size}`);
    }

    // ✅ ENHANCED: Emergency cleanup with detailed logging
    async emergencyCleanup(reason, details) {
        const userId = this.activeQuizUserId;
        
        console.log(`[QUIZ EMERGENCY] 🚨 EMERGENCY CLEANUP TRIGGERED`);
        console.log(`[QUIZ EMERGENCY] Reason: ${reason}`);
        console.log(`[QUIZ EMERGENCY] Details: ${details}`);
        console.log(`[QUIZ EMERGENCY] User: ${userId}`);
        
        try {
            // Immediately unlock the quiz system
            this.forceUnlockQuiz();
            
            // Clean up user resources
            if (userId) {
                await this.cleanupUserResources(userId, 'emergency');
            }
            
            // Send emergency notification if possible
            await this.sendEmergencyNotification(userId, reason, details);
            
            console.log(`[QUIZ EMERGENCY] ✅ Emergency cleanup completed`);
            
        } catch (error) {
            console.error('[QUIZ EMERGENCY] Error during emergency cleanup:', error);
        }
    }

    // ✅ ENHANCED: Force unlock quiz system
    forceUnlockQuiz() {
        const wasLocked = this.activeQuizUserId !== null;
        
        this.activeQuizUserId = null;
        this.activeQuizStartTime = null;
        this.activeQuizHeartbeat = null;
        
        // Clear any emergency timeouts
        for (const timeout of this.emergencyTimeouts.values()) {
            clearTimeout(timeout);
        }
        this.emergencyTimeouts.clear();
        
        if (wasLocked) {
            console.log(`[QUIZ] 🔓 FORCE UNLOCKED - Quiz system now available`);
        }
    }

    // ✅ ENHANCED: Clean up all user resources
    async cleanupUserResources(userId, reason = 'normal') {
        console.log(`[QUIZ] Cleaning up resources for user ${userId} (${reason})`);
        
        try {
            // Clear question cache
            this.questionCache.delete(userId);
            
            // Clear interaction timeouts
            this.interactionTimeouts.delete(userId);
            
            // Clear emergency timeouts
            if (this.emergencyTimeouts.has(userId)) {
                clearTimeout(this.emergencyTimeouts.get(userId));
                this.emergencyTimeouts.delete(userId);
            }
            
            // Clean up messages (don't wait for completion)
            this.cleanupQuizMessages(userId).catch(error => {
                console.log(`[QUIZ] Message cleanup failed for ${userId}:`, error.message);
            });
            
        } catch (error) {
            console.error(`[QUIZ] Error cleaning up resources for ${userId}:`, error);
        }
    }

    // ✅ ENHANCED: Send emergency notification
    async sendEmergencyNotification(userId, reason, details) {
        try {
            if (!userId || !this.xpTracker?.client) return;
            
            const user = await this.xpTracker.client.users.fetch(userId).catch(() => null);
            if (!user) return;
            
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🚨 Quiz System Recovery')
                .setDescription(`Your daily quiz session was automatically recovered due to a system issue.\n\n**Reason:** ${reason}\n**Details:** ${details}\n\nYou can start a new quiz session now.`)
                .setFooter({ text: 'Quiz System Recovery' })
                .setTimestamp();
            
            await user.send({ embeds: [embed] }).catch(() => {
                console.log(`[QUIZ EMERGENCY] Could not send DM to user ${userId}`);
            });
            
        } catch (error) {
            console.log(`[QUIZ EMERGENCY] Error sending notification:`, error.message);
        }
    }

    // ✅ ENHANCED: Safe interaction handling with timeout tracking
    async handleInteractionSafely(interaction, handler, timeoutMs = null) {
        const userId = interaction.user.id;
        const timeoutDuration = timeoutMs || this.config.interactionTimeout;
        
        return new Promise(async (resolve, reject) => {
            let isComplete = false;
            let timeoutId = null;
            
            // Set interaction timeout
            timeoutId = setTimeout(() => {
                if (!isComplete) {
                    isComplete = true;
                    console.log(`[QUIZ TIMEOUT] Interaction timeout for user ${userId} after ${timeoutDuration}ms`);
                    this.interactionTimeouts.delete(userId);
                    reject(new Error('Interaction timeout'));
                }
            }, timeoutDuration);
            
            // Track timeout
            this.interactionTimeouts.set(userId, Date.now() + timeoutDuration);
            
            try {
                const result = await handler();
                
                if (!isComplete) {
                    isComplete = true;
                    clearTimeout(timeoutId);
                    this.interactionTimeouts.delete(userId);
                    resolve(result);
                }
                
            } catch (error) {
                if (!isComplete) {
                    isComplete = true;
                    clearTimeout(timeoutId);
                    this.interactionTimeouts.delete(userId);
                    reject(error);
                }
            }
        });
    }

    // ✅ ENHANCED: Check if any user has active quiz with auto-recovery
    hasActiveQuiz(userId = null) {
        // Perform health check on active quiz
        if (this.activeQuizUserId && this.activeQuizStartTime) {
            const now = Date.now();
            const duration = now - this.activeQuizStartTime;
            
            if (duration > this.config.maxQuizDuration) {
                console.log(`[QUIZ] Auto-recovering stuck quiz for user ${this.activeQuizUserId}`);
                this.emergencyCleanup('auto_recovery', 'Quiz duration exceeded in hasActiveQuiz check');
                return false;
            }
        }
        
        if (userId) {
            return this.activeQuizUserId === userId;
        }
        return this.activeQuizUserId !== null;
    }

    // ✅ CRITICAL FIX: Add the missing method that daily-quiz.js is calling
    async startQuizFromDeferredInteraction(interaction, userId, guildId, member) {
        try {
            // The interaction is already deferred, so we don't need to defer it again
            console.log(`[QUIZ] Starting quiz from already-deferred interaction for ${member.displayName}`);
            
            // Check if someone else already has active quiz
            if (this.hasActiveQuiz() && !this.hasActiveQuiz(userId)) {
                const activeUser = this.activeQuizUserId;
                return await interaction.editReply({
                    content: `❌ **Quiz Already Active**\n\nAnother user is currently taking the daily quiz. Please wait for them to finish.\n\n*Only one person can take the quiz at a time to ensure fair gameplay.*`,
                });
            }
            
            // Set active quiz with timestamps
            this.activeQuizUserId = userId;
            this.activeQuizStartTime = Date.now();
            this.updateHeartbeat();
            
            // Initialize message tracking
            this.quizMessages.set(userId, []);
            
            console.log(`[QUIZ] 🎯 QUIZ STARTED: ${member.displayName} (${userId}) - Max duration: ${this.config.maxQuizDuration / 60000}m`);
            
            // Show loading message
            const loadingEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('🎌 Daily Anime Quiz')
                .setDescription('🔄 **Loading quiz...**\n\n⏱️ *Preparing your personalized challenge...*')
                .setFooter({ text: isTestingMode() ? '🧪 Testing Mode' : 'Daily Quiz System' })
                .setTimestamp();
            
            const loadingMessage = await interaction.editReply({ embeds: [loadingEmbed] });
            this.addQuizMessage(userId, loadingMessage);
            
            // Preload questions with timeout
            const success = await Promise.race([
                this.preloadQuestions(userId, guildId),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Question loading timeout')), 15000)
                )
            ]).catch(async (error) => {
                console.error(`[QUIZ] Question loading failed for ${userId}:`, error);
                await this.emergencyCleanup('question_loading_failed', error.message);
                return false;
            });
            
            if (!success) {
                return await interaction.editReply({
                    content: '❌ **Failed to Load Questions**\n\nUnable to prepare your quiz questions. The quiz system has been unlocked for others to try.',
                });
            }
            
            // Start first question with enhanced error handling
            try {
                await this.askQuestion(interaction, userId, guildId, member, 1, [], 0);
            } catch (questionError) {
                console.error(`[QUIZ] Error starting first question:`, questionError);
                await this.emergencyCleanup('first_question_failed', questionError.message);
                await interaction.editReply({
                    content: '❌ **Quiz Start Error**\n\nFailed to start the quiz. The system has been reset and is available for others.',
                });
            }
            
        } catch (error) {
            console.error('[QUIZ] Start quiz from deferred interaction error:', error);
            await this.emergencyCleanup('start_quiz_error', error.message);
            
            try {
                await interaction.editReply({
                    content: '❌ **Quiz System Error**\n\nAn error occurred while starting the quiz. The system has been reset.',
                });
            } catch (replyError) {
                console.error('[QUIZ] Could not send error reply:', replyError);
            }
        }
    }

    // ✅ ENHANCED: Ask question with comprehensive timeout and error handling
    async askQuestion(interaction, userId, guildId, member, questionNumber, questionResults = [], rerollsUsed = 0) {
        let timer = null;
        let activeCollector = null;
        let emergencyTimeout = null;

        try {
            this.updateHeartbeat();
            
            const testingMode = isTestingMode();
            console.log(`[QUIZ] Q${questionNumber}/10 - ${member.displayName}${testingMode ? ' [TESTING]' : ''} - Rerolls: ${rerollsUsed}`);
            
            // Get question from cache
            const question = this.getNextQuestion(userId);
            if (!question) {
                console.error(`[QUIZ] No cached question available for Q${questionNumber}`);
                await this.emergencyCleanup('no_question_available', `Question ${questionNumber} not found in cache`);
                return;
            }
            
            console.log(`[QUESTION] Q${questionNumber}: ${question.question}`);
            console.log(`\x1b[32m[ANSWER] Q${questionNumber}: ${question.answer}\x1b[0m`);
            
            // Create question embed and buttons
            const embed = this.createQuestionEmbed(question, questionNumber, member, questionResults, rerollsUsed, testingMode);
            const rows = this.createButtonRows(userId, question, questionNumber, questionResults, rerollsUsed, testingMode);

            // Send question
            let message;
            let timeRemaining = 20;
            
            if (questionNumber === 1 && rerollsUsed === 0) {
                await interaction.editReply({ embeds: [embed], components: rows });
                message = await interaction.fetchReply();
            } else {
                message = await interaction.followUp({ embeds: [embed], components: rows });
            }

            this.addQuizMessage(userId, message);

            // ✅ ENHANCED: Set up emergency timeout for this question
            emergencyTimeout = setTimeout(async () => {
                console.log(`[QUIZ EMERGENCY] Q${questionNumber} emergency timeout triggered`);
                if (activeCollector) {
                    activeCollector.stop('emergency_timeout');
                }
                await this.emergencyCleanup('question_emergency_timeout', `Question ${questionNumber} exceeded emergency timeout`);
            }, this.config.questionTimeout + 10000); // 10s grace period

            // ✅ ENHANCED: Countdown timer with error handling
            timer = setInterval(async () => {
                timeRemaining -= 2;
                if (timeRemaining <= 0) {
                    clearInterval(timer);
                    timer = null;
                    return;
                }
                
                try {
                    if (message && !message.deleted) {
                        this.updateHeartbeat();
                        const updatedEmbed = this.createQuestionEmbed(question, questionNumber, member, questionResults, rerollsUsed, testingMode, timeRemaining);
                        await message.edit({ embeds: [updatedEmbed], components: rows });
                    }
                } catch (editError) {
                    console.log(`[QUIZ] Q${questionNumber} countdown edit failed:`, editError.message);
                    clearInterval(timer);
                    timer = null;
                }
            }, 2000);

            // ✅ ENHANCED: Button collector with improved error handling
            const collector = message.createMessageComponentCollector({
                time: 22000,
                filter: i => i.user.id === userId
            });

            activeCollector = collector;

            collector.on('collect', async (buttonInteraction) => {
                try {
                    console.log(`[QUIZ] Q${questionNumber} button clicked: ${buttonInteraction.customId}`);
                    this.updateHeartbeat();
                    
                    // Clear timers immediately
                    if (timer) {
                        clearInterval(timer);
                        timer = null;
                    }
                    if (emergencyTimeout) {
                        clearTimeout(emergencyTimeout);
                        emergencyTimeout = null;
                    }
                    
                    // ✅ ENHANCED: Safely defer interaction with timeout
                    await this.handleInteractionSafely(buttonInteraction, async () => {
                        await buttonInteraction.deferUpdate();
                    }, this.config.gracePeriod);
                    
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Handle button interaction
                    await this.handleButtonInteraction(buttonInteraction, interaction, userId, guildId, member, question, questionNumber, questionResults, rerollsUsed);
                    
                    collector.stop('answered');
                } catch (error) {
                    console.error('[QUIZ] Button interaction error:', error);
                    collector.stop('error');
                    await this.emergencyCleanup('button_interaction_error', error.message);
                }
            });

            collector.on('end', async (collected, reason) => {
                try {
                    // Cleanup timers
                    if (timer) {
                        clearInterval(timer);
                        timer = null;
                    }
                    if (emergencyTimeout) {
                        clearTimeout(emergencyTimeout);
                        emergencyTimeout = null;
                    }
                    
                    activeCollector = null;
                    
                    if (reason === 'time' && collected.size === 0) {
                        console.log(`[QUIZ] Q${questionNumber} timed out naturally`);
                        await this.handleTimeout(interaction, userId, guildId, member, questionNumber, questionResults, rerollsUsed);
                    } else if (reason === 'emergency_timeout') {
                        console.log(`[QUIZ] Q${questionNumber} emergency timeout - cleanup already handled`);
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
            if (emergencyTimeout) {
                clearTimeout(emergencyTimeout);
                emergencyTimeout = null;
            }
            if (activeCollector) {
                activeCollector.stop('error');
            }
            
            await this.emergencyCleanup('ask_question_error', error.message);
        }
    }

    // ✅ ENHANCED: Create button rows (extracted for clarity)
    createButtonRows(userId, question, questionNumber, questionResults, rerollsUsed, testingMode) {
        // Create answer buttons
        const answerButtons = question.options.map((option, index) => 
            new ButtonBuilder()
                .setCustomId(`answer_${userId}_${questionNumber}_${index}_${option === question.answer}_${rerollsUsed}`)
                .setLabel(option.substring(0, 70))
                .setStyle(ButtonStyle.Success)
                .setEmoji(['1️⃣', '2️⃣', '3️⃣', '4️⃣'][index])
        );

        // Create action buttons
        const actionButtons = this.createActionButtons(userId, questionNumber, questionResults, rerollsUsed, testingMode);
        
        // Arrange buttons in rows
        const rows = [
            new ActionRowBuilder().addComponents(answerButtons.slice(0, 2)),
            new ActionRowBuilder().addComponents(answerButtons.slice(2, 4))
        ];
        
        if (actionButtons.length > 0) {
            rows.push(new ActionRowBuilder().addComponents(actionButtons));
        }

        return rows;
    }

    createActionButtons(userId, questionNumber, questionResults, rerollsUsed, testingMode) {
        const actionButtons = [];
        
        const successfulAnswers = questionResults.filter(result => result === true).length;
        if (!testingMode && questionNumber > 1 && successfulAnswers > 0) {
            actionButtons.push(
                new ButtonBuilder()
                    .setCustomId(`secure_${userId}_${questionNumber}`)
                    .setLabel(`🛡️ Secure ${TIER_NAMES[successfulAnswers]} Buff`)
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🛡️')
            );
        }
        
        actionButtons.push(
            new ButtonBuilder()
                .setCustomId(`reroll_${userId}_${questionNumber}_${rerollsUsed}`)
                .setLabel(rerollsUsed >= 3 ? '🎲 No Rerolls Left' : `🎲 Reroll (${3 - rerollsUsed} left)`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🎲')
                .setDisabled(rerollsUsed >= 3)
        );

        return actionButtons;
    }

    async handleButtonInteraction(buttonInteraction, originalInteraction, userId, guildId, member, question, questionNumber, questionResults, rerollsUsed) {
        this.updateHeartbeat();
        
        const customId = buttonInteraction.customId;
        
        if (customId.startsWith('reroll_')) {
            await this.handleReroll(originalInteraction, userId, guildId, member, questionNumber, questionResults, rerollsUsed);
        } else if (customId.startsWith('secure_')) {
            await this.handleSecureTier(buttonInteraction, userId, guildId, member, questionResults);
        } else if (customId.startsWith('answer_')) {
            await this.handleAnswerSelection(buttonInteraction, originalInteraction, userId, guildId, member, question, questionNumber, questionResults, rerollsUsed);
        }
    }

    async handleReroll(interaction, userId, guildId, member, questionNumber, questionResults, currentRerollsUsed) {
        this.updateHeartbeat();
        
        const newRerollsUsed = currentRerollsUsed + 1;
        console.log(`[QUIZ] Reroll requested for Q${questionNumber} - Rerolls used: ${currentRerollsUsed} -> ${newRerollsUsed}`);
        
        await this.askQuestion(interaction, userId, guildId, member, questionNumber, questionResults, newRerollsUsed);
    }

    async handleAnswerSelection(buttonInteraction, originalInteraction, userId, guildId, member, question, questionNumber, questionResults, rerollsUsed) {
        this.updateHeartbeat();
        
        const parts = buttonInteraction.customId.split('_');
        const selectedIndex = parseInt(parts[3]);
        const isCorrect = parts[4] === 'true';
        
        const selectedOption = question.options[selectedIndex];
        console.log(`[QUIZ] Q${questionNumber} Answer: Selected "${selectedOption}" | Correct: ${isCorrect}`);
        
        if (isCorrect) {
            await this.handleCorrectAnswer(buttonInteraction, originalInteraction, userId, guildId, member, questionNumber, questionResults, rerollsUsed);
        } else {
            await this.handleIncorrectAnswer(buttonInteraction, originalInteraction, userId, guildId, member, question, selectedOption, questionNumber, questionResults, rerollsUsed);
        }
    }

    async handleCorrectAnswer(buttonInteraction, originalInteraction, userId, guildId, member, questionNumber, questionResults, rerollsUsed) {
        this.updateHeartbeat();
        
        const newResults = [...questionResults, true];
        
        // Save question to history ONLY when answered correctly
        const cache = this.questionCache.get(userId);
        if (cache?.guildId && cache.questions && cache.currentIndex > 0) {
            const justAnsweredQuestion = cache.questions[cache.currentIndex - 1];
            if (justAnsweredQuestion) {
                await this.saveQuestionToHistory(userId, cache.guildId, justAnsweredQuestion);
                console.log(`[QUIZ] ✅ Q${questionNumber} CORRECTLY answered - saved to history`);
            }
        }
        
        // Award XP in non-testing mode
        if (!isTestingMode()) {
            const correctAnswerXP = parseInt(process.env.DAILY_QUIZ_CORRECT_ANSWER_XP) || 500;
            
            if (global.xpTracker && correctAnswerXP > 0) {
                try {
                    await global.xpTracker.awardXP(userId, guildId, correctAnswerXP, 'daily-quiz-correct', member.user, true);
                    console.log(`[QUIZ] Q${questionNumber} XP: Awarded ${correctAnswerXP} XP to ${member.displayName}`);
                } catch (error) {
                    console.error(`[QUIZ] Error awarding XP:`, error);
                }
            }
        }
        
        if (questionNumber === 10) {
            await this.handleQuizComplete(buttonInteraction, userId, guildId, member, newResults);
        } else {
            await this.showContinueMessage(buttonInteraction, originalInteraction, userId, guildId, member, questionNumber, newResults, rerollsUsed);
        }
    }

    async handleIncorrectAnswer(buttonInteraction, originalInteraction, userId, guildId, member, question, selectedOption, questionNumber, questionResults, rerollsUsed) {
        this.updateHeartbeat();
        
        const newResults = [...questionResults, false];
        
        console.log(`[QUIZ] Q${questionNumber} INCORRECT: Selected "${selectedOption}" | Correct: "${question.answer}"`);
        console.log(`[QUIZ] ❌ Q${questionNumber} INCORRECTLY answered - NOT saving to history`);
        
        // Show answer reveal
        const revealEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle(`❌ Wrong Answer - Question ${questionNumber}/10${isTestingMode() ? ' [Testing]' : ''}`)
            .setDescription(`**Your Answer:** ${selectedOption}\n**Correct Answer:** 🎯 ${question.answer}${isTestingMode() ? '\n\n🧪 **Testing Mode**: Continue for practice' : ''}`)
            .addFields({
                name: '⏳ Next Question Loading...',
                value: questionNumber < 10 ? `Question ${questionNumber + 1}/10 starting in 5 seconds` : 'Calculating final results in 5 seconds...',
                inline: false
            })
            .setFooter({ text: isTestingMode() ? '🧪 Testing Mode • Processing...' : 'Processing answer...' })
            .setTimestamp();

        await buttonInteraction.editReply({ embeds: [revealEmbed], components: [] });
        
        const revealMessage = await buttonInteraction.fetchReply();
        this.addQuizMessage(userId, revealMessage);
        
        // 5-second countdown
        let countdown = 5;
        const countdownInterval = setInterval(async () => {
            this.updateHeartbeat();
            countdown--;
            if (countdown > 0) {
                try {
                    const updatedEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle(`❌ Wrong Answer - Question ${questionNumber}/10${isTestingMode() ? ' [Testing]' : ''}`)
                        .setDescription(`**Your Answer:** ${selectedOption}\n**Correct Answer:** 🎯 ${question.answer}${isTestingMode() ? '\n\n🧪 **Testing Mode**: Continue for practice' : ''}`)
                        .addFields({
                            name: '⏳ Next Question Loading...',
                            value: questionNumber < 10 ? `Question ${questionNumber + 1}/10 starting in ${countdown} seconds` : `Calculating final results in ${countdown} seconds...`,
                            inline: false
                        })
                        .setFooter({ text: isTestingMode() ? '🧪 Testing Mode • Processing...' : 'Processing answer...' })
                        .setTimestamp();
                        
                    await buttonInteraction.editReply({ embeds: [updatedEmbed], components: [] });
                } catch (error) {
                    clearInterval(countdownInterval);
                }
            } else {
                clearInterval(countdownInterval);
                
                if (questionNumber < 10) {
                    await this.askQuestion(originalInteraction, userId, guildId, member, questionNumber + 1, newResults, rerollsUsed);
                } else {
                    await this.handleQuizComplete(buttonInteraction, userId, guildId, member, newResults);
                }
            }
        }, 1000);
    }

    // ✅ ENHANCED: Handle quiz completion with immediate unlock
    async handleQuizComplete(buttonInteraction, userId, guildId, member, questionResults) {
        const totalSuccessful = questionResults.filter(r => r === true).length;
        
        console.log(`[QUIZ] 🎯 QUIZ COMPLETE: ${member.displayName} - Score: ${totalSuccessful}/10`);
        
        try {
            // ✅ ENHANCED: Process rewards first, then unlock immediately
            if (!isTestingMode()) {
                if (totalSuccessful > 0) {
                    await this.roleManager.applyTier(userId, guildId, member, totalSuccessful);
                    await this.databaseManager.saveQuizResult(userId, guildId, totalSuccessful);
                } else {
                    await this.databaseManager.saveFailedQuiz(userId, guildId);
                }
            }
            
            // ✅ ENHANCED: Create result embed
            const tierName = totalSuccessful === 10 ? 'DIVINE PERFECTION' : TIER_NAMES[totalSuccessful] || 'No Enhancement';
            const resultEmbed = this.createResultEmbed(totalSuccessful, tierName, member, isTestingMode());
            
            // ✅ ENHANCED: Send result and unlock IMMEDIATELY after
            await buttonInteraction.editReply({ embeds: [resultEmbed], components: [] });
            const finalMessage = await buttonInteraction.fetchReply();
            
            // ✅ CRITICAL: Unlock quiz system immediately after rewards are processed
            console.log(`[QUIZ] 🔓 IMMEDIATE UNLOCK: Quiz completed for ${member.displayName} - system now available for others`);
            this.forceUnlockQuiz();
            
            // ✅ ENHANCED: Schedule cleanup with delay (but quiz is already unlocked)
            const cleanupTimeout = setTimeout(async () => {
                try {
                    await this.cleanupQuizMessages(userId, finalMessage);
                    await this.cleanupUserResources(userId, 'completion');
                    console.log(`[QUIZ] ✅ Cleanup completed for ${member.displayName}`);
                } catch (cleanupError) {
                    console.error(`[QUIZ] Cleanup error for ${userId}:`, cleanupError);
                }
            }, this.config.emergencyCleanupDelay);
            
            this.emergencyTimeouts.set(userId, cleanupTimeout);
            
        } catch (error) {
            console.error('[QUIZ] Quiz completion error:', error);
            await this.emergencyCleanup('quiz_completion_error', error.message);
        }
    }

    // ✅ ENHANCED: Create result embed (extracted for clarity)
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

    // ✅ ENHANCED: Handle secure tier with immediate unlock
    async handleSecureTier(buttonInteraction, userId, guildId, member, questionResults) {
        if (isTestingMode()) {
            return await buttonInteraction.editReply({
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
            
            await buttonInteraction.editReply({ embeds: [secureEmbed], components: [] });
            
            // ✅ CRITICAL: Unlock quiz system immediately after securing tier
            console.log(`[QUIZ] 🔓 IMMEDIATE UNLOCK: Tier secured for ${member.displayName} - system now available for others`);
            this.forceUnlockQuiz();
            
            // Schedule cleanup with delay
            const cleanupTimeout = setTimeout(async () => {
                try {
                    const finalMessage = await buttonInteraction.fetchReply();
                    await this.cleanupQuizMessages(userId, finalMessage);
                    await this.cleanupUserResources(userId, 'secure');
                } catch (cleanupError) {
                    console.error(`[QUIZ] Cleanup error for ${userId}:`, cleanupError);
                }
            }, this.config.emergencyCleanupDelay);
            
            this.emergencyTimeouts.set(userId, cleanupTimeout);
            
        } catch (error) {
            console.error('[QUIZ] Error securing tier:', error);
            await this.emergencyCleanup('secure_tier_error', error.message);
            
            await buttonInteraction.editReply({
                content: '❌ **Error securing tier**\n\nQuiz system has been reset and is available for others.',
                components: []
            });
        }
    }

    // ✅ ENHANCED: Handle quiz abandonment with immediate unlock
    async handleQuizAbandon(buttonInteraction, userId, guildId, member, questionResults) {
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
            
            if (typeof buttonInteraction.editReply === 'function') {
                await buttonInteraction.editReply({ embeds: [abandonEmbed], components: [] });
            }
            
            // ✅ CRITICAL: Unlock quiz system immediately after abandonment
            console.log(`[QUIZ] 🔓 IMMEDIATE UNLOCK: Quiz abandoned by ${member.displayName} - system now available for others`);
            this.forceUnlockQuiz();
            
            // Schedule cleanup
            const cleanupTimeout = setTimeout(async () => {
                try {
                    if (typeof buttonInteraction.fetchReply === 'function') {
                        const finalMessage = await buttonInteraction.fetchReply();
                        await this.cleanupQuizMessages(userId, finalMessage);
                    }
                    await this.cleanupUserResources(userId, 'abandon');
                } catch (cleanupError) {
                    console.error(`[QUIZ] Cleanup error for ${userId}:`, cleanupError);
                }
            }, this.config.emergencyCleanupDelay);
            
            this.emergencyTimeouts.set(userId, cleanupTimeout);
            
        } catch (error) {
            console.error('[QUIZ] Error handling quiz abandon:', error);
            await this.emergencyCleanup('abandon_error', error.message);
        }
    }

    // ✅ ENHANCED: Handle timeout with recovery options
    async handleTimeout(interaction, userId, guildId, member, questionNumber, questionResults, rerollsUsed = 0) {
        console.log(`[QUIZ] ⏰ Q${questionNumber} TIMEOUT: ${member.displayName} - Rerolls preserved: ${rerollsUsed}`);
        
        const newResults = [...questionResults, false];
        
        if (questionNumber === 10) {
            await this.handleQuizComplete({ editReply: interaction.editReply.bind(interaction) }, userId, guildId, member, newResults);
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
                const timeoutMessage = await interaction.followUp({ 
                    embeds: [timeoutEmbed], 
                    components: [actionRow] 
                });
                
                this.addQuizMessage(userId, timeoutMessage);
                
                // ✅ ENHANCED: Set emergency timeout for timeout handling
                const emergencyTimeout = setTimeout(async () => {
                    console.log(`[QUIZ] Emergency timeout - auto-abandoning quiz for ${userId}`);
                    await this.handleQuizAbandon(
                        { editReply: async (options) => { await timeoutMessage.edit(options); } },
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
                        this.updateHeartbeat();
                        
                        await this.handleInteractionSafely(timeoutButton, async () => {
                            await timeoutButton.deferUpdate();
                        });
                        
                        if (timeoutButton.customId.startsWith('timeout_continue_')) {
                            const nextQuestionNumber = parseInt(timeoutButton.customId.split('_')[3]);
                            const preservedRerolls = parseInt(timeoutButton.customId.split('_')[4]);
                            
                            timeoutCollector.stop();
                            
                            setTimeout(async () => {
                                await this.askQuestion(interaction, userId, guildId, member, nextQuestionNumber, newResults, preservedRerolls);
                            }, 200);
                            
                        } else if (timeoutButton.customId.startsWith('timeout_abandon_')) {
                            timeoutCollector.stop();
                            
                            setTimeout(async () => {
                                await this.handleQuizAbandon(timeoutButton, userId, guildId, member, questionResults);
                            }, 200);
                        }
                    } catch (error) {
                        console.error('[QUIZ] Timeout button error:', error);
                        await this.emergencyCleanup('timeout_button_error', error.message);
                    }
                });
                
                timeoutCollector.on('end', async (collected, reason) => {
                    clearTimeout(emergencyTimeout);
                    
                    if (reason === 'time' && collected.size === 0) {
                        console.log(`[QUIZ] Timeout handler expired - auto-abandoning for ${userId}`);
                        await this.handleQuizAbandon(
                            { editReply: async (options) => { await timeoutMessage.edit(options); } },
                            userId, guildId, member, questionResults
                        );
                    }
                });
                
            } catch (error) {
                console.log('[QUIZ] Could not send timeout message:', error.message);
                await this.emergencyCleanup('timeout_message_error', error.message);
            }
        }
    }

    // ✅ ENHANCED: Show continue message with timeout handling
    async showContinueMessage(buttonInteraction, originalInteraction, userId, guildId, member, questionNumber, questionResults, rerollsUsed) {
        const successfulAnswers = questionResults.filter(r => r === true).length;
        
        const continueEmbed = new EmbedBuilder()
            .setTitle(`✅ Correct! ${successfulAnswers} Successful`)
            .setColor([46, 204, 113])
            .setDescription(`Great job! You now have **${successfulAnswers}** successful answers.${isTestingMode() ? '\n\n🧪 **Testing Mode**: Continue for practice, no rewards given' : ''}`)
            .addFields({
                name: '🎯 Progress',
                value: `Next: Question ${questionNumber + 1}/10\nSuccessful: ${successfulAnswers}/10`,
                inline: false
            })
            .setFooter({ text: isTestingMode() ? '🧪 Testing Mode - Continue the challenge' : 'Continue the challenge or secure your current progress' })
            .setTimestamp();
        
        const continueButtons = [
            new ButtonBuilder()
                .setCustomId(`continue_${userId}_${questionNumber + 1}_${rerollsUsed}`)
                .setLabel(`Continue to Question ${questionNumber + 1}`)
                .setStyle(ButtonStyle.Success)
        ];
        
        if (!isTestingMode()) {
            continueButtons.push(
                new ButtonBuilder()
                    .setCustomId(`claim_${userId}_${successfulAnswers}`)
                    .setLabel(`Secure ${TIER_NAMES[successfulAnswers] || 'Current'} Buff`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🛡️')
            );
        }
        
        const continueRow = new ActionRowBuilder().addComponents(continueButtons);
        
        await buttonInteraction.editReply({ embeds: [continueEmbed], components: [continueRow] });
        
        const continueMessage = await buttonInteraction.fetchReply();
        this.addQuizMessage(userId, continueMessage);
        
        // ✅ ENHANCED: Set emergency timeout for continue decision
        const emergencyTimeout = setTimeout(async () => {
            console.log(`[QUIZ] Continue decision timeout - auto-continuing for ${userId}`);
            await this.askQuestion(originalInteraction, userId, guildId, member, questionNumber + 1, questionResults, rerollsUsed);
        }, 20000);
        
        const continueCollector = continueMessage.createMessageComponentCollector({
            time: 15000,
            filter: i => i.user.id === userId
        });
        
        continueCollector.on('collect', async (contButton) => {
            try {
                clearTimeout(emergencyTimeout);
                this.updateHeartbeat();
                
                await this.handleInteractionSafely(contButton, async () => {
                    await contButton.deferUpdate();
                });
                
                await new Promise(resolve => setTimeout(resolve, 100));
                
                if (contButton.customId.startsWith('continue_')) {
                    const nextQuestionNumber = parseInt(contButton.customId.split('_')[2]);
                    const passedRerollsUsed = parseInt(contButton.customId.split('_')[3]);
                    
                    continueCollector.stop();
                    
                    setTimeout(async () => {
                        await this.askQuestion(originalInteraction, userId, guildId, member, nextQuestionNumber, questionResults, passedRerollsUsed);
                    }, 200);
                    
                } else if (contButton.customId.startsWith('claim_')) {
                    const claimTier = parseInt(contButton.customId.split('_')[2]);
                    continueCollector.stop();
                    
                    setTimeout(async () => {
                        await this.handleSecureTier(contButton, userId, guildId, member, questionResults);
                    }, 200);
                }
            } catch (error) {
                console.error('[QUIZ] Continue button error:', error);
                await this.emergencyCleanup('continue_button_error', error.message);
            }
        });
        
        continueCollector.on('end', async (collected, reason) => {
            clearTimeout(emergencyTimeout);
            
            if (reason === 'time' && collected.size === 0) {
                setTimeout(async () => {
                    await this.askQuestion(originalInteraction, userId, guildId, member, questionNumber + 1, questionResults, rerollsUsed);
                }, 100);
            }
        });
    }

    // ✅ ENHANCED: Clean up quiz messages with error handling
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
                    if (message.id === finalMessage?.id) {
                        continue; // Don't delete the final message
                    }
                    
                    await message.delete();
                    deletedCount++;
                    
                    // Delay between deletions to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 250));
                } catch (error) {
                    errorCount++;
                    if (errorCount > 3) {
                        console.log(`[QUIZ] Too many deletion errors for ${userId}, stopping cleanup`);
                        break;
                    }
                }
            }
            
            this.quizMessages.delete(userId);
            console.log(`[QUIZ] Message cleanup complete for ${userId}: ${deletedCount} deleted, ${errorCount} errors`);
            
        } catch (error) {
            console.error('[QUIZ] Error during message cleanup:', error);
        }
    }

    // ✅ ENHANCED: Override all existing methods to ensure safety
    async checkExistingQuiz(userId, guildId) {
        if (isTestingMode()) {
            return null;
        }
        return await this.databaseManager.checkExistingQuiz(userId, guildId);
    }

    async getCurrentBuff(userId, guildId, member) {
        if (isTestingMode()) {
            return { tier: 0, name: 'Testing Mode (No Buffs)', multiplier: 'None' };
        }
        
        const currentDay = getCurrentDayKey();
        const existingRecord = await this.databaseManager.checkExistingQuiz(userId, guildId, currentDay);
        
        if (existingRecord?.tier > 0) {
            return { 
                tier: existingRecord.tier, 
                name: TIER_NAMES[existingRecord.tier], 
                multiplier: 'Active' 
            };
        }
        
        for (let i = 1; i <= 10; i++) {
            const roleId = process.env[`DAILY_QUIZ_TIER_${i}_ROLE`];
            if (roleId && roleId !== `role_id_${i}` && member.roles.cache.has(roleId)) {
                return { tier: i, name: TIER_NAMES[i], multiplier: 'Active' };
            }
        }
        
        return { tier: 0, name: 'No Enhancement', multiplier: 'None' };
    }

    getNextResetTimestamp() {
        return getNextResetUnixTimestamp();
    }

    // ✅ ENHANCED: Improved question preloading with health checks
    async preloadQuestions(userId, guildId = null) {
        console.log(`[QUIZ] 🔄 PRELOADING: Loading 13 questions for user ${userId} with health monitoring`);
        
        try {
            this.updateHeartbeat();
            
            if (!guildId) {
                if (this.xpTracker?.client?.guilds?.cache?.size > 0) {
                    guildId = this.xpTracker.client.guilds.cache.first()?.id;
                }
                if (!guildId) {
                    guildId = 'unknown';
                }
            }

            const recentQuestions = await this.getUserQuestionHistory(userId, guildId, 30);
            
            const difficulties = [
                'Easy', 'Easy', 'Medium', 'Medium', 'Medium', 'Medium', 'Hard', 'Hard', 'Hard', 'Hard',
                'Medium', 'Hard', 'Hard'
            ];
            
            const questions = [];
            const usedQuestions = new Set();
            const initialQuestions = [];
            
            // Load all 13 questions with health check updates
            for (let i = 0; i < 13; i++) {
                this.updateHeartbeat(); // Update heartbeat during loading
                
                const difficulty = difficulties[i];
                const avoidQuestions = new Set([...recentQuestions]);
                
                let question = null;
                let attempts = 0;
                
                while (!question && attempts < 5) {
                    attempts++;
                    question = await this.questionLoader.fetchQuestion(difficulty, avoidQuestions);
                    
                    if (question) {
                        initialQuestions.push({ 
                            question, 
                            index: i, 
                            difficulty,
                            attempts 
                        });
                        break;
                    }
                }
                
                if (!question) {
                    console.error(`[QUIZ] Failed to load question ${i + 1} after 5 attempts`);
                    return false;
                }
                
                if (i < 12) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
            
            // Process duplicates and replacements
            const questionTexts = new Set();
            const duplicateIndices = [];
            
            for (let i = 0; i < initialQuestions.length; i++) {
                this.updateHeartbeat();
                
                const questionText = initialQuestions[i].question.question.toLowerCase().trim();
                const questionHash = this.createQuestionHash(initialQuestions[i].question.question);
                
                if (questionTexts.has(questionText) || 
                    recentQuestions.has(questionText) || 
                    recentQuestions.has(questionHash)) {
                    
                    duplicateIndices.push(i);
                } else {
                    questionTexts.add(questionText);
                    questions.push(initialQuestions[i].question);
                    usedQuestions.add(questionText);
                }
            }
            
            // Replace duplicates
            for (const duplicateIndex of duplicateIndices) {
                this.updateHeartbeat();
                
                const originalDifficulty = difficulties[duplicateIndex];
                const avoidQuestions = new Set([...recentQuestions, ...usedQuestions]);
                
                let replacementQuestion = null;
                let attempts = 0;
                
                while (!replacementQuestion && attempts < 5) {
                    attempts++;
                    replacementQuestion = await this.questionLoader.fetchQuestion(originalDifficulty, avoidQuestions);
                    
                    if (replacementQuestion) {
                        const replacementText = replacementQuestion.question.toLowerCase().trim();
                        const replacementHash = this.createQuestionHash(replacementQuestion.question);
                        
                        if (usedQuestions.has(replacementText) || 
                            recentQuestions.has(replacementText) || 
                            recentQuestions.has(replacementHash)) {
                            replacementQuestion = null;
                        } else {
                            questions.push(replacementQuestion);
                            usedQuestions.add(replacementText);
                        }
                    }
                }
                
                if (!replacementQuestion) {
                    console.error(`[QUIZ] Failed to find replacement for duplicate question ${duplicateIndex + 1}`);
                    return false;
                }
                
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            if (questions.length !== 13) {
                console.error(`[QUIZ] Final question count mismatch: expected 13, got ${questions.length}`);

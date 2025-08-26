// src/utils/quiz/QuizManager.js - FIXED Main Quiz Management Class

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
        
        // ✅ FIXED: Single active quiz tracking (global limit = 1)
        this.activeQuizUserId = null; // Only one user can have active quiz
        this.questionCache = new Map(); // userId -> preloaded questions
        
        // ✅ NEW: Database-backed question history tracking
        this.initializeQuestionHistoryTable();
        
        // ✅ NEW: Track quiz messages for cleanup
        this.quizMessages = new Map(); // userId -> array of message objects
        
        // Cleanup old caches every 10 minutes
        setInterval(() => this.cleanupOldCaches(), 10 * 60 * 1000);
        
        // ✅ NEW: Cleanup old question history daily
        setInterval(() => this.cleanupOldQuestionHistory(), 24 * 60 * 60 * 1000);
    }

    // ✅ NEW: Initialize question history tracking table
    async initializeQuestionHistoryTable() {
        if (!this.xpTracker?.db) {
            console.warn('[QUIZ] No database connection for question history tracking');
            return;
        }

        try {
            await this.xpTracker.db.query(`
                CREATE TABLE IF NOT EXISTS quiz_question_history (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    guild_id VARCHAR(20) NOT NULL,
                    question_hash VARCHAR(64) NOT NULL,
                    question_text TEXT NOT NULL,
                    difficulty VARCHAR(10) NOT NULL,
                    asked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX(user_id, guild_id, asked_at),
                    INDEX(question_hash)
                )
            `);

            // Create indexes for better performance
            await this.xpTracker.db.query(`
                CREATE INDEX IF NOT EXISTS idx_quiz_history_user_guild ON quiz_question_history(user_id, guild_id)
            `);
            
            await this.xpTracker.db.query(`
                CREATE INDEX IF NOT EXISTS idx_quiz_history_hash ON quiz_question_history(question_hash)
            `);

            console.log('[QUIZ] ✅ Question history tracking table initialized');
        } catch (error) {
            console.error('[QUIZ] Error initializing question history table:', error);
        }
    }

    // ✅ NEW: Get user's recent question history from database
    async getUserQuestionHistory(userId, guildId, days = 30) {
        if (!this.xpTracker?.db) {
            return new Set();
        }

        try {
            const result = await this.xpTracker.db.query(`
                SELECT question_hash, question_text 
                FROM quiz_question_history 
                WHERE user_id = $1 AND guild_id = $2 
                AND asked_at > NOW() - INTERVAL '${days} days'
                ORDER BY asked_at DESC
            `, [userId, guildId]);

            const recentQuestions = new Set();
            result.rows.forEach(row => {
                recentQuestions.add(row.question_text.toLowerCase().trim());
                recentQuestions.add(row.question_hash);
            });

            console.log(`[QUIZ] Loaded ${recentQuestions.size} recent questions for user ${userId} (last ${days} days)`);
            return recentQuestions;

        } catch (error) {
            console.error('[QUIZ] Error loading question history:', error);
            return new Set();
        }
    }

    // ✅ NEW: Save question to history
    async saveQuestionToHistory(userId, guildId, question) {
        if (!this.xpTracker?.db) {
            return;
        }

        try {
            // Create hash of question for deduplication
            const questionHash = this.createQuestionHash(question.question);

            await this.xpTracker.db.query(`
                INSERT INTO quiz_question_history (user_id, guild_id, question_hash, question_text, difficulty)
                VALUES ($1, $2, $3, $4, $5)
            `, [userId, guildId, questionHash, question.question, question.difficulty]);

            console.log(`[QUIZ] ✅ Saved question to history: ${question.difficulty} - ${question.question.substring(0, 50)}...`);

        } catch (error) {
            console.error('[QUIZ] Error saving question to history:', error);
        }
    }

    // ✅ NEW: Create hash of question for deduplication
    createQuestionHash(questionText) {
        // Simple hash function for question deduplication
        let hash = 0;
        const cleanText = questionText.toLowerCase().trim().replace(/[^\w\s]/g, '');
        
        for (let i = 0; i < cleanText.length; i++) {
            const char = cleanText.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return Math.abs(hash).toString(16);
    }

    // ✅ NEW: Cleanup old question history (keep last 60 days)
    async cleanupOldQuestionHistory() {
        if (!this.xpTracker?.db) {
            return;
        }

        try {
            const result = await this.xpTracker.db.query(`
                DELETE FROM quiz_question_history 
                WHERE asked_at < NOW() - INTERVAL '60 days'
            `);

            const deletedCount = result.rowCount || 0;
            if (deletedCount > 0) {
                console.log(`[QUIZ] ✅ Cleaned up ${deletedCount} old question history records`);
            }

        } catch (error) {
            console.error('[QUIZ] Error cleaning up question history:', error);
        }
    }

    // ✅ FIXED: Check if any user has active quiz (global check)
    hasActiveQuiz(userId = null) {
        if (userId) {
            return this.activeQuizUserId === userId;
        }
        return this.activeQuizUserId !== null;
    }

    // ✅ NEW: Get current active quiz user
    getActiveQuizUser() {
        return this.activeQuizUserId;
    }

    // Check existing quiz completion
    async checkExistingQuiz(userId, guildId) {
        if (isTestingMode()) {
            console.log(`[DAILY QUIZ] Testing mode - skipping database check for user ${userId}`);
            return null;
        }
        
        return await this.databaseManager.checkExistingQuiz(userId, guildId);
    }

    // Get current buff for user
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
        
        // Check for active role
        for (let i = 1; i <= 10; i++) {
            const roleId = process.env[`DAILY_QUIZ_TIER_${i}_ROLE`];
            if (roleId && roleId !== `role_id_${i}` && member.roles.cache.has(roleId)) {
                return { tier: i, name: TIER_NAMES[i], multiplier: 'Active' };
            }
        }
        
        return { tier: 0, name: 'No Enhancement', multiplier: 'None' };
    }

    // Get next reset timestamp
    getNextResetTimestamp() {
        return getNextResetUnixTimestamp();
    }

    // Start quiz process
    async startQuiz(interaction, userId, guildId, member) {
        try {
            await interaction.deferReply();
            
            // ✅ FIXED: Check if someone else already has active quiz
            if (this.hasActiveQuiz() && !this.hasActiveQuiz(userId)) {
                const activeUser = this.getActiveQuizUser();
                return await interaction.editReply({
                    content: `❌ **Quiz Already Active**\n\nAnother user is currently taking the daily quiz. Please wait for them to finish.\n\n*Only one person can take the quiz at a time to ensure fair gameplay.*`,
                    ephemeral: true
                });
            }
            
            // ✅ FIXED: Set single active quiz user
            this.activeQuizUserId = userId;
            
            // ✅ NEW: Initialize message tracking for this user
            this.quizMessages.set(userId, []);
            
            // Show loading message
            const loadingEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('🎌 Daily Anime Quiz')
                .setDescription('🔄 **Loading quiz...**')
                .setFooter({ text: isTestingMode() ? '🧪 Testing Mode' : 'Daily Quiz' })
                .setTimestamp();
            
            const loadingMessage = await interaction.editReply({ embeds: [loadingEmbed] });
            
            // ✅ NEW: Track loading message
            this.addQuizMessage(userId, loadingMessage);
            
            // ✅ FIXED: Preload 13 questions (10 + 3 rerolls)
            const success = await this.preloadQuestions(userId);
            
            if (!success) {
                this.cleanupQuiz(userId);
                return await interaction.editReply({
                    content: '❌ **Failed to Load Questions**\n\nUnable to prepare your quiz questions. Please try again.',
                });
            }
            
            // Start first question
            await this.askQuestion(interaction, userId, guildId, member, 1, [], 0);
            
        } catch (error) {
            console.error('[QUIZ MANAGER] Start quiz error:', error);
            this.cleanupQuiz(userId);
            throw error;
        }
    }

    // ✅ FIXED: Preload 13 questions with DATABASE question history tracking
    async preloadQuestions(userId) {
        console.log(`[QUIZ] Preloading 13 questions for user ${userId} (10 main + 3 rerolls)`);
        
        try {
            // ✅ NEW: Get user's recent question history from database (last 30 days)
            const guildId = this.activeQuizUserId === userId ? 
                Object.values(this.client.guilds.cache)[0]?.id : null;
            
            if (!guildId) {
                console.error('[QUIZ] Could not determine guild ID for question history');
                return false;
            }

            const recentQuestions = await this.getUserQuestionHistory(userId, guildId, 30);
            console.log(`[QUIZ] Avoiding ${recentQuestions.size} recent questions from database`);
            
            // ✅ FIXED: Generate 13 difficulties (10 main + 3 extra for rerolls)
            const difficulties = [
                'Easy', 'Easy', 'Medium', 'Medium', 'Medium', 'Medium', 'Hard', 'Hard', 'Hard', 'Hard', // 10 main questions
                'Medium', 'Hard', 'Hard' // 3 extra for rerolls
            ];
            const questions = [];
            const usedQuestions = new Set();
            
            for (let i = 0; i < 13; i++) {
                const difficulty = difficulties[i];
                const avoidQuestions = new Set([...usedQuestions, ...recentQuestions]);
                
                // ✅ NEW: Try up to 5 times to get a unique question
                let question = null;
                let attempts = 0;
                
                while (!question && attempts < 5) {
                    attempts++;
                    question = await this.questionLoader.fetchQuestion(difficulty, avoidQuestions);
                    
                    if (question) {
                        const questionKey = question.question.toLowerCase().trim();
                        const questionHash = this.createQuestionHash(question.question);
                        
                        // Check if we already used this question in current session or recent history
                        if (usedQuestions.has(questionKey) || 
                            recentQuestions.has(questionKey) || 
                            recentQuestions.has(questionHash)) {
                            
                            console.log(`[QUIZ] Question ${i + 1} attempt ${attempts}: Duplicate detected, retrying...`);
                            question = null; // Try again
                        } else {
                            // Unique question found
                            questions.push(question);
                            usedQuestions.add(questionKey);
                            console.log(`[QUIZ] Question ${i + 1}/13 loaded: ${difficulty} (attempt ${attempts})`);
                            
                            // ✅ RESTORED: Question/answer logging with GREEN answer
                            console.log(`[QUESTION] ${question.question}`);
                            console.log(`\x1b[32m[ANSWER] ${question.answer}\x1b[0m`); // Green color
                        }
                    }
                }
                
                if (!question) {
                    console.error(`[QUIZ] Failed to load unique question ${i + 1} after 5 attempts`);
                    return false;
                }
                
                // Small delay to prevent API rate limiting
                if (i < 12) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
            
            // Cache the questions
            this.questionCache.set(userId, {
                questions: questions,
                currentIndex: 0,
                usedQuestions: usedQuestions,
                createdAt: Date.now(),
                guildId: guildId // Store guild ID for history saving
            });
            
            console.log(`[QUIZ] ✅ Loaded ${questions.length} unique questions for ${userId}`);
            return true;
            
        } catch (error) {
            console.error(`[QUIZ] Error preloading questions for user ${userId}:`, error);
            return false;
        }
    }

    // Get next cached question
    getNextQuestion(userId) {
        const cache = this.questionCache.get(userId);
        if (!cache || cache.currentIndex >= cache.questions.length) {
            console.error(`[QUIZ] No cached question available - Index: ${cache?.currentIndex}, Total: ${cache?.questions.length}`);
            return null;
        }
        
        const question = cache.questions[cache.currentIndex];
        cache.currentIndex++;
        
        return question;
    }

    // Update user question history
    updateUserQuestionHistory(userId, questionText) {
        // ✅ NOTE: This method is now supplementary to database tracking
        // Database tracking is the primary source of question history
        console.log(`[QUIZ] Question added to session history: ${questionText.substring(0, 50)}...`);
    }

    // Ask a question
    async askQuestion(interaction, userId, guildId, member, questionNumber, questionResults = [], rerollsUsed = 0) {
        let timer = null;
        let activeCollector = null;

        try {
            const testingMode = isTestingMode();
            
            console.log(`[QUIZ] Starting Question ${questionNumber}/10 - User: ${member.displayName}${testingMode ? ' [TESTING]' : ''} - Rerolls: ${rerollsUsed}`);
            
            // Get question from cache
            const question = this.getNextQuestion(userId);
            
            if (!question) {
                console.error(`[QUIZ] No cached question available for Q${questionNumber} (Cache index: ${this.questionCache.get(userId)?.currentIndex}, Total: ${this.questionCache.get(userId)?.questions.length})`);
                await interaction.followUp({
                    content: '❌ **Question Loading Error**\n\nFailed to load question. Please restart the quiz.',
                    ephemeral: true
                });
                return;
            }
            
            // ✅ NEW: Save question to database history for future avoidance
            const cache = this.questionCache.get(userId);
            if (cache?.guildId) {
                await this.saveQuestionToHistory(userId, cache.guildId, question);
            }
            
            // ✅ RESTORED: Question/answer logging with GREEN answer for current question
            console.log(`[QUESTION] Q${questionNumber}: ${question.question}`);
            console.log(`\x1b[32m[ANSWER] Q${questionNumber}: ${question.answer}\x1b[0m`); // Green color
            
            // Update question history
            this.updateUserQuestionHistory(userId, question.question);
            
            // Create question embed
            const embed = this.createQuestionEmbed(question, questionNumber, member, questionResults, rerollsUsed, testingMode);
            
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

            // Send question
            let message;
            let timeRemaining = 20;
            
            if (questionNumber === 1 && rerollsUsed === 0) {
                await interaction.editReply({ embeds: [embed], components: rows });
                message = await interaction.fetchReply();
            } else {
                message = await interaction.followUp({ embeds: [embed], components: rows });
            }

            // ✅ NEW: Track quiz question messages
            this.addQuizMessage(userId, message);

            // ✅ FIXED: Restore original countdown animation (every 2 seconds)
            timer = setInterval(async () => {
                timeRemaining -= 2;
                if (timeRemaining <= 0) {
                    clearInterval(timer);
                    timer = null;
                    return;
                }
                
                try {
                    if (message && !message.deleted) {
                        const updatedEmbed = this.createQuestionEmbed(question, questionNumber, member, questionResults, rerollsUsed, testingMode, timeRemaining);
                        await message.edit({ embeds: [updatedEmbed], components: rows });
                    }
                } catch (error) {
                    clearInterval(timer);
                    timer = null;
                }
            }, 2000); // ✅ FIXED: Back to 2 second intervals

            // Button collector
            const collector = message.createMessageComponentCollector({
                time: 22000,
                filter: i => i.user.id === userId
            });

            activeCollector = collector;

            collector.on('collect', async (buttonInteraction) => {
                try {
                    // Clear timer
                    if (timer) {
                        clearInterval(timer);
                        timer = null;
                    }
                    
                    await buttonInteraction.deferUpdate();
                    
                    // Handle button interactions
                    await this.handleButtonInteraction(buttonInteraction, interaction, userId, guildId, member, question, questionNumber, questionResults, rerollsUsed);
                    
                    collector.stop('answered');
                } catch (error) {
                    console.error('[QUIZ] Button interaction error:', error);
                }
            });

            collector.on('end', async (collected, reason) => {
                // Cleanup
                if (timer) {
                    clearInterval(timer);
                    timer = null;
                }
                
                if (reason === 'time' && collected.size === 0) {
                    // ✅ FIXED: Pass rerollsUsed to handleTimeout to preserve reroll count
                    await this.handleTimeout(interaction, userId, guildId, member, questionNumber, questionResults, rerollsUsed);
                }
                
                activeCollector = null;
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
            
            this.cleanupQuiz(userId);
        }
    }

    // Create question embed
    createQuestionEmbed(question, questionNumber, member, questionResults, rerollsUsed, testingMode, timeRemaining = 20) {
        const diffEmoji = { 'Easy': '🟢', 'Medium': '🟡', 'Hard': '🔴' };
        const difficulty = question.difficulty || 'Medium';
        
        // Create progress tracking
        const progressSteps = [];
        for (let i = 1; i <= 10; i++) {
            if (i <= questionResults.length) {
                progressSteps.push(questionResults[i - 1] ? '🟩' : '🟥');
            } else if (i === questionNumber) {
                progressSteps.push('⬜');
            } else {
                progressSteps.push('⬛');
            }
        }
        
        // ✅ FIXED: Use same join method as progress for consistent spacing
        const progressDisplay = progressSteps.join(' ');
        
        // Tier progression info
        const successfulAnswers = questionResults.filter(result => result === true).length;
        const currentTargetTier = Math.min(10, successfulAnswers + 1);
        const securedTier = successfulAnswers;

        const challengeTitle = testingMode ? 
            '🧪 TESTING MODE - Daily Anime Quiz' : 
            '🎌 Daily Anime Quiz';

        // ✅ FIXED: Timer fills LEFT to RIGHT, empties RIGHT to LEFT
        const createTimeEmojis = (timeLeft) => {
            const maxTime = 20;
            const timePercentage = timeLeft / maxTime;
            const emojis = [];
            
            // ✅ FIXED: Calculate how many segments should be filled from the LEFT
            const totalSegments = 10;
            const filledSegments = Math.floor(timePercentage * totalSegments);
            
            for (let i = 0; i < totalSegments; i++) {
                if (i < filledSegments) {
                    // ✅ FIXED: Fill from LEFT to RIGHT
                    // Determine color based on time percentage
                    if (timePercentage > 0.66) {
                        emojis.push('🟩'); // Green for high time (66%+)
                    } else if (timePercentage > 0.33) {
                        emojis.push('🟨'); // Yellow for medium time (33%-66%) 
                    } else {
                        emojis.push('🟥'); // Red for low time (0%-33%)
                    }
                } else {
                    // ✅ FIXED: Empty segments on the RIGHT
                    emojis.push('⬛'); // Large black square
                }
            }
            
            // ✅ FIXED: Join with spaces to match challenge progress style  
            return emojis.join(' ');
        };

        const timeEmojis = createTimeEmojis(timeRemaining);
        const mins = Math.floor(timeRemaining / 60);
        const secs = timeRemaining % 60;
        const timeText = `${mins}:${secs.toString().padStart(2, '0')}`;
        
        // Time color based on remaining time
        const timePercentage = (timeRemaining / 20) * 100;
        let embedColor;
        if (timePercentage > 66) {
            embedColor = [46, 204, 113]; // Green
        } else if (timePercentage > 33) {
            embedColor = [255, 193, 7]; // Yellow  
        } else {
            embedColor = [255, 87, 34]; // Red
        }

        return new EmbedBuilder()
            .setAuthor({ name: challengeTitle })
            .setTitle(`${diffEmoji[difficulty]} Question ${questionNumber}/10 • ${difficulty}${testingMode ? ' [TEST]' : ''}`)
            .setColor(embedColor)
            .setDescription(`## **${question.question}**\n\n**Challenge by:** ${member.displayName}${testingMode ? ' 🧪' : ''}\n\n*Select your answer using the buttons below*${testingMode ? '\n\n⚠️ **TESTING MODE**: No roles or XP will be awarded' : ''}`)
            .addFields(
                {
                    name: '📊 Challenge Progress (10 Questions)',
                    value: progressDisplay,
                    inline: false
                },
                {
                    name: '⏰ Time Remaining',
                    value: `${timeEmojis}\n**${timeText}** (${timeRemaining} seconds)`,
                    inline: false
                },
                {
                    name: testingMode ? '🧪 Test Results (No Rewards)' : '🎯 Tier Progression',
                    value: testingMode ? 
                        `**Score:** ${successfulAnswers}/10\n**Next Answer:** Would target ${TIER_NAMES[currentTargetTier] || 'Complete'}\n*Testing mode - no actual rewards*` :
                        (securedTier > 0 ? 
                            `**Secured:** ${this.getTierEmoji(securedTier)} ${TIER_NAMES[securedTier]}\n**Target:** ${this.getTierEmoji(currentTargetTier)} ${TIER_NAMES[currentTargetTier]}` : 
                            `**Target:** ${this.getTierEmoji(currentTargetTier)} ${TIER_NAMES[currentTargetTier]}\n*${TIER_DESC[currentTargetTier]}*`),
                    inline: false
                },
                {
                    name: '🎲 Rerolls Available',
                    value: `**${3 - rerollsUsed}/3** rerolls remaining`,
                    inline: true
                }
            )
            .setFooter({ text: `Enhancement Intelligence • Difficulty: ${difficulty}${testingMode ? ' • TESTING MODE' : ''} • ${new Date().toLocaleTimeString()}` })
            .setTimestamp();
    }

    // Create action buttons
    createActionButtons(userId, questionNumber, questionResults, rerollsUsed, testingMode) {
        const actionButtons = [];
        
        // Secure tier button (not in testing mode, not on first question, and has successful answers)
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
        
        // Reroll button
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

    // Handle button interactions
    async handleButtonInteraction(buttonInteraction, originalInteraction, userId, guildId, member, question, questionNumber, questionResults, rerollsUsed) {
        const customId = buttonInteraction.customId;
        
        if (customId.startsWith('reroll_')) {
            // ✅ FIXED: Don't increment rerollsUsed here, do it in handleReroll
            await this.handleReroll(originalInteraction, userId, guildId, member, questionNumber, questionResults, rerollsUsed);
        } else if (customId.startsWith('secure_')) {
            await this.handleSecureTier(buttonInteraction, userId, guildId, member, questionResults);
        } else if (customId.startsWith('answer_')) {
            await this.handleAnswerSelection(buttonInteraction, originalInteraction, userId, guildId, member, question, questionNumber, questionResults, rerollsUsed);
        }
    }

    // ✅ FIXED: Handle reroll - don't reset, just get new question
    async handleReroll(interaction, userId, guildId, member, questionNumber, questionResults, currentRerollsUsed) {
        const newRerollsUsed = currentRerollsUsed + 1;
        console.log(`[QUIZ] Reroll requested for Q${questionNumber} - Rerolls used: ${currentRerollsUsed} -> ${newRerollsUsed}`);
        
        // ✅ FIXED: Don't reset the question cache index - continue with new question and incremented reroll count
        await this.askQuestion(interaction, userId, guildId, member, questionNumber, questionResults, newRerollsUsed);
    }

    // Handle secure tier
    async handleSecureTier(buttonInteraction, userId, guildId, member, questionResults) {
        if (isTestingMode()) {
            return await buttonInteraction.editReply({
                content: '🧪 **Testing Mode**: Cannot secure tiers in testing mode!',
                components: []
            });
        }
        
        const successfulAnswers = questionResults.filter(result => result === true).length;
        
        try {
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
                .setFooter({ text: `${this.getTierEmoji(successfulAnswers)} ${TIER_NAMES[successfulAnswers]} Active` })
                .setTimestamp();
            
            await buttonInteraction.editReply({ embeds: [secureEmbed], components: [] });
            
        } catch (error) {
            console.error('[QUIZ] Error securing tier:', error);
            await buttonInteraction.editReply({
                content: '❌ **Error securing tier**\n\nPlease try again.',
                components: []
            });
        }
        
        this.cleanupQuiz(userId);
    }

    // Handle answer selection
    async handleAnswerSelection(buttonInteraction, originalInteraction, userId, guildId, member, question, questionNumber, questionResults, rerollsUsed) {
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

    // Handle correct answer
    async handleCorrectAnswer(buttonInteraction, originalInteraction, userId, guildId, member, questionNumber, questionResults, rerollsUsed) {
        const newResults = [...questionResults, true];
        
        // Award XP in non-testing mode
        if (!isTestingMode()) {
            // ✅ FIXED: Use correct environment variable name
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
            // Quiz complete
            await this.handleQuizComplete(buttonInteraction, userId, guildId, member, newResults);
        } else {
            // Continue to next question
            await this.showContinueMessage(buttonInteraction, originalInteraction, userId, guildId, member, questionNumber, newResults, rerollsUsed);
        }
    }

    // Show continue message after correct answer
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
        
        // ✅ NEW: Track continue message
        const continueMessage = await buttonInteraction.fetchReply();
        this.addQuizMessage(userId, continueMessage);
        
        // Handle continue buttons
        const continueCollector = buttonInteraction.message.createMessageComponentCollector({
            time: 15000,
            filter: i => i.user.id === userId
        });
        
        continueCollector.on('collect', async (contButton) => {
            try {
                await contButton.deferUpdate();
                
                if (contButton.customId.startsWith('continue_')) {
                    const nextQuestionNumber = parseInt(contButton.customId.split('_')[2]);
                    const passedRerollsUsed = parseInt(contButton.customId.split('_')[3]);
                    
                    continueCollector.stop();
                    await this.askQuestion(originalInteraction, userId, guildId, member, nextQuestionNumber, questionResults, passedRerollsUsed);
                    
                } else if (contButton.customId.startsWith('claim_')) {
                    const claimTier = parseInt(contButton.customId.split('_')[2]);
                    await this.handleSecureTier(contButton, userId, guildId, member, questionResults);
                    continueCollector.stop();
                }
            } catch (error) {
                console.error('[QUIZ] Continue button error:', error);
            }
        });
        
        continueCollector.on('end', async (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                // Auto-continue if no button clicked
                await this.askQuestion(originalInteraction, userId, guildId, member, questionNumber + 1, questionResults, rerollsUsed);
            }
        });
    }

    // Handle incorrect answer
    async handleIncorrectAnswer(buttonInteraction, originalInteraction, userId, guildId, member, question, selectedOption, questionNumber, questionResults, rerollsUsed) {
        const newResults = [...questionResults, false];
        
        console.log(`[QUIZ] Q${questionNumber} INCORRECT: Selected "${selectedOption}" | Correct: "${question.answer}"`);
        
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
        
        // ✅ NEW: Track answer reveal message  
        const revealMessage = await buttonInteraction.fetchReply();
        this.addQuizMessage(userId, revealMessage);
        
        // ✅ FIXED: Restore original 5-second countdown
        let countdown = 5;
        const countdownInterval = setInterval(async () => {
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

    // Handle quiz completion
    async handleQuizComplete(buttonInteraction, userId, guildId, member, questionResults) {
        const totalSuccessful = questionResults.filter(r => r === true).length;
        
        if (!isTestingMode()) {
            if (totalSuccessful > 0) {
                await this.roleManager.applyTier(userId, guildId, member, totalSuccessful);
                await this.databaseManager.saveQuizResult(userId, guildId, totalSuccessful);
            } else {
                await this.databaseManager.saveFailedQuiz(userId, guildId);
            }
            
            const tierName = totalSuccessful === 10 ? 'DIVINE PERFECTION' : TIER_NAMES[totalSuccessful] || 'No Enhancement';
            const resultEmbed = new EmbedBuilder()
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
                .setFooter({ text: totalSuccessful > 0 ? `${this.getTierEmoji(totalSuccessful)} ${tierName} Active` : 'Challenge Complete' })
                .setTimestamp();
                
            await buttonInteraction.editReply({ embeds: [resultEmbed], components: [] });
            
            // ✅ NEW: This is the final message - clean up all previous messages except this one
            await this.cleanupQuizMessages(userId, await buttonInteraction.fetchReply());
        } else {
            const tierName = totalSuccessful === 10 ? 'DIVINE PERFECTION' : TIER_NAMES[totalSuccessful] || 'No Enhancement';
            const resultEmbed = new EmbedBuilder()
                .setTitle('🧪 Testing Complete - No Rewards Given')
                .setColor('#FFA500')
                .setDescription(`**Testing Results:** ${totalSuccessful}/10 correct answers\n\n*In normal mode, this would have earned: **${tierName}***\n\n⚠️ **TESTING MODE**: No roles or XP multipliers awarded`)
                .addFields({
                    name: '📊 Test Results',
                    value: `**Correct Answers:** ${totalSuccessful}/10\n**Would Have Earned:** ${this.getTierEmoji(totalSuccessful)} ${tierName}\n**Challenge by:** ${member.displayName} 🧪\n**Mode:** Testing (No Rewards)`,
                    inline: false
                })
                .setFooter({ text: '🧪 Testing Mode Complete - No Actual Rewards Given' })
                .setTimestamp();
                
            await buttonInteraction.editReply({ embeds: [resultEmbed], components: [] });
            
            // ✅ NEW: This is the final message - clean up all previous messages except this one
            await this.cleanupQuizMessages(userId, await buttonInteraction.fetchReply());
        }
        
        this.cleanupQuiz(userId);
    }

    // ✅ FIXED: Handle timeout - give Continue/Abandon options (POST AFTER QUIZ QUESTIONS)
    async handleTimeout(interaction, userId, guildId, member, questionNumber, questionResults, rerollsUsed = 0) {
        console.log(`[QUIZ] Q${questionNumber} timed out for ${member.displayName} - Rerolls preserved: ${rerollsUsed}`);
        
        const newResults = [...questionResults, false];
        
        if (questionNumber === 10) {
            await this.handleQuizComplete({ editReply: interaction.editReply.bind(interaction) }, userId, guildId, member, newResults);
        } else {
            // ✅ FIXED: Show Continue/Abandon options as FOLLOW-UP (not edit existing message)
            const timeoutEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle(`⏰ Time's Up - Question ${questionNumber}/10${isTestingMode() ? ' [Testing]' : ''}`)
                .setDescription(`No answer selected in time.${isTestingMode() ? '\n\n🧪 **Testing Mode**: Continue for practice' : ''}`)
                .addFields({
                    name: '🎯 Current Progress',
                    value: `**Questions Completed:** ${questionNumber}/10\n**Successful Answers:** ${questionResults.filter(r => r === true).length}\n**Rerolls Remaining:** ${3 - rerollsUsed}/3`,
                    inline: false
                })
                .setFooter({ text: isTestingMode() ? '🧪 Testing Mode • Choose your next action' : 'Choose your next action' })
                .setTimestamp();

            // Create Continue/Abandon buttons
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
                // ✅ NEW: Use followUp instead of editing the timed-out question
                const timeoutMessage = await interaction.followUp({ 
                    embeds: [timeoutEmbed], 
                    components: [actionRow] 
                });
                
                // ✅ NEW: Track timeout message
                this.addQuizMessage(userId, timeoutMessage);
                
                // Handle timeout action buttons
                const timeoutCollector = timeoutMessage.createMessageComponentCollector({
                    // ✅ FIXED: Remove time limit - no auto-abandon after 30 seconds
                    filter: i => i.user.id === userId
                });
                
                timeoutCollector.on('collect', async (timeoutButton) => {
                    try {
                        await timeoutButton.deferUpdate();
                        
                        if (timeoutButton.customId.startsWith('timeout_continue_')) {
                            const nextQuestionNumber = parseInt(timeoutButton.customId.split('_')[3]);
                            const preservedRerolls = parseInt(timeoutButton.customId.split('_')[4]);
                            
                            timeoutCollector.stop();
                            console.log(`[QUIZ] User chose to continue after timeout - Q${nextQuestionNumber} with ${preservedRerolls} rerolls used`);
                            await this.askQuestion(interaction, userId, guildId, member, nextQuestionNumber, newResults, preservedRerolls);
                            
                        } else if (timeoutButton.customId.startsWith('timeout_abandon_')) {
                            timeoutCollector.stop();
                            console.log(`[QUIZ] User chose to abandon quiz after timeout`);
                            await this.handleQuizAbandon(timeoutButton, userId, guildId, member, questionResults);
                        }
                    } catch (error) {
                        console.error('[QUIZ] Timeout button error:', error);
                    }
                });
                
                // ✅ FIXED: Removed auto-abandon timeout - buttons stay active indefinitely
                
            } catch (error) {
                console.log('[QUIZ] Could not send timeout message:', error.message);
                // Fallback: auto-continue if sending fails
                setTimeout(async () => {
                    await this.askQuestion(interaction, userId, guildId, member, questionNumber + 1, newResults, rerollsUsed);
                }, 2000);
            }
        }
    }

    // ✅ NEW: Handle quiz abandonment
    async handleQuizAbandon(buttonInteraction, userId, guildId, member, questionResults) {
        try {
            const successfulAnswers = questionResults.filter(r => r === true).length;
            
            if (!isTestingMode()) {
                // Save failed quiz attempt to database
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
                .setFooter({ text: isTestingMode() ? '🧪 Testing Mode - Quiz Abandoned' : 'Quiz Abandoned' })
                .setTimestamp();
            
            if (typeof buttonInteraction.editReply === 'function') {
                await buttonInteraction.editReply({ embeds: [abandonEmbed], components: [] });
                
                // ✅ NEW: This is the final message - clean up all previous messages except this one
                await this.cleanupQuizMessages(userId, await buttonInteraction.fetchReply());
            } else {
                await buttonInteraction({ embeds: [abandonEmbed], components: [] });
            }
            
        } catch (error) {
            console.error('[QUIZ] Error handling quiz abandon:', error);
        }
        
        this.cleanupQuiz(userId);
    }

    // ✅ NEW: Add message to tracking
    addQuizMessage(userId, message) {
        if (!this.quizMessages.has(userId)) {
            this.quizMessages.set(userId, []);
        }
        
        if (message) {
            this.quizMessages.get(userId).push(message);
            console.log(`[QUIZ] Tracking message for user ${userId} (Total: ${this.quizMessages.get(userId).length})`);
        }
    }

    // ✅ NEW: Clean up quiz messages except the final one
    async cleanupQuizMessages(userId, finalMessage) {
        try {
            const messages = this.quizMessages.get(userId);
            if (!messages || messages.length === 0) {
                console.log(`[QUIZ] No messages to clean up for user ${userId}`);
                return;
            }

            console.log(`[QUIZ] Cleaning up ${messages.length} quiz messages for user ${userId}, keeping final message`);
            
            let deletedCount = 0;
            for (const message of messages) {
                try {
                    // Don't delete the final message
                    if (message.id === finalMessage?.id) {
                        console.log(`[QUIZ] Skipping final message: ${message.id}`);
                        continue;
                    }
                    
                    await message.delete();
                    deletedCount++;
                    console.log(`[QUIZ] Deleted message: ${message.id}`);
                    
                    // Small delay between deletions to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 250));
                } catch (error) {
                    console.log(`[QUIZ] Could not delete message ${message.id}: ${error.message}`);
                }
            }
            
            console.log(`[QUIZ] ✅ Cleanup complete: deleted ${deletedCount} messages, kept final message`);
            
            // Clear the message tracking
            this.quizMessages.delete(userId);
            
        } catch (error) {
            console.error('[QUIZ] Error during message cleanup:', error);
        }
    }

    // Get tier emoji
    getTierEmoji(tier) {
        const tierEmojis = {
            0: '⬛', 1: '⚪', 2: '🟢', 3: '🔵', 4: '🟣', 5: '🟡',
            6: '🟡', 7: '🟠', 8: '🟠', 9: '🔴', 10: '🔴'
        };
        return tierEmojis[tier] || '⬛';
    }

    // ✅ FIXED: Clean up quiz data - clear single active user and messages
    cleanupQuiz(userId) {
        console.log(`[QUIZ] Cleaning up quiz for user ${userId}`);
        
        // Clear single active quiz user
        if (this.activeQuizUserId === userId) {
            this.activeQuizUserId = null;
            console.log(`[QUIZ] Released quiz lock - quiz system now available`);
        }
        
        this.questionCache.delete(userId);
        
        // ✅ NEW: Clear message tracking (if not already cleared by cleanup)
        if (this.quizMessages.has(userId)) {
            this.quizMessages.delete(userId);
            console.log(`[QUIZ] Cleared message tracking for user ${userId}`);
        }
    }

    // Clean up old caches
    cleanupOldCaches() {
        const now = Date.now();
        const maxAge = 30 * 60 * 1000; // 30 minutes
        
        // Clean up old question caches
        for (const [userId, cache] of this.questionCache.entries()) {
            if (now - cache.createdAt > maxAge) {
                console.log(`[QUIZ] Removing old question cache for user ${userId}`);
                this.questionCache.delete(userId);
                
                // ✅ FIXED: Clear active quiz if it's this user
                if (this.activeQuizUserId === userId) {
                    this.activeQuizUserId = null;
                    console.log(`[QUIZ] Released abandoned quiz lock for user ${userId}`);
                }
                
                // ✅ NEW: Clear message tracking for old caches
                if (this.quizMessages.has(userId)) {
                    this.quizMessages.delete(userId);
                    console.log(`[QUIZ] Cleared old message tracking for user ${userId}`);
                }
            }
        }
        
        // Clean up old user histories - now managed by database
        console.log('[QUIZ] Database-backed question history - memory cleanup not needed');
        
        // ✅ NEW: Trigger database cleanup if needed
        if (Math.random() < 0.1) { // 10% chance to trigger cleanup
            this.cleanupOldQuestionHistory().catch(console.error);
        }
    }
}

module.exports = QuizManager;

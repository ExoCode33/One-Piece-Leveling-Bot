// src/utils/quiz/QuizManager.js - COMPLETE FIXED with Smart Reloading & Correct Answer History

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
        this.activeQuizUserId = null;
        this.questionCache = new Map(); // userId -> preloaded questions
        
        // ✅ FIXED: Database-backed question history tracking
        this.initializeQuestionHistoryTable();
        
        // ✅ NEW: Track quiz messages for cleanup
        this.quizMessages = new Map(); // userId -> array of message objects
        
        // Cleanup old caches every 10 minutes
        setInterval(() => this.cleanupOldCaches(), 10 * 60 * 1000);
        
        // ✅ NEW: Cleanup old question history daily
        setInterval(() => this.cleanupOldQuestionHistory(), 24 * 60 * 60 * 1000);
    }

    // ✅ FIXED: Initialize question history tracking table with correct PostgreSQL syntax
    async initializeQuestionHistoryTable() {
        if (!this.xpTracker?.db) {
            console.warn('[QUIZ] No database connection for question history tracking');
            return;
        }

        try {
            // ✅ FIXED: Proper PostgreSQL CREATE TABLE syntax
            await this.xpTracker.db.query(`
                CREATE TABLE IF NOT EXISTS quiz_question_history (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    guild_id VARCHAR(20) NOT NULL,
                    question_hash VARCHAR(64) NOT NULL,
                    question_text TEXT NOT NULL,
                    difficulty VARCHAR(10) NOT NULL,
                    asked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // ✅ FIXED: Create indexes separately (correct PostgreSQL syntax)
            await this.xpTracker.db.query(`
                CREATE INDEX IF NOT EXISTS idx_quiz_history_user_guild ON quiz_question_history(user_id, guild_id)
            `);
            
            await this.xpTracker.db.query(`
                CREATE INDEX IF NOT EXISTS idx_quiz_history_hash ON quiz_question_history(question_hash)
            `);

            await this.xpTracker.db.query(`
                CREATE INDEX IF NOT EXISTS idx_quiz_history_asked_at ON quiz_question_history(asked_at)
            `);

            console.log('[QUIZ] ✅ Question history tracking table initialized');
        } catch (error) {
            console.error('[QUIZ] Error initializing question history table:', error);
        }
    }

    // ✅ FIXED: Get user's recent question history from database
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

    // ✅ FIXED: Save question to history ONLY when answered correctly
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

            console.log(`[QUIZ] ✅ Saved CORRECT answer to history: ${question.difficulty} - ${question.question.substring(0, 50)}...`);

        } catch (error) {
            console.error('[QUIZ] Error saving question to history:', error);
        }
    }

    // ✅ FIXED: Create hash of question for deduplication
    createQuestionHash(questionText) {
        let hash = 0;
        const cleanText = questionText.toLowerCase().trim().replace(/[^\w\s]/g, '');
        
        for (let i = 0; i < cleanText.length; i++) {
            const char = cleanText.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return Math.abs(hash).toString(16);
    }

    // ✅ FIXED: Check if any user has active quiz (global check)
    hasActiveQuiz(userId = null) {
        if (userId) {
            return this.activeQuizUserId === userId;
        }
        return this.activeQuizUserId !== null;
    }

    // ✅ FIXED: Get current active quiz user
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
            
            // ✅ FIXED: Preload 13 questions (10 + 3 rerolls) with smart reloading
            const success = await this.preloadQuestions(userId, guildId);
            
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

    // ✅ FIXED: Smart preloading - only reload duplicates, ensure no duplicates in same session
    async preloadQuestions(userId, guildId = null) {
        console.log(`[QUIZ] 🔄 SMART PRELOADING: Loading 13 questions for user ${userId} (10 main + 3 rerolls)`);
        
        try {
            // ✅ FIXED: Use provided guildId
            if (!guildId) {
                if (this.xpTracker?.client?.guilds?.cache?.size > 0) {
                    guildId = this.xpTracker.client.guilds.cache.first()?.id;
                    console.log('[QUIZ] Using fallback guild ID from xpTracker client:', guildId);
                }
                
                if (!guildId) {
                    console.error('[QUIZ] Could not determine guild ID for question history');
                    guildId = 'unknown';
                }
            }

            const recentQuestions = await this.getUserQuestionHistory(userId, guildId, 30);
            console.log(`[QUIZ] Avoiding ${recentQuestions.size} recent questions from database`);
            
            // ✅ FIXED: Generate 13 difficulties (10 main + 3 extra for rerolls)
            const difficulties = [
                'Easy', 'Easy', 'Medium', 'Medium', 'Medium', 'Medium', 'Hard', 'Hard', 'Hard', 'Hard', // 10 main questions
                'Medium', 'Hard', 'Hard' // 3 extra for rerolls
            ];
            
            const questions = [];
            const usedQuestions = new Set(); // Track questions used in THIS session
            
            // ✅ FIXED: SMART LOADING - Load all 13 first, then identify duplicates
            console.log(`[QUIZ] 📥 PHASE 1: Loading all 13 questions...`);
            const initialQuestions = [];
            
            for (let i = 0; i < 13; i++) {
                const difficulty = difficulties[i];
                const avoidQuestions = new Set([...recentQuestions]); // Only avoid recent questions, not session questions yet
                
                let question = null;
                let attempts = 0;
                
                while (!question && attempts < 5) {
                    attempts++;
                    question = await this.questionLoader.fetchQuestion(difficulty, avoidQuestions);
                    
                    if (question) {
                        // ✅ FIXED: Just load the question, don't check duplicates yet
                        initialQuestions.push({ 
                            question, 
                            index: i, 
                            difficulty,
                            attempts 
                        });
                        console.log(`[QUIZ] Question ${i + 1}/13 loaded: ${difficulty} (attempt ${attempts})`);
                        break;
                    }
                }
                
                if (!question) {
                    console.error(`[QUIZ] Failed to load question ${i + 1} after 5 attempts`);
                    return false;
                }
                
                // Small delay to prevent API rate limiting
                if (i < 12) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
            
            // ✅ FIXED: PHASE 2 - Identify duplicates within the session
            console.log(`[QUIZ] 🔍 PHASE 2: Identifying duplicates within loaded questions...`);
            
            const questionTexts = new Set();
            const duplicateIndices = [];
            
            for (let i = 0; i < initialQuestions.length; i++) {
                const questionText = initialQuestions[i].question.question.toLowerCase().trim();
                const questionHash = this.createQuestionHash(initialQuestions[i].question.question);
                
                // Check for duplicates in session OR recent history
                if (questionTexts.has(questionText) || 
                    recentQuestions.has(questionText) || 
                    recentQuestions.has(questionHash)) {
                    
                    duplicateIndices.push(i);
                    console.log(`[QUIZ] ❌ Question ${i + 1} is a DUPLICATE: ${questionText.substring(0, 50)}...`);
                } else {
                    questionTexts.add(questionText);
                    questions.push(initialQuestions[i].question);
                    usedQuestions.add(questionText);
                    console.log(`[QUIZ] ✅ Question ${i + 1} is UNIQUE`);
                }
            }
            
            // ✅ FIXED: PHASE 3 - Smart reloading of ONLY duplicates
            if (duplicateIndices.length > 0) {
                console.log(`[QUIZ] 🔄 PHASE 3: Need to reload ${duplicateIndices.length} duplicate questions`);
                
                for (const duplicateIndex of duplicateIndices) {
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
                            
                            // ✅ FIXED: Check replacement doesn't duplicate session questions
                            if (usedQuestions.has(replacementText) || 
                                recentQuestions.has(replacementText) || 
                                recentQuestions.has(replacementHash)) {
                                
                                console.log(`[QUIZ] 🔄 Question ${duplicateIndex + 1} replacement attempt ${attempts}: Still duplicate, retrying...`);
                                replacementQuestion = null;
                            } else {
                                // ✅ FIXED: Unique replacement found
                                questions.push(replacementQuestion);
                                usedQuestions.add(replacementText);
                                console.log(`[QUIZ] ✅ Question ${duplicateIndex + 1} REPLACED with unique question (attempt ${attempts})`);
                                
                                // ✅ RESTORED: Question/answer logging for replacements
                                console.log(`[QUESTION] REPLACEMENT Q${duplicateIndex + 1}: ${replacementQuestion.question}`);
                                console.log(`\x1b[32m[ANSWER] REPLACEMENT Q${duplicateIndex + 1}: ${replacementQuestion.answer}\x1b[0m`);
                            }
                        }
                    }
                    
                    if (!replacementQuestion) {
                        console.error(`[QUIZ] Failed to find replacement for duplicate question ${duplicateIndex + 1}`);
                        return false;
                    }
                    
                    // Small delay between replacements
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
            
            // ✅ FIXED: Final validation
            if (questions.length !== 13) {
                console.error(`[QUIZ] Final question count mismatch: expected 13, got ${questions.length}`);
                return false;
            }
            
            // ✅ FIXED: Log all final questions for verification
            console.log(`[QUIZ] 📋 FINAL QUESTION SET:`);
            questions.forEach((q, index) => {
                console.log(`[QUESTION] Q${index + 1}: ${q.question}`);
                console.log(`\x1b[32m[ANSWER] Q${index + 1}: ${q.answer}\x1b[0m`); // Green color
            });
            
            // Cache the questions
            this.questionCache.set(userId, {
                questions: questions,
                currentIndex: 0,
                usedQuestions: usedQuestions,
                createdAt: Date.now(),
                guildId: guildId
            });
            
            console.log(`[QUIZ] ✅ SMART LOADING COMPLETE: ${questions.length} unique questions for ${userId} (${duplicateIndices.length} were reloaded)`);
            return true;
            
        } catch (error) {
            console.error(`[QUIZ] Error in smart preloading for user ${userId}:`, error);
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
                console.error(`[QUIZ] No cached question available for Q${questionNumber}`);
                await interaction.followUp({
                    content: '❌ **Question Loading Error**\n\nFailed to load question. Please restart the quiz.',
                    ephemeral: true
                });
                return;
            }
            
            console.log(`[QUESTION] Q${questionNumber}: ${question.question}`);
            console.log(`\x1b[32m[ANSWER] Q${questionNumber}: ${question.answer}\x1b[0m`);
            
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
            }, 2000);

            // Button collector
            const collector = message.createMessageComponentCollector({
                time: 22000,
                filter: i => i.user.id === userId
            });

            activeCollector = collector;

            collector.on('collect', async (buttonInteraction) => {
                try {
                    console.log(`[QUIZ] Q${questionNumber} button clicked: ${buttonInteraction.customId}`);
                    
                    // Clear timer
                    if (timer) {
                        clearInterval(timer);
                        timer = null;
                    }
                    
                    try {
                        await buttonInteraction.deferUpdate();
                    } catch (deferError) {
                        console.error(`[QUIZ] Q${questionNumber} CRITICAL: Failed to defer button interaction:`, deferError);
                        collector.stop('defer_failed');
                        return;
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 50));
                    
                    // Handle button interactions
                    await this.handleButtonInteraction(buttonInteraction, interaction, userId, guildId, member, question, questionNumber, questionResults, rerollsUsed);
                    
                    collector.stop('answered');
                } catch (error) {
                    console.error('[QUIZ] Button interaction error:', error);
                    collector.stop('error');
                }
            });

            collector.on('end', async (collected, reason) => {
                // Cleanup
                if (timer) {
                    clearInterval(timer);
                    timer = null;
                }
                
                if (reason === 'time' && collected.size === 0) {
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

    // Handle correct answer - ✅ FIXED: Save to history ONLY on correct answers
    async handleCorrectAnswer(buttonInteraction, originalInteraction, userId, guildId, member, questionNumber, questionResults, rerollsUsed) {
        const newResults = [...questionResults, true];
        
        // ✅ FIXED: Save question to history ONLY when answered correctly
        const cache = this.questionCache.get(userId);
        if (cache?.guildId && cache.questions && cache.currentIndex > 0) {
            const justAnsweredQuestion = cache.questions[cache.currentIndex - 1];
            if (justAnsweredQuestion) {
                await this.saveQuestionToHistory(userId, cache.guildId, justAnsweredQuestion);
                console.log(`[QUIZ] ✅ Q${questionNumber} CORRECTLY answered - saved to history to avoid future repeats`);
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
            // Quiz complete
            await this.handleQuizComplete(buttonInteraction, userId, guildId, member, newResults);
        } else {
            // Continue to next question
            await this.showContinueMessage(buttonInteraction, originalInteraction, userId, guildId, member, questionNumber, newResults, rerollsUsed);
        }
    }

    // Handle incorrect answer - ✅ FIXED: Do NOT save to history on wrong answers
    async handleIncorrectAnswer(buttonInteraction, originalInteraction, userId, guildId, member, question, selectedOption, questionNumber, questionResults, rerollsUsed) {
        const newResults = [...questionResults, false];
        
        console.log(`[QUIZ] Q${questionNumber} INCORRECT: Selected "${selectedOption}" | Correct: "${question.answer}"`);
        console.log(`[QUIZ] ❌ Q${questionNumber} INCORRECTLY answered - NOT saving to history (can appear again)`);
        
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
        
        const progressDisplay = progressSteps.join(' ');
        
        // Tier progression info
        const successfulAnswers = questionResults.filter(result => result === true).length;
        const currentTargetTier = Math.min(10, successfulAnswers + 1);
        const securedTier = successfulAnswers;

        const challengeTitle = testingMode ? 
            '🧪 TESTING MODE - Daily Anime Quiz' : 
            '🎌 Daily Anime Quiz';

        // Timer fills LEFT to RIGHT, empties RIGHT to LEFT
        const createTimeEmojis = (timeLeft) => {
            const maxTime = 20;
            const timePercentage = timeLeft / maxTime;
            const emojis = [];
            
            const totalSegments = 10;
            const filledSegments = Math.floor(timePercentage * totalSegments);
            
            for (let i = 0; i < totalSegments; i++) {
                if (i < filledSegments) {
                    if (timePercentage > 0.66) {
                        emojis.push('🟩'); // Green for high time (66%+)
                    } else if (timePercentage > 0.33) {
                        emojis.push('🟨'); // Yellow for medium time (33%-66%) 
                    } else {
                        emojis.push('🟥'); // Red for low time (0%-33%)
                    }
                } else {
                    emojis.push('⬛'); // Large black square
                }
            }
            
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
            await this.handleReroll(originalInteraction, userId, guildId, member, questionNumber, questionResults, rerollsUsed);
        } else if (customId.startsWith('secure_')) {
            await this.handleSecureTier(buttonInteraction, userId, guildId, member, questionResults);
        } else if (customId.startsWith('answer_')) {
            await this.handleAnswerSelection(buttonInteraction, originalInteraction, userId, guildId, member, question, questionNumber, questionResults, rerollsUsed);
        }
    }

    // Handle reroll - don't reset, just get new question
    async handleReroll(interaction, userId, guildId, member, questionNumber, questionResults, currentRerollsUsed) {
        const newRerollsUsed = currentRerollsUsed + 1;
        console.log(`[QUIZ] Reroll requested for Q${questionNumber} - Rerolls used: ${currentRerollsUsed} -> ${newRerollsUsed}`);
        
        // Continue with new question and incremented reroll count
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

    // Show continue message after correct answer with proper button handling
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
        
        // Handle continue buttons with proper collector and immediate deferUpdate
        const continueCollector = continueMessage.createMessageComponentCollector({
            time: 15000,
            filter: i => i.user.id === userId
        });
        
        continueCollector.on('collect', async (contButton) => {
            try {
                console.log(`[QUIZ] Continue button clicked: ${contButton.customId}`);
                
                try {
                    await contButton.deferUpdate();
                } catch (deferError) {
                    console.error(`[QUIZ] CRITICAL: Failed to defer continue button interaction:`, deferError);
                    continueCollector.stop('defer_failed');
                    return;
                }
                
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
                try {
                    if (!contButton.replied && !contButton.deferred) {
                        await contButton.deferUpdate();
                    }
                } catch (ackError) {
                    console.error('[QUIZ] Failed to acknowledge continue button interaction:', ackError);
                }
            }
        });
        
        continueCollector.on('end', async (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                setTimeout(async () => {
                    await this.askQuestion(originalInteraction, userId, guildId, member, questionNumber + 1, questionResults, rerollsUsed);
                }, 100);
            }
        });
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
            
            await this.cleanupQuizMessages(userId, await buttonInteraction.fetchReply());
        }
        
        this.cleanupQuiz(userId);
    }

    // Handle timeout - give Continue/Abandon options
    async handleTimeout(interaction, userId, guildId, member, questionNumber, questionResults, rerollsUsed = 0) {
        console.log(`[QUIZ] Q${questionNumber} timed out for ${member.displayName} - Rerolls preserved: ${rerollsUsed}`);
        
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
                
                const timeoutCollector = timeoutMessage.createMessageComponentCollector({
                    filter: i => i.user.id === userId
                });
                
                timeoutCollector.on('collect', async (timeoutButton) => {
                    try {
                        await timeoutButton.deferUpdate();
                        
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
                    }
                });
                
            } catch (error) {
                console.log('[QUIZ] Could not send timeout message:', error.message);
                setTimeout(async () => {
                    await this.askQuestion(interaction, userId, guildId, member, questionNumber + 1, newResults, rerollsUsed);
                }, 2000);
            }
        }
    }

    // Handle quiz abandonment
    async handleQuizAbandon(buttonInteraction, userId, guildId, member, questionResults) {
        try {
            const successfulAnswers = questionResults.filter(r => r === true).length;
            
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
                .setFooter({ text: isTestingMode() ? '🧪 Testing Mode - Quiz Abandoned' : 'Quiz Abandoned' })
                .setTimestamp();
            
            if (typeof buttonInteraction.editReply === 'function') {
                await buttonInteraction.editReply({ embeds: [abandonEmbed], components: [] });
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
                return;
            }

            let deletedCount = 0;
            for (const message of messages) {
                try {
                    if (message.id === finalMessage?.id) {
                        continue;
                    }
                    
                    await message.delete();
                    deletedCount++;
                    
                    await new Promise(resolve => setTimeout(resolve, 250));
                } catch (error) {
                    console.log(`[QUIZ] Could not delete message ${message.id}: ${error.message}`);
                }
            }
            
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
        
        if (this.quizMessages.has(userId)) {
            this.quizMessages.delete(userId);
        }
    }

    // Cleanup old question history (keep last 60 days)
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

    // Clean up old caches
    cleanupOldCaches() {
        const now = Date.now();
        const maxAge = 30 * 60 * 1000; // 30 minutes
        
        for (const [userId, cache] of this.questionCache.entries()) {
            if (now - cache.createdAt > maxAge) {
                this.questionCache.delete(userId);
                
                if (this.activeQuizUserId === userId) {
                    this.activeQuizUserId = null;
                }
                
                if (this.quizMessages.has(userId)) {
                    this.quizMessages.delete(userId);
                }
            }
        }
    }
}

module.exports = QuizManager;

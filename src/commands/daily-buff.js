// src/commands/daily-buff.js - Progressive 5-Question System with Enhanced Design

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Enhanced tier colors and configurations (5 tiers only)
const TIER_COLORS = {
    1: [76, 175, 80],    // Material Green
    2: [33, 150, 243],   // Material Blue
    3: [156, 39, 176],   // Material Purple
    4: [255, 193, 7],    // Material Amber
    5: [255, 87, 34]     // Material Deep Orange
};

const TIER_NAMES = {
    1: 'Common',
    2: 'Rare', 
    3: 'Epic',
    4: 'Legendary',
    5: 'Divine'
};

const TIER_DESCRIPTIONS = {
    1: '⚓ Common enhancement boost',
    2: '🔱 Rare power amplification', 
    3: '🎖️ Epic ability enhancement',
    4: '⭐ Legendary mastery boost',
    5: '💎 Divine transcendence power'
};

// Updated difficulty mapping for 5 questions
const QUESTION_DIFFICULTY_MAP = {
    1: 'Easy',      // Question 1 - Easy
    2: 'Medium',    // Question 2 - Medium
    3: 'Medium',    // Question 3 - Medium
    4: 'Hard',      // Question 4 - Hard
    5: 'Hard'       // Question 5 - Hard (Final question)
};

// Enhanced API configuration with better character encoding
const QUIZ_APIS = [
    {
        name: 'AniQuizAPI',
        url: 'https://aniquizapi.vercel.app/api/quiz',
        parser: (data) => {
            let question, options, answer, difficulty;
            
            // Handle AniQuizAPI's nested data structure
            if (data.data && data.data.question && data.data.correct && data.data.options) {
                question = data.data.question;
                options = Array.isArray(data.data.options) ? data.data.options : [];
                answer = data.data.correct;
                difficulty = data.data.difficulty || 'Medium';
            } else if (data.question && data.correct && data.options) {
                question = data.question;
                options = Array.isArray(data.options) ? data.options : [];
                answer = data.correct;
                difficulty = data.difficulty || 'Medium';
            } else {
                throw new Error('Invalid API response structure');
            }
            
            // Enhanced character encoding handling
            const cleanText = (text) => {
                if (!text) return '';
                
                let cleaned = text
                    .replace(/&quot;/g, '"')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
                    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec, 10)))
                    .replace(/\\u([0-9A-Fa-f]{4})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
                
                try {
                    cleaned = cleaned.normalize('NFC');
                } catch (error) {
                    console.warn('[ENCODING] Unicode normalization failed:', error);
                }
                
                return cleaned.trim();
            };
            
            // Clean all text fields
            question = cleanText(question);
            answer = cleanText(answer);
            options = options.map(opt => cleanText(opt)).filter(opt => opt.length > 0);
            
            // Validate and ensure answer is in options
            if (!question || options.length < 2 || !answer) {
                throw new Error('Invalid question data after cleaning');
            }
            
            if (!options.includes(answer)) {
                const answerLower = answer.toLowerCase();
                const matchingOption = options.find(opt => opt.toLowerCase() === answerLower);
                
                if (matchingOption) {
                    answer = matchingOption;
                } else {
                    if (options.length >= 4) {
                        options[3] = answer;
                    } else {
                        options.push(answer);
                    }
                }
            }
            
            // Limit to 4 options and shuffle
            if (options.length > 4) {
                const correctIndex = options.indexOf(answer);
                const otherOptions = options.filter((opt, index) => index !== correctIndex);
                const randomOthers = otherOptions.sort(() => 0.5 - Math.random()).slice(0, 3);
                options = [answer, ...randomOthers].sort(() => 0.5 - Math.random());
            }
            
            return { question, options, answer, difficulty };
        }
    }
];

// Enhanced fallback questions
const FALLBACK_QUESTIONS = {
    'Easy': [
        {
            question: "Who is the main protagonist of One Piece?",
            options: ["Monkey D. Luffy", "Roronoa Zoro", "Nami", "Sanji"],
            answer: "Monkey D. Luffy",
            difficulty: "Easy"
        },
        {
            question: "What is the name of Luffy's Devil Fruit?",
            options: ["Gomu Gomu no Mi", "Mera Mera no Mi", "Hito Hito no Mi", "Yami Yami no Mi"],
            answer: "Gomu Gomu no Mi",
            difficulty: "Easy"
        },
        {
            question: "Who is the main character of Naruto?",
            options: ["Naruto Uzumaki", "Sasuke Uchiha", "Sakura Haruno", "Kakashi Hatake"],
            answer: "Naruto Uzumaki",
            difficulty: "Easy"
        },
        {
            question: "What is the name of the hero school in My Hero Academia?",
            options: ["U.A. High School", "Shiketsu High", "Ketsubutsu Academy", "Seiai Academy"],
            answer: "U.A. High School",
            difficulty: "Easy"
        }
    ],
    'Medium': [
        {
            question: "In Attack on Titan, what is Eren's Titan form called?",
            options: ["Attack Titan", "Colossal Titan", "Female Titan", "Beast Titan"],
            answer: "Attack Titan",
            difficulty: "Medium"
        },
        {
            question: "Who is known as 'Humanity's Strongest Soldier' in Attack on Titan?",
            options: ["Levi Ackerman", "Erwin Smith", "Mikasa Ackerman", "Eren Yeager"],
            answer: "Levi Ackerman",
            difficulty: "Medium"
        },
        {
            question: "In Dragon Ball Z, what is Goku's Saiyan birth name?",
            options: ["Kakarot", "Vegeta", "Raditz", "Bardock"],
            answer: "Kakarot",
            difficulty: "Medium"
        },
        {
            question: "What is the name of Ichigo's Zanpakuto in Bleach?",
            options: ["Zangetsu", "Senbonzakura", "Hyorinmaru", "Ryujin Jakka"],
            answer: "Zangetsu",
            difficulty: "Medium"
        }
    ],
    'Hard': [
        {
            question: "In One Piece, what is the name of the island where the Straw Hats first meet Brook?",
            options: ["Thriller Bark", "Sabaody Archipelago", "Water 7", "Enies Lobby"],
            answer: "Thriller Bark",
            difficulty: "Hard"
        },
        {
            question: "In Fullmetal Alchemist, what is the real name of the Flame Alchemist?",
            options: ["Roy Mustang", "Alex Louis Armstrong", "Maes Hughes", "King Bradley"],
            answer: "Roy Mustang",
            difficulty: "Hard"
        },
        {
            question: "In Jujutsu Kaisen, what grade is Yuji Itadori classified as initially?",
            options: ["Grade 4", "Grade 3", "Grade 2", "Grade 1"],
            answer: "Grade 4",
            difficulty: "Hard"
        },
        {
            question: "In Hunter x Hunter, what is the name of Killua's family business?",
            options: ["Assassination", "Bounty Hunting", "Mercenary Work", "Security Services"],
            answer: "Assassination",
            difficulty: "Hard"
        }
    ]
};

class ProgressiveQuizSystem {
    // Fetch question by difficulty
    static async fetchQuestionByDifficulty(difficulty) {
        console.log(`[PROGRESSIVE QUIZ] Fetching ${difficulty} question...`);
        
        // Try API first
        for (const api of QUIZ_APIS) {
            let attempts = 0;
            const maxAttempts = 3;
            
            while (attempts < maxAttempts) {
                try {
                    attempts++;
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 8000);
                    
                    const response = await fetch(api.url, {
                        method: 'GET',
                        headers: {
                            'User-Agent': 'DiscordBot-AnimeQuiz/1.0',
                            'Accept': 'application/json'
                        },
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                        const data = await response.json();
                        const parsedQuestion = api.parser(data);
                        
                        if (parsedQuestion && parsedQuestion.question && parsedQuestion.options && parsedQuestion.answer) {
                            parsedQuestion.difficulty = difficulty;
                            console.log(`[PROGRESSIVE QUIZ] ✅ Successfully fetched from ${api.name}`);
                            return parsedQuestion;
                        }
                    }
                } catch (error) {
                    console.log(`[PROGRESSIVE QUIZ] ❌ ${api.name} failed (attempt ${attempts}):`, error.message);
                    if (attempts < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
                    }
                }
            }
        }

        // Use fallback questions
        console.log(`[PROGRESSIVE QUIZ] 🛡️ Using fallback ${difficulty} question`);
        const difficultyQuestions = FALLBACK_QUESTIONS[difficulty] || FALLBACK_QUESTIONS['Medium'];
        const fallbackQuestion = difficultyQuestions[Math.floor(Math.random() * difficultyQuestions.length)];
        return fallbackQuestion;
    }

    // Create beautiful quiz embed
    static createProgressiveQuizEmbed(questionData, questionNumber, userId, timeRemaining = 20) {
        const difficultyEmoji = {
            'Easy': '🟢',
            'Medium': '🟡', 
            'Hard': '🔴'
        };

        const difficultyColor = {
            'Easy': [76, 175, 80],
            'Medium': [255, 193, 7],
            'Hard': [255, 87, 34]
        };

        // Enhanced progress visualization (5 questions)
        const progressBars = [];
        for (let i = 1; i <= 5; i++) {
            if (i < questionNumber) {
                progressBars.push('🟦');
            } else if (i === questionNumber) {
                progressBars.push('🔷');
            } else {
                progressBars.push('⬜');
            }
        }
        
        // Enhanced timer
        const totalTime = 20;
        const timeProgress = Math.max(0, Math.min(totalTime, timeRemaining));
        const progressLength = 12;
        const filledBars = Math.round((timeProgress / totalTime) * progressLength);
        const emptyBars = progressLength - filledBars;
        
        let timeBarEmoji, embedColor;
        if (timeRemaining > 12) {
            timeBarEmoji = '🟩';
            embedColor = difficultyColor[questionData.difficulty] || [46, 204, 113];
        } else if (timeRemaining > 6) {
            timeBarEmoji = '🟨';
            embedColor = [255, 165, 0];
        } else {
            timeBarEmoji = '🟥';
            embedColor = [231, 76, 60];
        }
        
        const timeBar = timeBarEmoji.repeat(filledBars) + '⬛'.repeat(emptyBars);
        
        const embed = new EmbedBuilder()
            .setAuthor({ 
                name: '🎌 PROGRESSIVE ANIME MASTERY CHALLENGE'
            })
            .setTitle(`${difficultyEmoji[questionData.difficulty]} Question ${questionNumber}/5 • ${questionData.difficulty}`)
            .setColor(embedColor)
            .setDescription(`### ${questionData.question}\n\n*Select your answer from the buttons below*`)
            .addFields(
                {
                    name: '📊 Progress',
                    value: `${progressBars.join('')}\n\`Challenge: ${questionNumber}/5 Complete\``,
                    inline: true
                },
                {
                    name: `⏰ Time Remaining`,
                    value: `\`${timeBar}\`\n\`${timeRemaining} seconds left\``,
                    inline: true
                },
                {
                    name: '🏆 Current Status',
                    value: questionNumber > 1 ? 
                        `**Secured:** ${TIER_NAMES[questionNumber - 1]}\n**Target:** ${TIER_NAMES[questionNumber]}` :
                        `**Target Tier:** ${TIER_NAMES[questionNumber]}\n**Description:** ${TIER_DESCRIPTIONS[questionNumber]}`,
                    inline: false
                }
            )
            .setFooter({ 
                text: `Enhancement Intelligence • Progressive Challenge System • Difficulty: ${questionData.difficulty}`
            })
            .setTimestamp();

        return embed;
    }

    // Create enhanced answer buttons
    static createProgressiveAnswerButtons(questionData, questionNumber, userId) {
        const buttons = [];
        const options = questionData.options.slice(0, 4);
        const emojis = ['🅰️', '🅱️', '🅾️', '🆎'];

        options.forEach((option, index) => {
            const isCorrect = option === questionData.answer;
            const truncatedOption = option.length > 70 ? option.substring(0, 67) + '...' : option;
            
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`progressive_quiz_${userId}_${questionNumber}_${index}_${isCorrect}`)
                    .setLabel(truncatedOption)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(emojis[index])
            );
        });

        const rows = [];
        for (let i = 0; i < buttons.length; i += 2) {
            rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 2)));
        }

        if (questionNumber > 1) {
            const stopButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`progressive_stop_${userId}_${questionNumber}`)
                        .setLabel(`🛑 Secure ${TIER_NAMES[questionNumber - 1]} (Safe Choice)`)
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🛡️')
                );
            rows.push(stopButton);
        }

        return rows;
    }

    // Create beautiful result embeds
    static createProgressiveResultEmbed(isCorrect, questionData, finalTier, member, questionNumber, stoppedEarly = false) {
        const tierName = finalTier > 0 ? TIER_NAMES[finalTier] : 'No Enhancement';
        const color = finalTier > 0 ? TIER_COLORS[finalTier] : [156, 163, 175];
        const nextReset = getNextResetUnixTimestamp();

        const getTierIcon = (tier) => {
            const icons = ['❌', '⚓', '🔱', '🎖️', '⭐', '💎'];
            return icons[tier] || '❌';
        };

        if (stoppedEarly) {
            return new EmbedBuilder()
                .setTitle(`${getTierIcon(finalTier)} Strategic Withdrawal - Tier Secured!`)
                .setColor(color)
                .setDescription(`**${tierName}** enhancement successfully secured!\n*${TIER_DESCRIPTIONS[finalTier]}*`)
                .addFields({
                    name: '📊 Challenge Results',
                    value: `**Final Score:** ${finalTier}/5\n**Strategy:** Secured Tier\n**Next Reset:** <t:${nextReset}:R>`,
                    inline: false
                })
                .setFooter({ text: `${tierName} Active • Progressive Enhancement System` })
                .setTimestamp();
        }

        if (isCorrect && finalTier === 5) {
            return new EmbedBuilder()
                .setTitle('💎 DIVINE MASTERY ACHIEVED!')
                .setColor(color)
                .setDescription(`**${tierName} Status Unlocked!**\n*${TIER_DESCRIPTIONS[finalTier]}*\n\n🏆 **FLAWLESS VICTORY** - All 5 questions answered correctly!`)
                .addFields({
                    name: '🎖️ Supreme Achievement',
                    value: `**Perfect Score:** 5/5\n**Enhancement:** ${tierName}\n**Next Reset:** <t:${nextReset}:R>`,
                    inline: false
                })
                .setFooter({ text: `${tierName} Active • Divine Mastery Achievement` })
                .setTimestamp();
        }

        if (isCorrect && questionNumber < 5) {
            const nextDifficulty = QUESTION_DIFFICULTY_MAP[questionNumber + 1];
            return new EmbedBuilder()
                .setTitle(`✅ Correct! ${getTierIcon(questionNumber)} Tier ${questionNumber} Achieved`)
                .setColor([46, 204, 113])
                .setDescription(`**${tierName}** secured! Continue to the next challenge or claim your current tier.`)
                .addFields({
                    name: '🎯 Decision Point',
                    value: `**Next Challenge:** Question ${questionNumber + 1}/5 (${nextDifficulty})\n**Current Tier:** ${tierName}`,
                    inline: false
                })
                .setFooter({ text: 'Enhancement Intelligence • Choose your path wisely' })
                .setTimestamp();
        }

        if (!isCorrect) {
            return new EmbedBuilder()
                .setTitle(finalTier > 0 ? 
                    `❌ Challenge Failed - ${getTierIcon(finalTier)} Previous Tier Applied` : 
                    '❌ Challenge Failed - No Enhancement')
                .setColor(color)
                .setDescription(finalTier > 0 ? 
                    `**${tierName}** enhancement applied based on previous progress.` :
                    `No enhancement earned. Study harder and try again tomorrow!`)
                .addFields({
                    name: '📊 Final Results',
                    value: `**Score:** ${finalTier}/5\n**Correct Answer:** ${questionData.answer}\n**Next Reset:** <t:${nextReset}:R>`,
                    inline: false
                })
                .setFooter({ 
                    text: finalTier > 0 ? 
                        `${tierName} Active • Progressive Enhancement System` : 
                        'Enhancement Intelligence • Challenge Failed'
                })
                .setTimestamp();
        }

        return new EmbedBuilder()
            .setTitle('🎌 Progressive Challenge Complete')
            .setColor([156, 163, 175])
            .setDescription('Challenge session concluded.')
            .setTimestamp();
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily-buff')
        .setDescription('🎌 Take the progressive anime mastery challenge! 5 questions, increasing difficulty, your score = your tier!'),

    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            const member = interaction.member;

            if (!global.xpTracker || !global.xpTracker.db) {
                return await interaction.reply({
                    content: '❌ **Daily Enhancement System Unavailable**\n\nXP tracking system not initialized.',
                    flags: 64
                });
            }

            const hasRolledToday = await this.checkDailyRoll(userId, guildId);
            if (hasRolledToday) {
                const currentBuff = await this.getCurrentBuff(userId, guildId, member);
                const nextReset = getNextResetUnixTimestamp();
                
                const embed = new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setTitle('🎌 Daily Mastery Challenge Already Completed')
                    .setDescription(`You've already completed today's progressive challenge!\n\n**Current Enhancement:** ${currentBuff.name}\n**Status:** ${currentBuff.multiplier}\n\n*Next challenge available: <t:${nextReset}:R>*`)
                    .setFooter({ text: 'Enhancement Intelligence • Progressive Mastery System' })
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], flags: 64 });
            }

            await interaction.deferReply();
            await this.startProgressiveQuiz(interaction, userId, guildId, member);

        } catch (error) {
            console.error('[PROGRESSIVE CHALLENGE] Error in daily-buff command:', error);
            
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ **Error**\n\nSomething went wrong with the progressive challenge system. Please try again.'
                });
            } else {
                await interaction.reply({
                    content: '❌ **Error**\n\nSomething went wrong with the progressive challenge system. Please try again.',
                    flags: 64
                });
            }
        }
    },

    async startProgressiveQuiz(interaction, userId, guildId, member) {
        try {
            console.log(`[PROGRESSIVE QUIZ] Starting progressive challenge for ${interaction.user.username}`);
            await this.askProgressiveQuestion(interaction, userId, guildId, member, 1, 0);
        } catch (error) {
            console.error('[PROGRESSIVE QUIZ] Progressive quiz error:', error);
            await interaction.editReply({
                content: '❌ **Quiz Error**\n\nFailed to load progressive challenge. Please try again.'
            });
        }
    },

    async askProgressiveQuestion(interaction, userId, guildId, member, questionNumber, currentTier) {
        try {
            const difficulty = QUESTION_DIFFICULTY_MAP[questionNumber];
            const questionData = await ProgressiveQuizSystem.fetchQuestionByDifficulty(difficulty);
            
            let timeRemaining = 20;
            
            const quizEmbed = ProgressiveQuizSystem.createProgressiveQuizEmbed(questionData, questionNumber, userId, timeRemaining);
            const answerButtons = ProgressiveQuizSystem.createProgressiveAnswerButtons(questionData, questionNumber, userId);
            
            let message;
            if (questionNumber === 1) {
                await interaction.editReply({ embeds: [quizEmbed], components: answerButtons });
                message = await interaction.fetchReply();
            } else {
                const followUp = await interaction.followUp({ embeds: [quizEmbed], components: answerButtons });
                message = followUp;
            }

            const timerInterval = setInterval(async () => {
                timeRemaining -= 4;
                
                if (timeRemaining <= 0) {
                    clearInterval(timerInterval);
                    return;
                }
                
                try {
                    const updatedEmbed = ProgressiveQuizSystem.createProgressiveQuizEmbed(questionData, questionNumber, userId, timeRemaining);
                    await message.edit({ embeds: [updatedEmbed], components: answerButtons }).catch(() => {
                        clearInterval(timerInterval);
                    });
                } catch (error) {
                    clearInterval(timerInterval);
                }
            }, 4000);

            const collector = message.createMessageComponentCollector({ 
                time: 20000,
                filter: (i) => i.user.id === userId && (i.customId.startsWith('progressive_quiz_') || i.customId.startsWith('progressive_stop_'))
            });

            collector.on('collect', async (buttonInteraction) => {
                try {
                    clearInterval(timerInterval);
                    await buttonInteraction.deferUpdate();
                    
                    if (buttonInteraction.customId.startsWith('progressive_stop_')) {
                        const [, , userIdFromButton, questionNum] = buttonInteraction.customId.split('_');
                        const finalTier = parseInt(questionNum) - 1;
                        
                        await this.applyBuffRole(userId, guildId, member, finalTier);
                        
                        const resultEmbed = ProgressiveQuizSystem.createProgressiveResultEmbed(
                            false, questionData, finalTier, member, questionNumber, true
                        );
                        
                        await buttonInteraction.editReply({ embeds: [resultEmbed], components: [] });
                        collector.stop();
                        return;
                    }
                    
                    const [, , userIdFromButton, questionNum, optionIndex, isCorrectStr] = buttonInteraction.customId.split('_');
                    const isCorrect = isCorrectStr === 'true';
                    
                    if (isCorrect) {
                        const newTier = parseInt(questionNum);
                        
                        if (newTier === 5) {
                            await this.applyBuffRole(userId, guildId, member, 5);
                            
                            const resultEmbed = ProgressiveQuizSystem.createProgressiveResultEmbed(
                                true, questionData, 5, member, 5
                            );
                            
                            await buttonInteraction.editReply({ embeds: [resultEmbed], components: [] });
                        } else {
                            const continueEmbed = ProgressiveQuizSystem.createProgressiveResultEmbed(
                                true, questionData, newTier, member, parseInt(questionNum)
                            );
                            
                            const continueButton = new ActionRowBuilder()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(`continue_quiz_${userId}_${newTier + 1}`)
                                        .setLabel(`➡️ Continue to Question ${newTier + 1}`)
                                        .setStyle(ButtonStyle.Success)
                                        .setEmoji('⚡'),
                                    new ButtonBuilder()
                                        .setCustomId(`claim_tier_${userId}_${newTier}`)
                                        .setLabel(`🛡️ Secure ${TIER_NAMES[newTier]}`)
                                        .setStyle(ButtonStyle.Secondary)
                                        .setEmoji('🛑')
                                );
                            
                            await buttonInteraction.editReply({ embeds: [continueEmbed], components: [continueButton] });
                            
                            const continueCollector = buttonInteraction.message.createMessageComponentCollector({
                                time: 30000,
                                filter: (i) => i.user.id === userId && (i.customId.startsWith('continue_quiz_') || i.customId.startsWith('claim_tier_'))
                            });
                            
                            continueCollector.on('collect', async (continueInteraction) => {
                                await continueInteraction.deferUpdate();
                                
                                if (continueInteraction.customId.startsWith('continue_quiz_')) {
                                    const [, , , nextQuestionNum] = continueInteraction.customId.split('_');
                                    continueCollector.stop();
                                    await this.askProgressiveQuestion(interaction, userId, guildId, member, parseInt(nextQuestionNum), newTier);
                                } else if (continueInteraction.customId.startsWith('claim_tier_')) {
                                    const [, , , claimTier] = continueInteraction.customId.split('_');
                                    await this.applyBuffRole(userId, guildId, member, parseInt(claimTier));
                                    
                                    const claimEmbed = ProgressiveQuizSystem.createProgressiveResultEmbed(
                                        false, questionData, parseInt(claimTier), member, parseInt(claimTier), true
                                    );
                                    
                                    await continueInteraction.editReply({ embeds: [claimEmbed], components: [] });
                                    continueCollector.stop();
                                }
                            });
                            
                            continueCollector.on('end', async (collected) => {
                                if (collected.size === 0) {
                                    await this.applyBuffRole(userId, guildId, member, newTier);
                                    
                                    const autoClaimEmbed = ProgressiveQuizSystem.createProgressiveResultEmbed(
                                        false, questionData, newTier, member, newTier, true
                                    );
                                    
                                    await buttonInteraction.editReply({ embeds: [autoClaimEmbed], components: [] });
                                }
                            });
                        }
                    } else {
                        const finalTier = Math.max(0, parseInt(questionNum) - 1);
                        
                        if (finalTier > 0) {
                        await this.applyBuffRole(userId, guildId, member, finalTier);
                    } else {
                        await this.saveFailedAttempt(userId, guildId);
                    }
                    
                    const timeoutEmbed = new EmbedBuilder()
                        .setColor([231, 76, 60])
                        .setTitle('⏰ Time\'s Up!')
                        .setDescription(finalTier > 0 ? 
                            `Your previous tier (**${TIER_NAMES[finalTier]}**) has been applied.` :
                            `No enhancement earned. Time ran out on the first question!`)
                        .addFields({
                            name: '💡 Next Attempt',
                            value: `<t:${getNextResetUnixTimestamp()}:R>`,
                            inline: false
                        })
                        .setFooter({ text: 'Enhancement Intelligence • Progressive Challenge System' })
                        .setTimestamp();

                    await message.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {
                        if (questionNumber === 1) {
                            interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(console.error);
                        }
                    });
                }
            });

        } catch (error) {
            console.error('[PROGRESSIVE QUIZ] Error asking question:', error);
            throw error;
        }
    },

    async saveFailedAttempt(userId, guildId) {
        try {
            const currentDay = getCurrentDayKey();
            
            await global.xpTracker.db.query(`
                INSERT INTO daily_buff_rolls (user_id, guild_id, date, tier, created_at)
                VALUES ($1, $2, $3, 0, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, guild_id, date)
                DO UPDATE SET tier = 0
            `, [userId, guildId, currentDay]);

            console.log(`[PROGRESSIVE QUIZ] ❌ Saved failed attempt for ${userId} on ${currentDay}`);

        } catch (error) {
            console.error('[PROGRESSIVE QUIZ] Error saving failed attempt:', error);
        }
    },

    async checkDailyRoll(userId, guildId) {
        try {
            const currentDay = getCurrentDayKey();
            
            const result = await global.xpTracker.db.query(
                'SELECT * FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [userId, guildId, currentDay]
            );

            return result.rows.length > 0;
        } catch (error) {
            console.error('[PROGRESSIVE QUIZ] Error checking daily roll:', error);
            return false;
        }
    },

    async getCurrentBuff(userId, guildId, member) {
        try {
            const currentDay = getCurrentDayKey();
            const result = await global.xpTracker.db.query(
                'SELECT tier FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [userId, guildId, currentDay]
            );

            if (result.rows.length > 0) {
                const tier = result.rows[0].tier;
                if (tier === 0) {
                    return { tier: 0, name: 'Challenge Failed', multiplier: 'None' };
                }
                return {
                    tier: tier,
                    name: TIER_NAMES[tier],
                    multiplier: 'Active'
                };
            }

            // Fallback: check roles (5 tiers only)
            for (let tier = 1; tier <= 5; tier++) {
                const roleId = process.env[`DAILY_XP_BUFF_TIER_${tier}_ROLE`];
                if (roleId && member.roles.cache.has(roleId)) {
                    return {
                        tier: tier,
                        name: TIER_NAMES[tier],
                        multiplier: 'Active'
                    };
                }
            }

            return { tier: 0, name: 'No Enhancement', multiplier: 'None' };
        } catch (error) {
            console.error('[PROGRESSIVE QUIZ] Error getting current buff:', error);
            return { tier: 0, name: 'Error', multiplier: 'None' };
        }
    },

    async applyBuffRole(userId, guildId, member, tier) {
        try {
            await this.removeAllBuffRoles(member);

            if (tier > 0) {
                const roleId = process.env[`DAILY_XP_BUFF_TIER_${tier}_ROLE`];
                if (roleId) {
                    const role = member.guild.roles.cache.get(roleId);
                    if (role) {
                        await member.roles.add(role);
                        console.log(`[PROGRESSIVE QUIZ] ✅ Awarded ${role.name} to ${member.user.username}`);
                    } else {
                        console.error(`[PROGRESSIVE QUIZ] ❌ Role not found: ${roleId}`);
                    }
                } else {
                    console.warn(`[PROGRESSIVE QUIZ] ⚠️ No role ID configured for tier ${tier}`);
                }
            }

            await this.saveBuffRoll(userId, guildId, tier);

        } catch (error) {
            console.error('[PROGRESSIVE QUIZ] ❌ Error applying buff role:', error);
        }
    },

    async removeAllBuffRoles(member) {
        for (let i = 1; i <= 5; i++) {
            const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`];
            if (roleId && member.roles.cache.has(roleId)) {
                const role = member.guild.roles.cache.get(roleId);
                if (role) {
                    await member.roles.remove(role);
                    console.log(`[PROGRESSIVE QUIZ] Removed ${role.name} from ${member.user.username}`);
                }
            }
        }
    },

    async saveBuffRoll(userId, guildId, tier) {
        try {
            await global.xpTracker.db.query(`
                CREATE TABLE IF NOT EXISTS daily_buff_rolls (
                    user_id VARCHAR(20) NOT NULL,
                    guild_id VARCHAR(20) NOT NULL,
                    date DATE NOT NULL,
                    tier INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, guild_id, date)
                )
            `);

            const currentDay = getCurrentDayKey();
            
            await global.xpTracker.db.query(`
                INSERT INTO daily_buff_rolls (user_id, guild_id, date, tier)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, guild_id, date)
                DO UPDATE SET tier = $4
            `, [userId, guildId, currentDay, tier]);

            console.log(`[PROGRESSIVE QUIZ] ✅ Saved tier ${tier} result for ${userId} on ${currentDay}`);

        } catch (error) {
            console.error('[PROGRESSIVE QUIZ] ❌ Error saving buff roll:', error);
        }
    },

    async checkDailyBuffStatus(userId, guildId) {
        try {
            const currentDay = getCurrentDayKey();
            
            const dbResult = await global.xpTracker.db.query(
                'SELECT * FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [userId, guildId, currentDay]
            );
            
            const hasDBRecord = dbResult.rows.length > 0;
            const dbTier = hasDBRecord ? dbResult.rows[0].tier : null;
            
            const guild = global.client?.guilds?.cache?.get(guildId);
            const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
            const currentRoles = [];
            
            if (member) {
                for (let i = 1; i <= 5; i++) {
                    const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`];
                    if (roleId && member.roles.cache.has(roleId)) {
                        const role = member.guild.roles.cache.get(roleId);
                        if (role) {
                            currentRoles.push({
                                tier: i,
                                roleId: roleId,
                                roleName: role.name
                            });
                        }
                    }
                }
            }
            
            return {
                currentDay,
                hasDBRecord,
                dbTier,
                currentRoles,
                canRoll: !hasDBRecord
            };
            
        } catch (error) {
            console.error('[PROGRESSIVE QUIZ] Error checking daily buff status:', error);
            return {
                currentDay: getCurrentDayKey(),
                hasDBRecord: false,
                dbTier: null,
                currentRoles: [],
                canRoll: true,
                error: error.message
            };
        }
    },

    async forceRemoveDailyBuff(userId, guildId, reason = 'Admin removal') {
        try {
            const currentDay = getCurrentDayKey();
            const removedRoles = [];
            let dbRecordsRemoved = 0;
            
            const guild = global.client?.guilds?.cache?.get(guildId);
            const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
            
            if (member) {
                for (let i = 1; i <= 5; i++) {
                    const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`];
                    if (roleId && member.roles.cache.has(roleId)) {
                        const role = member.guild.roles.cache.get(roleId);
                        if (role) {
                            await member.roles.remove(role, reason);
                            removedRoles.push(`Tier ${i}: ${role.name}`);
                        }
                    }
                }
            }
            
            const deleteResult = await global.xpTracker.db.query(
                'DELETE FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3 RETURNING *',
                [userId, guildId, currentDay]
            );
            
            dbRecordsRemoved = deleteResult.rowCount;
            
            console.log(`[PROGRESSIVE QUIZ] ✅ Force removed daily buff for ${userId}: ${removedRoles.length} roles, ${dbRecordsRemoved} DB records`);
            
            return {
                success: true,
                removedRoles,
                dbRecordsRemoved,
                currentDay,
                reason
            };
            
        } catch (error) {
            console.error('[PROGRESSIVE QUIZ] Error force removing daily buff:', error);
            return {
                success: false,
                error: error.message,
                removedRoles: [],
                dbRecordsRemoved: 0
            };
        }
    }
};

// Helper functions for timezone handling
function getCurrentDayKey() {
    const now = new Date();
    const estOffset = isESTDaylightSaving(now) ? -4 : -5;
    const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
    
    if (estTime.getHours() < 3) {
        estTime.setDate(estTime.getDate() - 1);
    }
    
    return estTime.toISOString().split('T')[0];
}

function isESTDaylightSaving(date) {
    const year = date.getFullYear();
    const march = new Date(year, 2, 1);
    const november = new Date(year, 10, 1);
    
    const dstStart = new Date(year, 2, (14 - march.getDay()) % 7 + 8);
    const dstEnd = new Date(year, 10, (7 - november.getDay()) % 7 + 1);
    
    return date >= dstStart && date < dstEnd;
}

function getNextResetUnixTimestamp() {
    const now = new Date();
    const estOffset = isESTDaylightSaving(now) ? -4 : -5;
    const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
    
    const nextReset = new Date(estTime);
    nextReset.setHours(3, 0, 0, 0);
    
    if (estTime.getHours() >= 3) {
        nextReset.setDate(nextReset.getDate() + 1);
    }
    
    const utcReset = new Date(nextReset.getTime() - (estOffset * 60 * 60 * 1000));
    return Math.floor(utcReset.getTime() / 1000);
} {
                            await this.applyBuffRole(userId, guildId, member, finalTier);
                        } else {
                            await this.saveFailedAttempt(userId, guildId);
                        }
                        
                        const resultEmbed = ProgressiveQuizSystem.createProgressiveResultEmbed(
                            false, questionData, finalTier, member, parseInt(questionNum)
                        );
                        
                        await buttonInteraction.editReply({ embeds: [resultEmbed], components: [] });
                    }
                    
                    collector.stop();
                    
                } catch (error) {
                    console.error('[PROGRESSIVE QUIZ] Button interaction error:', error);
                    clearInterval(timerInterval);
                    await buttonInteraction.editReply({
                        content: '❌ **Error processing answer**\n\nPlease try the quiz again.',
                        components: []
                    });
                }
            });

            collector.on('end', async (collected) => {
                clearInterval(timerInterval);
                
                if (collected.size === 0) {
                    const finalTier = Math.max(0, currentTier);
                    
                    if (finalTier > 0)

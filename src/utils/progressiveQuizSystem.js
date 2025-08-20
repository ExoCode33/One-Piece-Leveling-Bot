// src/utils/progressiveQuizSystem.js - Quiz System Logic

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getCurrentDayKey, getNextResetUnixTimestamp } = require('./timezoneHelpers');

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

// Enhanced API configuration
const QUIZ_APIS = [
    {
        name: 'AniQuizAPI',
        url: 'https://aniquizapi.vercel.app/api/quiz',
        parser: (data) => {
            let question, options, answer, difficulty;
            
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
            
            // Clean text
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
            
            question = cleanText(question);
            answer = cleanText(answer);
            options = options.map(opt => cleanText(opt)).filter(opt => opt.length > 0);
            
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

// Fallback questions
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
    async fetchQuestionByDifficulty(questionNumber) {
        const difficulty = QUESTION_DIFFICULTY_MAP[questionNumber];
        console.log(`[PROGRESSIVE QUIZ] Fetching ${difficulty} question for question ${questionNumber}...`);
        
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

    // Create quiz embed
    createQuizEmbed(questionData, questionNumber, userId, timeRemaining = 20) {
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

    // Create answer buttons
    createAnswerButtons(questionData, questionNumber, userId) {
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

    // Create result embeds
    createResultEmbed(isCorrect, questionData, finalTier, member, questionNumber, stoppedEarly = false) {
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
    ProgressiveQuizSystem,
    TIER_NAMES,
    TIER_COLORS,
    TIER_DESCRIPTIONS,
    QUESTION_DIFFICULTY_MAP
};

// src/commands/daily-buff.js - Progressive 6-Question System with Tier-Based Difficulty

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Tier colors and configurations - RGB values for better visual appeal
const TIER_COLORS = {
    1: [34, 197, 94],    // Green - rgb(34, 197, 94)
    2: [59, 130, 246],   // Blue - rgb(59, 130, 246)
    3: [139, 92, 246],   // Purple - rgb(139, 92, 246)
    4: [245, 158, 11],   // Gold - rgb(245, 158, 11)
    5: [249, 115, 22],   // Orange - rgb(249, 115, 22)
    6: [239, 68, 68]     // Red - rgb(239, 68, 68)
};

const TIER_NAMES = {
    1: 'Marine Training',
    2: 'Enhanced Drill', 
    3: 'Elite Protocol',
    4: 'Admiral Focus',
    5: 'Fleet Command',
    6: 'World Government Authorization'
};

const TIER_DESCRIPTIONS = {
    1: '🔰 Basic enhancement for new recruits',
    2: '⚔️ Improved training protocols activated', 
    3: '🏅 Elite-level performance boost engaged',
    4: '🌟 Admiral-tier strategic enhancement',
    5: '💎 Fleet command authority granted',
    6: '👑 Maximum World Government clearance'
};

// ✅ NEW: Progressive Question System Configuration
const QUESTION_DIFFICULTY_MAP = {
    1: 'Easy',    // Question 1 - Easy
    2: 'Medium',  // Question 2 - Medium
    3: 'Medium',  // Question 3 - Medium
    4: 'Medium',  // Question 4 - Medium
    5: 'Hard',    // Question 5 - Hard
    6: 'Hard'     // Question 6 - Hard
};

// ✅ PRODUCTION: API configuration that handles AniQuizAPI's metadata format
const QUIZ_APIS = [
    {
        name: 'AniQuizAPI',
        url: 'https://aniquizapi.vercel.app/api/quiz',
        parser: (data) => {
            console.log('[API DEBUG] Raw AniQuizAPI response:', JSON.stringify(data, null, 2));
            
            // ✅ FIXED: AniQuizAPI ALWAYS includes metadata alongside quiz data
            // We need to extract the quiz fields while ignoring the metadata
            let question, options, answer, difficulty;
            
            // Check if this response has quiz data (even with metadata)
            if (data.question && data.options && data.answer) {
                // Standard format - extract quiz data, ignore metadata
                question = data.question;
                options = Array.isArray(data.options) ? data.options : [];
                answer = data.answer;
                difficulty = data.difficulty || 'Medium';
                
                console.log('[API DEBUG] Successfully extracted quiz data from AniQuizAPI (ignoring metadata)');
            } else if (data.data && data.data.question) {
                // Nested data format
                question = data.data.question;
                options = Array.isArray(data.data.options) ? data.data.options : [];
                answer = data.data.answer;
                difficulty = data.data.difficulty || 'Medium';
            } else if (data.results && Array.isArray(data.results) && data.results.length > 0) {
                // Results array format
                const result = data.results[0];
                question = result.question;
                options = Array.isArray(result.options) ? result.options : [];
                answer = result.answer;
                difficulty = result.difficulty || 'Medium';
            } else {
                // ✅ FIXED: Better error message for truly invalid responses
                console.log('[API DEBUG] No valid quiz data found in AniQuizAPI response');
                throw new Error('No quiz data found in API response');
            }
            
            // Validate required fields
            if (!question || !question.trim()) {
                throw new Error('Missing or empty question');
            }
            
            if (!Array.isArray(options) || options.length < 2) {
                throw new Error(`Invalid or insufficient options (found ${options?.length || 0}, need at least 2)`);
            }
            
            if (!answer || !answer.trim()) {
                throw new Error('Missing or empty answer');
            }
            
            // Ensure answer is in options
            if (!options.includes(answer)) {
                console.log('[API DEBUG] Answer not found in options, adding it');
                // If answer not in options, replace last option with correct answer
                if (options.length > 0) {
                    options[options.length - 1] = answer;
                } else {
                    options = [answer, 'Option 2', 'Option 3', 'Option 4'];
                }
            }
            
            // Limit to 4 options max and ensure variety
            if (options.length > 4) {
                // Keep correct answer and 3 random others
                const correctIndex = options.indexOf(answer);
                const otherOptions = options.filter((opt, index) => index !== correctIndex);
                const randomOthers = otherOptions.sort(() => 0.5 - Math.random()).slice(0, 3);
                options = [answer, ...randomOthers].sort(() => 0.5 - Math.random());
            }
            
            // Clean up options
            const cleanOptions = options.filter(opt => opt && opt.trim()).slice(0, 4);
            
            console.log('[API DEBUG] ✅ Successfully parsed AniQuizAPI question:', { 
                question: question.substring(0, 50) + '...', 
                optionsCount: cleanOptions.length, 
                answer, 
                difficulty,
                hasMetadata: !!(data.creator || data.github) // Log if metadata was present
            });
            
            return {
                question: question.trim(),
                options: cleanOptions,
                answer: answer.trim(),
                difficulty: difficulty
            };
        }
    }
    // ✅ You can add more APIs here when you find them
    // The fallback system ensures your quiz always works
];

// ✅ ENHANCED: Difficulty-Categorized Fallback Questions with more variety
const FALLBACK_QUESTIONS = {
    'Easy': [
        {
            question: "Who is the captain of the Straw Hat Pirates in One Piece?",
            options: ["Monkey D. Luffy", "Roronoa Zoro", "Nami", "Sanji"],
            answer: "Monkey D. Luffy",
            difficulty: "Easy"
        },
        {
            question: "What is Naruto's signature jutsu?",
            options: ["Chidori", "Rasengan", "Shadow Clone Jutsu", "Byakugan"],
            answer: "Rasengan",
            difficulty: "Easy"
        },
        {
            question: "Who is the main protagonist of Demon Slayer?",
            options: ["Tanjiro Kamado", "Zenitsu Agatsuma", "Inosuke Hashibira", "Giyu Tomioka"],
            answer: "Tanjiro Kamado",
            difficulty: "Easy"
        },
        {
            question: "Which anime features the character Light Yagami?",
            options: ["Death Note", "Tokyo Ghoul", "Code Geass", "Future Diary"],
            answer: "Death Note",
            difficulty: "Easy"
        },
        {
            question: "What is the name of the hero school in My Hero Academia?",
            options: ["U.A. High School", "Shiketsu High", "Ketsubutsu Academy", "Seiai Academy"],
            answer: "U.A. High School",
            difficulty: "Easy"
        },
        {
            question: "What type of creature is Pikachu?",
            options: ["Electric Mouse", "Fire Lizard", "Water Turtle", "Grass Frog"],
            answer: "Electric Mouse",
            difficulty: "Easy"
        },
        {
            question: "Who is the main character of Dragon Ball?",
            options: ["Goku", "Vegeta", "Piccolo", "Gohan"],
            answer: "Goku",
            difficulty: "Easy"
        },
        {
            question: "What is the name of the giant creatures in Attack on Titan?",
            options: ["Titans", "Giants", "Colossi", "Behemoths"],
            answer: "Titans",
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
            question: "In Fullmetal Alchemist, what is the fundamental law of alchemy?",
            options: ["Equivalent Exchange", "Conservation of Mass", "Transmutation Circle", "Philosopher's Stone"],
            answer: "Equivalent Exchange",
            difficulty: "Medium"
        },
        {
            question: "What is the name of Ichigo's Zanpakuto in Bleach?",
            options: ["Zangetsu", "Senbonzakura", "Hyorinmaru", "Ryujin Jakka"],
            answer: "Zangetsu",
            difficulty: "Medium"
        },
        {
            question: "In Jujutsu Kaisen, who is known as the King of Curses?",
            options: ["Ryomen Sukuna", "Satoru Gojo", "Yuji Itadori", "Megumi Fushiguro"],
            answer: "Ryomen Sukuna",
            difficulty: "Medium"
        },
        {
            question: "Who is the Survey Corps commander in Attack on Titan Season 1-3?",
            options: ["Erwin Smith", "Levi Ackerman", "Hange Zoe", "Keith Shadis"],
            answer: "Erwin Smith",
            difficulty: "Medium"
        },
        {
            question: "In One Piece, what is the name of Luffy's Devil Fruit?",
            options: ["Gomu Gomu no Mi", "Mera Mera no Mi", "Hito Hito no Mi", "Yami Yami no Mi"],
            answer: "Gomu Gomu no Mi",
            difficulty: "Medium"
        }
    ],
    'Hard': [
        {
            question: "In Steins;Gate, what is the name of the time travel theory that involves sending text messages to the past?",
            options: ["D-Mail Theory", "Butterfly Effect", "Convergence Theory", "Attractor Field"],
            answer: "D-Mail Theory",
            difficulty: "Hard"
        },
        {
            question: "Which philosopher's work heavily influences the themes in Ghost in the Shell?",
            options: ["René Descartes", "Immanuel Kant", "Martin Heidegger", "Jean Baudrillard"],
            answer: "René Descartes",
            difficulty: "Hard"
        },
        {
            question: "In Neon Genesis Evangelion, what does the acronym NERV stand for?",
            options: ["Neural Electronic Research Vessel", "Never Ending Reality Vision", "No official meaning given", "New European Research Vehicle"],
            answer: "No official meaning given",
            difficulty: "Hard"
        },
        {
            question: "In Monster, what is the name of the children's book that plays a crucial role in the story?",
            options: ["The Nameless Monster", "The God of Peace", "The Devil's Child", "The Quiet Room"],
            answer: "The Nameless Monster",
            difficulty: "Hard"
        },
        {
            question: "In Serial Experiments Lain, what does the Wired represent?",
            options: ["Internet/Collective Unconscious", "Virtual Reality", "Computer Network", "Alien Communication"],
            answer: "Internet/Collective Unconscious",
            difficulty: "Hard"
        },
        {
            question: "What is the real identity of the character known as 'John Doe' in Monster?",
            options: ["Johan Liebert", "Wolfgang Grimmer", "Kenzo Tenma", "Heinrich Lunge"],
            answer: "Johan Liebert",
            difficulty: "Hard"
        },
        {
            question: "In Psycho-Pass, what is the Sibyl System primarily composed of?",
            options: ["Criminally Asymptomatic Brains", "Advanced AI Algorithms", "Quantum Computers", "Neural Networks"],
            answer: "Criminally Asymptomatic Brains",
            difficulty: "Hard"
        },
        {
            question: "In Legend of the Galactic Heroes, what is the name of Yang Wen-li's flagship?",
            options: ["Hyperion", "Brunhild", "Triglav", "Barbarossa"],
            answer: "Hyperion",
            difficulty: "Hard"
        },
        {
            question: "In Perfect Blue, what is Mima's profession before becoming an idol?",
            options: ["She was always an idol", "Actress", "Singer", "Voice Actor"],
            answer: "She was always an idol",
            difficulty: "Hard"
        },
        {
            question: "In Paranoia Agent, what is the real identity of Lil' Slugger?",
            options: ["Collective unconscious manifestation", "Makoto Kozuka", "Tsukiko Sagi", "Keiichi Ikari"],
            answer: "Collective unconscious manifestation",
            difficulty: "Hard"
        }
    ]
};

class ProgressiveQuizSystem {
    // ✅ ENHANCED: Fetch question by specific difficulty with better error handling
    static async fetchQuestionByDifficulty(difficulty) {
        console.log(`[PROGRESSIVE QUIZ] Fetching ${difficulty} question...`);
        
        // Try API first with multiple attempts
        for (const api of QUIZ_APIS) {
            let attempts = 0;
            const maxAttempts = 3;
            
            while (attempts < maxAttempts) {
                try {
                    attempts++;
                    console.log(`[PROGRESSIVE QUIZ] Trying ${api.name} for ${difficulty} question... (Attempt ${attempts}/${maxAttempts})`);
                    
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
                    
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
                        
                        try {
                            const parsedQuestion = api.parser(data);
                            
                            if (parsedQuestion && parsedQuestion.question && parsedQuestion.options && parsedQuestion.answer) {
                                // ✅ Override API difficulty with our required difficulty
                                parsedQuestion.difficulty = difficulty;
                                console.log(`[PROGRESSIVE QUIZ] ✅ Successfully fetched from ${api.name} (attempt ${attempts})`);
                                return parsedQuestion;
                            } else {
                                console.log(`[PROGRESSIVE QUIZ] ❌ ${api.name} parser returned invalid question (attempt ${attempts})`);
                            }
                        } catch (parseError) {
                            console.log(`[PROGRESSIVE QUIZ] ❌ ${api.name} parser error (attempt ${attempts}):`, parseError.message);
                        }
                    } else {
                        console.log(`[PROGRESSIVE QUIZ] ❌ ${api.name} HTTP error: ${response.status} (attempt ${attempts})`);
                    }
                    
                } catch (error) {
                    console.log(`[PROGRESSIVE QUIZ] ❌ ${api.name} request failed (attempt ${attempts}):`, error.message);
                    
                    // Wait before retry (except on last attempt)
                    if (attempts < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempts)); // Progressive delay
                    }
                }
            }
            
            console.log(`[PROGRESSIVE QUIZ] ❌ ${api.name} exhausted all ${maxAttempts} attempts`);
        }

        // ✅ ENHANCED: Use fallback questions by difficulty with better selection
        console.log(`[PROGRESSIVE QUIZ] 🛡️ All APIs failed, using fallback ${difficulty} question`);
        const difficultyQuestions = FALLBACK_QUESTIONS[difficulty];
        
        if (!difficultyQuestions || difficultyQuestions.length === 0) {
            console.log(`[PROGRESSIVE QUIZ] ⚠️ No fallback questions for ${difficulty}, using Medium`);
            const fallbackDifficulty = 'Medium';
            const fallbackQuestions = FALLBACK_QUESTIONS[fallbackDifficulty];
            const fallbackQuestion = fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
            fallbackQuestion.difficulty = difficulty; // Override display difficulty
            return fallbackQuestion;
        }
        
        const fallbackQuestion = difficultyQuestions[Math.floor(Math.random() * difficultyQuestions.length)];
        console.log(`[PROGRESSIVE QUIZ] ✅ Using fallback question: "${fallbackQuestion.question.substring(0, 50)}..."`);
        return fallbackQuestion;
    }

    // ✅ ENHANCED: Create progressive quiz embed with improved layout and RGB colors
    static createProgressiveQuizEmbed(questionData, questionNumber, userId, timeRemaining = 30) {
        const difficultyEmoji = {
            'Easy': '🟢',
            'Medium': '🟡', 
            'Hard': '🔴'
        };

        // Enhanced progress visualization
        const progressEmoji = '🔹'.repeat(questionNumber - 1) + '🔸' + '⚪'.repeat(6 - questionNumber);
        const progressText = `${questionNumber}/6`;
        
        // ✅ ENHANCED: Advanced 30-second countdown with better visuals
        const totalTime = 30;
        const timeProgress = Math.max(0, Math.min(totalTime, timeRemaining));
        const progressLength = 15; // Shorter for better mobile display
        const filledBars = Math.round((timeProgress / totalTime) * progressLength);
        const emptyBars = progressLength - filledBars;
        
        // Enhanced color coding with RGB values
        let timeBarEmoji, timeColor, embedColor;
        if (timeRemaining > 20) {
            timeBarEmoji = '🟩';
            timeColor = '🟢';
            embedColor = [46, 204, 113]; // Green - rgb(46, 204, 113)
        } else if (timeRemaining > 10) {
            timeBarEmoji = '🟨';
            timeColor = '🟡';
            embedColor = [255, 165, 0]; // Orange - rgb(255, 165, 0)
        } else {
            timeBarEmoji = '🟥';
            timeColor = '🔴';
            embedColor = [231, 76, 60]; // Red - rgb(231, 76, 60)
        }
        
        const timeBar = timeBarEmoji.repeat(filledBars) + '⬛'.repeat(emptyBars);
        
        // Current and target tier colors for visual hierarchy
        const currentTierColor = questionNumber > 1 ? TIER_COLORS[questionNumber - 1] : [156, 163, 175]; // Gray
        const targetTierColor = TIER_COLORS[questionNumber];
        
        const embed = new EmbedBuilder()
            .setAuthor({ 
                name: '🏛️ WORLD GOVERNMENT INTELLIGENCE BUREAU',
                iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png' // Optional: Add Marine logo
            })
            .setTitle(`⚔️ Progressive Anime Knowledge Assessment`)
            .setColor(embedColor)
            .setDescription(`> **${questionData.question}**\n\n*🎯 Answer correctly to advance, or secure your current progress!*`)
            .addFields(
                {
                    name: '📊 Assessment Status',
                    value: `\`\`\`yaml\nQuestion: ${progressText}\nDifficulty: ${questionData.difficulty}\nProgress: ${progressEmoji}\n\`\`\``,
                    inline: true
                },
                {
                    name: '⏰ Time Pressure',
                    value: `${timeColor} **${timeRemaining}s**\n\`${timeBar}\`\n*${timeRemaining <= 5 ? '🚨 CRITICAL TIME' : timeRemaining <= 15 ? '⚠️ Time Running Low' : '✅ Adequate Time'}*`,
                    inline: true
                },
                {
                    name: '🎖️ Enhancement Tiers',
                    value: questionNumber > 1 ? 
                        `**Current Secured:**\n> 🔒 **Tier ${questionNumber - 1}** - ${TIER_NAMES[questionNumber - 1]}\n> ${TIER_DESCRIPTIONS[questionNumber - 1]}\n\n**Target Advancement:**\n> 🎯 **Tier ${questionNumber}** - ${TIER_NAMES[questionNumber]}\n> ${TIER_DESCRIPTIONS[questionNumber]}` :
                        `**Target Achievement:**\n> 🎯 **Tier ${questionNumber}** - ${TIER_NAMES[questionNumber]}\n> ${TIER_DESCRIPTIONS[questionNumber]}\n\n*⚠️ Failure grants no enhancement and blocks retry*`,
                    inline: false
                }
            )
            .setFooter({ 
                text: `Marine Intelligence Division • Progressive Assessment Protocol • Question ${questionNumber}/6`,
                iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png' // Optional: Small Marine icon
            })
            .setTimestamp();

        // Add difficulty-specific styling
        if (questionData.difficulty === 'Hard') {
            embed.addFields({
                name: '⚠️ DIFFICULTY WARNING',
                value: '```diff\n- EXTREME DIFFICULTY DETECTED\n- PROCEED WITH CAUTION\n- HIGH RISK / HIGH REWARD\n```',
                inline: false
            });
        }

        // Add urgency field for low time
        if (timeRemaining <= 10) {
            embed.addFields({
                name: '🚨 URGENT DECISION REQUIRED',
                value: `\`\`\`ansi\n\u001b[1;31m⚠️ ${timeRemaining} SECONDS REMAINING\n⚠️ ANSWER NOW OR LOSE PROGRESS\u001b[0m\n\`\`\``,
                inline: false
            });
        }

        return embed;
    }

    // Create answer buttons with stop option for questions 2+
    static createProgressiveAnswerButtons(questionData, questionNumber, userId) {
        const buttons = [];
        const options = questionData.options.slice(0, 4);
        const emojis = ['🇦', '🇧', '🇨', '🇩'];

        options.forEach((option, index) => {
            const isCorrect = option === questionData.answer;
            const truncatedOption = option.length > 75 ? option.substring(0, 72) + '...' : option;
            
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`progressive_quiz_${userId}_${questionNumber}_${index}_${isCorrect}`)
                    .setLabel(truncatedOption)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(emojis[index])
            );
        });

        const rows = [];
        
        // Add answer buttons
        for (let i = 0; i < buttons.length; i += 4) {
            rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 4)));
        }

        // Add stop button for questions 2+ (user has already earned at least tier 1)
        if (questionNumber > 1) {
            const stopButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`progressive_stop_${userId}_${questionNumber}`)
                        .setLabel(`🛑 Stop Here & Claim Tier ${questionNumber - 1} (${TIER_NAMES[questionNumber - 1]})`)
                        .setStyle(ButtonStyle.Secondary)
                );
            rows.push(stopButton);
        }

        return rows;
    }

    // ✅ ENHANCED: Create final result embed with improved RGB styling
    static createProgressiveResultEmbed(isCorrect, questionData, finalTier, member, questionNumber, stoppedEarly = false) {
        const tierName = finalTier > 0 ? TIER_NAMES[finalTier] : 'No Enhancement';
        const tierDescription = finalTier > 0 ? TIER_DESCRIPTIONS[finalTier] : '❌ No benefits granted';
        const color = finalTier > 0 ? TIER_COLORS[finalTier] : [156, 163, 175]; // Gray for no tier
        const nextReset = getNextResetUnixTimestamp();

        if (stoppedEarly) {
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: '🏛️ WORLD GOVERNMENT INTELLIGENCE BUREAU'
                })
                .setTitle('🛑 Strategic Withdrawal - Enhancement Secured!')
                .setColor(color)
                .setDescription(`> **Tactical decision acknowledged!** 🎖️\n> Your enhancement has been successfully secured and activated.`)
                .addFields(
                    {
                        name: '📊 Mission Summary',
                        value: `\`\`\`yaml\nQuestions Completed: ${finalTier}/6\nStrategy: Risk Management\nOutcome: Enhancement Secured\nStatus: SUCCESSFUL OPERATION\n\`\`\``,
                        inline: false
                    },
                    {
                        name: '🎖️ Enhancement Activated',
                        value: `**${tierName}**\n${tierDescription}\n\n\`\`\`diff\n+ Enhancement Status: ACTIVE\n+ Authority Level: Tier ${finalTier}\n+ Duration: Until Next Reset\n\`\`\``,
                        inline: false
                    },
                    {
                        name: '⏰ System Information',
                        value: `**Next Reset:** <t:${nextReset}:R>\n**Reset Time:** <t:${nextReset}:f>\n**Strategy:** Calculated Risk Management`,
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `${tierName} Enhancement Active • Marine Enhancement Division • Strategic Success`,
                })
                .setTimestamp();
            return embed;
        }

        if (isCorrect && finalTier === 6) {
            // Perfect score!
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: '🏛️ WORLD GOVERNMENT INTELLIGENCE BUREAU'
                })
                .setTitle('🏆 PERFECT ASSESSMENT - MAXIMUM CLEARANCE GRANTED!')
                .setColor(color)
                .setDescription(`> **EXTRAORDINARY ACHIEVEMENT!** 👑\n> Maximum enhancement tier unlocked with perfect performance!`)
                .addFields(
                    {
                        name: '🎖️ Perfect Performance Record',
                        value: `**Final Question:** ${questionData.question.substring(0, 80)}${questionData.question.length > 80 ? '...' : ''}\n**Answer:** ${questionData.answer} ✅\n**Difficulty:** ${questionData.difficulty}\n\n\`\`\`ansi\n\u001b[1;33m🏆 PERFECT SCORE: 6/6 QUESTIONS CORRECT\u001b[0m\n\`\`\``,
                        inline: false
                    },
                    {
                        name: '👑 Maximum Enhancement Granted',
                        value: `**${tierName}**\n${tierDescription}\n\n\`\`\`diff\n+ Enhancement Status: MAXIMUM TIER ACTIVE\n+ Authority Level: WORLD GOVERNMENT\n+ Achievement: PERFECT SCORE\n+ Special Recognition: ELITE PERFORMANCE\n\`\`\``,
                        inline: false
                    },
                    {
                        name: '⏰ Elite Status Information',
                        value: `**Next Reset:** <t:${nextReset}:R>\n**Reset Time:** <t:${nextReset}:f>\n**Achievement:** Perfect Knowledge Assessment`,
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `${tierName} Enhancement Active • Marine Enhancement Division • Perfect Achievement`,
                })
                .setTimestamp();
            return embed;
        }

        if (isCorrect && questionNumber < 6) {
            // Correct answer, continue to next question
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: '🏛️ WORLD GOVERNMENT INTELLIGENCE BUREAU'
                })
                .setTitle('✅ Correct Assessment - Advancement Available!')
                .setColor([46, 204, 113]) // Success green
                .setDescription(`> **Excellent knowledge demonstrated!** 🎯\n> Choose your strategy: advance for higher tier or secure current progress.`)
                .addFields(
                    {
                        name: '📚 Assessment Result',
                        value: `**Question:** ${questionData.question.substring(0, 80)}${questionData.question.length > 80 ? '...' : ''}\n**Your Answer:** ${questionData.answer} ✅\n**Difficulty:** ${questionData.difficulty}\n\n\`\`\`diff\n+ CORRECT RESPONSE CONFIRMED\n+ ADVANCEMENT AUTHORIZED\n\`\`\``,
                        inline: false
                    },
                    {
                        name: '🎖️ Current Achievement',
                        value: `**Tier ${questionNumber} Secured:** ${TIER_NAMES[questionNumber]}\n${TIER_DESCRIPTIONS[questionNumber]}\n\n*This tier is now guaranteed regardless of future performance.*`,
                        inline: false
                    },
                    {
                        name: '🎯 Next Challenge Preview',
                        value: `**Next Question:** ${questionNumber + 1}/6\n**Difficulty:** ${QUESTION_DIFFICULTY_MAP[questionNumber + 1]}\n**Target Tier:** ${TIER_NAMES[questionNumber + 1]}\n**Reward:** ${TIER_DESCRIPTIONS[questionNumber + 1]}`,
                        inline: false
                    }
                )
                .setFooter({ 
                    text: 'Marine Intelligence • Strategic Decision Point • Choose Wisely',
                })
                .setTimestamp();
            return embed;
        }

        if (!isCorrect) {
            // Wrong answer - game over
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: '🏛️ WORLD GOVERNMENT INTELLIGENCE BUREAU'
                })
                .setTitle(finalTier > 0 ? '❌ Assessment Failed - Previous Tier Maintained' : '❌ Assessment Failed - No Enhancement Granted')
                .setColor(color)
                .setDescription(finalTier > 0 ? 
                    `> **Mission partially completed.** Your previous achievement is secured.\n> Enhancement **${tierName}** has been activated.` :
                    `> **Assessment unsuccessful.** No enhancement granted for this period.\n> Study period recommended before next attempt.`)
                .addFields(
                    {
                        name: '📚 Final Assessment',
                        value: `**Question:** ${questionData.question.substring(0, 80)}${questionData.question.length > 80 ? '...' : ''}\n**Correct Answer:** ${questionData.answer}\n**Difficulty:** ${questionData.difficulty}\n\n\`\`\`ansi\n\u001b[1;31m❌ INCORRECT RESPONSE - ASSESSMENT TERMINATED\u001b[0m\n\`\`\`\n**Final Score:** ${finalTier}/6 questions correct`,
                        inline: false
                    },
                    {
                        name: finalTier > 0 ? '🎖️ Enhancement Status' : '📖 Study Recommendations',
                        value: finalTier > 0 ? 
                            `**${tierName}**\n${tierDescription}\n\n\`\`\`diff\n+ Enhancement Status: ACTIVE\n+ Authority Level: Tier ${finalTier}\n+ Achievement: ${finalTier} Correct Responses\n\`\`\`` :
                            `**Recommended Focus Areas:**\n• Anime character knowledge\n• Plot understanding\n• Series terminology\n\n\`\`\`yaml\nNext Attempt: Available tomorrow\nStrategy: Enhanced preparation\nGoal: First question success\n\`\`\``,
                        inline: false
                    },
                    {
                        name: '⏰ Reset Information',
                        value: `**Next Attempt:** <t:${nextReset}:R>\n**Reset Time:** <t:${nextReset}:f>\n${finalTier > 0 ? '**Status:** Enhancement Active' : '**Status:** Study Period'}`,
                        inline: false
                    }
                )
                .setFooter({ 
                    text: finalTier > 0 ? 
                        `${tierName} Enhancement Active • Marine Enhancement Division • Partial Success` : 
                        'Marine Intelligence • Study Division • Preparation Recommended',
                })
                .setTimestamp();
            return embed;
        }

        // Fallback
        return new EmbedBuilder()
            .setTitle('🎌 Assessment Complete')
            .setColor([156, 163, 175]) // Gray
            .setDescription('Assessment session concluded.')
            .setTimestamp();
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily-buff')
        .setDescription('🎌 Take the progressive anime challenge! Up to 6 questions, your score = your buff tier!'),

    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            const member = interaction.member;

            // Check if XP tracker is available
            if (!global.xpTracker || !global.xpTracker.db) {
                return await interaction.reply({
                    content: '❌ **Daily Buff System Unavailable**\n\nXP tracking system not initialized.',
                    flags: 64
                });
            }

            // Check if user already took quiz today
            const hasRolledToday = await this.checkDailyRoll(userId, guildId);
            if (hasRolledToday) {
                const currentBuff = await this.getCurrentBuff(userId, guildId, member);
                const nextReset = getNextResetUnixTimestamp();
                
                const embed = new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setTitle('🎌 Daily Challenge Already Completed')
                    .setDescription(`You've already taken today's progressive challenge!\n\n**Current Enhancement:** ${currentBuff.name}\n**Status:** ${currentBuff.multiplier}\n\n*Next challenge available: <t:${nextReset}:R>*`)
                    .setFooter({ text: 'Marine Intelligence • Daily Progressive Challenge' })
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], flags: 64 });
            }

            // Start the progressive quiz
            await interaction.deferReply();
            await this.startProgressiveQuiz(interaction, userId, guildId, member);

        } catch (error) {
            console.error('[PROGRESSIVE BUFF] Error in daily-buff command:', error);
            
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

    // ✅ NEW: Start progressive quiz system
    async startProgressiveQuiz(interaction, userId, guildId, member) {
        try {
            console.log(`[PROGRESSIVE QUIZ] Starting progressive challenge for ${interaction.user.username}`);
            
            // Start with question 1 (Easy)
            await this.askProgressiveQuestion(interaction, userId, guildId, member, 1, 0);

        } catch (error) {
            console.error('[PROGRESSIVE QUIZ] Progressive quiz error:', error);
            await interaction.editReply({
                content: '❌ **Quiz Error**\n\nFailed to load progressive challenge. Please try again.'
            });
        }
    },

    // ✅ NEW: Ask a specific question in the progression with live timer
    async askProgressiveQuestion(interaction, userId, guildId, member, questionNumber, currentTier) {
        try {
            const difficulty = QUESTION_DIFFICULTY_MAP[questionNumber];
            const questionData = await ProgressiveQuizSystem.fetchQuestionByDifficulty(difficulty);
            
            let timeRemaining = 30;
            
            // Create initial quiz embed and buttons
            const quizEmbed = ProgressiveQuizSystem.createProgressiveQuizEmbed(questionData, questionNumber, userId, timeRemaining);
            const answerButtons = ProgressiveQuizSystem.createProgressiveAnswerButtons(questionData, questionNumber, userId);
            
            // Send or edit the quiz
            let message;
            if (questionNumber === 1) {
                await interaction.editReply({ 
                    embeds: [quizEmbed], 
                    components: answerButtons 
                });
                message = await interaction.fetchReply();
            } else {
                // For subsequent questions, send as follow-up
                const followUp = await interaction.followUp({ 
                    embeds: [quizEmbed], 
                    components: answerButtons 
                });
                message = followUp;
            }

            // ✅ NEW: Set up live timer updates every 5 seconds
            const timerInterval = setInterval(async () => {
                timeRemaining -= 5;
                
                if (timeRemaining <= 0) {
                    clearInterval(timerInterval);
                    return; // Let the main collector handle timeout
                }
                
                try {
                    // Update embed with new timer
                    const updatedEmbed = ProgressiveQuizSystem.createProgressiveQuizEmbed(questionData, questionNumber, userId, timeRemaining);
                    
                    // Only update if message still exists and hasn't been answered
                    await message.edit({ 
                        embeds: [updatedEmbed], 
                        components: answerButtons 
                    }).catch(() => {
                        // Message might be deleted or answered, clear interval
                        clearInterval(timerInterval);
                    });
                } catch (error) {
                    // Error updating, probably answered or deleted
                    clearInterval(timerInterval);
                }
            }, 5000); // Update every 5 seconds

            // Set up button collector
            const collector = message.createMessageComponentCollector({ 
                time: 30000, // 30 seconds total
                filter: (i) => i.user.id === userId && (i.customId.startsWith('progressive_quiz_') || i.customId.startsWith('progressive_stop_'))
            });

            collector.on('collect', async (buttonInteraction) => {
                try {
                    // ✅ Clear timer when answer is given
                    clearInterval(timerInterval);
                    
                    await buttonInteraction.deferUpdate();
                    
                    // Handle stop button
                    if (buttonInteraction.customId.startsWith('progressive_stop_')) {
                        const [, , userIdFromButton, questionNum] = buttonInteraction.customId.split('_');
                        const finalTier = parseInt(questionNum) - 1; // They stopped, so they get the previous tier
                        
                        // Apply the buff role and save to database
                        await this.applyBuffRole(userId, guildId, member, finalTier);
                        
                        // Create and show result for stopping early
                        const resultEmbed = ProgressiveQuizSystem.createProgressiveResultEmbed(
                            false, questionData, finalTier, member, questionNumber, true
                        );
                        
                        await buttonInteraction.editReply({
                            embeds: [resultEmbed],
                            components: []
                        });
                        
                        collector.stop();
                        return;
                    }
                    
                    // Handle answer button
                    const [, , userIdFromButton, questionNum, optionIndex, isCorrectStr] = buttonInteraction.customId.split('_');
                    const isCorrect = isCorrectStr === 'true';
                    
                    if (isCorrect) {
                        const newTier = parseInt(questionNum);
                        
                        if (newTier === 6) {
                            // Perfect score! Apply max tier and end
                            await this.applyBuffRole(userId, guildId, member, 6);
                            
                            const resultEmbed = ProgressiveQuizSystem.createProgressiveResultEmbed(
                                true, questionData, 6, member, 6
                            );
                            
                            await buttonInteraction.editReply({
                                embeds: [resultEmbed],
                                components: []
                            });
                        } else {
                            // Show success and continue button
                            const continueEmbed = ProgressiveQuizSystem.createProgressiveResultEmbed(
                                true, questionData, newTier, member, parseInt(questionNum)
                            );
                            
                            const continueButton = new ActionRowBuilder()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(`continue_quiz_${userId}_${newTier + 1}`)
                                        .setLabel(`➡️ Continue to Question ${newTier + 1} (${QUESTION_DIFFICULTY_MAP[newTier + 1]})`)
                                        .setStyle(ButtonStyle.Success),
                                    new ButtonBuilder()
                                        .setCustomId(`claim_tier_${userId}_${newTier}`)
                                        .setLabel(`🛑 Claim Tier ${newTier} (${TIER_NAMES[newTier]})`)
                                        .setStyle(ButtonStyle.Secondary)
                                );
                            
                            await buttonInteraction.editReply({
                                embeds: [continueEmbed],
                                components: [continueButton]
                            });
                            
                            // Set up continue/claim collector
                            const continueCollector = buttonInteraction.message.createMessageComponentCollector({
                                time: 60000, // 60 seconds to decide
                                filter: (i) => i.user.id === userId && (i.customId.startsWith('continue_quiz_') || i.customId.startsWith('claim_tier_'))
                            });
                            
                            continueCollector.on('collect', async (continueInteraction) => {
                                await continueInteraction.deferUpdate();
                                
                                if (continueInteraction.customId.startsWith('continue_quiz_')) {
                                    const [, , , nextQuestionNum] = continueInteraction.customId.split('_');
                                    continueCollector.stop();
                                    
                                    // Continue to next question
                                    await this.askProgressiveQuestion(interaction, userId, guildId, member, parseInt(nextQuestionNum), newTier);
                                } else if (continueInteraction.customId.startsWith('claim_tier_')) {
                                    const [, , , claimTier] = continueInteraction.customId.split('_');
                                    
                                    // Apply the buff role and save to database
                                    await this.applyBuffRole(userId, guildId, member, parseInt(claimTier));
                                    
                                    const claimEmbed = ProgressiveQuizSystem.createProgressiveResultEmbed(
                                        false, questionData, parseInt(claimTier), member, parseInt(claimTier), true
                                    );
                                    
                                    await continueInteraction.editReply({
                                        embeds: [claimEmbed],
                                        components: []
                                    });
                                    
                                    continueCollector.stop();
                                }
                            });
                            
                            continueCollector.on('end', async (collected) => {
                                if (collected.size === 0) {
                                    // Auto-claim if no decision made
                                    await this.applyBuffRole(userId, guildId, member, newTier);
                                    
                                    const autoClaimEmbed = ProgressiveQuizSystem.createProgressiveResultEmbed(
                                        false, questionData, newTier, member, newTier, true
                                    );
                                    
                                    await buttonInteraction.editReply({
                                        embeds: [autoClaimEmbed],
                                        components: []
                                    });
                                }
                            });
                        }
                    } else {
                        // Wrong answer - apply current tier and end
                        const finalTier = Math.max(0, parseInt(questionNum) - 1);
                        
                        if (finalTier > 0) {
                            await this.applyBuffRole(userId, guildId, member, finalTier);
                        } else {
                            // Failed on first question - save to database that they attempted
                            await this.saveFailedAttempt(userId, guildId);
                        }
                        
                        const resultEmbed = ProgressiveQuizSystem.createProgressiveResultEmbed(
                            false, questionData, finalTier, member, parseInt(questionNum)
                        );
                        
                        await buttonInteraction.editReply({
                            embeds: [resultEmbed],
                            components: []
                        });
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
                // ✅ Clear timer on collector end
                clearInterval(timerInterval);
                
                if (collected.size === 0) {
                    // Timeout - apply current tier or mark as failed
                    const finalTier = Math.max(0, currentTier);
                    
                    if (finalTier > 0) {
                        await this.applyBuffRole(userId, guildId, member, finalTier);
                    } else {
                        await this.saveFailedAttempt(userId, guildId);
                    }
                    
                    const timeoutEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('⏰ Challenge Timeout!')
                        .setDescription(finalTier > 0 ? 
                            `**Time's up!** Your previous tier (${TIER_NAMES[finalTier]}) has been applied.` :
                            `**Time's up!** No enhancement earned.`)
                        .addFields({
                            name: '💡 Next Attempt',
                            value: `Try again tomorrow at <t:${getNextResetUnixTimestamp()}:R>`,
                            inline: false
                        })
                        .setFooter({ text: 'Marine Intelligence • Answer faster next time!' })
                        .setTimestamp();

                    await message.edit({
                        embeds: [timeoutEmbed],
                        components: []
                    }).catch(() => {
                        // Message might be deleted, try interaction edit
                        if (questionNumber === 1) {
                            interaction.editReply({
                                embeds: [timeoutEmbed],
                                components: []
                            }).catch(console.error);
                        }
                    });
                }
            });

        } catch (error) {
            console.error('[PROGRESSIVE QUIZ] Error asking question:', error);
            throw error;
        }
    },

    // ✅ NEW: Save failed attempt (failed on first question)
    async saveFailedAttempt(userId, guildId) {
        try {
            const currentDay = getCurrentDayKey();
            
            // Save to database that they attempted and failed on first question
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

    // Check if user has already taken quiz today
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

    // Get current buff for a user
    async getCurrentBuff(userId, guildId, member) {
        try {
            // First check database for today's attempt
            const currentDay = getCurrentDayKey();
            const result = await global.xpTracker.db.query(
                'SELECT tier FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [userId, guildId, currentDay]
            );

            if (result.rows.length > 0) {
                const tier = result.rows[0].tier;
                if (tier === 0) {
                    return { tier: 0, name: 'Failed on First Question', multiplier: 'None' };
                }
                return {
                    tier: tier,
                    name: TIER_NAMES[tier],
                    multiplier: 'Active'
                };
            }

            // Fallback: check roles
            for (let tier = 1; tier <= 6; tier++) {
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

    // Apply the buff role to the user
    async applyBuffRole(userId, guildId, member, tier) {
        try {
            // Remove any existing buff roles first
            await this.removeAllBuffRoles(member);

            if (tier > 0) {
                // Add the new buff role
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

            // Save to database
            await this.saveBuffRoll(userId, guildId, tier);

        } catch (error) {
            console.error('[PROGRESSIVE QUIZ] ❌ Error applying buff role:', error);
        }
    },

    // Remove all buff roles from user
    async removeAllBuffRoles(member) {
        for (let i = 1; i <= 6; i++) {
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

    // Save the buff roll to database
    async saveBuffRoll(userId, guildId, tier) {
        try {
            // Create table if it doesn't exist
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

    // ✅ NEW: Check daily buff status for admin commands
    async checkDailyBuffStatus(userId, guildId) {
        try {
            const currentDay = getCurrentDayKey();
            
            // Check database record
            const dbResult = await global.xpTracker.db.query(
                'SELECT * FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [userId, guildId, currentDay]
            );
            
            const hasDBRecord = dbResult.rows.length > 0;
            const dbTier = hasDBRecord ? dbResult.rows[0].tier : null;
            
            // Check current roles
            const guild = global.client?.guilds?.cache?.get(guildId);
            const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
            const currentRoles = [];
            
            if (member) {
                for (let i = 1; i <= 6; i++) {
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

    // ✅ NEW: Force remove daily buff (for admin command)
    async forceRemoveDailyBuff(userId, guildId, reason = 'Admin removal') {
        try {
            const currentDay = getCurrentDayKey();
            const removedRoles = [];
            let dbRecordsRemoved = 0;
            
            // Remove roles
            const guild = global.client?.guilds?.cache?.get(guildId);
            const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
            
            if (member) {
                for (let i = 1; i <= 6; i++) {
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
            
            // Remove database record
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
}

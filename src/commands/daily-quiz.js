// src/commands/daily-quiz.js - COMPLETE FIXED with question preloading and duplicate prevention

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const TIER_COLORS = { 
    1: [255, 255, 255], // Common - White
    2: [76, 175, 80],   // Uncommon - Green  
    3: [33, 150, 243],  // Rare - Blue
    4: [156, 39, 176],  // Epic - Purple
    5: [255, 193, 7],   // Legendary - Yellow
    6: [255, 193, 7],   // Legendary - Yellow
    7: [255, 87, 34],   // Mythic - Orange
    8: [255, 87, 34],   // Mythic - Orange
    9: [255, 20, 20],   // Divine - Red
    10: [255, 20, 20]   // Divine - Red
};

const TIER_NAMES = { 
    1: 'Common', 
    2: 'Uncommon', 
    3: 'Rare', 
    4: 'Epic', 
    5: 'Legendary', 
    6: 'Legendary', 
    7: 'Mythic', 
    8: 'Mythic', 
    9: 'Divine', 
    10: 'Divine' 
};

const TIER_DESC = { 
    1: '⚪ Common boost', 
    2: '🟢 Uncommon power', 
    3: '🔵 Rare ability', 
    4: '🟣 Epic mastery', 
    5: '🟡 Legendary might', 
    6: '🟡 Legendary supremacy', 
    7: '🟠 Mythic transcendence', 
    8: '🟠 Mythic dominance', 
    9: '🔴 Divine ascension', 
    10: '🔴 Divine perfection' 
};

// Enhanced anime-only fallback questions with more variety
const ANIME_ONLY_FALLBACK = {
    'Easy': [
        { question: "Who is the main protagonist of One Piece?", options: ["Monkey D. Luffy", "Roronoa Zoro", "Nami", "Sanji"], answer: "Monkey D. Luffy" },
        { question: "What is Luffy's Devil Fruit called?", options: ["Gomu Gomu no Mi", "Mera Mera no Mi", "Hito Hito no Mi", "Yami Yami no Mi"], answer: "Gomu Gomu no Mi" },
        { question: "In Naruto, what village is Naruto from?", options: ["Hidden Leaf Village", "Hidden Sand Village", "Hidden Mist Village", "Hidden Cloud Village"], answer: "Hidden Leaf Village" },
        { question: "What color is Pikachu in Pokemon?", options: ["Yellow", "Blue", "Red", "Green"], answer: "Yellow" },
        { question: "In Dragon Ball, what are the magical orbs called?", options: ["Dragon Balls", "Power Orbs", "Magic Spheres", "Wish Stones"], answer: "Dragon Balls" },
        { question: "What is the name of Luffy's pirate crew?", options: ["Straw Hat Pirates", "Red Hair Pirates", "Whitebeard Pirates", "Heart Pirates"], answer: "Straw Hat Pirates" },
        { question: "In My Hero Academia, what is Deku's real name?", options: ["Izuku Midoriya", "Katsuki Bakugo", "Shoto Todoroki", "Tenya Iida"], answer: "Izuku Midoriya" },
        { question: "What anime features a notebook that can kill people?", options: ["Death Note", "Code Geass", "Psycho-Pass", "Future Diary"], answer: "Death Note" },
        { question: "In Dragon Ball Z, what is Goku's Saiyan name?", options: ["Kakarot", "Vegeta", "Raditz", "Bardock"], answer: "Kakarot" },
        { question: "What is the name of the main character in Bleach?", options: ["Ichigo Kurosaki", "Rukia Kuchiki", "Uryu Ishida", "Chad Sado"], answer: "Ichigo Kurosaki" },
        { question: "In One Piece, what is Zoro's fighting style?", options: ["Three Sword Style", "Two Sword Style", "One Sword Style", "Four Sword Style"], answer: "Three Sword Style" },
        { question: "What is the name of the titan that can control other titans?", options: ["Founding Titan", "Attack Titan", "Colossal Titan", "Beast Titan"], answer: "Founding Titan" },
        { question: "In Demon Slayer, what breathing technique does Tanjiro use?", options: ["Water Breathing", "Fire Breathing", "Wind Breathing", "Stone Breathing"], answer: "Water Breathing" },
        { question: "What is the name of the school in Assassination Classroom?", options: ["Kunugigaoka Junior High", "U.A. High School", "Honnouji Academy", "Death Weapon Meister Academy"], answer: "Kunugigaoka Junior High" },
        { question: "In Fairy Tail, what is Natsu's magic type?", options: ["Fire Dragon Slayer", "Ice Make", "Celestial Spirit", "Requip"], answer: "Fire Dragon Slayer" }
    ],
    'Medium': [
        { question: "What is the name of the sea where most of One Piece takes place?", options: ["Grand Line", "East Blue", "West Blue", "Red Line"], answer: "Grand Line" },
        { question: "In Attack on Titan, what is Eren's Titan form called?", options: ["Attack Titan", "Colossal Titan", "Female Titan", "Beast Titan"], answer: "Attack Titan" },
        { question: "Who is known as 'Humanity's Strongest Soldier' in Attack on Titan?", options: ["Levi Ackerman", "Erwin Smith", "Mikasa Ackerman", "Eren Yeager"], answer: "Levi Ackerman" },
        { question: "In Demon Slayer, what is Tanjiro's family name?", options: ["Kamado", "Hashibira", "Agatsuma", "Shinazugawa"], answer: "Kamado" },
        { question: "What is the name of the ninja academy in Naruto?", options: ["Ninja Academy", "Shinobi School", "Konoha Academy", "Leaf Academy"], answer: "Ninja Academy" },
        { question: "In Fullmetal Alchemist, what do the Elric brothers seek?", options: ["Philosopher's Stone", "Dragon Balls", "Death Note", "Holy Grail"], answer: "Philosopher's Stone" },
        { question: "What studio animated Spirited Away?", options: ["Studio Ghibli", "Madhouse", "Toei Animation", "Pierrot"], answer: "Studio Ghibli" },
        { question: "In One Punch Man, what is Saitama's hero rank initially?", options: ["Class C", "Class B", "Class A", "Class S"], answer: "Class C" },
        { question: "What is the name of the Death God in Death Note?", options: ["Shinigami", "Yokai", "Oni", "Kami"], answer: "Shinigami" },
        { question: "In Jujutsu Kaisen, what grade is Yuji Itadori initially classified as?", options: ["Grade 4", "Grade 3", "Grade 2", "Grade 1"], answer: "Grade 4" },
        { question: "In One Piece, what is the name of the World Government's secret police?", options: ["CP9", "Marines", "Shichibukai", "Revolutionaries"], answer: "CP9" },
        { question: "What is the name of the virtual reality game in Sword Art Online?", options: ["Sword Art Online", "Alfheim Online", "Gun Gale Online", "Underworld"], answer: "Sword Art Online" },
        { question: "In Tokyo Ghoul, what are the creatures that eat humans called?", options: ["Ghouls", "Titans", "Demons", "Hollows"], answer: "Ghouls" },
        { question: "What is the name of the magic system in Black Clover?", options: ["Magic", "Nen", "Chakra", "Reiatsu"], answer: "Magic" },
        { question: "In Mob Psycho 100, what percentage does Mob reach for an explosion?", options: ["100%", "200%", "150%", "300%"], answer: "100%" }
    ],
    'Hard': [
        { question: "In One Piece, where do the Straw Hats first meet Brook?", options: ["Thriller Bark", "Sabaody Archipelago", "Water 7", "Enies Lobby"], answer: "Thriller Bark" },
        { question: "What is Roy Mustang's title in Fullmetal Alchemist?", options: ["Flame Alchemist", "Steel Alchemist", "State Alchemist", "Fire Colonel"], answer: "Flame Alchemist" },
        { question: "In Hunter x Hunter, what is Gon's father's name?", options: ["Ging Freecss", "Silva Zoldyck", "Isaac Netero", "Leorio Paradinight"], answer: "Ging Freecss" },
        { question: "What is the name of the school in Kill la Kill?", options: ["Honnouji Academy", "Kiryuin Academy", "Satsuki Academy", "Ryuko Academy"], answer: "Honnouji Academy" },
        { question: "In Jojo's Bizarre Adventure, what is Dio's stand called?", options: ["The World", "Star Platinum", "Crazy Diamond", "Gold Experience"], answer: "The World" },
        { question: "What year did the original Dragon Ball anime first air?", options: ["1986", "1984", "1988", "1985"], answer: "1986" },
        { question: "In Code Geass, what is Lelouch's Geass power?", options: ["Absolute Obedience", "Mind Reading", "Time Stop", "Precognition"], answer: "Absolute Obedience" },
        { question: "What is the name of Light's Shinigami in Death Note?", options: ["Ryuk", "Rem", "Misa", "Near"], answer: "Ryuk" },
        { question: "In Evangelion, what is the name of Shinji's father?", options: ["Gendo Ikari", "Ryoji Kaji", "Kozo Fuyutsuki", "Shigeru Aoba"], answer: "Gendo Ikari" },
        { question: "What is the real name of the character known as 'L' in Death Note?", options: ["L Lawliet", "Near", "Mello", "Watari"], answer: "L Lawliet" },
        { question: "In One Piece, what is the name of the ancient weapons?", options: ["Pluton, Poseidon, Uranus", "Zeus, Hera, Poseidon", "Ares, Athena, Apollo", "Thor, Odin, Loki"], answer: "Pluton, Poseidon, Uranus" },
        { question: "What is the name of the organization that Lelouch leads in Code Geass?", options: ["Black Knights", "White Fang", "Blue Cosmos", "Red Frame"], answer: "Black Knights" },
        { question: "In Steins;Gate, what is the name of the time machine?", options: ["Phone Microwave", "Time Machine", "D-Mail", "SERN"], answer: "Phone Microwave" },
        { question: "What is the name of the virtual world in .hack//SIGN?", options: ["The World", "ALfheim", "Underworld", "Gun Gale"], answer: "The World" },
        { question: "In Cowboy Bebop, what is the name of Spike's ship?", options: ["Swordfish II", "Hammerhead", "Redtail", "Bebop"], answer: "Swordfish II" }
    ]
};

// ✅ NEW: Question cache and session management
const questionCache = new Map(); // userId -> {questions: [], currentIndex: 0, usedQuestions: Set()}
const activeQuizzes = new Set(); // Track active quiz users
const userQuestionHistory = new Map(); // userId -> Set of question texts (last 50 questions)

// Check if testing mode is enabled
function isTestingMode() {
    return process.env.DAILY_QUIZ_TESTING_MODE === 'true';
}

// Timezone helpers
function getCurrentDayKey() {
    if (isTestingMode()) {
        return `test-mode-${new Date().toISOString().split('T')[0]}`;
    }
    
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
    
    const currentTimeInMinutes = (estTime.getHours() * 60) + estTime.getMinutes();
    const resetTimeInMinutes = (3 * 60) + 0;
    
    if (currentTimeInMinutes >= resetTimeInMinutes) {
        nextReset.setDate(nextReset.getDate() + 1);
    }
    
    const utcReset = new Date(nextReset.getTime() - (estOffset * 60 * 60 * 1000));
    return Math.floor(utcReset.getTime() / 1000);
}

// ✅ NEW: Enhanced question fetching with better deduplication
async function fetchQuestion(difficulty, avoidQuestions = new Set()) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // Reduced timeout
    
    try {
        const animeAPIs = [
            'https://opentdb.com/api.php?amount=5&category=31&type=multiple', // Get 5 questions at once
            'https://the-trivia-api.com/v2/questions?categories=anime_and_manga&limit=5'
        ];
        
        for (const apiUrl of animeAPIs) {
            try {
                console.log(`[API] Trying ${getAPIName(apiUrl)} API for ${difficulty}...`);
                
                const response = await fetch(apiUrl, {
                    method: 'GET',
                    headers: { 
                        'User-Agent': 'DiscordBot-AnimeQuiz/2.0', 
                        'Accept': 'application/json'
                    },
                    signal: controller.signal
                });
                
                if (response.ok) {
                    const data = await response.json();
                    let questions = [];
                    
                    if (data.results && data.results.length > 0) {
                        questions = data.results.map(result => ({
                            question: result.question,
                            answer: result.correct_answer,
                            options: [...result.incorrect_answers, result.correct_answer].sort(() => Math.random() - 0.5),
                            difficulty: difficulty,
                            source: 'api'
                        }));
                    } else if (data.length > 0) {
                        questions = data.map(item => ({
                            question: item.question?.text || item.question,
                            answer: item.correctAnswer,
                            options: [...(item.incorrectAnswers || []), item.correctAnswer].sort(() => Math.random() - 0.5),
                            difficulty: difficulty,
                            source: 'api'
                        }));
                    }
                    
                    // Filter out bad questions and duplicates
                    const validQuestions = questions.filter(q => {
                        if (!q.question || !q.answer || !q.options || q.options.length < 2) return false;
                        
                        const badKeywords = ['voice actor', 'voiced by', 'seiyuu', 'dub', 'english dub', 'studio', 'director', 'composer'];
                        if (badKeywords.some(keyword => q.question.toLowerCase().includes(keyword))) return false;
                        
                        // Check against avoid list
                        if (avoidQuestions.has(q.question.toLowerCase().trim())) return false;
                        
                        return true;
                    }).map(q => ({
                        ...q,
                        question: cleanText(q.question),
                        answer: cleanText(q.answer),
                        options: q.options.map(opt => cleanText(opt)).filter(opt => opt.length > 0)
                    }));
                    
                    if (validQuestions.length > 0) {
                        // Return first valid question that's not in avoid list
                        const selectedQuestion = validQuestions[0];
                        console.log(`[API] ✅ Fetched ${difficulty} anime question from ${getAPIName(apiUrl)}`);
                        clearTimeout(timeoutId);
                        return selectedQuestion;
                    }
                }
            } catch (error) {
                console.log(`[API] API ${getAPIName(apiUrl)} failed: ${error.message}`);
                continue;
            }
        }
    } catch (error) {
        console.log(`[API] ❌ All APIs failed: ${error.message}`);
    } finally {
        clearTimeout(timeoutId);
    }
    
    // Fallback to local questions with deduplication
    console.log(`[API] 🛡️ Using enhanced anime fallback ${difficulty} question`);
    const fallbacks = ANIME_ONLY_FALLBACK[difficulty] || ANIME_ONLY_FALLBACK['Medium'];
    
    // Find questions not in avoid list
    const availableFallbacks = fallbacks.filter(q => !avoidQuestions.has(q.question.toLowerCase().trim()));
    
    if (availableFallbacks.length === 0) {
        // If all questions have been used, reset and use any
        console.log(`[API] All ${difficulty} fallback questions used, resetting...`);
        return { ...fallbacks[Math.floor(Math.random() * fallbacks.length)], source: 'fallback-reset' };
    }
    
    const selectedQuestion = availableFallbacks[Math.floor(Math.random() * availableFallbacks.length)];
    return { ...selectedQuestion, source: 'fallback' };
}

function cleanText(text) {
    if (!text) return '';
    return text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#x([0-9A-Fa-f]+);/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(parseInt(d, 10))).trim();
}

function getAPIName(url) {
    if (url.includes('opentdb')) return 'OpenTDB';
    if (url.includes('trivia-api')) return 'The Trivia API';
    return 'Custom';
}

// ✅ NEW: Preload 10 questions with deduplication
async function preloadQuestions(userId) {
    console.log(`[PRELOAD] Starting question preload for user ${userId}`);
    
    try {
        const difficulties = ['Easy', 'Easy', 'Medium', 'Medium', 'Medium', 'Medium', 'Hard', 'Hard', 'Hard', 'Hard'];
        const questions = [];
        const usedQuestions = new Set();
        
        // Get user's question history for better deduplication
        const userHistory = userQuestionHistory.get(userId) || new Set();
        
        for (let i = 0; i < 10; i++) {
            const difficulty = difficulties[i];
            
            // Combine used questions in this session + user history
            const avoidQuestions = new Set([...usedQuestions, ...userHistory]);
            
            const question = await fetchQuestion(difficulty, avoidQuestions);
            if (question) {
                questions.push(question);
                usedQuestions.add(question.question.toLowerCase().trim());
                console.log(`[PRELOAD] Question ${i + 1}/10 loaded: ${difficulty} - "${question.question.substring(0, 50)}..."`);
            } else {
                console.error(`[PRELOAD] Failed to load question ${i + 1}`);
                // Add a fallback question
                const fallbacks = ANIME_ONLY_FALLBACK[difficulty] || ANIME_ONLY_FALLBACK['Medium'];
                const fallbackQuestion = fallbacks[Math.floor(Math.random() * fallbacks.length)];
                questions.push({ ...fallbackQuestion, source: 'emergency-fallback' });
            }
            
            // Small delay to prevent API rate limiting
            if (i < 9) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        // Cache the preloaded questions
        questionCache.set(userId, {
            questions: questions,
            currentIndex: 0,
            usedQuestions: usedQuestions,
            createdAt: Date.now()
        });
        
        console.log(`[PRELOAD] ✅ Successfully preloaded ${questions.length} questions for user ${userId}`);
        return questions.length === 10;
        
    } catch (error) {
        console.error(`[PRELOAD] ❌ Error preloading questions for user ${userId}:`, error);
        return false;
    }
}

// ✅ NEW: Get next question from cache
function getNextCachedQuestion(userId) {
    const cache = questionCache.get(userId);
    if (!cache || cache.currentIndex >= cache.questions.length) {
        return null;
    }
    
    const question = cache.questions[cache.currentIndex];
    cache.currentIndex++;
    
    return question;
}

// ✅ NEW: Clear question cache
function clearQuestionCache(userId) {
    console.log(`[CACHE] Clearing question cache for user ${userId}`);
    questionCache.delete(userId);
    activeQuizzes.delete(userId);
}

// ✅ NEW: Update user question history
function updateUserQuestionHistory(userId, questionText) {
    if (!userQuestionHistory.has(userId)) {
        userQuestionHistory.set(userId, new Set());
    }
    
    const history = userQuestionHistory.get(userId);
    history.add(questionText.toLowerCase().trim());
    
    // Keep only last 50 questions to prevent memory issues
    if (history.size > 50) {
        const historyArray = Array.from(history);
        history.clear();
        historyArray.slice(-30).forEach(q => history.add(q)); // Keep last 30
    }
}

function getDay() { return getCurrentDayKey(); }
function getReset() { return getNextResetUnixTimestamp(); }

module.exports = {
    data: new SlashCommandBuilder().setName('daily-quiz').setDescription('🎌 Ultimate anime challenge! 10 questions, Divine mastery awaits!'),

    async execute(interaction) {
        try {
            const testingMode = isTestingMode();
            const userId = interaction.user.id;
            
            // Check if user already has an active quiz
            if (activeQuizzes.has(userId)) {
                return await interaction.reply({
                    content: '❌ **Quiz Already Active**\n\nYou already have an active daily quiz session. Please complete it first.',
                    ephemeral: true
                });
            }
            
            const allowedChannelId = process.env.DAILY_QUIZ_CHANNEL;
            
            if (allowedChannelId && interaction.channel.id !== allowedChannelId) {
                const allowedChannel = interaction.guild.channels.cache.get(allowedChannelId);
                const channelMention = allowedChannel ? `<#${allowedChannelId}>` : `channel ID: ${allowedChannelId}`;
                
                return await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#FF6B6B')
                        .setTitle(`🚫 Wrong Channel${testingMode ? ' [Testing Mode]' : ''}`)
                        .setDescription(`The daily quiz can only be used in ${channelMention}.${testingMode ? '\n\n🧪 **Testing Mode Active** - but channel restriction still applies!' : ''}\n\nPlease go to the correct channel to take the challenge!`)
                        .setFooter({ text: testingMode ? '🧪 Testing Mode • Channel Restriction Active' : 'Daily Quiz • Channel Restriction' })
                        .setTimestamp()
                    ],
                    ephemeral: true
                });
            }

            const guildId = interaction.guild.id;
            const member = interaction.member;
            
            if (!global.xpTracker?.db && !testingMode) {
                return await interaction.reply({ 
                    content: '❌ System unavailable - XP tracker not initialized', 
                    ephemeral: true 
                });
            }

            if (!testingMode) {
                const existingRecord = await this.checkRoll(userId, guildId);
                
                if (existingRecord && existingRecord.tier >= 0) {
                    const buff = await this.getBuff(userId, guildId, member);
                    const embed = new EmbedBuilder()
                        .setColor('#FF6B6B')
                        .setAuthor({ name: '🎌 ULTIMATE ANIME MASTERY CHALLENGE' })
                        .setTitle('Daily Challenge Already Completed')
                        .setDescription(`You've already completed today's challenge!\n\n**Current Enhancement:** ${buff.name}\n**Next Challenge:** <t:${getReset()}:R>`)
                        .addFields({
                            name: '📊 Today\'s Results',
                            value: `**Score:** ${existingRecord.tier}/10\n**Tier Earned:** ${this.getTierEmoji(existingRecord.tier)} ${TIER_NAMES[existingRecord.tier] || 'No Enhancement'}\n**Status:** Challenge complete for today`,
                            inline: false
                        })
                        .setFooter({ text: 'Enhancement Intelligence • Ultimate System' })
                        .setTimestamp();
                    return await interaction.reply({ embeds: [embed], ephemeral: true });
                }
            } else {
                console.log(`[DAILY QUIZ] Testing mode - allowing unlimited attempts for ${interaction.user.username}`);
            }
            
            await interaction.deferReply();
            
            // ✅ NEW: Mark user as having active quiz and preload questions
            activeQuizzes.add(userId);
            
            const preloadingEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('🎌 PREPARING ULTIMATE ANIME CHALLENGE')
                .setDescription('🔄 **Loading your personalized quiz questions...**\n\n*Please wait while we fetch 10 unique anime questions for you.*')
                .setFooter({ text: testingMode ? '🧪 Testing Mode • Preloading Questions' : 'Daily Quiz • Preloading Questions' })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [preloadingEmbed] });
            
            // Preload questions
            const preloadSuccess = await preloadQuestions(userId);
            
            if (!preloadSuccess) {
                activeQuizzes.delete(userId);
                clearQuestionCache(userId);
                return await interaction.editReply({
                    content: '❌ **Failed to Load Questions**\n\nUnable to prepare your quiz questions. Please try again.',
                });
            }
            
            // Start the quiz
            await this.ask(interaction, userId, guildId, member, 1, 0, 0);
            
        } catch (error) {
            console.error('[DAILY QUIZ] Execute error:', error);
            
            // Clean up on error
            const userId = interaction.user?.id;
            if (userId) {
                activeQuizzes.delete(userId);
                clearQuestionCache(userId);
            }
            
            const content = '❌ Error occurred. Please try again.';
            try {
                if (interaction.deferred) {
                    await interaction.editReply({ content });
                } else {
                    await interaction.reply({ content, ephemeral: true });
                }
            } catch (replyError) {
                console.error('[DAILY QUIZ] Reply error:', replyError);
            }
        }
    },

    // ✅ FIXED: Main question asking method with cached questions
    async ask(interaction, userId, guildId, member, qNum, tier, rerollsUsed = 0, questionResults = []) {
        let timer = null;
        let revealTimeout = null;
        let activeCollector = null;

        try {
            const testingMode = isTestingMode();
            
            console.log(`[DAILY QUIZ] Starting Question ${qNum}/10 - User: ${member.displayName}${testingMode ? ' [TESTING MODE]' : ''}`);
            
            // ✅ NEW: Get question from cache instead of fetching
            const q = getNextCachedQuestion(userId);
            
            if (!q) {
                console.error(`[DAILY QUIZ] No cached question available for Q${qNum}`);
                await interaction.followUp({
                    content: '❌ **Question Loading Error**\n\nFailed to load question. Please restart the quiz.',
                    ephemeral: true
                });
                return;
            }
            
            // Update user question history
            updateUserQuestionHistory(userId, q.question);
            
            console.log(`[DAILY QUIZ] Question ${qNum} from cache: "${q.question}" | Correct: "${q.answer}" | Source: ${q.source}`);
            let time = 20;

            // Create embed function
            const makeEmbed = (timeRemaining) => {
                const diffEmoji = { 'Easy': '🟢', 'Medium': '🟡', 'Hard': '🔴' };
                const difficulty = q.difficulty || 'Medium';
                
                // Create countdown bar
                const totalTime = 20;
                const totalSquares = 10;
                const timePerSquare = totalTime / totalSquares;
                const remainingSquares = Math.ceil(timeRemaining / timePerSquare);
                const filledSquares = Math.max(0, Math.min(totalSquares, remainingSquares));
                
                // RGB Color progression
                const percentageRemaining = (timeRemaining / totalTime) * 100;
                let squareEmoji, embedColor;
                
                if (percentageRemaining > 66) {
                    const intensity = (percentageRemaining - 66) / 34;
                    squareEmoji = '🟩';
                    embedColor = [
                        Math.floor(46 + (30 * (1 - intensity))),
                        204,
                        Math.floor(113 - (50 * (1 - intensity)))
                    ];
                } else if (percentageRemaining > 33) {
                    const intensity = (percentageRemaining - 33) / 33;
                    squareEmoji = '🟨';
                    embedColor = [
                        Math.floor(200 + (55 * (1 - intensity))),
                        Math.floor(150 + (50 * intensity)),
                        Math.floor(7 + (50 * intensity))
                    ];
                } else {
                    const intensity = percentageRemaining / 33;
                    squareEmoji = '🟥';
                    embedColor = [
                        255,
                        Math.floor(87 * intensity),
                        Math.floor(34 * intensity)
                    ];
                }
                
                const filledBar = squareEmoji.repeat(filledSquares);
                const emptyBar = '⬛'.repeat(totalSquares - filledSquares);
                const countdownBar = filledBar + emptyBar;
                
                // 10-question progress bar with result tracking
                const createProgressBar = () => {
                    const steps = [];
                    for (let i = 1; i <= 10; i++) {
                        if (i <= questionResults.length) {
                            steps.push(questionResults[i - 1] ? '🟩' : '🟥');
                        } else if (i === qNum) {
                            steps.push('⬜');
                        } else {
                            steps.push('⬛');
                        }
                    }
                    return steps.join(' ');
                };
                
                const progressSteps = createProgressBar();
                const mins = Math.floor(timeRemaining / 60);
                const secs = timeRemaining % 60;
                const timeText = `${mins}:${secs.toString().padStart(2, '0')}`;

                // Tier system display based on successful answers
                const successfulAnswers = questionResults.filter(result => result === true).length;
                const currentTargetTier = Math.min(10, successfulAnswers + 1);
                const securedTier = successfulAnswers;

                const challengeTitle = testingMode ? 
                    '🧪 TESTING MODE - ULTIMATE ANIME MASTERY CHALLENGE' : 
                    '🎌 ULTIMATE ANIME MASTERY CHALLENGE';

                return new EmbedBuilder()
                    .setAuthor({ name: challengeTitle })
                    .setTitle(`${diffEmoji[difficulty]} Question ${qNum}/10 • ${difficulty}${testingMode ? ' [TEST]' : ''}`)
                    .setColor(embedColor)
                    .setDescription(`## **${q.question}**\n\n**Challenge by:** ${member.displayName}${testingMode ? ' 🧪' : ''}\n\n*Select your answer using the buttons below*${testingMode ? '\n\n⚠️ **TESTING MODE**: No roles or XP will be awarded' : ''}`)
                    .addFields(
                        {
                            name: '📊 Challenge Progress (10 Questions)',
                            value: progressSteps,
                            inline: false
                        },
                        {
                            name: '⏰ Time Remaining',
                            value: `**${timeText}** (${timeRemaining} seconds)\n${countdownBar}`,
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
            };

            // Create answer buttons
            const btns = q.options.map((opt, i) => new ButtonBuilder()
                .setCustomId(`q_${userId}_${qNum}_${i}_${opt === q.answer}_${rerollsUsed}`)
                .setLabel(opt.substring(0, 70))
                .setStyle(ButtonStyle.Success)
                .setEmoji(['1️⃣', '2️⃣', '3️⃣', '4️⃣'][i]));

            // Create action buttons
            const actionButtons = [];
            
            const successfulAnswers = questionResults.filter(result => result === true).length;
            if (!testingMode && qNum > 1 && successfulAnswers > 0) {
                actionButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`stop_${userId}_${qNum}`)
                        .setLabel(`🛡️ Secure ${TIER_NAMES[successfulAnswers]} Buff`)
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🛡️')
                );
            }
            
            actionButtons.push(
                new ButtonBuilder()
                    .setCustomId(`reroll_${userId}_${qNum}_${rerollsUsed}`)
                    .setLabel(rerollsUsed >= 3 ? '🎲 No Rerolls Left' : `🎲 Reroll (${3 - rerollsUsed} left)`)
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🎲')
                    .setDisabled(rerollsUsed >= 3)
            );

            // Button layout
            const rows = [
                new ActionRowBuilder().addComponents(btns.slice(0, 2)),
                new ActionRowBuilder().addComponents(btns.slice(2, 4))
            ];
            
            if (actionButtons.length > 0) {
                rows.push(new ActionRowBuilder().addComponents(actionButtons));
            }

            let msg; 
            let embed = makeEmbed(time);
            
            try {
                if (qNum === 1 && rerollsUsed === 0) { 
                    await interaction.editReply({ embeds: [embed], components: rows }); 
                    msg = await interaction.fetchReply(); 
                } else {
                    msg = await interaction.followUp({ embeds: [embed], components: rows });
                }
                
                console.log(`[DAILY QUIZ] Q${qNum} message loaded successfully for ${member.displayName}${testingMode ? ' [TESTING]' : ''}`);
                
            } catch (error) {
                console.error(`[DAILY QUIZ] Error loading Q${qNum} message:`, error);
                try {
                    msg = await interaction.followUp({ 
                        embeds: [embed], 
                        components: rows 
                    });
                } catch (retryError) {
                    console.error(`[DAILY QUIZ] Retry failed for Q${qNum}:`, retryError);
                    return;
                }
            }

            // Timer updates with better cleanup
            timer = setInterval(async () => {
                time -= 2;
                if (time <= 0) { 
                    clearInterval(timer);
                    timer = null;
                    return; 
                }
                try { 
                    if (msg && msg.edit && !msg.deleted) {
                        await msg.edit({ embeds: [makeEmbed(time)], components: rows }).catch(() => {
                            console.log(`[DAILY QUIZ] Timer update failed for Q${qNum}, stopping timer`);
                            clearInterval(timer);
                            timer = null;
                        }); 
                    } else {
                        console.log(`[DAILY QUIZ] Message no longer valid for Q${qNum}, stopping timer`);
                        clearInterval(timer);
                        timer = null;
                    }
                } catch (error) { 
                    console.error(`[DAILY QUIZ] Timer error for Q${qNum}:`, error);
                    clearInterval(timer);
                    timer = null;
                }
            }, 2000);

            // Collector with better error handling and cleanup
            const collector = msg.createMessageComponentCollector({ 
                time: 22000,
                filter: i => i.user.id === userId 
            });

            activeCollector = collector;

            collector.on('collect', async (btn) => {
                try {
                    // Clear all timeouts immediately
                    if (timer) {
                        clearInterval(timer);
                        timer = null;
                    }
                    if (revealTimeout) {
                        clearTimeout(revealTimeout);
                        revealTimeout = null;
                    }
                    
                    if (!btn.deferred && !btn.replied) {
                        await btn.deferUpdate();
                    }
                    
                    console.log(`[DAILY QUIZ] Q${qNum} button clicked by ${member.displayName}: ${btn.customId}${testingMode ? ' [TESTING]' : ''}`);
                    
                    // Handle reroll button
                    if (btn.customId.startsWith('reroll_')) {
                        const [, , currentQNum, currentRerollsUsed] = btn.customId.split('_');
                        const rerollsUsedNum = parseInt(currentRerollsUsed);
                        
                        if (rerollsUsedNum >= 3) {
                            return;
                        }
                        
                        collector.stop('reroll');
                        
                        // ✅ NEW: Don't delete message, just update it
                        console.log(`[DAILY QUIZ] Reroll requested for Q${qNum}, loading new question...`);
                        
                        // Get a new question for reroll (we'll fetch one since rerolls should give different questions)
                        const newQuestion = await fetchQuestion(q.difficulty || 'Medium', new Set([q.question.toLowerCase().trim()]));
                        
                        if (newQuestion) {
                            // Update the question cache with the new question
                            const cache = questionCache.get(userId);
                            if (cache && cache.currentIndex > 0) {
                                cache.questions[cache.currentIndex - 1] = newQuestion;
                            }
                        }
                        
                        await this.ask(interaction, userId, guildId, member, parseInt(currentQNum), tier, rerollsUsedNum + 1, questionResults);
                        return;
                    }
                    
                    if (btn.customId.startsWith('stop_')) {
                        if (testingMode) {
                            await btn.editReply({
                                content: '🧪 **Testing Mode**: Cannot secure tiers in testing mode!',
                                components: []
                            });
                            return;
                        }
                        
                        const successfulAnswers = questionResults.filter(result => result === true).length;
                        const securedTier = successfulAnswers;
                        
                        await this.apply(userId, guildId, member, securedTier);
                        
                        // ✅ NEW: Clear cache when quiz ends early
                        clearQuestionCache(userId);
                        
                        let xpMultiplier = 'Unknown';
                        try {
                            const roleId = process.env[`DAILY_QUIZ_TIER_${securedTier}_ROLE`];
                            if (roleId && global.xpBoostManager) {
                                const boostInfo = await global.xpBoostManager.getRoleBoost(guildId, roleId);
                                if (boostInfo && boostInfo.boost_multiplier) {
                                    xpMultiplier = `${boostInfo.boost_multiplier}x`;
                                }
                            }
                        } catch (error) {
                            console.error('[DAILY BUFF] Error getting XP multiplier:', error);
                            xpMultiplier = 'Active';
                        }
                        
                        const res = new EmbedBuilder()
                            .setTitle('Strategic Withdrawal - Tier Secured!')
                            .setColor(TIER_COLORS[securedTier])
                            .setDescription(`**${TIER_NAMES[securedTier]}** secured!\n*${TIER_DESC[securedTier]}*\n**XP Multiplier:** ${xpMultiplier}`)
                            .addFields({ 
                                name: '📊 Results', 
                                value: `Score: ${securedTier}/10\n**Buff Received:** ${this.getTierEmoji(securedTier)} ${TIER_NAMES[securedTier]} (${xpMultiplier})\n**Challenge by:** ${member.displayName}\nNext: <t:${getReset()}:R>`, 
                                inline: false 
                            })
                            .setFooter({ text: `${this.getTierEmoji(securedTier)} ${TIER_NAMES[securedTier]} ${xpMultiplier} Active` })
                            .setTimestamp();
                        await btn.editReply({ embeds: [res], components: [] });
                        collector.stop('secured'); 
                        return;
                    }

                    const [, , , , isCorrectStr, currentRerollsUsed] = btn.customId.split('_');
                    const isCorrect = isCorrectStr === 'true';
                    const passedRerollsUsed = parseInt(currentRerollsUsed);
                    
                    const selectedOption = q.options[parseInt(btn.customId.split('_')[3])];
                    console.log(`[DAILY QUIZ] Q${qNum} Answer attempt by ${member.displayName}: Selected "${selectedOption}" | Correct: ${isCorrect} | Expected: "${q.answer}"${testingMode ? ' [TESTING]' : ''}`);
                    
                    if (isCorrect) {
                        const newResults = [...questionResults, true];
                        
                        // Award XP in non-testing mode
                        if (!testingMode) {
                            const correctAnswerXP = parseInt(process.env.DAILY_QUIZ_CORRECT_ANSWER_XP) || 500;
                            if (global.xpTracker && correctAnswerXP > 0) {
                                try {
                                    await global.xpTracker.awardXP(userId, guildId, correctAnswerXP, 'daily-quiz-correct', member.user, true);
                                    console.log(`[DAILY QUIZ] Q${qNum} FLAT XP: Awarded ${correctAnswerXP} XP to ${member.displayName} (no multipliers applied)`);
                                } catch (error) {
                                    console.error(`[DAILY QUIZ] Error awarding flat XP for correct answer:`, error);
                                }
                            }
                        } else {
                            console.log(`[DAILY QUIZ] Q${qNum} TESTING MODE: No XP awarded to ${member.displayName}`);
                        }
                        
                        if (qNum === 10) {
                            const totalSuccessful = newResults.filter(r => r === true).length;
                            
                            // ✅ NEW: Clear cache when quiz completes
                            clearQuestionCache(userId);
                            
                            if (!testingMode) {
                                await this.apply(userId, guildId, member, totalSuccessful);
                            
                                let xpMultiplier = 'Unknown';
                                try {
                                    const roleId = process.env[`DAILY_QUIZ_TIER_${totalSuccessful}_ROLE`];
                                    if (roleId && global.xpBoostManager) {
                                        const boostInfo = await global.xpBoostManager.getRoleBoost(guildId, roleId);
                                        if (boostInfo && boostInfo.boost_multiplier) {
                                            xpMultiplier = `${boostInfo.boost_multiplier}x`;
                                        }
                                    }
                                } catch (error) {
                                    console.error('[DAILY BUFF] Error getting XP multiplier:', error);
                                    xpMultiplier = 'Active';
                                }
                                
                                const tierName = totalSuccessful === 10 ? 'DIVINE PERFECTION' : TIER_NAMES[totalSuccessful] || 'No Enhancement';
                                const res = new EmbedBuilder()
                                    .setTitle(totalSuccessful === 10 ? '🔴 DIVINE PERFECTION ACHIEVED!' : `🎯 Challenge Complete - ${tierName}`)
                                    .setColor(totalSuccessful > 0 ? TIER_COLORS[totalSuccessful] : '#FF0000')
                                    .setDescription(totalSuccessful > 0 ? 
                                        `**${tierName}** unlocked!\n*${TIER_DESC[totalSuccessful] || 'Challenge completed'}*\n\n**XP Multiplier:** ${xpMultiplier}` :
                                        '**No Enhancement** earned. Better luck tomorrow!')
                                    .addFields({ 
                                        name: '📊 Final Results', 
                                        value: `**Correct Answers:** ${totalSuccessful}/10\n**Buff Received:** ${this.getTierEmoji(totalSuccessful)} ${tierName}${totalSuccessful > 0 ? ` (${xpMultiplier})` : ''}\n**Challenge by:** ${member.displayName}\nNext: <t:${getReset()}:R>`, 
                                        inline: false 
                                    })
                                    .setFooter({ text: totalSuccessful > 0 ? `${this.getTierEmoji(totalSuccessful)} ${tierName} ${xpMultiplier} Active` : 'Challenge Complete' })
                                    .setTimestamp();
                                await btn.editReply({ embeds: [res], components: [] });
                            } else {
                                const tierName = totalSuccessful === 10 ? 'DIVINE PERFECTION' : TIER_NAMES[totalSuccessful] || 'No Enhancement';
                                const res = new EmbedBuilder()
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
                                await btn.editReply({ embeds: [res], components: [] });
                            }
                        } else {
                            const successfulAnswers = newResults.filter(r => r === true).length;
                            const cont = new EmbedBuilder()
                                .setTitle(`✅ Correct! ${successfulAnswers} Successful`)
                                .setColor([46, 204, 113])
                                .setDescription(`Great job! You now have **${successfulAnswers}** successful answers.${testingMode ? '\n\n🧪 **Testing Mode**: Continue for practice, no rewards given' : ''}`)
                                .addFields({ name: '🎯 Progress', value: `Next: Question ${qNum + 1}/10\nSuccessful: ${successfulAnswers}/10`, inline: false })
                                .setFooter({ text: testingMode ? '🧪 Testing Mode - Continue the challenge' : 'Continue the challenge or secure your current progress' })
                                .setTimestamp();
                            
                            const contBtnComponents = [
                                new ButtonBuilder()
                                    .setCustomId(`cont_${userId}_${qNum + 1}_${passedRerollsUsed}`)
                                    .setLabel(`Continue to Question ${qNum + 1}`)
                                    .setStyle(ButtonStyle.Success)
                            ];
                            
                            if (!testingMode) {
                                contBtnComponents.push(
                                    new ButtonBuilder()
                                        .setCustomId(`claim_${userId}_${successfulAnswers}`)
                                        .setLabel(`Secure ${TIER_NAMES[successfulAnswers] || 'Current'} Buff`)
                                        .setStyle(ButtonStyle.Secondary)
                                        .setEmoji('🛡️')
                                );
                            }
                            
                            const contBtn = new ActionRowBuilder().addComponents(contBtnComponents);
                            
                            await btn.editReply({ embeds: [cont], components: [contBtn] });
                            
                            // Shorter timeout and instant transitions
                            const contColl = btn.message.createMessageComponentCollector({ time: 15000, filter: i => i.user.id === userId });
                            contColl.on('collect', async (contBtn) => {
                                try {
                                    await contBtn.deferUpdate();
                                    if (contBtn.customId.startsWith('cont_')) {
                                        const [, , nextQNum, passedRerollsUsed] = contBtn.customId.split('_');
                                        contColl.stop();
                                        
                                        console.log(`[DAILY QUIZ] User clicked continue after correct answer, proceeding to Q${nextQNum} immediately`);
                                        
                                        await this.ask(interaction, userId, guildId, member, parseInt(nextQNum), tier, parseInt(passedRerollsUsed), newResults);
                                        
                                    } else {
                                        if (testingMode) {
                                            await contBtn.editReply({
                                                content: '🧪 **Testing Mode**: Cannot claim rewards in testing mode!',
                                                components: []
                                            });
                                            return;
                                        }
                                        
                                        const cTier = parseInt(contBtn.customId.split('_')[2]); 
                                        const actualSuccessful = newResults.filter(r => r === true).length;
                                        const finalTier = Math.min(cTier, actualSuccessful);
                                        
                                        await this.apply(userId, guildId, member, finalTier);
                                        
                                        // ✅ NEW: Clear cache when quiz ends early
                                        clearQuestionCache(userId);
                                        
                                        let xpMultiplier = 'Unknown';
                                        try {
                                            const roleId = process.env[`DAILY_QUIZ_TIER_${finalTier}_ROLE`];
                                            if (roleId && global.xpBoostManager) {
                                                const boostInfo = await global.xpBoostManager.getRoleBoost(guildId, roleId);
                                                if (boostInfo && boostInfo.boost_multiplier) {
                                                    xpMultiplier = `${boostInfo.boost_multiplier}x`;
                                                }
                                            }
                                        } catch (error) {
                                            console.error('[DAILY BUFF] Error getting XP multiplier:', error);
                                            xpMultiplier = 'Active';
                                        }
                                        
                                        const claim = new EmbedBuilder()
                                            .setTitle('Strategic Withdrawal - Tier Secured!')
                                            .setColor(TIER_COLORS[finalTier] || '#FF0000')
                                            .setDescription(`**${TIER_NAMES[finalTier] || 'Enhancement'}** secured!\n*${TIER_DESC[finalTier] || 'Challenge ended'}*\n**XP Multiplier:** ${xpMultiplier}`)
                                            .addFields({ 
                                                name: '📊 Results', 
                                                value: `Successful Answers: ${actualSuccessful}/10\n**Buff Received:** ${this.getTierEmoji(finalTier)} ${TIER_NAMES[finalTier] || 'Enhancement'} (${xpMultiplier})\n**Challenge by:** ${member.displayName}\nNext: <t:${getReset()}:R>`, 
                                                inline: false 
                                            })
                                            .setFooter({ text: `${this.getTierEmoji(finalTier)} ${TIER_NAMES[finalTier] || 'Enhancement'} ${xpMultiplier} Active` })
                                            .setTimestamp();
                                        await contBtn.editReply({ embeds: [claim], components: [] }); 
                                        contColl.stop();
                                    }
                                } catch (error) {
                                    console.error('[DAILY QUIZ] Continue button error:', error);
                                }
                            });
                        }
                    } else {
                        // Record failed answer and continue
                        const newResults = [...questionResults, false];
                        
                        console.log(`[DAILY QUIZ] Q${qNum} INCORRECT by ${member.displayName}: Selected "${selectedOption}" | Showing correct answer: "${q.answer}"${testingMode ? ' [TESTING]' : ''}`);
                        
                        // Show answer reveal briefly then continue immediately with 3-second delay
                        const answerRevealEmbed = new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle(`❌ Wrong Answer - Question ${qNum}/10${testingMode ? ' [Testing]' : ''}`)
                            .setDescription(`**Your Answer:** ${selectedOption}\n**Correct Answer:** 🎯 ${q.answer}${testingMode ? '\n\n🧪 **Testing Mode**: Continue for practice' : ''}`)
                            .addFields({
                                name: '⏳ Next Question Loading...',
                                value: qNum < 10 ? `Question ${qNum + 1}/10 starting in 3 seconds` : 'Calculating final results in 3 seconds...',
                                inline: false
                            })
                            .setFooter({ text: testingMode ? '🧪 Testing Mode • Processing...' : 'Processing answer...' })
                            .setTimestamp();

                        await btn.editReply({ embeds: [answerRevealEmbed], components: [] });
                        
                        // 3-second delay then instant next question
                        revealTimeout = setTimeout(async () => {
                            revealTimeout = null;
                            if (qNum < 10) {
                                await this.ask(interaction, userId, guildId, member, qNum + 1, tier, passedRerollsUsed, newResults);
                            } else {
                                // Last question - handle completion
                                const totalSuccessful = newResults.filter(r => r === true).length;
                                
                                // ✅ NEW: Clear cache when quiz completes
                                clearQuestionCache(userId);
                                
                                if (!testingMode) {
                                    if (totalSuccessful > 0) {
                                        await this.apply(userId, guildId, member, totalSuccessful);
                                    } else {
                                        await this.saveFail(userId, guildId);
                                    }
                                    
                                    let xpMultiplier = 'Unknown';
                                    if (totalSuccessful > 0) {
                                        try {
                                            const roleId = process.env[`DAILY_QUIZ_TIER_${totalSuccessful}_ROLE`];
                                            if (roleId && global.xpBoostManager) {
                                                const boostInfo = await global.xpBoostManager.getRoleBoost(guildId, roleId);
                                                if (boostInfo && boostInfo.boost_multiplier) {
                                                    xpMultiplier = `${boostInfo.boost_multiplier}x`;
                                                }
                                            }
                                        } catch (error) {
                                            console.error('[DAILY BUFF] Error getting XP multiplier:', error);
                                            xpMultiplier = 'Active';
                                        }
                                    }
                                    
                                    const tierName = totalSuccessful > 0 ? (TIER_NAMES[totalSuccessful] || 'Enhancement') : 'No Enhancement';
                                    const tierEmoji = this.getTierEmoji(totalSuccessful);
                                    
                                    const res = new EmbedBuilder()
                                        .setTitle(`🏁 Challenge Complete - ${tierName}`)
                                        .setColor(totalSuccessful > 0 ? (TIER_COLORS[totalSuccessful] || '#FF0000') : '#FF0000')
                                        .setDescription(totalSuccessful > 0 ? 
                                            `**${tierName}** earned!\n*${TIER_DESC[totalSuccessful] || 'Challenge completed'}*\n**XP Multiplier:** ${xpMultiplier}` :
                                            '**No Enhancement** earned. Try again tomorrow!')
                                        .addFields({ 
                                            name: '📊 Final Results', 
                                            value: `**Correct Answers:** ${totalSuccessful}/10\n**Buff Received:** ${tierEmoji} ${tierName}${totalSuccessful > 0 ? ` (${xpMultiplier})` : ''}\n**Challenge by:** ${member.displayName}\n**Next Challenge:** <t:${getReset()}:R>`, 
                                            inline: false 
                                        })
                                        .setFooter({ text: totalSuccessful > 0 ? `${tierEmoji} ${tierName} ${xpMultiplier} Active Until Reset` : 'Challenge Complete - No Buff Awarded' })
                                        .setTimestamp();
                                        
                                    try {
                                        await btn.editReply({ embeds: [res], components: [] });
                                    } catch (error) {
                                        console.error('[DAILY QUIZ] Error editing reply after final answer:', error);
                                    }
                                } else {
                                    const tierName = totalSuccessful > 0 ? (TIER_NAMES[totalSuccessful] || 'Enhancement') : 'No Enhancement';
                                    const tierEmoji = this.getTierEmoji(totalSuccessful);
                                    
                                    const res = new EmbedBuilder()
                                        .setTitle('🧪 Testing Complete - Final Results')
                                        .setColor('#FFA500')
                                        .setDescription(`**Testing Results:** ${totalSuccessful}/10 correct answers\n\n*In normal mode, this would have earned: **${tierName}***\n\n⚠️ **TESTING MODE**: No roles or XP multipliers awarded`)
                                        .addFields({ 
                                            name: '📊 Test Results', 
                                            value: `**Correct Answers:** ${totalSuccessful}/10\n**Would Have Earned:** ${tierEmoji} ${tierName}\n**Challenge by:** ${member.displayName} 🧪\n**Mode:** Testing (No Rewards)`, 
                                            inline: false 
                                        })
                                        .setFooter({ text: '🧪 Testing Mode Complete - No Actual Rewards Given' })
                                        .setTimestamp();
                                        
                                    try {
                                        await btn.editReply({ embeds: [res], components: [] });
                                    } catch (error) {
                                        console.error('[DAILY QUIZ] Error editing testing mode reply:', error);
                                    }
                                }
                            }
                        }, 3000); // 3-second delay instead of 5
                    }
                    collector.stop('answered');
                } catch (error) { 
                    console.error('[QUIZ] Button error:', error); 
                    if (timer) {
                        clearInterval(timer);
                        timer = null;
                    }
                    if (revealTimeout) {
                        clearTimeout(revealTimeout);
                        revealTimeout = null;
                    }
                }
            });

            // Proper timeout handling for both normal and testing mode
            collector.on('end', async (collected, reason) => {
                // Clean up all timeouts
                if (timer) {
                    clearInterval(timer);
                    timer = null;
                }
                if (revealTimeout) {
                    clearTimeout(revealTimeout);
                    revealTimeout = null;
                }
                
                if (reason === 'time' && collected.size === 0) {
                    console.log(`[DAILY QUIZ] Q${qNum} timed out for ${member.displayName} after 22 seconds${testingMode ? ' [TESTING]' : ''}`);
                    
                    const newResults = [...questionResults, false];
                    
                    if (qNum === 10) {
                        const totalSuccessful = newResults.filter(r => r === true).length;
                        
                        // ✅ NEW: Clear cache when quiz times out
                        clearQuestionCache(userId);
                        
                        if (!testingMode) {
                            if (totalSuccessful > 0) {
                                await this.apply(userId, guildId, member, totalSuccessful);
                            } else {
                                await this.saveFail(userId, guildId);
                            }
                            
                            const tierName = totalSuccessful > 0 ? (TIER_NAMES[totalSuccessful] || 'Enhancement') : 'No Enhancement';
                            const timeout = new EmbedBuilder()
                                .setColor(totalSuccessful > 0 ? (TIER_COLORS[totalSuccessful] || '#FF0000') : '#FF0000')
                                .setTitle('⏰ Time\'s Up! Challenge Complete')
                                .setDescription(totalSuccessful > 0 ? 
                                    `**${tierName}** earned based on your ${totalSuccessful} correct answers.` :
                                    'No enhancement earned.')
                                .addFields({ 
                                    name: '📊 Final Results', 
                                    value: `**Correct Answers:** ${totalSuccessful}/10\n**Questions Attempted:** ${qNum}/10\n**Tier Earned:** ${this.getTierEmoji(totalSuccessful)} ${tierName}`, 
                                    inline: false 
                                })
                                .addFields({ name: '💡 Next Attempt', value: `<t:${getReset()}:R>`, inline: false })
                                .setFooter({ text: 'Daily Quiz System • Timed Out' })
                                .setTimestamp();
                                
                            try {
                                await msg.edit({ embeds: [timeout], components: [] });
                            } catch (error) {
                                console.error(`[DAILY QUIZ] Error showing timeout message:`, error);
                            }
                        } else {
                            const tierName = totalSuccessful > 0 ? (TIER_NAMES[totalSuccessful] || 'Enhancement') : 'No Enhancement';
                            const timeout = new EmbedBuilder()
                                .setColor('#FFA500')
                                .setTitle('⏰ Testing Timeout - Results')
                                .setDescription(`**Testing Results:** ${totalSuccessful}/10 correct answers\n\n*In normal mode, this would have earned: **${tierName}***\n\n⚠️ **TESTING MODE**: No roles or XP multipliers awarded`)
                                .addFields({ 
                                    name: '📊 Test Results', 
                                    value: `**Correct Answers:** ${totalSuccessful}/10\n**Questions Attempted:** ${qNum}/10\n**Would Have Earned:** ${this.getTierEmoji(totalSuccessful)} ${tierName}`, 
                                    inline: false 
                                })
                                .setFooter({ text: '🧪 Testing Mode Timeout - No Actual Rewards Given' })
                                .setTimestamp();
                                
                            try {
                                await msg.edit({ embeds: [timeout], components: [] });
                            } catch (error) {
                                console.error(`[DAILY QUIZ] Error showing testing timeout message:`, error);
                            }
                        }
                    } else {
                        // Auto-continue after timeout for mid-quiz questions
                        const timeoutEmbed = new EmbedBuilder()
                            .setColor('#FF6B6B')
                            .setTitle(`⏰ Time's Up - Question ${qNum}/10`)
                            .setDescription(`No answer selected in time. Moving to question ${qNum + 1}/10...${testingMode ? '\n\n🧪 **Testing Mode**: Continue for practice' : ''}`)
                            .setFooter({ text: testingMode ? '🧪 Testing Mode - Auto-continuing...' : 'Auto-continuing to next question...' });
                        
                        try {
                            await msg.edit({ embeds: [timeoutEmbed], components: [] });
                        } catch (error) {
                            console.log('[DAILY QUIZ] Could not edit timeout message:', error.message);
                        }
                        
                        // Short delay then continue
                        setTimeout(async () => {
                            await this.ask(interaction, userId, guildId, member, qNum + 1, tier, rerollsUsed, newResults);
                        }, 2000); // 2 second delay for timeout continuation
                    }
                }
                
                activeCollector = null;
            });
        } catch (error) { 
            console.error('[QUIZ] Question error:', error);
            
            // Clean up on error
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
            if (revealTimeout) {
                clearTimeout(revealTimeout);
                revealTimeout = null;
            }
            if (activeCollector) {
                activeCollector.stop('error');
                activeCollector = null;
            }
            
            // ✅ NEW: Clear cache on error
            clearQuestionCache(userId);
        }
    },

    // Check roll but return the record details (proper database check)
    async checkRoll(userId, guildId) { 
        try {
            if (isTestingMode()) {
                console.log(`[DAILY QUIZ] Testing mode - skipping database check for user ${userId}`);
                return null; // Always allow testing
            }
            
            const currentDay = getCurrentDayKey();
            console.log(`[DAILY QUIZ] Checking database for user ${userId}, guild ${guildId}, day ${currentDay}`);
            
            const r = await global.xpTracker.db.query(
                'SELECT tier FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3', 
                [userId, guildId, currentDay]
            ); 
            
            console.log(`[DAILY QUIZ] Database query result:`, r.rows);
            
            if (r.rows.length > 0) {
                const result = { tier: r.rows[0].tier };
                console.log(`[DAILY QUIZ] Found existing record:`, result);
                return result;
            }
            
            console.log(`[DAILY QUIZ] No existing record found for user ${userId}`);
            return null;
        } catch (error) {
            console.error('[DAILY QUIZ] Error checking roll:', error);
            return null; 
        } 
    },

    // Helper methods
    getTierEmoji(tier) {
        const tierEmojis = { 
            0: '⬛',    // None
            1: '⚪',    // Common - White
            2: '🟢',    // Uncommon - Green
            3: '🔵',    // Rare - Blue
            4: '🟣',    // Epic - Purple
            5: '🟡',    // Legendary - Yellow
            6: '🟡',    // Legendary - Yellow
            7: '🟠',    // Mythic - Orange
            8: '🟠',    // Mythic - Orange
            9: '🔴',    // Divine - Red
            10: '🔴'    // Divine - Red
        };
        return tierEmojis[tier] || '⬛';
    },

    // Get current day
    getCurrentDay() {
        return getCurrentDayKey();
    },

    // Check EDT
    isEDT(date) {
        const year = date.getFullYear();
        const marchSecondSunday = new Date(year, 2, 8);
        marchSecondSunday.setDate(marchSecondSunday.getDate() + (7 - marchSecondSunday.getDay()));
        const novemberFirstSunday = new Date(year, 10, 1);
        novemberFirstSunday.setDate(novemberFirstSunday.getDate() + (7 - novemberFirstSunday.getDay()));
        return date >= marchSecondSunday && date < novemberFirstSunday;
    },

    // Check for ALL 10 tiers in getBuff function (testing mode aware)
    async getBuff(userId, guildId, member) {
        try {
            if (isTestingMode()) {
                return { tier: 0, name: 'Testing Mode (No Buffs)', multiplier: 'None' };
            }
            
            const r = await global.xpTracker.db.query('SELECT tier FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3', [userId, guildId, getDay()]);
            if (r.rows.length > 0) { 
                const t = r.rows[0].tier; 
                return { tier: t, name: t === 0 ? 'Challenge Failed' : TIER_NAMES[t], multiplier: t === 0 ? 'None' : 'Active' }; 
            }
            for (let i = 1; i <= 10; i++) { 
                const roleId = process.env[`DAILY_QUIZ_TIER_${i}_ROLE`]; 
                if (roleId && roleId !== `role_id_${i}` && member.roles.cache.has(roleId)) {
                    return { tier: i, name: TIER_NAMES[i], multiplier: 'Active' }; 
                }
            }
            return { tier: 0, name: 'No Enhancement', multiplier: 'None' };
        } catch { 
            return { tier: 0, name: 'Error', multiplier: 'None' }; 
        }
    },

    // Handle ALL 10 tiers in apply function (skip in testing mode)
    async apply(userId, guildId, member, tier) {
        try {
            if (isTestingMode()) {
                console.log(`[DAILY QUIZ] Testing mode - skipping role application for user ${member.displayName}, tier ${tier}`);
                return;
            }
            
            // Remove all tier roles including tier 10
            for (let i = 1; i <= 10; i++) { 
                const roleId = process.env[`DAILY_QUIZ_TIER_${i}_ROLE`]; 
                if (roleId && roleId !== `role_id_${i}` && member.roles.cache.has(roleId)) { 
                    const role = member.guild.roles.cache.get(roleId); 
                    if (role) await member.roles.remove(role); 
                } 
            }

            if (tier > 0) { 
                const roleId = process.env[`DAILY_QUIZ_TIER_${tier}_ROLE`]; 
                if (roleId && roleId !== `role_id_${tier}`) { 
                    const role = member.guild.roles.cache.get(roleId); 
                    if (role) { 
                        await member.roles.add(role); 
                        await this.setTierXPCap(userId, guildId, tier);
                        console.log(`[DAILY QUIZ] ✅ Awarded ${role.name} with tier-specific XP cap`); 
                    } 
                } 
            }
            await this.save(userId, guildId, tier);
        } catch (error) { 
            console.error('[DAILY QUIZ] Apply error:', error); 
        }
    },

    // Set tier XP cap with carryover support
    async setTierXPCap(userId, guildId, tier) {
        try {
            if (isTestingMode()) {
                console.log(`[DAILY QUIZ] Testing mode - skipping XP cap setting for tier ${tier}`);
                return;
            }
            
            const tierXPCap = parseInt(process.env[`DAILY_QUIZ_TIER_${tier}_XP_CAP`]);
            
            if (!tierXPCap || tierXPCap <= 0) {
                console.log(`[DAILY QUIZ] No XP cap configured for tier ${tier}`);
                return;
            }

            const currentDay = this.getCurrentDay();

            // Get existing XP from default system for carryover
            let existingXP = 0;
            if (global.xpTracker && global.xpTracker.dailyResetManager) {
                existingXP = global.xpTracker.dailyResetManager.getDailyVoiceXP(userId, guildId, currentDay);
            }

            // Create/update tier record with XP carryover
            await global.xpTracker.db.query(`
                INSERT INTO daily_buff_xp_caps (user_id, guild_id, date, tier, xp_cap, current_xp, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, guild_id, date)
                DO UPDATE SET
                    tier = $4,
                    xp_cap = $5,
                    current_xp = GREATEST(daily_buff_xp_caps.current_xp, $6),
                    updated_at = CURRENT_TIMESTAMP
            `, [userId, guildId, currentDay, tier, tierXPCap, existingXP]);

            if (existingXP > 0) {
                console.log(`[DAILY QUIZ] ✅ Set tier ${tier} XP cap with carryover: ${existingXP}/${tierXPCap} XP for ${guildId}:${userId}`);
            } else {
                console.log(`[DAILY QUIZ] ✅ Set tier ${tier} XP cap: ${tierXPCap.toLocaleString()} XP for ${guildId}:${userId}`);
            }

        } catch (error) {
            console.error('[DAILY QUIZ] Error setting tier XP cap:', error);
        }
    },

    // Save to database (skip in testing mode)
    async save(userId, guildId, tier) {
        try {
            if (isTestingMode()) {
                console.log(`[DAILY QUIZ] Testing mode - skipping database save for tier ${tier}`);
                return;
            }
            
            await global.xpTracker.db.query('CREATE TABLE IF NOT EXISTS daily_buff_rolls (user_id VARCHAR(20), guild_id VARCHAR(20), date DATE, tier INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, guild_id, date))');
            await global.xpTracker.db.query('INSERT INTO daily_buff_rolls (user_id, guild_id, date, tier) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, guild_id, date) DO UPDATE SET tier = $4', [userId, guildId, getDay(), tier]);
            console.log(`[DAILY QUIZ] ✅ Saved tier ${tier}`);
        } catch (error) { 
            console.error('[DAILY QUIZ] Save error:', error); 
        }
    },

    // Save failure (skip in testing mode)
    async saveFail(userId, guildId) {
        try {
            if (isTestingMode()) {
                console.log(`[DAILY QUIZ] Testing mode - skipping failure save`);
                return;
            }
            
            await global.xpTracker.db.query('INSERT INTO daily_buff_rolls (user_id, guild_id, date, tier, created_at) VALUES ($1, $2, $3, 0, CURRENT_TIMESTAMP) ON CONFLICT (user_id, guild_id, date) DO UPDATE SET tier = 0', [userId, guildId, getDay()]);
            console.log('[DAILY QUIZ] ❌ Saved failed attempt');
        } catch (error) { 
            console.error('[DAILY QUIZ] Save failed error:', error); 
        }
    }
};

// ✅ NEW: Cleanup function to clear old caches (call this periodically)
setInterval(() => {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    
    // Clean up old question caches
    for (const [userId, cache] of questionCache.entries()) {
        if (now - cache.createdAt > maxAge) {
            console.log(`[CACHE CLEANUP] Removing old question cache for user ${userId}`);
            questionCache.delete(userId);
            activeQuizzes.delete(userId);
        }
    }
    
    // Clean up old user histories (keep only active users)
    if (userQuestionHistory.size > 1000) {
        console.log('[CACHE CLEANUP] Trimming user question history');
        const historyArray = Array.from(userQuestionHistory.entries());
        userQuestionHistory.clear();
        // Keep last 500 users
        historyArray.slice(-500).forEach(([userId, history]) => {
            userQuestionHistory.set(userId, history);
        });
    }
}, 10 * 60 * 1000); // Run every 10 minutes

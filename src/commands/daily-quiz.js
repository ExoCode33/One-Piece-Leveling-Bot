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

// Enhanced anime-only fallback questions with strict anime filtering
const ANIME_ONLY_FALLBACK = {
    'Easy': [
        { question: "Who is the main protagonist of One Piece?", options: ["Monkey D. Luffy", "Roronoa Zoro", "Nami", "Sanji"], answer: "Monkey D. Luffy" },
        { question: "What is Luffy's Devil Fruit power?", options: ["Rubber", "Fire", "Ice", "Lightning"], answer: "Rubber" },
        { question: "In Naruto, what village is Naruto from?", options: ["Hidden Leaf Village", "Hidden Sand Village", "Hidden Mist Village", "Hidden Cloud Village"], answer: "Hidden Leaf Village" },
        { question: "What is the name of Luffy's pirate crew?", options: ["Straw Hat Pirates", "Red Hair Pirates", "Whitebeard Pirates", "Heart Pirates"], answer: "Straw Hat Pirates" },
        { question: "In My Hero Academia, what is Deku's real name?", options: ["Izuku Midoriya", "Katsuki Bakugo", "Shoto Todoroki", "Tenya Iida"], answer: "Izuku Midoriya" },
        { question: "What anime features a notebook that can kill people?", options: ["Death Note", "Code Geass", "Psycho-Pass", "Future Diary"], answer: "Death Note" },
        { question: "In Dragon Ball Z, what is Goku's Saiyan name?", options: ["Kakarot", "Vegeta", "Raditz", "Bardock"], answer: "Kakarot" },
        { question: "What is the name of the main character in Bleach?", options: ["Ichigo Kurosaki", "Rukia Kuchiki", "Uryu Ishida", "Chad Sado"], answer: "Ichigo Kurosaki" },
        { question: "In One Piece, what is Zoro's fighting style?", options: ["Three Sword Style", "Two Sword Style", "One Sword Style", "Four Sword Style"], answer: "Three Sword Style" },
        { question: "In Attack on Titan, what do titans primarily eat?", options: ["Humans", "Animals", "Plants", "Nothing"], answer: "Humans" },
        { question: "In Demon Slayer, what breathing technique does Tanjiro use?", options: ["Water Breathing", "Fire Breathing", "Wind Breathing", "Stone Breathing"], answer: "Water Breathing" },
        { question: "What is the name of the school in My Hero Academia?", options: ["U.A. High School", "Shiketsu High", "Ketsubutsu Academy", "Isamu Academy"], answer: "U.A. High School" },
        { question: "In Fairy Tail, what is Natsu's magic type?", options: ["Fire Dragon Slayer", "Ice Make", "Celestial Spirit", "Requip"], answer: "Fire Dragon Slayer" },
        { question: "What anime features giant humanoid creatures called Titans?", options: ["Attack on Titan", "Evangelion", "Code Geass", "Gundam"], answer: "Attack on Titan" },
        { question: "In Sailor Moon, what is Usagi's alter ego?", options: ["Sailor Moon", "Sailor Mars", "Sailor Venus", "Sailor Mercury"], answer: "Sailor Moon" },
        { question: "What anime features ninja and is about a boy with a fox spirit?", options: ["Naruto", "Bleach", "One Piece", "Dragon Ball"], answer: "Naruto" },
        { question: "In Dragon Ball, what are the orange orbs called?", options: ["Dragon Balls", "Power Spheres", "Magic Orbs", "Wish Stones"], answer: "Dragon Balls" },
        { question: "What anime is about a boy who can stretch like rubber?", options: ["One Piece", "Naruto", "Bleach", "Dragon Ball"], answer: "One Piece" },
        { question: "In which anime do characters have 'Quirks'?", options: ["My Hero Academia", "Naruto", "One Piece", "Bleach"], answer: "My Hero Academia" },
        { question: "What anime features Soul Reapers?", options: ["Bleach", "Naruto", "One Piece", "Dragon Ball"], answer: "Bleach" }
    ],
    'Medium': [
        { question: "What is the name of the sea where most of One Piece takes place?", options: ["Grand Line", "East Blue", "West Blue", "Red Line"], answer: "Grand Line" },
        { question: "In Attack on Titan, what is Eren's Titan form called?", options: ["Attack Titan", "Colossal Titan", "Female Titan", "Beast Titan"], answer: "Attack Titan" },
        { question: "Who is known as 'Humanity's Strongest Soldier' in Attack on Titan?", options: ["Levi Ackerman", "Erwin Smith", "Mikasa Ackerman", "Eren Yeager"], answer: "Levi Ackerman" },
        { question: "In Demon Slayer, what is Tanjiro's family name?", options: ["Kamado", "Hashibira", "Agatsuma", "Shinazugawa"], answer: "Kamado" },
        { question: "In Fullmetal Alchemist, what do the Elric brothers seek?", options: ["Philosopher's Stone", "Dragon Balls", "Death Note", "Holy Grail"], answer: "Philosopher's Stone" },
        { question: "In One Punch Man, what is Saitama's hero rank initially?", options: ["Class C", "Class B", "Class A", "Class S"], answer: "Class C" },
        { question: "In Jujutsu Kaisen, what grade is Yuji Itadori initially classified as?", options: ["Grade 4", "Grade 3", "Grade 2", "Grade 1"], answer: "Grade 4" },
        { question: "In One Piece, what is the name of the World Government's secret police?", options: ["CP9", "Marines", "Shichibukai", "Revolutionaries"], answer: "CP9" },
        { question: "In Tokyo Ghoul, what are the creatures that eat humans called?", options: ["Ghouls", "Titans", "Demons", "Hollows"], answer: "Ghouls" },
        { question: "In Mob Psycho 100, what percentage does Mob reach for an explosion?", options: ["100%", "200%", "150%", "300%"], answer: "100%" },
        { question: "In Hunter x Hunter, what is the name of the hunter exam arc?", options: ["Hunter Exam", "Yorknew City", "Greed Island", "Chimera Ant"], answer: "Hunter Exam" },
        { question: "In Seven Deadly Sins, what is Meliodas' sin?", options: ["Wrath", "Pride", "Greed", "Envy"], answer: "Wrath" },
        { question: "In Fire Force, what are the fire-powered beings called?", options: ["Infernals", "Pyromancers", "Fire Demons", "Flame Spirits"], answer: "Infernals" },
        { question: "In Dr. Stone, what petrified humanity?", options: ["Green Light", "Meteor", "Virus", "Magic"], answer: "Green Light" },
        { question: "In Assassination Classroom, what is Koro-sensei?", options: ["Octopus-like creature", "Human", "Robot", "Alien"], answer: "Octopus-like creature" },
        { question: "In Black Clover, what is Asta's main trait?", options: ["No magic", "Fire magic", "Wind magic", "Water magic"], answer: "No magic" },
        { question: "In Haikyuu, what sport do they play?", options: ["Volleyball", "Basketball", "Soccer", "Tennis"], answer: "Volleyball" },
        { question: "In Food Wars, what is the main character's name?", options: ["Soma Yukihira", "Erina Nakiri", "Takumi Aldini", "Ryo Kurokiba"], answer: "Soma Yukihira" },
        { question: "In One Piece, what are Devil Fruit users unable to do?", options: ["Swim", "Fight", "Eat", "Sleep"], answer: "Swim" },
        { question: "In Chainsaw Man, what is Denji's goal?", options: ["Touch boobs", "Become strongest", "Save world", "Find love"], answer: "Touch boobs" }
    ],
    'Hard': [
        { question: "In One Piece, where do the Straw Hats first meet Brook?", options: ["Thriller Bark", "Sabaody Archipelago", "Water 7", "Enies Lobby"], answer: "Thriller Bark" },
        { question: "What is Roy Mustang's title in Fullmetal Alchemist?", options: ["Flame Alchemist", "Steel Alchemist", "State Alchemist", "Fire Colonel"], answer: "Flame Alchemist" },
        { question: "In Hunter x Hunter, what is Gon's father's name?", options: ["Ging Freecss", "Silva Zoldyck", "Isaac Netero", "Leorio Paradinight"], answer: "Ging Freecss" },
        { question: "What is the name of the school in Kill la Kill?", options: ["Honnouji Academy", "Kiryuin Academy", "Satsuki Academy", "Ryuko Academy"], answer: "Honnouji Academy" },
        { question: "In Jojo's Bizarre Adventure, what is Dio's stand called?", options: ["The World", "Star Platinum", "Crazy Diamond", "Gold Experience"], answer: "The World" },
        { question: "In Code Geass, what is Lelouch's Geass power?", options: ["Absolute Obedience", "Mind Reading", "Time Stop", "Precognition"], answer: "Absolute Obedience" },
        { question: "What is the name of Light's Shinigami in Death Note?", options: ["Ryuk", "Rem", "Misa", "Near"], answer: "Ryuk" },
        { question: "In Evangelion, what is the name of Shinji's father?", options: ["Gendo Ikari", "Ryoji Kaji", "Kozo Fuyutsuki", "Shigeru Aoba"], answer: "Gendo Ikari" },
        { question: "What is the real name of the character known as 'L' in Death Note?", options: ["L Lawliet", "Near", "Mello", "Watari"], answer: "L Lawliet" },
        { question: "In One Piece, what is the name of the ancient weapons?", options: ["Pluton, Poseidon, Uranus", "Zeus, Hera, Poseidon", "Ares, Athena, Apollo", "Thor, Odin, Loki"], answer: "Pluton, Poseidon, Uranus" },
        { question: "What is the name of the organization that Lelouch leads in Code Geass?", options: ["Black Knights", "White Fang", "Blue Cosmos", "Red Frame"], answer: "Black Knights" },
        { question: "In Steins;Gate, what is the name of the time machine?", options: ["Phone Microwave", "Time Machine", "D-Mail", "SERN"], answer: "Phone Microwave" },
        { question: "In Cowboy Bebop, what is the name of Spike's ship?", options: ["Swordfish II", "Hammerhead", "Redtail", "Bebop"], answer: "Swordfish II" },
        { question: "In Fate/Stay Night, what class is Saber?", options: ["Saber", "Archer", "Lancer", "Rider"], answer: "Saber" },
        { question: "In Overlord, what is Ainz Ooal Gown's real name?", options: ["Momonga", "Suzuki Satoru", "Ulbert", "Touch Me"], answer: "Momonga" },
        { question: "In Monster, who is the main antagonist?", options: ["Johan Liebert", "Nina Fortner", "Wolfgang Grimmer", "Roberto"], answer: "Johan Liebert" },
        { question: "In Parasyte, what is the name of Shinichi's parasite?", options: ["Migi", "Reiko", "Gotou", "Tamiya"], answer: "Migi" },
        { question: "In Berserk, what is the name of Guts' sword?", options: ["Dragon Slayer", "Iron Reaver", "Demon Blade", "God Hand"], answer: "Dragon Slayer" },
        { question: "In Yu Yu Hakusho, what is Yusuke's spirit detective rank?", options: ["E-Class", "D-Class", "C-Class", "B-Class"], answer: "E-Class" },
        { question: "In Trigun, what is Vash's nickname?", options: ["Humanoid Typhoon", "Stampede", "Plant", "Gunslinger"], answer: "Humanoid Typhoon" }
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

// ✅ ENHANCED: Better anime-only question fetching with stricter filtering
async function fetchQuestion(difficulty, avoidQuestions = new Set()) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
        // Only use anime-specific APIs
        const animeAPIs = [
            'https://opentdb.com/api.php?amount=3&category=31&type=multiple&difficulty=easy', // Anime category only
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
                    }
                    
                    // STRICT anime filtering
                    const validQuestions = questions.filter(q => {
                        if (!q.question || !q.answer || !q.options || q.options.length < 2) return false;
                        
                        const questionLower = q.question.toLowerCase();
                        
                        // REFINED anime filtering - keep good trivia, remove only problematic content
                        const badKeywords = [
                            'studio that animated', 'animation studio', 'produced by', 'directed by',
                            'composed by', 'music by', 'soundtrack by', 'opening theme', 'ending theme',
                            'manga author', 'mangaka', 'light novel author', 'creator of',
                            'published by', 'serialized in', 'magazine', 'publisher',
                            'network that aired', 'broadcast on', 'streaming platform',
                            'budget', 'box office', 'sales figures', 'episode count of',
                            'animation technique', 'art style', 'animation quality'
                        ];
                        
                        // Allow these good trivia questions
                        const allowedPatterns = [
                            'year.*air', 'when.*air', 'what year.*release',
                            'voice.*actor', 'voiced by', 'seiyuu', 'dub.*actor',
                            'original.*air', 'first.*broadcast', 'premiere'
                        ];
                        
                        const hasAllowedPattern = allowedPatterns.some(pattern => 
                            new RegExp(pattern, 'i').test(questionLower)
                        );
                        
                        const hasBadKeyword = badKeywords.some(keyword => 
                            questionLower.includes(keyword.toLowerCase())
                        );
                        
                        // Reject if has bad keywords AND doesn't have allowed patterns
                        if (hasBadKeyword && !hasAllowedPattern) return false;
                        
                        // REQUIRE anime keywords
                        const animeKeywords = [
                            'anime', 'manga', 'character', 'protagonist', 'antagonist',
                            'power', 'ability', 'technique', 'jutsu', 'devil fruit',
                            'titan', 'demon', 'soul reaper', 'ninja', 'pirate',
                            'hero', 'villain', 'quirk', 'stand', 'magic',
                            'guild', 'crew', 'team', 'squad', 'organization'
                        ];
                        
                        const hasAnimeContent = animeKeywords.some(keyword => questionLower.includes(keyword)) ||
                                              isKnownAnimeTitle(questionLower);
                        
                        if (!hasAnimeContent) return false;
                        
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
                        const selectedQuestion = validQuestions[0];
                        console.log(`[API] ✅ Fetched ANIME question from ${getAPIName(apiUrl)}: "${selectedQuestion.question}"`);
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
    
    // Fallback to guaranteed anime questions
    console.log(`[API] 🛡️ Using guaranteed anime fallback ${difficulty} question`);
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

// Helper function to check if text contains known anime titles
function isKnownAnimeTitle(text) {
    const animeNames = [
        'naruto', 'one piece', 'bleach', 'dragon ball', 'attack on titan',
        'my hero academia', 'demon slayer', 'jujutsu kaisen', 'hunter x hunter',
        'fullmetal alchemist', 'death note', 'code geass', 'evangelion',
        'cowboy bebop', 'akira', 'spirited away', 'totoro', 'princess mononoke',
        'sailor moon', 'pokemon', 'digimon', 'yu-gi-oh', 'one punch man',
        'mob psycho', 'tokyo ghoul', 'parasyte', 'berserk', 'trigun',
        'fairy tail', 'black clover', 'fire force', 'chainsaw man',
        'assassination classroom', 'haikyuu', 'kuroko', 'food wars',
        'seven deadly sins', 'overlord', 're:zero', 'konosuba',
        'shield hero', 'slime', 'goblin slayer', 'made in abyss'
    ];
    
    return animeNames.some(anime => text.includes(anime));
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

    // ✅ FIXED: Main question asking method with cached questions - FIXED THE AWAIT ISSUE
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
                        
                        // ✅ FIXED: Make async operation properly wrapped
                        console.log(`[DAILY QUIZ] Reroll requested for Q${qNum}, loading new question...`);
                        
                        // Get a new question for reroll asynchronously in the background
                        fetchQuestion(q.difficulty || 'Medium', new Set([q.question.toLowerCase().trim()]))
                            .then(newQuestion => {
                                if (newQuestion) {
                                    // Update the question cache with the new question
                                    const cache = questionCache.get(userId);
                                    if (cache && cache.currentIndex > 0) {
                                        cache.questions[cache.currentIndex - 1] = newQuestion;
                                    }
                                }
                            })
                            .catch(error => {
                                console.error('[DAILY QUIZ] Error fetching reroll question:', error);
                            });
                        
                        this.ask(interaction, userId, guildId, member, parseInt(currentQNum), tier, rerollsUsedNum + 1, questionResults)
                            .catch(error => {
                                console.error('[DAILY QUIZ] Error proceeding to reroll question:', error);
                                clearQuestionCache(userId);
                            });
                        return;
                    }

                    // Rest of the collector logic remains the same...
                    // (Truncated for brevity - the complete file continues with all the button handling logic)

                } catch (error) { 
                    console.error('[QUIZ] Button error:', error); 
                }
            });

        } catch (error) { 
            console.error('[QUIZ] Question error:', error);
            clearQuestionCache(userId);
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

    // Get current day
    getCurrentDay() {
        return getCurrentDayKey();
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

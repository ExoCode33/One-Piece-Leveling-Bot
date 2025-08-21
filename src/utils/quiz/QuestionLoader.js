// src/utils/quiz/QuestionLoader.js - UPDATED with AniQuiz API and Dynamic Difficulty

const { ANIME_ONLY_FALLBACK } = require('./constants');

class QuestionLoader {
    constructor() {
        // Initialize any needed state
    }

    // Main method to fetch questions
    async fetchQuestion(difficulty, avoidQuestions = new Set()) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        try {
            // ✅ NEW: Use AniQuiz API with dynamic difficulty
            const aniQuizUrl = `https://aniquiz-api.vercel.app/api/quiz?difficulty=${difficulty.toLowerCase()}`;
            
            console.log(`[API] Trying AniQuiz API for ${difficulty}...`);
            
            try {
                const response = await fetch(aniQuizUrl, {
                    method: 'GET',
                    headers: { 
                        'User-Agent': 'DiscordBot-AnimeQuiz/2.0', 
                        'Accept': 'application/json'
                    },
                    signal: controller.signal
                });
                
                if (response.ok) {
                    const data = await response.json();
                    let question = null;
                    
                    // Parse AniQuiz API response format
                    if (data && data.question && data.options && data.answer) {
                        // Convert AniQuiz format to our internal format
                        question = {
                            question: data.question,
                            answer: data.answer,
                            options: Array.isArray(data.options) ? data.options : [data.answer],
                            difficulty: difficulty, // Use the requested difficulty
                            source: 'aniquiz-api'
                        };
                        
                        // Clean the question text
                        question.question = this.cleanText(question.question);
                        question.answer = this.cleanText(question.answer);
                        question.options = question.options.map(opt => this.cleanText(opt)).filter(opt => opt.length > 0);
                        
                        // Ensure we have at least 2 options and the answer is included
                        if (question.options.length >= 2 && question.options.includes(question.answer)) {
                            // Check against avoid list
                            const questionText = question.question.toLowerCase().trim();
                            if (!avoidQuestions.has(questionText)) {
                                console.log(`[API] ✅ Fetched question from AniQuiz API with difficulty: ${question.difficulty}`);
                                clearTimeout(timeoutId);
                                return question;
                            } else {
                                console.log(`[API] AniQuiz question already used, falling back to local`);
                            }
                        } else {
                            console.log(`[API] AniQuiz question format invalid (options: ${question.options.length}, answer included: ${question.options.includes(question.answer)})`);
                        }
                    } else {
                        console.log(`[API] AniQuiz response format unexpected:`, {
                            hasQuestion: !!data?.question,
                            hasOptions: !!data?.options,
                            hasAnswer: !!data?.answer
                        });
                    }
                } else {
                    console.log(`[API] AniQuiz API failed with status: ${response.status}`);
                }
            } catch (apiError) {
                console.log(`[API] AniQuiz API error: ${apiError.message}`);
            }
            
        } catch (error) {
            console.log(`[API] ❌ AniQuiz API failed: ${error.message}`);
        } finally {
            clearTimeout(timeoutId);
        }
        
        // Fallback to guaranteed anime questions
        console.log(`[API] 🛡️ Using guaranteed anime fallback ${difficulty} question`);
        return this.getFallbackQuestion(difficulty, avoidQuestions);
    }

    // ✅ FIXED: Get fallback question from local database with guaranteed difficulty
    getFallbackQuestion(difficulty, avoidQuestions) {
        const fallbacks = ANIME_ONLY_FALLBACK[difficulty] || ANIME_ONLY_FALLBACK['Medium'];
        
        // Find questions not in avoid list
        const availableFallbacks = fallbacks.filter(q => !avoidQuestions.has(q.question.toLowerCase().trim()));
        
        if (availableFallbacks.length === 0) {
            // If all questions have been used, reset and use any
            console.log(`[API] All ${difficulty} fallback questions used, resetting...`);
            const selectedQuestion = fallbacks[Math.floor(Math.random() * fallbacks.length)];
            return { 
                ...selectedQuestion, 
                difficulty: difficulty, // ✅ FIXED: ALWAYS set difficulty
                source: 'fallback-reset' 
            };
        }
        
        const selectedQuestion = availableFallbacks[Math.floor(Math.random() * availableFallbacks.length)];
        return { 
            ...selectedQuestion, 
            difficulty: difficulty, // ✅ FIXED: ALWAYS set difficulty
            source: 'fallback' 
        };
    }

    // Check if text contains known anime titles
    isKnownAnimeTitle(text) {
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

    // Clean HTML entities from text
    cleanText(text) {
        if (!text) return '';
        return text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#x([0-9A-Fa-f]+);/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
            .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(parseInt(d, 10))).trim();
    }

    // Get API name from URL
    getAPIName(url) {
        if (url.includes('aniquiz-api')) return 'AniQuiz API';
        return 'Custom';
    }
}

module.exports = QuestionLoader;

// src/utils/quiz/QuestionLoader.js - Question Loading and Fetching

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
            // Try anime-specific APIs first
            const animeAPIs = [
                'https://opentdb.com/api.php?amount=3&category=31&type=multiple&difficulty=easy',
            ];
            
            for (const apiUrl of animeAPIs) {
                try {
                    console.log(`[API] Trying ${this.getAPIName(apiUrl)} API for ${difficulty}...`);
                    
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
                        
                        // Filter for anime content
                        const validQuestions = questions.filter(q => {
                            if (!q.question || !q.answer || !q.options || q.options.length < 2) return false;
                            
                            const questionLower = q.question.toLowerCase();
                            
                            // Filter out production-related questions
                            const badKeywords = [
                                'studio that animated', 'animation studio', 'produced by', 'directed by',
                                'composed by', 'music by', 'soundtrack by', 'opening theme', 'ending theme',
                                'manga author', 'mangaka', 'light novel author', 'creator of',
                                'published by', 'serialized in', 'magazine', 'publisher',
                                'network that aired', 'broadcast on', 'streaming platform',
                                'budget', 'box office', 'sales figures', 'episode count of',
                                'animation technique', 'art style', 'animation quality'
                            ];
                            
                            // Allow voice actor questions
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
                            
                            if (hasBadKeyword && !hasAllowedPattern) return false;
                            
                            // Require anime keywords
                            const animeKeywords = [
                                'anime', 'manga', 'character', 'protagonist', 'antagonist',
                                'power', 'ability', 'technique', 'jutsu', 'devil fruit',
                                'titan', 'demon', 'soul reaper', 'ninja', 'pirate',
                                'hero', 'villain', 'quirk', 'stand', 'magic',
                                'guild', 'crew', 'team', 'squad', 'organization'
                            ];
                            
                            const hasAnimeContent = animeKeywords.some(keyword => questionLower.includes(keyword)) ||
                                                  this.isKnownAnimeTitle(questionLower);
                            
                            if (!hasAnimeContent) return false;
                            
                            // Check against avoid list
                            if (avoidQuestions.has(q.question.toLowerCase().trim())) return false;
                            
                            return true;
                        }).map(q => ({
                            ...q,
                            question: this.cleanText(q.question),
                            answer: this.cleanText(q.answer),
                            options: q.options.map(opt => this.cleanText(opt)).filter(opt => opt.length > 0)
                        }));
                        
                        if (validQuestions.length > 0) {
                            const selectedQuestion = validQuestions[0];
                            console.log(`[API] ✅ Fetched ANIME question from ${this.getAPIName(apiUrl)}`);
                            clearTimeout(timeoutId);
                            return selectedQuestion;
                        }
                    }
                } catch (error) {
                    console.log(`[API] API ${this.getAPIName(apiUrl)} failed: ${error.message}`);
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
        return this.getFallbackQuestion(difficulty, avoidQuestions);
    }

    // Get fallback question from local database
    getFallbackQuestion(difficulty, avoidQuestions) {
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
        if (url.includes('opentdb')) return 'OpenTDB';
        if (url.includes('trivia-api')) return 'The Trivia API';
        return 'Custom';
    }
}

module.exports = QuestionLoader;

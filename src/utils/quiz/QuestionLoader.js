// src/utils/quiz/QuestionLoader.js - ENHANCED Multi-API Support with Custom Difficulty

const { ANIME_ONLY_FALLBACK } = require('./constants');

class QuestionLoader {
    constructor() {
        // API rotation for better question variety
        this.apiQueue = ['aniquiz', 'ghibli', 'anilist'];
        this.currentApiIndex = 0;
        this.ghibliData = null; // Cache Ghibli films data
        this.lastGhibliFetch = 0;
        this.ghibliCacheTime = 30 * 60 * 1000; // 30 minutes
    }

    // Main method to fetch questions with API rotation
    async fetchQuestion(difficulty, avoidQuestions = new Set()) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        try {
            // Try APIs in rotation order
            for (let attempts = 0; attempts < this.apiQueue.length; attempts++) {
                const apiName = this.apiQueue[this.currentApiIndex];
                this.currentApiIndex = (this.currentApiIndex + 1) % this.apiQueue.length;
                
                console.log(`[API] Trying ${apiName.toUpperCase()} API for ${difficulty}...`);
                
                let question = null;
                
                switch (apiName) {
                    case 'aniquiz':
                        question = await this.fetchFromAniQuizAPI(difficulty, controller.signal);
                        break;
                    case 'ghibli':
                        question = await this.fetchFromGhibliAPI(difficulty, controller.signal);
                        break;
                    case 'anilist':
                        question = await this.fetchFromAniListAPI(difficulty, controller.signal);
                        break;
                }
                
                if (question && !avoidQuestions.has(question.question.toLowerCase().trim())) {
                    clearTimeout(timeoutId);
                    return question;
                }
                
                if (question) {
                    console.log(`[API] ${apiName.toUpperCase()} question already used, trying next API`);
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

    // ✅ AniQuiz API (Primary - supports difficulty)
    async fetchFromAniQuizAPI(difficulty, signal) {
        try {
            const response = await fetch(`https://aniquiz-api.vercel.app/api/quiz?difficulty=${difficulty.toLowerCase()}`, {
                method: 'GET',
                headers: { 
                    'User-Agent': 'DiscordBot-AnimeQuiz/2.0', 
                    'Accept': 'application/json'
                },
                signal: signal
            });
            
            if (response.ok) {
                const data = await response.json();
                
                if (data && data.question && data.options && data.answer) {
                    const question = {
                        question: this.cleanText(data.question),
                        answer: this.cleanText(data.answer),
                        options: Array.isArray(data.options) ? 
                            data.options.map(opt => this.cleanText(opt)).filter(opt => opt.length > 0) : 
                            [this.cleanText(data.answer)],
                        difficulty: difficulty,
                        source: 'aniquiz-api'
                    };
                    
                    if (question.options.length >= 2 && question.options.includes(question.answer)) {
                        console.log(`[API] ✅ AniQuiz API success: ${difficulty}`);
                        return question;
                    }
                }
            }
        } catch (error) {
            console.log(`[API] AniQuiz API error: ${error.message}`);
        }
        return null;
    }

    // ✅ Studio Ghibli API (Character & Plot focused)
    async fetchFromGhibliAPI(difficulty, signal) {
        try {
            // Cache Ghibli data for better performance
            if (!this.ghibliData || (Date.now() - this.lastGhibliFetch) > this.ghibliCacheTime) {
                console.log('[API] Fetching fresh Ghibli data...');
                const response = await fetch('https://ghibliapi.herokuapp.com/films', {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    signal: signal
                });
                
                if (response.ok) {
                    this.ghibliData = await response.json();
                    this.lastGhibliFetch = Date.now();
                    console.log(`[API] Cached ${this.ghibliData.length} Ghibli films`);
                } else {
                    return null;
                }
            }
            
            if (!this.ghibliData || this.ghibliData.length === 0) return null;
            
            return this.generateGhibliQuestion(difficulty);
            
        } catch (error) {
            console.log(`[API] Ghibli API error: ${error.message}`);
            return null;
        }
    }

    // ✅ Generate Ghibli questions with custom difficulty mapping
    generateGhibliQuestion(difficulty) {
        try {
            const films = this.ghibliData.filter(film => 
                film.title && film.description && film.director && film.people && film.people.length > 0
            );
            
            if (films.length === 0) return null;
            
            const film = films[Math.floor(Math.random() * films.length)];
            let question = null;
            
            // Difficulty-based question generation
            switch (difficulty.toLowerCase()) {
                case 'easy':
                    question = this.generateEasyGhibliQuestion(film, films);
                    break;
                case 'medium':
                    question = this.generateMediumGhibliQuestion(film, films);
                    break;
                case 'hard':
                    question = this.generateHardGhibliQuestion(film, films);
                    break;
                default:
                    question = this.generateMediumGhibliQuestion(film, films);
            }
            
            if (question) {
                question.difficulty = difficulty;
                question.source = 'ghibli-api';
                console.log(`[API] ✅ Generated Ghibli ${difficulty} question: ${question.question.substring(0, 50)}...`);
            }
            
            return question;
            
        } catch (error) {
            console.log(`[API] Error generating Ghibli question: ${error.message}`);
            return null;
        }
    }

    generateEasyGhibliQuestion(film, allFilms) {
        const questionTypes = [
            // Film title questions
            () => ({
                question: `What is the title of the Studio Ghibli film directed by ${film.director}?`,
                answer: film.title,
                options: this.generateFilmTitleOptions(film.title, allFilms)
            }),
            // Director questions
            () => ({
                question: `Who directed the Studio Ghibli film "${film.title}"?`,
                answer: film.director,
                options: this.generateDirectorOptions(film.director, allFilms)
            }),
            // Year questions
            () => ({
                question: `In what year was "${film.title}" released?`,
                answer: film.release_date,
                options: this.generateYearOptions(film.release_date, allFilms)
            })
        ];
        
        const randomType = questionTypes[Math.floor(Math.random() * questionTypes.length)];
        return randomType();
    }

    generateMediumGhibliQuestion(film, allFilms) {
        const questionTypes = [
            // Character/plot questions
            () => ({
                question: `In "${film.title}", what is the main story about?`,
                answer: this.extractPlotKeyword(film.description),
                options: this.generatePlotOptions(film.description, allFilms)
            }),
            // Producer questions
            () => ({
                question: `Who produced the Studio Ghibli film "${film.title}"?`,
                answer: film.producer,
                options: this.generateProducerOptions(film.producer, allFilms)
            })
        ];
        
        const randomType = questionTypes[Math.floor(Math.random() * questionTypes.length)];
        return randomType();
    }

    generateHardGhibliQuestion(film, allFilms) {
        // More specific plot details, character names, etc.
        return {
            question: `What is the running time of "${film.title}"?`,
            answer: `${film.running_time} minutes`,
            options: this.generateRuntimeOptions(film.running_time, allFilms)
        };
    }

    // ✅ AniList GraphQL API (Character focused)
    async fetchFromAniListAPI(difficulty, signal) {
        try {
            const query = this.buildAniListQuery(difficulty);
            
            const response = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ query }),
                signal: signal
            });
            
            if (response.ok) {
                const data = await response.json();
                return this.generateAniListQuestion(data, difficulty);
            }
            
        } catch (error) {
            console.log(`[API] AniList API error: ${error.message}`);
        }
        return null;
    }

    buildAniListQuery(difficulty) {
        // Adjust popularity threshold based on difficulty
        let popularityThreshold;
        switch (difficulty.toLowerCase()) {
            case 'easy':
                popularityThreshold = 80; // Very popular anime
                break;
            case 'medium':
                popularityThreshold = 50; // Moderately popular
                break;
            case 'hard':
                popularityThreshold = 20; // Less popular/obscure
                break;
            default:
                popularityThreshold = 50;
        }
        
        return `
        query {
            Page(page: 1, perPage: 10) {
                media(type: ANIME, popularity_greater: ${popularityThreshold}, sort: POPULARITY_DESC) {
                    title {
                        romaji
                        english
                    }
                    characters(role: MAIN, page: 1, perPage: 5) {
                        nodes {
                            name {
                                full
                                first
                                last
                            }
                        }
                    }
                    popularity
                    genres
                }
            }
        }`;
    }

    generateAniListQuestion(data, difficulty) {
        try {
            if (!data?.data?.Page?.media) return null;
            
            const anime = data.data.Page.media.find(media => 
                media.characters?.nodes?.length > 0 && 
                (media.title?.romaji || media.title?.english)
            );
            
            if (!anime) return null;
            
            const title = anime.title.english || anime.title.romaji;
            const characters = anime.characters.nodes;
            const mainCharacter = characters[0];
            
            if (!mainCharacter?.name?.full) return null;
            
            // Generate character questions
            const wrongAnswers = characters.slice(1, 4).map(char => char.name.full).filter(Boolean);
            if (wrongAnswers.length < 2) return null;
            
            const allOptions = [mainCharacter.name.full, ...wrongAnswers].slice(0, 4);
            
            const question = {
                question: `Who is the main character in "${title}"?`,
                answer: mainCharacter.name.full,
                options: this.shuffleArray(allOptions),
                difficulty: difficulty,
                source: 'anilist-api'
            };
            
            console.log(`[API] ✅ Generated AniList ${difficulty} question: ${title}`);
            return question;
            
        } catch (error) {
            console.log(`[API] Error generating AniList question: ${error.message}`);
            return null;
        }
    }

    // Helper methods for Ghibli question generation
    generateFilmTitleOptions(correctTitle, allFilms) {
        const options = [correctTitle];
        const otherTitles = allFilms.filter(f => f.title !== correctTitle).map(f => f.title);
        
        while (options.length < 4 && otherTitles.length > 0) {
            const randomTitle = otherTitles.splice(Math.floor(Math.random() * otherTitles.length), 1)[0];
            options.push(randomTitle);
        }
        
        return this.shuffleArray(options);
    }

    generateDirectorOptions(correctDirector, allFilms) {
        const directors = [...new Set(allFilms.map(f => f.director))];
        const options = [correctDirector];
        
        while (options.length < 4 && directors.length > 0) {
            const randomDirector = directors.splice(Math.floor(Math.random() * directors.length), 1)[0];
            if (randomDirector !== correctDirector) {
                options.push(randomDirector);
            }
        }
        
        return this.shuffleArray(options);
    }

    generateYearOptions(correctYear, allFilms) {
        const years = [...new Set(allFilms.map(f => f.release_date))];
        const options = [correctYear];
        
        while (options.length < 4 && years.length > 0) {
            const randomYear = years.splice(Math.floor(Math.random() * years.length), 1)[0];
            if (randomYear !== correctYear) {
                options.push(randomYear);
            }
        }
        
        return this.shuffleArray(options);
    }

    generateProducerOptions(correctProducer, allFilms) {
        const producers = [...new Set(allFilms.map(f => f.producer))];
        const options = [correctProducer];
        
        while (options.length < 4 && producers.length > 0) {
            const randomProducer = producers.splice(Math.floor(Math.random() * producers.length), 1)[0];
            if (randomProducer !== correctProducer) {
                options.push(randomProducer);
            }
        }
        
        return this.shuffleArray(options);
    }

    generateRuntimeOptions(correctRuntime, allFilms) {
        const runtimes = [...new Set(allFilms.map(f => `${f.running_time} minutes`))];
        const correctRuntimeStr = `${correctRuntime} minutes`;
        const options = [correctRuntimeStr];
        
        while (options.length < 4 && runtimes.length > 0) {
            const randomRuntime = runtimes.splice(Math.floor(Math.random() * runtimes.length), 1)[0];
            if (randomRuntime !== correctRuntimeStr) {
                options.push(randomRuntime);
            }
        }
        
        return this.shuffleArray(options);
    }

    generatePlotOptions(description, allFilms) {
        // Extract key themes/keywords from descriptions
        const themes = ['adventure', 'magic', 'friendship', 'nature', 'family', 'spirits', 'war', 'coming of age'];
        const correctTheme = themes.find(theme => description.toLowerCase().includes(theme)) || 'adventure';
        
        const options = [correctTheme];
        const remainingThemes = themes.filter(theme => theme !== correctTheme);
        
        while (options.length < 4 && remainingThemes.length > 0) {
            const randomTheme = remainingThemes.splice(Math.floor(Math.random() * remainingThemes.length), 1)[0];
            options.push(randomTheme);
        }
        
        return this.shuffleArray(options);
    }

    extractPlotKeyword(description) {
        const themes = ['adventure', 'magic', 'friendship', 'nature', 'family', 'spirits', 'war', 'coming of age'];
        return themes.find(theme => description.toLowerCase().includes(theme)) || 'adventure';
    }

    // Utility methods
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    getFallbackQuestion(difficulty, avoidQuestions) {
        const fallbacks = ANIME_ONLY_FALLBACK[difficulty] || ANIME_ONLY_FALLBACK['Medium'];
        
        const availableFallbacks = fallbacks.filter(q => !avoidQuestions.has(q.question.toLowerCase().trim()));
        
        if (availableFallbacks.length === 0) {
            console.log(`[API] All ${difficulty} fallback questions used, resetting...`);
            const selectedQuestion = fallbacks[Math.floor(Math.random() * fallbacks.length)];
            return { 
                ...selectedQuestion, 
                difficulty: difficulty,
                source: 'fallback-reset' 
            };
        }
        
        const selectedQuestion = availableFallbacks[Math.floor(Math.random() * availableFallbacks.length)];
        return { 
            ...selectedQuestion, 
            difficulty: difficulty,
            source: 'fallback' 
        };
    }

    cleanText(text) {
        if (!text) return '';
        return text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#x([0-9A-Fa-f]+);/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
            .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(parseInt(d, 10))).trim();
    }

    getAPIName(url) {
        if (url.includes('aniquiz-api')) return 'AniQuiz API';
        if (url.includes('ghibliapi')) return 'Studio Ghibli API';
        if (url.includes('anilist')) return 'AniList GraphQL';
        return 'Custom';
    }
}

module.exports = QuestionLoader;

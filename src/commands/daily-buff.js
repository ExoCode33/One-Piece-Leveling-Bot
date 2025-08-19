// src/commands/daily-buff.js - Enhanced with Guess The Opening API

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Tier colors and configurations (same as before)
const TIER_COLORS = {
    1: 0x22C55E, // Green
    2: 0x3B82F6, // Blue  
    3: 0x8B5CF6, // Purple
    4: 0xF59E0B, // Gold
    5: 0xF97316, // Orange
    6: 0xEF4444  // Red
};

const TIER_NAMES = {
    1: 'Marine Training',
    2: 'Enhanced Drill', 
    3: 'Elite Protocol',
    4: 'Admiral Focus',
    5: 'Fleet Command',
    6: 'World Government Authorization'
};

// ✅ NEW: Enhanced API Configuration with Guess The Opening
const QUIZ_APIS = [
    {
        name: 'GuessTheOpening',
        url: 'https://openings.moe/api/details/random',
        type: 'opening',
        parser: (data) => {
            if (!data || !data.sources || data.sources.length === 0) {
                throw new Error('No opening data available');
            }
            
            const opening = data.sources[0];
            const animeName = opening.name || 'Unknown Anime';
            const songTitle = opening.title || 'Unknown Song';
            const artist = opening.artist || 'Unknown Artist';
            
            // Create multiple choice options
            const correctAnswer = animeName;
            const options = [correctAnswer, 'Attack on Titan', 'Demon Slayer', 'My Hero Academia']
                .slice(0, 4); // Ensure only 4 options
            
            // Shuffle options if we have more than just the correct answer
            if (options.length > 1) {
                for (let i = options.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [options[i], options[j]] = [options[j], options[i]];
                }
            }
            
            return {
                question: `🎵 Which anime does this opening song belong to?\n\n**Song:** "${songTitle}"\n**Artist:** ${artist}`,
                options: options,
                answer: correctAnswer,
                difficulty: 'Medium',
                type: 'opening',
                songData: {
                    title: songTitle,
                    artist: artist,
                    anime: animeName,
                    videoUrl: opening.video || null
                }
            };
        }
    },
    {
        name: 'AniQuizAPI',
        url: 'https://aniquizapi.vercel.app/api/quiz',
        type: 'quiz',
        parser: (data) => ({
            question: data.question,
            options: data.options,
            answer: data.answer,
            difficulty: data.difficulty || 'Medium',
            type: 'quiz'
        })
    }
];

// Enhanced Fallback Questions with Opening-style questions
const FALLBACK_QUESTIONS = [
    // Opening/Music themed questions
    {
        question: "🎵 Which anime features the opening song 'Unravel'?",
        options: ["Tokyo Ghoul", "Attack on Titan", "Death Note", "Parasyte"],
        answer: "Tokyo Ghoul",
        difficulty: "Medium",
        type: "opening"
    },
    {
        question: "🎵 'Cruel Angel's Thesis' is the opening of which iconic anime?",
        options: ["Neon Genesis Evangelion", "Cowboy Bebop", "Ghost in the Shell", "Akira"],
        answer: "Neon Genesis Evangelion",
        difficulty: "Easy",
        type: "opening"
    },
    {
        question: "🎵 Which anime opening is performed by LiSA and starts with 'Gurenge'?",
        options: ["Demon Slayer", "Sword Art Online", "Attack on Titan", "Fire Force"],
        answer: "Demon Slayer",
        difficulty: "Easy",
        type: "opening"
    },
    // Regular anime questions (your existing ones)
    {
        question: "Who is the captain of the Straw Hat Pirates in One Piece?",
        options: ["Monkey D. Luffy", "Roronoa Zoro", "Nami", "Sanji"],
        answer: "Monkey D. Luffy",
        difficulty: "Easy",
        type: "quiz"
    },
    {
        question: "What is Naruto's signature jutsu?",
        options: ["Chidori", "Rasengan", "Shadow Clone Jutsu", "Byakugan"],
        answer: "Rasengan",
        difficulty: "Easy",
        type: "quiz"
    },
    {
        question: "In Attack on Titan, what is Eren's Titan form called?",
        options: ["Attack Titan", "Colossal Titan", "Female Titan", "Beast Titan"],
        answer: "Attack Titan",
        difficulty: "Medium",
        type: "quiz"
    }
    // ... (rest of your existing fallback questions)
];

class AnimeQuizSystem {
    // ✅ ENHANCED: Fetch question with preference for opening API
    static async fetchAnimeQuestion(preferOpening = true) {
        console.log('[ANIME QUIZ] Fetching fresh anime question from APIs...');
        
        // Reorder APIs based on preference
        let apiOrder = [...QUIZ_APIS];
        if (preferOpening) {
            // Put opening API first if we prefer it
            apiOrder = apiOrder.sort((a, b) => a.type === 'opening' ? -1 : 1);
        }
        
        // Try each API in order
        for (const api of apiOrder) {
            try {
                console.log(`[ANIME QUIZ] Trying ${api.name} (${api.type})...`);
                
                const response = await fetch(api.url, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'DiscordBot-AnimeQuiz/1.0',
                        'Accept': 'application/json'
                    },
                    timeout: 8000 // Increased timeout for opening API
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const parsedQuestion = api.parser(data);
                    
                    if (parsedQuestion && parsedQuestion.question && parsedQuestion.options && parsedQuestion.answer) {
                        console.log(`[ANIME QUIZ] ✅ Successfully fetched ${api.type} from ${api.name}`);
                        return parsedQuestion;
                    }
                }
                
                console.log(`[ANIME QUIZ] ❌ ${api.name} returned invalid data`);
            } catch (error) {
                console.log(`[ANIME QUIZ] ❌ ${api.name} failed:`, error.message);
            }
        }

        // All APIs failed, use fallback
        console.log('[ANIME QUIZ] 🛡️ All APIs failed, using fallback anime question');
        const fallbackQuestions = preferOpening ? 
            FALLBACK_QUESTIONS.filter(q => q.type === 'opening').concat(FALLBACK_QUESTIONS) :
            FALLBACK_QUESTIONS;
        
        const fallbackQuestion = fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
        return fallbackQuestion;
    }

    // ✅ ENHANCED: Create quiz embed with opening-specific styling
    static createQuizEmbed(questionData, userId) {
        const difficultyEmoji = {
            'Easy': '🟢',
            'Medium': '🟡', 
            'Hard': '🔴'
        };

        const isOpening = questionData.type === 'opening';
        const embedColor = isOpening ? '#FF1493' : '#FF6B35'; // Pink for openings, orange for regular
        
        const embed = new EmbedBuilder()
            .setTitle(isOpening ? '🎵 Anime Opening Challenge!' : '🎌 Anime Knowledge Challenge!')
            .setColor(embedColor)
            .setDescription(`**${questionData.question}**\n\n*Choose the correct answer to earn your daily enhancement!*`)
            .addFields(
                {
                    name: '📊 Quiz Info',
                    value: `${difficultyEmoji[questionData.difficulty] || '🟡'} **Difficulty:** ${questionData.difficulty}\n⏱️ **Time Limit:** 30 seconds\n${isOpening ? '🎵 **Type:** Opening Challenge' : '🧠 **Type:** Anime Knowledge'}`,
                    inline: true
                },
                {
                    name: '🎯 Reward',
                    value: `✨ **Daily XP Enhancement**\n🎲 **Random Tier (1-6)**\n⚡ **XP Multiplier Boost**`,
                    inline: true
                }
            )
            .setFooter({ 
                text: isOpening ? 
                    'Marine Intelligence • Anime Opening Assessment' : 
                    'Marine Intelligence • Anime Knowledge Assessment' 
            })
            .setTimestamp();

        // Add song info for opening questions
        if (isOpening && questionData.songData) {
            embed.addFields({
                name: '🎼 Song Details',
                value: `**Title:** ${questionData.songData.title}\n**Artist:** ${questionData.songData.artist}`,
                inline: false
            });
        }

        return embed;
    }

    // Create answer buttons (same as before)
    static createAnswerButtons(questionData, userId) {
        const buttons = [];
        const options = questionData.options.slice(0, 4); // Ensure max 4 options
        const emojis = ['🇦', '🇧', '🇨', '🇩'];

        options.forEach((option, index) => {
            const isCorrect = option === questionData.answer;
            const truncatedOption = option.length > 75 ? option.substring(0, 72) + '...' : option;
            
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`anime_quiz_${userId}_${index}_${isCorrect}`)
                    .setLabel(truncatedOption)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(emojis[index])
            );
        });

        // Create action rows (max 5 buttons per row)
        const rows = [];
        for (let i = 0; i < buttons.length; i += 5) {
            rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
        }

        return rows;
    }

    // ✅ ENHANCED: Create result embed with opening-specific information
    static createResultEmbed(isCorrect, questionData, tier, member) {
        const tierName = TIER_NAMES[tier];
        const color = isCorrect ? TIER_COLORS[tier] : 0xFF0000;
        const nextReset = getNextResetUnixTimestamp();
        const isOpening = questionData.type === 'opening';
        
        // Get power amplification from role settings
        let powerAmplification = '1.0x';
        try {
            const roleId = process.env[`DAILY_XP_BUFF_TIER_${tier}_ROLE`];
            if (roleId && global.xpBoostManager && member.guild) {
                powerAmplification = 'From Role Settings';
            }
        } catch (error) {
            console.error('[DAILY BUFF] Error getting role multiplier:', error);
        }

        if (isCorrect) {
            const embed = new EmbedBuilder()
                .setTitle(isOpening ? '✅ Correct! Great Music Knowledge!' : '✅ Correct Answer!')
                .setColor(color)
                .setDescription(`**${isOpening ? 'Excellent anime opening knowledge!' : 'Excellent anime knowledge!'}** 🎉\n\n**${tierName} Enhancement Activated!**`)
                .addFields(
                    {
                        name: isOpening ? '🎵 Opening Quiz Result' : '📚 Quiz Result',
                        value: `**Question:** ${questionData.question.substring(0, 100)}${questionData.question.length > 100 ? '...' : ''}\n**Correct Answer:** ${questionData.answer}\n**Difficulty:** ${questionData.difficulty}`,
                        inline: false
                    },
                    {
                        name: '⚡ Enhancement Details',
                        value: `**Status:** Active\n**Next Reset:** <t:${nextReset}:R>\n**Power Amplification:** ${powerAmplification}`,
                        inline: false
                    }
                );

            // Add song details for opening questions
            if (isOpening && questionData.songData) {
                embed.addFields({
                    name: '🎼 Song Information',
                    value: `**Title:** ${questionData.songData.title}\n**Artist:** ${questionData.songData.artist}\n**Anime:** ${questionData.songData.anime}`,
                    inline: false
                });
            }

            embed.setFooter({ text: `${tierName} Enhancement Active • Marine Enhancement Division` })
                 .setTimestamp();

            return embed;
        } else {
            const embed = new EmbedBuilder()
                .setTitle('❌ Incorrect Answer')
                .setColor(color)
                .setDescription(`**Better luck next time!** 📚\n\nNo enhancement earned today.`)
                .addFields(
                    {
                        name: isOpening ? '🎵 Opening Quiz Result' : '📚 Quiz Result',
                        value: `**Question:** ${questionData.question.substring(0, 100)}${questionData.question.length > 100 ? '...' : ''}\n**Correct Answer:** ${questionData.answer}\n**Difficulty:** ${questionData.difficulty}`,
                        inline: false
                    },
                    {
                        name: '💡 Try Again',
                        value: `**Next Attempt:** <t:${nextReset}:R>\n**Tip:** ${isOpening ? 'Listen to more anime openings' : 'Study more anime'} to improve your chances!\n**Reward:** Daily XP Enhancement`,
                        inline: false
                    }
                );

            // Add song details for opening questions
            if (isOpening && questionData.songData) {
                embed.addFields({
                    name: '🎼 Song Information',
                    value: `**Title:** ${questionData.songData.title}\n**Artist:** ${questionData.songData.artist}\n**Anime:** ${questionData.songData.anime}`,
                    inline: false
                });
            }

            embed.setFooter({ text: 'Marine Intelligence • Study harder, recruit!' })
                 .setTimestamp();

            return embed;
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily-buff')
        .setDescription('🎌 Take the daily anime quiz to earn XP enhancement! Features opening challenges!')
        .addBooleanOption(option =>
            option.setName('prefer-openings')
                .setDescription('Prefer anime opening questions over general anime questions')
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            const member = interaction.member;
            const preferOpenings = interaction.options.getBoolean('prefer-openings') ?? true; // Default to true

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
                    .setTitle('🎌 Daily Quiz Already Completed')
                    .setDescription(`You've already taken today's anime quiz!\n\n**Current Enhancement:** ${currentBuff.name}\n**Status:** ${currentBuff.multiplier}\n\n*Next quiz available: <t:${nextReset}:R>*`)
                    .setFooter({ text: 'Marine Intelligence • Daily Anime Assessment' })
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], flags: 64 });
            }

            // Start the quiz
            await interaction.deferReply();
            await this.startAnimeQuiz(interaction, userId, guildId, member, preferOpenings);

        } catch (error) {
            console.error('[DAILY BUFF] Error in daily-buff command:', error);
            
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ **Error**\n\nSomething went wrong with the anime quiz system. Please try again.'
                });
            } else {
                await interaction.reply({
                    content: '❌ **Error**\n\nSomething went wrong with the anime quiz system. Please try again.',
                    flags: 64
                });
            }
        }
    },

    // ✅ ENHANCED: Start the anime quiz with opening preference
    async startAnimeQuiz(interaction, userId, guildId, member, preferOpenings = true) {
        try {
            console.log(`[ANIME QUIZ] Starting ${preferOpenings ? 'opening-focused' : 'general'} quiz for ${interaction.user.username}`);
            
            // Fetch anime question from API with preference
            const questionData = await AnimeQuizSystem.fetchAnimeQuestion(preferOpenings);
            
            // Create quiz embed and buttons
            const quizEmbed = AnimeQuizSystem.createQuizEmbed(questionData, userId);
            const answerButtons = AnimeQuizSystem.createAnswerButtons(questionData, userId);
            
            // Send the quiz
            await interaction.editReply({ 
                embeds: [quizEmbed], 
                components: answerButtons 
            });

            // Set up button collector for answers
            const message = await interaction.fetchReply();
            const collector = message.createMessageComponentCollector({ 
                time: 30000, // 30 seconds
                filter: (i) => i.user.id === userId && i.customId.startsWith('anime_quiz_')
            });

            collector.on('collect', async (buttonInteraction) => {
                try {
                    await buttonInteraction.deferUpdate();
                    
                    // Parse button response
                    const [, , userIdFromButton, optionIndex, isCorrectStr] = buttonInteraction.customId.split('_');
                    const isCorrect = isCorrectStr === 'true';
                    
                    // Calculate tier based on result
                    let tier = 1; // Default if wrong
                    if (isCorrect) {
                        tier = this.calculateBuffTier();
                        
                        // Apply the buff role and save to database
                        await this.applyBuffRole(userId, guildId, member, tier);
                    }
                    
                    // Create and show result
                    const resultEmbed = AnimeQuizSystem.createResultEmbed(isCorrect, questionData, tier, member);
                    
                    await buttonInteraction.editReply({
                        embeds: [resultEmbed],
                        components: [] // Remove buttons
                    });
                    
                    collector.stop();
                    
                } catch (error) {
                    console.error('[ANIME QUIZ] Button interaction error:', error);
                    await buttonInteraction.editReply({
                        content: '❌ **Error processing answer**\n\nPlease try the quiz again.',
                        components: []
                    });
                }
            });

            collector.on('end', async (collected) => {
                if (collected.size === 0) {
                    // Timeout - no answer given
                    const timeoutEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('⏰ Quiz Timeout!')
                        .setDescription('**Time\'s up!** You didn\'t answer in time.\n\nNo enhancement earned today.')
                        .addFields({
                            name: '💡 Next Attempt',
                            value: `Try again tomorrow at <t:${getNextResetUnixTimestamp()}:R>`,
                            inline: false
                        })
                        .setFooter({ text: 'Marine Intelligence • Answer faster next time!' })
                        .setTimestamp();

                    await interaction.editReply({
                        embeds: [timeoutEmbed],
                        components: []
                    });
                }
            });

        } catch (error) {
            console.error('[ANIME QUIZ] Quiz error:', error);
            await interaction.editReply({
                content: '❌ **Quiz Error**\n\nFailed to load anime quiz. Please try again.'
            });
        }
    },

    // Rest of your existing methods (calculateBuffTier, checkDailyRoll, etc.)
    calculateBuffTier() {
        const random = Math.random() * 100;
        
        if (random < 45) return 1;        // 45% - Common
        else if (random < 70) return 2;   // 25% - Rare  
        else if (random < 85) return 3;   // 15% - Epic
        else if (random < 94) return 4;   // 9% - Legendary
        else if (random < 99) return 5;   // 5% - Mythical
        else return 6;                    // 1% - Divine
    },

    // ... (rest of your existing methods remain the same)
    // checkDailyRoll, getCurrentBuff, applyBuffRole, etc.
};

// Helper functions (same as before)
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

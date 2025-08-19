// src/commands/daily-buff.js - API-based Anime Quiz System with Fallback

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Tier colors and configurations
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

// API Configuration - Anime-focused only
const QUIZ_APIS = [
    {
        name: 'AniQuizAPI',
        url: 'https://aniquizapi.vercel.app/api/quiz',
        parser: (data) => ({
            question: data.question,
            options: data.options,
            answer: data.answer,
            difficulty: data.difficulty || 'Medium'
        })
    }
];

// Pure Anime Fallback Questions (no Pokemon, games, or other topics)
const FALLBACK_QUESTIONS = [
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
        question: "In Attack on Titan, what is Eren's Titan form called?",
        options: ["Attack Titan", "Colossal Titan", "Female Titan", "Beast Titan"],
        answer: "Attack Titan",
        difficulty: "Medium"
    },
    {
        question: "Which anime features the character Light Yagami who uses a Death Note?",
        options: ["Death Note", "Tokyo Ghoul", "Code Geass", "Future Diary"],
        answer: "Death Note",
        difficulty: "Easy"
    },
    {
        question: "Who is known as 'Humanity's Strongest Soldier' in Attack on Titan?",
        options: ["Levi Ackerman", "Erwin Smith", "Mikasa Ackerman", "Eren Yeager"],
        answer: "Levi Ackerman",
        difficulty: "Easy"
    },
    {
        question: "What is the name of the hero school in My Hero Academia?",
        options: ["U.A. High School", "Shiketsu High", "Ketsubutsu Academy", "Seiai Academy"],
        answer: "U.A. High School",
        difficulty: "Medium"
    },
    {
        question: "In Dragon Ball Z, what is Goku's Saiyan birth name?",
        options: ["Kakarot", "Vegeta", "Raditz", "Bardock"],
        answer: "Kakarot",
        difficulty: "Medium"
    },
    {
        question: "Who is the main protagonist of Demon Slayer: Kimetsu no Yaiba?",
        options: ["Tanjiro Kamado", "Zenitsu Agatsuma", "Inosuke Hashibira", "Giyu Tomioka"],
        answer: "Tanjiro Kamado",
        difficulty: "Easy"
    },
    {
        question: "In Fullmetal Alchemist, what is the fundamental law of alchemy?",
        options: ["Equivalent Exchange", "Conservation of Mass", "Transmutation Circle", "Philosopher's Stone"],
        answer: "Equivalent Exchange",
        difficulty: "Medium"
    },
    {
        question: "Who is the Survey Corps commander in Attack on Titan?",
        options: ["Erwin Smith", "Levi Ackerman", "Hange Zoe", "Keith Shadis"],
        answer: "Erwin Smith",
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
        question: "Who is the Flame Hashira in Demon Slayer?",
        options: ["Kyojuro Rengoku", "Giyu Tomioka", "Tengen Uzui", "Sanemi Shinazugawa"],
        answer: "Kyojuro Rengoku",
        difficulty: "Medium"
    },
    {
        question: "In One Piece, what is the name of Luffy's Devil Fruit?",
        options: ["Gomu Gomu no Mi", "Mera Mera no Mi", "Hito Hito no Mi", "Yami Yami no Mi"],
        answer: "Gomu Gomu no Mi",
        difficulty: "Medium"
    },
    {
        question: "Who is the main antagonist in the first season of Tokyo Ghoul?",
        options: ["Jason (Yamori)", "Rize Kamishiro", "Shu Tsukiyama", "Eto Yoshimura"],
        answer: "Jason (Yamori)",
        difficulty: "Hard"
    }
];

class AnimeQuizSystem {
    // Fetch anime question from APIs with fallback
    static async fetchAnimeQuestion() {
        console.log('[ANIME QUIZ] Fetching fresh anime question from APIs...');
        
        // Try each API in order
        for (const api of QUIZ_APIS) {
            try {
                console.log(`[ANIME QUIZ] Trying ${api.name}...`);
                
                const response = await fetch(api.url, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'DiscordBot-AnimeQuiz/1.0',
                        'Accept': 'application/json'
                    },
                    timeout: 5000 // 5 second timeout
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const parsedQuestion = api.parser(data);
                    
                    if (parsedQuestion && parsedQuestion.question && parsedQuestion.options && parsedQuestion.answer) {
                        console.log(`[ANIME QUIZ] ✅ Successfully fetched from ${api.name}`);
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
        const fallbackQuestion = FALLBACK_QUESTIONS[Math.floor(Math.random() * FALLBACK_QUESTIONS.length)];
        return fallbackQuestion;
    }

    // Create quiz embed with question
    static createQuizEmbed(questionData, userId) {
        const difficultyEmoji = {
            'Easy': '🟢',
            'Medium': '🟡', 
            'Hard': '🔴'
        };

        const embed = new EmbedBuilder()
            .setTitle('🎌 Anime Knowledge Challenge!')
            .setColor('#FF6B35')
            .setDescription(`**${questionData.question}**\n\n*Choose the correct answer to earn your daily enhancement!*`)
            .addFields(
                {
                    name: '📊 Quiz Info',
                    value: `${difficultyEmoji[questionData.difficulty] || '🟡'} **Difficulty:** ${questionData.difficulty}\n⏱️ **Time Limit:** 30 seconds`,
                    inline: true
                },
                {
                    name: '🎯 Reward',
                    value: `✨ **Daily XP Enhancement**\n🎲 **Random Tier (1-6)**\n⚡ **XP Multiplier Boost**`,
                    inline: true
                }
            )
            .setFooter({ text: 'Marine Intelligence • Anime Knowledge Assessment' })
            .setTimestamp();

        return embed;
    }

    // Create answer buttons (max 4 options)
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

    // Create result embed after answering
    static createResultEmbed(isCorrect, questionData, tier, member) {
        const tierName = TIER_NAMES[tier];
        const color = isCorrect ? TIER_COLORS[tier] : 0xFF0000;
        const nextReset = getNextResetUnixTimestamp();
        
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
                .setTitle('✅ Correct Answer!')
                .setColor(color)
                .setDescription(`**Excellent anime knowledge!** 🎉\n\n**${tierName} Enhancement Activated!**`)
                .addFields(
                    {
                        name: '📚 Quiz Result',
                        value: `**Question:** ${questionData.question.substring(0, 100)}${questionData.question.length > 100 ? '...' : ''}\n**Correct Answer:** ${questionData.answer}\n**Difficulty:** ${questionData.difficulty}`,
                        inline: false
                    },
                    {
                        name: '⚡ Enhancement Details',
                        value: `**Status:** Active\n**Next Reset:** <t:${nextReset}:R>\n**Power Amplification:** ${powerAmplification}`,
                        inline: false
                    }
                )
                .setFooter({ text: `${tierName} Enhancement Active • Marine Enhancement Division` })
                .setTimestamp();

            return embed;
        } else {
            const embed = new EmbedBuilder()
                .setTitle('❌ Incorrect Answer')
                .setColor(color)
                .setDescription(`**Better luck next time!** 📚\n\nNo enhancement earned today.`)
                .addFields(
                    {
                        name: '📚 Quiz Result',
                        value: `**Question:** ${questionData.question.substring(0, 100)}${questionData.question.length > 100 ? '...' : ''}\n**Correct Answer:** ${questionData.answer}\n**Difficulty:** ${questionData.difficulty}`,
                        inline: false
                    },
                    {
                        name: '💡 Try Again',
                        value: `**Next Attempt:** <t:${nextReset}:R>\n**Tip:** Study more anime to improve your chances!\n**Reward:** Daily XP Enhancement`,
                        inline: false
                    }
                )
                .setFooter({ text: 'Marine Intelligence • Study harder, recruit!' })
                .setTimestamp();

            return embed;
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily-buff')
        .setDescription('🎌 Take the daily anime quiz to earn XP enhancement! Resets at 3:00 AM EST'),

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
                    .setTitle('🎌 Daily Quiz Already Completed')
                    .setDescription(`You've already taken today's anime quiz!\n\n**Current Enhancement:** ${currentBuff.name}\n**Status:** ${currentBuff.multiplier}\n\n*Next quiz available: <t:${nextReset}:R>*`)
                    .setFooter({ text: 'Marine Intelligence • Daily Anime Assessment' })
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], flags: 64 });
            }

            // Start the quiz
            await interaction.deferReply();
            await this.startAnimeQuiz(interaction, userId, guildId, member);

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

    // Start the anime quiz
    async startAnimeQuiz(interaction, userId, guildId, member) {
        try {
            console.log(`[ANIME QUIZ] Starting quiz for ${interaction.user.username}`);
            
            // Fetch anime question from API
            const questionData = await AnimeQuizSystem.fetchAnimeQuestion();
            
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

    // Calculate which tier to award (same probabilities as before)
    calculateBuffTier() {
        const random = Math.random() * 100;
        
        if (random < 45) return 1;        // 45% - Common
        else if (random < 70) return 2;   // 25% - Rare  
        else if (random < 85) return 3;   // 15% - Epic
        else if (random < 94) return 4;   // 9% - Legendary
        else if (random < 99) return 5;   // 5% - Mythical
        else return 6;                    // 1% - Divine
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
            console.error('[DAILY BUFF] Error checking daily roll:', error);
            return false;
        }
    },

    // Get current buff for a user
    async getCurrentBuff(userId, guildId, member) {
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
    },

    // Apply the buff role to the user
    async applyBuffRole(userId, guildId, member, tier) {
        try {
            // Remove any existing buff roles first
            await this.removeAllBuffRoles(member);

            // Add the new buff role
            const roleId = process.env[`DAILY_XP_BUFF_TIER_${tier}_ROLE`];
            if (roleId) {
                const role = member.guild.roles.cache.get(roleId);
                if (role) {
                    await member.roles.add(role);
                    console.log(`[DAILY BUFF] ✅ Awarded ${role.name} to ${member.user.username}`);
                } else {
                    console.error(`[DAILY BUFF] ❌ Role not found: ${roleId}`);
                }
            } else {
                console.warn(`[DAILY BUFF] ⚠️ No role ID configured for tier ${tier}`);
            }

            // Save to database
            await this.saveBuffRoll(userId, guildId, tier);

        } catch (error) {
            console.error('[DAILY BUFF] ❌ Error applying buff role:', error);
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
                    console.log(`[DAILY BUFF] Removed ${role.name} from ${member.user.username}`);
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

            console.log(`[DAILY BUFF] ✅ Saved tier ${tier} quiz result for ${userId} on ${currentDay}`);

        } catch (error) {
            console.error('[DAILY BUFF] ❌ Error saving buff roll:', error);
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

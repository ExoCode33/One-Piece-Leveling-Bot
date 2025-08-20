// src/commands/daily-quiz.js - Enhanced Daily Quiz System with Renamed Tables and Testing Mode

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

// ✅ NEW: Testing mode flag
const TESTING_MODE = process.env.DAILY_QUIZ_TESTING_MODE === 'true';

// Enhanced fallback questions focused on anime lore
const FALLBACK = {
    'Easy': [
        { question: "Who is the main protagonist of One Piece?", options: ["Monkey D. Luffy", "Roronoa Zoro", "Nami", "Sanji"], answer: "Monkey D. Luffy" },
        { question: "What is Luffy's Devil Fruit called?", options: ["Gomu Gomu no Mi", "Mera Mera no Mi", "Hito Hito no Mi", "Yami Yami no Mi"], answer: "Gomu Gomu no Mi" },
        { question: "What is the name of Luffy's pirate crew?", options: ["Straw Hat Pirates", "Red Hair Pirates", "Whitebeard Pirates", "Heart Pirates"], answer: "Straw Hat Pirates" },
        { question: "In Naruto, what village is Naruto from?", options: ["Hidden Leaf Village", "Hidden Sand Village", "Hidden Mist Village", "Hidden Cloud Village"], answer: "Hidden Leaf Village" },
        { question: "What color is Pikachu in Pokemon?", options: ["Yellow", "Blue", "Red", "Green"], answer: "Yellow" },
        { question: "In Dragon Ball, what are the magical orbs called?", options: ["Dragon Balls", "Power Orbs", "Magic Spheres", "Wish Stones"], answer: "Dragon Balls" }
    ],
    'Medium': [
        { question: "What is the name of the sea where most of One Piece takes place?", options: ["Grand Line", "East Blue", "West Blue", "Red Line"], answer: "Grand Line" },
        { question: "In Attack on Titan, what is Eren's Titan form called?", options: ["Attack Titan", "Colossal Titan", "Female Titan", "Beast Titan"], answer: "Attack Titan" },
        { question: "Who is known as 'Humanity's Strongest Soldier' in Attack on Titan?", options: ["Levi Ackerman", "Erwin Smith", "Mikasa Ackerman", "Eren Yeager"], answer: "Levi Ackerman" },
        { question: "In One Piece, what is the ultimate treasure called?", options: ["One Piece", "All Blue", "Void Century", "Poneglyph"], answer: "One Piece" },
        { question: "What is the name of the ninja academy in Naruto?", options: ["Ninja Academy", "Shinobi School", "Konoha Academy", "Leaf Academy"], answer: "Ninja Academy" },
        { question: "In My Hero Academia, what is Deku's real name?", options: ["Izuku Midoriya", "Katsuki Bakugo", "Shoto Todoroki", "Tenya Iida"], answer: "Izuku Midoriya" }
    ],
    'Hard': [
        { question: "In One Piece, where do the Straw Hats first meet Brook?", options: ["Thriller Bark", "Sabaody Archipelago", "Water 7", "Enies Lobby"], answer: "Thriller Bark" },
        { question: "What is Roy Mustang's title in Fullmetal Alchemist?", options: ["Flame Alchemist", "Steel Alchemist", "State Alchemist", "Fire Colonel"], answer: "Flame Alchemist" },
        { question: "In One Piece, what is the name of the island where the World Government is located?", options: ["Mariejois", "Enies Lobby", "Impel Down", "Marineford"], answer: "Mariejois" },
        { question: "What is the name of the technique Luffy learns during the timeskip?", options: ["Haki", "Rokushiki", "Fishman Karate", "Electro"], answer: "Haki" },
        { question: "In Hunter x Hunter, what is Gon's father's name?", options: ["Ging Freecss", "Silva Zoldyck", "Isaac Netero", "Leorio Paradinight"], answer: "Ging Freecss" },
        { question: "What is the name of the school in Kill la Kill?", options: ["Honnouji Academy", "Kiryuin Academy", "Satsuki Academy", "Ryuko Academy"], answer: "Honnouji Academy" }
    ]
};

// Timezone helpers
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
    
    const currentTimeInMinutes = (estTime.getHours() * 60) + estTime.getMinutes();
    const resetTimeInMinutes = (3 * 60) + 0;
    
    if (currentTimeInMinutes >= resetTimeInMinutes) {
        nextReset.setDate(nextReset.getDate() + 1);
    }
    
    const utcReset = new Date(nextReset.getTime() - (estOffset * 60 * 60 * 1000));
    return Math.floor(utcReset.getTime() / 1000);
}

// Enhanced question fetching
async function fetchQuestion(difficulty) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const apiUrls = [
            'https://opentdb.com/api.php?amount=1&category=31&type=multiple',
            'https://aniquizapi.vercel.app/api/quiz',
        ];
        
        for (const apiUrl of apiUrls) {
            try {
                console.log(`[API] Trying ${apiUrl.includes('opentdb') ? 'OpenTDB' : 'AniQuiz'} API...`);
                
                const response = await fetch(apiUrl, {
                    method: 'GET',
                    headers: { 'User-Agent': 'DiscordBot-AnimeQuiz/1.0', 'Accept': 'application/json' },
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    const data = await response.json();
                    let question, options, answer;
                    
                    if (data.results && data.results.length > 0) {
                        const result = data.results[0];
                        question = result.question;
                        answer = result.correct_answer;
                        options = [...result.incorrect_answers, result.correct_answer].sort(() => Math.random() - 0.5);
                        
                        const badKeywords = ['voice actor', 'voiced by', 'seiyuu', 'dub', 'english dub', 'studio', 'director', 'composer'];
                        if (badKeywords.some(keyword => question.toLowerCase().includes(keyword))) {
                            console.log('[API] Skipping voice actor/production question');
                            continue;
                        }
                    } else if (data.data?.question || data.question) {
                        const questionData = data.data || data;
                        question = questionData.question;
                        options = Array.isArray(questionData.options) ? questionData.options : [];
                        answer = questionData.correct;
                        
                        const badKeywords = ['voice actor', 'voiced by', 'seiyuu', 'dub', 'english dub', 'studio', 'director', 'composer'];
                        if (badKeywords.some(keyword => question.toLowerCase().includes(keyword))) {
                            console.log('[API] Skipping voice actor/production question');
                            continue;
                        }
                    } else {
                        continue;
                    }
                    
                    const clean = (text) => {
                        if (!text) return '';
                        return text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#x([0-9A-Fa-f]+);/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
                            .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(parseInt(d, 10))).trim();
                    };
                    
                    question = clean(question);
                    answer = clean(answer);
                    options = options.map(opt => clean(opt)).filter(opt => opt.length > 0);
                    
                    if (!question || options.length < 2 || !answer) continue;
                    
                    if (!options.includes(answer)) {
                        const match = options.find(opt => opt.toLowerCase() === answer.toLowerCase());
                        if (match) answer = match;
                        else if (options.length >= 4) options[3] = answer;
                        else options.push(answer);
                    }
                    
                    if (options.length > 4) {
                        const correctIndex = options.indexOf(answer);
                        const others = options.filter((opt, i) => i !== correctIndex);
                        const randomOthers = others.sort(() => 0.5 - Math.random()).slice(0, 3);
                        options = [answer, ...randomOthers].sort(() => 0.5 - Math.random());
                    }
                    
                    console.log(`[API] ✅ Fetched ${difficulty} anime lore question from ${apiUrl.includes('opentdb') ? 'OpenTDB' : 'AniQuiz'}`);
                    return { question, options, answer, difficulty };
                }
            } catch (error) {
                console.log(`[API] API ${apiUrl} failed: ${error.message}`);
                continue;
            }
        }
    } catch (error) {
        console.log(`[API] ❌ All APIs failed: ${error.message}`);
    }
    
    console.log(`[API] 🛡️ Using enhanced fallback ${difficulty} question`);
    const fallbacks = FALLBACK[difficulty] || FALLBACK['Medium'];
    const selectedQuestion = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    return selectedQuestion;
}

function getDay() { return getCurrentDayKey(); }
function getReset() { return getNextResetUnixTimestamp(); }

module.exports = {
    data: new SlashCommandBuilder().setName('daily-quiz').setDescription('🎌 Ultimate anime challenge! 10 questions, Divine mastery awaits!'),

    async execute(interaction) {
        try {
            // ✅ NEW: Check if command is used in the correct channel
            const allowedChannelId = process.env.DAILY_QUIZ_CHANNEL;
            
            if (allowedChannelId && interaction.channel.id !== allowedChannelId) {
                const allowedChannel = interaction.guild.channels.cache.get(allowedChannelId);
                const channelMention = allowedChannel ? `<#${allowedChannelId}>` : `channel ID: ${allowedChannelId}`;
                
                return await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#FF6B6B')
                        .setTitle('🚫 Wrong Channel')
                        .setDescription(`The daily quiz can only be used in ${channelMention}.\n\nPlease go to the correct channel to take the challenge!`)
                        .setFooter({ text: 'Daily Quiz • Channel Restriction' })
                        .setTimestamp()
                    ],
                    ephemeral: true
                });
            }

            const userId = interaction.user.id, guildId = interaction.guild.id, member = interaction.member;
            
            if (!global.xpTracker?.db) {
                return await interaction.reply({ 
                    content: '❌ System unavailable - XP tracker not initialized', 
                    ephemeral: true 
                });
            }

            // ✅ NEW: Testing mode check - skip database checks if testing
            if (!TESTING_MODE) {
                // Check if user completed challenge (not just attempted)
                const existingRecord = await this.checkAttempt(userId, guildId);
                if (existingRecord && existingRecord.tier > 0) {
                    const buff = await this.getBuff(userId, guildId, member);
                    const embed = new EmbedBuilder()
                        .setColor('#FF6B6B')
                        .setAuthor({ name: '🎌 ULTIMATE ANIME MASTERY CHALLENGE' })
                        .setTitle('Daily Challenge Already Completed')
                        .setDescription(`Current Enhancement: ${buff.name}\nNext: <t:${getReset()}:R>`)
                        .setFooter({ text: 'Enhancement Intelligence • Ultimate System' })
                        .setTimestamp();
                    return await interaction.reply({ embeds: [embed], ephemeral: true });
                }
                
                // If user failed completely (tier 0), allow retry by deleting record
                if (existingRecord && existingRecord.tier === 0) {
                    console.log(`[DAILY QUIZ] Allowing retry for user ${userId} who got 0 correct answers`);
                    await this.deleteFailedAttempt(userId, guildId);
                }
            } else {
                // ✅ NEW: Testing mode message
                console.log(`[DAILY QUIZ] TESTING MODE: User ${userId} starting quiz (no database restrictions)`);
            }
            
            await interaction.deferReply();
            await this.ask(interaction, userId, guildId, member, 1, 0, 0);
            
        } catch (error) {
            console.error('[DAILY QUIZ] Execute error:', error);
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

    // Main question asking method (simplified version)
    async ask(interaction, userId, guildId, member, qNum, tier, rerollsUsed = 0, questionResults = []) {
        try {
            const difficulties = ['Easy', 'Easy', 'Medium', 'Medium', 'Medium', 'Medium', 'Hard', 'Hard', 'Hard', 'Hard'];
            const diff = difficulties[qNum - 1];
            const q = await fetchQuestion(diff);
            
            // Create simple embed for demo
            const embed = new EmbedBuilder()
                .setAuthor({ name: '🎌 ULTIMATE ANIME MASTERY CHALLENGE' })
                .setTitle(`${qNum}/10 • ${diff} Question`)
                .setColor([46, 204, 113])
                .setDescription(`**${q.question}**\n\nSelect your answer:`)
                .setFooter({ text: `Enhancement Intelligence • ${TESTING_MODE ? 'Testing Mode' : 'Live Mode'}` })
                .setTimestamp();

            // Create answer buttons
            const btns = q.options.map((opt, i) => new ButtonBuilder()
                .setCustomId(`q_${userId}_${qNum}_${i}_${opt === q.answer}`)
                .setLabel(opt.substring(0, 70))
                .setStyle(ButtonStyle.Primary)
                .setEmoji(['1️⃣', '2️⃣', '3️⃣', '4️⃣'][i]));

            const rows = [
                new ActionRowBuilder().addComponents(btns.slice(0, 2)),
                new ActionRowBuilder().addComponents(btns.slice(2, 4))
            ];

            await interaction.editReply({ embeds: [embed], components: rows });
            
            // Simple collector for demo
            const collector = interaction.channel.createMessageComponentCollector({ 
                time: 30000,
                filter: i => i.user.id === userId 
            });

            collector.on('collect', async (btn) => {
                await btn.deferUpdate();
                
                const [, , , , isCorrectStr] = btn.customId.split('_');
                const isCorrect = isCorrectStr === 'true';
                const newResults = [...questionResults, isCorrect];
                
                if (isCorrect) {
                    // Award flat XP for correct answer
                    const correctAnswerXP = parseInt(process.env.DAILY_QUIZ_CORRECT_ANSWER_XP) || 500;
                    if (global.xpTracker && correctAnswerXP > 0) {
                        try {
                            await global.xpTracker.awardXP(userId, guildId, correctAnswerXP, 'daily-quiz-correct', member.user, true);
                            console.log(`[DAILY QUIZ] Awarded ${correctAnswerXP} XP to ${member.displayName}`);
                        } catch (error) {
                            console.error(`[DAILY QUIZ] Error awarding XP:`, error);
                        }
                    }
                }
                
                if (qNum === 10) {
                    // Final question - calculate results
                    const totalSuccessful = newResults.filter(r => r === true).length;
                    
                    if (!TESTING_MODE && totalSuccessful > 0) {
                        await this.apply(userId, guildId, member, totalSuccessful);
                    }
                    
                    const tierName = TIER_NAMES[totalSuccessful] || 'No Enhancement';
                    const resultTitle = TESTING_MODE ? `🧪 TEST COMPLETE - ${tierName}` : `🎯 Challenge Complete - ${tierName}`;
                    
                    const finalEmbed = new EmbedBuilder()
                        .setTitle(resultTitle)
                        .setColor(totalSuccessful > 0 ? TIER_COLORS[totalSuccessful] : '#FF0000')
                        .setDescription(`**Correct Answers:** ${totalSuccessful}/10\n**Tier:** ${tierName}${TESTING_MODE ? '\n\n🧪 **TESTING MODE**: No roles or database changes made' : ''}`)
                        .setFooter({ text: TESTING_MODE ? '🧪 Testing Mode Active' : 'Challenge Complete' })
                        .setTimestamp();
                    
                    await btn.editReply({ embeds: [finalEmbed], components: [] });
                } else {
                    // Continue to next question
                    setTimeout(async () => {
                        await this.ask(interaction, userId, guildId, member, qNum + 1, tier, rerollsUsed, newResults);
                    }, 1000);
                }
                
                collector.stop();
            });

            collector.on('end', async (collected) => {
                if (collected.size === 0) {
                    console.log(`[DAILY QUIZ] Q${qNum} timed out`);
                    if (qNum < 10) {
                        // Continue with failed answer
                        const newResults = [...questionResults, false];
                        setTimeout(async () => {
                            await this.ask(interaction, userId, guildId, member, qNum + 1, tier, rerollsUsed, newResults);
                        }, 2000);
                    }
                }
            });
            
        } catch (error) {
            console.error('[DAILY QUIZ] Question error:', error);
        }
    },

    // Helper method to get tier emoji
    getTierEmoji(tier) {
        const tierEmojis = { 
            0: '⬛', 1: '⚪', 2: '🟢', 3: '🔵', 4: '🟣', 5: '🟡',
            6: '🟡', 7: '🟠', 8: '🟠', 9: '🔴', 10: '🔴'
        };
        return tierEmojis[tier] || '⬛';
    },

    // ✅ UPDATED: Use new table name "daily_quiz_attempts"
    async checkAttempt(userId, guildId) { 
        try { 
            const r = await global.xpTracker.db.query('SELECT tier FROM daily_quiz_attempts WHERE user_id = $1 AND guild_id = $2 AND date = $3', [userId, guildId, getDay()]); 
            if (r.rows.length > 0) {
                return { tier: r.rows[0].tier };
            }
            return null;
        } catch { 
            return null; 
        } 
    },

    async deleteFailedAttempt(userId, guildId) {
        try {
            await global.xpTracker.db.query('DELETE FROM daily_quiz_attempts WHERE user_id = $1 AND guild_id = $2 AND date = $3 AND tier = 0', [userId, guildId, getDay()]);
            console.log(`[DAILY QUIZ] Deleted failed attempt for user ${userId}`);
        } catch (error) {
            console.error('[DAILY QUIZ] Error deleting failed attempt:', error);
        }
    },

    async getBuff(userId, guildId, member) {
        try {
            const r = await global.xpTracker.db.query('SELECT tier FROM daily_quiz_attempts WHERE user_id = $1 AND guild_id = $2 AND date = $3', [userId, guildId, getDay()]);
            if (r.rows.length > 0) { 
                const t = r.rows[0].tier; 
                return { tier: t, name: t === 0 ? 'Challenge Failed' : TIER_NAMES[t], multiplier: t === 0 ? 'None' : 'Active' }; 
            }
            // Check for tier roles
            for (let i = 1; i <= 10; i++) { 
                const roleId = process.env[`DAILY_QUIZ_TIER_${i}_ROLE`]; 
                if (roleId && member.roles.cache.has(roleId)) return { tier: i, name: TIER_NAMES[i], multiplier: 'Active' }; 
            }
            return { tier: 0, name: 'No Enhancement', multiplier: 'None' };
        } catch { 
            return { tier: 0, name: 'Error', multiplier: 'None' }; 
        }
    },

    async apply(userId, guildId, member, tier) {
        try {
            if (TESTING_MODE) {
                console.log(`[DAILY QUIZ] TESTING MODE: Would apply tier ${tier} role to ${member.displayName} (skipped)`);
                await this.save(userId, guildId, tier);
                return;
            }

            // Remove all tier roles
            for (let i = 1; i <= 10; i++) { 
                const roleId = process.env[`DAILY_QUIZ_TIER_${i}_ROLE`]; 
                if (roleId && member.roles.cache.has(roleId)) { 
                    const role = member.guild.roles.cache.get(roleId); 
                    if (role) await member.roles.remove(role); 
                } 
            }

            if (tier > 0) { 
                const roleId = process.env[`DAILY_QUIZ_TIER_${tier}_ROLE`]; 
                if (roleId) { 
                    const role = member.guild.roles.cache.get(roleId); 
                    if (role) { 
                        await member.roles.add(role); 
                        console.log(`[DAILY QUIZ] ✅ Awarded ${role.name} to ${member.displayName}`); 
                    } 
                } 
            }
            await this.save(userId, guildId, tier);
        } catch (error) { 
            console.error('[DAILY QUIZ] Apply error:', error); 
        }
    },

    async save(userId, guildId, tier) {
        try {
            await global.xpTracker.db.query('CREATE TABLE IF NOT EXISTS daily_quiz_attempts (user_id VARCHAR(20), guild_id VARCHAR(20), date DATE, tier INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, guild_id, date))');
            
            if (TESTING_MODE) {
                console.log(`[DAILY QUIZ] TESTING MODE: Would save tier ${tier} to database (skipped)`);
                return;
            }
            
            await global.xpTracker.db.query('INSERT INTO daily_quiz_attempts (user_id, guild_id, date, tier) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, guild_id, date) DO UPDATE SET tier = $4', [userId, guildId, getDay(), tier]);
            console.log(`[DAILY QUIZ] ✅ Saved tier ${tier}`);
        } catch (error) { 
            console.error('[DAILY QUIZ] Save error:', error); 
        }
    }
};

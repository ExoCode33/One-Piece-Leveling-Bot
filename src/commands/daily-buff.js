// src/commands/daily-buff.js - FIXED VERSION - Removed duplicate if statement causing syntax error

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
                    console.log(`[QUESTION DEBUG] Q${difficulty}: "${question}" | Answer: "${answer}" | Options: [${options.join(', ')}]`);
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
    console.log(`[QUESTION DEBUG FALLBACK] Q${difficulty}: "${selectedQuestion.question}" | Answer: "${selectedQuestion.answer}" | Options: [${selectedQuestion.options.join(', ')}]`);
    return selectedQuestion;
}

function getDay() { return getCurrentDayKey(); }
function getReset() { return getNextResetUnixTimestamp(); }

module.exports = {
    data: new SlashCommandBuilder().setName('daily-buff').setDescription('🎌 Ultimate anime challenge! 10 questions, Divine mastery awaits!'),

    async execute(interaction) {
        try {
            const userId = interaction.user.id, guildId = interaction.guild.id, member = interaction.member;
            
            if (!global.xpTracker?.db) {
                return await interaction.reply({ 
                    content: '❌ System unavailable - XP tracker not initialized', 
                    ephemeral: true 
                });
            }

            // Check if user completed challenge (not just attempted)
            const existingRecord = await this.checkRoll(userId, guildId);
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
                console.log(`[DAILY BUFF] Allowing retry for user ${userId} who got 0 correct answers`);
                await this.deleteFailedAttempt(userId, guildId);
            }
            
            await interaction.deferReply();
            await this.ask(interaction, userId, guildId, member, 1, 0, 0);
            
        } catch (error) {
            console.error('[DAILY BUFF] Execute error:', error);
            const content = '❌ Error occurred. Please try again.';
            try {
                if (interaction.deferred) {
                    await interaction.editReply({ content });
                } else {
                    await interaction.reply({ content, ephemeral: true });
                }
            } catch (replyError) {
                console.error('[DAILY BUFF] Reply error:', replyError);
            }
        }
    },

    // Main question asking method
    async ask(interaction, userId, guildId, member, qNum, tier, rerollsUsed = 0) {
        try {
            // 10-question structure: 2 Easy, 4 Medium, 4 Hard
            const difficulties = ['Easy', 'Easy', 'Medium', 'Medium', 'Medium', 'Medium', 'Hard', 'Hard', 'Hard', 'Hard'];
            const diff = difficulties[qNum - 1];
            console.log(`[DAILY BUFF] Starting Question ${qNum}/10 - Difficulty: ${diff} - User: ${member.displayName}`);
            const q = await fetchQuestion(diff);
            console.log(`[DAILY BUFF] Question ${qNum} loaded: "${q.question}" | Correct: "${q.answer}"`);
            let time = 25;

            // Create embed function
            const makeEmbed = (timeRemaining) => {
                const diffEmoji = { 'Easy': '🟢', 'Medium': '🟡', 'Hard': '🔴' };
                
                // Create countdown bar
                const totalTime = 25;
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
                
                // 10-question progress bar
                const createProgressBar = () => {
                    const steps = [];
                    for (let i = 1; i <= 10; i++) {
                        if (i < qNum) {
                            steps.push('✅');
                        } else if (i === qNum) {
                            steps.push('🔄');
                        } else {
                            steps.push('⬜');
                        }
                    }
                    return steps.join(' ');
                };
                
                const progressSteps = createProgressBar();
                const mins = Math.floor(timeRemaining / 60);
                const secs = timeRemaining % 60;
                const timeText = `${mins}:${secs.toString().padStart(2, '0')}`;

                // Tier system display
                const currentTargetTier = qNum;
                const securedTier = qNum > 1 ? qNum - 1 : 0;

                return new EmbedBuilder()
                    .setAuthor({ name: '🎌 ULTIMATE ANIME MASTERY CHALLENGE' })
                    .setTitle(`${diffEmoji[diff]} Question ${qNum}/10 • ${diff}`)
                    .setColor(embedColor)
                    .setDescription(`## **${q.question}**\n\n**Challenge by:** ${member.displayName}\n\n*Select your answer using the buttons below*`)
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
                            name: '🎯 Tier Progression',
                            value: securedTier > 0 ? 
                                `**Secured:** ${this.getTierEmoji(securedTier)} ${TIER_NAMES[securedTier]}\n**Target:** ${this.getTierEmoji(currentTargetTier)} ${TIER_NAMES[currentTargetTier]}` : 
                                `**Target:** ${this.getTierEmoji(currentTargetTier)} ${TIER_NAMES[currentTargetTier]}\n*${TIER_DESC[currentTargetTier]}*`,
                            inline: false
                        },
                        {
                            name: '🎲 Rerolls Available',
                            value: `**${3 - rerollsUsed}/3** rerolls remaining`,
                            inline: true
                        }
                    )
                    .setFooter({ text: `Enhancement Intelligence • Difficulty: ${diff} • ${new Date().toLocaleTimeString()}` })
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
            
            // Add secure tier button if past question 1
            if (qNum > 1) {
                const securedTier = qNum - 1;
                actionButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`stop_${userId}_${qNum}`)
                        .setLabel(`🛡️ Secure ${TIER_NAMES[securedTier]} Buff`)
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🛡️')
                );
            }
            
            // Add reroll button
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
            const embed = makeEmbed(time);
            
            if (qNum === 1 && rerollsUsed === 0) { 
                await interaction.editReply({ embeds: [embed], components: rows }); 
                msg = await interaction.fetchReply(); 
            } else {
                msg = await interaction.followUp({ embeds: [embed], components: rows });
                
                // Delete previous embed when continuing
                if (qNum > 1) {
                    try {
                        const messages = await interaction.channel.messages.fetch({ limit: 10 });
                        const previousMessages = messages.filter(m => 
                            m.author.id === interaction.client.user.id && 
                            m.embeds.length > 0 && 
                            m.embeds[0].title && 
                            m.embeds[0].title.includes('Question') &&
                            m.embeds[0].title.includes(`${qNum - 1}/10`) &&
                            m.id !== msg.id
                        );
                        
                        for (const oldMsg of previousMessages.values()) {
                            await oldMsg.delete().catch(() => {});
                            break;
                        }
                    } catch (error) {
                        console.log('[CLEANUP] Could not delete previous embed:', error.message);
                    }
                }
            }

            // Timer updates
            const timer = setInterval(async () => {
                time -= 2;
                if (time <= 0) { clearInterval(timer); return; }
                try { 
                    await msg.edit({ embeds: [makeEmbed(time)], components: rows }).catch(() => clearInterval(timer)); 
                } catch { 
                    clearInterval(timer); 
                }
            }, 2000);

            const collector = msg.createMessageComponentCollector({ time: 25000, filter: i => i.user.id === userId });

            collector.on('collect', async (btn) => {
                try {
                    clearInterval(timer); 
                    await btn.deferUpdate();
                    
                    // Handle reroll button
                    if (btn.customId.startsWith('reroll_')) {
                        const [, , currentQNum, currentRerollsUsed] = btn.customId.split('_');
                        const rerollsUsedNum = parseInt(currentRerollsUsed);
                        
                        if (rerollsUsedNum >= 3) {
                            return;
                        }
                        
                        collector.stop();
                        await this.ask(interaction, userId, guildId, member, parseInt(currentQNum), tier, rerollsUsedNum + 1);
                        return;
                    }
                    
                    if (btn.customId.startsWith('stop_')) {
                        const securedTier = qNum - 1;
                        await this.apply(userId, guildId, member, securedTier);
                        
                        let xpMultiplier = 'Unknown';
                        try {
                            const roleId = process.env[`DAILY_XP_BUFF_TIER_${securedTier}_ROLE`];
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
                        collector.stop(); 
                        return;
                    }

                    const [, , , , isCorrectStr, currentRerollsUsed] = btn.customId.split('_');
                    const isCorrect = isCorrectStr === 'true';
                    const passedRerollsUsed = parseInt(currentRerollsUsed);
                    
                    // Log answer attempt
                    const selectedOption = q.options[parseInt(btn.customId.split('_')[3])];
                    console.log(`[DAILY BUFF] Q${qNum} Answer attempt by ${member.displayName}: Selected "${selectedOption}" | Correct: ${isCorrect} | Expected: "${q.answer}"`);
                    
                    // FIXED: Removed the duplicate if statement that was causing the syntax error
                    if (isCorrect) {
                        // ✅ NEW: Award XP for correct answer (single configurable amount for all difficulties)
                        const correctAnswerXP = parseInt(process.env.DAILY_BUFF_CORRECT_ANSWER_XP) || 100;
                        if (global.xpTracker && correctAnswerXP > 0) {
                            try {
                                await global.xpTracker.awardXP(userId, guildId, correctAnswerXP, 'daily-buff-correct', member.user);
                                console.log(`[DAILY BUFF] Q${qNum} CORRECT XP: Awarded ${correctAnswerXP} XP to ${member.displayName} for correct answer (${diff} difficulty)`);
                            } catch (error) {
                                console.error(`[DAILY BUFF] Error awarding XP for correct answer:`, error);
                            }
                        }
                        
                        if (qNum === 10) {
                            // Divine mastery completion
                            await this.apply(userId, guildId, member, 10);
                            
                            let xpMultiplier = 'Unknown';
                            try {
                                const roleId = process.env[`DAILY_XP_BUFF_TIER_10_ROLE`];
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
                                .setTitle('🔴 DIVINE PERFECTION ACHIEVED!')
                                .setColor(TIER_COLORS[10])
                                .setDescription(`**${TIER_NAMES[10]}** unlocked!\n*${TIER_DESC[10]}*\n\n🏆 **PERFECT MASTERY**\n**XP Multiplier:** ${xpMultiplier}`)
                                .addFields({ 
                                    name: '🎖️ Ultimate Achievement', 
                                    value: `Perfect Score: 10/10\n**Buff Received:** ${this.getTierEmoji(10)} ${TIER_NAMES[10]} (${xpMultiplier})\n**Challenge by:** ${member.displayName}\nNext: <t:${getReset()}:R>`, 
                                    inline: false 
                                })
                                .setFooter({ text: `${this.getTierEmoji(10)} ${TIER_NAMES[10]} ${xpMultiplier} Active • Divine Achievement` })
                                .setTimestamp();
                            await btn.editReply({ embeds: [res], components: [] });
                        } else {
                            const currentTier = qNum;
                            const cont = new EmbedBuilder()
                                .setTitle(`✅ Correct! ${TIER_NAMES[currentTier]} Achieved`)
                                .setColor([46, 204, 113])
                                .setDescription(`**${TIER_NAMES[currentTier]}** secured! Continue or claim current tier.`)
                                .addFields({ name: '🎯 Decision', value: `Next: Question ${qNum + 1}/10\nCurrent: ${TIER_NAMES[currentTier]}`, inline: false })
                                .setFooter({ text: 'Choose your path wisely' })
                                .setTimestamp();
                            
                            const contBtn = new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`cont_${userId}_${qNum + 1}_${passedRerollsUsed}`)
                                    .setLabel(`➡️ Continue to Question ${qNum + 1}`)
                                    .setStyle(ButtonStyle.Success)
                                    .setEmoji('⚡'),
                                new ButtonBuilder()
                                    .setCustomId(`claim_${userId}_${currentTier}`)
                                    .setLabel(`Secure ${TIER_NAMES[currentTier]} Buff`)
                                    .setStyle(ButtonStyle.Secondary)
                                    .setEmoji('🛡️')
                            );
                            
                            await btn.editReply({ embeds: [cont], components: [contBtn] });
                            
                            const contColl = btn.message.createMessageComponentCollector({ time: 30000, filter: i => i.user.id === userId });
                            contColl.on('collect', async (contBtn) => {
                                await contBtn.deferUpdate();
                                if (contBtn.customId.startsWith('cont_')) {
                                    const [, , nextQNum, passedRerollsUsed] = contBtn.customId.split('_');
                                    contColl.stop();
                                    
                                    try {
                                        await btn.message.delete();
                                    } catch (error) {
                                        console.log('[CLEANUP] Could not delete current message:', error.message);
                                    }
                                    
                                    await this.ask(interaction, userId, guildId, member, parseInt(nextQNum), currentTier, parseInt(passedRerollsUsed));
                                } else {
                                    const cTier = parseInt(contBtn.customId.split('_')[2]); 
                                    await this.apply(userId, guildId, member, cTier);
                                    
                                    let xpMultiplier = 'Unknown';
                                    try {
                                        const roleId = process.env[`DAILY_XP_BUFF_TIER_${cTier}_ROLE`];
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
                                        .setColor(TIER_COLORS[cTier])
                                        .setDescription(`**${TIER_NAMES[cTier]}** secured!\n*${TIER_DESC[cTier]}*\n**XP Multiplier:** ${xpMultiplier}`)
                                        .addFields({ 
                                            name: '📊 Results', 
                                            value: `Score: ${cTier}/10\n**Buff Received:** ${this.getTierEmoji(cTier)} ${TIER_NAMES[cTier]} (${xpMultiplier})\n**Challenge by:** ${member.displayName}\nNext: <t:${getReset()}:R>`, 
                                            inline: false 
                                        })
                                        .setFooter({ text: `${this.getTierEmoji(cTier)} ${TIER_NAMES[cTier]} ${xpMultiplier} Active` })
                                        .setTimestamp();
                                    await contBtn.editReply({ embeds: [claim], components: [] }); 
                                    contColl.stop();
                                }
                            });
                        }
                    } else {
                        // Show answer reveal for 20 seconds before proceeding
                        console.log(`[DAILY BUFF] Q${qNum} INCORRECT by ${member.displayName}: Selected "${selectedOption}" | Showing correct answer: "${q.answer}"`);
                        await this.showAnswerReveal(btn, q, qNum, member);
                        
                        // Wait 10 seconds before proceeding (reduced from 20)
                        setTimeout(async () => {
                            // Failure handling with tier 1 consolation prize
                            let fTier = Math.max(0, qNum - 1);
                            
                            // Failing on question 1 still gives tier 1 as consolation
                            if (qNum === 1) {
                                fTier = 1; // Give tier 1 even on first question failure
                            }
                            
                            if (fTier > 0) {
                                await this.apply(userId, guildId, member, fTier);
                                console.log(`[DAILY BUFF] Q${qNum} FAILURE RESULT: Applied tier ${fTier} for ${member.displayName}`);
                            } else {
                                await this.saveFail(userId, guildId);
                                console.log(`[DAILY BUFF] Q${qNum} COMPLETE FAILURE: No tier for ${member.displayName}`);
                            }
                            
                            const name = fTier > 0 ? TIER_NAMES[fTier] : 'No Enhancement';
                            const tierEmoji = this.getTierEmoji(fTier);
                            
                            let xpMultiplier = 'Unknown';
                            if (fTier > 0) {
                                try {
                                    const roleId = process.env[`DAILY_XP_BUFF_TIER_${fTier}_ROLE`];
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
                            
                            const res = new EmbedBuilder()
                                .setTitle(`❌ Challenge Failed - ${fTier > 0 ? (qNum === 1 ? 'Consolation Prize' : 'Previous Tier Applied') : 'No Enhancement'}`)
                                .setColor('#FF0000')
                                .setDescription(fTier > 0 ? 
                                    (qNum === 1 ? 
                                        `**${tierEmoji} ${name} Buff Applied** as consolation prize!\n\n*Even pirates who fail their first challenge deserve recognition*\n**XP Multiplier:** ${xpMultiplier}` :
                                        `**${tierEmoji} ${name} Buff Applied** from previous progress!\n\n*You earned this from reaching question ${qNum}*\n**XP Multiplier:** ${xpMultiplier}`) : 
                                    '**⬛ No Enhancement** earned. Try again tomorrow!')
                                .addFields({ 
                                    name: '📊 Final Results', 
                                    value: `**Score:** ${fTier}/10\n**Buff Received:** ${tierEmoji} ${name}${fTier > 0 ? ` (${xpMultiplier})` : ''}\n**Challenge by:** ${member.displayName}\n**Next Challenge:** <t:${getReset()}:R>`, 
                                    inline: false 
                                })
                                .setFooter({ text: fTier > 0 ? `${tierEmoji} ${name} ${xpMultiplier} Active Until Reset` : 'Challenge Failed - No Buff Awarded' })
                                .setTimestamp();
                                
                            try {
                                await btn.editReply({ embeds: [res], components: [] });
                            } catch (error) {
                                console.error('[DAILY BUFF] Error editing reply after answer reveal:', error);
                            }
                        }, 10000); // 10 second delay (reduced from 20)
                    }
                    collector.stop();
                } catch (error) { 
                    console.error('[QUIZ] Button error:', error); 
                    clearInterval(timer); 
                }
            });

            collector.on('end', async (collected) => {
                clearInterval(timer);
                if (collected.size === 0) {
                    let fTier = Math.max(0, qNum - 1);
                    
                    // Timeout on question 1 still gives tier 1
                    if (qNum === 1) {
                        fTier = 1;
                    }
                    
                    if (fTier > 0) await this.apply(userId, guildId, member, fTier); else await this.saveFail(userId, guildId);
                    const timeout = new EmbedBuilder()
                        .setColor([231, 76, 60])
                        .setTitle('⏰ Time\'s Up!')
                        .setDescription(fTier > 0 ? 
                            (qNum === 1 ? 
                                `Consolation prize (**${TIER_NAMES[fTier]}**) applied for attempting the challenge.` :
                                `Previous tier (**${TIER_NAMES[fTier]}**) applied.`) : 
                            'No enhancement earned.')
                        .addFields({ name: '💡 Next Attempt', value: `<t:${getReset()}:R>`, inline: false })
                        .setFooter({ text: 'Enhancement Intelligence' })
                        .setTimestamp();
                    await msg.edit({ embeds: [timeout], components: [] }).catch(console.error);
                }
            });
        } catch (error) { 
            console.error('[QUIZ] Question error:', error); 
        }
    },

    // Show answer reveal with 10-second countdown
    async showAnswerReveal(btnInteraction, question, questionNum, member) {
        try {
            console.log(`[ANSWER REVEAL] Showing correct answer for Q${questionNum}: "${question.answer}" to ${member.displayName}`);
            
            // Get the user's wrong answer from the button interaction
            const selectedOption = question.options[parseInt(btnInteraction.customId.split('_')[3])];
            
            const revealEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(`❌ Wrong Answer - Question ${questionNum}/10`)
                .setDescription(`**Your Answer:** ${selectedOption}\n**Question:** ${question.question}\n**Correct Answer:** 🎯 ${question.answer}`)
                .addFields({
                    name: '⏳ Processing Results',
                    value: 'Results in **10** seconds...',
                    inline: false
                })
                .setFooter({ text: 'Answer revealed • Processing...' })
                .setTimestamp();

            await btnInteraction.editReply({ embeds: [revealEmbed], components: [] });
            
            // Start 10-second countdown
            for (let i = 9; i >= 1; i--) {
                setTimeout(async () => {
                    try {
                        const countdownEmbed = new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle(`❌ Wrong Answer - Question ${questionNum}/10`)
                            .setDescription(`**Your Answer:** ${selectedOption}\n**Question:** ${question.question}\n**Correct Answer:** 🎯 ${question.answer}`)
                            .addFields({
                                name: '⏳ Processing Results',
                                value: `Results in **${i}** second${i !== 1 ? 's' : ''}...`,
                                inline: false
                            })
                            .setFooter({ text: 'Answer revealed • Processing...' })
                            .setTimestamp();
                        
                        await btnInteraction.editReply({ embeds: [countdownEmbed], components: [] });
                    } catch (error) {
                        console.error(`[ANSWER REVEAL] Error updating countdown ${i}:`, error);
                    }
                }, (10 - i) * 1000);
            }
        } catch (error) {
            console.error('[ANSWER REVEAL] Error showing answer:', error);
        }
    },

    // Helper method to get tier emoji with correct colors
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

    // Check roll but return the record details
    async checkRoll(userId, guildId) { 
        try { 
            const r = await global.xpTracker.db.query('SELECT tier FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3', [userId, guildId, getDay()]); 
            if (r.rows.length > 0) {
                return { tier: r.rows[0].tier };
            }
            return null;
        } catch { 
            return null; 
        } 
    },

    // Delete failed attempt to allow retry
    async deleteFailedAttempt(userId, guildId) {
        try {
            await global.xpTracker.db.query('DELETE FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3 AND tier = 0', [userId, guildId, getDay()]);
            console.log(`[DAILY BUFF] Deleted failed attempt for user ${userId} to allow retry`);
        } catch (error) {
            console.error('[DAILY BUFF] Error deleting failed attempt:', error);
        }
    },

    async getBuff(userId, guildId, member) {
        try {
            const r = await global.xpTracker.db.query('SELECT tier FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3', [userId, guildId, getDay()]);
            if (r.rows.length > 0) { 
                const t = r.rows[0].tier; 
                return { tier: t, name: t === 0 ? 'Challenge Failed' : TIER_NAMES[t], multiplier: t === 0 ? 'None' : 'Active' }; 
            }
            // Check for all 10 tiers
            for (let i = 1; i <= 10; i++) { 
                const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`]; 
                if (roleId && member.roles.cache.has(roleId)) return { tier: i, name: TIER_NAMES[i], multiplier: 'Active' }; 
            }
            return { tier: 0, name: 'No Enhancement', multiplier: 'None' };
        } catch { 
            return { tier: 0, name: 'Error', multiplier: 'None' }; 
        }
    },

    async apply(userId, guildId, member, tier) {
        try {
            // Remove all tier roles including tier 10
            for (let i = 1; i <= 10; i++) { 
                const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`]; 
                if (roleId && member.roles.cache.has(roleId)) { 
                    const role = member.guild.roles.cache.get(roleId); 
                    if (role) await member.roles.remove(role); 
                } 
            }
            if (tier > 0) { 
                const roleId = process.env[`DAILY_XP_BUFF_TIER_${tier}_ROLE`]; 
                if (roleId) { 
                    const role = member.guild.roles.cache.get(roleId); 
                    if (role) { 
                        await member.roles.add(role); 
                        console.log(`[DAILY BUFF] ✅ Awarded ${role.name}`); 
                    } 
                } 
            }
            await this.save(userId, guildId, tier);
        } catch (error) { 
            console.error('[DAILY BUFF] Apply error:', error); 
        }
    },

    async save(userId, guildId, tier) {
        try {
            await global.xpTracker.db.query('CREATE TABLE IF NOT EXISTS daily_buff_rolls (user_id VARCHAR(20), guild_id VARCHAR(20), date DATE, tier INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, guild_id, date))');
            await global.xpTracker.db.query('INSERT INTO daily_buff_rolls (user_id, guild_id, date, tier) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, guild_id, date) DO UPDATE SET tier = $4', [userId, guildId, getDay(), tier]);
            console.log(`[DAILY BUFF] ✅ Saved tier ${tier}`);
        } catch (error) { 
            console.error('[DAILY BUFF] Save error:', error); 
        }
    },

    async saveFail(userId, guildId) {
        try {
            await global.xpTracker.db.query('INSERT INTO daily_buff_rolls (user_id, guild_id, date, tier, created_at) VALUES ($1, $2, $3, 0, CURRENT_TIMESTAMP) ON CONFLICT (user_id, guild_id, date) DO UPDATE SET tier = 0', [userId, guildId, getDay()]);
            console.log('[DAILY BUFF] ❌ Saved failed attempt');
        } catch (error) { 
            console.error('[DAILY BUFF] Save failed error:', error); 
        }
    },

    // Export functions for admin command use
    checkDailyBuffStatus: async function(userId, guildId) {
        try {
            const currentDay = getCurrentDayKey();
            
            const dbResult = await global.xpTracker.db.query(
                'SELECT * FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [userId, guildId, currentDay]
            );
            const hasDBRecord = dbResult.rows.length > 0;

            const guild = global.xpTracker.client.guilds.cache.get(guildId);
            const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
            const currentRoles = [];

            if (member) {
                // Check for all 10 tiers
                for (let i = 1; i <= 10; i++) {
                    const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`];
                    if (roleId && roleId !== `role_id_${i}` && member.roles.cache.has(roleId)) {
                        const role = guild.roles.cache.get(roleId);
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
                hasDBRecord,
                currentRoles,
                currentDay,
                member
            };
        } catch (error) {
            console.error('[DAILY BUFF] Error checking status:', error);
            return {
                hasDBRecord: false,
                currentRoles: [],
                currentDay: getCurrentDayKey(),
                member: null
            };
        }
    },

    forceRemoveDailyBuff: async function(userId, guildId, reason) {
        try {
            const currentDay = getCurrentDayKey();
            const removedRoles = [];
            let dbRecordsRemoved = 0;

            const guild = global.xpTracker.client.guilds.cache.get(guildId);
            const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;

            if (member) {
                // Remove all 10 tier roles
                for (let i = 1; i <= 10; i++) {
                    const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`];
                    if (roleId && roleId !== `role_id_${i}` && member.roles.cache.has(roleId)) {
                        const role = guild.roles.cache.get(roleId);
                        if (role) {
                            try {
                                await member.roles.remove(role, reason);
                                removedRoles.push(`Tier ${i}: ${role.name}`);
                                console.log(`[DAILY BUFF] Removed ${role.name} from ${member.user.username}`);
                            } catch (error) {
                                console.error(`[DAILY BUFF] Error removing role ${role.name}:`, error);
                            }
                        }
                    }
                }
            }

            try {
                const deleteResult = await global.xpTracker.db.query(
                    'DELETE FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2',
                    [userId, guildId]
                );
                dbRecordsRemoved = deleteResult.rowCount || 0;
                console.log(`[DAILY BUFF] Deleted ${dbRecordsRemoved} daily buff records`);
            } catch (error) {
                console.error('[DAILY BUFF] Error deleting database records:', error);
            }

            return {
                success: true,
                removedRoles,
                dbRecordsRemoved,
                currentDay
            };

        } catch (error) {
            console.error('[DAILY BUFF] Error in forceRemoveDailyBuff:', error);
            return {
                success: false,
                error: error.message,
                removedRoles: [],
                dbRecordsRemoved: 0,
                currentDay: getCurrentDayKey()
            };
        }
    }
};

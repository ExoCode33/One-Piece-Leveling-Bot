// src/commands/daily-buff.js - Updated with Better Questions and Reroll Feature

// Remove StringSelectMenuBuilder import since we're not using dropdown anymore
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const TIER_COLORS = { 1: [76, 175, 80], 2: [33, 150, 243], 3: [156, 39, 176], 4: [255, 193, 7], 5: [255, 87, 34] };
const TIER_NAMES = { 1: 'Common', 2: 'Rare', 3: 'Epic', 4: 'Legendary', 5: 'Divine' };
const TIER_DESC = { 1: '⚓ Common boost', 2: '🔱 Rare power', 3: '🎖️ Epic ability', 4: '⭐ Legendary mastery', 5: '💎 Divine transcendence' };

// Enhanced fallback questions focused on anime lore
const FALLBACK = {
    'Easy': [
        { question: "Who is the main protagonist of One Piece?", options: ["Monkey D. Luffy", "Roronoa Zoro", "Nami", "Sanji"], answer: "Monkey D. Luffy" },
        { question: "What is Luffy's Devil Fruit called?", options: ["Gomu Gomu no Mi", "Mera Mera no Mi", "Hito Hito no Mi", "Yami Yami no Mi"], answer: "Gomu Gomu no Mi" },
        { question: "What is the name of Luffy's pirate crew?", options: ["Straw Hat Pirates", "Red Hair Pirates", "Whitebeard Pirates", "Heart Pirates"], answer: "Straw Hat Pirates" },
        { question: "In Naruto, what village is Naruto from?", options: ["Hidden Leaf Village", "Hidden Sand Village", "Hidden Mist Village", "Hidden Cloud Village"], answer: "Hidden Leaf Village" }
    ],
    'Medium': [
        { question: "What is the name of the sea where most of One Piece takes place?", options: ["Grand Line", "East Blue", "West Blue", "Red Line"], answer: "Grand Line" },
        { question: "In Attack on Titan, what is Eren's Titan form called?", options: ["Attack Titan", "Colossal Titan", "Female Titan", "Beast Titan"], answer: "Attack Titan" },
        { question: "Who is known as 'Humanity's Strongest Soldier' in Attack on Titan?", options: ["Levi Ackerman", "Erwin Smith", "Mikasa Ackerman", "Eren Yeager"], answer: "Levi Ackerman" },
        { question: "In One Piece, what is the ultimate treasure called?", options: ["One Piece", "All Blue", "Void Century", "Poneglyph"], answer: "One Piece" }
    ],
    'Hard': [
        { question: "In One Piece, where do the Straw Hats first meet Brook?", options: ["Thriller Bark", "Sabaody Archipelago", "Water 7", "Enies Lobby"], answer: "Thriller Bark" },
        { question: "What is Roy Mustang's title in Fullmetal Alchemist?", options: ["Flame Alchemist", "Steel Alchemist", "State Alchemist", "Fire Colonel"], answer: "Flame Alchemist" },
        { question: "In One Piece, what is the name of the island where the World Government is located?", options: ["Mariejois", "Enies Lobby", "Impel Down", "Marineford"], answer: "Mariejois" },
        { question: "What is the name of the technique Luffy learns during the timeskip?", options: ["Haki", "Rokushiki", "Fishman Karate", "Electro"], answer: "Haki" }
    ]
};

// ✅ TIMEZONE HELPERS
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

// ✅ ENHANCED: Fetch question with better filtering for anime lore
async function fetchQuestion(difficulty) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        // Try multiple API endpoints for better question variety
        const apiUrls = [
            'https://opentdb.com/api.php?amount=1&category=31&type=multiple', // Anime & Manga from OpenTDB
            'https://aniquizapi.vercel.app/api/quiz', // Anime Quiz API
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
                    
                    // Handle OpenTDB format
                    if (data.results && data.results.length > 0) {
                        const result = data.results[0];
                        question = result.question;
                        answer = result.correct_answer;
                        options = [...result.incorrect_answers, result.correct_answer].sort(() => Math.random() - 0.5);
                        
                        // Filter out voice actor questions and other non-lore questions
                        const badKeywords = ['voice actor', 'voiced by', 'seiyuu', 'dub', 'english dub', 'studio', 'director', 'composer'];
                        if (badKeywords.some(keyword => question.toLowerCase().includes(keyword))) {
                            console.log('[API] Skipping voice actor/production question');
                            continue;
                        }
                    }
                    // Handle AniQuiz format
                    else if (data.data?.question || data.question) {
                        const questionData = data.data || data;
                        question = questionData.question;
                        options = Array.isArray(questionData.options) ? questionData.options : [];
                        answer = questionData.correct;
                        
                        // Filter out voice actor questions
                        const badKeywords = ['voice actor', 'voiced by', 'seiyuu', 'dub', 'english dub', 'studio', 'director', 'composer'];
                        if (badKeywords.some(keyword => question.toLowerCase().includes(keyword))) {
                            console.log('[API] Skipping voice actor/production question');
                            continue;
                        }
                    } else {
                        continue;
                    }
                    
                    // Clean and validate the question
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
                    
                    // Ensure answer is in options
                    if (!options.includes(answer)) {
                        const match = options.find(opt => opt.toLowerCase() === answer.toLowerCase());
                        if (match) answer = match;
                        else if (options.length >= 4) options[3] = answer;
                        else options.push(answer);
                    }
                    
                    // Limit to 4 options max
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
    
    // Enhanced fallback with better questions
    console.log(`[API] 🛡️ Using enhanced fallback ${difficulty} question`);
    const fallbacks = FALLBACK[difficulty] || FALLBACK['Medium'];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

function getDay() { return getCurrentDayKey(); }
function getReset() { return getNextResetUnixTimestamp(); }

module.exports = {
    data: new SlashCommandBuilder().setName('daily-buff').setDescription('🎌 Progressive anime challenge! 5 questions, increasing difficulty!'),

    async execute(interaction) {
        try {
            const userId = interaction.user.id, guildId = interaction.guild.id, member = interaction.member;
            if (!global.xpTracker?.db) return await interaction.reply({ content: '❌ System unavailable', ephemeral: true });

            if (await this.checkRoll(userId, guildId)) {
                const buff = await this.getBuff(userId, guildId, member);
                const embed = new EmbedBuilder().setColor('#FF6B6B').setAuthor({ name: '🎌 PROGRESSIVE ANIME MASTERY CHALLENGE' })
                    .setTitle('Daily Challenge Already Completed').setDescription(`Current Enhancement: ${buff.name}\nNext: <t:${getReset()}:R>`)
                    .setFooter({ text: 'Enhancement Intelligence • Progressive System' }).setTimestamp();
                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }
            await interaction.deferReply();
            await this.ask(interaction, userId, guildId, member, 1, 0, false); // Added rerollUsed parameter
        } catch (error) {
            console.error('[DAILY BUFF] Error:', error);
            const content = '❌ Error occurred. Try again.';
            if (interaction.deferred) await interaction.editReply({ content }); else await interaction.reply({ content, ephemeral: true });
        }
    },

    // ✅ ENHANCED: Ask method with reroll functionality
    async ask(interaction, userId, guildId, member, qNum, tier, rerollUsed = false) {
        try {
            const diffs = ['Easy', 'Medium', 'Medium', 'Hard', 'Hard'], diff = diffs[qNum - 1];
            const q = await fetchQuestion(diff);
            let time = 20;

            // ✅ ENHANCED: Create RGB changing embed with reroll button
            const makeEmbed = (t) => {
                const diffEmoji = { 'Easy': '🟢', 'Medium': '🟡', 'Hard': '🔴' };
                
                // Create 10 square countdown
                const totalTime = 20;
                const totalSquares = 10;
                const timePerSquare = totalTime / totalSquares;
                const remainingSquares = Math.ceil(t / timePerSquare);
                const filledSquares = Math.max(0, Math.min(totalSquares, remainingSquares));
                
                // RGB Color progression
                const percentageRemaining = (t / totalTime) * 100;
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
                
                // Challenge progress
                const createProgressBar = () => {
                    const steps = [];
                    for (let i = 1; i <= 5; i++) {
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
                const mins = Math.floor(t / 60);
                const secs = t % 60;
                const timeText = `${mins}:${secs.toString().padStart(2, '0')}`;

                return new EmbedBuilder()
                    .setAuthor({ name: '🎌 PROGRESSIVE ANIME MASTERY CHALLENGE' })
                    .setTitle(`${diffEmoji[diff]} Question ${qNum}/5 • ${diff}`)
                    .setColor(embedColor)
                    .setDescription(`## **${q.question}**\n\n**Challenge by:** ${member.displayName}\n\n*Select your answer using the buttons below*`)
                    .addFields(
                        {
                            name: '📊 Challenge Progress',
                            value: progressSteps,
                            inline: false
                        },
                        {
                            name: '⏰ Time Remaining',
                            value: `**${timeText}** (${t} seconds)\n${countdownBar}`,
                            inline: false
                        },
                        {
                            name: '🎯 Current Target',
                            value: qNum > 1 ? 
                                `**Secured:** ${TIER_NAMES[qNum - 1]}\n**Next:** ${TIER_NAMES[qNum]}` : 
                                `**Target:** ${TIER_NAMES[qNum]}\n*${TIER_DESC[qNum]}*`,
                            inline: false
                        }
                    )
                    .setFooter({ text: `Enhancement Intelligence • Difficulty: ${diff} • ${new Date().toLocaleTimeString()}` })
                    .setTimestamp();
            };

            // ✅ REVERTED: Create answer buttons (green)
            const btns = q.options.map((opt, i) => new ButtonBuilder()
                .setCustomId(`q_${userId}_${qNum}_${i}_${opt === q.answer}_${rerollUsed}`)
                .setLabel(opt.substring(0, 70))
                .setStyle(ButtonStyle.Success) // Green buttons
                .setEmoji(['🅰️', '🅱️', '🅾️', '🆎'][i]));

            // ✅ ENHANCED: Create action buttons (green, below answers)
            const actionButtons = [];
            
            // Add secure tier button if past question 1
            if (qNum > 1) {
                actionButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`stop_${userId}_${qNum}`)
                        .setLabel(`🛡️ Secure ${TIER_NAMES[qNum - 1]} Buff`)
                        .setStyle(ButtonStyle.Success) // Green
                        .setEmoji('🛡️')
                );
            }
            
            // Add reroll button
            actionButtons.push(
                new ButtonBuilder()
                    .setCustomId(`reroll_${userId}_${qNum}_${rerollUsed}`)
                    .setLabel(rerollUsed ? '🎲 Reroll Used' : '🎲 Reroll Question')
                    .setStyle(ButtonStyle.Success) // Green
                    .setEmoji('🎲')
                    .setDisabled(rerollUsed)
            );

            // ✅ ENHANCED: Button layout - answers first, then actions
            const rows = [
                new ActionRowBuilder().addComponents(btns.slice(0, 2)), // First row: A, B
                new ActionRowBuilder().addComponents(btns.slice(2, 4))  // Second row: C, D
            ];
            
            // Add action buttons as separate row if they exist
            if (actionButtons.length > 0) {
                rows.push(new ActionRowBuilder().addComponents(actionButtons));
            }

            let msg; const embed = makeEmbed(time);
            if (qNum === 1 && !rerollUsed) { 
                await interaction.editReply({ embeds: [embed], components: rows }); 
                msg = await interaction.fetchReply(); 
            } else {
                msg = await interaction.followUp({ embeds: [embed], components: rows });
                
                // ✅ NEW: Delete previous embed when continuing to next question
                if (qNum > 1) {
                    try {
                        // Find and delete the previous question message
                        const messages = await interaction.channel.messages.fetch({ limit: 10 });
                        const previousMessages = messages.filter(m => 
                            m.author.id === interaction.client.user.id && 
                            m.embeds.length > 0 && 
                            m.embeds[0].title && 
                            m.embeds[0].title.includes('Question') &&
                            m.embeds[0].title.includes(`${qNum - 1}/5`) &&
                            m.id !== msg.id
                        );
                        
                        for (const oldMsg of previousMessages.values()) {
                            await oldMsg.delete().catch(() => {});
                            break; // Only delete the most recent previous question
                        }
                    } catch (error) {
                        console.log('[CLEANUP] Could not delete previous embed:', error.message);
                    }
                }
            }

            // Timer updates every 2 seconds
            const timer = setInterval(async () => {
                time -= 2;
                if (time <= 0) { clearInterval(timer); return; }
                try { 
                    await msg.edit({ embeds: [makeEmbed(time)], components: rows }).catch(() => clearInterval(timer)); 
                } catch { 
                    clearInterval(timer); 
                }
            }, 2000);

            const collector = msg.createMessageComponentCollector({ time: 20000, filter: i => i.user.id === userId });

            collector.on('collect', async (btn) => {
                try {
                    clearInterval(timer); 
                    await btn.deferUpdate();
                    
                    // ✅ NEW: Handle reroll button
                    if (btn.customId.startsWith('reroll_')) {
                        const [, , currentQNum, currentRerollUsed] = btn.customId.split('_');
                        
                        if (currentRerollUsed === 'true') {
                            return; // Already used, shouldn't happen due to disabled state
                        }
                        
                        collector.stop();
                        // Restart the question with reroll marked as used
                        await this.ask(interaction, userId, guildId, member, parseInt(currentQNum), tier, true);
                        return;
                    }
                    
                    if (btn.customId.startsWith('stop_')) {
                        const fTier = qNum - 1; 
                        await this.apply(userId, guildId, member, fTier);
                        
                        // ✅ NEW: Get XP multiplier for secured tier
                        let xpMultiplier = 'Unknown';
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
                        
                        const res = new EmbedBuilder().setTitle('Strategic Withdrawal - Tier Secured!').setColor(TIER_COLORS[fTier])
                            .setDescription(`**${TIER_NAMES[fTier]}** secured!\n*${TIER_DESC[fTier]}*\n**XP Multiplier:** ${xpMultiplier}`)
                            .addFields({ 
                                name: '📊 Results', 
                                value: `Score: ${fTier}/5\n**Buff Received:** ${this.getTierEmoji(fTier)} ${TIER_NAMES[fTier]} (${xpMultiplier})\n**Challenge by:** ${member.displayName}\nNext: <t:${getReset()}:R>`, 
                                inline: false 
                            })
                            .setFooter({ text: `${this.getTierEmoji(fTier)} ${TIER_NAMES[fTier]} ${xpMultiplier} Active` }).setTimestamp();
                        await btn.editReply({ embeds: [res], components: [] });
                        await btn.editReply({ embeds: [res], components: [] }); 
                        collector.stop(); 
                        return;
                    }

                    const [, , , , isCorrectStr, rerollUsedStr] = btn.customId.split('_');
                    const isCorrect = isCorrectStr === 'true';
                    const currentRerollUsed = rerollUsedStr === 'true';
                    
                    if (isCorrect) {
                        if (qNum === 5) {
                            await this.apply(userId, guildId, member, 5);
                            
                            // ✅ NEW: Get XP multiplier for Divine tier
                            let xpMultiplier = 'Unknown';
                            try {
                                const roleId = process.env[`DAILY_XP_BUFF_TIER_5_ROLE`];
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
                            
                            const res = new EmbedBuilder().setTitle('💎 DIVINE MASTERY ACHIEVED!').setColor(TIER_COLORS[5])
                                .setDescription(`**${TIER_NAMES[5]}** unlocked!\n*${TIER_DESC[5]}*\n\n🏆 **FLAWLESS VICTORY**\n**XP Multiplier:** ${xpMultiplier}`)
                                .addFields({ 
                                    name: '🎖️ Achievement', 
                                    value: `Perfect Score: 5/5\n**Buff Received:** 🟧 ${TIER_NAMES[5]} (${xpMultiplier})\n**Challenge by:** ${member.displayName}\nNext: <t:${getReset()}:R>`, 
                                    inline: false 
                                })
                                .setFooter({ text: `🟧 ${TIER_NAMES[5]} ${xpMultiplier} Active • Divine Achievement` }).setTimestamp();
                            await btn.editReply({ embeds: [res], components: [] });
                        } else {
                            const cont = new EmbedBuilder().setTitle(`✅ Correct! Tier ${qNum} Achieved`).setColor([46, 204, 113])
                                .setDescription(`**${TIER_NAMES[qNum]}** secured! Continue or claim current tier.`)
                                .addFields({ name: '🎯 Decision', value: `Next: Question ${qNum + 1}/5\nCurrent: ${TIER_NAMES[qNum]}`, inline: false })
                                .setFooter({ text: 'Choose your path wisely' }).setTimestamp();
                            
                            const contBtn = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId(`cont_${userId}_${qNum + 1}_${currentRerollUsed}`).setLabel(`➡️ Continue to Question ${qNum + 1}`).setStyle(ButtonStyle.Success).setEmoji('⚡'),
                                new ButtonBuilder().setCustomId(`claim_${userId}_${qNum}`).setLabel(`Secure ${TIER_NAMES[qNum]} Buff`).setStyle(ButtonStyle.Secondary).setEmoji('🛡️')
                            );
                            
                            await btn.editReply({ embeds: [cont], components: [contBtn] });
                            
                            const contColl = btn.message.createMessageComponentCollector({ time: 30000, filter: i => i.user.id === userId });
                            contColl.on('collect', async (contBtn) => {
                                await contBtn.deferUpdate();
                                if (contBtn.customId.startsWith('cont_')) {
                                    const [, , nextQNum, passedRerollUsed] = contBtn.customId.split('_');
                                    contColl.stop();
                                    
                                    // ✅ NEW: Delete the current message before continuing
                                    try {
                                        await btn.message.delete();
                                    } catch (error) {
                                        console.log('[CLEANUP] Could not delete current message:', error.message);
                                    }
                                    
                                    await this.ask(interaction, userId, guildId, member, parseInt(nextQNum), qNum, passedRerollUsed === 'true');
                                } else {
                                    const cTier = parseInt(contBtn.customId.split('_')[2]); 
                                    await this.apply(userId, guildId, member, cTier);
                                    
                                    // ✅ NEW: Get XP multiplier for claimed tier
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
                                    
                                    const claim = new EmbedBuilder().setTitle('Strategic Withdrawal - Tier Secured!').setColor(TIER_COLORS[cTier])
                                        .setDescription(`**${TIER_NAMES[cTier]}** secured!\n*${TIER_DESC[cTier]}*\n**XP Multiplier:** ${xpMultiplier}`)
                                        .addFields({ 
                                            name: '📊 Results', 
                                            value: `Score: ${cTier}/5\n**Buff Received:** ${this.getTierEmoji(cTier)} ${TIER_NAMES[cTier]} (${xpMultiplier})\n**Challenge by:** ${member.displayName}\nNext: <t:${getReset()}:R>`, 
                                            inline: false 
                                        })
                                        .setFooter({ text: `${this.getTierEmoji(cTier)} ${TIER_NAMES[cTier]} ${xpMultiplier} Active` }).setTimestamp();
                                    await contBtn.editReply({ embeds: [claim], components: [] }); 
                                    contColl.stop();
                                }
                            });
                        }
                    } else {
                        const fTier = Math.max(0, qNum - 1);
                        if (fTier > 0) await this.apply(userId, guildId, member, fTier); else await this.saveFail(userId, guildId);
                        
                        // ✅ ENHANCED: Make failure more obvious with tier emoji and XP multiplier info
                        const name = fTier > 0 ? TIER_NAMES[fTier] : 'No Enhancement';
                        const tierEmoji = this.getTierEmoji(fTier);
                        
                        // ✅ NEW: Get XP multiplier from database
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
                            .setTitle(`❌ Challenge Failed - ${fTier > 0 ? 'Previous Tier Applied' : 'No Enhancement'}`)
                            .setColor('#FF0000')
                            .setDescription(fTier > 0 ? 
                                `**${tierEmoji} ${name} Buff Applied** from previous progress!\n\n*You earned this from reaching question ${fTier + 1}*\n**XP Multiplier:** ${xpMultiplier}` : 
                                '**⬛ No Enhancement** earned. Try again tomorrow!')
                            .addFields({ 
                                name: '📊 Final Results', 
                                value: `**Score:** ${fTier}/5\n**Buff Received:** ${tierEmoji} ${name}${fTier > 0 ? ` (${xpMultiplier})` : ''}\n**Challenge by:** ${member.displayName}\n**Next Challenge:** <t:${getReset()}:R>`, 
                                inline: false 
                            })
                            .setFooter({ text: fTier > 0 ? `${tierEmoji} ${name} ${xpMultiplier} Active Until Reset` : 'Challenge Failed - No Buff Awarded' })
                            .setTimestamp();
                        await btn.editReply({ embeds: [res], components: [] });
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
                    const fTier = Math.max(0, tier);
                    if (fTier > 0) await this.apply(userId, guildId, member, fTier); else await this.saveFail(userId, guildId);
                    const timeout = new EmbedBuilder().setColor([231, 76, 60]).setTitle('⏰ Time\'s Up!')
                        .setDescription(fTier > 0 ? `Previous tier (**${TIER_NAMES[fTier]}**) applied.` : 'No enhancement earned.')
                        .addFields({ name: '💡 Next Attempt', value: `<t:${getReset()}:R>`, inline: false })
                        .setFooter({ text: 'Enhancement Intelligence' }).setTimestamp();
                    await msg.edit({ embeds: [timeout], components: [] }).catch(console.error);
                }
            });
        } catch (error) { 
            console.error('[QUIZ] Question error:', error); 
        }
    },

    // ✅ NEW: Helper method to get tier emoji (fixes scope issue)
    getTierEmoji(tier) {
        const tierEmojis = { 0: '⬛', 1: '🟩', 2: '🟦', 3: '🟪', 4: '🟨', 5: '🟧' };
        return tierEmojis[tier] || '⬛';
    },

    // Keep all existing helper methods
    async checkRoll(userId, guildId) { 
        try { 
            const r = await global.xpTracker.db.query('SELECT * FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3', [userId, guildId, getDay()]); 
            return r.rows.length > 0; 
        } catch { 
            return false; 
        } 
    },

    async getBuff(userId, guildId, member) {
        try {
            const r = await global.xpTracker.db.query('SELECT tier FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3', [userId, guildId, getDay()]);
            if (r.rows.length > 0) { 
                const t = r.rows[0].tier; 
                return { tier: t, name: t === 0 ? 'Challenge Failed' : TIER_NAMES[t], multiplier: t === 0 ? 'None' : 'Active' }; 
            }
            for (let i = 1; i <= 5; i++) { 
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
            for (let i = 1; i <= 5; i++) { 
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

    // ✅ NEW: Export functions for admin command use
    checkDailyBuffStatus: async function(userId, guildId) {
        try {
            const currentDay = getCurrentDayKey();
            
            // Check database record
            const dbResult = await global.xpTracker.db.query(
                'SELECT * FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [userId, guildId, currentDay]
            );
            const hasDBRecord = dbResult.rows.length > 0;

            // Check current roles
            const guild = global.xpTracker.client.guilds.cache.get(guildId);
            const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
            const currentRoles = [];

            if (member) {
                for (let i = 1; i <= 6; i++) {
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

            // Get guild and member
            const guild = global.xpTracker.client.guilds.cache.get(guildId);
            const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;

            // Remove all buff roles
            if (member) {
                for (let i = 1; i <= 6; i++) {
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

            // Remove database records
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

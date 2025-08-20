// src/commands/daily-buff.js - API Enabled Compact Version

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const TIER_COLORS = { 1: [76, 175, 80], 2: [33, 150, 243], 3: [156, 39, 176], 4: [255, 193, 7], 5: [255, 87, 34] };
const TIER_NAMES = { 1: 'Common', 2: 'Rare', 3: 'Epic', 4: 'Legendary', 5: 'Divine' };
const TIER_DESC = { 1: '⚓ Common boost', 2: '🔱 Rare power', 3: '🎖️ Epic ability', 4: '⭐ Legendary mastery', 5: '💎 Divine transcendence' };

const FALLBACK = {
    'Easy': [
        { question: "Who is the main protagonist of One Piece?", options: ["Monkey D. Luffy", "Roronoa Zoro", "Nami", "Sanji"], answer: "Monkey D. Luffy" },
        { question: "What is Luffy's Devil Fruit?", options: ["Gomu Gomu no Mi", "Mera Mera no Mi", "Hito Hito no Mi", "Yami Yami no Mi"], answer: "Gomu Gomu no Mi" }
    ],
    'Medium': [
        { question: "What is Eren's Titan form called?", options: ["Attack Titan", "Colossal Titan", "Female Titan", "Beast Titan"], answer: "Attack Titan" },
        { question: "Who is 'Humanity's Strongest Soldier'?", options: ["Levi Ackerman", "Erwin Smith", "Mikasa Ackerman", "Eren Yeager"], answer: "Levi Ackerman" }
    ],
    'Hard': [
        { question: "Where do the Straw Hats first meet Brook?", options: ["Thriller Bark", "Sabaody Archipelago", "Water 7", "Enies Lobby"], answer: "Thriller Bark" },
        { question: "What is the Flame Alchemist's real name?", options: ["Roy Mustang", "Alex Louis Armstrong", "Maes Hughes", "King Bradley"], answer: "Roy Mustang" }
    ]
};

async function fetchQuestion(difficulty) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        
        const response = await fetch('https://aniquizapi.vercel.app/api/quiz', {
            method: 'GET',
            headers: { 'User-Agent': 'DiscordBot-AnimeQuiz/1.0', 'Accept': 'application/json' },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            let question, options, answer;
            
            if (data.data?.question && data.data?.correct && data.data?.options) {
                question = data.data.question;
                options = Array.isArray(data.data.options) ? data.data.options : [];
                answer = data.data.correct;
            } else if (data.question && data.correct && data.options) {
                question = data.question;
                options = Array.isArray(data.options) ? data.options : [];
                answer = data.correct;
            } else {
                throw new Error('Invalid API response');
            }
            
            // Clean text
            const clean = (text) => {
                if (!text) return '';
                return text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#x([0-9A-Fa-f]+);/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
                    .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(parseInt(d, 10))).trim();
            };
            
            question = clean(question);
            answer = clean(answer);
            options = options.map(opt => clean(opt)).filter(opt => opt.length > 0);
            
            if (!question || options.length < 2 || !answer) throw new Error('Invalid question data');
            
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
            
            console.log(`[API] ✅ Fetched ${difficulty} question from API`);
            return { question, options, answer, difficulty };
        }
    } catch (error) {
        console.log(`[API] ❌ Failed to fetch from API: ${error.message}`);
    }
    
    // Fallback
    console.log(`[API] 🛡️ Using fallback ${difficulty} question`);
    const fallbacks = FALLBACK[difficulty] || FALLBACK['Medium'];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

function getDay() { const n = new Date(), e = new Date(n.getTime() - 14400000); return e.getHours() < 3 && e.setDate(e.getDate() - 1), e.toISOString().split('T')[0]; }
function getReset() { const n = new Date(), e = new Date(n.getTime() - 14400000), t = new Date(e); return t.setHours(3, 0, 0, 0), e.getHours() >= 3 && t.setDate(t.getDate() + 1), Math.floor((t.getTime() + 14400000) / 1000); }

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
            await this.ask(interaction, userId, guildId, member, 1, 0);
        } catch (error) {
            console.error('[DAILY BUFF] Error:', error);
            const content = '❌ Error occurred. Try again.';
            if (interaction.deferred) await interaction.editReply({ content }); else await interaction.reply({ content, ephemeral: true });
        }
    },

    async ask(interaction, userId, guildId, member, qNum, tier) {
        try {
            const diffs = ['Easy', 'Medium', 'Medium', 'Hard', 'Hard'], diff = diffs[qNum - 1];
            const q = await fetchQuestion(diff); // ✅ API CALL HERE
            let time = 20;

            const makeEmbed = (t) => {
                const diffEmoji = { 'Easy': '🟢', 'Medium': '🟡', 'Hard': '🔴' };
                const diffColor = { 'Easy': [76, 175, 80], 'Medium': [255, 193, 7], 'Hard': [255, 87, 34] };
                const prog = Array.from({length: 5}, (_, i) => i < qNum ? '🟦' : i === qNum ? '🔷' : '⬜');
                const tProg = Math.max(0, Math.min(20, t)), bars = Math.round((tProg / 20) * 12);
                const timeBar = (t > 12 ? '🟩' : t > 6 ? '🟨' : '🟥').repeat(bars) + '⬛'.repeat(12 - bars);
                const color = t > 12 ? diffColor[diff] : t > 6 ? [255, 165, 0] : [231, 76, 60];

                return new EmbedBuilder().setAuthor({ name: '🎌 PROGRESSIVE ANIME MASTERY CHALLENGE' })
                    .setTitle(`${diffEmoji[diff]} Question ${qNum}/5 • ${diff}`).setColor(color)
                    .setDescription(`### ${q.question}\n\n*Select your answer below*`)
                    .addFields(
                        { name: '📊 Progress', value: `${prog.join('')}\nChallenge: ${qNum}/5 Complete`, inline: true },
                        { name: '⏰ Time Remaining', value: `\`${timeBar}\`\n\`${t} seconds left\``, inline: true },
                        { name: '🏆 Status', value: qNum > 1 ? `Secured: ${TIER_NAMES[qNum - 1]}\nTarget: ${TIER_NAMES[qNum]}` : `Target: ${TIER_NAMES[qNum]}\n${TIER_DESC[qNum]}`, inline: false }
                    ).setFooter({ text: `Enhancement Intelligence • Difficulty: ${diff}` }).setTimestamp();
            };

            const btns = q.options.map((opt, i) => new ButtonBuilder()
                .setCustomId(`q_${userId}_${qNum}_${i}_${opt === q.answer}`)
                .setLabel(opt.substring(0, 70)).setStyle(ButtonStyle.Primary).setEmoji(['🅰️', '🅱️', '🅾️', '🆎'][i]));

            const rows = [new ActionRowBuilder().addComponents(btns.slice(0, 2)), new ActionRowBuilder().addComponents(btns.slice(2))];
            if (qNum > 1) rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder()
                .setCustomId(`stop_${userId}_${qNum}`).setLabel(`Secure ${TIER_NAMES[qNum - 1]} Buff`).setStyle(ButtonStyle.Secondary).setEmoji('🛡️')));

            let msg; const embed = makeEmbed(time);
            if (qNum === 1) { await interaction.editReply({ embeds: [embed], components: rows }); msg = await interaction.fetchReply(); }
            else msg = await interaction.followUp({ embeds: [embed], components: rows });

            const timer = setInterval(async () => {
                time -= 4; if (time <= 0) { clearInterval(timer); return; }
                try { await msg.edit({ embeds: [makeEmbed(time)], components: rows }).catch(() => clearInterval(timer)); } catch { clearInterval(timer); }
            }, 4000);

            const collector = msg.createMessageComponentCollector({ time: 20000, filter: i => i.user.id === userId });

            collector.on('collect', async (btn) => {
                try {
                    clearInterval(timer); await btn.deferUpdate();
                    
                    if (btn.customId.startsWith('stop_')) {
                        const fTier = qNum - 1; await this.apply(userId, guildId, member, fTier);
                        const res = new EmbedBuilder().setTitle('Strategic Withdrawal - Tier Secured!').setColor(TIER_COLORS[fTier])
                            .setDescription(`**${TIER_NAMES[fTier]}** secured!\n*${TIER_DESC[fTier]}*`)
                            .addFields({ name: '📊 Results', value: `Score: ${fTier}/5\nNext: <t:${getReset()}:R>`, inline: false })
                            .setFooter({ text: `${TIER_NAMES[fTier]} Active` }).setTimestamp();
                        await btn.editReply({ embeds: [res], components: [] }); collector.stop(); return;
                    }

                    const isCorrect = btn.customId.split('_')[4] === 'true';
                    
                    if (isCorrect) {
                        if (qNum === 5) {
                            await this.apply(userId, guildId, member, 5);
                            const res = new EmbedBuilder().setTitle('💎 DIVINE MASTERY ACHIEVED!').setColor(TIER_COLORS[5])
                                .setDescription(`**${TIER_NAMES[5]}** unlocked!\n*${TIER_DESC[5]}*\n\n🏆 **FLAWLESS VICTORY**`)
                                .addFields({ name: '🎖️ Achievement', value: `Perfect Score: 5/5\nNext: <t:${getReset()}:R>`, inline: false })
                                .setFooter({ text: `${TIER_NAMES[5]} Active • Divine Achievement` }).setTimestamp();
                            await btn.editReply({ embeds: [res], components: [] });
                        } else {
                            const cont = new EmbedBuilder().setTitle(`✅ Correct! Tier ${qNum} Achieved`).setColor([46, 204, 113])
                                .setDescription(`**${TIER_NAMES[qNum]}** secured! Continue or claim current tier.`)
                                .addFields({ name: '🎯 Decision', value: `Next: Question ${qNum + 1}/5\nCurrent: ${TIER_NAMES[qNum]}`, inline: false })
                                .setFooter({ text: 'Choose your path wisely' }).setTimestamp();
                            
                            const contBtn = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId(`cont_${userId}_${qNum + 1}`).setLabel(`➡️ Continue to Question ${qNum + 1}`).setStyle(ButtonStyle.Success).setEmoji('⚡'),
                                new ButtonBuilder().setCustomId(`claim_${userId}_${qNum}`).setLabel(`Secure ${TIER_NAMES[qNum]} Buff`).setStyle(ButtonStyle.Secondary).setEmoji('🛡️')
                            );
                            
                            await btn.editReply({ embeds: [cont], components: [contBtn] });
                            
                            const contColl = btn.message.createMessageComponentCollector({ time: 30000, filter: i => i.user.id === userId });
                            contColl.on('collect', async (contBtn) => {
                                await contBtn.deferUpdate();
                                if (contBtn.customId.startsWith('cont_')) {
                                    const next = parseInt(contBtn.customId.split('_')[2]); contColl.stop();
                                    await this.ask(interaction, userId, guildId, member, next, qNum);
                                } else {
                                    const cTier = parseInt(contBtn.customId.split('_')[2]); await this.apply(userId, guildId, member, cTier);
                                    const claim = new EmbedBuilder().setTitle('Strategic Withdrawal - Tier Secured!').setColor(TIER_COLORS[cTier])
                                        .setDescription(`**${TIER_NAMES[cTier]}** secured!\n*${TIER_DESC[cTier]}*`)
                                        .addFields({ name: '📊 Results', value: `Score: ${cTier}/5\nNext: <t:${getReset()}:R>`, inline: false })
                                        .setFooter({ text: `${TIER_NAMES[cTier]} Active` }).setTimestamp();
                                    await contBtn.editReply({ embeds: [claim], components: [] }); contColl.stop();
                                }
                            });
                        }
                    } else {
                        const fTier = Math.max(0, qNum - 1);
                        if (fTier > 0) await this.apply(userId, guildId, member, fTier); else await this.saveFail(userId, guildId);
                        const color = fTier > 0 ? TIER_COLORS[fTier] : [156, 163, 175], name = fTier > 0 ? TIER_NAMES[fTier] : 'No Enhancement';
                        const res = new EmbedBuilder().setTitle(fTier > 0 ? 'Challenge Failed - Previous Tier Applied' : 'Challenge Failed - No Enhancement').setColor(color)
                            .setDescription(fTier > 0 ? `**${name}** applied from previous progress.` : 'No enhancement earned. Try again tomorrow!')
                            .addFields({ name: '📊 Results', value: `Score: ${fTier}/5\nCorrect: ${q.answer}\nNext: <t:${getReset()}:R>`, inline: false })
                            .setFooter({ text: fTier > 0 ? `${name} Active` : 'Challenge Failed' }).setTimestamp();
                        await btn.editReply({ embeds: [res], components: [] });
                    }
                    collector.stop();
                } catch (error) { console.error('[QUIZ] Button error:', error); clearInterval(timer); }
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
        } catch (error) { console.error('[QUIZ] Question error:', error); }
    },

    async checkRoll(userId, guildId) { try { const r = await global.xpTracker.db.query('SELECT * FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3', [userId, guildId, getDay()]); return r.rows.length > 0; } catch { return false; } },

    async getBuff(userId, guildId, member) {
        try {
            const r = await global.xpTracker.db.query('SELECT tier FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3', [userId, guildId, getDay()]);
            if (r.rows.length > 0) { const t = r.rows[0].tier; return { tier: t, name: t === 0 ? 'Challenge Failed' : TIER_NAMES[t], multiplier: t === 0 ? 'None' : 'Active' }; }
            for (let i = 1; i <= 5; i++) { const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`]; if (roleId && member.roles.cache.has(roleId)) return { tier: i, name: TIER_NAMES[i], multiplier: 'Active' }; }
            return { tier: 0, name: 'No Enhancement', multiplier: 'None' };
        } catch { return { tier: 0, name: 'Error', multiplier: 'None' }; }
    },

    async apply(userId, guildId, member, tier) {
        try {
            for (let i = 1; i <= 5; i++) { const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`]; if (roleId && member.roles.cache.has(roleId)) { const role = member.guild.roles.cache.get(roleId); if (role) await member.roles.remove(role); } }
            if (tier > 0) { const roleId = process.env[`DAILY_XP_BUFF_TIER_${tier}_ROLE`]; if (roleId) { const role = member.guild.roles.cache.get(roleId); if (role) { await member.roles.add(role); console.log(`[DAILY BUFF] ✅ Awarded ${role.name}`); } } }
            await this.save(userId, guildId, tier);
        } catch (error) { console.error('[DAILY BUFF] Apply error:', error); }
    },

    async save(userId, guildId, tier) {
        try {
            await global.xpTracker.db.query('CREATE TABLE IF NOT EXISTS daily_buff_rolls (user_id VARCHAR(20), guild_id VARCHAR(20), date DATE, tier INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, guild_id, date))');
            await global.xpTracker.db.query('INSERT INTO daily_buff_rolls (user_id, guild_id, date, tier) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, guild_id, date) DO UPDATE SET tier = $4', [userId, guildId, getDay(), tier]);
            console.log(`[DAILY BUFF] ✅ Saved tier ${tier}`);
        } catch (error) { console.error('[DAILY BUFF] Save error:', error); }
    },

    async saveFail(userId, guildId) {
        try {
            await global.xpTracker.db.query('INSERT INTO daily_buff_rolls (user_id, guild_id, date, tier, created_at) VALUES ($1, $2, $3, 0, CURRENT_TIMESTAMP) ON CONFLICT (user_id, guild_id, date) DO UPDATE SET tier = 0', [userId, guildId, getDay()]);
            console.log('[DAILY BUFF] ❌ Saved failed attempt');
        } catch (error) { console.error('[DAILY BUFF] Save failed error:', error); }
    }
};

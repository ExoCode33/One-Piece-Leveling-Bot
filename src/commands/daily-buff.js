// src/commands/daily-buff.js - Enhanced Beautiful Version with Countdown & RGB

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const TIER_COLORS = {
    1: [76, 175, 80],    // Material Green
    2: [33, 150, 243],   // Material Blue  
    3: [156, 39, 176],   // Material Purple
    4: [255, 193, 7],    // Material Amber
    5: [255, 87, 34]     // Material Deep Orange
};

const TIER_NAMES = {
    1: 'Common',
    2: 'Rare', 
    3: 'Epic',
    4: 'Legendary',
    5: 'Divine'
};

const TIER_DESCRIPTIONS = {
    1: '⚓ Common enhancement boost',
    2: '🔱 Rare power amplification', 
    3: '🎖️ Epic ability enhancement',
    4: '⭐ Legendary mastery boost',
    5: '💎 Divine transcendence power'
};

const FALLBACK_QUESTIONS = {
    'Easy': [
        {
            question: "Who is the main protagonist of One Piece?",
            options: ["Monkey D. Luffy", "Roronoa Zoro", "Nami", "Sanji"],
            answer: "Monkey D. Luffy"
        },
        {
            question: "What is the name of Luffy's Devil Fruit?",
            options: ["Gomu Gomu no Mi", "Mera Mera no Mi", "Hito Hito no Mi", "Yami Yami no Mi"],
            answer: "Gomu Gomu no Mi"
        },
        {
            question: "Who is the main character of Naruto?",
            options: ["Naruto Uzumaki", "Sasuke Uchiha", "Sakura Haruno", "Kakashi Hatake"],
            answer: "Naruto Uzumaki"
        },
        {
            question: "What is the name of the hero school in My Hero Academia?",
            options: ["U.A. High School", "Shiketsu High", "Ketsubutsu Academy", "Seiai Academy"],
            answer: "U.A. High School"
        }
    ],
    'Medium': [
        {
            question: "In Attack on Titan, what is Eren's Titan form called?",
            options: ["Attack Titan", "Colossal Titan", "Female Titan", "Beast Titan"],
            answer: "Attack Titan"
        },
        {
            question: "Who is known as 'Humanity's Strongest Soldier' in Attack on Titan?",
            options: ["Levi Ackerman", "Erwin Smith", "Mikasa Ackerman", "Eren Yeager"],
            answer: "Levi Ackerman"
        },
        {
            question: "In Dragon Ball Z, what is Goku's Saiyan birth name?",
            options: ["Kakarot", "Vegeta", "Raditz", "Bardock"],
            answer: "Kakarot"
        },
        {
            question: "What is the name of Ichigo's Zanpakuto in Bleach?",
            options: ["Zangetsu", "Senbonzakura", "Hyorinmaru", "Ryujin Jakka"],
            answer: "Zangetsu"
        }
    ],
    'Hard': [
        {
            question: "In One Piece, what is the name of the island where the Straw Hats first meet Brook?",
            options: ["Thriller Bark", "Sabaody Archipelago", "Water 7", "Enies Lobby"],
            answer: "Thriller Bark"
        },
        {
            question: "In Fullmetal Alchemist, what is the real name of the Flame Alchemist?",
            options: ["Roy Mustang", "Alex Louis Armstrong", "Maes Hughes", "King Bradley"],
            answer: "Roy Mustang"
        },
        {
            question: "In Jujutsu Kaisen, what grade is Yuji Itadori classified as initially?",
            options: ["Grade 4", "Grade 3", "Grade 2", "Grade 1"],
            answer: "Grade 4"
        },
        {
            question: "In Hunter x Hunter, what is the name of Killua's family business?",
            options: ["Assassination", "Bounty Hunting", "Mercenary Work", "Security Services"],
            answer: "Assassination"
        }
    ]
};

function getCurrentDay() {
    const now = new Date();
    const estOffset = -4; // EDT
    const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
    if (estTime.getHours() < 3) {
        estTime.setDate(estTime.getDate() - 1);
    }
    return estTime.toISOString().split('T')[0];
}

function getNextReset() {
    const now = new Date();
    const estOffset = -4;
    const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
    const nextReset = new Date(estTime);
    nextReset.setHours(3, 0, 0, 0);
    if (estTime.getHours() >= 3) {
        nextReset.setDate(nextReset.getDate() + 1);
    }
    const utcReset = new Date(nextReset.getTime() - (estOffset * 60 * 60 * 1000));
    return Math.floor(utcReset.getTime() / 1000);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily-buff')
        .setDescription('🎌 Take the progressive anime mastery challenge! 5 questions, increasing difficulty, your score = your tier!'),

    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            const member = interaction.member;

            if (!global.xpTracker || !global.xpTracker.db) {
                return await interaction.reply({
                    content: '❌ **Daily Enhancement System Unavailable**\n\nXP tracking system not initialized.',
                    ephemeral: true
                });
            }

            const hasRolledToday = await this.checkDailyRoll(userId, guildId);
            if (hasRolledToday) {
                const currentBuff = await this.getCurrentBuff(userId, guildId, member);
                const nextReset = getNextReset();
                
                const embed = new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setAuthor({ 
                        name: '🎌 PROGRESSIVE ANIME MASTERY CHALLENGE'
                    })
                    .setTitle('Daily Mastery Challenge Already Completed')
                    .setDescription(`You've already completed today's progressive challenge!\n\n**Current Enhancement:** ${currentBuff.name}\n**Status:** ${currentBuff.multiplier}\n\n*Next challenge available: <t:${nextReset}:R>*`)
                    .setFooter({ text: 'Enhancement Intelligence • Progressive Mastery System' })
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            await interaction.deferReply();
            await this.startQuiz(interaction, userId, guildId, member);

        } catch (error) {
            console.error('[PROGRESSIVE CHALLENGE] Error in daily-buff command:', error);
            
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ **Error**\n\nSomething went wrong with the progressive challenge system. Please try again.'
                });
            } else {
                await interaction.reply({
                    content: '❌ **Error**\n\nSomething went wrong with the progressive challenge system. Please try again.',
                    ephemeral: true
                });
            }
        }
    },

    async startQuiz(interaction, userId, guildId, member) {
        await this.askQuestion(interaction, userId, guildId, member, 1, 0);
    },

    async askQuestion(interaction, userId, guildId, member, questionNumber, currentTier) {
        try {
            const difficulties = ['Easy', 'Easy', 'Medium', 'Hard', 'Hard'];
            const difficulty = difficulties[questionNumber - 1];
            const questions = FALLBACK_QUESTIONS[difficulty];
            const questionData = questions[Math.floor(Math.random() * questions.length)];
            
            let timeRemaining = 20;
            
            // Create beautiful quiz embed with countdown
            const createQuizEmbed = (timeLeft) => {
                const difficultyEmoji = {
                    'Easy': '🟢',
                    'Medium': '🟡', 
                    'Hard': '🔴'
                };

                const difficultyColor = {
                    'Easy': [76, 175, 80],
                    'Medium': [255, 193, 7],
                    'Hard': [255, 87, 34]
                };

                // Enhanced progress visualization (5 questions)
                const progressBars = [];
                for (let i = 1; i <= 5; i++) {
                    if (i < questionNumber) {
                        progressBars.push('🟦');
                    } else if (i === questionNumber) {
                        progressBars.push('🔷');
                    } else {
                        progressBars.push('⬜');
                    }
                }
                
                // Enhanced timer bar
                const totalTime = 20;
                const timeProgress = Math.max(0, Math.min(totalTime, timeLeft));
                const progressLength = 12;
                const filledBars = Math.round((timeProgress / totalTime) * progressLength);
                const emptyBars = progressLength - filledBars;
                
                let timeBarEmoji, embedColor;
                if (timeLeft > 12) {
                    timeBarEmoji = '🟩';
                    embedColor = difficultyColor[difficulty] || [46, 204, 113];
                } else if (timeLeft > 6) {
                    timeBarEmoji = '🟨';
                    embedColor = [255, 165, 0];
                } else {
                    timeBarEmoji = '🟥';
                    embedColor = [231, 76, 60];
                }
                
                const timeBar = timeBarEmoji.repeat(filledBars) + '⬛'.repeat(emptyBars);
                
                return new EmbedBuilder()
                    .setAuthor({ 
                        name: '🎌 PROGRESSIVE ANIME MASTERY CHALLENGE'
                    })
                    .setTitle(`${difficultyEmoji[difficulty]} Question ${questionNumber}/5 • ${difficulty}`)
                    .setColor(embedColor)
                    .setDescription(`### ${questionData.question}\n\n*Select your answer from the buttons below*`)
                    .addFields(
                        {
                            name: '📊 Progress',
                            value: `${progressBars.join('')}\n\`Challenge: ${questionNumber}/5 Complete\``,
                            inline: true
                        },
                        {
                            name: `⏰ Time Remaining`,
                            value: `\`${timeBar}\`\n\`${timeLeft} seconds left\``,
                            inline: true
                        },
                        {
                            name: '🏆 Current Status',
                            value: questionNumber > 1 ? 
                                `**Secured:** ${TIER_NAMES[questionNumber - 1]}\n**Target:** ${TIER_NAMES[questionNumber]}` :
                                `**Target Tier:** ${TIER_NAMES[questionNumber]}\n**Description:** ${TIER_DESCRIPTIONS[questionNumber]}`,
                            inline: false
                        }
                    )
                    .setFooter({ 
                        text: `Enhancement Intelligence • Progressive Challenge System • Difficulty: ${difficulty}`
                    })
                    .setTimestamp();
            };

            // Create beautiful answer buttons
            const buttons = [];
            const emojis = ['🅰️', '🅱️', '🅾️', '🆎'];
            
            questionData.options.forEach((option, index) => {
                const isCorrect = option === questionData.answer;
                const truncatedOption = option.length > 70 ? option.substring(0, 67) + '...' : option;
                
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(`quiz_${userId}_${questionNumber}_${index}_${isCorrect}`)
                        .setLabel(truncatedOption)
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji(emojis[index])
                );
            });

            const rows = [];
            for (let i = 0; i < buttons.length; i += 2) {
                rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 2)));
            }

            if (questionNumber > 1) {
                const stopButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`stop_${userId}_${questionNumber}`)
                            .setLabel(`Secure ${TIER_NAMES[questionNumber - 1]} Buff`)
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('🛡️')
                    );
                rows.push(stopButton);
            }

            let message;
            const initialEmbed = createQuizEmbed(timeRemaining);
            
            if (questionNumber === 1) {
                await interaction.editReply({ embeds: [initialEmbed], components: rows });
                message = await interaction.fetchReply();
            } else {
                message = await interaction.followUp({ embeds: [initialEmbed], components: rows });
            }

            // Countdown timer with live updates
            const timerInterval = setInterval(async () => {
                timeRemaining -= 4;
                
                if (timeRemaining <= 0) {
                    clearInterval(timerInterval);
                    return;
                }
                
                try {
                    const updatedEmbed = createQuizEmbed(timeRemaining);
                    await message.edit({ embeds: [updatedEmbed], components: rows }).catch(() => {
                        clearInterval(timerInterval);
                    });
                } catch (error) {
                    clearInterval(timerInterval);
                }
            }, 4000);

            const collector = message.createMessageComponentCollector({ 
                time: 20000,
                filter: (i) => i.user.id === userId
            });

            collector.on('collect', async (buttonInteraction) => {
                try {
                    clearInterval(timerInterval);
                    await buttonInteraction.deferUpdate();
                    
                    if (buttonInteraction.customId.startsWith('stop_')) {
                        const finalTier = questionNumber - 1;
                        await this.applyBuffRole(userId, guildId, member, finalTier);
                        
                        const resultEmbed = new EmbedBuilder()
                            .setTitle(`Strategic Withdrawal - Tier Secured!`)
                            .setColor(TIER_COLORS[finalTier])
                            .setDescription(`**${TIER_NAMES[finalTier]}** enhancement successfully secured!\n*${TIER_DESCRIPTIONS[finalTier]}*`)
                            .addFields({
                                name: '📊 Challenge Results',
                                value: `**Final Score:** ${finalTier}/5\n**Strategy:** Secured Tier\n**Next Reset:** <t:${getNextReset()}:R>`,
                                inline: false
                            })
                            .setFooter({ text: `${TIER_NAMES[finalTier]} Active • Progressive Enhancement System` })
                            .setTimestamp();
                        
                        await buttonInteraction.editReply({ embeds: [resultEmbed], components: [] });
                        collector.stop();
                        return;
                    }
                    
                    const [, , , , isCorrectStr] = buttonInteraction.customId.split('_');
                    const isCorrect = isCorrectStr === 'true';
                    
                    if (isCorrect) {
                        if (questionNumber === 5) {
                            await this.applyBuffRole(userId, guildId, member, 5);
                            
                            const resultEmbed = new EmbedBuilder()
                                .setTitle('💎 DIVINE MASTERY ACHIEVED!')
                                .setColor(TIER_COLORS[5])
                                .setDescription(`**${TIER_NAMES[5]} Status Unlocked!**\n*${TIER_DESCRIPTIONS[5]}*\n\n🏆 **FLAWLESS VICTORY** - All 5 questions answered correctly!`)
                                .addFields({
                                    name: '🎖️ Supreme Achievement',
                                    value: `**Perfect Score:** 5/5\n**Enhancement:** ${TIER_NAMES[5]}\n**Next Reset:** <t:${getNextReset()}:R>`,
                                    inline: false
                                })
                                .setFooter({ text: `${TIER_NAMES[5]} Active • Divine Mastery Achievement` })
                                .setTimestamp();
                            
                            await buttonInteraction.editReply({ embeds: [resultEmbed], components: [] });
                        } else {
                            const continueEmbed = new EmbedBuilder()
                                .setTitle(`✅ Correct! Tier ${questionNumber} Achieved`)
                                .setColor([46, 204, 113])
                                .setDescription(`**${TIER_NAMES[questionNumber]}** secured! Continue to the next challenge or claim your current tier.`)
                                .addFields({
                                    name: '🎯 Decision Point',
                                    value: `**Next Challenge:** Question ${questionNumber + 1}/5 (${difficulties[questionNumber]})\n**Current Tier:** ${TIER_NAMES[questionNumber]}`,
                                    inline: false
                                })
                                .setFooter({ text: 'Enhancement Intelligence • Choose your path wisely' })
                                .setTimestamp();
                            
                            const continueButton = new ActionRowBuilder()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(`continue_${userId}_${questionNumber + 1}`)
                                        .setLabel(`➡️ Continue to Question ${questionNumber + 1}`)
                                        .setStyle(ButtonStyle.Success)
                                        .setEmoji('⚡'),
                                    new ButtonBuilder()
                                        .setCustomId(`claim_${userId}_${questionNumber}`)
                                        .setLabel(`Secure ${TIER_NAMES[questionNumber]} Buff`)
                                        .setStyle(ButtonStyle.Secondary)
                                        .setEmoji('🛡️')
                                );
                            
                            await buttonInteraction.editReply({ embeds: [continueEmbed], components: [continueButton] });
                            
                            const continueCollector = buttonInteraction.message.createMessageComponentCollector({
                                time: 30000,
                                filter: (i) => i.user.id === userId
                            });
                            
                            continueCollector.on('collect', async (continueInteraction) => {
                                await continueInteraction.deferUpdate();
                                
                                if (continueInteraction.customId.startsWith('continue_')) {
                                    const nextQuestionNum = parseInt(continueInteraction.customId.split('_')[2]);
                                    continueCollector.stop();
                                    await this.askQuestion(interaction, userId, guildId, member, nextQuestionNum, questionNumber);
                                } else if (continueInteraction.customId.startsWith('claim_')) {
                                    const claimTier = parseInt(continueInteraction.customId.split('_')[2]);
                                    await this.applyBuffRole(userId, guildId, member, claimTier);
                                    
                                    const claimEmbed = new EmbedBuilder()
                                        .setTitle(`Strategic Withdrawal - Tier Secured!`)
                                        .setColor(TIER_COLORS[claimTier])
                                        .setDescription(`**${TIER_NAMES[claimTier]}** enhancement successfully secured!\n*${TIER_DESCRIPTIONS[claimTier]}*`)
                                        .addFields({
                                            name: '📊 Challenge Results',
                                            value: `**Final Score:** ${claimTier}/5\n**Strategy:** Secured Tier\n**Next Reset:** <t:${getNextReset()}:R>`,
                                            inline: false
                                        })
                                        .setFooter({ text: `${TIER_NAMES[claimTier]} Active • Progressive Enhancement System` })
                                        .setTimestamp();
                                    
                                    await continueInteraction.editReply({ embeds: [claimEmbed], components: [] });
                                    continueCollector.stop();
                                }
                            });
                            
                            continueCollector.on('end', async (collected) => {
                                if (collected.size === 0) {
                                    await this.applyBuffRole(userId, guildId, member, questionNumber);
                                    
                                    const autoClaimEmbed = new EmbedBuilder()
                                        .setTitle(`Strategic Withdrawal - Tier Secured!`)
                                        .setColor(TIER_COLORS[questionNumber])
                                        .setDescription(`**${TIER_NAMES[questionNumber]}** enhancement successfully secured!\n*${TIER_DESCRIPTIONS[questionNumber]}*`)
                                        .addFields({
                                            name: '📊 Challenge Results',
                                            value: `**Final Score:** ${questionNumber}/5\n**Strategy:** Auto-Secured (Timeout)\n**Next Reset:** <t:${getNextReset()}:R>`,
                                            inline: false
                                        })
                                        .setFooter({ text: `${TIER_NAMES[questionNumber]} Active • Progressive Enhancement System` })
                                        .setTimestamp();
                                    
                                    await buttonInteraction.editReply({ embeds: [autoClaimEmbed], components: [] });
                                }
                            });
                        }
                    } else {
                        const finalTier = Math.max(0, questionNumber - 1);
                        
                        if (finalTier > 0) {
                            await this.applyBuffRole(userId, guildId, member, finalTier);
                        } else {
                            await this.saveFailedAttempt(userId, guildId);
                        }
                        
                        const color = finalTier > 0 ? TIER_COLORS[finalTier] : [156, 163, 175];
                        const tierName = finalTier > 0 ? TIER_NAMES[finalTier] : 'No Enhancement';
                        
                        const resultEmbed = new EmbedBuilder()
                            .setTitle(finalTier > 0 ? 
                                `Challenge Failed - Previous Tier Applied` : 
                                'Challenge Failed - No Enhancement')
                            .setColor(color)
                            .setDescription(finalTier > 0 ? 
                                `**${tierName}** enhancement applied based on previous progress.` :
                                `No enhancement earned. Study harder and try again tomorrow!`)
                            .addFields({
                                name: '📊 Final Results',
                                value: `**Score:** ${finalTier}/5\n**Correct Answer:** ${questionData.answer}\n**Next Reset:** <t:${getNextReset()}:R>`,
                                inline: false
                            })
                            .setFooter({ 
                                text: finalTier > 0 ? 
                                    `${tierName} Active • Progressive Enhancement System` : 
                                    'Enhancement Intelligence • Challenge Failed'
                            })
                            .setTimestamp();
                        
                        await buttonInteraction.editReply({ embeds: [resultEmbed], components: [] });
                    }
                    
                    collector.stop();
                    
                } catch (error) {
                    console.error('[PROGRESSIVE QUIZ] Button interaction error:', error);
                    clearInterval(timerInterval);
                    await buttonInteraction.editReply({
                        content: '❌ **Error processing answer**\n\nPlease try the quiz again.',
                        components: []
                    });
                }
            });

            collector.on('end', async (collected) => {
                clearInterval(timerInterval);
                
                if (collected.size === 0) {
                    const finalTier = Math.max(0, currentTier);
                    
                    if (finalTier > 0) {
                        await this.applyBuffRole(userId, guildId, member, finalTier);
                    } else {
                        await this.saveFailedAttempt(userId, guildId);
                    }
                    
                    const timeoutEmbed = new EmbedBuilder()
                        .setColor([231, 76, 60])
                        .setTitle('⏰ Time\'s Up!')
                        .setDescription(finalTier > 0 ? 
                            `Your previous tier (**${TIER_NAMES[finalTier]}**) has been applied.` :
                            `No enhancement earned. Time ran out on the first question!`)
                        .addFields({
                            name: '💡 Next Attempt',
                            value: `<t:${getNextReset()}:R>`,
                            inline: false
                        })
                        .setFooter({ text: 'Enhancement Intelligence • Progressive Challenge System' })
                        .setTimestamp();

                    await message.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {
                        if (questionNumber === 1) {
                            interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(console.error);
                        }
                    });
                }
            });

        } catch (error) {
            console.error('[PROGRESSIVE QUIZ] Error asking question:', error);
        }
    },

    async checkDailyRoll(userId, guildId) {
        try {
            const currentDay = getCurrentDay();
            const result = await global.xpTracker.db.query(
                'SELECT * FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [userId, guildId, currentDay]
            );
            return result.rows.length > 0;
        } catch (error) {
            console.error('[PROGRESSIVE QUIZ] Error checking daily roll:', error);
            return false;
        }
    },

    async getCurrentBuff(userId, guildId, member) {
        try {
            const currentDay = getCurrentDay();
            const result = await global.xpTracker.db.query(
                'SELECT tier FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [userId, guildId, currentDay]
            );

            if (result.rows.length > 0) {
                const tier = result.rows[0].tier;
                if (tier === 0) {
                    return { tier: 0, name: 'Challenge Failed', multiplier: 'None' };
                }
                return {
                    tier: tier,
                    name: TIER_NAMES[tier],
                    multiplier: 'Active'
                };
            }

            // Fallback: check roles (5 tiers only)
            for (let tier = 1; tier <= 5; tier++) {
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
        } catch (error) {
            console.error('[PROGRESSIVE QUIZ] Error getting current buff:', error);
            return { tier: 0, name: 'Error', multiplier: 'None' };
        }
    },

    async applyBuffRole(userId, guildId, member, tier) {
        try {
            await this.removeAllBuffRoles(member);

            if (tier > 0) {
                const roleId = process.env[`DAILY_XP_BUFF_TIER_${tier}_ROLE`];
                if (roleId) {
                    const role = member.guild.roles.cache.get(roleId);
                    if (role) {
                        await member.roles.add(role);
                        console.log(`[PROGRESSIVE QUIZ] ✅ Awarded ${role.name} to ${member.user.username}`);
                    } else {
                        console.error(`[PROGRESSIVE QUIZ] ❌ Role not found: ${roleId}`);
                    }
                } else {
                    console.warn(`[PROGRESSIVE QUIZ] ⚠️ No role ID configured for tier ${tier}`);
                }
            }

            await this.saveBuffRoll(userId, guildId, tier);

        } catch (error) {
            console.error('[PROGRESSIVE QUIZ] ❌ Error applying buff role:', error);
        }
    },

    async removeAllBuffRoles(member) {
        for (let i = 1; i <= 5; i++) {
            const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`];
            if (roleId && member.roles.cache.has(roleId)) {
                const role = member.guild.roles.cache.get(roleId);
                if (role) {
                    await member.roles.remove(role);
                    console.log(`[PROGRESSIVE QUIZ] Removed ${role.name} from ${member.user.username}`);
                }
            }
        }
    },

    async saveBuffRoll(userId, guildId, tier) {
        try {
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

            const currentDay = getCurrentDay();
            
            await global.xpTracker.db.query(`
                INSERT INTO daily_buff_rolls (user_id, guild_id, date, tier)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, guild_id, date)
                DO UPDATE SET tier = $4
            `, [userId, guildId, currentDay, tier]);

            console.log(`[PROGRESSIVE QUIZ] ✅ Saved tier ${tier} result for ${userId} on ${currentDay}`);

        } catch (error) {
            console.error('[PROGRESSIVE QUIZ] ❌ Error saving buff roll:', error);
        }
    },

    async saveFailedAttempt(userId, guildId) {
        try {
            const currentDay = getCurrentDay();
            
            await global.xpTracker.db.query(`
                INSERT INTO daily_buff_rolls (user_id, guild_id, date, tier, created_at)
                VALUES ($1, $2, $3, 0, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, guild_id, date)
                DO UPDATE SET tier = 0
            `, [userId, guildId, currentDay]);

            console.log(`[PROGRESSIVE QUIZ] ❌ Saved failed attempt for ${userId} on ${currentDay}`);

        } catch (error) {
            console.error('[PROGRESSIVE QUIZ] Error saving failed attempt:', error);
        }
    },

    // Admin functions for external use
    async checkDailyBuffStatus(userId, guildId) {
        try {
            const currentDay = getCurrentDay();
            
            const dbResult = await global.xpTracker.db.query(
                'SELECT * FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [userId, guildId, currentDay]
            );
            
            const hasDBRecord = dbResult.rows.length > 0;
            const dbTier = hasDBRecord ? dbResult.rows[0].tier : null;
            
            const guild = global.client?.guilds?.cache?.get(guildId);
            const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
            const currentRoles = [];
            
            if (member) {
                for (let i = 1; i <= 5; i++) {
                    const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`];
                    if (roleId && member.roles.cache.has(roleId)) {
                        const role = member.guild.roles.cache.get(roleId);
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
                currentDay,
                hasDBRecord,
                dbTier,
                currentRoles,
                canRoll: !hasDBRecord
            };
            
        } catch (error) {
            console.error('[PROGRESSIVE QUIZ] Error checking daily buff status:', error);
            return {
                currentDay: getCurrentDay(),
                hasDBRecord: false,
                dbTier: null,
                currentRoles: [],
                canRoll: true,
                error: error.message
            };
        }
    },

    async forceRemoveDailyBuff(userId, guildId, reason = 'Admin removal') {
        try {
            const currentDay = getCurrentDay();
            const removedRoles = [];
            let dbRecordsRemoved = 0;
            
            const guild = global.client?.guilds?.cache?.get(guildId);
            const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
            
            if (member) {
                for (let i = 1; i <= 5; i++) {
                    const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`];
                    if (roleId && member.roles.cache.has(roleId)) {
                        const role = member.guild.roles.cache.get(roleId);
                        if (role) {
                            await member.roles.remove(role, reason);
                            removedRoles.push(`Tier ${i}: ${role.name}`);
                        }
                    }
                }
            }
            
            const deleteResult = await global.xpTracker.db.query(
                'DELETE FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3 RETURNING *',
                [userId, guildId, currentDay]
            );
            
            dbRecordsRemoved = deleteResult.rowCount;
            
            console.log(`[PROGRESSIVE QUIZ] ✅ Force removed daily buff for ${userId}: ${removedRoles.length} roles, ${dbRecordsRemoved} DB records`);
            
            return {
                success: true,
                removedRoles,
                dbRecordsRemoved,
                currentDay,
                reason
            };
            
        } catch (error) {
            console.error('[PROGRESSIVE QUIZ] Error force removing daily buff:', error);
            return {
                success: false,
                error: error.message,
                removedRoles: [],
                dbRecordsRemoved: 0
            };
        }
    }
};

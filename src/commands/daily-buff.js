// src/commands/daily-buff.js - Minimal Working Version

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const TIER_NAMES = {
    1: 'Common',
    2: 'Rare', 
    3: 'Epic',
    4: 'Legendary',
    5: 'Divine'
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
        .setDescription('🎌 Take the progressive anime mastery challenge! 5 questions, increasing difficulty!'),

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
                    .setTitle('🎌 Daily Challenge Already Completed')
                    .setDescription(`You've completed today's challenge!\n\n**Current Enhancement:** ${currentBuff.name}\n\n*Next available: <t:${nextReset}:R>*`)
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            await interaction.deferReply();
            await this.startQuiz(interaction, userId, guildId, member);

        } catch (error) {
            console.error('[DAILY BUFF] Error:', error);
            const content = '❌ **Error**\n\nSomething went wrong. Please try again.';
            
            if (interaction.deferred) {
                await interaction.editReply({ content });
            } else {
                await interaction.reply({ content, ephemeral: true });
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
            
            const embed = new EmbedBuilder()
                .setColor('#4A90E2')
                .setTitle(`🎌 Question ${questionNumber}/5 • ${difficulty}`)
                .setDescription(`### ${questionData.question}\n\n*Select your answer below*`)
                .addFields({
                    name: '📊 Progress',
                    value: `Question ${questionNumber} of 5\nTarget: ${TIER_NAMES[questionNumber] || 'Complete'}`,
                    inline: true
                })
                .setTimestamp();

            const buttons = [];
            const emojis = ['🅰️', '🅱️', '🅾️', '🆎'];
            
            questionData.options.forEach((option, index) => {
                const isCorrect = option === questionData.answer;
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(`quiz_${userId}_${questionNumber}_${index}_${isCorrect}`)
                        .setLabel(option.substring(0, 70))
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
                            .setLabel(`🛑 Secure ${TIER_NAMES[questionNumber - 1]}`)
                            .setStyle(ButtonStyle.Secondary)
                    );
                rows.push(stopButton);
            }

            let message;
            if (questionNumber === 1) {
                await interaction.editReply({ embeds: [embed], components: rows });
                message = await interaction.fetchReply();
            } else {
                message = await interaction.followUp({ embeds: [embed], components: rows });
            }

            const collector = message.createMessageComponentCollector({ 
                time: 30000,
                filter: (i) => i.user.id === userId
            });

            collector.on('collect', async (buttonInteraction) => {
                try {
                    await buttonInteraction.deferUpdate();
                    
                    if (buttonInteraction.customId.startsWith('stop_')) {
                        const finalTier = questionNumber - 1;
                        await this.applyBuffRole(userId, guildId, member, finalTier);
                        
                        const resultEmbed = new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle(`🛡️ ${TIER_NAMES[finalTier]} Secured!`)
                            .setDescription(`You've secured **${TIER_NAMES[finalTier]}** enhancement!`)
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
                                .setColor('#FFD700')
                                .setTitle('💎 DIVINE MASTERY!')
                                .setDescription(`**Perfect score!** You've achieved **${TIER_NAMES[5]}** status!`)
                                .setTimestamp();
                            
                            await buttonInteraction.editReply({ embeds: [resultEmbed], components: [] });
                        } else {
                            const continueEmbed = new EmbedBuilder()
                                .setColor('#00FF00')
                                .setTitle(`✅ Correct! Tier ${questionNumber} Achieved`)
                                .setDescription(`**${TIER_NAMES[questionNumber]}** secured! Continue or claim your current tier.`)
                                .setTimestamp();
                            
                            const continueButton = new ActionRowBuilder()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(`continue_${userId}_${questionNumber + 1}`)
                                        .setLabel(`➡️ Continue to Question ${questionNumber + 1}`)
                                        .setStyle(ButtonStyle.Success),
                                    new ButtonBuilder()
                                        .setCustomId(`claim_${userId}_${questionNumber}`)
                                        .setLabel(`🛡️ Secure ${TIER_NAMES[questionNumber]}`)
                                        .setStyle(ButtonStyle.Secondary)
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
                                        .setColor('#00FF00')
                                        .setTitle(`🛡️ ${TIER_NAMES[claimTier]} Secured!`)
                                        .setDescription(`You've secured **${TIER_NAMES[claimTier]}** enhancement!`)
                                        .setTimestamp();
                                    
                                    await continueInteraction.editReply({ embeds: [claimEmbed], components: [] });
                                    continueCollector.stop();
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
                        
                        const resultEmbed = new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle('❌ Incorrect Answer')
                            .setDescription(finalTier > 0 ? 
                                `**${TIER_NAMES[finalTier]}** applied based on previous progress.\n\n**Correct Answer:** ${questionData.answer}` :
                                `Challenge failed. **Correct Answer:** ${questionData.answer}`)
                            .setTimestamp();
                        
                        await buttonInteraction.editReply({ embeds: [resultEmbed], components: [] });
                    }
                    
                    collector.stop();
                    
                } catch (error) {
                    console.error('[QUIZ] Button error:', error);
                }
            });

            collector.on('end', async (collected) => {
                if (collected.size === 0) {
                    const timeoutEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('⏰ Time\'s Up!')
                        .setDescription('Quiz timed out. Try again tomorrow!')
                        .setTimestamp();

                    await message.edit({ embeds: [timeoutEmbed], components: [] }).catch(console.error);
                }
            });

        } catch (error) {
            console.error('[QUIZ] Question error:', error);
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
            console.error('[DAILY BUFF] Check roll error:', error);
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
                return {
                    tier: tier,
                    name: tier === 0 ? 'Challenge Failed' : TIER_NAMES[tier] || 'Unknown',
                    multiplier: tier === 0 ? 'None' : 'Active'
                };
            }

            return { tier: 0, name: 'No Enhancement', multiplier: 'None' };
        } catch (error) {
            console.error('[DAILY BUFF] Get buff error:', error);
            return { tier: 0, name: 'Error', multiplier: 'None' };
        }
    },

    async applyBuffRole(userId, guildId, member, tier) {
        try {
            // Remove all buff roles first
            for (let i = 1; i <= 5; i++) {
                const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`];
                if (roleId && member.roles.cache.has(roleId)) {
                    const role = member.guild.roles.cache.get(roleId);
                    if (role) {
                        await member.roles.remove(role);
                    }
                }
            }

            // Add new role if tier > 0
            if (tier > 0) {
                const roleId = process.env[`DAILY_XP_BUFF_TIER_${tier}_ROLE`];
                if (roleId) {
                    const role = member.guild.roles.cache.get(roleId);
                    if (role) {
                        await member.roles.add(role);
                        console.log(`[DAILY BUFF] ✅ Awarded ${role.name} to ${member.user.username}`);
                    }
                }
            }

            await this.saveBuffRoll(userId, guildId, tier);

        } catch (error) {
            console.error('[DAILY BUFF] Apply role error:', error);
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

            console.log(`[DAILY BUFF] ✅ Saved tier ${tier} result for ${userId}`);

        } catch (error) {
            console.error('[DAILY BUFF] Save error:', error);
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

            console.log(`[DAILY BUFF] ❌ Saved failed attempt for ${userId}`);

        } catch (error) {
            console.error('[DAILY BUFF] Save failed error:', error);
        }
    }
};

// src/commands/daily-buff.js - Progressive 5-Question System (Main Command)

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ProgressiveQuizSystem } = require('../utils/progressiveQuizSystem');
const { getCurrentDayKey, getNextResetUnixTimestamp } = require('../utils/timezoneHelpers');

// Enhanced tier configurations (5 tiers only)
const TIER_NAMES = {
    1: 'Common',
    2: 'Rare', 
    3: 'Epic',
    4: 'Legendary',
    5: 'Divine'
};

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
                    flags: 64
                });
            }

            const hasRolledToday = await this.checkDailyRoll(userId, guildId);
            if (hasRolledToday) {
                const currentBuff = await this.getCurrentBuff(userId, guildId, member);
                const nextReset = getNextResetUnixTimestamp();
                
                const embed = new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setTitle('🎌 Daily Mastery Challenge Already Completed')
                    .setDescription(`You've already completed today's progressive challenge!\n\n**Current Enhancement:** ${currentBuff.name}\n**Status:** ${currentBuff.multiplier}\n\n*Next challenge available: <t:${nextReset}:R>*`)
                    .setFooter({ text: 'Enhancement Intelligence • Progressive Mastery System' })
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], flags: 64 });
            }

            await interaction.deferReply();
            await this.startProgressiveQuiz(interaction, userId, guildId, member);

        } catch (error) {
            console.error('[PROGRESSIVE CHALLENGE] Error in daily-buff command:', error);
            
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ **Error**\n\nSomething went wrong with the progressive challenge system. Please try again.'
                });
            } else {
                await interaction.reply({
                    content: '❌ **Error**\n\nSomething went wrong with the progressive challenge system. Please try again.',
                    flags: 64
                });
            }
        }
    },

    async startProgressiveQuiz(interaction, userId, guildId, member) {
        try {
            console.log(`[PROGRESSIVE QUIZ] Starting progressive challenge for ${interaction.user.username}`);
            await this.askProgressiveQuestion(interaction, userId, guildId, member, 1, 0);
        } catch (error) {
            console.error('[PROGRESSIVE QUIZ] Progressive quiz error:', error);
            await interaction.editReply({
                content: '❌ **Quiz Error**\n\nFailed to load progressive challenge. Please try again.'
            });
        }
    },

    async askProgressiveQuestion(interaction, userId, guildId, member, questionNumber, currentTier) {
        try {
            const quiz = new ProgressiveQuizSystem();
            const questionData = await quiz.fetchQuestionByDifficulty(questionNumber);
            
            let timeRemaining = 20;
            const quizEmbed = quiz.createQuizEmbed(questionData, questionNumber, userId, timeRemaining);
            const answerButtons = quiz.createAnswerButtons(questionData, questionNumber, userId);
            
            let message;
            if (questionNumber === 1) {
                await interaction.editReply({ embeds: [quizEmbed], components: answerButtons });
                message = await interaction.fetchReply();
            } else {
                const followUp = await interaction.followUp({ embeds: [quizEmbed], components: answerButtons });
                message = followUp;
            }

            // Handle quiz interaction
            await this.handleQuizInteraction(interaction, message, quiz, questionData, userId, guildId, member, questionNumber, currentTier);

        } catch (error) {
            console.error('[PROGRESSIVE QUIZ] Error asking question:', error);
            throw error;
        }
    },

    async handleQuizInteraction(interaction, message, quiz, questionData, userId, guildId, member, questionNumber, currentTier) {
        let timeRemaining = 20;
        
        const timerInterval = setInterval(async () => {
            timeRemaining -= 4;
            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                return;
            }
            
            try {
                const updatedEmbed = quiz.createQuizEmbed(questionData, questionNumber, userId, timeRemaining);
                const answerButtons = quiz.createAnswerButtons(questionData, questionNumber, userId);
                await message.edit({ embeds: [updatedEmbed], components: answerButtons }).catch(() => {
                    clearInterval(timerInterval);
                });
            } catch (error) {
                clearInterval(timerInterval);
            }
        }, 4000);

        const collector = message.createMessageComponentCollector({ 
            time: 20000,
            filter: (i) => i.user.id === userId && (i.customId.startsWith('progressive_quiz_') || i.customId.startsWith('progressive_stop_'))
        });

        collector.on('collect', async (buttonInteraction) => {
            try {
                clearInterval(timerInterval);
                await buttonInteraction.deferUpdate();
                
                if (buttonInteraction.customId.startsWith('progressive_stop_')) {
                    const finalTier = questionNumber - 1;
                    await this.applyBuffRole(userId, guildId, member, finalTier);
                    
                    const resultEmbed = quiz.createResultEmbed(false, questionData, finalTier, member, questionNumber, true);
                    await buttonInteraction.editReply({ embeds: [resultEmbed], components: [] });
                    collector.stop();
                    return;
                }
                
                const [, , , , , isCorrectStr] = buttonInteraction.customId.split('_');
                const isCorrect = isCorrectStr === 'true';
                
                if (isCorrect) {
                    if (questionNumber === 5) {
                        await this.applyBuffRole(userId, guildId, member, 5);
                        const resultEmbed = quiz.createResultEmbed(true, questionData, 5, member, 5);
                        await buttonInteraction.editReply({ embeds: [resultEmbed], components: [] });
                    } else {
                        await this.handleCorrectAnswer(interaction, buttonInteraction, quiz, questionData, userId, guildId, member, questionNumber);
                    }
                } else {
                    const finalTier = Math.max(0, questionNumber - 1);
                    if (finalTier > 0) {
                        await this.applyBuffRole(userId, guildId, member, finalTier);
                    } else {
                        await this.saveFailedAttempt(userId, guildId);
                    }
                    
                    const resultEmbed = quiz.createResultEmbed(false, questionData, finalTier, member, questionNumber);
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
                        `No enhancement earned. Time ran out!`)
                    .addFields({
                        name: '💡 Next Attempt',
                        value: `<t:${getNextResetUnixTimestamp()}:R>`,
                        inline: false
                    })
                    .setFooter({ text: 'Enhancement Intelligence • Progressive Challenge System' })
                    .setTimestamp();

                await message.edit({ embeds: [timeoutEmbed], components: [] }).catch(console.error);
            }
        });
    },

    async handleCorrectAnswer(interaction, buttonInteraction, quiz, questionData, userId, guildId, member, questionNumber) {
        // Implementation for continuing to next question or claiming current tier
        // This will be handled by the quiz system
    },

    // Database and utility methods
    async checkDailyRoll(userId, guildId) {
        try {
            const currentDay = getCurrentDayKey();
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
            const currentDay = getCurrentDayKey();
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

            // Fallback: check roles
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

            const currentDay = getCurrentDayKey();
            
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
            const currentDay = getCurrentDayKey();
            
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
            const currentDay = getCurrentDayKey();
            
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
                currentDay: getCurrentDayKey(),
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
            const currentDay = getCurrentDayKey();
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

// src/utils/dailyQuests.js - Simplified Quest System (Role-Only Completion)

const { EmbedBuilder } = require('discord.js');
const { getQuestTypes } = require('./questTypes');

class DailyQuests {
    constructor(database, client) {
        this.db = database;
        this.client = client;
        this.initializeDatabase();
    }

    async initializeDatabase() {
        try {
            // Create daily_quests table
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS daily_quests (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    guild_id VARCHAR(20) NOT NULL,
                    date DATE NOT NULL,
                    quest_type VARCHAR(50) NOT NULL,
                    target INTEGER NOT NULL,
                    progress INTEGER DEFAULT 0,
                    xp_reward INTEGER NOT NULL,
                    completed BOOLEAN DEFAULT false,
                    completed_at TIMESTAMP NULL,
                    metadata JSONB DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, guild_id, date, quest_type)
                )
            `);

            // Create daily_quest_completions table for tracking full completion bonuses
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS daily_quest_completions (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    guild_id VARCHAR(20) NOT NULL,
                    date DATE NOT NULL,
                    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    role_awarded BOOLEAN DEFAULT false,
                    UNIQUE(user_id, guild_id, date)
                )
            `);

            // Create indexes
            await this.db.query('CREATE INDEX IF NOT EXISTS idx_daily_quests_user_date ON daily_quests(user_id, guild_id, date)');
            await this.db.query('CREATE INDEX IF NOT EXISTS idx_daily_quest_completions_date ON daily_quest_completions(date)');

            console.log('[DAILY QUESTS] Database tables initialized successfully');
        } catch (error) {
            console.error('[DAILY QUESTS] Failed to initialize database:', error);
        }
    }

    // Get current day key using 3 AM EST reset
    getCurrentDayKey() {
        const now = new Date();
        const estOffset = this.isESTDaylightSaving(now) ? -4 : -5;
        const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
        
        if (estTime.getHours() < 3) {
            estTime.setDate(estTime.getDate() - 1);
        }
        
        return estTime.toISOString().split('T')[0];
    }

    isESTDaylightSaving(date) {
        const year = date.getFullYear();
        const march = new Date(year, 2, 1);
        const november = new Date(year, 10, 1);
        const dstStart = new Date(year, 2, (14 - march.getDay()) % 7 + 8);
        const dstEnd = new Date(year, 10, (7 - november.getDay()) % 7 + 1);
        return date >= dstStart && date < dstEnd;
    }

    getCurrentESTHour() {
        const now = new Date();
        const estOffset = this.isESTDaylightSaving(now) ? -4 : -5;
        const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
        return estTime.getHours();
    }

    // Generate daily quests for a user
    async generateDailyQuests(userId, guildId) {
        try {
            const today = this.getCurrentDayKey();
            const questTypes = getQuestTypes();
            
            // Check if user already has quests for today
            const existing = await this.db.query(
                'SELECT COUNT(*) FROM daily_quests WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [userId, guildId, today]
            );

            if (parseInt(existing.rows[0].count) > 0) {
                console.log(`[DAILY QUESTS] User ${userId} already has quests for ${today}`);
                return false;
            }

            // Select 4-5 random quest types for variety
            const questTypeKeys = Object.keys(questTypes);
            const selectedQuests = this.selectRandomQuests(questTypeKeys, 4);

            // Create quests
            for (const questType of selectedQuests) {
                const config = questTypes[questType];
                const target = Math.floor(Math.random() * (config.maxTarget - config.minTarget + 1)) + config.minTarget;
                const xpReward = config.baseXP + (target * 2); // Bonus XP based on difficulty

                await this.db.query(`
                    INSERT INTO daily_quests (user_id, guild_id, date, quest_type, target, xp_reward)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [userId, guildId, today, questType, target, xpReward]);
            }

            console.log(`[DAILY QUESTS] Generated ${selectedQuests.length} quests for user ${userId}`);
            return true;

        } catch (error) {
            console.error('[DAILY QUESTS] Error generating daily quests:', error);
            return false;
        }
    }

    selectRandomQuests(questTypes, count) {
        const shuffled = [...questTypes].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    // Get user's daily quests
    async getUserDailyQuests(userId, guildId, date = null) {
        try {
            if (!date) date = this.getCurrentDayKey();

            const result = await this.db.query(`
                SELECT * FROM daily_quests 
                WHERE user_id = $1 AND guild_id = $2 AND date = $3
                ORDER BY quest_type
            `, [userId, guildId, date]);

            return result.rows;
        } catch (error) {
            console.error('[DAILY QUESTS] Error getting user quests:', error);
            return [];
        }
    }

    // Update quest progress - same as before
    async updateQuestProgress(userId, guildId, questType, increment = 1, metadata = {}) {
        try {
            const today = this.getCurrentDayKey();
            
            // Handle special time-based quests
            if (questType === 'early_bird' || questType === 'night_owl') {
                const estHour = this.getCurrentESTHour();
                const questTypes = getQuestTypes();
                const timeWindow = questTypes[questType].timeWindow;
                
                if (questType === 'early_bird' && (estHour < timeWindow.start || estHour >= timeWindow.end)) {
                    return false;
                }
                if (questType === 'night_owl' && (estHour < timeWindow.start)) {
                    return false;
                }
            }

            // Handle social_butterfly quest (track unique channels)
            if (questType === 'social_butterfly' && metadata.channelId) {
                const existingQuest = await this.db.query(`
                    SELECT metadata FROM daily_quests 
                    WHERE user_id = $1 AND guild_id = $2 AND date = $3 AND quest_type = 'social_butterfly'
                `, [userId, guildId, today]);

                let channels = [];
                if (existingQuest.rows.length > 0 && existingQuest.rows[0].metadata?.channels) {
                    channels = existingQuest.rows[0].metadata.channels;
                }

                if (!channels.includes(metadata.channelId)) {
                    channels.push(metadata.channelId);
                    increment = channels.length;
                    
                    await this.db.query(`
                        UPDATE daily_quests 
                        SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{channels}', $1)
                        WHERE user_id = $2 AND guild_id = $3 AND date = $4 AND quest_type = 'social_butterfly'
                    `, [JSON.stringify(channels), userId, guildId, today]);
                } else {
                    return false;
                }
            }

            // Handle channel_explorer quest
            if (questType === 'channel_explorer' && metadata.channelId) {
                const existingQuest = await this.db.query(`
                    SELECT metadata FROM daily_quests 
                    WHERE user_id = $1 AND guild_id = $2 AND date = $3 AND quest_type = 'channel_explorer'
                `, [userId, guildId, today]);

                let channels = [];
                if (existingQuest.rows.length > 0 && existingQuest.rows[0].metadata?.channels) {
                    channels = existingQuest.rows[0].metadata.channels;
                }

                if (!channels.includes(metadata.channelId)) {
                    channels.push(metadata.channelId);
                    increment = channels.length;
                    
                    await this.db.query(`
                        UPDATE daily_quests 
                        SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{channels}', $1)
                        WHERE user_id = $2 AND guild_id = $3 AND date = $4 AND quest_type = 'channel_explorer'
                    `, [JSON.stringify(channels), userId, guildId, today]);
                } else {
                    return false;
                }
            }

            // Update quest progress
            const result = await this.db.query(`
                UPDATE daily_quests 
                SET progress = LEAST(progress + $1, target),
                    updated_at = CURRENT_TIMESTAMP,
                    completed = CASE WHEN progress + $1 >= target THEN true ELSE completed END,
                    completed_at = CASE WHEN progress + $1 >= target AND completed_at IS NULL THEN CURRENT_TIMESTAMP ELSE completed_at END
                WHERE user_id = $2 AND guild_id = $3 AND date = $4 AND quest_type = $5 AND completed = false
                RETURNING *
            `, [increment, userId, guildId, today, questType]);

            if (result.rows.length === 0) return false;

            const quest = result.rows[0];
            const wasJustCompleted = quest.progress >= quest.target && quest.completed;

            // If quest was just completed, award XP and post progress
            if (wasJustCompleted) {
                console.log(`[DAILY QUESTS] Quest ${questType} completed by user ${userId}`);
                
                // Award XP
                if (global.xpTracker) {
                    const user = await this.client.users.fetch(userId).catch(() => null);
                    if (user) {
                        await global.xpTracker.awardXP(userId, guildId, quest.xp_reward, 'quest', user, true);
                    }
                }

                // Post completion message
                await this.postQuestCompletion(userId, guildId, quest);

                // Check if all quests are completed
                await this.checkAllQuestsCompleted(userId, guildId);
            }

            return true;

        } catch (error) {
            console.error('[DAILY QUESTS] Error updating quest progress:', error);
            return false;
        }
    }

    // Post quest completion message to quest channel
    async postQuestCompletion(userId, guildId, quest) {
        try {
            const questChannelId = process.env.DAILY_QUEST_CHANNEL;
            if (!questChannelId || questChannelId.includes('channel_id')) return;

            const channel = await this.client.channels.fetch(questChannelId).catch(() => null);
            if (!channel || !channel.isTextBased()) return;

            const user = await this.client.users.fetch(userId).catch(() => null);
            if (!user) return;

            const questTypes = getQuestTypes();
            const questConfig = questTypes[quest.quest_type];
            if (!questConfig) return;

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ MISSION ACCOMPLISHED')
                .setDescription(`\`\`\`diff\n+ ${user.username} completed: ${questConfig.name}\n+ Objective: ${questConfig.description}\n+ Progress: ${quest.progress}/${quest.target}\n+ XP Awarded: +${quest.xp_reward}\n\`\`\``)
                .setThumbnail(user.displayAvatarURL({ size: 64 }))
                .setFooter({ text: '⚓ Marine Intelligence • Mission Complete' })
                .setTimestamp();

            await channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('[DAILY QUESTS] Error posting quest completion:', error);
        }
    }

    // Check if all quests are completed and award Quest Master role
    async checkAllQuestsCompleted(userId, guildId) {
        try {
            const today = this.getCurrentDayKey();
            
            // Get all quests for user today

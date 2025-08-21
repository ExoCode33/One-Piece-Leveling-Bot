// src/utils/quiz/DatabaseManager.js - Database Operations for Daily Quiz

const { isTestingMode, getCurrentDayKey } = require('./timezone');

class DatabaseManager {
    constructor(database) {
        this.db = database;
        this.initializeTables();
    }

    // Initialize database tables
    async initializeTables() {
        if (!this.db) {
            console.warn('[DATABASE MANAGER] No database connection available');
            return;
        }

        try {
            // Create daily_buff_rolls table for quiz completion tracking
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS daily_buff_rolls (
                    user_id VARCHAR(20) NOT NULL,
                    guild_id VARCHAR(20) NOT NULL,
                    date DATE NOT NULL,
                    tier INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, guild_id, date)
                )
            `);

            // Create daily_buff_xp_caps table for tier-specific XP caps
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS daily_buff_xp_caps (
                    user_id VARCHAR(20) NOT NULL,
                    guild_id VARCHAR(20) NOT NULL,
                    date DATE NOT NULL,
                    tier INTEGER DEFAULT 0,
                    xp_cap INTEGER DEFAULT 1500,
                    current_xp INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, guild_id, date)
                )
            `);

            console.log('[DATABASE MANAGER] ✅ Daily quiz database tables initialized');

        } catch (error) {
            console.error('[DATABASE MANAGER] Error initializing database tables:', error);
        }
    }

    // Check if user already completed quiz today
    async checkExistingQuiz(userId, guildId, date = null) {
        try {
            if (isTestingMode()) {
                console.log(`[DATABASE MANAGER] Testing mode - skipping database check for user ${userId}`);
                return null;
            }

            if (!this.db) {
                console.warn('[DATABASE MANAGER] No database connection available');
                return null;
            }

            const currentDay = date || getCurrentDayKey();
            console.log(`[DATABASE MANAGER] Checking existing quiz for user ${userId}, guild ${guildId}, day ${currentDay}`);

            const result = await this.db.query(
                'SELECT tier FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [userId, guildId, currentDay]
            );

            console.log(`[DATABASE MANAGER] Query result:`, result.rows);

            if (result.rows.length > 0) {
                const existingRecord = { tier: result.rows[0].tier };
                console.log(`[DATABASE MANAGER] Found existing record:`, existingRecord);
                return existingRecord;
            }

            console.log(`[DATABASE MANAGER] No existing record found for user ${userId}`);
            return null;

        } catch (error) {
            console.error('[DATABASE MANAGER] Error checking existing quiz:', error);
            return null;
        }
    }

    // Save quiz completion result
    async saveQuizResult(userId, guildId, tier) {
        try {
            if (isTestingMode()) {
                console.log(`[DATABASE MANAGER] Testing mode - skipping database save for tier ${tier}`);
                return;
            }

            if (!this.db) {
                console.warn('[DATABASE MANAGER] No database connection available');
                return;
            }

            const currentDay = getCurrentDayKey();

            await this.db.query(`
                INSERT INTO daily_buff_rolls (user_id, guild_id, date, tier, created_at)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, guild_id, date)
                DO UPDATE SET tier = $4, created_at = CURRENT_TIMESTAMP
            `, [userId, guildId, currentDay, tier]);

            console.log(`[DATABASE MANAGER] ✅ Saved quiz result: tier ${tier} for user ${userId}`);

        } catch (error) {
            console.error('[DATABASE MANAGER] Error saving quiz result:', error);
            throw error;
        }
    }

    // Save failed quiz attempt
    async saveFailedQuiz(userId, guildId) {
        try {
            if (isTestingMode()) {
                console.log(`[DATABASE MANAGER] Testing mode - skipping failed quiz save`);
                return;
            }

            if (!this.db) {
                console.warn('[DATABASE MANAGER] No database connection available');
                return;
            }

            const currentDay = getCurrentDayKey();

            await this.db.query(`
                INSERT INTO daily_buff_rolls (user_id, guild_id, date, tier, created_at)
                VALUES ($1, $2, $3, 0, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, guild_id, date)
                DO UPDATE SET tier = 0, created_at = CURRENT_TIMESTAMP
            `, [userId, guildId, currentDay]);

            console.log(`[DATABASE MANAGER] ✅ Saved failed quiz attempt for user ${userId}`);

        } catch (error) {
            console.error('[DATABASE MANAGER] Error saving failed quiz:', error);
            throw error;
        }
    }

    // Get tier XP cap information
    async getTierXPCap(userId, guildId, date = null) {
        try {
            if (isTestingMode()) {
                return {
                    hasCustomCap: false,
                    cap: 1500,
                    currentXP: 0,
                    tier: 0
                };
            }

            if (!this.db) {
                console.warn('[DATABASE MANAGER] No database connection available');
                return {
                    hasCustomCap: false,
                    cap: parseInt(process.env.DAILY_VOICE_XP_CAP) || 1500,
                    currentXP: 0,
                    tier: 0
                };
            }

            const currentDay = date || getCurrentDayKey();

            const result = await this.db.query(
                'SELECT tier, xp_cap, current_xp FROM daily_buff_xp_caps WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [userId, guildId, currentDay]
            );

            if (result.rows.length > 0) {
                const record = result.rows[0];
                return {
                    hasCustomCap: true,
                    cap: record.xp_cap,
                    currentXP: record.current_xp,
                    tier: record.tier
                };
            }

            // No tier-specific cap found, return default
            const defaultCap = parseInt(process.env.DAILY_VOICE_XP_CAP) || 1500;
            let currentXP = 0;

            // Try to get current XP from daily reset manager
            if (global.xpTracker?.dailyResetManager) {
                currentXP = global.xpTracker.dailyResetManager.getDailyVoiceXP(userId, guildId, currentDay);
            }

            return {
                hasCustomCap: false,
                cap: defaultCap,
                currentXP: currentXP,
                tier: 0
            };

        } catch (error) {
            console.error('[DATABASE MANAGER] Error getting tier XP cap:', error);
            return {
                hasCustomCap: false,
                cap: parseInt(process.env.DAILY_VOICE_XP_CAP) || 1500,
                currentXP: 0,
                tier: 0
            };
        }
    }

    // Update tier XP usage
    async updateTierXPUsage(userId, guildId, xpGained, date = null) {
        try {
            if (isTestingMode()) {
                console.log(`[DATABASE MANAGER] Testing mode - skipping XP usage update`);
                return;
            }

            if (!this.db) {
                console.warn('[DATABASE MANAGER] No database connection available');
                return;
            }

            const currentDay = date || getCurrentDayKey();

            await this.db.query(`
                UPDATE daily_buff_xp_caps 
                SET current_xp = current_xp + $1, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $2 AND guild_id = $3 AND date = $4
            `, [xpGained, userId, guildId, currentDay]);

            console.log(`[DATABASE MANAGER] Updated tier XP usage: +${xpGained} for user ${userId}`);

        } catch (error) {
            console.error('[DATABASE MANAGER] Error updating tier XP usage:', error);
        }
    }

    // Get quiz statistics for a guild
    async getQuizStatistics(guildId, date = null) {
        try {
            if (!this.db) {
                console.warn('[DATABASE MANAGER] No database connection available');
                return {
                    totalParticipants: 0,
                    averageTier: 0,
                    tierDistribution: {},
                    successRate: 0
                };
            }

            const currentDay = date || getCurrentDayKey();

            const result = await this.db.query(`
                SELECT 
                    COUNT(*) as total_participants,
                    AVG(tier) as average_tier,
                    tier,
                    COUNT(tier) as tier_count
                FROM daily_buff_rolls 
                WHERE guild_id = $1 AND date = $2 
                GROUP BY tier
                ORDER BY tier
            `, [guildId, currentDay]);

            const stats = {
                totalParticipants: 0,
                averageTier: 0,
                tierDistribution: {},
                successRate: 0
            };

            if (result.rows.length > 0) {
                stats.totalParticipants = result.rows.reduce((sum, row) => sum + parseInt(row.tier_count), 0);
                
                let totalTier = 0;
                let successfulParticipants = 0;

                result.rows.forEach(row => {
                    const tier = parseInt(row.tier);
                    const count = parseInt(row.tier_count);
                    
                    stats.tierDistribution[tier] = count;
                    totalTier += tier * count;
                    
                    if (tier > 0) {
                        successfulParticipants += count;
                    }
                });

                stats.averageTier = stats.totalParticipants > 0 ? totalTier / stats.totalParticipants : 0;
                stats.successRate = stats.totalParticipants > 0 ? (successfulParticipants / stats.totalParticipants) * 100 : 0;
            }

            return stats;

        } catch (error) {
            console.error('[DATABASE MANAGER] Error getting quiz statistics:', error);
            return {
                totalParticipants: 0,
                averageTier: 0,
                tierDistribution: {},
                successRate: 0
            };
        }
    }

    // Clean up old quiz data
    async cleanupOldData(daysToKeep = 30) {
        try {
            if (!this.db) {
                console.warn('[DATABASE MANAGER] No database connection available');
                return;
            }

            console.log(`[DATABASE MANAGER] Cleaning up quiz data older than ${daysToKeep} days...`);

            // Clean daily_buff_rolls
            const rollsResult = await this.db.query(
                "DELETE FROM daily_buff_rolls WHERE date < CURRENT_DATE - INTERVAL '$1 days'",
                [daysToKeep]
            );

            // Clean daily_buff_xp_caps
            const capsResult = await this.db.query(
                "DELETE FROM daily_buff_xp_caps WHERE date < CURRENT_DATE - INTERVAL '$1 days'",
                [daysToKeep]
            );

            const rollsDeleted = rollsResult.rowCount || 0;
            const capsDeleted = capsResult.rowCount || 0;

            console.log(`[DATABASE MANAGER] ✅ Cleanup complete: ${rollsDeleted} roll records, ${capsDeleted} cap records deleted`);

            return {
                rollsDeleted,
                capsDeleted,
                totalDeleted: rollsDeleted + capsDeleted
            };

        } catch (error) {
            console.error('[DATABASE MANAGER] Error during cleanup:', error);
            return {
                rollsDeleted: 0,
                capsDeleted: 0,
                totalDeleted: 0
            };
        }
    }

    // Get leaderboard for quiz performance
    async getQuizLeaderboard(guildId, date = null, limit = 10) {
        try {
            if (!this.db) {
                console.warn('[DATABASE MANAGER] No database connection available');
                return [];
            }

            const currentDay = date || getCurrentDayKey();

            const result = await this.db.query(`
                SELECT user_id, tier, created_at
                FROM daily_buff_rolls 
                WHERE guild_id = $1 AND date = $2 AND tier > 0
                ORDER BY tier DESC, created_at ASC
                LIMIT $3
            `, [guildId, currentDay, limit]);

            return result.rows.map((row, index) => ({
                rank: index + 1,
                userId: row.user_id,
                tier: row.tier,
                completedAt: row.created_at
            }));

        } catch (error) {
            console.error('[DATABASE MANAGER] Error getting quiz leaderboard:', error);
            return [];
        }
    }

    // Check if database tables exist and are properly configured
    async validateTables() {
        try {
            if (!this.db) {
                return {
                    valid: false,
                    issues: ['No database connection available']
                };
            }

            const issues = [];

            // Check if tables exist
            const tablesResult = await this.db.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('daily_buff_rolls', 'daily_buff_xp_caps')
            `);

            const existingTables = tablesResult.rows.map(row => row.table_name);

            if (!existingTables.includes('daily_buff_rolls')) {
                issues.push('daily_buff_rolls table does not exist');
            }

            if (!existingTables.includes('daily_buff_xp_caps')) {
                issues.push('daily_buff_xp_caps table does not exist');
            }

            // Check table structure if tables exist
            if (existingTables.includes('daily_buff_rolls')) {
                const columnsResult = await this.db.query(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'daily_buff_rolls'
                `);

                const requiredColumns = ['user_id', 'guild_id', 'date', 'tier', 'created_at'];
                const existingColumns = columnsResult.rows.map(row => row.column_name);

                requiredColumns.forEach(col => {
                    if (!existingColumns.includes(col)) {
                        issues.push(`daily_buff_rolls missing column: ${col}`);
                    }
                });
            }

            return {
                valid: issues.length === 0,
                issues: issues,
                existingTables: existingTables
            };

        } catch (error) {
            console.error('[DATABASE MANAGER] Error validating tables:', error);
            return {
                valid: false,
                issues: [`Database validation error: ${error.message}`]
            };
        }
    }
}

module.exports = DatabaseManager;

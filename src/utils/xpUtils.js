// src/utils/xpUtils.js - Utility Functions for XP System

async function getUserStats(xpTracker, userId, guildId) {
    try {
        const result = await xpTracker.db.query(`
            SELECT user_id, guild_id, total_xp, level, messages, reactions, voice_time, 
                   created_at, updated_at
            FROM user_levels 
            WHERE user_id = $1 AND guild_id = $2
        `, [userId, guildId]);
        
        if (result.rows.length === 0) {
            return null;
        }
        
        return result.rows[0];
    } catch (error) {
        console.error('Error getting user stats:', error);
        throw error;
    }
}

async function getUserRank(xpTracker, userId, guildId) {
    try {
        const result = await xpTracker.db.query(`
            SELECT COUNT(*) + 1 as rank
            FROM user_levels 
            WHERE guild_id = $1 AND total_xp > (
                SELECT total_xp FROM user_levels 
                WHERE user_id = $2 AND guild_id = $1
            )
        `, [guildId, userId]);
        
        return parseInt(result.rows[0].rank);
    } catch (error) {
        console.error('Error getting user rank:', error);
        return null;
    }
}

async function getLeaderboard(xpTracker, guildId, page = 1, limit = 10) {
    try {
        const offset = (page - 1) * limit;
        
        const result = await xpTracker.db.query(`
            SELECT user_id, total_xp, level, messages, reactions, voice_time
            FROM user_levels 
            WHERE guild_id = $1 
            ORDER BY total_xp DESC 
            LIMIT $2 OFFSET $3
        `, [guildId, limit, offset]);

        const countResult = await xpTracker.db.query(
            'SELECT COUNT(*) FROM user_levels WHERE guild_id = $1',
            [guildId]
        );

        const totalUsers = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalUsers / limit);

        return {
            users: result.rows.map((row, index) => ({
                userId: row.user_id,
                totalXP: row.total_xp,
                level: row.level,
                messages: row.messages,
                reactions: row.reactions,
                voiceTime: row.voice_time,
                rank: offset + index + 1
            })),
            pagination: {
                currentPage: page,
                totalPages,
                totalUsers,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1
            }
        };

    } catch (error) {
        console.error('Error getting leaderboard:', error);
        throw error;
    }
}

function isOnCooldown(xpTracker, key, cooldownMs) {
    const now = Date.now();
    const lastUse = xpTracker.cooldowns.get(key);
    return lastUse && (now - lastUse) < cooldownMs;
}

function setCooldown(xpTracker, key) {
    xpTracker.cooldowns.set(key, Date.now());
}

// Get daily voice XP statistics for a user with dynamic cap info
async function getDailyVoiceXPStats(xpTracker, userId, guildId, days = 7) {
    try {
        const result = await xpTracker.db.query(`
            SELECT date, total_xp 
            FROM daily_voice_xp 
            WHERE user_id = $1 AND guild_id = $2 AND date >= CURRENT_DATE - INTERVAL '${days} days'
            ORDER BY date DESC
        `, [userId, guildId]);

        // Get user's current cap for context
        const guild = xpTracker.client.guilds.cache.get(guildId);
        let currentCap = { cap: 1500, source: 'Default', tier: 0 };
        if (guild) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
                currentCap = xpTracker.getUserDailyXPCap(member);
            }
        }

        return {
            stats: result.rows.map(row => ({
                date: row.date,
                xp: row.total_xp
            })),
            currentCap: currentCap
        };
    } catch (error) {
        console.error('[DAILY CAP] Error getting daily voice XP stats:', error);
        return { stats: [], currentCap: { cap: 1500, source: 'Default', tier: 0 } };
    }
}

// Get guild-wide daily voice XP statistics with dynamic cap breakdown
async function getGuildDailyVoiceXPStats(xpTracker, guildId, date = null) {
    try {
        if (!date) {
            date = new Date().toISOString().split('T')[0];
        }

        const result = await xpTracker.db.query(`
            SELECT user_id, total_xp 
            FROM daily_voice_xp 
            WHERE guild_id = $1 AND date = $2
            ORDER BY total_xp DESC
        `, [guildId, date]);

        const guild = xpTracker.client.guilds.cache.get(guildId);
        let capBreakdown = {
            'Default': { count: 0, users: [], cap: parseInt(process.env.DAILY_VOICE_XP_CAP_DEFAULT) || 1500 },
            'Tier-1 XP Cap': { count: 0, users: [], cap: parseInt(process.env.DAILY_VOICE_XP_CAP_TIER_1) || 2000 },
            'Tier-2 XP Cap': { count: 0, users: [], cap: parseInt(process.env.DAILY_VOICE_XP_CAP_TIER_2) || 3000 },
            'Tier-3 XP Cap': { count: 0, users: [], cap: parseInt(process.env.DAILY_VOICE_XP_CAP_TIER_3) || 5000 },
            'Quest Master': { count: 0, users: [], cap: parseInt(process.env.DAILY_VOICE_XP_CAP_TIER_2) || 3000 }
        };

        let totalCappedUsers = 0;
        let totalUsers = result.rows.length;
        let totalXP = 0;

        // Analyze each user's cap status
        for (const row of result.rows) {
            totalXP += row.total_xp;
            
            if (guild) {
                const member = await guild.members.fetch(row.user_id).catch(() => null);
                if (member) {
                    const capInfo = xpTracker.getUserDailyXPCap(member);
                    capBreakdown[capInfo.source].count++;
                    capBreakdown[capInfo.source].users.push({
                        userId: row.user_id,
                        xp: row.total_xp,
                        cappedOut: row.total_xp >= capInfo.cap
                    });
                    
                    if (row.total_xp >= capInfo.cap) {
                        totalCappedUsers++;
                    }
                }
            }
        }

        return {
            date,
            totalUsers,
            cappedUsers: totalCappedUsers,
            cappedPercentage: totalUsers > 0 ? (totalCappedUsers / totalUsers) * 100 : 0,
            totalXP,
            averageXP: totalUsers > 0 ? totalXP / totalUsers : 0,
            capBreakdown: capBreakdown,
            topUsers: result.rows.slice(0, 10) // Top 10 users by daily voice XP
        };
    } catch (error) {
        console.error('[DAILY CAP] Error getting guild daily voice XP stats:', error);
        return null;
    }
}

module.exports = {
    getUserStats,
    getUserRank,
    getLeaderboard,
    isOnCooldown,
    setCooldown,
    getDailyVoiceXPStats,
    getGuildDailyVoiceXPStats
};

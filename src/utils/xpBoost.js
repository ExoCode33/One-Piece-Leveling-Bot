// src/utils/xpBoost.js - XP Boost Management System

class XPBoostManager {
    constructor(database) {
        this.db = database;
        this.boostCache = new Map(); // Cache for performance
        this.initializeDatabase();
    }

    async initializeDatabase() {
        try {
            // Create XP boost table if it doesn't exist
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS xp_boosts (
                    id SERIAL PRIMARY KEY,
                    guild_id VARCHAR(20) NOT NULL,
                    role_id VARCHAR(20) NOT NULL,
                    boost_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.0,
                    boost_name VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(guild_id, role_id)
                )
            `);

            // Create index for better performance
            await this.db.query('CREATE INDEX IF NOT EXISTS idx_xp_boosts_guild_role ON xp_boosts(guild_id, role_id)');
            
            console.log('[XP BOOST] Database table initialized successfully');
        } catch (error) {
            console.error('[XP BOOST ERROR] Failed to initialize database:', error);
        }
    }

    // Get all XP boosts for a guild
    async getGuildBoosts(guildId) {
        try {
            const result = await this.db.query(
                'SELECT * FROM xp_boosts WHERE guild_id = $1 ORDER BY boost_multiplier DESC',
                [guildId]
            );
            return result.rows;
        } catch (error) {
            console.error('[XP BOOST ERROR] Failed to get guild boosts:', error);
            return [];
        }
    }

    // Add or update XP boost for a role
    async setRoleBoost(guildId, roleId, multiplier, boostName = null) {
        try {
            // Validate multiplier (0.1x to 10.0x)
            if (multiplier < 0.1 || multiplier > 10.0) {
                throw new Error('Boost multiplier must be between 0.1x and 10.0x');
            }

            const result = await this.db.query(`
                INSERT INTO xp_boosts (guild_id, role_id, boost_multiplier, boost_name, updated_at)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                ON CONFLICT (guild_id, role_id)
                DO UPDATE SET
                    boost_multiplier = $3,
                    boost_name = $4,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            `, [guildId, roleId, multiplier, boostName]);

            // Clear cache for this guild
            this.boostCache.delete(guildId);

            console.log(`[XP BOOST] Set boost for role ${roleId} in guild ${guildId}: ${multiplier}x`);
            return result.rows[0];
        } catch (error) {
            console.error('[XP BOOST ERROR] Failed to set role boost:', error);
            throw error;
        }
    }

    // Remove XP boost for a role
    async removeRoleBoost(guildId, roleId) {
        try {
            const result = await this.db.query(
                'DELETE FROM xp_boosts WHERE guild_id = $1 AND role_id = $2 RETURNING *',
                [guildId, roleId]
            );

            // Clear cache for this guild
            this.boostCache.delete(guildId);

            console.log(`[XP BOOST] Removed boost for role ${roleId} in guild ${guildId}`);
            return result.rowCount > 0;
        } catch (error) {
            console.error('[XP BOOST ERROR] Failed to remove role boost:', error);
            return false;
        }
    }

    // Calculate XP multiplier for a user based on their roles
    async calculateUserBoost(guildId, member) {
        try {
            // Check cache first
            let guildBoosts = this.boostCache.get(guildId);
            
            if (!guildBoosts) {
                // Load boosts from database
                guildBoosts = await this.getGuildBoosts(guildId);
                this.boostCache.set(guildId, guildBoosts);
            }

            if (guildBoosts.length === 0) {
                return 1.0; // No boosts configured
            }

            let highestBoost = 1.0;
            let appliedBoosts = [];

            // Check each role the user has against configured boosts
            for (const boost of guildBoosts) {
                if (member.roles.cache.has(boost.role_id)) {
                    if (boost.boost_multiplier > highestBoost) {
                        highestBoost = boost.boost_multiplier;
                    }
                    appliedBoosts.push({
                        roleId: boost.role_id,
                        multiplier: boost.boost_multiplier,
                        name: boost.boost_name
                    });
                }
            }

            console.log(`[XP BOOST] User ${member.displayName} boost: ${highestBoost}x (${appliedBoosts.length} roles)`);
            return { multiplier: highestBoost, appliedBoosts };

        } catch (error) {
            console.error('[XP BOOST ERROR] Failed to calculate user boost:', error);
            return { multiplier: 1.0, appliedBoosts: [] };
        }
    }

    // Get boost info for a specific role
    async getRoleBoost(guildId, roleId) {
        try {
            const result = await this.db.query(
                'SELECT * FROM xp_boosts WHERE guild_id = $1 AND role_id = $2',
                [guildId, roleId]
            );
            return result.rows[0] || null;
        } catch (error) {
            console.error('[XP BOOST ERROR] Failed to get role boost:', error);
            return null;
        }
    }

    // Clear all boosts for a guild
    async clearGuildBoosts(guildId) {
        try {
            const result = await this.db.query(
                'DELETE FROM xp_boosts WHERE guild_id = $1',
                [guildId]
            );

            // Clear cache
            this.boostCache.delete(guildId);

            console.log(`[XP BOOST] Cleared ${result.rowCount} boosts for guild ${guildId}`);
            return result.rowCount;
        } catch (error) {
            console.error('[XP BOOST ERROR] Failed to clear guild boosts:', error);
            return 0;
        }
    }

    // Get boost statistics for a guild
    async getBoostStats(guildId) {
        try {
            const result = await this.db.query(`
                SELECT 
                    COUNT(*) as total_boosts,
                    AVG(boost_multiplier) as avg_multiplier,
                    MAX(boost_multiplier) as max_multiplier,
                    MIN(boost_multiplier) as min_multiplier
                FROM xp_boosts 
                WHERE guild_id = $1
            `, [guildId]);

            return result.rows[0];
        } catch (error) {
            console.error('[XP BOOST ERROR] Failed to get boost stats:', error);
            return { total_boosts: 0, avg_multiplier: 1.0, max_multiplier: 1.0, min_multiplier: 1.0 };
        }
    }

    // Preset boost configurations for common roles
    getPresetBoosts() {
        return {
            'premium': { multiplier: 2.0, name: 'Premium Member Boost' },
            'vip': { multiplier: 1.5, name: 'VIP Member Boost' },
            'supporter': { multiplier: 1.3, name: 'Server Supporter Boost' },
            'booster': { multiplier: 1.25, name: 'Discord Nitro Booster' },
            'active': { multiplier: 1.2, name: 'Active Member Boost' },
            'veteran': { multiplier: 1.4, name: 'Veteran Member Boost' },
            'moderator': { multiplier: 1.1, name: 'Staff Efficiency Boost' },
            'helper': { multiplier: 1.15, name: 'Community Helper Boost' }
        };
    }

    // Apply preset boost to a role
    async applyPresetBoost(guildId, roleId, presetName) {
        const presets = this.getPresetBoosts();
        const preset = presets[presetName.toLowerCase()];
        
        if (!preset) {
            throw new Error(`Unknown preset: ${presetName}. Available presets: ${Object.keys(presets).join(', ')}`);
        }

        return await this.setRoleBoost(guildId, roleId, preset.multiplier, preset.name);
    }
}

module.exports = XPBoostManager;

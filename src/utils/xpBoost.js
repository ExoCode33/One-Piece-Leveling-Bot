// src/utils/xpBoost.js - FIXED XP Boost Management System with Correct ADDITIVE STACKING

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

    // Add or update XP boost for a role with proper validation
    async setRoleBoost(guildId, roleId, multiplier, boostName = null) {
        try {
            // Validate multiplier more strictly
            const validMultiplier = parseFloat(multiplier);
            
            if (isNaN(validMultiplier)) {
                throw new Error(`Invalid multiplier value: ${multiplier}. Must be a number.`);
            }
            
            if (validMultiplier < 0.1 || validMultiplier > 10.0) {
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
            `, [guildId, roleId, validMultiplier, boostName]);

            // Clear cache for this guild
            this.boostCache.delete(guildId);

            console.log(`[XP BOOST] Set boost for role ${roleId} in guild ${guildId}: ${validMultiplier}x`);
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

    // ➕ FIXED ADDITIVE STACKING: Calculate XP multiplier for a user based on their roles
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
                return { multiplier: 1.0, appliedBoosts: [] }; // No boosts configured
            }

            // ADDITIVE STACKING: Start at 1.0, add bonus amounts
            let totalMultiplier = 1.0;
            let appliedBoosts = [];

            // Check each role the user has against configured boosts
            for (const boost of guildBoosts) {
                if (member.roles.cache.has(boost.role_id)) {
                    const boostMultiplier = parseFloat(boost.boost_multiplier);
                    
                    if (isNaN(boostMultiplier)) {
                        console.warn(`[XP BOOST WARNING] Invalid multiplier for role ${boost.role_id}: ${boost.boost_multiplier}`);
                        continue;
                    }
                    
                    // FIXED ADDITIVE: Add the bonus (multiplier - 1.0) to total
                    // Example: 1.25x role adds 0.25, 2.0x role adds 1.0
                    const bonusAmount = Math.max(0, boostMultiplier - 1.0);
                    totalMultiplier += bonusAmount;
                    
                    appliedBoosts.push({
                        roleId: boost.role_id,
                        multiplier: boostMultiplier,
                        bonusAdded: bonusAmount,
                        name: boost.boost_name
                    });
                }
            }

            // Optional: Apply maximum cap to prevent extreme stacking (adjust as needed)
            const maxMultiplier = 10.0; // Adjust this value or remove cap entirely
            let finalMultiplier = Math.max(1.0, totalMultiplier);
            const wasCapped = finalMultiplier > maxMultiplier;
            
            if (wasCapped) {
                finalMultiplier = maxMultiplier;
            }

            // FIXED: Use display name instead of username for better logging
            const displayName = member.displayName || member.user.username;
            console.log(`[XP BOOST] ${displayName} ADDITIVE boost: ${finalMultiplier.toFixed(2)}x${wasCapped ? ' (CAPPED)' : ''} (from ${appliedBoosts.length} roles)`);
            
            if (appliedBoosts.length > 0) {
                // FIXED: Show correct bonus amounts and calculation
                const boostDetails = appliedBoosts.map(b => `${b.name || 'Unknown'} (+${b.bonusAdded.toFixed(2)})`).join(', ');
                console.log(`[XP BOOST] Applied roles: ${boostDetails}`);
                
                if (appliedBoosts.length > 1) {
                    const calculation = `1.0 + ${appliedBoosts.map(b => b.bonusAdded.toFixed(2)).join(' + ')} = ${totalMultiplier.toFixed(2)}x`;
                    console.log(`[XP BOOST] Calculation: ${calculation}${wasCapped ? ` → ${finalMultiplier}x (capped)` : ''}`);
                }
            }
            
            return { 
                multiplier: finalMultiplier, 
                appliedBoosts: appliedBoosts,
                stackingMode: 'additive',
                wasCapped: wasCapped,
                uncappedMultiplier: totalMultiplier
            };

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

    // Enhanced boost statistics for additive stacking
    async getAdditiveBoostStats(guildId) {
        try {
            const boosts = await this.getGuildBoosts(guildId);
            
            if (boosts.length === 0) {
                return {
                    totalBoosts: 0,
                    maxPossibleMultiplier: 1.0,
                    averageBonus: 0,
                    totalBonus: 0
                };
            }

            // Calculate additive statistics
            let totalBonus = 0;
            let maxPossibleMultiplier = 1.0;
            
            for (const boost of boosts) {
                const bonusAmount = Math.max(0, parseFloat(boost.boost_multiplier) - 1.0);
                totalBonus += bonusAmount;
                maxPossibleMultiplier += bonusAmount;
            }

            const averageBonus = totalBonus / boosts.length;

            return {
                totalBoosts: boosts.length,
                maxPossibleMultiplier: maxPossibleMultiplier,
                averageBonus: averageBonus,
                totalBonus: totalBonus,
                stackingMode: 'additive'
            };
        } catch (error) {
            console.error('[XP BOOST ERROR] Failed to get additive boost stats:', error);
            return { totalBoosts: 0, maxPossibleMultiplier: 1.0, averageBonus: 0, totalBonus: 0 };
        }
    }

    // Preset boost configurations for common roles
    getPresetBoosts() {
        return {
            'premium': { multiplier: 2.0, name: 'Premium Member Boost' },
            'vip': { multiplier: 1.5, name: 'VIP Member Boost' },
            'supporter': { multiplier: 1.3, name: 'Server Supporter Boost' },
            'booster': { multiplier: 1.25, name: 'Discord Nitro Booster' }, // FIXED: 1.25 should add +0.25
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

    // Helper method to simulate boost calculation for planning
    simulateAdditiveBoost(multipliers) {
        if (!Array.isArray(multipliers) || multipliers.length === 0) {
            return { result: 1.0, calculation: "No boosts" };
        }

        let totalMultiplier = 1.0;
        const bonuses = [];

        for (const mult of multipliers) {
            const bonus = Math.max(0, parseFloat(mult) - 1.0);
            totalMultiplier += bonus;
            bonuses.push(bonus.toFixed(2));
        }

        const calculation = `1.0 + ${bonuses.join(' + ')} = ${totalMultiplier.toFixed(2)}x`;
        
        return {
            result: totalMultiplier,
            calculation: calculation,
            bonuses: bonuses.map(b => parseFloat(b))
        };
    }
}

module.exports = XPBoostManager;

/* 
FIXED ADDITIVE STACKING EXAMPLES:

EXAMPLE 1: VIP + Premium (CORRECTED)
- VIP Role: 1.5x (adds +0.50 bonus)
- Premium Role: 2.0x (adds +1.00 bonus)
- Result: 1.0 + 0.50 + 1.00 = 2.50x total

EXAMPLE 2: Server Booster (CORRECTED)
- Booster Role: 1.25x (adds +0.25 bonus)
- Result: 1.0 + 0.25 = 1.25x total
- Log Output: "Server Booster Boost (+0.25)" NOT "(+0.3)"

EXAMPLE 3: Multiple Small Boosts (CORRECTED)
- Supporter: 1.3x (adds +0.30)
- Booster: 1.25x (adds +0.25)  
- Active: 1.2x (adds +0.20)
- Helper: 1.15x (adds +0.15)
- Result: 1.0 + 0.30 + 0.25 + 0.20 + 0.15 = 1.90x total

FIXES APPLIED:
✅ Correct bonus calculation: (multiplier - 1.0)
✅ Accurate logging with correct values
✅ Use displayName instead of username for better readability
✅ Fixed decimal precision in logs
✅ Proper additive stacking formula

BEFORE (BROKEN):
- Server Booster: 1.25x but logs "+0.3" and shows wrong calculation

AFTER (FIXED):
- Server Booster: 1.25x logs "+0.25" and shows correct 1.25x result
*/

// src/utils/quiz/RoleManager.js - Role Management for Daily Quiz

const { isTestingMode } = require('./timezone');

class RoleManager {
    constructor() {
        // Initialize if needed
    }

    // Apply tier role to user
    async applyTier(userId, guildId, member, tier) {
        try {
            if (isTestingMode()) {
                console.log(`[ROLE MANAGER] Testing mode - skipping role application for user ${member.displayName}, tier ${tier}`);
                return;
            }
            
            console.log(`[ROLE MANAGER] Applying tier ${tier} to ${member.displayName}`);
            
            // Remove all existing tier roles (1-10)
            for (let i = 1; i <= 10; i++) {
                const roleId = process.env[`DAILY_QUIZ_TIER_${i}_ROLE`];
                if (roleId && roleId !== `role_id_${i}` && member.roles.cache.has(roleId)) {
                    const role = member.guild.roles.cache.get(roleId);
                    if (role) {
                        await member.roles.remove(role, `Daily quiz tier reset - applying tier ${tier}`);
                        console.log(`[ROLE MANAGER] Removed tier ${i} role: ${role.name}`);
                    }
                }
            }

            // Apply new tier role if tier > 0
            if (tier > 0) {
                const newRoleId = process.env[`DAILY_QUIZ_TIER_${tier}_ROLE`];
                if (newRoleId && newRoleId !== `role_id_${tier}`) {
                    const newRole = member.guild.roles.cache.get(newRoleId);
                    if (newRole) {
                        await member.roles.add(newRole, `Daily quiz completion - tier ${tier} achieved`);
                        
                        // Set tier XP cap if configured
                        await this.setTierXPCap(userId, guildId, tier);
                        
                        console.log(`[ROLE MANAGER] ✅ Applied tier ${tier} role: ${newRole.name}`);
                    } else {
                        console.warn(`[ROLE MANAGER] Tier ${tier} role not found: ${newRoleId}`);
                    }
                } else {
                    console.warn(`[ROLE MANAGER] No role configured for tier ${tier}`);
                }
            }

        } catch (error) {
            console.error('[ROLE MANAGER] Error applying tier role:', error);
            throw error;
        }
    }

    // Set tier-specific XP cap
    async setTierXPCap(userId, guildId, tier) {
        try {
            if (isTestingMode()) {
                console.log(`[ROLE MANAGER] Testing mode - skipping XP cap setting for tier ${tier}`);
                return;
            }
            
            const tierXPCap = parseInt(process.env[`DAILY_QUIZ_TIER_${tier}_XP_CAP`]);
            
            if (!tierXPCap || tierXPCap <= 0) {
                console.log(`[ROLE MANAGER] No XP cap configured for tier ${tier}`);
                return;
            }

            if (!global.xpTracker?.db) {
                console.warn('[ROLE MANAGER] No database connection available for XP cap setting');
                return;
            }

            const currentDay = this.getCurrentDay();

            // Get existing XP from default system for carryover
            let existingXP = 0;
            if (global.xpTracker?.dailyResetManager) {
                existingXP = global.xpTracker.dailyResetManager.getDailyVoiceXP(userId, guildId, currentDay);
            }

            // Create/update tier record with XP carryover
            await global.xpTracker.db.query(`
                INSERT INTO daily_buff_xp_caps (user_id, guild_id, date, tier, xp_cap, current_xp, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, guild_id, date)
                DO UPDATE SET
                    tier = $4,
                    xp_cap = $5,
                    current_xp = GREATEST(daily_buff_xp_caps.current_xp, $6),
                    updated_at = CURRENT_TIMESTAMP
            `, [userId, guildId, currentDay, tier, tierXPCap, existingXP]);

            if (existingXP > 0) {
                console.log(`[ROLE MANAGER] ✅ Set tier ${tier} XP cap with carryover: ${existingXP}/${tierXPCap} XP`);
            } else {
                console.log(`[ROLE MANAGER] ✅ Set tier ${tier} XP cap: ${tierXPCap.toLocaleString()} XP`);
            }

        } catch (error) {
            console.error('[ROLE MANAGER] Error setting tier XP cap:', error);
        }
    }

    // Get current day (helper method)
    getCurrentDay() {
        if (global.xpTracker?.dailyResetManager) {
            return global.xpTracker.dailyResetManager.getCurrentDay();
        }
        
        // Fallback implementation
        const now = new Date();
        const edtOffset = this.isEDT(now) ? -4 : -5;
        const edtTime = new Date(now.getTime() + (edtOffset * 60 * 60 * 1000));
        
        if (edtTime.getHours() < 3) {
            edtTime.setDate(edtTime.getDate() - 1);
        }
        
        return edtTime.toISOString().split('T')[0];
    }

    // Check if EDT (helper method)
    isEDT(date) {
        const year = date.getFullYear();
        const marchSecondSunday = new Date(year, 2, 8);
        marchSecondSunday.setDate(marchSecondSunday.getDate() + (7 - marchSecondSunday.getDay()));
        const novemberFirstSunday = new Date(year, 10, 1);
        novemberFirstSunday.setDate(novemberFirstSunday.getDate() + (7 - novemberFirstSunday.getDay()));
        return date >= marchSecondSunday && date < novemberFirstSunday;
    }

    // Remove all tier roles (for reset purposes)
    async removeAllTierRoles(member) {
        try {
            if (isTestingMode()) {
                console.log(`[ROLE MANAGER] Testing mode - skipping role removal for ${member.displayName}`);
                return;
            }

            let removedCount = 0;
            
            for (let i = 1; i <= 10; i++) {
                const roleId = process.env[`DAILY_QUIZ_TIER_${i}_ROLE`];
                if (roleId && roleId !== `role_id_${i}` && member.roles.cache.has(roleId)) {
                    const role = member.guild.roles.cache.get(roleId);
                    if (role) {
                        await member.roles.remove(role, 'Daily quiz role removal');
                        removedCount++;
                        console.log(`[ROLE MANAGER] Removed tier ${i} role: ${role.name}`);
                    }
                }
            }

            console.log(`[ROLE MANAGER] Removed ${removedCount} tier roles from ${member.displayName}`);
            return removedCount;

        } catch (error) {
            console.error('[ROLE MANAGER] Error removing tier roles:', error);
            throw error;
        }
    }

    // Check what tier role user currently has
    getCurrentTierRole(member) {
        try {
            for (let tier = 10; tier >= 1; tier--) { // Check from highest to lowest
                const roleId = process.env[`DAILY_QUIZ_TIER_${tier}_ROLE`];
                if (roleId && roleId !== `role_id_${tier}` && member.roles.cache.has(roleId)) {
                    const role = member.guild.roles.cache.get(roleId);
                    if (role) {
                        return {
                            tier: tier,
                            roleId: roleId,
                            roleName: role.name
                        };
                    }
                }
            }
            
            return null; // No tier role found
            
        } catch (error) {
            console.error('[ROLE MANAGER] Error checking current tier role:', error);
            return null;
        }
    }

    // Validate role configuration
    validateRoleConfiguration() {
        const issues = [];
        
        for (let tier = 1; tier <= 10; tier++) {
            const roleId = process.env[`DAILY_QUIZ_TIER_${tier}_ROLE`];
            
            if (!roleId || roleId === `role_id_${tier}`) {
                issues.push(`Tier ${tier}: No role configured (set DAILY_QUIZ_TIER_${tier}_ROLE)`);
            }
            
            const xpCap = process.env[`DAILY_QUIZ_TIER_${tier}_XP_CAP`];
            if (!xpCap || isNaN(parseInt(xpCap))) {
                issues.push(`Tier ${tier}: No XP cap configured (set DAILY_QUIZ_TIER_${tier}_XP_CAP)`);
            }
        }
        
        if (issues.length > 0) {
            console.warn('[ROLE MANAGER] Configuration issues found:');
            issues.forEach(issue => console.warn(`  - ${issue}`));
        } else {
            console.log('[ROLE MANAGER] ✅ All tier roles and XP caps configured properly');
        }
        
        return issues;
    }
}

module.exports = RoleManager;

// src/utils/voiceXPManager.js - FIXED Voice XP System with Enhanced Error Handling

class VoiceXPManager {
    constructor(xpTracker) {
        if (!xpTracker) {
            throw new Error('XPTracker instance is required for VoiceXPManager');
        }
        
        this.xpTracker = xpTracker;
        this.client = xpTracker.client;
        this.db = xpTracker.db;
        this.voiceSessions = xpTracker.voiceSessions;
        
        // ✅ CRITICAL FIX: Add validation of dependencies
        if (!this.client) {
            console.warn('[VOICE XP] Warning: Discord client not available');
        }
        
        if (!this.db) {
            console.warn('[VOICE XP] Warning: Database not available');
        }
        
        if (!this.voiceSessions) {
            console.warn('[VOICE XP] Warning: Voice sessions map not available');
        }
        
        console.log('[VOICE XP] VoiceXPManager initialized successfully');
    }

    // ✅ CRITICAL FIX: Enhanced validation and error handling
    isValidInstance() {
        return this.xpTracker && 
               this.client && 
               this.db && 
               this.voiceSessions &&
               typeof this.db.query === 'function';
    }

    // Handle voice state updates
    async handleVoiceStateUpdate(oldState, newState) {
        try {
            // ✅ CRITICAL FIX: Validate manager state before processing
            if (!this.isValidInstance()) {
                console.warn('[VOICE XP] VoiceXPManager not properly initialized, skipping voice state update');
                return;
            }
            
            const userId = newState.id || oldState.id;
            const guildId = newState.guild?.id || oldState.guild?.id;
            
            if (!guildId) {
                console.warn('[VOICE XP] No guild ID available for voice state update');
                return;
            }

            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) {
                console.warn('[VOICE XP] Guild not found in cache:', guildId);
                return;
            }

            const member = guild.members.cache.get(userId);
            if (!member || member.user.bot) {
                return; // Skip bots and non-members
            }

            // User joined a voice channel
            if (!oldState.channelId && newState.channelId) {
                console.log(`[VOICE] ${member.user.username} joined ${newState.channel.name}`);
                this.voiceSessions.set(userId, {
                    guildId,
                    channelId: newState.channelId,
                    joinTime: Date.now(),
                    lastXPTime: Date.now(),
                    isMuted: newState.mute || newState.selfMute,
                    isDeafened: newState.deaf || newState.selfDeaf
                });
            }
            // User left voice channel
            else if (oldState.channelId && !newState.channelId) {
                console.log(`[VOICE] ${member.user.username} left voice channel`);
                this.voiceSessions.delete(userId);
            }
            // User moved to different channel
            else if (oldState.channelId !== newState.channelId) {
                console.log(`[VOICE] ${member.user.username} moved to ${newState.channel.name}`);
                if (this.voiceSessions.has(userId)) {
                    const session = this.voiceSessions.get(userId);
                    session.channelId = newState.channelId;
                    session.joinTime = Date.now();
                    session.isMuted = newState.mute || newState.selfMute;
                    session.isDeafened = newState.deaf || newState.selfDeaf;
                }
            }
            // Mute/deafen state changed
            else if (oldState.channelId && newState.channelId) {
                const oldMuted = oldState.mute || oldState.selfMute;
                const newMuted = newState.mute || newState.selfMute;
                const oldDeafened = oldState.deaf || oldState.selfDeaf;
                const newDeafened = newState.deaf || newState.selfDeaf;
                
                if (oldMuted !== newMuted || oldDeafened !== newDeafened) {
                    if (this.voiceSessions.has(userId)) {
                        const session = this.voiceSessions.get(userId);
                        session.isMuted = newMuted;
                        session.isDeafened = newDeafened;
                    }
                }
            }
            
        } catch (error) {
            console.error('[VOICE XP] Error in handleVoiceStateUpdate:', error);
        }
    }

    // ✅ CRITICAL FIX: Get user's daily cap with XP carryover and enhanced validation
    async getUserDailyCap(userId, guildId, member) {
        try {
            // ✅ CRITICAL FIX: Validate parameters
            if (!userId || !guildId) {
                console.warn('[VOICE XP] Invalid parameters for getUserDailyCap');
                return this.getDefaultCapInfo();
            }
            
            // ✅ CRITICAL FIX: Validate dependencies
            if (!this.xpTracker.dailyResetManager) {
                console.warn('[VOICE XP] Daily reset manager not available');
                return this.getDefaultCapInfo();
            }
            
            const currentDay = this.xpTracker.dailyResetManager.getCurrentDay();
            
            // Check tier-specific cap from daily quiz system
            if (member) {
                // Check for tier roles (highest tier wins)
                for (let tier = 10; tier >= 1; tier--) {
                    const roleId = process.env[`DAILY_QUIZ_TIER_${tier}_ROLE`];
                    if (roleId && roleId !== `role_id_${tier}` && member.roles.cache.has(roleId)) {
                        const tierCap = parseInt(process.env[`DAILY_QUIZ_TIER_${tier}_XP_CAP`]);
                        if (tierCap && tierCap > 0) {
                            
                            // Check existing tier XP
                            const tierResult = await this.db.query(
                                'SELECT current_xp FROM daily_buff_xp_caps WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                                [userId, guildId, currentDay]
                            );

                            let currentXP = 0;

                            if (tierResult.rows.length > 0) {
                                // User already has tier record
                                currentXP = tierResult.rows[0].current_xp || 0;
                            } else {
                                // ✅ CRITICAL FIX: Check default system for existing XP to carry over
                                const defaultXP = this.xpTracker.dailyResetManager.getDailyVoiceXP(userId, guildId, currentDay);
                                
                                if (defaultXP > 0) {
                                    console.log(`[VOICE XP] 🔄 Carrying over ${defaultXP} XP from default to tier ${tier} for ${member.displayName}`);
                                    currentXP = defaultXP;
                                    
                                    // Create tier record with carried over XP
                                    await this.db.query(`
                                        INSERT INTO daily_buff_xp_caps (user_id, guild_id, date, tier, xp_cap, current_xp, created_at, updated_at)
                                        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                                        ON CONFLICT (user_id, guild_id, date)
                                        DO UPDATE SET
                                            tier = $4,
                                            xp_cap = $5,
                                            current_xp = GREATEST(daily_buff_xp_caps.current_xp, $6),
                                            updated_at = CURRENT_TIMESTAMP
                                    `, [userId, guildId, currentDay, tier, tierCap, defaultXP]);
                                } else {
                                    // No existing XP, create fresh tier record
                                    await this.db.query(`
                                        INSERT INTO daily_buff_xp_caps (user_id, guild_id, date, tier, xp_cap, current_xp, created_at, updated_at)
                                        VALUES ($1, $2, $3, $4, $5, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                                        ON CONFLICT (user_id, guild_id, date)
                                        DO UPDATE SET
                                            tier = $4,
                                            xp_cap = $5,
                                            updated_at = CURRENT_TIMESTAMP
                                    `, [userId, guildId, currentDay, tier, tierCap]);
                                }
                            }

                            console.log(`[VOICE XP] ${member.displayName} using TIER ${tier} cap: ${tierCap.toLocaleString()} XP (current: ${currentXP})`);
                            return {
                                cap: tierCap,
                                currentXP: currentXP,
                                tier: tier,
                                hasCustomCap: true,
                                capType: 'tier-specific'
                            };
                        }
                    }
                }
            }
            
            // Fall back to default cap
            const defaultCap = parseInt(process.env.DAILY_VOICE_XP_CAP) || 1500;
            const currentDailyXP = this.xpTracker.dailyResetManager.getDailyVoiceXP(userId, guildId, currentDay);
            
            console.log(`[VOICE XP] ${member?.displayName || userId} using DEFAULT cap: ${defaultCap.toLocaleString()} XP (current: ${currentDailyXP})`);
            
            return {
                cap: defaultCap,
                currentXP: currentDailyXP,
                tier: 0,
                hasCustomCap: false,
                capType: 'default'
            };
            
        } catch (error) {
            console.error('[VOICE XP] Error getting user daily cap:', error);
            return this.getDefaultCapInfo();
        }
    }

    // ✅ CRITICAL FIX: Helper method for default cap info
    getDefaultCapInfo() {
        const defaultCap = parseInt(process.env.DAILY_VOICE_XP_CAP) || 1500;
        return {
            cap: defaultCap,
            currentXP: 0,
            tier: 0,
            hasCustomCap: false,
            capType: 'error-fallback'
        };
    }

    // ✅ CRITICAL FIX: Update XP usage in correct system with validation
    async updateXPUsage(userId, guildId, xpGained, capInfo) {
        try {
            // ✅ CRITICAL FIX: Validate parameters
            if (!userId || !guildId || !capInfo || xpGained <= 0) {
                console.warn('[VOICE XP] Invalid parameters for updateXPUsage');
                return;
            }
            
            if (capInfo.hasCustomCap) {
                // Update tier-specific XP usage
                console.log(`[VOICE XP] Updating TIER ${capInfo.tier} XP usage: +${xpGained} for ${userId}`);
                const currentDay = this.xpTracker.dailyResetManager.getCurrentDay();
                
                await this.db.query(`
                    UPDATE daily_buff_xp_caps 
                    SET current_xp = current_xp + $1, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = $2 AND guild_id = $3 AND date = $4
                `, [xpGained, userId, guildId, currentDay]);
            } else {
                // Update default voice XP tracking
                console.log(`[VOICE XP] Updating DEFAULT XP usage: +${xpGained} for ${userId}`);
                const currentDay = this.xpTracker.dailyResetManager.getCurrentDay();
                const newDailyTotal = capInfo.currentXP + xpGained;
                await this.xpTracker.dailyResetManager.setDailyVoiceXP(userId, guildId, newDailyTotal, currentDay);
            }
        } catch (error) {
            console.error('[VOICE XP] Error updating XP usage:', error);
        }
    }

    // ✅ CRITICAL FIX: Process voice XP with comprehensive error handling
    async processVoiceXP() {
        try {
            // ✅ CRITICAL FIX: Validate manager state before processing
            if (!this.isValidInstance()) {
                console.warn('[VOICE XP] VoiceXPManager not properly initialized, skipping voice XP processing');
                return;
            }
            
            const now = Date.now();
            const voiceXPCooldown = parseInt(process.env.VOICE_COOLDOWN) || 60000;
            const minMembers = parseInt(process.env.VOICE_MIN_MEMBERS) || 2;
            const antiAFK = process.env.VOICE_ANTI_AFK === 'true';

            // ✅ CRITICAL FIX: Check if voiceSessions is available and not empty
            if (!this.voiceSessions || this.voiceSessions.size === 0) {
                // This is normal when no one is in voice channels
                return;
            }

            for (const [userId, session] of this.voiceSessions.entries()) {
                try {
                    // Check cooldown
                    if (now - session.lastXPTime < voiceXPCooldown) {
                        continue;
                    }

                    const guild = this.client.guilds.cache.get(session.guildId);
                    if (!guild) {
                        this.voiceSessions.delete(userId);
                        continue;
                    }

                    const channel = guild.channels.cache.get(session.channelId);
                    if (!channel) {
                        this.voiceSessions.delete(userId);
                        continue;
                    }

                    // Check minimum member requirement
                    const memberCount = channel.members.filter(m => !m.user.bot).size;
                    if (memberCount < minMembers) {
                        continue;
                    }

                    const user = await this.client.users.fetch(userId).catch(() => null);
                    if (!user) continue;

                    const member = await guild.members.fetch(userId).catch(() => null);
                    if (!member) continue;

                    // ✅ CRITICAL FIX: Get cap info with XP carryover
                    const capInfo = await this.getUserDailyCap(userId, session.guildId, member);
                    const dailyCap = capInfo.cap;
                    const currentDailyXP = capInfo.currentXP;
                    
                    if (currentDailyXP >= dailyCap) {
                        console.log(`[VOICE XP] ${member.displayName} reached ${capInfo.capType} cap: ${currentDailyXP}/${dailyCap} (tier ${capInfo.tier})`);
                        continue;
                    }

                    // Calculate base XP
                    const voiceXPMin = parseInt(process.env.VOICE_XP_MIN) || 45;
                    const voiceXPMax = parseInt(process.env.VOICE_XP_MAX) || 55;
                    const baseXP = Math.floor(Math.random() * (voiceXPMax - voiceXPMin + 1)) + voiceXPMin;

                    let finalXP = baseXP;

                    // Apply mute/deafen penalty with exemptions
                    if (antiAFK && (session.isMuted || session.isDeafened)) {
                        const exemptUsers = process.env.VOICE_MUTE_EXEMPT_USERS?.split(',') || [];
                        const exemptUser = process.env.VOICE_MUTE_EXEMPT_USER;
                        const exemptRoles = process.env.VOICE_MUTE_EXEMPT_ROLES?.split(',') || [];
                        const exemptMultiplier = parseFloat(process.env.VOICE_MUTE_EXEMPT_MULTIPLIER) || 1.0;
                        
                        let isExempt = false;
                        
                        // Check user exemptions
                        if (exemptUsers.includes(userId) || userId === exemptUser) {
                            isExempt = true;
                            finalXP = Math.round(baseXP * exemptMultiplier);
                        }
                        
                        // Check role exemptions
                        if (!isExempt && exemptRoles.length > 0) {
                            for (const roleId of exemptRoles) {
                                if (roleId && member.roles.cache.has(roleId.trim())) {
                                    isExempt = true;
                                    finalXP = Math.round(baseXP * exemptMultiplier);
                                    break;
                                }
                            }
                        }
                        
                        // Apply penalty if not exempt
                        if (!isExempt) {
                            finalXP = Math.round(baseXP * 0.25); // 25% XP when muted/deafened
                        }
                    }

                    // Apply daily cap
                    const newDailyTotal = currentDailyXP + finalXP;
                    let actualXPGain = finalXP;
                    let hitCap = false;
                    
                    if (newDailyTotal > dailyCap) {
                        actualXPGain = Math.max(0, dailyCap - currentDailyXP);
                        hitCap = true;
                    }
                    
                    if (actualXPGain <= 0) {
                        continue;
                    }

                    // ✅ CRITICAL FIX: Update the correct XP tracking system
                    await this.updateXPUsage(userId, session.guildId, actualXPGain, capInfo);

                    // ✅ CRITICAL FIX: Award the XP with validation
                    if (this.xpTracker.awardXP) {
                        await this.xpTracker.awardXP(userId, session.guildId, actualXPGain, 'voice', user, true);
                    } else {
                        console.warn('[VOICE XP] XP tracker awardXP method not available');
                    }
                    
                    // Update session timestamp
                    session.lastXPTime = now;

                    // Show correct cap information in logs
                    const finalDailyXP = currentDailyXP + actualXPGain;
                    const capLabel = capInfo.hasCustomCap ? `Tier ${capInfo.tier}` : 'Default';
                    console.log(`[VOICE XP] ${user.username}: +${actualXPGain} XP (Daily: ${finalDailyXP}/${dailyCap} ${capLabel}) ${hitCap ? '[CAP HIT]' : ''}`);

                } catch (sessionError) {
                    console.error(`[VOICE XP] Error processing user ${userId}:`, sessionError);
                    // Remove problematic session to prevent repeated errors
                    this.voiceSessions.delete(userId);
                }
            }
        } catch (error) {
            console.error('[VOICE XP] Critical error in processVoiceXP:', error);
        }
    }
}

module.exports = VoiceXPManager;

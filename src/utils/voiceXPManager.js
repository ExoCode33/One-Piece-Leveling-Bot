// src/utils/voiceXPManager.js - COMPLETE Voice XP System with Tier-Specific Daily Caps

class VoiceXPManager {
    constructor(xpTracker) {
        this.xpTracker = xpTracker;
        this.client = xpTracker.client;
        this.db = xpTracker.db;
        this.voiceSessions = xpTracker.voiceSessions;
    }

    // Handle voice state updates
    async handleVoiceStateUpdate(oldState, newState) {
        const userId = newState.id || oldState.id;
        const guildId = newState.guild?.id || oldState.guild?.id;
        
        if (!guildId) return;

        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) return;

        const member = guild.members.cache.get(userId);
        if (!member || member.user.bot) return;

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
    }

    // ✅ FIXED: Get user's daily cap based on their tier-specific boost or default
    async getUserDailyCap(userId, guildId, member) {
        try {
            // First check if user has a tier-specific XP cap from daily quiz
            const dailyQuizCommand = require('../commands/daily-quiz');
            if (dailyQuizCommand && dailyQuizCommand.getTierXPCap) {
                const tierCapInfo = await dailyQuizCommand.getTierXPCap(userId, guildId);
                
                if (tierCapInfo.hasCustomCap && tierCapInfo.cap > 0) {
                    console.log(`[VOICE XP] ${member.displayName} has tier ${tierCapInfo.tier} cap: ${tierCapInfo.cap.toLocaleString()} XP`);
                    return {
                        cap: tierCapInfo.cap,
                        currentXP: tierCapInfo.currentXP,
                        tier: tierCapInfo.tier,
                        hasCustomCap: true
                    };
                }
            }
            
            // Fall back to default cap
            const defaultCap = parseInt(process.env.DAILY_VOICE_XP_CAP) || 1500;
            const currentDailyXP = this.xpTracker.dailyResetManager.getDailyVoiceXP(userId, guildId);
            
            return {
                cap: defaultCap,
                currentXP: currentDailyXP,
                tier: 0,
                hasCustomCap: false
            };
            
        } catch (error) {
            console.error('[VOICE XP] Error getting user daily cap:', error);
            const defaultCap = parseInt(process.env.DAILY_VOICE_XP_CAP) || 1500;
            const currentDailyXP = this.xpTracker.dailyResetManager.getDailyVoiceXP(userId, guildId);
            
            return {
                cap: defaultCap,
                currentXP: currentDailyXP,
                tier: 0,
                hasCustomCap: false
            };
        }
    }

    // ✅ FIXED: Update tier XP usage when user has custom cap
    async updateTierXPUsage(userId, guildId, xpGained) {
        try {
            const dailyQuizCommand = require('../commands/daily-quiz');
            if (dailyQuizCommand && dailyQuizCommand.updateTierXPUsage) {
                await dailyQuizCommand.updateTierXPUsage(userId, guildId, xpGained);
            }
        } catch (error) {
            console.error('[VOICE XP] Error updating tier XP usage:', error);
        }
    }

    // ✅ FIXED: Process voice XP with tier-specific daily caps
    async processVoiceXP() {
        const now = Date.now();
        const voiceXPCooldown = parseInt(process.env.VOICE_COOLDOWN) || 60000;
        const minMembers = parseInt(process.env.VOICE_MIN_MEMBERS) || 2;
        const antiAFK = process.env.VOICE_ANTI_AFK === 'true';
        const currentDay = this.xpTracker.dailyResetManager.getCurrentDay();

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

                // ✅ FIXED: Get user's specific daily cap (tier-specific or default)
                const capInfo = await this.getUserDailyCap(userId, session.guildId, member);
                const dailyCap = capInfo.cap;
                const currentDailyXP = capInfo.currentXP;
                
                if (currentDailyXP >= dailyCap) {
                    console.log(`[VOICE XP] ${member.displayName} reached ${capInfo.hasCustomCap ? `tier ${capInfo.tier}` : 'default'} cap: ${currentDailyXP}/${dailyCap}`);
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

                // ✅ FIXED: Apply tier-specific daily cap properly
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

                // ✅ FIXED: Update the correct daily XP tracking system
                if (capInfo.hasCustomCap) {
                    // Update tier-specific XP usage
                    await this.updateTierXPUsage(userId, session.guildId, actualXPGain);
                } else {
                    // Update regular daily voice XP tracking
                    const updatedDailyXP = currentDailyXP + actualXPGain;
                    await this.xpTracker.dailyResetManager.setDailyVoiceXP(userId, session.guildId, updatedDailyXP, currentDay);
                }

                // Award the XP (skip multiplier since this is raw voice XP)
                await this.xpTracker.awardXP(userId, session.guildId, actualXPGain, 'voice', user, true);
                
                // Update session timestamp
                session.lastXPTime = now;

                // ✅ FIXED: Show correct cap information in logs
                const finalDailyXP = currentDailyXP + actualXPGain;
                const capLabel = capInfo.hasCustomCap ? `Tier ${capInfo.tier}` : 'Default';
                console.log(`[VOICE XP] ${user.username}: +${actualXPGain} XP (Daily: ${finalDailyXP}/${dailyCap} ${capLabel}) ${hitCap ? '[CAP HIT]' : ''}`);

            } catch (error) {
                console.error(`[VOICE XP] Error processing user ${userId}:`, error);
            }
        }
    }
}

module.exports = VoiceXPManager;

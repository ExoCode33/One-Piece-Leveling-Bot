// src/utils/voiceHandler.js - Voice XP Processing Module

class VoiceHandler {
    constructor(xpTracker) {
        this.xpTracker = xpTracker;
    }

    async handleVoiceStateUpdate(oldState, newState) {
        const userId = newState.id || oldState.id;
        const guildId = newState.guild?.id || oldState.guild?.id;
        
        if (!guildId) return;

        const guild = this.xpTracker.client.guilds.cache.get(guildId);
        if (!guild) return;

        const member = guild.members.cache.get(userId);
        if (!member || member.user.bot) return;

        // User joined voice channel
        if (!oldState.channelId && newState.channelId) {
            console.log(`[VOICE] ${member.user.username} joined ${newState.channel.name}`);
            this.xpTracker.voiceSessions.set(userId, {
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
            this.xpTracker.voiceSessions.delete(userId);
        }
        // User moved between voice channels
        else if (oldState.channelId !== newState.channelId) {
            console.log(`[VOICE] ${member.user.username} moved to ${newState.channel.name}`);
            if (this.xpTracker.voiceSessions.has(userId)) {
                const session = this.xpTracker.voiceSessions.get(userId);
                session.channelId = newState.channelId;
                session.joinTime = Date.now();
                session.isMuted = newState.mute || newState.selfMute;
                session.isDeafened = newState.deaf || newState.selfDeaf;
            }
        }
        // User changed mute/deafen state
        else if (oldState.channelId && newState.channelId) {
            const oldMuted = oldState.mute || oldState.selfMute;
            const newMuted = newState.mute || newState.selfMute;
            const oldDeafened = oldState.deaf || oldState.selfDeaf;
            const newDeafened = newState.deaf || newState.selfDeaf;
            
            if (oldMuted !== newMuted || oldDeafened !== newDeafened) {
                console.log(`[VOICE] ${member.user.username} mute/deafen state changed`);
                if (this.xpTracker.voiceSessions.has(userId)) {
                    const session = this.xpTracker.voiceSessions.get(userId);
                    session.isMuted = newMuted;
                    session.isDeafened = newDeafened;
                }
            }
        }
    }

    // Process voice XP with proper daily cap implementation using SEPARATED roles
    async processVoiceXP() {
        const now = Date.now();
        const voiceXPCooldown = parseInt(process.env.VOICE_COOLDOWN) || 60000; // Default 1 minute
        const minMembers = parseInt(process.env.VOICE_MIN_MEMBERS) || 2;
        const antiAFK = process.env.VOICE_ANTI_AFK === 'true';
        const today = this.xpTracker.getCurrentDayKey(); // Use 3 AM EST reset

        console.log(`[VOICE XP] Processing voice XP for ${this.xpTracker.voiceSessions.size} active sessions (3 AM EST reset)`);

        const voiceActivities = [];
        const processedUsers = new Set(); // Track users we've already processed this cycle

        for (const [userId, session] of this.xpTracker.voiceSessions.entries()) {
            try {
                // Skip if we already processed this user this cycle
                if (processedUsers.has(userId)) continue;
                processedUsers.add(userId);

                // Check cooldown
                if (now - session.lastXPTime < voiceXPCooldown) {
                    continue;
                }

                const guild = this.xpTracker.client.guilds.cache.get(session.guildId);
                if (!guild) {
                    this.xpTracker.voiceSessions.delete(userId);
                    continue;
                }

                const channel = guild.channels.cache.get(session.channelId);
                if (!channel) {
                    this.xpTracker.voiceSessions.delete(userId);
                    continue;
                }

                // Check minimum member requirement
                const memberCount = channel.members.filter(m => !m.user.bot).size;
                if (memberCount < minMembers) {
                    console.log(`[VOICE XP] ${userId} in ${channel.name}: Not enough members (${memberCount}/${minMembers}), skipping`);
                    continue;
                }

                const user = await this.xpTracker.client.users.fetch(userId).catch(() => null);
                if (!user) continue;

                const member = await guild.members.fetch(userId).catch(() => null);
                if (!member) continue;

                // Check if user has excluded role (Pirate King)
                const guildSettings = global.guildSettings?.get(session.guildId) || { xpMultiplier: 1.0 };
                if (guildSettings.excludedRole && member.roles.cache.has(guildSettings.excludedRole)) {
                    console.log(`[VOICE XP] ${user.username} has excluded role, skipping`);
                    continue;
                }

                // NEW: Get user's dynamic daily cap based on their CAP roles
                const capInfo = this.xpTracker.getUserDailyXPCap(member);
                const dailyCap = capInfo.cap;
                
                // Check daily cap with proper key format
                const currentDailyXP = this.xpTracker.getDailyVoiceXP(userId, session.guildId, today);
                
                if (currentDailyXP >= dailyCap) {
                    console.log(`[VOICE XP] ${user.username} has reached daily cap: ${currentDailyXP}/${dailyCap} XP (${capInfo.source})`);
                    continue;
                }

                // Calculate base XP
                const voiceXPMin = parseInt(process.env.VOICE_XP_MIN) || 45;
                const voiceXPMax = parseInt(process.env.VOICE_XP_MAX) || 55;
                const baseXP = Math.floor(Math.random() * (voiceXPMax - voiceXPMin + 1)) + voiceXPMin;

                let finalXP = baseXP;

                // Apply mute/deafen penalty
                let muteMultiplier = 1.0;
                let muteReason = '';
                if (antiAFK && (session.isMuted || session.isDeafened)) {
                    // Check for exemptions
                    const exemptUsers = process.env.VOICE_MUTE_EXEMPT_USERS?.split(',') || [];
                    const exemptUser = process.env.VOICE_MUTE_EXEMPT_USER;
                    const exemptRoles = process.env.VOICE_MUTE_EXEMPT_ROLES?.split(',') || [];
                    const exemptMultiplier = parseFloat(process.env.VOICE_MUTE_EXEMPT_MULTIPLIER) || 1.0;
                    
                    let isExempt = false;
                    
                    // Check user exemptions
                    if (exemptUsers.includes(userId) || userId === exemptUser) {
                        isExempt = true;
                        muteMultiplier = exemptMultiplier;
                        muteReason = 'EXEMPT USER';
                    }
                    
                    // Check role exemptions
                    if (!isExempt && exemptRoles.length > 0) {
                        for (const roleId of exemptRoles) {
                            if (roleId && member.roles.cache.has(roleId.trim())) {
                                isExempt = true;
                                muteMultiplier = exemptMultiplier;
                                muteReason = 'EXEMPT ROLE';
                                break;
                            }
                        }
                    }
                    
                    // Apply penalty if not exempt
                    if (!isExempt) {
                        muteMultiplier = 0.25; // 25% XP when muted/deafened
                        muteReason = session.isMuted && session.isDeafened ? 'MUTED+DEAFENED' : 
                                   session.isMuted ? 'MUTED' : 'DEAFENED';
                    }
                    
                    console.log(`[VOICE XP] ${user.username} mute status: ${muteReason}, multiplier: ${muteMultiplier}x`);
                }
                
                finalXP = Math.round(baseXP * muteMultiplier);
                
                // Apply XP boosts (BUFF roles - separate from CAP roles)
                if (global.xpBoostManager && member) {
                    try {
                        const boostResult = await global.xpBoostManager.calculateUserBoost(session.guildId, member);
                        if (boostResult.multiplier > 1.0) {
                            const boostedXP = Math.round(finalXP * boostResult.multiplier);
                            console.log(`[XP BOOST] ${user.username} voice: ${finalXP} → ${boostedXP} (${boostResult.multiplier}x boost)`);
                            finalXP = boostedXP;
                        }
                    } catch (error) {
                        console.error('[XP BOOST ERROR] Failed to calculate user boost for voice:', error);
                    }
                }
                
                // Apply global multiplier
                const globalMultiplier = guildSettings.xpMultiplier || 1.0;
                if (globalMultiplier !== 1.0) {
                    const afterGlobal = Math.round(finalXP * globalMultiplier);
                    console.log(`[XP CALC] ${user.username} voice: ${finalXP} → ${afterGlobal} (${globalMultiplier}x global)`);
                    finalXP = afterGlobal;
                }

                // Apply daily cap properly with dynamic cap
                const newDailyTotal = currentDailyXP + finalXP

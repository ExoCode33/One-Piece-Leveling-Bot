// src/commands/daily-buff.js - PROFESSIONAL animation system

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// ✅ PROFESSIONAL Animation Configuration
const ANIMATION_CONFIG = {
    FRAME_DELAY: 1200,        // 1.2 seconds per frame for smooth professional feel
    TOTAL_FRAMES: 6,          // Reduced to 6 frames for better pacing
    FINAL_PAUSE: 2000         // 2 second pause before showing result
};

// Enhanced tier colors and configurations
const TIER_COLORS = {
    1: 0x22C55E, // Green
    2: 0x3B82F6, // Blue  
    3: 0x8B5CF6, // Purple
    4: 0xF59E0B, // Gold
    5: 0xF97316, // Orange
    6: 0xEF4444  // Red
};

const TIER_NAMES = {
    1: 'Marine Training Enhancement',
    2: 'Advanced Combat Protocol', 
    3: 'Elite Operations Clearance',
    4: 'Admiral Authority Access',
    5: 'Fleet Command Authorization',
    6: 'World Government Executive Access'
};

class ProfessionalBuffAnimator {
    
    // ✅ PROFESSIONAL: Create sleek, text-based animation frames
    static createProfessionalFrame(frameNumber, finalTier) {
        const phases = [
            'INITIALIZING ENHANCEMENT PROTOCOL',
            'ANALYZING MARINE CREDENTIALS', 
            'ACCESSING COMMAND DATABASES',
            'PROCESSING AUTHORIZATION LEVELS',
            'CALIBRATING ENHANCEMENT MATRIX',
            'ENHANCEMENT PROTOCOL COMPLETE'
        ];
        
        const loadingBars = [
            '▱▱▱▱▱▱▱▱▱▱',  // 0%
            '▰▰▱▱▱▱▱▱▱▱',  // 20%
            '▰▰▰▰▱▱▱▱▱▱',  // 40%
            '▰▰▰▰▰▰▱▱▱▱',  // 60%
            '▰▰▰▰▰▰▰▰▱▱',  // 80%
            '▰▰▰▰▰▰▰▰▰▰'   // 100%
        ];
        
        const statusIndicators = [
            '🔍 SCANNING...',
            '📊 ANALYZING...',
            '🔐 AUTHENTICATING...',
            '⚙️ PROCESSING...',
            '⚡ ENHANCING...',
            '✅ COMPLETE'
        ];
        
        const frameIndex = Math.min(frameNumber - 1, phases.length - 1);
        const progress = Math.round(((frameNumber) / ANIMATION_CONFIG.TOTAL_FRAMES) * 100);
        
        return {
            title: phases[frameIndex],
            loadingBar: loadingBars[frameIndex],
            status: statusIndicators[frameIndex],
            progress: progress,
            isComplete: frameNumber === ANIMATION_CONFIG.TOTAL_FRAMES
        };
    }

    static createLoadingEmbed(currentFrame, finalTier) {
        const frameData = this.createProfessionalFrame(currentFrame, finalTier);
        const tierColor = TIER_COLORS[finalTier];
        
        // Professional color progression
        let embedColor = 0x4A90E2; // Default blue
        if (currentFrame >= 5) embedColor = tierColor;
        else if (currentFrame >= 4) embedColor = 0x10B981; // Green
        else if (currentFrame >= 3) embedColor = 0xF59E0B; // Amber
        
        const embed = new EmbedBuilder()
            .setTitle('⚡ Marine Enhancement Protocol')
            .setColor(embedColor)
            .setDescription(`**${frameData.title}**\n\n\`\`\`\n${frameData.loadingBar}\n\`\`\``)
            .addFields(
                {
                    name: '📊 System Status',
                    value: `\`\`\`yaml\nStatus: ${frameData.status}\nProgress: ${frameData.progress}%\nPhase: ${currentFrame}/${ANIMATION_CONFIG.TOTAL_FRAMES}\n\`\`\``,
                    inline: true
                },
                {
                    name: '🎯 Enhancement Target',
                    value: `\`\`\`yaml\nTier: Classified\nType: Marine Protocol\nSecurity: Level ${finalTier}\n\`\`\``,
                    inline: true
                }
            );
            
        if (frameData.isComplete) {
            embed.addFields({
                name: '🚀 Protocol Status',
                value: '```diff\n+ ENHANCEMENT PROTOCOL ACTIVATED\n+ MARINE AUTHORIZATION GRANTED\n+ COMBAT EFFICIENCY INCREASED\n```',
                inline: false
            });
        }
        
        embed.setFooter({ 
            text: `Marine Enhancement Division • ${frameData.isComplete ? 'Enhancement Active' : 'Processing...'}` 
        })
        .setTimestamp();
        
        return embed;
    }

    static createResultEmbed(tier, member) {
        const tierName = TIER_NAMES[tier];
        const color = TIER_COLORS[tier];
        const nextReset = getNextResetUnixTimestamp();
        
        // Professional enhancement descriptions
        const enhancementDescriptions = {
            1: 'Basic training protocols activated. Standard enhancement operational.',
            2: 'Advanced combat systems online. Enhanced performance metrics detected.',
            3: 'Elite operational clearance granted. Superior enhancement protocols active.',
            4: 'Admiral-level authorization confirmed. Exceptional enhancement matrix deployed.',
            5: 'Fleet command protocols initiated. Elite enhancement systems operational.',
            6: 'World Government executive access granted. Maximum enhancement protocols active.'
        };
        
        const embed = new EmbedBuilder()
            .setTitle('🎖️ Enhancement Protocol Complete')
            .setColor(color)
            .setDescription(`**${tierName}**\n\n*${enhancementDescriptions[tier]}*`)
            .addFields(
                {
                    name: '📋 Enhancement Details',
                    value: `\`\`\`yaml\nTier Level: ${tier}/6\nStatus: Active\nDuration: Until Reset\nNext Reset: ${new Date(nextReset * 1000).toLocaleTimeString()}\n\`\`\``,
                    inline: true
                },
                {
                    name: '⚡ System Information',
                    value: `\`\`\`yaml\nProtocol: Marine Enhancement\nSecurity: Classified\nAuthorization: Confirmed\nEfficiency: Optimized\n\`\`\``,
                    inline: true
                },
                {
                    name: '🔄 Reset Information',
                    value: `Enhancement protocols reset daily at **3:00 AM EDT**\n\nNext reset: <t:${nextReset}:R>`,
                    inline: false
                }
            )
            .setFooter({ text: `${tierName} • Marine Enhancement Division` })
            .setTimestamp();

        return embed;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily-buff')
        .setDescription('🎖️ Access Marine Enhancement Protocol (Resets at 3:00 AM EDT)'),

    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            const member = interaction.member;

            // Check if XP tracker is available
            if (!global.xpTracker || !global.xpTracker.db) {
                return await interaction.reply({
                    content: '❌ **Enhancement System Offline**\n\nMarine Enhancement Protocol not available.',
                    flags: 64
                });
            }

            // Check if user already rolled today
            const hasRolledToday = await this.checkDailyRoll(userId, guildId);
            if (hasRolledToday) {
                const currentBuff = await this.getCurrentBuff(userId, guildId, member);
                const nextReset = getNextResetUnixTimestamp();
                
                const embed = new EmbedBuilder()
                    .setColor('#4A90E2')
                    .setTitle('🎖️ Enhancement Already Active')
                    .setDescription(`Your daily Marine Enhancement is already active.`)
                    .addFields(
                        {
                            name: '📊 Current Enhancement',
                            value: `\`\`\`yaml\nProtocol: ${currentBuff.name}\nTier: ${currentBuff.tier}/6\nStatus: Active\n\`\`\``,
                            inline: true
                        },
                        {
                            name: '🔄 Next Available',
                            value: `<t:${nextReset}:R>`,
                            inline: true
                        }
                    )
                    .setFooter({ text: 'Marine Enhancement Division' })
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], flags: 64 });
            }

            // Start the professional animation sequence
            await interaction.deferReply();
            await this.performProfessionalAnimation(interaction, userId, guildId, member);

        } catch (error) {
            console.error('[DAILY BUFF] Error in daily-buff command:', error);
            
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ **Enhancement Error**\n\nMarine Enhancement Protocol encountered an error.'
                });
            } else {
                await interaction.reply({
                    content: '❌ **Enhancement Error**\n\nMarine Enhancement Protocol encountered an error.',
                    flags: 64
                });
            }
        }
    },

    // ✅ PROFESSIONAL: Smooth, satisfying animation sequence
    async performProfessionalAnimation(interaction, userId, guildId, member) {
        const finalResult = this.calculateBuffTier();
        
        try {
            console.log(`[DAILY BUFF] Starting professional enhancement for ${interaction.user.username}, tier ${finalResult}`);
            
            // Professional animation sequence - 6 smooth frames
            for (let frame = 1; frame <= ANIMATION_CONFIG.TOTAL_FRAMES; frame++) {
                const loadingEmbed = ProfessionalBuffAnimator.createLoadingEmbed(frame, finalResult);
                
                await interaction.editReply({ embeds: [loadingEmbed] });
                
                // Smooth timing with slight variation for natural feel
                if (frame < ANIMATION_CONFIG.TOTAL_FRAMES) {
                    const delay = ANIMATION_CONFIG.FRAME_DELAY + (Math.random() * 200 - 100); // ±100ms variation
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            // Brief pause before revealing result for dramatic effect
            await new Promise(resolve => setTimeout(resolve, ANIMATION_CONFIG.FINAL_PAUSE));

            // Apply the buff role and save to database
            await this.applyBuffRole(userId, guildId, member, finalResult);
            
            // Show final professional result
            const finalEmbed = ProfessionalBuffAnimator.createResultEmbed(finalResult, member);
            await interaction.editReply({ embeds: [finalEmbed] });

        } catch (error) {
            console.error('[DAILY BUFF] Professional animation error:', error);
            await interaction.editReply({
                content: '❌ **Enhancement Failed**\n\nEnhancement protocol encountered an error.'
            });
        }
    },

    // Calculate which tier to roll (weighted probabilities)
    calculateBuffTier() {
        const random = Math.random() * 100;
        
        if (random < 45) return 1;        // 45% - Common
        else if (random < 70) return 2;   // 25% - Rare  
        else if (random < 85) return 3;   // 15% - Epic
        else if (random < 94) return 4;   // 9% - Legendary
        else if (random < 99) return 5;   // 5% - Mythical
        else return 6;                    // 1% - Divine
    },

    // [Keep all other existing methods: checkDailyRoll, getCurrentBuff, etc.]
    async checkDailyRoll(userId, guildId) {
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
            const result = await global.xpTracker.db.query(
                'SELECT * FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [userId, guildId, currentDay]
            );

            return result.rows.length > 0;
        } catch (error) {
            console.error('[DAILY BUFF] Error checking daily roll:', error);
            return false;
        }
    },

    async getCurrentBuff(userId, guildId, member) {
        try {
            const currentDay = getCurrentDayKey();
            const dbResult = await global.xpTracker.db.query(
                'SELECT tier FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [userId, guildId, currentDay]
            );

            if (dbResult.rows.length > 0) {
                const tier = dbResult.rows[0].tier;
                return {
                    tier: tier,
                    name: TIER_NAMES[tier] || `Tier ${tier}`,
                    multiplier: 'From Role Settings'
                };
            }

            return { tier: 0, name: 'No Enhancement', multiplier: 1.0 };
        } catch (error) {
            console.error('[DAILY BUFF] Error getting current buff:', error);
            return { tier: 0, name: 'No Enhancement', multiplier: 1.0 };
        }
    },

    async applyBuffRole(userId, guildId, member, tier) {
        try {
            console.log(`[DAILY BUFF] Applying tier ${tier} enhancement to ${member.user.username}`);

            // Remove any existing buff roles first
            await this.removeAllBuffRoles(member);

            // Get the role ID for this tier
            const roleId = process.env[`DAILY_XP_BUFF_TIER_${tier}_ROLE`];

            if (!roleId || roleId === `role_id_${tier}`) {
                throw new Error(`No role configured for tier ${tier}`);
            }

            // Try to find the role
            const role = member.guild.roles.cache.get(roleId);
            if (!role) {
                throw new Error(`Role ${roleId} not found in guild`);
            }

            // Add the role
            await member.roles.add(role, `Daily enhancement tier ${tier} awarded`);
            console.log(`[DAILY BUFF] ✅ Successfully awarded ${role.name} to ${member.user.username}`);

            // Save to database
            await this.saveBuffRoll(userId, guildId, tier);

        } catch (error) {
            console.error('[DAILY BUFF] ❌ Error applying buff role:', error);
            throw error;
        }
    },

    async removeAllBuffRoles(member) {
        try {
            for (let i = 1; i <= 6; i++) {
                const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`];
                if (roleId && roleId !== `role_id_${i}` && member.roles.cache.has(roleId)) {
                    const role = member.guild.roles.cache.get(roleId);
                    if (role) {
                        await member.roles.remove(role, 'Removing old daily enhancement');
                    }
                }
            }
        } catch (error) {
            console.error('[DAILY BUFF] Error removing buff roles:', error);
        }
    },

    async saveBuffRoll(userId, guildId, tier) {
        try {
            const currentDay = getCurrentDayKey();
            
            await global.xpTracker.db.query(`
                INSERT INTO daily_buff_rolls (user_id, guild_id, date, tier)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, guild_id, date)
                DO UPDATE SET tier = $4
            `, [userId, guildId, currentDay, tier]);

            console.log(`[DAILY BUFF] ✅ Saved tier ${tier} roll for ${userId} on ${currentDay}`);

        } catch (error) {
            console.error('[DAILY BUFF] ❌ Error saving buff roll:', error);
            throw error;
        }
    },

    // NEW methods for admin command compatibility
    async checkDailyBuffStatus(userId, guildId) {
        try {
            const currentDay = getCurrentDayKey();
            
            const dbResult = await global.xpTracker.db.query(
                'SELECT * FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [userId, guildId, currentDay]
            );
            
            const hasDBRecord = dbResult.rows.length > 0;
            const dbTier = hasDBRecord ? dbResult.rows[0].tier : null;
            
            const guild = global.xpTracker.client.guilds.cache.get(guildId);
            const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
            
            const currentRoles = [];
            if (member) {
                for (let i = 1; i <= 6; i++) {
                    const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`];
                    if (roleId && roleId !== `role_id_${i}` && member.roles.cache.has(roleId)) {
                        const role = member.guild.roles.cache.get(roleId);
                        currentRoles.push({
                            tier: i,
                            roleId: roleId,
                            roleName: role ? role.name : 'Unknown Role'
                        });
                    }
                }
            }
            
            return {
                hasDBRecord,
                dbTier,
                currentDay,
                currentRoles,
                member
            };
            
        } catch (error) {
            console.error('[DAILY BUFF] Error checking buff status:', error);
            return {
                hasDBRecord: false,
                dbTier: null,
                currentDay: getCurrentDayKey(),
                currentRoles: [],
                member: null,
                error: error.message
            };
        }
    },

    async forceRemoveDailyBuff(userId, guildId, reason = 'Admin removal') {
        try {
            console.log(`[DAILY BUFF ADMIN] Force removing daily buff for user ${userId}`);
            
            const currentDay = getCurrentDayKey();
            const guild = global.xpTracker.client.guilds.cache.get(guildId);
            const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
            
            let removedRoles = [];
            let dbRecordsRemoved = 0;
            
            // Remove all buff roles
            if (member) {
                for (let i = 1; i <= 6; i++) {
                    const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`];
                    if (roleId && roleId !== `role_id_${i}` && member.roles.cache.has(roleId)) {
                        const role = member.guild.roles.cache.get(roleId);
                        if (role) {
                            try {
                                await member.roles.remove(role, reason);
                                removedRoles.push(`${role.name} (Tier ${i})`);
                            } catch (error) {
                                console.error(`Failed to remove role ${role.name}:`, error.message);
                            }
                        }
                    }
                }
            }
            
            // Remove from database
            const deleteResult = await global.xpTracker.db.query(
                'DELETE FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3 RETURNING *',
                [userId, guildId, currentDay]
            );
            
            dbRecordsRemoved = deleteResult.rowCount;
            
            return {
                success: true,
                removedRoles,
                dbRecordsRemoved,
                currentDay,
                userId,
                guildId
            };
            
        } catch (error) {
            console.error('[DAILY BUFF ADMIN] Error force removing daily buff:', error);
            return {
                success: false,
                error: error.message,
                removedRoles: [],
                dbRecordsRemoved: 0
            };
        }
    }
};

// Helper functions for timezone handling
function getCurrentDayKey() {
    const now = new Date();
    const edtOffset = isEDTDaylightSaving(now) ? -4 : -5;
    const edtTime = new Date(now.getTime() + (edtOffset * 60 * 60 * 1000));
    
    if (edtTime.getHours() < 3) {
        edtTime.setDate(edtTime.getDate() - 1);
    }
    
    return edtTime.toISOString().split('T')[0];
}

function isEDTDaylightSaving(date) {
    const year = date.getFullYear();
    const march = new Date(year, 2, 1);
    const november = new Date(year, 10, 1);
    
    const dstStart = new Date(year, 2, (14 - march.getDay()) % 7 + 8);
    const dstEnd = new Date(year, 10, (7 - november.getDay()) % 7 + 1);
    
    return date >= dstStart && date < dstEnd;
}

function getNextResetUnixTimestamp() {
    const now = new Date();
    const edtOffset = isEDTDaylightSaving(now) ? -4 : -5;
    const edtTime = new Date(now.getTime() + (edtOffset * 60 * 60 * 1000));
    
    const nextReset = new Date(edtTime);
    nextReset.setHours(3, 0, 0, 0);
    
    if (edtTime.getHours() >= 3) {
        nextReset.setDate(nextReset.getDate() + 1);
    }
    
    const utcReset = new Date(nextReset.getTime() - (edtOffset * 60 * 60 * 1000));
    return Math.floor(utcReset.getTime() / 1000);
}

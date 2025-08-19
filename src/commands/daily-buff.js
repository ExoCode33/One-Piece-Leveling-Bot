// src/commands/daily-buff.js - Fixed Progress Bar Animation with Enhanced Loading Effect

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Progress Bar Animation Configuration
const ANIMATION_CONFIG = {
    PROGRESS_FRAMES: 20,      // 20 frames for smoother progress
    FRAME_DELAY: 300,         // 0.3s per frame (slower)
    BLINK_COUNT: 3,           // Blink 3 times
    BLINK_DELAY: 400,         // 0.4s per blink
    FINAL_PAUSE: 800          // 0.8s pause before reveal
};

// Tier colors and names
const TIER_COLORS = {
    1: 0x22C55E, // Green - Common
    2: 0x3B82F6, // Blue - Rare
    3: 0x8B5CF6, // Purple - Epic
    4: 0xF59E0B, // Gold - Legendary
    5: 0xF97316, // Orange - Mythical
    6: 0xEF4444  // Red - Transcendent
};

const TIER_NAMES = {
    1: 'Common Enhancement',
    2: 'Rare Enhancement',
    3: 'Epic Enhancement',
    4: 'Legendary Enhancement',
    5: 'Mythical Enhancement',
    6: 'Transcendent Enhancement'
};

const XP_MULTIPLIERS = {
    1: '1.2x',
    2: '1.4x',
    3: '1.6x',
    4: '1.8x',
    5: '2.0x',
    6: '2.5x'
};

class ProgressBarAnimator {
    
    // Create enhanced progress bar with improved shading
    static createProgressBar(percentage) {
        const totalBars = 35;
        const filledBars = Math.floor((percentage / 100) * totalBars);
        
        // Enhanced shading characters for better visual depth
        const solidChar = '█';      // Fully loaded
        const heavyChar = '▉';      // 87.5% shade
        const mediumChar = '▊';     // 75% shade
        const lightChar = '▋';      // 62.5% shade
        const thinChar = '▌';       // 50% shade
        const veryThinChar = '▍';   // 37.5% shade
        const barelyChar = '▎';     // 25% shade
        const emptyChar = '░';      // Empty
        
        let progressBar = '';
        
        // Add fully filled bars
        for (let i = 0; i < filledBars; i++) {
            progressBar += solidChar;
        }
        
        // Add sophisticated transition at progress edge
        if (filledBars < totalBars && percentage > 0) {
            const partialProgress = ((percentage / 100) * totalBars) - filledBars;
            
            if (partialProgress >= 0.875) {
                progressBar += heavyChar;
            } else if (partialProgress >= 0.75) {
                progressBar += mediumChar;
            } else if (partialProgress >= 0.625) {
                progressBar += lightChar;
            } else if (partialProgress >= 0.5) {
                progressBar += thinChar;
            } else if (partialProgress >= 0.375) {
                progressBar += veryThinChar;
            } else if (partialProgress >= 0.25) {
                progressBar += barelyChar;
            } else if (partialProgress > 0) {
                progressBar += emptyChar;
            }
            
            // Add remaining empty bars
            const remainingBars = totalBars - progressBar.length;
            progressBar += emptyChar.repeat(Math.max(0, remainingBars));
        } else {
            // Add empty bars
            const remainingBars = totalBars - filledBars;
            progressBar += emptyChar.repeat(Math.max(0, remainingBars));
        }
        
        return progressBar;
    }
    
    // Create loading embed with fixed size and no random text
    static createLoadingEmbed(percentage, frame) {
        const progressBar = this.createProgressBar(percentage);
        
        // Progressive color change as it loads
        let embedColor = 0x4A90E2; // Blue
        if (percentage >= 80) embedColor = 0x10B981; // Green
        else if (percentage >= 60) embedColor = 0xF59E0B; // Amber
        else if (percentage >= 40) embedColor = 0x8B5CF6; // Purple
        
        const embed = new EmbedBuilder()
            .setTitle('Enhancement Protocol')
            .setDescription(
                `\`┌${'─'.repeat(37)}┐\`\n` +
                `\`│ ${progressBar} │\`\n` +
                `\`└${'─'.repeat(37)}┘\`\n\n` +
                `**${percentage}%**\n\n` +
                // Fixed spacing to maintain embed size
                `\u200B\n\u200B\n\u200B\n\u200B` // Invisible characters for spacing
            )
            .setColor(embedColor)
            .setTimestamp();
        
        return embed;
    }
    
    // Create blinking embed that maintains the progress bar
    static createBlinkEmbed(tier, isColorPhase) {
        const progressBar = this.createProgressBar(100);
        const tierColor = TIER_COLORS[tier];
        const tierName = TIER_NAMES[tier];
        
        const embed = new EmbedBuilder()
            .setTitle('Enhancement Protocol')
            .setDescription(
                `\`┌${'─'.repeat(37)}┐\`\n` +
                `\`│ ${progressBar} │\`\n` +
                `\`└${'─'.repeat(37)}┘\`\n\n` +
                `**100%**\n\n` +
                `${isColorPhase ? `**${tierName}**` : '**PROCESSING**'}\n` +
                `\u200B\n\u200B\n\u200B` // Maintain spacing
            )
            .setColor(isColorPhase ? tierColor : 0xFFFFFF)
            .setTimestamp();
        
        return embed;
    }
    
    // Create final reveal with progress bar still visible and details below
    static createRevealEmbed(tier, member) {
        const progressBar = this.createProgressBar(100);
        const tierColor = TIER_COLORS[tier];
        const tierName = TIER_NAMES[tier];
        const xpMultiplier = XP_MULTIPLIERS[tier];
        const nextReset = getNextResetUnixTimestamp();
        
        const embed = new EmbedBuilder()
            .setTitle('Enhancement Protocol')
            .setDescription(
                `\`┌${'─'.repeat(37)}┐\`\n` +
                `\`│ ${progressBar} │\`\n` +
                `\`└${'─'.repeat(37)}┘\`\n\n` +
                `**100%** - **COMPLETE**\n\n` +
                `**${tierName}**\n` +
                `XP Multiplier: **${xpMultiplier}**\n` +
                `Resets: <t:${nextReset}:R>`
            )
            .setColor(tierColor)
            .setTimestamp();
        
        return embed;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily-buff')
        .setDescription('⚡ Activate daily Marine Enhancement (Resets at 3:00 AM EDT)'),

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
                    .setColor(TIER_COLORS[currentBuff.tier] || 0x4A90E2)
                    .setTitle('Enhancement Already Active')
                    .addFields(
                        {
                            name: 'Current Buff',
                            value: `**${currentBuff.name}**`,
                            inline: true
                        },
                        {
                            name: 'XP Multiplier',
                            value: `**${XP_MULTIPLIERS[currentBuff.tier] || '1.0x'}**`,
                            inline: true
                        },
                        {
                            name: 'Resets In',
                            value: `<t:${nextReset}:R>`,
                            inline: true
                        }
                    )
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], flags: 64 });
            }

            // Start the progress bar animation
            await interaction.deferReply();
            await this.performProgressBarAnimation(interaction, userId, guildId, member);

        } catch (error) {
            console.error('[DAILY BUFF] Error in daily-buff command:', error);
            
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ **Enhancement Protocol Failed**\n\nSystem error occurred.'
                });
            } else {
                await interaction.reply({
                    content: '❌ **Enhancement Protocol Failed**\n\nSystem error occurred.',
                    flags: 64
                });
            }
        }
    },

    // ✅ Progress bar animation with blinking effect
    async performProgressBarAnimation(interaction, userId, guildId, member) {
        const finalResult = this.calculateBuffTier();
        
        try {
            console.log(`[DAILY BUFF] Starting progress bar enhancement for ${interaction.user.username}, tier ${finalResult}`);
            
            // PHASE 1: Progress bar loading (0% → 100%)
            for (let frame = 0; frame <= ANIMATION_CONFIG.PROGRESS_FRAMES; frame++) {
                const percentage = Math.round((frame / ANIMATION_CONFIG.PROGRESS_FRAMES) * 100);
                const loadingEmbed = ProgressBarAnimator.createLoadingEmbed(percentage, frame);
                
                await interaction.editReply({ embeds: [loadingEmbed] });
                
                if (frame < ANIMATION_CONFIG.PROGRESS_FRAMES) {
                    await new Promise(resolve => setTimeout(resolve, ANIMATION_CONFIG.FRAME_DELAY));
                }
            }

            // PHASE 2: Blinking effect (tier color ↔ white)
            for (let blink = 0; blink < ANIMATION_CONFIG.BLINK_COUNT; blink++) {
                // Show tier color
                const colorEmbed = ProgressBarAnimator.createBlinkEmbed(finalResult, true);
                await interaction.editReply({ embeds: [colorEmbed] });
                await new Promise(resolve => setTimeout(resolve, ANIMATION_CONFIG.BLINK_DELAY));
                
                // Show white (except on last blink)
                if (blink < ANIMATION_CONFIG.BLINK_COUNT - 1) {
                    const whiteEmbed = ProgressBarAnimator.createBlinkEmbed(finalResult, false);
                    await interaction.editReply({ embeds: [whiteEmbed] });
                    await new Promise(resolve => setTimeout(resolve, ANIMATION_CONFIG.BLINK_DELAY));
                }
            }

            // PHASE 3: Brief pause before reveal
            await new Promise(resolve => setTimeout(resolve, ANIMATION_CONFIG.FINAL_PAUSE));

            // Apply the buff role and save to database
            await this.applyBuffRole(userId, guildId, member, finalResult);
            
            // PHASE 4: Final minimalist reveal
            const revealEmbed = ProgressBarAnimator.createRevealEmbed(finalResult, member);
            await interaction.editReply({ embeds: [revealEmbed] });

        } catch (error) {
            console.error('[DAILY BUFF] Progress bar animation error:', error);
            await interaction.editReply({
                content: '❌ **Enhancement Failed**\n\nAnimation system malfunction.'
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
        else return 6;                    // 1% - Transcendent
    },

    // Check if user has already rolled today
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
                    multiplier: XP_MULTIPLIERS[tier] || '1.0x'
                };
            }

            return { tier: 0, name: 'No Enhancement', multiplier: '1.0x' };
        } catch (error) {
            console.error('[DAILY BUFF] Error getting current buff:', error);
            return { tier: 0, name: 'No Enhancement', multiplier: '1.0x' };
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
                console.warn(`[DAILY BUFF] No role configured for tier ${tier}`);
                // Still save to database even if no role
                await this.saveBuffRoll(userId, guildId, tier);
                return;
            }

            // Try to find the role
            const role = member.guild.roles.cache.get(roleId);
            if (!role) {
                console.warn(`[DAILY BUFF] Role ${roleId} not found in guild`);
                // Still save to database even if role not found
                await this.saveBuffRoll(userId, guildId, tier);
                return;
            }

            // Add the role
            await member.roles.add(role, `Daily enhancement tier ${tier} awarded`);
            console.log(`[DAILY BUFF] ✅ Successfully awarded ${role.name} to ${member.user.username}`);

            // Save to database
            await this.saveBuffRoll(userId, guildId, tier);

        } catch (error) {
            console.error('[DAILY BUFF] ❌ Error applying buff role:', error);
            // Still try to save to database
            try {
                await this.saveBuffRoll(userId, guildId, tier);
            } catch (saveError) {
                console.error('[DAILY BUFF] ❌ Failed to save to database:', saveError);
            }
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

    // Methods for admin command compatibility
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

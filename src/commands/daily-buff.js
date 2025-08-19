// src/commands/daily-buff.js - Complete file with Racing Stripe Progress Bar

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Racing Stripe Animation Configuration
const RACING_ANIMATION_CONFIG = {
    PROGRESS_FRAMES: 25,      // Total frames for 0-100%
    FRAME_DELAY: 200,         // Delay between frames
    COMPLETION_PAUSE: 1500    // Pause when complete
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

class RacingStripeProgressBar {
    
    // Create racing stripe progress bar based on percentage
    static createRacingStripeProgress(percentage, animationFrame = 0) {
        const totalBars = 20;
        const filledBars = Math.floor((percentage / 100) * totalBars);
        
        // Racing stripe patterns
        const pattern1 = ['▓', '▒']; // Dark/light pattern
        const pattern2 = ['▒', '▓']; // Inverted pattern
        
        // Alternate pattern based on animation frame for movement effect
        const usePattern1 = Math.floor(animationFrame / 2) % 2 === 0;
        const currentPattern = usePattern1 ? pattern1 : pattern2;
        
        let bar = '';
        
        // Fill completed portion with racing stripes
        for (let i = 0; i < filledBars; i++) {
            bar += currentPattern[i % currentPattern.length];
        }
        
        // Fill remaining with empty spaces
        bar += '░'.repeat(totalBars - filledBars);
        
        return bar;
    }
    
    // Create loading embed with racing stripe progress
    static createLoadingEmbed(percentage, animationFrame = 0) {
        const progressBar = this.createRacingStripeProgress(percentage, animationFrame);
        
        // Color progression based on percentage
        let color = 0x6B7280; // Gray
        if (percentage >= 90) color = 0x10B981; // Green
        else if (percentage >= 70) color = 0x3B82F6; // Blue
        else if (percentage >= 50) color = 0x8B5CF6; // Purple
        else if (percentage >= 25) color = 0xF59E0B; // Orange
        
        return new EmbedBuilder()
            .setTitle('🎰 Enhancement Protocol')
            .setDescription(
                `\`${progressBar}\` **${percentage}%**\n\n` +
                `Analyzing enhancement compatibility...\n` +
                `Racing stripes charging energy matrix...\n` +
                `\u200B\n\u200B` // Spacers for consistent height
            )
            .setColor(color)
            .setTimestamp();
    }
    
    // Create completion embed with full racing stripes
    static createCompletionEmbed(tier, animationFrame = 0) {
        const progressBar = this.createRacingStripeProgress(100, animationFrame);
        const tierColor = TIER_COLORS[tier];
        const tierName = TIER_NAMES[tier];
        
        return new EmbedBuilder()
            .setTitle('🎰 Enhancement Complete!')
            .setDescription(
                `\`${progressBar}\` **100%**\n\n` +
                `**${tierName}** Unlocked!\n` +
                `XP Multiplier: **${XP_MULTIPLIERS[tier]}**\n` +
                `🏁 Racing stripes at maximum velocity! 🏁`
            )
            .setColor(tierColor)
            .setTimestamp();
    }
    
    // Create final reveal embed
    static createRevealEmbed(tier) {
        const progressBar = this.createRacingStripeProgress(100, 0);
        const tierColor = TIER_COLORS[tier];
        const tierName = TIER_NAMES[tier];
        const xpMultiplier = XP_MULTIPLIERS[tier];
        const nextReset = getNextResetUnixTimestamp();
        
        return new EmbedBuilder()
            .setTitle('🏁 Enhancement Complete - Victory!')
            .setDescription(
                `\`${progressBar}\` **FINISHED!**\n\n` +
                `**${tierName}**\n` +
                `XP Multiplier: **${xpMultiplier}**\n` +
                `Resets: <t:${nextReset}:R>`
            )
            .setColor(tierColor)
            .setTimestamp();
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily-buff')
        .setDescription('🎰 Activate daily Marine Enhancement (Resets at 3:00 AM EDT)'),

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
                    .setTitle('🏁 Enhancement Already Active')
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

            // Start the racing stripe animation
            await interaction.deferReply();
            await this.performRacingStripeAnimation(interaction, userId, guildId, member);

        } catch (error) {
            console.error('[DAILY BUFF] Error:', error);
            
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

    // Racing stripe animation from 0% to 100%
    async performRacingStripeAnimation(interaction, userId, guildId, member) {
        const finalResult = this.calculateBuffTier();
        
        try {
            console.log(`[DAILY BUFF] Starting racing stripe animation for tier ${finalResult}`);
            
            // Phase 1: Racing stripe progress from 0% to 100%
            for (let frame = 0; frame <= RACING_ANIMATION_CONFIG.PROGRESS_FRAMES; frame++) {
                const percentage = Math.round((frame / RACING_ANIMATION_CONFIG.PROGRESS_FRAMES) * 100);
                const loadingEmbed = RacingStripeProgressBar.createLoadingEmbed(percentage, frame);
                
                await interaction.editReply({ embeds: [loadingEmbed] });
                
                if (frame < RACING_ANIMATION_CONFIG.PROGRESS_FRAMES) {
                    await new Promise(resolve => setTimeout(resolve, RACING_ANIMATION_CONFIG.FRAME_DELAY));
                }
            }

            // Phase 2: Show completion with animated racing stripes
            for (let celebFrame = 0; celebFrame < 8; celebFrame++) {
                const completionEmbed = RacingStripeProgressBar.createCompletionEmbed(finalResult, celebFrame);
                await interaction.editReply({ embeds: [completionEmbed] });
                
                if (celebFrame < 7) {
                    await new Promise(resolve => setTimeout(resolve, 300)); // Faster celebration animation
                }
            }

            // Apply buff
            await this.applyBuffRole(userId, guildId, member, finalResult);
            
            // Phase 3: Final reveal
            const revealEmbed = RacingStripeProgressBar.createRevealEmbed(finalResult);
            await interaction.editReply({ embeds: [revealEmbed] });

        } catch (error) {
            console.error('[DAILY BUFF] Racing stripe animation error:', error);
            await interaction.editReply({
                content: '❌ **Enhancement Failed**\n\nRacing stripe animation system malfunction.'
            });
        }
    },

    // Calculate which tier to roll
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
            // Remove existing buff roles
            await this.removeAllBuffRoles(member);

            // Get and apply new role
            const roleId = process.env[`DAILY_XP_BUFF_TIER_${tier}_ROLE`];
            if (roleId && roleId !== `role_id_${tier}`) {
                const role = member.guild.roles.cache.get(roleId);
                if (role) {
                    await member.roles.add(role, `Daily enhancement tier ${tier} awarded`);
                }
            }

            // Save to database
            await this.saveBuffRoll(userId, guildId, tier);

        } catch (error) {
            console.error('[DAILY BUFF] Error applying buff:', error);
            await this.saveBuffRoll(userId, guildId, tier);
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

        } catch (error) {
            console.error('[DAILY BUFF] Error saving buff roll:', error);
            throw error;
        }
    },

    // Admin compatibility methods
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
            
            return { hasDBRecord, dbTier, currentDay, currentRoles, member };
            
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

// Helper functions
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

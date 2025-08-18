// src/commands/daily-buff.js - Enhanced Daily XP Buff System with Rainbow Animation

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Animation Configuration
const ANIMATION_CONFIG = {
    RAINBOW_DELAY: 400,
    SPINNING_FRAMES: 8,
    REVEAL_FRAMES: 4
};

class BuffAnimator {
    static getRainbowPattern(frame, length = 15) {
        const colors = ['🟥', '🟧', '🟨', '🟩', '🟦', '🟪']; // Removed white
        const pattern = [];
        
        for (let i = 0; i < length; i++) {
            const colorIndex = (i + frame) % colors.length;
            pattern.push(colors[colorIndex]);
        }
        
        return pattern.join('');
    }

    static getRainbowColor(frame) {
        const colors = [0xFF0000, 0xFF8000, 0xFFFF00, 0x00FF00, 0x0080FF, 0x8000FF]; // Removed white
        return colors[frame % colors.length];
    }

    static createSpinningFrame(frame) {
        const pattern = this.getRainbowPattern(frame, 15);
        const color = this.getRainbowColor(frame);
        
        const embed = new EmbedBuilder()
            .setTitle('🎰 DAILY BUFF WHEEL SPINNING')
            .setDescription(
                `**Spinning the Marine enhancement wheel...**\n\n` +
                `${pattern}\n\n` +
                `**Status:** Channeling Marine technology...\n` +
                `**Energy:** Building up power reserves...`
            )
            .setColor(color)
            .setFooter({ text: 'The wheel is spinning... prepare for enhancement!' })
            .setTimestamp();
        
        return embed;
    }

    static createRevealFrame(frame, tier) {
        const pattern = this.getRainbowPattern(frame, 15);
        const color = this.getRainbowColor(frame);
        
        const isHighTier = tier >= 4;
        
        const embed = new EmbedBuilder()
            .setTitle('ENHANCEMENT DISCOVERY')
            .setDescription(
                `**${isHighTier ? 'RARE ENHANCEMENT DISCOVERED!' : 'Enhancement materializing...'}**\n\n` +
                `${pattern}\n\n` +
                `**Marine enhancement system activating...**`
            )
            .setColor(color)
            .setFooter({ text: 'Marine enhancement materializing...' })
            .setTimestamp();
        
        return embed;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily-buff')
        .setDescription('🎰 Spin the daily XP buff wheel! Resets at 3:00 AM EST'),

    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            const member = interaction.member;

            // Check if XP tracker is available
            if (!global.xpTracker || !global.xpTracker.db) {
                return await interaction.reply({
                    content: '❌ **Daily Buff System Unavailable**\n\nXP tracking system not initialized.',
                    flags: 64 // MessageFlags.Ephemeral
                });
            }

            // Check if user already rolled today
            const hasRolledToday = await this.checkDailyRoll(userId, guildId);
            if (hasRolledToday) {
                const currentBuff = await this.getCurrentBuff(userId, guildId, member);
                const nextReset = getNextResetUnixTimestamp();
                
                const embed = new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setTitle('🎰 DAILY BUFF ALREADY CLAIMED')
                    .setDescription(`You've already rolled your daily buff!\n\n**Current Buff:** ${currentBuff.name} ${currentBuff.symbol}\n**Multiplier:** ${currentBuff.multiplier}x XP\n\n*Next reset: <t:${nextReset}:R>*`)
                    .setFooter({ text: '⚓ Marine Intelligence • Daily Buff System' })
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], flags: 64 });
            }

            // Start the enhanced rainbow spinning animation
            await interaction.deferReply();
            await this.performEnhancedBuffRoll(interaction, userId, guildId, member);

        } catch (error) {
            console.error('[DAILY BUFF] Error in daily-buff command:', error);
            
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ **Error**\n\nSomething went wrong with the daily buff system. Please try again.'
                });
            } else {
                await interaction.reply({
                    content: '❌ **Error**\n\nSomething went wrong with the daily buff system. Please try again.',
                    flags: 64 // MessageFlags.Ephemeral
                });
            }
        }
    },

    // Enhanced Marine Power Enhancement animation
    async performEnhancedBuffRoll(interaction, userId, guildId, member) {
        const buffTiers = this.getBuffTiers();
        
        // Determine the final result first
        const finalResult = this.calculateBuffTier();
        const resultSymbol = buffTiers[finalResult].symbol;
        const targetColor = this.getTierColorHex(finalResult);
        
        // Phase 1: Rainbow Spinning Animation
        let frame = 0;
        for (let i = 0; i < 8; i++) {
            const spinningEmbed = BuffAnimator.createSpinningFrame(frame);
            
            await interaction.editReply({ embeds: [spinningEmbed] });
            await new Promise(resolve => setTimeout(resolve, ANIMATION_CONFIG.RAINBOW_DELAY));
            frame++;
        }
        
        // Phase 2: Reveal Animation
        for (let i = 0; i < 4; i++) {
            const revealEmbed = BuffAnimator.createRevealFrame(frame, finalResult);
            
            await interaction.editReply({ embeds: [revealEmbed] });
            await new Promise(resolve => setTimeout(resolve, ANIMATION_CONFIG.RAINBOW_DELAY));
            frame++;
        }

        // Phase 3: Final Result
        const buffInfo = buffTiers[finalResult];
        const rarityEmoji = this.getRarityEmoji(finalResult);
        const nextReset = getNextResetUnixTimestamp();
        const rainbowPattern = BuffAnimator.getRainbowPattern(frame, 15);
        
        const finalEmbed = new EmbedBuilder()
            .setColor(targetColor)
            .setTitle('MARINE ENHANCEMENT ACQUIRED!')
            .setDescription(
                `${rainbowPattern}\n\n` +
                `${rarityEmoji} **${buffInfo.name}** ${buffInfo.symbol}\n\n` +
                `${rainbowPattern}`
            )
            .addFields(
                {
                    name: 'Enhancement Details',
                    value: `**Name:** ${buffInfo.name}\n**Type:** ${this.getTierRarity(finalResult)}\n**Power:** ${buffInfo.multiplier}x XP Multiplier`,
                    inline: true
                },
                {
                    name: 'Duration Info',
                    value: `**Status:** Active Now\n**Expires:** <t:${nextReset}:R>\n**Reset:** 3:00 AM EST`,
                    inline: true
                },
                {
                    name: 'Combat Benefits',
                    value: `Enhanced training efficiency\nAll XP gains boosted by ${buffInfo.multiplier}x\nActive until reset`,
                    inline: false
                }
            )
            .setFooter({ text: `Marine Intelligence • ${buffInfo.name} Enhancement Active` })
            .setTimestamp();

        await interaction.editReply({ embeds: [finalEmbed] });

        // Apply the buff role and save to database
        await this.applyBuffRole(userId, guildId, member, finalResult);
    },

    // Get rarity emoji for marine theme
    getRarityEmoji(tier) {
        const emojis = {
            1: '🟢', // Common - Green
            2: '🔵', // Rare - Blue
            3: '🟣', // Epic - Purple
            4: '🟡', // Legendary - Gold
            5: '🟠', // Mythical - Orange
            6: '🔴'  // Divine - Red
        };
        return emojis[tier] || '🟢';
    },

    // Get tier color as hex string for embed colors
    getTierColorHex(tier) {
        const colors = {
            1: '#22C55E', // Green
            2: '#3B82F6', // Blue  
            3: '#8B5CF6', // Purple
            4: '#F59E0B', // Yellow/Gold
            5: '#F97316', // Orange
            6: '#EF4444'  // Red
        };
        return colors[tier] || '#6B7280';
    },

    // Get rarity text for each tier
    getTierRarity(tier) {
        const rarities = {
            1: 'Common (45%)',
            2: 'Rare (25%)',
            3: 'Epic (15%)',
            4: 'Legendary (9%)',
            5: 'Mythical (5%)',
            6: 'Divine (1%)'
        };
        return rarities[tier] || 'Unknown';
    },

    // Calculate which tier to roll (weighted probabilities)
    calculateBuffTier() {
        const random = Math.random() * 100;
        
        // Weighted probabilities
        if (random < 45) return 1;        // 45% - Common
        else if (random < 70) return 2;   // 25% - Rare  
        else if (random < 85) return 3;   // 15% - Epic
        else if (random < 94) return 4;   // 9% - Legendary
        else if (random < 99) return 5;   // 5% - Mythical
        else return 6;                    // 1% - Divine
    },

    // Check if user has already rolled today (EST-based)
    async checkDailyRoll(userId, guildId) {
        try {
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

    // Get current buff for a user
    async getCurrentBuff(userId, guildId, member) {
        const buffRoles = this.getBuffTiers();
        
        for (const tier of Object.keys(buffRoles)) {
            const roleId = process.env[`DAILY_XP_BUFF_TIER_${tier}_ROLE`];
            if (roleId && member.roles.cache.has(roleId)) {
                return {
                    tier: parseInt(tier),
                    name: buffRoles[tier].name,
                    symbol: buffRoles[tier].symbol,
                    multiplier: buffRoles[tier].multiplier
                };
            }
        }

        return { tier: 0, name: 'No Buff', symbol: '⚪', multiplier: 1.0 };
    },

    // Get buff tier information
    getBuffTiers() {
        return {
            1: { name: 'Marine Training', symbol: '🟢', multiplier: 1.1 },
            2: { name: 'Enhanced Drill', symbol: '🔵', multiplier: 1.2 },
            3: { name: 'Elite Protocol', symbol: '🟣', multiplier: 1.3 },
            4: { name: 'Admiral Focus', symbol: '🟡', multiplier: 1.5 },
            5: { name: 'Fleet Command', symbol: '🟠', multiplier: 1.7 },
            6: { name: 'World Government Authorization', symbol: '🔴', multiplier: 2.0 }
        };
    },

    // Apply the buff role to the user
    async applyBuffRole(userId, guildId, member, tier) {
        try {
            // Remove any existing buff roles first
            await this.removeAllBuffRoles(member);

            // Add the new buff role
            const roleId = process.env[`DAILY_XP_BUFF_TIER_${tier}_ROLE`];
            if (roleId) {
                const role = member.guild.roles.cache.get(roleId);
                if (role) {
                    await member.roles.add(role);
                    console.log(`[DAILY BUFF] ✅ Awarded ${role.name} to ${member.user.username}`);
                } else {
                    console.error(`[DAILY BUFF] ❌ Role not found: ${roleId}`);
                }
            } else {
                console.warn(`[DAILY BUFF] ⚠️ No role ID configured for tier ${tier}`);
            }

            // Save to database
            await this.saveBuffRoll(userId, guildId, tier);

        } catch (error) {
            console.error('[DAILY BUFF] ❌ Error applying buff role:', error);
        }
    },

    // Remove all buff roles from user
    async removeAllBuffRoles(member) {
        for (let i = 1; i <= 6; i++) {
            const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`];
            if (roleId && member.roles.cache.has(roleId)) {
                const role = member.guild.roles.cache.get(roleId);
                if (role) {
                    await member.roles.remove(role);
                    console.log(`[DAILY BUFF] Removed ${role.name} from ${member.user.username}`);
                }
            }
        }
    },

    // Save the buff roll to database
    async saveBuffRoll(userId, guildId, tier) {
        try {
            // Create table if it doesn't exist
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
            
            await global.xpTracker.db.query(`
                INSERT INTO daily_buff_rolls (user_id, guild_id, date, tier)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, guild_id, date)
                DO UPDATE SET tier = $4
            `, [userId, guildId, currentDay, tier]);

            console.log(`[DAILY BUFF] ✅ Saved tier ${tier} roll for ${userId} on ${currentDay}`);

        } catch (error) {
            console.error('[DAILY BUFF] ❌ Error saving buff roll:', error);
        }
    }
};

// Helper functions with proper timezone handling
function getCurrentDayKey() {
    const now = new Date();
    const estOffset = isESTDaylightSaving(now) ? -4 : -5;
    const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
    
    // If it's before 3 AM EST, consider it the previous day
    if (estTime.getHours() < 3) {
        estTime.setDate(estTime.getDate() - 1);
    }
    
    return estTime.toISOString().split('T')[0];
}

function isESTDaylightSaving(date) {
    const year = date.getFullYear();
    const march = new Date(year, 2, 1);
    const november = new Date(year, 10, 1);
    
    // DST starts second Sunday in March, ends first Sunday in November
    const dstStart = new Date(year, 2, (14 - march.getDay()) % 7 + 8);
    const dstEnd = new Date(year, 10, (7 - november.getDay()) % 7 + 1);
    
    return date >= dstStart && date < dstEnd;
}

function getNextResetUnixTimestamp() {
    const now = new Date();
    const estOffset = isESTDaylightSaving(now) ? -4 : -5;
    const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
    
    const nextReset = new Date(estTime);
    nextReset.setHours(3, 0, 0, 0);
    
    // If it's already past 3 AM today, schedule for tomorrow
    if (estTime.getHours() >= 3) {
        nextReset.setDate(nextReset.getDate() + 1);
    }
    
    // Convert back to UTC for Discord timestamp
    const utcReset = new Date(nextReset.getTime() - (estOffset * 60 * 60 * 1000));
    return Math.floor(utcReset.getTime() / 1000);
}

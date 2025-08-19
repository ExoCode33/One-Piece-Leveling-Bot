// src/commands/daily-buff.js - Updated with simple animation like summon command

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Animation configuration
const ANIMATION_CONFIG = {
    FRAME_DELAY: 700,
    TOTAL_FRAMES: 8,
    GRID_WIDTH: 18,
    GRID_HEIGHT: 9
};

// Tier colors and configurations
const TIER_COLORS = {
    1: 0x22C55E, // Green
    2: 0x3B82F6, // Blue  
    3: 0x8B5CF6, // Purple
    4: 0xF59E0B, // Gold
    5: 0xF97316, // Orange
    6: 0xEF4444  // Red
};

const TIER_EMOJIS = {
    1: '🟢', // Green
    2: '🔵', // Blue
    3: '🟣', // Purple
    4: '🟡', // Gold/Yellow
    5: '🟠', // Orange
    6: '🔴'  // Red
};

const TIER_NAMES = {
    1: 'Marine Training',
    2: 'Enhanced Drill', 
    3: 'Elite Protocol',
    4: 'Admiral Focus',
    5: 'Fleet Command',
    6: 'World Government Authorization'
};

const TIER_MULTIPLIERS = {
    1: 1.1,
    2: 1.2,
    3: 1.3,
    4: 1.5,
    5: 1.7,
    6: 2.0
};

class BuffAnimator {
    // Create a grid animation showing light emanating from center
    static createGridAnimation(frame, finalTier) {
        const width = ANIMATION_CONFIG.GRID_WIDTH;
        const height = ANIMATION_CONFIG.GRID_HEIGHT;
        const centerX = Math.floor(width / 2);
        const centerY = Math.floor(height / 2);
        
        // Create the grid
        const grid = [];
        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                row.push('⬛'); // Black square
            }
            grid.push(row);
        }
        
        if (frame <= 6) {
            // Frames 1-6: Light expanding outward from center
            const radius = frame * 1.2; // Expand radius each frame
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                    
                    if (distance <= radius) {
                        grid[y][x] = '⬜'; // White light
                    }
                }
            }
        } else if (frame === 7) {
            // Frame 7: Small explosion with rarity color
            const explosionRadius = 2;
            const tierEmoji = TIER_EMOJIS[finalTier];
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                    
                    if (distance <= explosionRadius) {
                        grid[y][x] = tierEmoji;
                    } else if (distance <= explosionRadius + 1.5) {
                        grid[y][x] = '⬜'; // White around explosion
                    }
                }
            }
        } else {
            // Frame 8: Full explosion
            const tierEmoji = TIER_EMOJIS[finalTier];
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                    
                    if (distance <= 4) {
                        grid[y][x] = tierEmoji;
                    } else if (distance <= 6) {
                        grid[y][x] = '⬜';
                    }
                }
            }
        }
        
        // Convert grid to string
        let gridString = '';
        for (let y = 0; y < height; y++) {
            gridString += grid[y].join('') + '\n';
        }
        
        return gridString.trim();
    }

    static createLoadingFrame(currentFrame, totalFrames, finalTier) {
        const progressPercent = Math.floor((currentFrame / totalFrames) * 100);
        const gridAnimation = this.createGridAnimation(currentFrame, finalTier);
        
        let statusMessage = '';
        let color = 0x4A90E2; // Default blue
        
        if (currentFrame <= 2) {
            statusMessage = '🔬 **Initializing enhancement matrix...**';
            color = 0x808080; // Gray
        } else if (currentFrame <= 4) {
            statusMessage = '⚡ **Energy building from core...**';
            color = 0xFFFF00; // Yellow
        } else if (currentFrame <= 6) {
            statusMessage = '🌟 **Power emanating outward...**';
            color = 0xFFFFFF; // White
        } else if (currentFrame === 7) {
            statusMessage = '💥 **Enhancement crystallizing...**';
            color = TIER_COLORS[finalTier];
        } else {
            statusMessage = '✨ **Enhancement complete!**';
            color = TIER_COLORS[finalTier];
        }
        
        const embed = new EmbedBuilder()
            .setTitle('⚡ Marine Enhancement Scanner')
            .setDescription(
                `${statusMessage}\n\n` +
                `\`\`\`\n${gridAnimation}\n\`\`\`\n\n` +
                `📊 **Progress:** ${progressPercent}%\n` +
                `⚡ **Status:** ${currentFrame >= 7 ? 'Enhancement stabilizing...' : 'Energy matrix expanding...'}`
            )
            .setColor(color)
            .setFooter({ text: `Processing... ${currentFrame}/${totalFrames} completed` })
            .setTimestamp();
        
        return embed;
    }

    static createResultEmbed(tier, member) {
        const tierName = TIER_NAMES[tier];
        const multiplier = TIER_MULTIPLIERS[tier];
        const color = TIER_COLORS[tier];
        const nextReset = getNextResetUnixTimestamp();
        
        const embed = new EmbedBuilder()
            .setTitle('✨ Marine Enhancement Acquired')
            .setColor(color)
            .setDescription(`**Enhancement Matrix Successfully Stabilized!**\n\n🎉 **Enhancement Complete!** 🎉`)
            .addFields(
                {
                    name: '🔬 Enhancement Analysis',
                    value: `**Classification:** ${tierName}\n**Power Amplification:** ${multiplier}x\n**Status:** Fully Crystallized`,
                    inline: true
                },
                {
                    name: '⏰ Operational Window',
                    value: `**Activated:** Right Now\n**Duration:** Until 3:00 AM EST\n**Next Reset:** <t:${nextReset}:R>\n**Status:** ✅ Active`,
                    inline: true
                },
                {
                    name: '⚡ Enhancement Effects',
                    value: `🚀 All XP gains boosted by **${multiplier}x**\n🔄 Stacks with other multipliers\n🛡️ Marine training protocols enhanced\n⭐ Active until daily reset`,
                    inline: false
                }
            )
            .setFooter({ text: `${tierName} Enhancement Active • Marine Enhancement Division` })
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
                    flags: 64
                });
            }

            // Check if user already rolled today
            const hasRolledToday = await this.checkDailyRoll(userId, guildId);
            if (hasRolledToday) {
                const currentBuff = await this.getCurrentBuff(userId, guildId, member);
                const nextReset = getNextResetUnixTimestamp();
                
                const embed = new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setTitle('🎰 Daily Buff Already Claimed')
                    .setDescription(`You've already rolled your daily buff!\n\n**Current Buff:** ${currentBuff.name}\n**Multiplier:** ${currentBuff.multiplier}x XP\n\n*Next reset: <t:${nextReset}:R>*`)
                    .setFooter({ text: 'Marine Intelligence • Daily Buff System' })
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], flags: 64 });
            }

            // Start the animation sequence
            await interaction.deferReply();
            await this.performAnimation(interaction, userId, guildId, member);

        } catch (error) {
            console.error('[DAILY BUFF] Error in daily-buff command:', error);
            
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ **Error**\n\nSomething went wrong with the daily buff system. Please try again.'
                });
            } else {
                await interaction.reply({
                    content: '❌ **Error**\n\nSomething went wrong with the daily buff system. Please try again.',
                    flags: 64
                });
            }
        }
    },

    // Simple animation sequence with grid explosion
    async performAnimation(interaction, userId, guildId, member) {
        const finalResult = this.calculateBuffTier();
        
        try {
            console.log(`[DAILY BUFF] Starting grid animation for ${interaction.user.username}, tier ${finalResult}`);
            
            // Play through animation frames with grid animation
            for (let i = 1; i <= ANIMATION_CONFIG.TOTAL_FRAMES; i++) {
                const loadingEmbed = BuffAnimator.createLoadingFrame(i, ANIMATION_CONFIG.TOTAL_FRAMES, finalResult);
                
                await interaction.editReply({ embeds: [loadingEmbed] });
                
                // Wait for delay (except for the last frame)
                if (i < ANIMATION_CONFIG.TOTAL_FRAMES) {
                    await new Promise(resolve => setTimeout(resolve, ANIMATION_CONFIG.FRAME_DELAY));
                }
            }

            // Apply the buff role and save to database
            await this.applyBuffRole(userId, guildId, member, finalResult);
            
            // Create and show final result
            const finalEmbed = BuffAnimator.createResultEmbed(finalResult, member);
            
            // Wait a moment then show the final result
            await new Promise(resolve => setTimeout(resolve, 1000));
            await interaction.editReply({ embeds: [finalEmbed] });

        } catch (error) {
            console.error('[DAILY BUFF] Animation error:', error);
            await interaction.editReply({
                content: '❌ **Animation Error**\n\nFailed to complete enhancement sequence. Please try again.'
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

    // Check if user has already rolled today
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
        const buffRoles = TIER_MULTIPLIERS;
        
        for (const tier of Object.keys(buffRoles)) {
            const roleId = process.env[`DAILY_XP_BUFF_TIER_${tier}_ROLE`];
            if (roleId && member.roles.cache.has(roleId)) {
                return {
                    tier: parseInt(tier),
                    name: TIER_NAMES[tier],
                    multiplier: TIER_MULTIPLIERS[tier]
                };
            }
        }

        return { tier: 0, name: 'No Buff', multiplier: 1.0 };
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

// Helper functions for timezone handling
function getCurrentDayKey() {
    const now = new Date();
    const estOffset = isESTDaylightSaving(now) ? -4 : -5;
    const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
    
    if (estTime.getHours() < 3) {
        estTime.setDate(estTime.getDate() - 1);
    }
    
    return estTime.toISOString().split('T')[0];
}

function isESTDaylightSaving(date) {
    const year = date.getFullYear();
    const march = new Date(year, 2, 1);
    const november = new Date(year, 10, 1);
    
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
    
    if (estTime.getHours() >= 3) {
        nextReset.setDate(nextReset.getDate() + 1);
    }
    
    const utcReset = new Date(nextReset.getTime() - (estOffset * 60 * 60 * 1000));
    return Math.floor(utcReset.getTime() / 1000);
}

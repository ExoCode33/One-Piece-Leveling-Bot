// src/commands/daily-buff.js - FIXED: Added missing getTierIntensity method

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Animation Configuration
const ANIMATION_CONFIG = {
    RAINBOW_DELAY: 180,  // Even faster for dramatic impact
    BUILDUP_FRAMES: 6,   // Shorter buildup
    EXPLOSION_FRAMES: 15, // Longer explosion for full effect
    FINAL_PAUSE: 300
};

class BuffAnimator {
    static createGrid(width = 18, height = 9, fillColor = '⬛') {
        const grid = [];
        for (let row = 0; row < height; row++) {
            const rowArray = [];
            for (let col = 0; col < width; col++) {
                rowArray.push(fillColor);
            }
            grid.push(rowArray);
        }
        return grid;
    }

    static getSquareDistanceFromCenter(x, y, centerX, centerY) {
        // Chebyshev distance for square wave pattern
        return Math.max(Math.abs(x - centerX), Math.abs(y - centerY));
    }

    static getRainbowColors() {
        return ['🟥', '🟧', '🟨', '🟩', '🟦', '🟪'];
    }

    static getTierColor(tier) {
        const tierColors = {
            1: '🟩', // Common - Green SQUARE
            2: '🟦', // Rare - Blue SQUARE
            3: '🟪', // Epic - Purple SQUARE
            4: '🟨', // Legendary - Yellow SQUARE
            5: '🟧', // Mythical - Orange SQUARE
            6: '🟥'  // Divine - Red SQUARE
        };
        return tierColors[tier] || '🟩';
    }

    static getEnergyColor(tier, intensity = 1.0) {
        // Lighter versions for energy buildup
        const energyColors = {
            1: '🟢', // Green energy
            2: '🔵', // Blue energy  
            3: '🟣', // Purple energy
            4: '🟡', // Gold energy
            5: '🟠', // Orange energy
            6: '🔴'  // Red energy
        };
        return energyColors[tier] || '🟢';
    }

    // FIXED: Added missing getTierIntensity method
    static getTierIntensity(tier) {
        const tierColor = this.getTierColor(tier);
        const energyColor = this.getEnergyColor(tier);
        
        return {
            core: tierColor,        // Brightest center
            bright: tierColor,      // High intensity
            medium: energyColor,    // Medium intensity  
            light: '⬜'            // Light intensity
        };
    }

    static createEnergyBuildupFrame(frame, tier, width = 18, height = 9) {
        const grid = this.createGrid(width, height, '⬛');
        const centerX = Math.floor(width / 2);
        const centerY = Math.floor(height / 2);
        const tierColor = this.getTierColor(tier);
        const energyColor = this.getEnergyColor(tier);
        
        // Intense energy concentration at center - building to explosion
        const coreIntensity = Math.min(frame + 1, 4);
        
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                const distance = this.getSquareDistanceFromCenter(col, row, centerX, centerY);
                
                if (distance === 0) {
                    // Always bright center
                    grid[row][col] = tierColor;
                } else if (distance <= coreIntensity) {
                    // Expanding energy core
                    grid[row][col] = Math.random() > 0.3 ? tierColor : energyColor;
                }
            }
        }
        
        // Add cross-hints in final buildup frames
        if (frame >= 4) {
            // Subtle horizontal line
            grid[centerY][centerX - 1] = energyColor;
            grid[centerY][centerX + 1] = energyColor;
            // Subtle vertical line  
            if (centerY > 0) grid[centerY - 1][centerX] = energyColor;
            if (centerY < height - 1) grid[centerY + 1][centerX] = energyColor;
        }
        
        return grid;
    }

    static createEpicExplosionFrame(frame, tier, width = 18, height = 9) {
        const grid = this.createGrid(width, height, '⬛');
        const centerX = Math.floor(width / 2);
        const centerY = Math.floor(height / 2);
        const tierColor = this.getTierColor(tier);
        const energyColor = this.getEnergyColor(tier);
        
        // Perfect cross explosion like in the gif
        const explosionRadius = Math.min(frame * 1.2, Math.max(centerX, centerY));
        const beamLength = Math.min(frame * 2, Math.max(width, height));
        
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                const distance = this.getSquareDistanceFromCenter(col, row, centerX, centerY);
                
                // Central explosion core
                if (distance <= explosionRadius) {
                    grid[row][col] = tierColor;
                }
                
                // Perfect horizontal beam (full width)
                if (row === centerY && Math.abs(col - centerX) <= beamLength) {
                    grid[row][col] = tierColor;
                    // Add beam thickness
                    if (row > 0) grid[row - 1][col] = energyColor;
                    if (row < height - 1) grid[row + 1][col] = energyColor;
                }
                
                // Perfect vertical beam (full height)
                if (col === centerX && Math.abs(row - centerY) <= beamLength) {
                    grid[row][col] = tierColor;
                    // Add beam thickness
                    if (col > 0) grid[row][col - 1] = energyColor;
                    if (col < width - 1) grid[row][col + 1] = energyColor;
                }
            }
        }
        
        // Add energy rings around the explosion
        if (frame > 3) {
            const ringRadius = explosionRadius + 1;
            for (let row = 0; row < height; row++) {
                for (let col = 0; col < width; col++) {
                    const distance = this.getSquareDistanceFromCenter(col, row, centerX, centerY);
                    if (distance === ringRadius && Math.random() > 0.4) {
                        grid[row][col] = energyColor;
                    }
                }
            }
        }
        
        return grid;
    }

    static createFluidWaveFrame(frame, tier, width = 18, height = 9) {
        const grid = this.createGrid(width, height, '⬛');
        const centerX = Math.floor(width / 2);
        const centerY = Math.floor(height / 2);
        const intensity = this.getTierIntensity(tier); // FIXED: Now this method exists
        
        // Scanning waves with intensity gradients
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                const distance = this.getSquareDistanceFromCenter(col, row, centerX, centerY);
                
                const wave1 = frame - distance;
                const wave2 = frame - distance - 2;
                
                if (wave1 >= 0 && wave1 <= 2) {
                    if (wave1 === 0) grid[row][col] = intensity.core;
                    else if (wave1 === 1) grid[row][col] = intensity.bright;
                    else grid[row][col] = intensity.medium;
                } else if (wave2 >= 0 && wave2 <= 1) {
                    grid[row][col] = intensity.light;
                }
            }
        }
        
        return grid;
    }

    static createFinalStableGrid(tier, width = 18, height = 9) {
        const grid = this.createGrid(width, height, '⬛');
        const tierColor = this.getTierColor(tier);
        
        // Fill entire grid with tier color
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                grid[row][col] = tierColor;
            }
        }
        
        return grid;
    }

    static gridToString(grid) {
        return grid.map(row => row.join('')).join('\n');
    }

    static getRainbowColor(frame) {
        const colors = [0xFF0000, 0xFF8000, 0xFFFF00, 0x00FF00, 0x0080FF, 0x8000FF];
        return colors[frame % colors.length];
    }

    static getTierColorHex(tier) {
        const colors = {
            1: 0x22C55E, // Green
            2: 0x3B82F6, // Blue  
            3: 0x8B5CF6, // Purple
            4: 0xF59E0B, // Gold
            5: 0xF97316, // Orange
            6: 0xEF4444  // Red
        };
        return colors[tier] || 0x6B7280;
    }

    static createScanAnimationFrame(frame, tier) {
        const grid = this.createFluidWaveFrame(frame, tier);
        const color = this.getTierColorHex(tier);
        
        const embed = new EmbedBuilder()
            .setTitle('MARINE ENHANCEMENT SCANNER')
            .setDescription(
                `**Detecting enhancement signature...**\n\n${this.gridToString(grid)}`
            )
            .setColor(color)
            .setFooter({ text: `Scan progress: ${Math.min(100, Math.round((frame / 8) * 100))}%` })
            .setTimestamp();
        
        return embed;
    }

    static createBuildupAnimationFrame(frame, tier) {
        const grid = this.createEnergyBuildupFrame(frame, tier);
        const color = this.getTierColorHex(tier);
        
        const embed = new EmbedBuilder()
            .setTitle('ENERGY BUILDUP')
            .setDescription(
                `**Enhancement core charging...**\n\n${this.gridToString(grid)}`
            )
            .setColor(color)
            .setFooter({ text: `Energy level: ${Math.min(100, Math.round(((frame + 1) / 8) * 100))}%` })
            .setTimestamp();
        
        return embed;
    }

    static createExplosionAnimationFrame(frame, tier) {
        const grid = this.createEpicExplosionFrame(frame, tier);
        const color = this.getTierColorHex(tier);
        
        const embed = new EmbedBuilder()
            .setTitle('ENHANCEMENT EXPLOSION')
            .setDescription(
                `**Power burst in progress...**\n\n${this.gridToString(grid)}`
            )
            .setColor(color)
            .setFooter({ text: `Explosion power: ${Math.min(100, Math.round(((frame + 1) / 12) * 100))}%` })
            .setTimestamp();
        
        return embed;
    }

    static createFinalAnimationFrame(tier) {
        const grid = this.createFinalStableGrid(tier);
        const color = this.getTierColorHex(tier);
        
        const embed = new EmbedBuilder()
            .setTitle('ENHANCEMENT MATRIX COMPLETE')
            .setDescription(
                `**Enhancement fully materialized...**\n\n${this.gridToString(grid)}\n\n**Matrix stabilized and locked...**`
            )
            .setColor(color)
            .setFooter({ text: 'Enhancement matrix permanently stabilized' })
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

    // Epic anime-style buildup and explosion sequence
    async performEnhancedBuffRoll(interaction, userId, guildId, member) {
        const buffTiers = this.getBuffTiers();
        
        // Determine the final result first
        const finalResult = this.calculateBuffTier();
        const targetColor = this.getTierColorHex(finalResult);
        
        // Phase 1: Initial Scan (8 frames) - detecting the enhancement
        for (let frame = 0; frame <= ANIMATION_CONFIG.BUILDUP_FRAMES; frame++) {
            const scanEmbed = BuffAnimator.createScanAnimationFrame(frame, finalResult);
            
            await interaction.editReply({ embeds: [scanEmbed] });
            await new Promise(resolve => setTimeout(resolve, ANIMATION_CONFIG.RAINBOW_DELAY));
        }
        
        // Phase 2: Energy Buildup (8 frames) - power accumulating
        for (let frame = 0; frame <= ANIMATION_CONFIG.BUILDUP_FRAMES; frame++) {
            const buildupEmbed = BuffAnimator.createBuildupAnimationFrame(frame, finalResult);
            
            await interaction.editReply({ embeds: [buildupEmbed] });
            await new Promise(resolve => setTimeout(resolve, ANIMATION_CONFIG.RAINBOW_DELAY));
        }
        
        // Phase 3: EPIC EXPLOSION (12 frames) - dramatic burst in tier color
        for (let frame = 0; frame <= ANIMATION_CONFIG.EXPLOSION_FRAMES; frame++) {
            const explosionEmbed = BuffAnimator.createExplosionAnimationFrame(frame, finalResult);
            
            await interaction.editReply({ embeds: [explosionEmbed] });
            await new Promise(resolve => setTimeout(resolve, ANIMATION_CONFIG.RAINBOW_DELAY));
        }

        // Phase 4: Final Result
        const buffInfo = buffTiers[finalResult];
        const rarityEmoji = this.getRarityEmoji(finalResult);
        const nextReset = getNextResetUnixTimestamp();
        const finalGrid = BuffAnimator.gridToString(BuffAnimator.createFinalStableGrid(finalResult));
        
        const finalEmbed = new EmbedBuilder()
            .setColor(targetColor)
            .setTitle('MARINE ENHANCEMENT ACQUIRED')
            .setDescription(
                `${finalGrid}\n\n` +
                `${rarityEmoji} **${buffInfo.name}** ${buffInfo.symbol}`
            )
            .addFields(
                {
                    name: 'Enhancement Matrix',
                    value: `**Classification:** ${this.getTierRarity(finalResult)}\n**Power Level:** ${buffInfo.multiplier}x Multiplier\n**Status:** Fully Stabilized`,
                    inline: true
                },
                {
                    name: 'Operational Window',
                    value: `**Activated:** Now\n**Expires:** <t:${nextReset}:R>\n**Reset Time:** 3:00 AM EST`,
                    inline: true
                },
                {
                    name: 'Enhancement Effects',
                    value: `Marine training protocols enhanced\nAll XP generation increased by ${buffInfo.multiplier}x\nEnhancement remains active until reset`,
                    inline: false
                }
            )
            .setFooter({ text: `Marine Enhancement Division • ${buffInfo.name} Protocol Active` })
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

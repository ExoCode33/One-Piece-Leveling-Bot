// src/commands/daily-buff.js - Enhanced Daily XP Buff System with Smooth Slot Machine Animation

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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

            // Start the enhanced spinning animation
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

    // One Piece Treasure Chest animation inspired by gacha
    async performEnhancedBuffRoll(interaction, userId, guildId, member) {
        const buffTiers = this.getBuffTiers();
        
        // Determine the final result first
        const finalResult = this.calculateBuffTier();
        const resultSymbol = buffTiers[finalResult].symbol;
        const targetColor = this.getTierColorHex(finalResult);
        
        // Phase 1: Treasure Hunt
        let embed = new EmbedBuilder()
            .setColor('#8B4513')
            .setTitle('🏴‍☠️ TREASURE HUNT')
            .setDescription('**Searching for treasure...**')
            .addFields({
                name: '🗺️ Status',
                value: '```Sailing the Grand Line...\nSearching for treasure chests...\nFound something!```',
                inline: false
            });

        await interaction.editReply({ embeds: [embed] });
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Phase 2: Chest Opening Animation
        embed.setTitle('📦 TREASURE CHEST DISCOVERED!')
             .setDescription('**Opening the chest...**')
             .setColor('#FFD700');
        
        const chestFrames = [
            '📦 ░░░░░░░░░░',
            '📦 ████░░░░░░',
            '📦 ████████░░',
            '📦 ██████████',
            '✨ ██████████'
        ];
        
        for (let i = 0; i < chestFrames.length; i++) {
            embed.spliceFields(0, 1, {
                name: '🔓 Opening Progress',
                value: `\`\`\`${chestFrames[i]}\`\`\``,
                inline: false
            });
            
            await interaction.editReply({ embeds: [embed] });
            await new Promise(resolve => setTimeout(resolve, 400));
        }

        // Phase 3: Treasure Reveal
        const buffInfo = buffTiers[finalResult];
        const rarityEmoji = this.getRarityEmoji(finalResult);
        const nextReset = getNextResetUnixTimestamp();
        
        const finalEmbed = new EmbedBuilder()
            .setColor(targetColor)
            .setTitle('🎉 TREASURE DISCOVERED!')
            .setDescription(`${rarityEmoji} **${buffInfo.name}** ${buffInfo.symbol}`)
            .addFields(
                {
                    name: '💎 Your Treasure',
                    value: `${rarityEmoji} ${buffInfo.name} ${buffInfo.symbol}`,
                    inline: false
                },
                {
                    name: '⚡ Power Boost',
                    value: `**${buffInfo.multiplier}x XP** | **${this.getTierRarity(finalResult)}**\n*Active until <t:${nextReset}:R>*`,
                    inline: false
                }
            )
            .setFooter({ text: `🏴‍☠️ Marine Intelligence • ${buffInfo.name} Active` })
            .setTimestamp();

        await interaction.editReply({ embeds: [finalEmbed] });

        // Apply the buff role and save to database
        await this.applyBuffRole(userId, guildId, member, finalResult);
    },

    // Get rarity emoji for treasure theme
    getRarityEmoji(tier) {
        const emojis = {
            1: '⚪', // Common
            2: '🔵', // Rare
            3: '🟣', // Epic
            4: '🟡', // Legendary
            5: '🟠', // Mythical
            6: '🔴'  // Divine
        };
        return emojis[tier] || '⚪';
    },

    // Get tier symbols (circle emojis)
    getTierSymbols() {
        return ['🟢', '🔵', '🟣', '🟡', '🟠', '🔴'];
    },

    // Create a strategic sequence that cycles through symbols to reach the result
    createStrategicSequence(allSymbols, resultSymbol) {
        const sequence = [];
        const resultIndex = allSymbols.indexOf(resultSymbol);
        
        // Continue cycling from where medium phase ended (14 total spins so far: 8 fast + 6 medium)
        const startIndex = 14 % allSymbols.length;
        
        // Calculate how many steps to get to result symbol naturally
        let currentIndex = startIndex;
        for (let i = 0; i < 3; i++) {
            currentIndex = (currentIndex + 1) % allSymbols.length;
            sequence.push(allSymbols[currentIndex]);
            
            // If we've reached the result in a natural cycle, stop here
            if (allSymbols[currentIndex] === resultSymbol) {
                break;
            }
        }
        
        // If we haven't reached the result naturally, make the last one the result
        if (sequence[sequence.length - 1] !== resultSymbol) {
            sequence[sequence.length - 1] = resultSymbol;
        }
        
        return sequence;
    },

    // Create realistic surrounding symbols for the wheel
    createRealisticSurrounding(allSymbols, centerSymbol, isWinning) {
        if (isWinning) {
            // For winning spin, create a balanced wheel
            const otherSymbols = allSymbols.filter(s => s !== centerSymbol);
            return Array(6).fill().map((_, index) => {
                // Mix in some variety but avoid too much repetition
                return otherSymbols[index % otherSymbols.length];
            });
        } else {
            // For regular spins, completely random
            return Array(6).fill().map(() => allSymbols[Math.floor(Math.random() * allSymbols.length)]);
        }
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
        
        // Weighted probabilities with slight improvement for higher tiers
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
            1: { name: 'Common Buff', symbol: '🟢', multiplier: 1.1 },
            2: { name: 'Rare Buff', symbol: '🔵', multiplier: 1.2 },
            3: { name: 'Epic Buff', symbol: '🟣', multiplier: 1.3 },
            4: { name: 'Legendary Buff', symbol: '🟡', multiplier: 1.5 },
            5: { name: 'Mythical Buff', symbol: '🟠', multiplier: 1.7 },
            6: { name: 'Divine Buff', symbol: '🔴', multiplier: 2.0 }
        };
    },

    // Get tier color for embeds (keeping original function for compatibility)
    getTierColor(tier) {
        return this.getTierColorHex(tier);
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

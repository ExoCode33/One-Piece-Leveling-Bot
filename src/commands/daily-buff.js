// Clean ASCII Art Daily Buff Animation - No Emoji Spam
// Inspired by Fate/Night anime with elegant geometric patterns

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Animation Configuration
const ANIMATION_CONFIG = {
    BUILDUP_DELAY: 600,      // Buildup tension
    EXPLOSION_DELAY: 200,    // Fast explosion
    FINAL_PAUSE: 1500,       // Final result pause
    BUILDUP_FRAMES: 6,       
    EXPLOSION_FRAMES: 8,     
    AFTERGLOW_FRAMES: 3      
};

class CleanBuffAnimator {
    
    // Get tier-specific symbols and patterns
    static getTierConfig(tier) {
        const configs = {
            1: { symbol: '▓', accent: '░', name: 'COMMON', color: 'GREEN' },
            2: { symbol: '█', accent: '▓', name: 'RARE', color: 'BLUE' },
            3: { symbol: '▀', accent: '▄', name: 'EPIC', color: 'PURPLE' },
            4: { symbol: '◆', accent: '◇', name: 'LEGENDARY', color: 'GOLD' },
            5: { symbol: '★', accent: '☆', name: 'MYTHICAL', color: 'ORANGE' },
            6: { symbol: '◈', accent: '◊', name: 'DIVINE', color: 'RED' }
        };
        return configs[tier] || configs[1];
    }

    // PHASE 1: Scanning and Detection
    static createScanningFrame(frame) {
        const scanLines = [
            "│                    │",
            "│ ░░░░░░░░░░░░░░░░░░ │",
            "│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │",
            "│ ████████████████████ │",
            "│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │",
            "│ ░░░░░░░░░░░░░░░░░░ │",
        ];
        
        const scanLine = Math.min(frame, scanLines.length - 1);
        
        return "```ansi\n" +
               "┌────────────────────┐\n" +
               "│   ENHANCEMENT      │\n" +
               "│     SCANNER        │\n" +
               "├────────────────────┤\n" +
               scanLines[scanLine] + "\n" +
               "│                    │\n" +
               "│  [ANALYZING...]    │\n" +
               "└────────────────────┘\n" +
               "```";
    }

    // PHASE 2: Energy Buildup
    static createBuildupFrame(frame, tier) {
        const config = this.getTierConfig(tier);
        const intensity = Math.min(frame + 1, 6);
        
        let center = "";
        let ring1 = "";
        let ring2 = "";
        
        // Build from center outward based on intensity
        if (intensity >= 1) center = config.symbol;
        if (intensity >= 2) center = config.symbol + config.symbol + config.symbol;
        if (intensity >= 3) {
            ring1 = config.accent.repeat(5);
            center = config.accent + config.symbol + config.symbol + config.symbol + config.accent;
        }
        if (intensity >= 4) {
            ring2 = config.accent.repeat(7);
            ring1 = config.symbol.repeat(5);
        }
        if (intensity >= 5) {
            ring2 = config.symbol.repeat(7);
        }
        if (intensity >= 6) {
            ring2 = config.symbol.repeat(9);
            ring1 = config.symbol.repeat(7);
            center = config.symbol.repeat(5);
        }

        return "```ansi\n" +
               "╔════════════════════╗\n" +
               "║   ENERGY BUILDUP   ║\n" +
               "╠════════════════════╣\n" +
               "║                    ║\n" +
               `║    ${ring2.padStart(9).padEnd(9)}    ║\n` +
               `║     ${ring1.padStart(7).padEnd(7)}     ║\n` +
               `║      ${center.padStart(5).padEnd(5)}      ║\n` +
               `║     ${ring1.padStart(7).padEnd(7)}     ║\n` +
               `║    ${ring2.padStart(9).padEnd(9)}    ║\n` +
               "║                    ║\n" +
               `║    POWER: ${intensity}/6     ║\n` +
               "╚════════════════════╝\n" +
               "```";
    }

    // PHASE 3: Epic Explosion Sequence
    static createExplosionFrame(frame, tier) {
        const config = this.getTierConfig(tier);
        const explosionFrames = [
            // Frame 0: Initial burst
            {
                pattern: [
                    "        ╬╬╬        ",
                    "        ╬█╬        ",
                    "    ╬╬╬╬█████╬╬╬╬    ",
                    "    ╬█████████████╬    ",
                    "╬╬╬╬█████████████████╬╬╬╬",
                    "╬███████████████████████╬",
                    "╬╬╬╬█████████████████╬╬╬╬",
                    "    ╬█████████████╬    ",
                    "    ╬╬╬╬█████╬╬╬╬    ",
                    "        ╬█╬        ",
                    "        ╬╬╬        "
                ]
            },
            // Frame 1: Cross explosion
            {
                pattern: [
                    "          █          ",
                    "          █          ",
                    "          █          ",
                    "          █          ",
                    "██████████████████████",
                    "██████████████████████",
                    "██████████████████████",
                    "          █          ",
                    "          █          ",
                    "          █          ",
                    "          █          "
                ]
            },
            // Frame 2: Star burst
            {
                pattern: [
                    "    ╲     █     ╱    ",
                    "      ╲   █   ╱      ",
                    "        ╲ █ ╱        ",
                    "          █          ",
                    "██████████████████████",
                    "██████████████████████",
                    "██████████████████████",
                    "          █          ",
                    "        ╱ █ ╲        ",
                    "      ╱   █   ╲      ",
                    "    ╱     █     ╲    "
                ]
            },
            // Frame 3: Full expansion
            {
                pattern: [
                    "██████████████████████",
                    "██████████████████████",
                    "██████████████████████",
                    "██████████████████████",
                    "██████████████████████",
                    "██████████████████████",
                    "██████████████████████",
                    "██████████████████████",
                    "██████████████████████",
                    "██████████████████████",
                    "██████████████████████"
                ]
            },
            // Frame 4: Crystallization
            {
                pattern: [
                    "     ◆◆◆◆◆◆◆◆◆     ",
                    "   ◆◆◆◆◆◆◆◆◆◆◆◆◆   ",
                    " ◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆ ",
                    "◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆",
                    "◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆",
                    "◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆",
                    "◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆",
                    "◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆",
                    " ◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆ ",
                    "   ◆◆◆◆◆◆◆◆◆◆◆◆◆   ",
                    "     ◆◆◆◆◆◆◆◆◆     "
                ]
            },
            // Frame 5: Energy waves
            {
                pattern: [
                    "░░░░░░░░░░░░░░░░░░░░░",
                    "▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓",
                    "░░░░░░░░░░░░░░░░░░░░░",
                    "▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓",
                    "██████████████████████",
                    "██████████████████████",
                    "██████████████████████",
                    "▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓",
                    "░░░░░░░░░░░░░░░░░░░░░",
                    "▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓",
                    "░░░░░░░░░░░░░░░░░░░░░"
                ]
            },
            // Frame 6-7: Final stabilization
            {
                pattern: [
                    config.symbol.repeat(21),
                    config.symbol.repeat(21),
                    config.symbol.repeat(21),
                    config.symbol.repeat(21),
                    config.symbol.repeat(21),
                    config.symbol.repeat(21),
                    config.symbol.repeat(21),
                    config.symbol.repeat(21),
                    config.symbol.repeat(21),
                    config.symbol.repeat(21),
                    config.symbol.repeat(21)
                ]
            }
        ];

        const explosionIndex = Math.min(frame, explosionFrames.length - 1);
        const explosion = explosionFrames[explosionIndex];

        return "```ansi\n" +
               "╔══════════════════════╗\n" +
               "║   ENHANCEMENT BURST   ║\n" +
               "╠══════════════════════╣\n" +
               explosion.pattern.map(line => `║${line}║`).join('\n') + "\n" +
               "╚══════════════════════╝\n" +
               "```";
    }

    // PHASE 4: Final Result with Clean Formatting
    static createFinalResult(tier) {
        const config = this.getTierConfig(tier);
        const buffTiers = {
            1: { name: 'Marine Training', multiplier: 1.1 },
            2: { name: 'Enhanced Drill', multiplier: 1.2 },
            3: { name: 'Elite Protocol', multiplier: 1.3 },
            4: { name: 'Admiral Focus', multiplier: 1.5 },
            5: { name: 'Fleet Command', multiplier: 1.7 },
            6: { name: 'World Government Authorization', multiplier: 2.0 }
        };

        const buff = buffTiers[tier];
        const border = config.symbol.repeat(25);

        return "```ansi\n" +
               "╔═════════════════════════╗\n" +
               "║  ENHANCEMENT COMPLETE   ║\n" +
               "╠═════════════════════════╣\n" +
               `║ ${border} ║\n` +
               `║ ${config.symbol}                       ${config.symbol} ║\n` +
               `║ ${config.symbol}   ${config.name.padEnd(15)}   ${config.symbol} ║\n` +
               `║ ${config.symbol}   ${buff.name.padEnd(15)}   ${config.symbol} ║\n` +
               `║ ${config.symbol}                       ${config.symbol} ║\n` +
               `║ ${config.symbol}   MULTIPLIER: ${buff.multiplier}x    ${config.symbol} ║\n` +
               `║ ${config.symbol}                       ${config.symbol} ║\n` +
               `║ ${border} ║\n` +
               "╚═════════════════════════╝\n" +
               "```";
    }

    // Get hex color for embed
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
                    .setTitle('DAILY BUFF ALREADY CLAIMED')
                    .setDescription(`You've already rolled your daily buff!\n\n**Current Buff:** ${currentBuff.name}\n**Multiplier:** ${currentBuff.multiplier}x XP\n\n*Next reset: <t:${nextReset}:R>*`)
                    .setFooter({ text: 'Marine Intelligence • Daily Buff System' })
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], flags: 64 });
            }

            // Start the enhanced animation sequence
            await interaction.deferReply();
            await this.performEpicBuffAnimation(interaction, userId, guildId, member);

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

    // Epic animation sequence
    async performEpicBuffAnimation(interaction, userId, guildId, member) {
        const finalResult = this.calculateBuffTier();
        const config = CleanBuffAnimator.getTierConfig(finalResult);
        
        try {
            // Phase 1: Scanning (6 frames)
            for (let frame = 0; frame < ANIMATION_CONFIG.BUILDUP_FRAMES; frame++) {
                const embed = new EmbedBuilder()
                    .setColor(0x4A90E2)
                    .setTitle('MARINE ENHANCEMENT SCANNER')
                    .setDescription(
                        `**Detecting enhancement signature...**\n\n${CleanBuffAnimator.createScanningFrame(frame)}\n\n**Progress:** ${Math.round(((frame + 1) / ANIMATION_CONFIG.BUILDUP_FRAMES) * 100)}%`
                    )
                    .setFooter({ text: 'Scanning for compatible enhancement...' })
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [embed] });
                await new Promise(resolve => setTimeout(resolve, ANIMATION_CONFIG.BUILDUP_DELAY));
            }

            // Phase 2: Energy Buildup (6 frames)
            for (let frame = 0; frame < ANIMATION_CONFIG.BUILDUP_FRAMES; frame++) {
                const embed = new EmbedBuilder()
                    .setColor(CleanBuffAnimator.getTierColorHex(finalResult))
                    .setTitle('ENERGY CONCENTRATION')
                    .setDescription(
                        `**Enhancement core charging...**\n\n${CleanBuffAnimator.createBuildupFrame(frame, finalResult)}\n\n**Status:** Gathering ${config.name} energy...`
                    )
                    .setFooter({ text: `Building ${config.name} enhancement matrix...` })
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [embed] });
                await new Promise(resolve => setTimeout(resolve, ANIMATION_CONFIG.BUILDUP_DELAY));
            }

            // Phase 3: Epic Explosion (8 frames)
            for (let frame = 0; frame < ANIMATION_CONFIG.EXPLOSION_FRAMES; frame++) {
                const embed = new EmbedBuilder()
                    .setColor(CleanBuffAnimator.getTierColorHex(finalResult))
                    .setTitle('ENHANCEMENT MATERIALIZATION')
                    .setDescription(
                        `**Power burst in progress...**\n\n${CleanBuffAnimator.createExplosionFrame(frame, finalResult)}\n\n**WARNING:** High energy discharge detected!`
                    )
                    .setFooter({ text: 'Enhancement matrix crystallizing...' })
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [embed] });
                await new Promise(resolve => setTimeout(resolve, ANIMATION_CONFIG.EXPLOSION_DELAY));
            }

            // Phase 4: Final Result
            const buffInfo = this.getBuffTiers()[finalResult];
            const nextReset = getNextResetUnixTimestamp();
            
            const finalEmbed = new EmbedBuilder()
                .setColor(CleanBuffAnimator.getTierColorHex(finalResult))
                .setTitle('MARINE ENHANCEMENT ACQUIRED')
                .setDescription(
                    `${CleanBuffAnimator.createFinalResult(finalResult)}\n\n**Classification:** ${config.name}\n**Enhancement:** ${buffInfo.name}\n**Power Level:** ${buffInfo.multiplier}x Multiplier`
                )
                .addFields(
                    {
                        name: 'Operational Status',
                        value: `**Activated:** Now\n**Expires:** <t:${nextReset}:R>\n**Reset Time:** 3:00 AM EST`,
                        inline: true
                    },
                    {
                        name: 'Enhancement Effects',
                        value: `All XP generation increased by **${buffInfo.multiplier}x**\nEnhancement remains active until reset\nStacks with other XP modifiers`,
                        inline: true
                    }
                )
                .setFooter({ text: `Marine Enhancement Division • ${buffInfo.name} Protocol Active` })
                .setTimestamp();

            await interaction.editReply({ embeds: [finalEmbed] });

            // Apply the buff role and save to database
            await this.applyBuffRole(userId, guildId, member, finalResult);

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
        const buffRoles = this.getBuffTiers();
        
        for (const tier of Object.keys(buffRoles)) {
            const roleId = process.env[`DAILY_XP_BUFF_TIER_${tier}_ROLE`];
            if (roleId && member.roles.cache.has(roleId)) {
                return {
                    tier: parseInt(tier),
                    name: buffRoles[tier].name,
                    multiplier: buffRoles[tier].multiplier
                };
            }
        }

        return { tier: 0, name: 'No Buff', multiplier: 1.0 };
    },

    // Get buff tier information
    getBuffTiers() {
        return {
            1: { name: 'Marine Training', multiplier: 1.1 },
            2: { name: 'Enhanced Drill', multiplier: 1.2 },
            3: { name: 'Elite Protocol', multiplier: 1.3 },
            4: { name: 'Admiral Focus', multiplier: 1.5 },
            5: { name: 'Fleet Command', multiplier: 1.7 },
            6: { name: 'World Government Authorization', multiplier: 2.0 }
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

// Helper functions
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

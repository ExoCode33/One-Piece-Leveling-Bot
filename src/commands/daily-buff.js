// src/commands/daily-buff.js - IMPRESSIVE Cinematic Animation System

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// ✨ CINEMATIC Animation Configuration
const ANIMATION_CONFIG = {
    INTRO_FRAMES: 3,          // Build-up frames
    CORE_FRAMES: 4,           // Main animation frames  
    REVEAL_FRAMES: 2,         // Result reveal frames
    FRAME_DELAY: 900,         // 0.9 seconds per frame
    FINAL_PAUSE: 1500,        // 1.5 second dramatic pause
    PARTICLE_DENSITY: 25      // Particle effects density
};

// Enhanced tier colors and rarity names
const TIER_COLORS = {
    1: 0x22C55E, // Emerald
    2: 0x3B82F6, // Sapphire
    3: 0x8B5CF6, // Amethyst
    4: 0xF59E0B, // Topaz
    5: 0xF97316, // Ruby
    6: 0xEF4444  // Diamond
};

const TIER_NAMES = {
    1: 'Marine Combat Enhancement',
    2: 'Elite Operations Protocol', 
    3: 'Admiral Authority Matrix',
    4: 'Fleet Command Synchronization',
    5: 'World Government Authorization',
    6: 'Legendary Marine Ascension'
};

const TIER_RARITIES = {
    1: 'COMMON',
    2: 'RARE',
    3: 'EPIC', 
    4: 'LEGENDARY',
    5: 'MYTHICAL',
    6: 'TRANSCENDENT'
};

class CinematicAnimator {
    
    // ✨ Create particle field effects
    static generateParticleField(density, pattern = 'scatter') {
        const particles = [];
        const chars = ['✦', '✧', '⟡', '◦', '∘', '◯', '⬡', '⬢'];
        
        for (let i = 0; i < density; i++) {
            const char = chars[Math.floor(Math.random() * chars.length)];
            particles.push(char);
        }
        
        if (pattern === 'spiral') {
            return this.createSpiralPattern(particles);
        } else if (pattern === 'wave') {
            return this.createWavePattern(particles);
        } else if (pattern === 'burst') {
            return this.createBurstPattern(particles);
        }
        
        return particles.join(' ');
    }
    
    static createSpiralPattern(particles) {
        const lines = [];
        const center = Math.floor(particles.length / 3);
        
        lines.push(particles.slice(0, center).join(' '));
        lines.push('    ' + particles.slice(center, center * 2).join('  ') + '    ');
        lines.push(particles.slice(center * 2).join(' '));
        
        return lines.join('\n');
    }
    
    static createWavePattern(particles) {
        const lines = [];
        const third = Math.floor(particles.length / 3);
        
        lines.push('  ' + particles.slice(0, third).join('   '));
        lines.push(particles.slice(third, third * 2).join('  '));
        lines.push('    ' + particles.slice(third * 2).join('   '));
        
        return lines.join('\n');
    }
    
    static createBurstPattern(particles) {
        const center = '    ◉    ';
        const ring1 = particles.slice(0, 8).join(' ');
        const ring2 = particles.slice(8, 16).join(' ');
        const ring3 = particles.slice(16).join(' ');
        
        return `${ring3}\n  ${ring2}  \n${ring1}\n${center}\n${ring1}\n  ${ring2}  \n${ring3}`;
    }
    
    // ✨ Create energy matrix visualization
    static createEnergyMatrix(intensity, pattern = 'default') {
        const width = 12;
        const height = 6;
        const matrix = [];
        
        const energyChars = ['▓', '▒', '░', '█'];
        const selectedChar = energyChars[Math.min(intensity - 1, energyChars.length - 1)];
        
        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                if (pattern === 'diamond') {
                    const centerX = width / 2;
                    const centerY = height / 2;
                    const distance = Math.abs(x - centerX) + Math.abs(y - centerY);
                    
                    if (distance <= intensity) {
                        row.push(selectedChar);
                    } else {
                        row.push('░');
                    }
                } else if (pattern === 'wave') {
                    const wave = Math.sin((x + y + intensity) * 0.5) > 0;
                    row.push(wave ? selectedChar : '░');
                } else {
                    // Default expanding pattern
                    const shouldFill = Math.random() < (intensity / 10);
                    row.push(shouldFill ? selectedChar : '░');
                }
            }
            matrix.push(row.join(''));
        }
        
        return matrix.join('\n');
    }
    
    // ✨ IMPRESSIVE: Create cinematic animation frames
    static createCinematicFrame(frameNumber, totalFrames, finalTier) {
        const progress = frameNumber / totalFrames;
        const tierColor = TIER_COLORS[finalTier];
        const tierRarity = TIER_RARITIES[finalTier];
        
        // Phase determination
        let phase, title, description, visualEffect, embedColor;
        
        if (frameNumber <= ANIMATION_CONFIG.INTRO_FRAMES) {
            // INTRO PHASE: Build anticipation
            phase = 'INITIALIZATION';
            embedColor = 0x4A90E2;
            
            if (frameNumber === 1) {
                title = '⚡ MARINE ENHANCEMENT PROTOCOL';
                description = '```ansi\n\u001b[1;34m◆ ACCESSING WORLD GOVERNMENT DATABASES ◆\u001b[0m\n```';
                visualEffect = this.generateParticleField(15, 'scatter');
            } else if (frameNumber === 2) {
                title = '🔐 SECURITY CLEARANCE VERIFICATION';
                description = '```ansi\n\u001b[1;33m◆ QUANTUM ENCRYPTION PROTOCOLS ACTIVE ◆\u001b[0m\n```';
                visualEffect = this.createEnergyMatrix(2, 'wave');
            } else {
                title = '🎯 ENHANCEMENT MATRIX CALIBRATION';
                description = '```ansi\n\u001b[1;35m◆ DIMENSIONAL HARMONICS STABILIZING ◆\u001b[0m\n```';
                visualEffect = this.generateParticleField(20, 'spiral');
            }
            
        } else if (frameNumber <= ANIMATION_CONFIG.INTRO_FRAMES + ANIMATION_CONFIG.CORE_FRAMES) {
            // CORE PHASE: Main animation
            phase = 'ENHANCEMENT';
            embedColor = 0xF59E0B;
            const coreFrame = frameNumber - ANIMATION_CONFIG.INTRO_FRAMES;
            
            if (coreFrame === 1) {
                title = '⚡ ENHANCEMENT FIELD GENERATION';
                description = '```ansi\n\u001b[1;36m◆ REALITY DISTORTION FIELD EXPANDING ◆\u001b[0m\n```';
                visualEffect = this.createEnergyMatrix(4, 'diamond');
            } else if (coreFrame === 2) {
                title = '🌟 QUANTUM ENHANCEMENT CASCADE';
                description = '```ansi\n\u001b[1;32m◆ TEMPORAL FLUX STABILIZATION IN PROGRESS ◆\u001b[0m\n```';
                visualEffect = this.generateParticleField(30, 'burst');
            } else if (coreFrame === 3) {
                title = '💫 MULTIDIMENSIONAL SYNCHRONIZATION';
                description = '```ansi\n\u001b[1;31m◆ PARALLEL UNIVERSE CONVERGENCE DETECTED ◆\u001b[0m\n```';
                visualEffect = this.createEnergyMatrix(6, 'wave');
            } else {
                title = '🔥 ENHANCEMENT MATRIX OVERLOAD';
                description = '```ansi\n\u001b[1;37m◆ POWER LEVELS EXCEEDING SAFE PARAMETERS ◆\u001b[0m\n```';
                visualEffect = this.generateParticleField(35, 'spiral');
            }
            
        } else {
            // REVEAL PHASE: Dramatic revelation
            phase = 'REVELATION';
            embedColor = tierColor;
            
            if (frameNumber === totalFrames - 1) {
                title = '✨ ENHANCEMENT PROTOCOL CULMINATION';
                description = `\`\`\`ansi\n\u001b[1;33m◆ RARITY CLASSIFICATION: ${tierRarity} ◆\u001b[0m\n\`\`\``;
                visualEffect = this.createTierRevealEffect(finalTier);
            } else {
                title = '🎆 LEGENDARY ENHANCEMENT AWAKENING';
                description = `\`\`\`ansi\n\u001b[1;35m◆ ${TIER_NAMES[finalTier].toUpperCase()} ACTIVATED ◆\u001b[0m\n\`\`\``;
                visualEffect = this.createFinalBurstEffect(finalTier);
            }
        }
        
        return {
            title,
            description,
            visualEffect,
            phase,
            progress: Math.round(progress * 100),
            embedColor,
            frameNumber,
            totalFrames
        };
    }
    
    // ✨ Create tier-specific reveal effect
    static createTierRevealEffect(tier) {
        const raritySymbols = {
            1: '🟢', 2: '🔵', 3: '🟣', 4: '🟡', 5: '🟠', 6: '🔴'
        };
        
        const symbol = raritySymbols[tier];
        const pattern = `
    ${symbol}     ${symbol}     ${symbol}
      ${symbol} ✦ ${symbol} ✦ ${symbol}
        ${symbol}   ${symbol}   ${symbol}
    ✦     ${symbol} ◉ ${symbol}     ✦
        ${symbol}   ${symbol}   ${symbol}
      ${symbol} ✦ ${symbol} ✦ ${symbol}
    ${symbol}     ${symbol}     ${symbol}`;
        
        return pattern;
    }
    
    // ✨ Create final burst effect
    static createFinalBurstEffect(tier) {
        const intensity = tier;
        const effects = [];
        
        for (let i = 0; i < intensity; i++) {
            effects.push('◇'.repeat(intensity * 2));
        }
        
        const centerLine = '◆'.repeat(intensity) + ' ◉ ' + '◆'.repeat(intensity);
        effects.splice(Math.floor(effects.length / 2), 0, centerLine);
        
        return effects.join('\n');
    }
    
    // ✨ Create impressive loading embed
    static createImpressiveEmbed(frameData, finalTier) {
        const embed = new EmbedBuilder()
            .setTitle(frameData.title)
            .setColor(frameData.embedColor)
            .setDescription(frameData.description);
        
        // Add visual effect field
        embed.addFields({
            name: '◇ ◆ ENHANCEMENT MATRIX ◆ ◇',
            value: `\`\`\`\n${frameData.visualEffect}\n\`\`\``,
            inline: false
        });
        
        // Add progress information
        embed.addFields(
            {
                name: '📊 PROTOCOL STATUS',
                value: `\`\`\`yaml\nPhase: ${frameData.phase}\nProgress: ${frameData.progress}%\nFrame: ${frameData.frameNumber}/${frameData.totalFrames}\nClassification: RESTRICTED\n\`\`\``,
                inline: true
            },
            {
                name: '⚡ ENERGY READINGS',
                value: `\`\`\`yaml\nPower Level: ${frameData.frameNumber * 1337}\nStability: ${frameData.progress > 50 ? 'CRITICAL' : 'NOMINAL'}\nThreat Level: MAXIMUM\nAuthorization: CLASSIFIED\n\`\`\``,
                inline: true
            }
        );
        
        // Add dramatic footer
        embed.setFooter({ 
            text: `Marine Enhancement Division • Phase ${frameData.phase} • ${frameData.progress}% Complete` 
        })
        .setTimestamp();
        
        return embed;
    }
    
    // ✨ Create epic result embed
    static createEpicResultEmbed(tier, member) {
        const tierName = TIER_NAMES[tier];
        const tierRarity = TIER_RARITIES[tier];
        const color = TIER_COLORS[tier];
        const nextReset = getNextResetUnixTimestamp();
        
        // Epic descriptions based on tier
        const epicDescriptions = {
            1: 'Basic enhancement protocols have awakened within your neural pathways. Your combat efficiency has increased by 15%.',
            2: 'Rare enhancement matrices are now synchronized with your biological systems. Enhanced reflexes and tactical awareness online.',
            3: 'Epic-grade enhancement protocols have fundamentally altered your combat capabilities. You now operate beyond human limitations.',
            4: 'Legendary enhancement systems have integrated with your very essence. Reality bends slightly around your presence.',
            5: 'Mythical enhancement protocols have transcended the boundaries of conventional enhancement. You have become a living weapon.',
            6: 'Transcendent enhancement has elevated you beyond mortal comprehension. You are now a force of nature itself.'
        };
        
        const embed = new EmbedBuilder()
            .setTitle('🌟 LEGENDARY ENHANCEMENT COMPLETE 🌟')
            .setColor(color)
            .setDescription(`**${tierRarity} ENHANCEMENT ACHIEVED**\n\n*${epicDescriptions[tier]}*`);
        
        // Add dramatic tier announcement
        embed.addFields({
            name: '✨ ENHANCEMENT DETAILS ✨',
            value: `\`\`\`ansi\n\u001b[1;33m◆ CLASSIFICATION: ${tierRarity}\u001b[0m\n\u001b[1;36m◆ DESIGNATION: ${tierName}\u001b[0m\n\u001b[1;35m◆ TIER LEVEL: ${tier}/6\u001b[0m\n\u001b[1;32m◆ STATUS: FULLY OPERATIONAL\u001b[0m\n\`\`\``,
            inline: false
        });
        
        // Add power metrics
        embed.addFields(
            {
                name: '⚡ POWER ANALYSIS',
                value: `\`\`\`yaml\nEnhancement Tier: ${tier}\nPower Multiplier: CLASSIFIED\nDuration: Until Reset\nStability: 100%\n\`\`\``,
                inline: true
            },
            {
                name: '🎯 OPERATIONAL STATUS',
                value: `\`\`\`yaml\nProtocol: ACTIVE\nEfficiency: MAXIMIZED\nThreat Level: ELEVATED\nClearance: AUTHORIZED\n\`\`\``,
                inline: true
            }
        );
        
        // Add reset information
        embed.addFields({
            name: '🔄 ENHANCEMENT CYCLE',
            value: `Enhancement protocols undergo daily recalibration at **3:00 AM EDT**\n\nNext recalibration: <t:${nextReset}:R>\n\n*"With great power comes great responsibility."*`,
            inline: false
        });
        
        embed.setFooter({ text: `${tierRarity} Enhancement • Marine Enhancement Division • ${tierName}` })
             .setTimestamp();

        return embed;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily-buff')
        .setDescription('⚡ Initiate Marine Enhancement Protocol (Resets at 3:00 AM EDT)'),

    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            const member = interaction.member;

            // Check if XP tracker is available
            if (!global.xpTracker || !global.xpTracker.db) {
                return await interaction.reply({
                    content: '❌ **Enhancement Matrix Offline**\n\nMarine Enhancement Protocol not available.',
                    flags: 64
                });
            }

            // Check if user already rolled today
            const hasRolledToday = await this.checkDailyRoll(userId, guildId);
            if (hasRolledToday) {
                const currentBuff = await this.getCurrentBuff(userId, guildId, member);
                const nextReset = getNextResetUnixTimestamp();
                
                const embed = new EmbedBuilder()
                    .setColor(TIER_COLORS[currentBuff.tier] || '#4A90E2')
                    .setTitle('⚡ Enhancement Protocol Already Active')
                    .setDescription(`Your daily Marine Enhancement is currently operational.`)
                    .addFields(
                        {
                            name: '🎯 Active Enhancement',
                            value: `\`\`\`yaml\nProtocol: ${currentBuff.name}\nClassification: ${TIER_RARITIES[currentBuff.tier] || 'UNKNOWN'}\nTier: ${currentBuff.tier}/6\nStatus: OPERATIONAL\n\`\`\``,
                            inline: true
                        },
                        {
                            name: '🔄 Next Protocol',
                            value: `<t:${nextReset}:R>`,
                            inline: true
                        }
                    )
                    .setFooter({ text: 'Marine Enhancement Division • Protocol Active' })
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], flags: 64 });
            }

            // Start the IMPRESSIVE cinematic animation sequence
            await interaction.deferReply();
            await this.performCinematicAnimation(interaction, userId, guildId, member);

        } catch (error) {
            console.error('[DAILY BUFF] Error in daily-buff command:', error);
            
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ **Enhancement Protocol Failed**\n\nCritical error in Marine Enhancement Matrix.'
                });
            } else {
                await interaction.reply({
                    content: '❌ **Enhancement Protocol Failed**\n\nCritical error in Marine Enhancement Matrix.',
                    flags: 64
                });
            }
        }
    },

    // ✨ IMPRESSIVE: Cinematic animation sequence with dramatic timing
    async performCinematicAnimation(interaction, userId, guildId, member) {
        const finalResult = this.calculateBuffTier();
        const totalFrames = ANIMATION_CONFIG.INTRO_FRAMES + ANIMATION_CONFIG.CORE_FRAMES + ANIMATION_CONFIG.REVEAL_FRAMES;
        
        try {
            console.log(`[DAILY BUFF] Starting CINEMATIC enhancement for ${interaction.user.username}, tier ${finalResult}`);
            
            // Epic cinematic sequence with varying timing for dramatic effect
            for (let frame = 1; frame <= totalFrames; frame++) {
                const frameData = CinematicAnimator.createCinematicFrame(frame, totalFrames, finalResult);
                const impressiveEmbed = CinematicAnimator.createImpressiveEmbed(frameData, finalResult);
                
                await interaction.editReply({ embeds: [impressiveEmbed] });
                
                // Dynamic timing for maximum impact
                if (frame < totalFrames) {
                    let delay = ANIMATION_CONFIG.FRAME_DELAY;
                    
                    // Slower on dramatic moments
                    if (frame === ANIMATION_CONFIG.INTRO_FRAMES || frame === totalFrames - 1) {
                        delay += 500; // Extra dramatic pause
                    }
                    
                    // Add slight randomness for natural feel
                    delay += Math.random() * 200 - 100;
                    
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            // DRAMATIC PAUSE before final reveal
            await new Promise(resolve => setTimeout(resolve, ANIMATION_CONFIG.FINAL_PAUSE));

            // Apply the buff role and save to database
            await this.applyBuffRole(userId, guildId, member, finalResult);
            
            // Show EPIC final result
            const epicEmbed = CinematicAnimator.createEpicResultEmbed(finalResult, member);
            await interaction.editReply({ embeds: [epicEmbed] });

        } catch (error) {
            console.error('[DAILY BUFF] Cinematic animation error:', error);
            await interaction.editReply({
                content: '❌ **Enhancement Protocol Failure**\n\nCritical system malfunction detected.'
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
} true,
                removedRoles,
                dbRecordsRemoved,
                currentDay,
                userId,
                guildId
            };
            
        } catch (error) {
            console.error('[DAILY BUFF ADMIN] Error force removing daily buff:', error);
            return {
                success:

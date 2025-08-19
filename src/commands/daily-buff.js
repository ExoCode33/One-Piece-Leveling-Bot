// src/commands/daily-buff.js - FIXED role granting and database issues

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Animation configuration
const ANIMATION_CONFIG = {
    FRAME_DELAY: 700,
    TOTAL_FRAMES: 10,
    GRID_WIDTH: 19,
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

class BuffAnimator {
    // Create a grid animation showing light emanating from center with complete explosion
    static createGridAnimation(frame, finalTier) {
        const width = ANIMATION_CONFIG.GRID_WIDTH;
        const height = ANIMATION_CONFIG.GRID_HEIGHT;
        const centerX = 9;
        const centerY = Math.floor(height / 2);
        
        // Create the grid
        const grid = [];
        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                row.push('⬛');
            }
            grid.push(row);
        }
        
        if (frame <= 2) {
            // Frames 1-2: All black, just starting
        } else if (frame <= 4) {
            // Frames 3-4: Small light at center
            grid[centerY][centerX] = '⬜';
        } else if (frame <= 6) {
            // Frames 5-6: Light expanding outward
            const radius = (frame - 4) * 1.5;
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                    
                    if (distance <= radius) {
                        grid[y][x] = '⬜';
                    }
                }
            }
        } else if (frame === 7) {
            // Frame 7: Initial explosion - small rarity burst
            const explosionRadius = 2;
            const tierEmoji = TIER_EMOJIS[finalTier];
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                    
                    if (distance <= explosionRadius) {
                        grid[y][x] = tierEmoji;
                    } else if (distance <= explosionRadius + 1.5) {
                        grid[y][x] = '⬜';
                    }
                }
            }
        } else if (frame === 8) {
            // Frame 8: Medium explosion
            const explosionRadius = 3.5;
            const tierEmoji = TIER_EMOJIS[finalTier];
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                    
                    if (distance <= explosionRadius) {
                        grid[y][x] = tierEmoji;
                    } else if (distance <= explosionRadius + 2) {
                        grid[y][x] = '⬜';
                    }
                }
            }
        } else if (frame === 9) {
            // Frame 9: Large explosion
            const explosionRadius = 6;
            const tierEmoji = TIER_EMOJIS[finalTier];
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                    
                    if (distance <= explosionRadius) {
                        grid[y][x] = tierEmoji;
                    } else if (distance <= explosionRadius + 1.5) {
                        grid[y][x] = '⬜';
                    }
                }
            }
        } else {
            // Frame 10: COMPLETE GRID EXPLOSION
            const tierEmoji = TIER_EMOJIS[finalTier];
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    grid[y][x] = tierEmoji;
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
        let color = 0x4A90E2;
        
        if (currentFrame <= 2) {
            statusMessage = '🔬 **Initializing enhancement matrix...**';
            color = 0x808080;
        } else if (currentFrame <= 4) {
            statusMessage = '⚡ **Energy core igniting...**';
            color = 0xFFFF00;
        } else if (currentFrame <= 6) {
            statusMessage = '🌟 **Power wave expanding...**';
            color = 0xFFFFFF;
        } else if (currentFrame <= 8) {
            statusMessage = '💥 **Enhancement explosion initiated...**';
            color = TIER_COLORS[finalTier];
        } else {
            statusMessage = '🎆 **MAXIMUM POWER EXPLOSION!**';
            color = TIER_COLORS[finalTier];
        }
        
        const embed = new EmbedBuilder()
            .setTitle('⚡ Marine Enhancement Scanner')
            .setDescription(
                `${statusMessage}\n\n` +
                `\`\`\`\n${gridAnimation}\n\`\`\`\n\n` +
                `📊 **Progress:** ${progressPercent}%\n` +
                `⚡ **Status:** ${currentFrame >= 7 ? 'EXPLOSIVE ENHANCEMENT!' : 'Energy matrix expanding...'}`
            )
            .setColor(color)
            .setFooter({ text: `Processing... ${currentFrame}/${totalFrames} completed` })
            .setTimestamp();
        
        return embed;
    }

    static createResultEmbed(tier, member) {
        const tierName = TIER_NAMES[tier];
        const color = TIER_COLORS[tier];
        const nextReset = getNextResetUnixTimestamp();
        
        const embed = new EmbedBuilder()
            .setTitle('✨ Enhancement Complete!')
            .setColor(color)
            .setDescription(`**${tierName} Enhancement Successfully Activated!**\n\n🎉 **Enhancement Complete!** 🎉`)
            .addFields(
                {
                    name: '⚡ Enhancement Details',
                    value: `**Status:** Active\n**Next Reset:** <t:${nextReset}:R>\n**Tier:** ${tier}`,
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
        .setDescription('🎰 Spin the daily XP buff wheel! Resets at 3:00 AM EDT'),

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
                    .setDescription(`You've already rolled your daily buff!\n\n**Current Buff:** ${currentBuff.name}\n**Tier:** ${currentBuff.tier}\n\n*Next reset: <t:${nextReset}:R>*`)
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

    // Animation sequence
    async performAnimation(interaction, userId, guildId, member) {
        const finalResult = this.calculateBuffTier();
        
        try {
            console.log(`[DAILY BUFF] Starting animation for ${interaction.user.username}, tier ${finalResult}`);
            
            // Play through animation frames
            for (let i = 1; i <= ANIMATION_CONFIG.TOTAL_FRAMES; i++) {
                const loadingEmbed = BuffAnimator.createLoadingFrame(i, ANIMATION_CONFIG.TOTAL_FRAMES, finalResult);
                
                await interaction.editReply({ embeds: [loadingEmbed] });
                
                if (i < ANIMATION_CONFIG.TOTAL_FRAMES) {
                    await new Promise(resolve => setTimeout(resolve, ANIMATION_CONFIG.FRAME_DELAY));
                }
            }

            // Apply the buff role and save to database
            await this.applyBuffRole(userId, guildId, member, finalResult);
            
            // Create and show final result
            const finalEmbed = BuffAnimator.createResultEmbed(finalResult, member);
            
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

    // ✅ FIXED: Check if user has already rolled today with better error handling
    async checkDailyRoll(userId, guildId) {
        try {
            // Ensure table exists
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
            console.log(`[DAILY BUFF] Checking roll for ${userId} on ${currentDay}`);
            
            const result = await global.xpTracker.db.query(
                'SELECT * FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [userId, guildId, currentDay]
            );

            const hasRolled = result.rows.length > 0;
            console.log(`[DAILY BUFF] User ${userId} has rolled today: ${hasRolled} (found ${result.rows.length} records)`);
            
            if (hasRolled) {
                console.log(`[DAILY BUFF] Database record:`, result.rows[0]);
            }
            
            return hasRolled;
        } catch (error) {
            console.error('[DAILY BUFF] Error checking daily roll:', error);
            return false;
        }
    },

    // ✅ NEW: Check daily buff status (for admin command)
    async checkDailyBuffStatus(userId, guildId) {
        try {
            const currentDay = getCurrentDayKey();
            
            // Check database first
            const dbResult = await global.xpTracker.db.query(
                'SELECT * FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [userId, guildId, currentDay]
            );
            
            const hasDBRecord = dbResult.rows.length > 0;
            const dbTier = hasDBRecord ? dbResult.rows[0].tier : null;
            
            // Check what roles user actually has
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

    // ✅ NEW: Force remove daily buff (for admin command)
    async forceRemoveDailyBuff(userId, guildId, reason = 'Admin removal') {
        try {
            console.log(`[DAILY BUFF ADMIN] 🗑️ Force removing daily buff for user ${userId}`);
            
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
                                console.log(`[DAILY BUFF ADMIN] ✅ Removed role ${role.name} from ${member.user.username}`);
                            } catch (error) {
                                console.error(`[DAILY BUFF ADMIN] ❌ Failed to remove role ${role.name}:`, error.message);
                            }
                        }
                    }
                }
            }
            
            // Remove from database (current day)
            const deleteResult = await global.xpTracker.db.query(
                'DELETE FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3 RETURNING *',
                [userId, guildId, currentDay]
            );
            
            dbRecordsRemoved = deleteResult.rowCount;
            console.log(`[DAILY BUFF ADMIN] 🗄️ Removed ${dbRecordsRemoved} database records for ${userId} on ${currentDay}`);
            
            if (deleteResult.rows.length > 0) {
                console.log(`[DAILY BUFF ADMIN] Deleted record:`, deleteResult.rows[0]);
            }
            
            return {
                success: true,
                removedRoles,
                dbRecordsRemoved,
                currentDay,
                userId,
                guildId
            };
            
        } catch (error) {
            console.error('[DAILY BUFF ADMIN] ❌ Error force removing daily buff:', error);
            return {
                success: false,
                error: error.message,
                removedRoles: [],
                dbRecordsRemoved: 0
            };
        }
    },

    // ✅ FIXED: Get current buff with proper role checking
    async getCurrentBuff(userId, guildId, member) {
        try {
            // Check database first
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

            // Fallback: check roles
            for (let tier = 1; tier <= 6; tier++) {
                const roleId = process.env[`DAILY_XP_BUFF_TIER_${tier}_ROLE`];
                if (roleId && roleId !== `role_id_${tier}` && member.roles.cache.has(roleId)) {
                    return {
                        tier: tier,
                        name: TIER_NAMES[tier] || `Tier ${tier}`,
                        multiplier: 'From Role Settings'
                    };
                }
            }

            return { tier: 0, name: 'No Buff', multiplier: 1.0 };
        } catch (error) {
            console.error('[DAILY BUFF] Error getting current buff:', error);
            return { tier: 0, name: 'No Buff', multiplier: 1.0 };
        }
    },

    // ✅ FIXED: Apply buff role with detailed logging and error handling
    async applyBuffRole(userId, guildId, member, tier) {
        try {
            console.log(`[DAILY BUFF] 🎯 Applying tier ${tier} buff to ${member.user.username}`);

            // Remove any existing buff roles first
            await this.removeAllBuffRoles(member);

            // Get the role ID for this tier
            const roleId = process.env[`DAILY_XP_BUFF_TIER_${tier}_ROLE`];
            console.log(`[DAILY BUFF] Environment variable DAILY_XP_BUFF_TIER_${tier}_ROLE = ${roleId}`);

            if (!roleId || roleId === `role_id_${tier}`) {
                console.error(`[DAILY BUFF] ❌ No valid role ID configured for tier ${tier} (found: ${roleId})`);
                console.log('[DAILY BUFF] Available environment variables:');
                for (let i = 1; i <= 6; i++) {
                    const envVar = `DAILY_XP_BUFF_TIER_${i}_ROLE`;
                    const envValue = process.env[envVar];
                    console.log(`[DAILY BUFF]   ${envVar} = ${envValue}`);
                }
                throw new Error(`No role configured for tier ${tier}`);
            }

            // Try to find the role
            const role = member.guild.roles.cache.get(roleId);
            if (!role) {
                console.error(`[DAILY BUFF] ❌ Role not found in guild: ${roleId}`);
                console.log('[DAILY BUFF] Available roles in guild:');
                member.guild.roles.cache.forEach(r => {
                    console.log(`[DAILY BUFF]   ${r.name} (${r.id})`);
                });
                throw new Error(`Role ${roleId} not found in guild`);
            }

            console.log(`[DAILY BUFF] 🎯 Found role: ${role.name} (${role.id})`);

            // Check bot permissions
            const botMember = member.guild.members.me;
            if (!botMember.permissions.has('ManageRoles')) {
                console.error('[DAILY BUFF] ❌ Bot missing "Manage Roles" permission');
                throw new Error('Bot missing "Manage Roles" permission');
            }

            // Check role hierarchy
            if (role.position >= botMember.roles.highest.position) {
                console.error(`[DAILY BUFF] ❌ Role ${role.name} is higher than bot's highest role`);
                throw new Error(`Cannot manage role ${role.name} - role hierarchy issue`);
            }

            // Add the role
            await member.roles.add(role, `Daily buff tier ${tier} awarded`);
            console.log(`[DAILY BUFF] ✅ Successfully awarded ${role.name} to ${member.user.username}`);

            // Save to database
            await this.saveBuffRoll(userId, guildId, tier);

        } catch (error) {
            console.error('[DAILY BUFF] ❌ Error applying buff role:', error);
            throw error; // Re-throw so the command can handle it
        }
    },

    // ✅ FIXED: Remove all buff roles with better error handling
    async removeAllBuffRoles(member) {
        try {
            console.log(`[DAILY BUFF] 🧹 Removing existing buff roles from ${member.user.username}`);
            
            let removedCount = 0;
            for (let i = 1; i <= 6; i++) {
                const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`];
                if (roleId && roleId !== `role_id_${i}` && member.roles.cache.has(roleId)) {
                    const role = member.guild.roles.cache.get(roleId);
                    if (role) {
                        await member.roles.remove(role, 'Removing old daily buff');
                        console.log(`[DAILY BUFF] ✅ Removed ${role.name} from ${member.user.username}`);
                        removedCount++;
                    }
                }
            }
            
            if (removedCount === 0) {
                console.log(`[DAILY BUFF] ℹ️ No existing buff roles to remove from ${member.user.username}`);
            } else {
                console.log(`[DAILY BUFF] ✅ Removed ${removedCount} buff roles from ${member.user.username}`);
            }
        } catch (error) {
            console.error('[DAILY BUFF] ❌ Error removing buff roles:', error);
            // Don't throw - this is not critical enough to fail the whole command
        }
    },

    // ✅ FIXED: Save buff roll with better table management
    async saveBuffRoll(userId, guildId, tier) {
        try {
            // Ensure table exists with proper structure
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
            
            const result = await global.xpTracker.db.query(`
                INSERT INTO daily_buff_rolls (user_id, guild_id, date, tier)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, guild_id, date)
                DO UPDATE SET tier = $4
                RETURNING *
            `, [userId, guildId, currentDay, tier]);

            console.log(`[DAILY BUFF] ✅ Saved tier ${tier} roll for ${userId} on ${currentDay}`);
            console.log(`[DAILY BUFF] Database result:`, result.rows[0]);

        } catch (error) {
            console.error('[DAILY BUFF] ❌ Error saving buff roll:', error);
            throw error;
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

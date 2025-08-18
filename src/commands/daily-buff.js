// src/commands/daily-buff.js - Daily XP Buff System with Spinning Wheel

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily-buff')
        .setDescription('🎰 Roll your daily XP buff! Resets at 3 AM EST'),

    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            const member = interaction.member;

            // Check if XP tracker is available
            if (!global.xpTracker || !global.xpTracker.db) {
                return await interaction.reply({
                    content: '❌ **Daily Buff System Unavailable**\n\nXP tracking system not initialized.',
                    ephemeral: true
                });
            }

            // Check if user already rolled today
            const hasRolledToday = await this.checkDailyRoll(userId, guildId);
            if (hasRolledToday) {
                const currentBuff = await this.getCurrentBuff(userId, guildId, member);
                
                const embed = new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setTitle('🎰 DAILY BUFF ALREADY CLAIMED')
                    .setDescription(`You've already rolled your daily buff!\n\n**Current Buff:** ${currentBuff.name} ${currentBuff.symbol}\n**Multiplier:** ${currentBuff.multiplier}x XP\n\n*Resets at 3:00 AM EST*`)
                    .setFooter({ text: '⚓ Marine Intelligence • Daily Buff System' })
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Start the spinning animation
            await interaction.deferReply();
            await this.performBuffRoll(interaction, userId, guildId, member);

        } catch (error) {
            console.error('[DAILY BUFF] Error in daily-buff command:', error);
            
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ **Error**\n\nSomething went wrong with the daily buff system. Please try again.'
                });
            } else {
                await interaction.reply({
                    content: '❌ **Error**\n\nSomething went wrong with the daily buff system. Please try again.',
                    ephemeral: true
                });
            }
        }
    },

    // Check if user has already rolled today (EST-based)
    async checkDailyRoll(userId, guildId) {
        try {
            const currentDay = this.getCurrentDay();
            
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

    // Get current day based on 3 AM EST reset (same logic as voice XP)
    getCurrentDay() {
        const now = new Date();
        
        // Convert to EST (UTC-5) or EDT (UTC-4) depending on daylight saving
        const estOffset = this.isEDT(now) ? -4 : -5;
        const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
        
        // If it's before 3 AM EST, consider it the previous day
        if (estTime.getHours() < 3) {
            estTime.setDate(estTime.getDate() - 1);
        }
        
        return estTime.toISOString().split('T')[0]; // YYYY-MM-DD format
    },

    // Check if date is in Eastern Daylight Time (EDT)
    isEDT(date) {
        const year = date.getFullYear();
        const marchSecondSunday = new Date(year, 2, 8);
        marchSecondSunday.setDate(marchSecondSunday.getDate() + (7 - marchSecondSunday.getDay()));
        const novemberFirstSunday = new Date(year, 10, 1);
        novemberFirstSunday.setDate(novemberFirstSunday.getDate() + (7 - novemberFirstSunday.getDay()));
        return date >= marchSecondSunday && date < novemberFirstSunday;
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

    // Perform the buff roll with spinning animation
    async performBuffRoll(interaction, userId, guildId, member) {
        const buffTiers = this.getBuffTiers();
        
        // Create spinning animation
        const spinFrames = [
            '🟢 🔵 🟣 [🎰] 🟡 🟠 🔴',
            '🔴 🟢 🔵 [🎰] 🟣 🟡 🟠',
            '🟠 🔴 🟢 [🎰] 🔵 🟣 🟡',
            '🟡 🟠 🔴 [🎰] 🟢 🔵 🟣',
            '🟣 🟡 🟠 [🎰] 🔴 🟢 🔵',
            '🔵 🟣 🟡 [🎰] 🟠 🔴 🟢'
        ];

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎰 DAILY BUFF WHEEL')
            .setDescription('Rolling your daily XP buff...')
            .addFields({
                name: '🎲 Spinning...',
                value: spinFrames[0],
                inline: false
            })
            .setFooter({ text: '⚓ Marine Intelligence • Daily Buff System' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // Animate the spinning wheel
        for (let i = 0; i < 15; i++) {
            await new Promise(resolve => setTimeout(resolve, 300 + (i * 50))); // Slow down progressively
            
            const frameIndex = i % spinFrames.length;
            embed.spliceFields(0, 1, {
                name: '🎲 Spinning...',
                value: spinFrames[frameIndex],
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });
        }

        // Calculate the result
        const rolledTier = this.calculateBuffTier();
        const buffInfo = buffTiers[rolledTier];
        const tierSymbol = buffInfo.symbol;

        // Final wheel display with result
        const finalWheel = `🟢 🔵 🟣 [${tierSymbol}] 🟡 🟠 🔴`;

        // Create final result embed
        const resultEmbed = new EmbedBuilder()
            .setColor(this.getTierColor(rolledTier))
            .setTitle('🎰 DAILY BUFF RESULT')
            .setDescription(`🎉 **${buffInfo.name}** ${tierSymbol}\n\n**XP Multiplier:** ${buffInfo.multiplier}x\n**Duration:** Until 3:00 AM EST`)
            .addFields(
                {
                    name: '🎲 Final Roll',
                    value: finalWheel,
                    inline: false
                },
                {
                    name: '📊 Buff Details',
                    value: `This buff applies to **all XP sources**:\n• Message XP\n• Voice XP\n• Reaction XP\n\n*Stacks with other role boosts!*`,
                    inline: false
                }
            )
            .setFooter({ text: `⚓ Marine Intelligence • Tier ${rolledTier} Buff Active` })
            .setTimestamp();

        await interaction.editReply({ embeds: [resultEmbed] });

        // Apply the buff role and save to database
        await this.applyBuffRole(userId, guildId, member, rolledTier);
    },

    // Calculate which tier to roll (weighted probabilities)
    calculateBuffTier() {
        const random = Math.random() * 100;
        
        // Weighted probabilities (adjust these as needed)
        if (random < 45) return 1;        // 45% - Common
        else if (random < 70) return 2;   // 25% - Rare  
        else if (random < 85) return 3;   // 15% - Epic
        else if (random < 94) return 4;   // 9% - Legendary
        else if (random < 99) return 5;   // 5% - Mythical
        else return 6;                    // 1% - Divine
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

    // Get tier color for embeds
    getTierColor(tier) {
        const colors = {
            1: '#22C55E', // Green
            2: '#3B82F6', // Blue  
            3: '#8B5CF6', // Purple
            4: '#F59E0B', // Yellow
            5: '#F97316', // Orange
            6: '#EF4444'  // Red
        };
        return colors[tier] || '#6B7280';
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
                    console.log(`[DAILY BUFF] Added ${role.name} to ${member.user.username}`);
                } else {
                    console.error(`[DAILY BUFF] Role not found: ${roleId}`);
                }
            }

            // Save to database
            await this.saveBuffRoll(userId, guildId, tier);

        } catch (error) {
            console.error('[DAILY BUFF] Error applying buff role:', error);
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

            const currentDay = this.getCurrentDay();
            
            await global.xpTracker.db.query(`
                INSERT INTO daily_buff_rolls (user_id, guild_id, date, tier)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, guild_id, date)
                DO UPDATE SET tier = $4
            `, [userId, guildId, currentDay, tier]);

            console.log(`[DAILY BUFF] Saved tier ${tier} roll for ${userId} on ${currentDay}`);

        } catch (error) {
            console.error('[DAILY BUFF] Error saving buff roll:', error);
        }
    }
};

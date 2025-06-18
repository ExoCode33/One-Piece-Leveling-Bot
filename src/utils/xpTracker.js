// src/utils/xpTracker.js - Fixed to use your environment variables

const { Pool } = require('pg');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');

class XPTracker {
    constructor() {
        console.log('[DEBUG] XPTracker constructor starting...');
        
        // Use your actual DATABASE_URL variable
        const databaseUrl = process.env.DATABASE_URL;
        
        if (!databaseUrl) {
            console.error('[ERROR] DATABASE_URL not found in environment variables!');
            throw new Error('DATABASE_URL not found');
        }
        
        console.log('[DEBUG] Using DATABASE_URL for connection');
        
        this.pool = new Pool({
            connectionString: databaseUrl,
            ssl: process.env.NODE_ENV === 'production' ? { 
                rejectUnauthorized: false 
            } : false,
            connectionTimeoutMillis: 10000,
            idleTimeoutMillis: 30000,
            max: 10
        });
        
        this.pool.on('error', (err) => {
            console.error('[ERROR] Database pool error:', err);
        });
        
        this.cooldowns = new Map();
        this.initializeAsync();
    }

    async initializeAsync() {
        try {
            await this.testConnection();
            await this.initializeTables();
            console.log('[INFO] XP Tracker initialized successfully');
        } catch (error) {
            console.error('[ERROR] XP Tracker initialization failed:', error);
            throw error;
        }
    }

    async testConnection() {
        try {
            console.log('[DEBUG] Testing database connection...');
            const client = await this.pool.connect();
            console.log('[INFO] Database connected successfully');
            
            const result = await client.query('SELECT NOW()');
            console.log('[DEBUG] Database query test successful');
            
            client.release();
            return true;
        } catch (error) {
            console.error('[ERROR] Database connection failed:', error);
            throw error;
        }
    }

    async initializeTables() {
        try {
            console.log('[DEBUG] Initializing database tables...');
            
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS user_xp (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    guild_id VARCHAR(20) NOT NULL,
                    total_xp INTEGER DEFAULT 0,
                    messages INTEGER DEFAULT 0,
                    reactions INTEGER DEFAULT 0,
                    voice_time INTEGER DEFAULT 0,
                    daily_voice_time INTEGER DEFAULT 0,
                    last_voice_reset DATE DEFAULT CURRENT_DATE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, guild_id)
                )
            `);

            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS guild_settings (
                    id SERIAL PRIMARY KEY,
                    guild_id VARCHAR(20) UNIQUE NOT NULL,
                    message_xp INTEGER DEFAULT 15,
                    voice_xp INTEGER DEFAULT 5,
                    reaction_xp INTEGER DEFAULT 2,
                    xp_cooldown INTEGER DEFAULT 60,
                    level_up_channel VARCHAR(20),
                    role_rewards JSONB DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_user_xp_lookup ON user_xp(user_id, guild_id);
                CREATE INDEX IF NOT EXISTS idx_user_xp_leaderboard ON user_xp(guild_id, total_xp DESC);
                CREATE INDEX IF NOT EXISTS idx_user_xp_voice_reset ON user_xp(last_voice_reset);
                CREATE INDEX IF NOT EXISTS idx_guild_settings_lookup ON guild_settings(guild_id);
            `);

            const countResult = await this.pool.query('SELECT COUNT(*) FROM user_xp');
            console.log(`[DEBUG] Database has ${countResult.rows[0].count} user records`);

            console.log('[INFO] Database tables initialized successfully');
        } catch (error) {
            console.error('[ERROR] Error initializing database tables:', error);
            throw error;
        }
    }

    // Generate random XP within your min/max ranges
    generateRandomXP(source) {
        let min, max;
        
        switch (source) {
            case 'message':
                min = parseInt(process.env.MESSAGE_XP_MIN) || 25;
                max = parseInt(process.env.MESSAGE_XP_MAX) || 35;
                break;
            case 'voice':
                min = parseInt(process.env.VOICE_XP_MIN) || 45;
                max = parseInt(process.env.VOICE_XP_MAX) || 55;
                break;
            case 'reaction':
                min = parseInt(process.env.REACTION_XP_MIN) || 25;
                max = parseInt(process.env.REACTION_XP_MAX) || 35;
                break;
            default:
                min = 15;
                max = 25;
        }
        
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Check if user is on cooldown using your cooldown values
    isOnCooldown(userId, guildId, source = 'message') {
        const key = `${userId}-${guildId}-${source}`;
        const now = Date.now();
        const cooldownTime = this.cooldowns.get(key);
        
        if (cooldownTime && now < cooldownTime) {
            return true;
        }
        
        return false;
    }

    setCooldown(userId, guildId, source = 'message') {
        const key = `${userId}-${guildId}-${source}`;
        let cooldownMs;
        
        switch (source) {
            case 'message':
                cooldownMs = parseInt(process.env.MESSAGE_COOLDOWN) || 60000;
                break;
            case 'voice':
                cooldownMs = parseInt(process.env.VOICE_COOLDOWN) || 60000;
                break;
            case 'reaction':
                cooldownMs = parseInt(process.env.REACTION_COOLDOWN) || 300000;
                break;
            default:
                cooldownMs = 60000;
        }
        
        const cooldownTime = now + cooldownMs;
        this.cooldowns.set(key, cooldownTime);
        
        setTimeout(() => {
            this.cooldowns.delete(key);
        }, cooldownMs);
    }

    // Level calculation using your formula
    calculateLevel(totalXP) {
        if (totalXP < 0) return 1;
        
        const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
        const formula = process.env.FORMULA_CURVE || 'exponential';
        
        if (formula === 'exponential') {
            return Math.floor(Math.pow(totalXP / 100, 1 / multiplier)) + 1;
        } else {
            // Linear fallback
            return Math.floor(Math.sqrt(totalXP / 100)) + 1;
        }
    }

    getXPForLevel(level) {
        if (level <= 1) return 0;
        
        const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
        const formula = process.env.FORMULA_CURVE || 'exponential';
        
        if (formula === 'exponential') {
            return Math.floor(Math.pow(level - 1, multiplier) * 100);
        } else {
            return Math.pow(level - 1, 2) * 100;
        }
    }

    // Fixed addXP method using your environment variables
    async addXP(userId, guildId, amount, source = 'message') {
        try {
            // If amount not provided, generate random amount
            if (!amount) {
                amount = this.generateRandomXP(source);
            }
            
            // Apply XP multiplier
            const multiplier = parseFloat(process.env.XP_MULTIPLIER) || 1.0;
            amount = Math.floor(amount * multiplier);
            
            let query, values;
            
            if (source === 'voice') {
                query = `
                    INSERT INTO user_xp (user_id, guild_id, total_xp, voice_time, updated_at)
                    VALUES ($1, $2, $3, 60, CURRENT_TIMESTAMP)
                    ON CONFLICT (user_id, guild_id)
                    DO UPDATE SET
                        total_xp = user_xp.total_xp + $3,
                        voice_time = user_xp.voice_time + 60,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING total_xp
                `;
                values = [userId, guildId, amount];
            } else if (source === 'reaction') {
                query = `
                    INSERT INTO user_xp (user_id, guild_id, total_xp, reactions, updated_at)
                    VALUES ($1, $2, $3, 1, CURRENT_TIMESTAMP)
                    ON CONFLICT (user_id, guild_id)
                    DO UPDATE SET
                        total_xp = user_xp.total_xp + $3,
                        reactions = user_xp.reactions + 1,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING total_xp
                `;
                values = [userId, guildId, amount];
            } else {
                query = `
                    INSERT INTO user_xp (user_id, guild_id, total_xp, messages, updated_at)
                    VALUES ($1, $2, $3, 1, CURRENT_TIMESTAMP)
                    ON CONFLICT (user_id, guild_id)
                    DO UPDATE SET
                        total_xp = user_xp.total_xp + $3,
                        messages = user_xp.messages + 1,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING total_xp
                `;
                values = [userId, guildId, amount];
            }

            const result = await this.pool.query(query, values);
            const newTotalXP = result.rows[0].total_xp;

            // Check for level up
            const oldLevel = this.calculateLevel(newTotalXP - amount);
            const newLevel = this.calculateLevel(newTotalXP);

            // Check max level
            const maxLevel = parseInt(process.env.MAX_LEVEL) || 50;
            if (newLevel > maxLevel) {
                // Cap at max level
                const maxXP = this.getXPForLevel(maxLevel);
                await this.setUserXP(userId, guildId, maxXP);
                return { newTotalXP: maxXP, leveledUp: false, newLevel: maxLevel };
            }

            if (newLevel > oldLevel && process.env.LEVELUP_ENABLED === 'true') {
                const guild = global.client.guilds.cache.get(guildId);
                if (guild) {
                    const member = await guild.members.fetch(userId).catch(() => null);
                    if (member) {
                        // Use your levelup channel
                        let channel = null;
                        if (process.env.LEVELUP_CHANNEL) {
                            channel = guild.channels.cache.get(process.env.LEVELUP_CHANNEL);
                        }
                        
                        if (!channel) {
                            channel = guild.systemChannel || 
                                     guild.channels.cache.find(ch => ch.type === 0 && ch.permissionsFor(guild.members.me).has('SendMessages'));
                        }

                        if (channel) {
                            await this.sendMarineLevelUp({
                                userId,
                                guildId,
                                oldLevel,
                                newLevel,
                                totalXP: newTotalXP,
                                member,
                                channel
                            });
                        }

                        // Handle role rewards using your level roles
                        await this.handleLevelRoles(member, newLevel);
                    }
                }
            }

            return { newTotalXP, leveledUp: newLevel > oldLevel, newLevel };
        } catch (error) {
            console.error('[ERROR] Error adding XP:', error);
            throw error;
        }
    }

    // Handle your specific level roles
    async handleLevelRoles(member, level) {
        try {
            const levelRoles = [
                { level: 5, roleId: process.env.LEVEL_5_ROLE },
                { level: 10, roleId: process.env.LEVEL_10_ROLE },
                { level: 15, roleId: process.env.LEVEL_15_ROLE },
                { level: 20, roleId: process.env.LEVEL_20_ROLE },
                { level: 25, roleId: process.env.LEVEL_25_ROLE },
                { level: 30, roleId: process.env.LEVEL_30_ROLE },
                { level: 35, roleId: process.env.LEVEL_35_ROLE },
                { level: 40, roleId: process.env.LEVEL_40_ROLE },
                { level: 45, roleId: process.env.LEVEL_45_ROLE },
                { level: 50, roleId: process.env.LEVEL_50_ROLE }
            ];

            for (const { level: reqLevel, roleId } of levelRoles) {
                if (level >= reqLevel && roleId) {
                    const role = member.guild.roles.cache.get(roleId);
                    if (role && !member.roles.cache.has(roleId)) {
                        await member.roles.add(role);
                        console.log(`[INFO] Added level ${reqLevel} role to ${member.user.tag}`);
                    }
                }
            }
        } catch (error) {
            console.error('[ERROR] Error handling level roles:', error);
        }
    }

    // Voice XP processing with your anti-AFK settings
    async processVoiceXP() {
        try {
            if (process.env.DEBUG_VOICE === 'true') {
                console.log('[DEBUG] Processing voice XP for active users...');
            }
            
            const guilds = global.client.guilds.cache;
            const minMembers = parseInt(process.env.VOICE_MIN_MEMBERS) || 2;
            
            for (const [guildId, guild] of guilds) {
                try {
                    const voiceChannels = guild.channels.cache.filter(channel => 
                        channel.type === 2 && channel.members.size >= minMembers
                    );

                    for (const [channelId, channel] of voiceChannels) {
                        for (const [userId, member] of channel.members) {
                            if (member.user.bot) continue;

                            // Anti-AFK check
                            if (process.env.VOICE_ANTI_AFK === 'true') {
                                if (member.voice.mute || member.voice.deaf || member.voice.selfMute || member.voice.selfDeaf) {
                                    continue;
                                }
                            }

                            if (guild.afkChannelId && channelId === guild.afkChannelId) {
                                continue;
                            }

                            // Check cooldown
                            if (this.isOnCooldown(userId, guildId, 'voice')) {
                                continue;
                            }

                            // Generate random voice XP
                            const voiceXP = this.generateRandomXP('voice');
                            await this.addXP(userId, guildId, voiceXP, 'voice');
                            
                            // Set cooldown
                            this.setCooldown(userId, guildId, 'voice');
                            
                            if (process.env.DEBUG_VOICE === 'true') {
                                console.log(`[DEBUG] Added ${voiceXP} voice XP to ${member.user.tag}`);
                            }
                        }
                    }
                } catch (guildError) {
                    console.error(`[ERROR] Error processing voice XP for guild ${guildId}:`, guildError);
                }
            }
        } catch (error) {
            console.error('[ERROR] Error in processVoiceXP:', error);
        }
    }

    async getUserXP(userId, guildId) {
        try {
            const query = 'SELECT * FROM user_xp WHERE user_id = $1 AND guild_id = $2';
            const result = await this.pool.query(query, [userId, guildId]);
            
            if (result.rows.length > 0) {
                return result.rows[0];
            } else {
                return {
                    user_id: userId,
                    guild_id: guildId,
                    total_xp: 0,
                    messages: 0,
                    reactions: 0,
                    voice_time: 0,
                    daily_voice_time: 0
                };
            }
        } catch (error) {
            console.error('[ERROR] Error getting user XP:', error);
            throw error;
        }
    }

    async setUserXP(userId, guildId, totalXP) {
        try {
            const query = `
                INSERT INTO user_xp (user_id, guild_id, total_xp, updated_at)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, guild_id)
                DO UPDATE SET
                    total_xp = $3,
                    updated_at = CURRENT_TIMESTAMP
            `;
            await this.pool.query(query, [userId, guildId, totalXP]);
        } catch (error) {
            console.error('[ERROR] Error setting user XP:', error);
            throw error;
        }
    }

    async resetUser(userId, guildId) {
        try {
            const query = 'DELETE FROM user_xp WHERE user_id = $1 AND guild_id = $2';
            await this.pool.query(query, [userId, guildId]);
        } catch (error) {
            console.error('[ERROR] Error resetting user:', error);
            throw error;
        }
    }

    async getUserRank(userId, guildId) {
        try {
            const query = `
                SELECT COUNT(*) + 1 as rank
                FROM user_xp
                WHERE guild_id = $1 AND total_xp > (
                    SELECT COALESCE(total_xp, 0)
                    FROM user_xp
                    WHERE user_id = $2 AND guild_id = $1
                )
            `;
            const result = await this.pool.query(query, [guildId, userId]);
            return parseInt(result.rows[0].rank);
        } catch (error) {
            console.error('[ERROR] Error getting user rank:', error);
            return 0;
        }
    }

    async getLeaderboard(guildId, limit = 10) {
        try {
            let query = `
                SELECT user_id, total_xp, messages, reactions, voice_time
                FROM user_xp
                WHERE guild_id = $1 AND total_xp > 0
            `;
            
            // Exclude role if specified
            if (process.env.LEADERBOARD_EXCLUDE_ROLE) {
                // Note: This would need guild member data to filter by role
                // For now, just get all users
            }
            
            query += ` ORDER BY total_xp DESC LIMIT $2`;
            
            const result = await this.pool.query(query, [guildId, limit]);
            return result.rows;
        } catch (error) {
            console.error('[ERROR] Error getting leaderboard:', error);
            return [];
        }
    }

    getXPToNextLevel(currentXP) {
        const currentLevel = this.calculateLevel(currentXP);
        const nextLevelXP = this.getXPForLevel(currentLevel + 1);
        return nextLevelXP - currentXP;
    }

    async cleanupDailyVoiceXP() {
        try {
            console.log('[INFO] Starting daily voice XP cleanup...');
            
            const query = `
                UPDATE user_xp 
                SET daily_voice_time = 0, 
                    last_voice_reset = CURRENT_DATE 
                WHERE last_voice_reset < CURRENT_DATE OR last_voice_reset IS NULL
            `;
            
            const result = await this.pool.query(query);
            console.log(`[INFO] Daily voice XP cleanup completed. Reset ${result.rowCount} users.`);
        } catch (error) {
            console.error('[ERROR] Error in cleanupDailyVoiceXP:', error);
        }
    }

    // Marine Level-Up System (same as before)
    async sendMarineLevelUp(levelUpData) {
        try {
            const { userId, guildId, oldLevel, newLevel, totalXP, member, channel } = levelUpData;

            const oldBounty = this.getBountyForLevel(oldLevel);
            const newBounty = this.getBountyForLevel(newLevel);
            const bountyIncrease = newBounty - oldBounty;

            const userData = await this.getUserXP(userId, guildId);
            
            const canvas = await this.createLevelUpPoster({
                userId: userId,
                level: newLevel,
                oldLevel: oldLevel,
                total_xp: totalXP,
                messages: userData.messages || 0,
                reactions: userData.reactions || 0,
                voice_time: userData.voice_time || 0,
                member: member
            });

            const attachment = new AttachmentBuilder(canvas.toBuffer(), { 
                name: `bounty-update-${userId}.png` 
            });

            const oldThreat = this.getThreatLevelName(oldLevel);
            const newThreat = this.getThreatLevelName(newLevel);
            const threatUpgrade = oldThreat !== newThreat;

            let content = `🚨 **MARINE HQ ALERT** 🚨\n`;
            
            if (process.env.LEVELUP_PING_USER === 'true') {
                content += `${member} has been reclassified as a **Level ${newLevel}** threat!`;
            } else {
                content += `**${member.displayName}** has been reclassified as a **Level ${newLevel}** threat!`;
            }

            const embed = new EmbedBuilder()
                .setColor('#DC143C')
                .setTitle('🚨 WORLD GOVERNMENT BOUNTY UPDATE 🚨')
                .setDescription(`**MARINE INTELLIGENCE BUREAU**\n*Classified Report - Level ${newLevel} Threat*`)
                .addFields([
                    {
                        name: '👤 SUBJECT IDENTIFICATION',
                        value: `**Name:** ${member.displayName}\n**Previous Classification:** Level ${oldLevel} ${oldThreat}\n**New Classification:** Level ${newLevel} ${newThreat}`,
                        inline: false
                    },
                    {
                        name: '💰 BOUNTY ASSESSMENT',
                        value: `**Previous Bounty:** ${oldBounty.toLocaleString()} Berries\n**New Bounty:** ${newBounty.toLocaleString()} Berries\n**Increase:** +${bountyIncrease.toLocaleString()} Berries`,
                        inline: true
                    }
                ])
                .setImage('attachment://bounty-update-' + userId + '.png')
                .setTimestamp()
                .setFooter({ 
                    text: '⚓ World Government Marine Intelligence Division'
                });

            // Add XP info if enabled
            if (process.env.LEVELUP_SHOW_XP === 'true') {
                const nextLevelXP = this.getXPToNextLevel(totalXP);
                embed.addFields([{
                    name: '📊 XP PROGRESS',
                    value: `**Total XP:** ${totalXP.toLocaleString()}\n**XP to Next Level:** ${nextLevelXP.toLocaleString()}`,
                    inline: true
                }]);
            }

            // Add progress bar if enabled
            if (process.env.LEVELUP_SHOW_PROGRESS === 'true') {
                const currentLevelXP = this.getXPForLevel(newLevel);
                const nextLevelXP = this.getXPForLevel(newLevel + 1);
                const progressXP = totalXP - currentLevelXP;
                const neededXP = nextLevelXP - currentLevelXP;
                const progress = Math.floor((progressXP / neededXP) * 10);
                const progressBar = '█'.repeat(progress) + '░'.repeat(10 - progress);
                
                embed.addFields([{
                    name: '📈 LEVEL PROGRESS',
                    value: `\`${progressBar}\` ${Math.floor((progressXP / neededXP) * 100)}%`,
                    inline: false
                }]);
            }

            await channel.send({
                content: content,
                embeds: [embed],
                files: [attachment]
            });

        } catch (error) {
            console.error('[ERROR] Error sending Marine level-up:', error);
        }
    }

    async createLevelUpPoster(wantedPosterData) {
        const canvas = createCanvas(800, 1000);
        const ctx = canvas.getContext('2d');

        try {
            const gradient = ctx.createLinearGradient(0, 0, 0, 1000);
            gradient.addColorStop(0, '#F4E4BC');
            gradient.addColorStop(0.5, '#E8D5A3');
            gradient.addColorStop(1, '#D4C18A');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 800, 1000);

            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth = 15;
            ctx.strokeRect(15, 15, 770, 970);

            ctx.strokeStyle = '#A0522D';
            ctx.lineWidth = 8;
            ctx.strokeRect(25, 25, 750, 950);

            ctx.font = 'bold 48px Arial';
            ctx.fillStyle = '#8B0000';
            ctx.textAlign = 'center';
            ctx.fillText('BOUNTY UPDATE', 400, 80);

            ctx.font = 'bold 32px Arial';
            ctx.fillStyle = '#2F4F4F';
            ctx.fillText(`LEVEL ${wantedPosterData.oldLevel} → ${wantedPosterData.level}`, 400, 130);

            try {
                const avatar = await loadImage(wantedPosterData.member.displayAvatarURL({ extension: 'png', size: 256 }));
                
                ctx.save();
                ctx.beginPath();
                ctx.arc(400, 320, 120, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(avatar, 280, 200, 240, 240);
                ctx.restore();

                ctx.strokeStyle = '#8B0000';
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.arc(400, 320, 120, 0, Math.PI * 2);
                ctx.stroke();
            } catch (error) {
                console.error('Error loading avatar:', error);
                ctx.fillStyle = '#DDD';
                ctx.beginPath();
                ctx.arc(400, 320, 120, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.font = 'bold 36px Arial';
            ctx.fillStyle = '#000';
            ctx.textAlign = 'center';
            ctx.fillText(wantedPosterData.member.displayName.toUpperCase(), 400, 490);

            ctx.font = 'bold 42px Arial';
            ctx.fillStyle = '#8B0000';
            ctx.fillText('LEVEL UP!', 400, 540);

            const bounty = this.getBountyForLevel(wantedPosterData.level);
            ctx.font = 'bold 48px Arial';
            ctx.fillStyle = '#FF6B35';
            ctx.fillText(`${bounty.toLocaleString()}`, 400, 620);

            ctx.font = 'bold 36px Arial';
            ctx.fillStyle = '#FF8C00';
            ctx.fillText('BERRIES', 400, 670);

            ctx.font = 'bold 24px Arial';
            ctx.fillStyle = '#2F4F4F';
            ctx.textAlign = 'left';
            
            const stats = [
                `Messages: ${wantedPosterData.messages}`,
                `Reactions: ${wantedPosterData.reactions}`,
                `Voice: ${Math.floor(wantedPosterData.voice_time / 60)}min`
            ];

            stats.forEach((stat, index) => {
                ctx.fillText(stat, 100, 750 + (index * 35));
            });

            ctx.font = 'bold 28px Arial';
            ctx.fillStyle = '#8B0000';
            ctx.textAlign = 'center';
            ctx.fillText(`THREAT: ${this.getThreatLevelName(wantedPosterData.level)}`, 400, 880);

            ctx.font = 'bold 20px Arial';
            ctx.fillStyle = 'rgba(139, 0, 0, 0.3)';
            ctx.textAlign = 'center';
            ctx.fillText('MARINE', 400, 940);

            return canvas;
        } catch (error) {
            console.error('Canvas error:', error);
            ctx.fillStyle = '#F4E4BC';
            ctx.fillRect(0, 0, 800, 1000);
            ctx.fillStyle = '#000';
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('LEVEL UP!', 400, 400);
            ctx.fillText(`Level ${wantedPosterData.level}`, 400, 500);
            return canvas;
        }
    }

    getBountyForLevel(level) {
        if (level >= 50) return 5000000000;
        if (level >= 45) return 3000000000;
        if (level >= 40) return 1000000000;
        if (level >= 35) return 500000000;
        if (level >= 30) return 100000000;
        if (level >= 25) return 50000000;
        if (level >= 20) return 25000000;
        if (level >= 15) return 10000000;
        if (level >= 10) return 5000000;
        if (level >= 5) return 1000000;
        return level * 100000;
    }

    getThreatLevelName(level) {
        if (level >= 50) return "PIRATE KING";
        if (level >= 45) return "EMPEROR";
        if (level >= 40) return "WARLORD";
        if (level >= 35) return "SUPERNOVA";
        if (level >= 30) return "NOTORIOUS";
        if (level >= 25) return "WANTED";
        if (level >= 20) return "DANGEROUS";
        if (level >= 15) return "KNOWN";
        if (level >= 10) return "ROOKIE";
        if (level >= 5) return "APPRENTICE";
        return "UNKNOWN";
    }

    getActivityLevel(userData) {
        const totalActivity = (userData.messages || 0) + (userData.reactions || 0) + Math.floor((userData.voice_time || 0) / 60);
        
        if (totalActivity >= 5000) return "Extremely Active";
        if (totalActivity >= 2000) return "Highly Active";
        if (totalActivity >= 1000) return "Very Active";
        if (totalActivity >= 500) return "Active";
        if (totalActivity >= 100) return "Moderately Active";
        return "Low Activity";
    }

    // Guild Settings Methods
    async getGuildSettings(guildId) {
        try {
            const query = 'SELECT * FROM guild_settings WHERE guild_id = $1';
            const result = await this.pool.query(query, [guildId]);
            
            if (result.rows.length > 0) {
                return result.rows[0];
            } else {
                return {
                    guild_id: guildId,
                    message_xp: parseInt(process.env.MESSAGE_XP_MIN) || 25,
                    voice_xp: parseInt(process.env.VOICE_XP_MIN) || 45,
                    reaction_xp: parseInt(process.env.REACTION_XP_MIN) || 25,
                    xp_cooldown: parseInt(process.env.MESSAGE_COOLDOWN) || 60000,
                    level_up_channel: process.env.LEVELUP_CHANNEL,
                    role_rewards: {}
                };
            }
        } catch (error) {
            console.error('[ERROR] Error getting guild settings:', error);
            return {
                guild_id: guildId,
                message_xp: 25,
                voice_xp: 45,
                reaction_xp: 25,
                xp_cooldown: 60000,
                level_up_channel: null,
                role_rewards: {}
            };
        }
    }

    async updateGuildSettings(guildId, settings) {
        try {
            const query = `
                INSERT INTO guild_settings (guild_id, message_xp, voice_xp, reaction_xp, xp_cooldown, level_up_channel, role_rewards, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                ON CONFLICT (guild_id)
                DO UPDATE SET
                    message_xp = $2,
                    voice_xp = $3,
                    reaction_xp = $4,
                    xp_cooldown = $5,
                    level_up_channel = $6,
                    role_rewards = $7,
                    updated_at = CURRENT_TIMESTAMP
            `;
            
            await this.pool.query(query, [
                guildId,
                settings.message_xp,
                settings.voice_xp,
                settings.reaction_xp,
                settings.xp_cooldown,
                settings.level_up_channel,
                JSON.stringify(settings.role_rewards || {})
            ]);
        } catch (error) {
            console.error('[ERROR] Error updating guild settings:', error);
            throw error;
        }
    }

    // Role Rewards (legacy method for compatibility)
    async handleRoleRewards(member, level) {
        await this.handleLevelRoles(member, level);
    }

    // Cleanup method
    async cleanup() {
        try {
            await this.pool.end();
            console.log('[INFO] XP Tracker cleanup completed');
        } catch (error) {
            console.error('[ERROR] Error during XP Tracker cleanup:', error);
        }
    }
}

module.exports = XPTracker;

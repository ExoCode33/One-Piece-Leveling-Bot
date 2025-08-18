// src/utils/xpTracker.js - Complete XP Tracker for One Piece Leveling Bot with Canvas Support

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

// Register custom fonts at the top of the file
try {
    registerFont(path.join(__dirname, '../../assets/fonts/captkd.ttf'), { family: 'CaptainKiddNF' });
    registerFont(path.join(__dirname, '../../assets/fonts/Cinzel-Bold.otf'), { family: 'Cinzel' });
    registerFont(path.join(__dirname, '../../assets/fonts/Times New Normal Regular.ttf'), { family: 'TimesNewNormal' });
    console.log('[XP TRACKER] Successfully registered custom fonts for wanted posters');
} catch (error) {
    console.error('[XP TRACKER] Failed to register custom fonts:', error.message);
    console.log('[XP TRACKER] Falling back to system fonts');
}

class XPTracker {
    constructor(client, database) {
        this.client = client;
        this.db = database;
        this.voiceSessions = new Map();
        this.cooldowns = new Map();
        this.dailyVoiceXP = new Map(); // Format: "userId_guildId_YYYY-MM-DD" -> total XP earned today
        
        this.loadGuildSettingsFromDatabase();
        this.initializeExistingVoiceSessions();
        this.loadDailyVoiceXPFromDatabase();
    }

    // Canvas function for wanted posters (SAME as leaderboard.js)
    async createWantedPoster(userData, guild) {
        const width = 600, height = 900;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Load and draw scroll texture background
        try {
            const scrollTexture = await loadImage(path.join(__dirname, '../../assets/scroll_texture.jpg'));
            ctx.drawImage(scrollTexture, 0, 0, width, height);
            console.log('[XP TRACKER] Successfully loaded scroll texture background');
        } catch (error) {
            console.log('[XP TRACKER] Scroll texture not found, using fallback parchment color');
            ctx.fillStyle = '#f5e6c5';
            ctx.fillRect(0, 0, width, height);
        }
        
        // Borders
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 8;
        ctx.strokeRect(0, 0, width, height);
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, width - 20, height - 20);
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeRect(18, 18, width - 36, height - 36);

        // WANTED title
        ctx.fillStyle = '#111';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '81px CaptainKiddNF, Arial, sans-serif';
        const wantedY = height * (1 - 92/100);
        const wantedX = (50/100) * width;
        ctx.fillText('WANTED', wantedX, wantedY);

        // Image Box
        const photoSize = (95/100) * 400;
        const photoX = ((50/100) * width) - (photoSize/2);
        const photoY = height * (1 - 65/100) - (photoSize/2);
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeRect(photoX, photoY, photoSize, photoSize);

        let member = null;
        try {
            if (guild && userData.userId) member = await guild.members.fetch(userData.userId);
        } catch {}
        
        const avatarArea = { x: photoX + 3, y: photoY + 3, width: photoSize - 6, height: photoSize - 6 };
        if (member) {
            try {
                const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true });
                const avatar = await loadImage(avatarURL);
                
                ctx.save();
                ctx.beginPath();
                ctx.rect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
                ctx.clip();
                
                ctx.filter = 'contrast(0.95) sepia(0.05)';
                ctx.drawImage(avatar, avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
                ctx.filter = 'none';
                
                ctx.restore();
            } catch {
                console.log('[XP TRACKER] No avatar found, texture will show through');
            }
        }

        // "DEAD OR ALIVE"
        ctx.fillStyle = '#111';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '57px CaptainKiddNF, Arial, sans-serif';
        const deadOrAliveY = height * (1 - 39/100);
        const deadOrAliveX = (50/100) * width;
        ctx.fillText('DEAD OR ALIVE', deadOrAliveX, deadOrAliveY);

        // Name
        ctx.font = '69px CaptainKiddNF, Arial, sans-serif';
        let displayName = 'UNKNOWN PIRATE';
        if (member) displayName = member.displayName.replace(/[^\w\s-]/g, '').toUpperCase().substring(0, 16);
        else if (userData.userId) displayName = `PIRATE ${userData.userId.slice(-4)}`;
        
        // Check if name is too long and adjust
        ctx.textAlign = 'center';
        let nameWidth = ctx.measureText(displayName).width;
        if (nameWidth > width - 60) {
            ctx.font = '55px CaptainKiddNF, Arial, sans-serif';
        }
        
        const nameY = height * (1 - 30/100);
        const nameX = (50/100) * width;
        ctx.fillText(displayName, nameX, nameY);

        // Berry Symbol and Bounty Numbers
        const berryBountyGap = 5;
        
        // Get BOUNTY amount for user's level and check if Pirate King
        const { getBountyForLevel } = require('./bountySystem');
        const isPirateKingData = userData.isPirateKing || false;
        const bountyAmount = getBountyForLevel(userData.level, isPirateKingData);
        const bountyStr = bountyAmount.toLocaleString();
        
        console.log(`[XP TRACKER] Level ${userData.level} ${isPirateKingData ? '(PIRATE KING)' : ''} = Bounty ฿${bountyStr}`);
        
        ctx.font = '54px Cinzel, Georgia, serif';
        const bountyTextWidth = ctx.measureText(bountyStr).width;
        
        // Berry symbol size
        const berrySize = (32/100) * 150;
        
        // Calculate total width of the bounty unit (berry + gap + text)
        const gapPixels = (berryBountyGap/100) * width;
        const totalBountyWidth = berrySize + gapPixels + bountyTextWidth;
        
        // Center the entire bounty unit horizontally
        const bountyUnitStartX = (width - totalBountyWidth) / 2;
        
        // Position berry symbol at the start of the centered unit
        const berryX = bountyUnitStartX + (berrySize/2);
        const berryY = height * (1 - 22/100) - (berrySize/2);
        
        let berryImg;
        try {
            const berryPath = path.join(__dirname, '../../assets/berry.png');
            berryImg = await loadImage(berryPath);
        } catch {
            // Create simple berry symbol
            const berryCanvas = createCanvas(berrySize, berrySize);
            const berryCtx = berryCanvas.getContext('2d');
            berryCtx.fillStyle = '#111';
            berryCtx.font = `bold ${berrySize}px serif`;
            berryCtx.textAlign = 'center';
            berryCtx.textBaseline = 'middle';
            berryCtx.fillText('฿', berrySize/2, berrySize/2);
            berryImg = berryCanvas;
        }
        
        ctx.drawImage(berryImg, berryX - (berrySize/2), berryY, berrySize, berrySize);

        // Position bounty numbers with fixed gap from berry
        const bountyX = bountyUnitStartX + berrySize + gapPixels;
        const bountyY = height * (1 - 22/100);
        
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#111';
        ctx.fillText(bountyStr, bountyX, bountyY);

        // One Piece logo
        try {
            const onePieceLogoPath = path.join(__dirname, '../../assets/one-piece-symbol.png');
            const onePieceLogo = await loadImage(onePieceLogoPath);
            const logoSize = (26/100) * 200;
            const logoX = ((50/100) * width) - (logoSize/2);
            const logoY = height * (1 - 4.5/100) - (logoSize/2);
            
            ctx.globalAlpha = 0.6;
            ctx.filter = 'sepia(0.2) brightness(0.9)';
            ctx.drawImage(onePieceLogo, logoX, logoY, logoSize, logoSize);
            ctx.globalAlpha = 1.0;
            ctx.filter = 'none';
        } catch {
            console.log('[XP TRACKER] One Piece logo not found at assets/one-piece-symbol.png');
        }

        // "MARINE" text
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.font = '24px TimesNewNormal, Times, serif';
        ctx.fillStyle = '#111';
        
        const marineText = 'M A R I N E';
        const marineX = (96/100) * width;
        const marineY = height * (1 - 2/100);
        ctx.fillText(marineText, marineX, marineY);

        return canvas;
    }

    // Load daily voice XP from database on startup
    async loadDailyVoiceXPFromDatabase() {
        try {
            console.log('[DAILY CAP] Loading daily voice XP data from database...');
            
            // Create daily_voice_xp table if it doesn't exist
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS daily_voice_xp (
                    user_id VARCHAR(20) NOT NULL,
                    guild_id VARCHAR(20) NOT NULL,
                    date DATE NOT NULL,
                    total_xp INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, guild_id, date)
                )
            `);

            // Create index for better performance
            await this.db.query('CREATE INDEX IF NOT EXISTS idx_daily_voice_xp_date ON daily_voice_xp(date)');

            // Load today's data (based on EST reset at 3 AM)
            const currentDay = this.getCurrentDay();
            const result = await this.db.query(
                'SELECT user_id, guild_id, total_xp FROM daily_voice_xp WHERE date = $1',
                [currentDay]
            );

            let loadedCount = 0;
            for (const row of result.rows) {
                const dailyKey = `${row.user_id}_${row.guild_id}_${currentDay}`;
                this.dailyVoiceXP.set(dailyKey, row.total_xp);
                loadedCount++;
            }

            console.log(`[DAILY CAP] Loaded ${loadedCount} daily voice XP records for ${currentDay}`);

            // Clean up old records (older than 30 days for analysis)
            await this.db.query(
                "DELETE FROM daily_voice_xp WHERE date < CURRENT_DATE - INTERVAL '30 days'"
            );

            // Set up daily reset timer for 3 AM EST
            this.scheduleDailyReset();

        } catch (error) {
            console.error('[DAILY CAP] Error loading daily voice XP data:', error);
        }
    }

    // Get current day based on 3 AM EST reset
    getCurrentDay() {
        const now = new Date();
        
        // Convert to EST (UTC-5) or EDT (UTC-4) depending on daylight saving
        const estOffset = this.isEDT(now) ? -4 : -5; // EDT or EST
        const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
        
        // If it's before 3 AM EST, consider it the previous day
        if (estTime.getHours() < 3) {
            estTime.setDate(estTime.getDate() - 1);
        }
        
        return estTime.toISOString().split('T')[0]; // YYYY-MM-DD format
    }

    // Check if date is in Eastern Daylight Time (EDT)
    isEDT(date) {
        const year = date.getFullYear();
        
        // EDT starts second Sunday in March
        const marchSecondSunday = new Date(year, 2, 8); // March 8th
        marchSecondSunday.setDate(marchSecondSunday.getDate() + (7 - marchSecondSunday.getDay()));
        
        // EDT ends first Sunday in November
        const novemberFirstSunday = new Date(year, 10, 1); // November 1st
        novemberFirstSunday.setDate(novemberFirstSunday.getDate() + (7 - novemberFirstSunday.getDay()));
        
        return date >= marchSecondSunday && date < novemberFirstSunday;
    }

    // Schedule daily reset at 3 AM EST
    scheduleDailyReset() {
        const scheduleNext = () => {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            // Set to 3 AM EST
            const estOffset = this.isEDT(tomorrow) ? -4 : -5;
            const resetTime = new Date(tomorrow.toISOString().split('T')[0] + 'T03:00:00.000Z');
            resetTime.setHours(resetTime.getHours() - estOffset); // Convert to UTC
            
            const timeUntilReset = resetTime.getTime() - now.getTime();
            
            console.log(`[DAILY CAP] Next reset scheduled for: ${resetTime.toISOString()} (in ${Math.round(timeUntilReset / 1000 / 60)} minutes)`);
            
            setTimeout(async () => {
                await this.performDailyReset();
                scheduleNext(); // Schedule the next reset
            }, timeUntilReset);
        };
        
        scheduleNext();
    }

    // Perform daily reset (now includes buff reset)
    async performDailyReset() {
        try {
            console.log('[DAILY CAP] ⏰ Performing daily reset at 3 AM EST...');
            
            const currentDay = this.getCurrentDay();
            
            // Clear memory cache for previous day voice XP
            const keysToDelete = [];
            for (const [key] of this.dailyVoiceXP.entries()) {
                if (!key.includes(currentDay)) {
                    keysToDelete.push(key);
                }
            }
            
            keysToDelete.forEach(key => this.dailyVoiceXP.delete(key));
            
            console.log(`[DAILY CAP] ✅ Voice XP reset complete - cleared ${keysToDelete.length} cached entries`);

            // Reset daily buffs - remove all buff roles from all users
            await this.resetDailyBuffs();
            
            console.log(`[DAILY CAP] 🆕 New day started: ${currentDay}`);
            
            // Optional: Send reset notification to log channels
            await this.notifyDailyReset(currentDay);
            
        } catch (error) {
            console.error('[DAILY CAP] ❌ Error during daily reset:', error);
        }
    }

    // Reset daily buffs for all users
    async resetDailyBuffs() {
        try {
            console.log('[DAILY BUFF] 🔄 Resetting daily buffs for all users...');
            
            // Get all buff role IDs
            const buffRoles = [];
            for (let i = 1; i <= 6; i++) {
                const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`];
                if (roleId) {
                    buffRoles.push(roleId);
                }
            }

            if (buffRoles.length === 0) {
                console.log('[DAILY BUFF] No buff roles configured in environment variables');
                return;
            }

            let totalUsersReset = 0;

            // Remove buff roles from all users across all guilds
            for (const [guildId, guild] of this.client.guilds.cache) {
                try {
                    let guildUsersReset = 0;
                    
                    for (const roleId of buffRoles) {
                        const role = guild.roles.cache.get(roleId);
                        if (role && role.members.size > 0) {
                            console.log(`[DAILY BUFF] Removing ${role.name} from ${role.members.size} users in ${guild.name}`);
                            
                            // Remove role from all members who have it
                            for (const [memberId, member] of role.members) {
                                try {
                                    await member.roles.remove(role);
                                    guildUsersReset++;
                                } catch (error) {
                                    console.error(`[DAILY BUFF] Failed to remove role from ${member.user.username}:`, error.message);
                                }
                                
                                // Add small delay to avoid rate limits
                                await new Promise(resolve => setTimeout(resolve, 100));
                            }
                        }
                    }
                    
                    totalUsersReset += guildUsersReset;
                    console.log(`[DAILY BUFF] Reset ${guildUsersReset} users in ${guild.name}`);
                    
                } catch (error) {
                    console.error(`[DAILY BUFF] Error resetting buffs in guild ${guild.name}:`, error);
                }
            }

            console.log(`[DAILY BUFF] ✅ Daily buff reset complete - removed roles from ${totalUsersReset} total users`);

        } catch (error) {
            console.error('[DAILY BUFF] ❌ Error during daily buff reset:', error);
        }
    }

    // Notify about daily reset in log channels (updated with buff info)
    async notifyDailyReset(newDay) {
        try {
            const { EmbedBuilder } = require('discord.js');
            
            for (const [guildId, guildSettings] of (global.guildSettings || new Map()).entries()) {
                if (guildSettings.xpLogEnabled && guildSettings.xpLogChannel) {
                    try {
                        const channel = await this.client.channels.fetch(guildSettings.xpLogChannel);
                        if (channel && channel.isTextBased()) {
                            const embed = new EmbedBuilder()
                                .setColor(0x00FF00)
                                .setTitle('🌅 DAILY RESET COMPLETE')
                                .setDescription(`\`\`\`diff\n+ Daily systems have been reset\n+ New tracking day: ${newDay}\n+ Reset time: 3:00 AM EST\n\`\`\``)
                                .addFields(
                                    {
                                        name: '🎤 Voice XP Reset',
                                        value: `\`\`\`yaml\nDaily cap: ${parseInt(process.env.DAILY_VOICE_XP_CAP) || 20000} XP\nStatus: All daily limits reset\n\`\`\``,
                                        inline: true
                                    },
                                    {
                                        name: '🎰 Daily Buffs Reset',
                                        value: `\`\`\`yaml\nAll buff roles removed\nNew rolls available\nCommand: /daily-buff\n\`\`\``,
                                        inline: true
                                    }
                                )
                                .setFooter({ text: '⚓ Marine Intelligence • Daily Reset System' })
                                .setTimestamp();
                            
                            await channel.send({ embeds: [embed] });
                        }
                    } catch (error) {
                        // Silently fail for individual guilds
                        console.log(`[DAILY CAP] Could not notify guild ${guildId}:`, error.message);
                    }
                }
            }
        } catch (error) {
            console.error('[DAILY CAP] Error sending reset notifications:', error);
        }
    }

    // Save daily voice XP to database
    async saveDailyVoiceXP(userId, guildId, date, totalXP) {
        try {
            await this.db.query(`
                INSERT INTO daily_voice_xp (user_id, guild_id, date, total_xp, updated_at)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, guild_id, date)
                DO UPDATE SET
                    total_xp = $4,
                    updated_at = CURRENT_TIMESTAMP
            `, [userId, guildId, date, totalXP]);

        } catch (error) {
            console.error('[DAILY CAP] Error saving daily voice XP:', error);
        }
    }

    // Get daily voice XP with proper key format (using EST reset)
    getDailyVoiceXP(userId, guildId, date = null) {
        if (!date) {
            date = this.getCurrentDay(); // Use EST-based day
        }
        const dailyKey = `${userId}_${guildId}_${date}`;
        return this.dailyVoiceXP.get(dailyKey) || 0;
    }

    // Set daily voice XP with proper key format and database persistence (using EST reset)
    async setDailyVoiceXP(userId, guildId, xp, date = null) {
        if (!date) {
            date = this.getCurrentDay(); // Use EST-based day
        }
        const dailyKey = `${userId}_${guildId}_${date}`;
        this.dailyVoiceXP.set(dailyKey, xp);
        
        // Save to database asynchronously
        this.saveDailyVoiceXP(userId, guildId, date, xp).catch(error => {
            console.error('[DAILY CAP] Failed to save to database:', error);
        });
    }

    async loadGuildSettingsFromDatabase() {
        try {
            console.log('[SETTINGS] Loading guild settings from database...');
            
            if (!global.guildSettings) {
                global.guildSettings = new Map();
            }

            // First, check what columns exist in the guild_settings table
            const tableInfo = await this.db.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'guild_settings'
                ORDER BY ordinal_position
            `);

            console.log('[SETTINGS] Current guild_settings table columns:', tableInfo.rows.map(r => r.column_name).join(', '));

            const existingColumns = tableInfo.rows.map(r => r.column_name);
            
            // Add missing columns if they don't exist
            if (!existingColumns.includes('levelup_channel')) {
                console.log('[SETTINGS] Adding levelup_channel column...');
                await this.db.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS levelup_channel VARCHAR(20)');
            }
            
            if (!existingColumns.includes('levelup_enabled')) {
                console.log('[SETTINGS] Adding levelup_enabled column...');
                await this.db.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS levelup_enabled BOOLEAN DEFAULT true');
            }
            
            if (!existingColumns.includes('xp_log_channel')) {
                console.log('[SETTINGS] Adding xp_log_channel column...');
                await this.db.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_log_channel VARCHAR(20)');
            }
            
            if (!existingColumns.includes('xp_log_enabled')) {
                console.log('[SETTINGS] Adding xp_log_enabled column...');
                await this.db.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_log_enabled BOOLEAN DEFAULT false');
            }
            
            if (!existingColumns.includes('xp_multiplier')) {
                console.log('[SETTINGS] Adding xp_multiplier column...');
                await this.db.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_multiplier DECIMAL(3,2) DEFAULT 1.0');
            }

            // Now try to load the settings
            const result = await this.db.query(`
                SELECT guild_id, levelup_channel, levelup_enabled, xp_log_channel, xp_log_enabled, xp_multiplier
                FROM guild_settings
            `);

            console.log(`[SETTINGS] Found ${result.rows.length} guild configurations in database`);

            let loadedCount = 0;
            for (const row of result.rows) {
                const guildSettings = {
                    levelupChannel: row.levelup_channel,
                    levelupEnabled: row.levelup_enabled,
                    xpLogChannel: row.xp_log_channel,
                    xpLogEnabled: row.xp_log_enabled,
                    xpMultiplier: parseFloat(row.xp_multiplier) || 1.0
                };

                global.guildSettings.set(row.guild_id, guildSettings);
                loadedCount++;
            }

            console.log(`[SETTINGS] Successfully loaded ${loadedCount} guild configurations from database`);

        } catch (error) {
            console.error('[SETTINGS] Error loading guild settings from database:', error);
            
            if (!global.guildSettings) {
                global.guildSettings = new Map();
            }
        }
    }

    async initializeExistingVoiceSessions() {
        try {
            console.log('[VOICE XP] Scanning for existing voice channel members...');
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            let totalFound = 0;
            
            for (const [guildId, guild] of this.client.guilds.cache) {
                try {
                    const voiceChannels = guild.channels.cache.filter(channel => 
                        channel.type === 2 && 
                        channel.members && 
                        channel.members.size > 0
                    );
                    
                    for (const [channelId, channel] of voiceChannels) {
                        for (const [memberId, member] of channel.members) {
                            if (!member.user.bot) {
                                this.voiceSessions.set(memberId, {
                                    guildId: guildId,
                                    channelId: channelId,
                                    joinTime: Date.now(),
                                    lastXPTime: Date.now(),
                                    isMuted: member.voice.mute || member.voice.selfMute,
                                    isDeafened: member.voice.deaf || member.voice.selfDeaf
                                });
                                totalFound++;
                                console.log(`[VOICE XP] Added existing member: ${member.user.username} in ${channel.name}`);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`[VOICE XP] Error scanning guild ${guild.name}:`, error);
                }
            }
            
            console.log(`[VOICE XP] Initialized ${totalFound} existing voice sessions`);
            
        } catch (error) {
            console.error('[VOICE XP] Error initializing existing voice sessions:', error);
        }
    }

    async handleVoiceStateUpdate(oldState, newState) {
        const userId = newState.id || oldState.id;
        const guildId = newState.guild?.id || oldState.guild?.id;
        
        if (!guildId) return;

        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) return;

        const member = guild.members.cache.get(userId);
        if (!member || member.user.bot) return;

        // User joined a voice channel
        if (!oldState.channelId && newState.channelId) {
            console.log(`[VOICE] ${member.user.username} joined ${newState.channel.name}`);
            this.voiceSessions.set(userId, {
                guildId,
                channelId: newState.channelId,
                joinTime: Date.now(),
                lastXPTime: Date.now(),
                isMuted: newState.mute || newState.selfMute,
                isDeafened: newState.deaf || newState.selfDeaf
            });
        }
        // User left voice channel
        else if (oldState.channelId && !newState.channelId) {
            console.log(`[VOICE] ${member.user.username} left voice channel`);
            this.voiceSessions.delete(userId);
        }
        // User moved to different channel
        else if (oldState.channelId !== newState.channelId) {
            console.log(`[VOICE] ${member.user.username} moved to ${newState.channel.name}`);
            if (this.voiceSessions.has(userId)) {
                const session = this.voiceSessions.get(userId);
                session.channelId = newState.channelId;
                session.joinTime = Date.now();
                session.isMuted = newState.mute || newState.selfMute;
                session.isDeafened = newState.deaf || newState.selfDeaf;
            }
        }
        // Mute/deafen state changed
        else if (oldState.channelId && newState.channelId) {
            const oldMuted = oldState.mute || oldState.selfMute;
            const newMuted = newState.mute || newState.selfMute;
            const oldDeafened = oldState.deaf || oldState.selfDeaf;
            const newDeafened = newState.deaf || newState.selfDeaf;
            
            if (oldMuted !== newMuted || oldDeafened !== newDeafened) {
                console.log(`[VOICE] ${member.user.username} mute/deafen state changed`);
                if (this.voiceSessions.has(userId)) {
                    const session = this.voiceSessions.get(userId);
                    session.isMuted = newMuted;
                    session.isDeafened = newDeafened;
                }
            }
        }
    }

    // Process voice XP with proper daily cap implementation (3 AM EST reset)
    async processVoiceXP() {
        const now = Date.now();
        const voiceXPCooldown = parseInt(process.env.VOICE_COOLDOWN) || 60000; // Default 1 minute
        const minMembers = parseInt(process.env.VOICE_MIN_MEMBERS) || 2;
        const dailyCap = parseInt(process.env.DAILY_VOICE_XP_CAP) || 20000; // Use your 20,000 XP cap
        const antiAFK = process.env.VOICE_ANTI_AFK === 'true';
        const currentDay = this.getCurrentDay(); // EST-based day

        console.log(`[VOICE XP] Processing voice XP for ${this.voiceSessions.size} active sessions (Daily cap: ${dailyCap} XP, Day: ${currentDay})`);

        for (const [userId, session] of this.voiceSessions.entries()) {
            try {
                // Check cooldown
                if (now - session.lastXPTime < voiceXPCooldown) {
                    continue;
                }

                const guild = this.client.guilds.cache.get(session.guildId);
                if (!guild) {
                    this.voiceSessions.delete(userId);
                    continue;
                }

                const channel = guild.channels.cache.get(session.channelId);
                if (!channel) {
                    this.voiceSessions.delete(userId);
                    continue;
                }

                // Check minimum member requirement
                const memberCount = channel.members.filter(m => !m.user.bot).size;
                if (memberCount < minMembers) {
                    console.log(`[VOICE XP] ${userId} in ${channel.name}: Not enough members (${memberCount}/${minMembers}), skipping`);
                    continue;
                }

                const user = await this.client.users.fetch(userId).catch(() => null);
                if (!user) continue;

                const member = await guild.members.fetch(userId).catch(() => null);
                if (!member) continue;

                // Check daily cap (EST-based)
                const currentDailyXP = this.getDailyVoiceXP(userId, session.guildId, currentDay);
                
                if (currentDailyXP >= dailyCap) {
                    console.log(`[VOICE XP] ${user.username} has reached daily cap: ${currentDailyXP}/${dailyCap} XP (Day: ${currentDay})`);
                    continue;
                }

                // Calculate base XP
                const voiceXPMin = parseInt(process.env.VOICE_XP_MIN) || 45;
                const voiceXPMax = parseInt(process.env.VOICE_XP_MAX) || 55;
                const baseXP = Math.floor(Math.random() * (voiceXPMax - voiceXPMin + 1)) + voiceXPMin;

                let finalXP = baseXP;

                // Apply mute/deafen penalty with exemptions
                if (antiAFK && (session.isMuted || session.isDeafened)) {
                    // Check for exemptions
                    const exemptUsers = process.env.VOICE_MUTE_EXEMPT_USERS?.split(',') || [];
                    const exemptUser = process.env.VOICE_MUTE_EXEMPT_USER;
                    const exemptRoles = process.env.VOICE_MUTE_EXEMPT_ROLES?.split(',') || [];
                    const exemptMultiplier = parseFloat(process.env.VOICE_MUTE_EXEMPT_MULTIPLIER) || 1.0;
                    
                    let isExempt = false;
                    let exemptReason = '';
                    
                    // Check user exemptions
                    if (exemptUsers.includes(userId) || userId === exemptUser) {
                        isExempt = true;
                        finalXP = Math.round(baseXP * exemptMultiplier);
                        exemptReason = 'EXEMPT USER';
                    }
                    
                    // Check role exemptions
                    if (!isExempt && exemptRoles.length > 0) {
                        for (const roleId of exemptRoles) {
                            if (roleId && member.roles.cache.has(roleId.trim())) {
                                isExempt = true;
                                finalXP = Math.round(baseXP * exemptMultiplier);
                                exemptReason = 'EXEMPT ROLE';
                                break;
                            }
                        }
                    }
                    
                    // Apply penalty if not exempt
                    if (!isExempt) {
                        finalXP = Math.round(baseXP * 0.25); // 25% XP when muted/deafened
                        exemptReason = session.isMuted && session.isDeafened ? 'MUTED+DEAFENED' : 
                                     session.isMuted ? 'MUTED' : 'DEAFENED';
                    }
                    
                    console.log(`[VOICE XP] ${user.username} mute status: ${exemptReason}, XP: ${baseXP} → ${finalXP}`);
                }

                // Apply daily cap properly
                const newDailyTotal = currentDailyXP + finalXP;
                let actualXPGain = finalXP;
                let hitCap = false;
                
                if (newDailyTotal > dailyCap) {
                    actualXPGain = Math.max(0, dailyCap - currentDailyXP);
                    hitCap = true;
                    console.log(`[DAILY CAP] ${user.username}: ${finalXP} → ${actualXPGain} XP (would exceed daily cap: ${newDailyTotal}/${dailyCap})`);
                }
                
                if (actualXPGain <= 0) {
                    continue;
                }

                // Update daily XP tracking (EST-based)
                const updatedDailyXP = currentDailyXP + actualXPGain;
                await this.setDailyVoiceXP(userId, session.guildId, updatedDailyXP, currentDay);

                // Award the XP (skip multiplier since this is raw voice XP)
                await this.awardXP(userId, session.guildId, actualXPGain, 'voice', user, true);
                
                // Update session timestamp
                session.lastXPTime = now;

                console.log(`[VOICE XP] ${user.username}: +${actualXPGain} XP (Daily: ${updatedDailyXP}/${dailyCap}) ${hitCap ? '[CAP HIT]' : ''} [${currentDay}]`);

            } catch (error) {
                console.error(`[VOICE XP] Error processing user ${userId}:`, error);
            }
        }
    }

    // Clean up daily voice XP (now handled by automatic reset at 3 AM EST)
    async cleanupDailyVoiceXP() {
        try {
            console.log('[DAILY CAP] Manual cleanup requested...');
            
            const currentDay = this.getCurrentDay();

            // Clean up memory cache for old days
            let memoryDeleted = 0;
            for (const [key] of this.dailyVoiceXP.entries()) {
                if (!key.includes(currentDay)) {
                    this.dailyVoiceXP.delete(key);
                    memoryDeleted++;
                }
            }

            console.log(`[DAILY CAP] Cleaned up ${memoryDeleted} old entries from memory`);

            // Clean up database (keep last 30 days for analysis)
            const dbResult = await this.db.query(
                "DELETE FROM daily_voice_xp WHERE date < CURRENT_DATE - INTERVAL '30 days'"
            );

            console.log(`[DAILY CAP] Cleaned up ${dbResult.rowCount || 0} old entries from database`);
            console.log(`[DAILY CAP] Current day: ${currentDay} | Current memory entries: ${this.dailyVoiceXP.size}`);

        } catch (error) {
            console.error('[DAILY CAP] Error during cleanup:', error);
        }
    }

    // Get daily voice XP statistics for a user (EST-based)
    async getDailyVoiceXPStats(userId, guildId, days = 7) {
        try {
            const result = await this.db.query(`
                SELECT date, total_xp 
                FROM daily_voice_xp 
                WHERE user_id = $1 AND guild_id = $2 AND date >= CURRENT_DATE - INTERVAL '${days} days'
                ORDER BY date DESC
            `, [userId, guildId]);

            return result.rows.map(row => ({
                date: row.date,
                xp: row.total_xp,
                isToday: row.date === this.getCurrentDay()
            }));
        } catch (error) {
            console.error('[DAILY CAP] Error getting daily voice XP stats:', error);
            return [];
        }
    }

    // Get guild-wide daily voice XP statistics (EST-based)
    async getGuildDailyVoiceXPStats(guildId, date = null) {
        try {
            if (!date) {
                date = this.getCurrentDay();
            }

            const result = await this.db.query(`
                SELECT user_id, total_xp 
                FROM daily_voice_xp 
                WHERE guild_id = $1 AND date = $2
                ORDER BY total_xp DESC
            `, [guildId, date]);

            const dailyCap = parseInt(process.env.DAILY_VOICE_XP_CAP) || 20000;
            const cappedUsers = result.rows.filter(row => row.total_xp >= dailyCap);
            const totalUsers = result.rows.length;
            const totalXP = result.rows.reduce((sum, row) => sum + row.total_xp, 0);

            return {
                date,
                isToday: date === this.getCurrentDay(),
                totalUsers,
                cappedUsers: cappedUsers.length,
                cappedPercentage: totalUsers > 0 ? (cappedUsers.length / totalUsers) * 100 : 0,
                totalXP,
                averageXP: totalUsers > 0 ? totalXP / totalUsers : 0,
                topUsers: result.rows.slice(0, 10), // Top 10 users by daily voice XP
                dailyCap
            };
        } catch (error) {
            console.error('[DAILY CAP] Error getting guild daily voice XP stats:', error);
            return null;
        }
    }

    async awardXP(userId, guildId, xpAmount, source, user, skipMultiplier = false) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
            
            let finalXP = xpAmount;
            
            // Generate random XP if amount is null
            if (xpAmount === null) {
                finalXP = this.getRandomXP(source);
                console.log(`[XP CALC] Generated base XP for ${source}: ${finalXP}`);
            }
            
            // Apply multipliers if not skipping
            if (!skipMultiplier) {
                // Apply XP role boosts (includes daily buff roles from xp_boosts table)
                if (global.xpBoostManager && member) {
                    try {
                        const boostResult = await global.xpBoostManager.calculateUserBoost(guildId, member);
                        if (boostResult.multiplier > 1.0) {
                            const boostedXP = Math.round(finalXP * boostResult.multiplier);
                            console.log(`[XP BOOST] ${user.username} ${source}: ${finalXP} → ${boostedXP} (${boostResult.multiplier}x boost - includes daily buffs)`);
                            finalXP = boostedXP;
                        }
                    } catch (error) {
                        console.error('[XP BOOST ERROR] Failed to calculate user boost:', error);
                    }
                }
                
                // Apply global multiplier last
                const guildSettings = global.guildSettings?.get(guildId) || { xpMultiplier: 1.0 };
                const multiplier = guildSettings.xpMultiplier || parseFloat(process.env.XP_MULTIPLIER) || 1.0;
                
                if (multiplier !== 1.0) {
                    const afterGlobal = Math.round(finalXP * multiplier);
                    console.log(`[XP CALC] ${user.username} ${source}: ${finalXP} → ${afterGlobal} (${multiplier}x global)`);
                    finalXP = afterGlobal;
                }
            }
            
            const actualXP = Math.max(1, finalXP);

            // Get user's current stats
            const beforeResult = await this.db.query(
                'SELECT total_xp, level FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                [userId, guildId]
            );

            const oldLevel = beforeResult.rows.length > 0 ? beforeResult.rows[0].level : 0;
            const oldTotalXP = beforeResult.rows.length > 0 ? beforeResult.rows[0].total_xp : 0;

            // Update user XP
            await this.db.query(`
                INSERT INTO user_levels (user_id, guild_id, total_xp, messages, reactions, voice_time, level)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (user_id, guild_id)
                DO UPDATE SET
                    total_xp = user_levels.total_xp + $3,
                    messages = user_levels.messages + $4,
                    reactions = user_levels.reactions + $5,
                    voice_time = user_levels.voice_time + $6,
                    updated_at = CURRENT_TIMESTAMP
            `, [
                userId, guildId, actualXP,
                source === 'message' ? 1 : 0,
                source === 'reaction' ? 1 : 0,
                source === 'voice' ? 1 : 0,
                oldLevel
            ]);

            // Get updated total XP and calculate new level
            const afterResult = await this.db.query(
                'SELECT total_xp FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                [userId, guildId]
            );

            const newTotalXP = afterResult.rows[0].total_xp;
            const newLevel = this.calculateLevel(newTotalXP);

            // Update level in database
            await this.db.query(
                'UPDATE user_levels SET level = $1 WHERE user_id = $2 AND guild_id = $3',
                [newLevel, userId, guildId]
            );

            // Log XP activity (skip for voice to avoid spam)
            if (source !== 'voice') {
                await this.logXPActivity(source, user, guildId, actualXP, {
                    totalXP: newTotalXP,
                    currentLevel: newLevel
                });
            }

            console.log(`[XP] ${user.username}: ${oldTotalXP} + ${actualXP} = ${newTotalXP} XP (Level ${oldLevel} → ${newLevel})`);

            // Handle level up
            if (newLevel > oldLevel) {
                console.log(`[LEVEL UP] ${user.username} leveled up: ${oldLevel} → ${newLevel}!`);
                await this.handleLevelUp(userId, guildId, oldLevel, newLevel, newTotalXP, user, source);
            }

        } catch (error) {
            console.error('Error awarding XP:', error);
        }
    }

    async handleLevelUp(userId, guildId, oldLevel, newLevel, totalXP, user, xpSource = 'unknown') {
        try {
            console.log(`[LEVEL UP] Processing level up for ${user.username}: ${oldLevel} → ${newLevel}`);

            // Award level roles
            const roleReward = await this.awardLevelRoles(userId, guildId, newLevel);

            // Send level up notification with wanted poster
            await this.sendLevelUpNotification(userId, guildId, oldLevel, newLevel, totalXP, user, roleReward);

            // Log level up
            await this.logXPActivity('levelup', user, guildId, 0, {
                oldLevel,
                newLevel,
                totalXP,
                roleReward,
                xpSource: xpSource.toUpperCase()
            });

        } catch (error) {
            console.error('Error handling level up:', error);
        }
    }

    async sendLevelUpNotification(userId, guildId, oldLevel, newLevel, totalXP, user, roleReward = null) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;

            const guildSettings = global.guildSettings?.get(guildId);
            
            const levelupEnabled = guildSettings?.levelupEnabled !== false;
            if (!levelupEnabled) {
                console.log('[LEVEL UP] Level up announcements disabled for this guild');
                return;
            }

            let channelId = guildSettings?.levelupChannel;
            
            if (!channelId) {
                // Find a suitable channel
                const defaultChannel = guild.channels.cache.find(ch => 
                    (ch.name.toLowerCase().includes('general') || 
                     ch.name.toLowerCase().includes('chat') ||
                     ch.name.toLowerCase().includes('level') ||
                     ch.name.toLowerCase().includes('bounty')) && ch.isTextBased()
                );
                
                if (defaultChannel) {
                    channelId = defaultChannel.id;
                }
            }

            if (!channelId) {
                console.log('[LEVEL UP] No suitable channel found for announcements');
                return;
            }

            const channel = guild.channels.cache.get(channelId);
            if (!channel || !channel.isTextBased()) {
                console.log(`[LEVEL UP] Channel ${channelId} not found or not text-based`);
                return;
            }

            // Get member for wanted poster
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) {
                console.log('[LEVEL UP] Could not fetch member for wanted poster');
                return;
            }

            // Create wanted poster data
            const wantedPosterData = {
                userId: user.id,
                level: newLevel,
                total_xp: totalXP,
                messages: 0,
                reactions: 0,
                voice_time: 0,
                member: member,
                isPirateKing: false
            };

            let canvas = null;
            let attachment = null;
            
            try {
                // Generate wanted poster using canvas
                console.log(`[LEVEL UP] Creating wanted poster for ${user.username}...`);
                canvas = await this.createWantedPoster(wantedPosterData, guild);
                attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `wanted_${user.id}.png` });
                console.log('[LEVEL UP] ✅ Successfully created wanted poster');
            } catch (canvasError) {
                console.error('[LEVEL UP] ❌ Error creating wanted poster:', canvasError);
                // Continue without poster if canvas fails
            }

            // Create Marine Intelligence embed
            const embed = this.createLevelUpEmbed(user, oldLevel, newLevel, totalXP, roleReward);
            
            // Add wanted poster image if available
            if (attachment) {
                embed.setImage(`attachment://wanted_${user.id}.png`);
            }

            const messageOptions = { embeds: [embed] };
            
            // Ping user if enabled
            const pingUser = process.env.LEVELUP_PING_USER !== 'false';
            if (pingUser) {
                messageOptions.content = `<@${userId}>`;
            }
            
            // Add wanted poster attachment
            if (attachment) {
                messageOptions.files = [attachment];
            }
            
            await channel.send(messageOptions);
            console.log(`[LEVEL UP] ✅ Level up notification with wanted poster sent for ${user.username} in #${channel.name}`);

        } catch (error) {
            console.error('❌ Error sending level up notification:', error);
        }
    }

    createLevelUpEmbed(user, oldLevel, newLevel, totalXP, roleReward = null) {
        try {
            const { getBountyForLevel } = require('./bountySystem');
            
            const oldBounty = getBountyForLevel(oldLevel);
            const newBounty = getBountyForLevel(newLevel);

            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: '🌐 WORLD GOVERNMENT INTELLIGENCE BUREAU'
                })
                .setColor(0xFF0000)
                .setTitle('🚨 WORLD GOVERNMENT BOUNTY UPDATE 🚨')
                .setDescription(`**${user.username}** has reached a new level of infamy!`)
                .addFields({
                    name: '📊 INTELLIGENCE SUMMARY',
                    value: `\`\`\`diff\n- Subject: ${user.username}\n- Previous Bounty: ฿${oldBounty.toLocaleString()}\n- New Bounty: ฿${newBounty.toLocaleString()}\n- Level: ${oldLevel} → ${newLevel}\n- Total XP: ${totalXP.toLocaleString()}\n${roleReward ? `- Role Awarded: ${roleReward}\n` : ''}\`\`\``,
                    inline: false
                })
                .setFooter({ text: '⚓ Marine Intelligence Division • Bounty System' })
                .setTimestamp();

            return embed;
        } catch (error) {
            console.error('Error creating level up embed:', error);
            
            return new EmbedBuilder()
                .setColor('#DC143C')
                .setTitle('🚨 LEVEL UP! 🚨')
                .setDescription(`**${user.username}** leveled up from ${oldLevel} to ${newLevel}!`)
                .setThumbnail(user.displayAvatarURL({ size: 128 }))
                .setTimestamp();
        }
    }

    async awardLevelRoles(userId, guildId, level) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return null;

            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return null;

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

            let roleReward = null;

            for (const { level: reqLevel, roleId } of levelRoles) {
                if (level >= reqLevel && roleId && roleId !== `role_id_${reqLevel}`) {
                    const role = guild.roles.cache.get(roleId);
                    if (role && !member.roles.cache.has(roleId)) {
                        await member.roles.add(role);
                        roleReward = role.name;
                        console.log(`[LEVEL UP] Added level ${reqLevel} role (${role.name}) to ${member.user.username}`);
                        break;
                    }
                }
            }

            return roleReward;

        } catch (error) {
            console.error('Error awarding level roles:', error);
            return null;
        }
    }

    async logXPActivity(type, user, guildId, xpGain, additionalInfo = {}) {
        try {
            const guildSettings = global.guildSettings?.get(guildId);
            
            const logEnabled = guildSettings?.xpLogEnabled === true;
            if (!logEnabled) return;

            let logChannelId = guildSettings?.xpLogChannel;
            
            if (!logChannelId) return;

            const channel = await this.client.channels.fetch(logChannelId).catch(() => null);
            if (!channel || !channel.isTextBased()) return;

            const formatLevel = (level) => {
                return level !== undefined && level !== null ? level.toString() : '0';
            };

            const formatXP = (xp) => {
                return xp !== undefined && xp !== null ? xp.toLocaleString() : '0';
            };

            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTimestamp()
                .setFooter({ text: '⚓ Marine Intelligence Division • Activity Monitor' });

            switch (type) {
                case 'message':
                    embed
                        .setAuthor({ 
                            name: '🔴 MARINE INTELLIGENCE BUREAU',
                            iconURL: user.displayAvatarURL({ size: 32 })
                        })
                        .setTitle('🔴 MESSAGE ACTIVITY DETECTED')
                        .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${formatXP(additionalInfo.totalXP)}\n- CURRENT LEVEL: ${formatLevel(additionalInfo.currentLevel)}\n\`\`\``);
                    break;

                case 'reaction':
                    embed
                        .setAuthor({ 
                            name: '🔴 MARINE INTELLIGENCE BUREAU',
                            iconURL: user.displayAvatarURL({ size: 32 })
                        })
                        .setTitle('🔴 REACTION ACTIVITY DETECTED')
                        .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${formatXP(additionalInfo.totalXP)}\n- CURRENT LEVEL: ${formatLevel(additionalInfo.currentLevel)}\n\`\`\``);
                    break;

                case 'voice':
                    embed
                        .setAuthor({ 
                            name: '🔴 MARINE INTELLIGENCE BUREAU',
                            iconURL: user.displayAvatarURL({ size: 32 })
                        })
                        .setTitle('🔴 VOICE ACTIVITY DETECTED')
                        .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${formatXP(additionalInfo.totalXP)}\n- CURRENT LEVEL: ${formatLevel(additionalInfo.currentLevel)}\n\`\`\``);
                    break;

                case 'levelup':
                    embed
                        .setAuthor({ 
                            name: '🔴 MARINE INTELLIGENCE BUREAU',
                            iconURL: user.displayAvatarURL({ size: 32 })
                        })
                        .setTitle('🔴 ⚠️ THREAT LEVEL INCREASED ⚠️')
                        .setDescription(`\`\`\`diff\n- BOUNTY UPDATE CONFIRMED\n- SUBJECT: ${user.username} (${user.id})\n- LEVEL: ${formatLevel(additionalInfo.oldLevel)} → ${formatLevel(additionalInfo.newLevel)}\n- TOTAL XP: ${formatXP(additionalInfo.totalXP)}\n- XP SOURCE: ${additionalInfo.xpSource || 'UNKNOWN'}\n${additionalInfo.roleReward ? `- ROLE AWARDED: ${additionalInfo.roleReward}\n` : ''}\`\`\``);
                    break;

                case 'admin':
                    embed
                        .setAuthor({ 
                            name: '🔴 MARINE COMMAND CENTER',
                            iconURL: additionalInfo.adminUser?.displayAvatarURL({ size: 32 }) || null
                        })
                        .setTitle('🔴 MANUAL XP ADJUSTMENT')
                        .setDescription(`\`\`\`diff\n- ADMINISTRATIVE ACTION\n- TARGET: ${user.username} (${user.id})\n- AUTHORIZED BY: ${additionalInfo.adminUser?.username || 'Unknown'}\n- ADJUSTMENT: ${xpGain > 0 ? '+' : ''}${xpGain} XP\n- REASON: ${additionalInfo.reason || 'No reason'}\n- NEW TOTAL: ${formatXP(additionalInfo.totalXP)}\n- NEW LEVEL: ${formatLevel(additionalInfo.currentLevel)}\n\`\`\``);
                    break;
            }

            await channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('[XP LOG] Failed to send XP log:', error);
        }
    }

    // Utility methods
    async getLeaderboard(guildId, page = 1, limit = 10) {
        try {
            const offset = (page - 1) * limit;
            
            const result = await this.db.query(`
                SELECT user_id, total_xp, level, messages, reactions, voice_time
                FROM user_levels 
                WHERE guild_id = $1 
                ORDER BY total_xp DESC 
                LIMIT $2 OFFSET $3
            `, [guildId, limit, offset]);

            const countResult = await this.db.query(
                'SELECT COUNT(*) FROM user_levels WHERE guild_id = $1',
                [guildId]
            );

            const totalUsers = parseInt(countResult.rows[0].count);
            const totalPages = Math.ceil(totalUsers / limit);

            return {
                users: result.rows.map((row, index) => ({
                    userId: row.user_id,
                    totalXP: row.total_xp,
                    level: row.level,
                    messages: row.messages,
                    reactions: row.reactions,
                    voiceTime: row.voice_time,
                    rank: offset + index + 1
                })),
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalUsers,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1
                }
            };

        } catch (error) {
            console.error('Error getting leaderboard:', error);
            throw error;
        }
    }

    async getUserRank(userId, guildId) {
        try {
            const result = await this.db.query(`
                SELECT COUNT(*) + 1 as rank
                FROM user_levels 
                WHERE guild_id = $1 AND total_xp > (
                    SELECT total_xp FROM user_levels 
                    WHERE user_id = $2 AND guild_id = $1
                )
            `, [guildId, userId]);
            
            return parseInt(result.rows[0].rank);
        } catch (error) {
            console.error('Error getting user rank:', error);
            return null;
        }
    }

    async getUserStats(userId, guildId) {
        try {
            const result = await this.db.query(`
                SELECT user_id, guild_id, total_xp, level, messages, reactions, voice_time, 
                       created_at, updated_at
                FROM user_levels 
                WHERE user_id = $1 AND guild_id = $2
            `, [userId, guildId]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            return result.rows[0];
        } catch (error) {
            console.error('Error getting user stats:', error);
            throw error;
        }
    }

    getXPForLevel(level) {
        const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
        const curve = process.env.FORMULA_CURVE || 'exponential';
        const baseXP = parseInt(process.env.FORMULA_BASE_XP) || 500;
        
        let xpRequired;
        
        if (curve === 'exponential') {
            xpRequired = Math.floor(baseXP * Math.pow(level, multiplier));
        } else if (curve === 'linear') {
            xpRequired = baseXP * level * multiplier;
        } else if (curve === 'logarithmic') {
            xpRequired = Math.floor(baseXP * Math.log(level + 1) * multiplier * 2);
        } else {
            xpRequired = Math.floor(baseXP * Math.pow(level, multiplier));
        }
        
        return xpRequired;
    }

    getRandomXP(type) {
        let min, max;
        
        switch (type) {
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
                min = 25;
                max = 35;
        }
        
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    calculateLevel(totalXP) {
        const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
        const curve = process.env.FORMULA_CURVE || 'exponential';
        const maxLevel = parseInt(process.env.MAX_LEVEL) || 50;
        const baseXP = parseInt(process.env.FORMULA_BASE_XP) || 500;

        for (let level = 1; level <= maxLevel; level++) {
            let requiredXP;
            
            if (curve === 'exponential') {
                requiredXP = Math.floor(baseXP * Math.pow(level, multiplier));
            } else if (curve === 'linear') {
                requiredXP = baseXP * level * multiplier;
            } else if (curve === 'logarithmic') {
                requiredXP = Math.floor(baseXP * Math.log(level + 1) * multiplier * 2);
            } else {
                requiredXP = Math.floor(baseXP * Math.pow(level, multiplier));
            }

            if (totalXP < requiredXP) {
                return level - 1;
            }
        }

        return maxLevel;
    }

    isOnCooldown(key, cooldownMs) {
        const now = Date.now();
        const lastUse = this.cooldowns.get(key);
        return lastUse && (now - lastUse) < cooldownMs;
    }

    setCooldown(key) {
        this.cooldowns.set(key, Date.now());
    }

    async cleanup() {
        this.voiceSessions.clear();
        this.cooldowns.clear();
        this.dailyVoiceXP.clear();
    }
}

module.exports = XPTracker;

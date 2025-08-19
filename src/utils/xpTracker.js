// src/utils/xpTracker.js - Complete Enhanced XP Tracker with Daily Cap Logging

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { getBountyForLevel } = require('./bountySystem');
const DailyResetManager = require('./dailyResetManager');
const VoiceXPManager = require('./voiceXPManager');
const LevelUpManager = require('./levelUpManager');
const path = require('path');

// Register fonts for canvas
try {
    registerFont(path.join(__dirname, '../../assets/fonts/captkd.ttf'), { family: 'CaptainKiddNF' });
    registerFont(path.join(__dirname, '../../assets/fonts/Cinzel-Bold.otf'), { family: 'Cinzel' });
    registerFont(path.join(__dirname, '../../assets/fonts/Times New Normal Regular.ttf'), { family: 'TimesNewNormal' });
    console.log('[XP TRACKER] Successfully registered custom fonts for wanted posters');
} catch (error) {
    console.error('[XP TRACKER] Failed to register custom fonts:', error.message);
}

// CONFIGURABLE RESET TIME (EST)
const DAILY_RESET_HOUR_EST = parseInt(process.env.DAILY_RESET_HOUR_EST) || 3;
const DAILY_RESET_MINUTE_EST = parseInt(process.env.DAILY_RESET_MINUTE_EST) || 0;

class XPTracker {
    constructor(client, database) {
        this.client = client;
        this.db = database;
        this.voiceSessions = new Map();
        this.cooldowns = new Map();
        
        console.log(`[XP TRACKER] Daily reset configured for ${DAILY_RESET_HOUR_EST}:${DAILY_RESET_MINUTE_EST.toString().padStart(2, '0')} EST`);
        
        // Initialize managers
        this.dailyResetManager = new DailyResetManager(this);
        this.voiceXPManager = new VoiceXPManager(this);
        this.levelUpManager = new LevelUpManager(this);
        
        this.initialize();
    }

    async initialize() {
        await this.loadGuildSettingsFromDatabase();
        await this.initializeExistingVoiceSessions();
        await this.dailyResetManager.initialize();
    }

    // Load guild settings from database
    async loadGuildSettingsFromDatabase() {
        try {
            console.log('[SETTINGS] Loading guild settings from database...');
            
            if (!global.guildSettings) {
                global.guildSettings = new Map();
            }

            const tableInfo = await this.db.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'guild_settings'
            `);

            const existingColumns = tableInfo.rows.map(r => r.column_name);
            
            // Add missing columns if they don't exist
            if (!existingColumns.includes('levelup_channel')) {
                await this.db.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS levelup_channel VARCHAR(20)');
            }
            if (!existingColumns.includes('levelup_enabled')) {
                await this.db.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS levelup_enabled BOOLEAN DEFAULT true');
            }
            if (!existingColumns.includes('xp_log_channel')) {
                await this.db.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_log_channel VARCHAR(20)');
            }
            if (!existingColumns.includes('xp_log_enabled')) {
                await this.db.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_log_enabled BOOLEAN DEFAULT false');
            }
            if (!existingColumns.includes('xp_multiplier')) {
                await this.db.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_multiplier DECIMAL(3,2) DEFAULT 1.0');
            }

            const result = await this.db.query(`
                SELECT guild_id, levelup_channel, levelup_enabled, xp_log_channel, xp_log_enabled, xp_multiplier
                FROM guild_settings
            `);

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

            console.log(`[SETTINGS] Successfully loaded ${loadedCount} guild configurations`);

        } catch (error) {
            console.error('[SETTINGS] Error loading guild settings:', error);
            
            if (!global.guildSettings) {
                global.guildSettings = new Map();
            }
        }
    }

    // Initialize existing voice sessions
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

    // Voice state update handler
    async handleVoiceStateUpdate(oldState, newState) {
        return await this.voiceXPManager.handleVoiceStateUpdate(oldState, newState);
    }

    // Process voice XP
    async processVoiceXP() {
        return await this.voiceXPManager.processVoiceXP();
    }

    // ✅ FIXED: Award XP with VOICE XP LOGGING ENABLED
    async awardXP(userId, guildId, xpAmount, source, user, skipMultiplier = false) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
            
            let finalXP = xpAmount;
            
            // Generate random XP if amount is null
            if (xpAmount === null) {
                finalXP = this.getRandomXP(source);
            }
            
            // Apply multipliers if not skipping
            if (!skipMultiplier) {
                // Apply XP role boosts
                if (global.xpBoostManager && member) {
                    try {
                        const boostResult = await global.xpBoostManager.calculateUserBoost(guildId, member);
                        if (boostResult.multiplier > 1.0) {
                            finalXP = Math.round(finalXP * boostResult.multiplier);
                        }
                    } catch (error) {
                        console.error('[XP BOOST ERROR] Failed to calculate user boost:', error);
                    }
                }
                
                // Apply global multiplier
                const guildSettings = global.guildSettings?.get(guildId) || { xpMultiplier: 1.0 };
                const multiplier = guildSettings.xpMultiplier || parseFloat(process.env.XP_MULTIPLIER) || 1.0;
                
                if (multiplier !== 1.0) {
                    finalXP = Math.round(finalXP * multiplier);
                }
            }
            
            const actualXP = Math.max(1, finalXP);

            // Get user's current stats
            const beforeResult = await this.db.query(
                'SELECT total_xp, level FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                [userId, guildId]
            );

            const oldLevel = beforeResult.rows.length > 0 ? beforeResult.rows[0].level : 0;

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

            // ✅ ENHANCED: Log ALL XP activity including voice XP with daily cap info
            await this.logXPActivity(source, user, guildId, actualXP, {
                totalXP: newTotalXP,
                currentLevel: newLevel,
                channelName: source === 'voice' && guild ? 
                    guild.channels.cache.get(this.voiceSessions.get(userId)?.channelId)?.name : null
            });

            // ✅ FIXED: Handle level up with canvas wanted poster
            if (newLevel > oldLevel) {
                await this.handleLevelUpWithCanvas(userId, guildId, oldLevel, newLevel, newTotalXP, user, source);
            }

        } catch (error) {
            console.error('Error awarding XP:', error);
        }
    }

    // ✅ FIXED: Enhanced level up handler with canvas wanted poster
    async handleLevelUpWithCanvas(userId, guildId, oldLevel, newLevel, totalXP, user, xpSource = 'unknown') {
        try {
            console.log(`[LEVEL UP] Processing level up for ${user.username}: ${oldLevel} → ${newLevel}`);

            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;

            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return;

            // Award level roles
            const roleReward = await this.awardLevelRoles(userId, guildId, newLevel, member);

            // ✅ FIXED: Send level up notification with canvas wanted poster
            await this.sendLevelUpNotificationWithCanvas(userId, guildId, oldLevel, newLevel, totalXP, user, member, roleReward);

            // Log level up
            await this.logLevelUp(user, guildId, oldLevel, newLevel, totalXP, roleReward, xpSource);

        } catch (error) {
            console.error('Error handling level up:', error);
        }
    }

    // Award level roles
    async awardLevelRoles(userId, guildId, level, member) {
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

            let roleReward = null;

            for (const { level: reqLevel, roleId } of levelRoles) {
                if (level >= reqLevel && roleId && roleId !== `role_id_${reqLevel}`) {
                    const role = member.guild.roles.cache.get(roleId);
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

    // ✅ FIXED: Send level up notification with canvas wanted poster
    async sendLevelUpNotificationWithCanvas(userId, guildId, oldLevel, newLevel, totalXP, user, member, roleReward = null) {
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

            // ✅ FIXED: Create wanted poster canvas for level up
            const userData = {
                userId: user.id,
                level: newLevel,
                total_xp: totalXP,
                messages: 0,
                reactions: 0,
                voice_time: 0,
                member: member,
                isPirateKing: false
            };

            const canvas = await this.createWantedPoster(userData, guild);
            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `levelup_wanted_${user.id}.png` });

            // Create Marine Intelligence embed with canvas
            const embed = this.createLevelUpEmbedWithCanvas(user, oldLevel, newLevel, totalXP, roleReward);

            const messageOptions = { 
                embeds: [embed], 
                files: [attachment] 
            };
            
            // Ping user if enabled
            const pingUser = process.env.LEVELUP_PING_USER !== 'false';
            if (pingUser) {
                messageOptions.content = `<@${userId}>`;
            }
            
            await channel.send(messageOptions);
            console.log(`[LEVEL UP] ✅ Level up notification with canvas sent for ${user.username} in #${channel.name}`);

        } catch (error) {
            console.error('❌ Error sending level up notification with canvas:', error);
        }
    }

    // ✅ FIXED: Create level up embed with canvas reference
    createLevelUpEmbedWithCanvas(user, oldLevel, newLevel, totalXP, roleReward = null) {
        try {
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
                .setImage(`attachment://levelup_wanted_${user.id}.png`) // ✅ FIXED: Reference the canvas
                .setFooter({ text: '⚓ Marine Intelligence Division • Bounty System' })
                .setTimestamp();

            return embed;
        } catch (error) {
            console.error('Error creating level up embed with canvas:', error);
            
            return new EmbedBuilder()
                .setColor('#DC143C')
                .setTitle('🚨 LEVEL UP! 🚨')
                .setDescription(`**${user.username}** leveled up from ${oldLevel} to ${newLevel}!`)
                .setThumbnail(user.displayAvatarURL({ size: 128 }))
                .setTimestamp();
        }
    }

    // ✅ FIXED: Create wanted poster canvas (same as leaderboard/level commands)
    async createWantedPoster(userData, guild) {
        const width = 600, height = 900;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Load and draw scroll texture background
        try {
            const scrollTexture = await loadImage(path.join(__dirname, '../../assets/scroll_texture.jpg'));
            ctx.drawImage(scrollTexture, 0, 0, width, height);
            console.log('[LEVEL UP CANVAS] Successfully loaded scroll texture background');
        } catch (error) {
            console.log('[LEVEL UP CANVAS] Scroll texture not found, using fallback parchment color');
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
                console.log('[LEVEL UP CANVAS] No avatar found, texture will show through');
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
        
        // Get BOUNTY amount for user's level
        const isPirateKingData = userData.isPirateKing || false;
        const bountyAmount = getBountyForLevel(userData.level, isPirateKingData);
        const bountyStr = bountyAmount.toLocaleString();
        
        console.log(`[LEVEL UP CANVAS] Level ${userData.level} = Bounty ฿${bountyStr}`);
        
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
            console.log('[LEVEL UP CANVAS] One Piece logo not found at assets/one-piece-symbol.png');
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

    // Log level up
    async logLevelUp(user, guildId, oldLevel, newLevel, totalXP, roleReward, xpSource) {
        try {
            const guildSettings = global.guildSettings?.get(guildId);
            
            if (!guildSettings?.xpLogEnabled || !guildSettings?.xpLogChannel) return;

            const channel = await this.client.channels.fetch(guildSettings.xpLogChannel).catch(() => null);
            if (!channel || !channel.isTextBased()) return;

            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setAuthor({ 
                    name: '🔴 MARINE INTELLIGENCE BUREAU',
                    iconURL: user.displayAvatarURL({ size: 32 })
                })
                .setTitle('🔴 ⚠️ THREAT LEVEL INCREASED ⚠️')
                .setDescription(`\`\`\`diff\n- BOUNTY UPDATE CONFIRMED\n- SUBJECT: ${user.username} (${user.id})\n- LEVEL: ${oldLevel} → ${newLevel}\n- TOTAL XP: ${totalXP.toLocaleString()}\n- XP SOURCE: ${xpSource.toUpperCase()}\n${roleReward ? `- ROLE AWARDED: ${roleReward}\n` : ''}\`\`\``)
                .setTimestamp()
                .setFooter({ text: '⚓ Marine Intelligence Division' });

            await channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('[XP LOG] Failed to send level up log:', error);
        }
    }

    // Utility methods
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

    getXPForLevel(level) {
        const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
        const curve = process.env.FORMULA_CURVE || 'exponential';
        const baseXP = parseInt(process.env.FORMULA_BASE_XP) || 500;

        if (level === 0) return 0;

        if (curve === 'exponential') {
            return Math.floor(baseXP * Math.pow(level, multiplier));
        } else if (curve === 'linear') {
            return baseXP * level * multiplier;
        } else if (curve === 'logarithmic') {
            return Math.floor(baseXP * Math.log(level + 1) * multiplier * 2);
        } else {
            return Math.floor(baseXP * Math.pow(level, multiplier));
        }
    }

    isOnCooldown(key, cooldownMs) {
        const now = Date.now();
        const lastUse = this.cooldowns.get(key);
        return lastUse && (now - lastUse) < cooldownMs;
    }

    setCooldown(key) {
        this.cooldowns.set(key, Date.now());
    }

    // ✅ NEW: Helper method to create progress bars
    createProgressBar(current, max, length = 20) {
        const percentage = Math.max(0, Math.min(1, current / max));
        const filled = Math.round(percentage * length);
        const empty = length - filled;
        
        const filledChar = '█';
        const emptyChar = '░';
        
        return filledChar.repeat(filled) + emptyChar.repeat(empty);
    }

    // ✅ ENHANCED: XP activity logging with daily cap information for voice XP
    async logXPActivity(type, user, guildId, xpGain, additionalInfo = {}) {
        try {
            const guildSettings = global.guildSettings?.get(guildId);
            
            if (!guildSettings?.xpLogEnabled || !guildSettings?.xpLogChannel) return;

            const channel = await this.client.channels.fetch(guildSettings.xpLogChannel).catch(() => null);
            if (!channel || !channel.isTextBased()) return;

            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setAuthor({ 
                    name: '🔴 MARINE INTELLIGENCE BUREAU',
                    iconURL: user.displayAvatarURL({ size: 32 })
                })
                .setTimestamp()
                .setFooter({ text: '⚓ Marine Intelligence Division' });

            // Enhanced logging based on XP type
            switch (type) {
                case 'voice':
                    // ✅ NEW: Get daily voice XP information
                    const dailyCap = parseInt(process.env.DAILY_VOICE_XP_CAP) || 1500;
                    const currentDay = this.dailyResetManager ? this.dailyResetManager.getCurrentDay() : 'Unknown';
                    const dailyXP = this.dailyResetManager ? 
                        this.dailyResetManager.getDailyVoiceXP(user.id, guildId, currentDay) : 0;
                    const remainingXP = Math.max(0, dailyCap - dailyXP);
                    const capPercentage = Math.round((dailyXP / dailyCap) * 100);
                    
                    // Create progress bar
                    const progressBar = this.createProgressBar(dailyXP, dailyCap, 20);
                    
                    embed
                        .setTitle('🔴 🎤 VOICE ACTIVITY DETECTED')
                        .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- VOICE CHANNEL: ${additionalInfo.channelName || 'Unknown'}\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${additionalInfo.totalXP?.toLocaleString() || '0'}\n- CURRENT LEVEL: ${additionalInfo.currentLevel || '0'}\n- SOURCE: VOICE ACTIVITY\n\`\`\``)
                        .addFields(
                            {
                                name: '📊 Daily Voice XP Progress',
                                value: `\`\`\`yaml\nDaily XP: ${dailyXP.toLocaleString()}/${dailyCap.toLocaleString()} (${capPercentage}%)\nRemaining: ${remainingXP.toLocaleString()} XP\nReset Day: ${currentDay}\n\`\`\``,
                                inline: true
                            },
                            {
                                name: '📈 Progress Bar',
                                value: `\`${progressBar}\`\n${dailyXP >= dailyCap ? '🚨 **DAILY CAP REACHED**' : `⏱️ ${remainingXP} XP until cap`}`,
                                inline: true
                            }
                        );
                    break;
                
                case 'message':
                    embed
                        .setTitle('🔴 💬 MESSAGE ACTIVITY DETECTED')
                        .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${additionalInfo.totalXP?.toLocaleString() || '0'}\n- CURRENT LEVEL: ${additionalInfo.currentLevel || '0'}\n- SOURCE: MESSAGE ACTIVITY\n\`\`\``);
                    break;
                
                case 'reaction':
                    embed
                        .setTitle('🔴 👍 REACTION ACTIVITY DETECTED')
                        .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${additionalInfo.totalXP?.toLocaleString() || '0'}\n- CURRENT LEVEL: ${additionalInfo.currentLevel || '0'}\n- SOURCE: REACTION ACTIVITY\n\`\`\``);
                    break;
                
                default:
                    embed
                        .setTitle(`🔴 ${type.toUpperCase()} ACTIVITY DETECTED`)
                        .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${additionalInfo.totalXP?.toLocaleString() || '0'}\n- CURRENT LEVEL: ${additionalInfo.currentLevel || '0'}\n- SOURCE: ${type.toUpperCase()}\n\`\`\``);
                    break;
            }

            await channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('[XP LOG] Failed to send XP log:', error);
        }
    }

    // Get user stats and other utility methods
    async getUserStats(userId, guildId) {
        try {
            const result = await this.db.query(`
                SELECT user_id, guild_id, total_xp, level, messages, reactions, voice_time, 
                       created_at, updated_at
                FROM user_levels 
                WHERE user_id = $1 AND guild_id = $2
            `, [userId, guildId]);
            
            return result.rows.length > 0 ? result.rows[0] : null;
        } catch (error) {
            console.error('Error getting user stats:', error);
            return null;
        }
    }

    async getUserRank(userId, guildId) {
        try {
            const result = await this.db.query(`
                SELECT COUNT(*) + 1 as rank 
                FROM user_levels 
                WHERE guild_id = $1 AND total_xp > (
                    SELECT total_xp FROM user_levels WHERE user_id = $2 AND guild_id = $1
                )
            `, [guildId, userId]);
            
            return result.rows[0]?.rank || null;
        } catch (error) {
            console.error('Error getting user rank:', error);
            return null;
        }
    }

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

    // ✅ FIXED: Daily voice XP cleanup
    async cleanupDailyVoiceXP() {
        try {
            if (this.dailyResetManager) {
                await this.dailyResetManager.cleanupDailyVoiceXP();
            }
        } catch (error) {
            console.error('[XP TRACKER] Error cleaning up daily voice XP:', error);
        }
    }

    // Force daily reset (delegated to reset manager)
    async forceDailyReset(triggeredBy = 'SYSTEM') {
        return await this.dailyResetManager.forceDailyReset(triggeredBy);
    }

    async cleanup() {
        console.log('[XP TRACKER] Starting cleanup...');
        
        if (this.dailyResetManager) {
            await this.dailyResetManager.cleanup();
        }
        
        this.voiceSessions.clear();
        this.cooldowns.clear();
        
        console.log('[XP TRACKER] Cleanup complete');
    }
}

module.exports = XPTracker;

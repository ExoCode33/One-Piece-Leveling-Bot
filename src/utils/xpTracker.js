// src/utils/xpTracker.js - Part 1: Class Setup & Core Methods

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

// CONFIGURABLE RESET TIME (EST)
const DAILY_RESET_HOUR_EST = parseInt(process.env.DAILY_RESET_HOUR_EST) || 3;
const DAILY_RESET_MINUTE_EST = parseInt(process.env.DAILY_RESET_MINUTE_EST) || 0;

// Register custom fonts
try {
    registerFont(path.join(__dirname, '../../assets/fonts/captkd.ttf'), { family: 'CaptainKiddNF' });
    registerFont(path.join(__dirname, '../../assets/fonts/Cinzel-Bold.otf'), { family: 'Cinzel' });
    registerFont(path.join(__dirname, '../../assets/fonts/Times New Normal Regular.ttf'), { family: 'TimesNewNormal' });
    console.log('[XP TRACKER] Successfully registered custom fonts');
} catch (error) {
    console.error('[XP TRACKER] Failed to register custom fonts:', error.message);
}

class XPTracker {
    constructor(client, database) {
        this.client = client;
        this.db = database;
        this.voiceSessions = new Map();
        this.cooldowns = new Map();
        this.dailyVoiceXP = new Map();
        this.resetTimeouts = new Map();
        
        console.log(`[XP TRACKER] Daily reset configured for ${DAILY_RESET_HOUR_EST}:${DAILY_RESET_MINUTE_EST.toString().padStart(2, '0')} EST`);
        
        this.loadGuildSettingsFromDatabase();
        this.initializeExistingVoiceSessions();
        this.loadDailyVoiceXPFromDatabase();
    }

    // Get current day based on configurable EST reset time
    getCurrentDay() {
        const now = new Date();
        const estOffset = this.isEDT(now) ? -4 : -5;
        const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
        
        const currentHour = estTime.getHours();
        const currentMinute = estTime.getMinutes();
        const resetTimeInMinutes = (DAILY_RESET_HOUR_EST * 60) + DAILY_RESET_MINUTE_EST;
        const currentTimeInMinutes = (currentHour * 60) + currentMinute;
        
        if (currentTimeInMinutes < resetTimeInMinutes) {
            estTime.setDate(estTime.getDate() - 1);
        }
        
        return estTime.toISOString().split('T')[0];
    }

    // Check if date is in Eastern Daylight Time (EDT)
    isEDT(date) {
        const year = date.getFullYear();
        const marchSecondSunday = new Date(year, 2, 8);
        marchSecondSunday.setDate(marchSecondSunday.getDate() + (7 - marchSecondSunday.getDay()));
        const novemberFirstSunday = new Date(year, 10, 1);
        novemberFirstSunday.setDate(novemberFirstSunday.getDate() + (7 - novemberFirstSunday.getDay()));
        return date >= marchSecondSunday && date < novemberFirstSunday;
    }

    // Load guild settings from database
    async loadGuildSettingsFromDatabase() {
        try {
            console.log('[SETTINGS] Loading guild settings from database...');
            
            if (!global.guildSettings) {
                global.guildSettings = new Map();
            }

            const tableInfo = await this.db.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'guild_settings'
                ORDER BY ordinal_position
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

            console.log(`[SETTINGS] Successfully loaded ${loadedCount} guild configurations from database`);

        } catch (error) {
            console.error('[SETTINGS] Error loading guild settings from database:', error);
            
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

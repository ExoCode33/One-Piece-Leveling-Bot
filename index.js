// index.js - Discord Leveling Bot with Professional Logging (FIXED)

const { Client, GatewayIntentBits, Partials, Collection, EmbedBuilder, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
require('dotenv').config();

// === Database Setup ===
const { Pool } = require('pg');
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// === Discord Client Setup ===
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember],
});

client.commands = new Collection();
client.db = db;

// === Cooldown Maps ===
const messageCooldowns = new Map();
const reactionCooldowns = new Map();
const voiceSessions = new Map();

// === Helper Functions ===
function getRandomXP(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateLevel(xp) {
    const curve = process.env.FORMULA_CURVE || 'exponential';
    const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
    const maxLevel = parseInt(process.env.MAX_LEVEL) || 50;
    
    let level;
    switch (curve) {
        case 'linear':
            level = Math.floor(xp / (1000 * multiplier));
            break;
        case 'logarithmic':
            level = Math.floor(Math.log(xp / 100 + 1) * multiplier);
            break;
        case 'exponential':
        default:
            level = Math.floor(Math.sqrt(xp / 100) * multiplier);
            break;
    }
    
    return Math.min(level, maxLevel);
}

function calculateXPForLevel(level) {
    const curve = process.env.FORMULA_CURVE || 'exponential';
    const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
    
    switch (curve) {
        case 'linear':
            return Math.floor(level * 1000 * multiplier);
        case 'logarithmic':
            return Math.floor((Math.exp(level / multiplier) - 1) * 100);
        case 'exponential':
        default:
            return Math.floor(Math.pow(level / multiplier, 2) * 100);
    }
}

async function debugLog(message) {
    if (process.env.DEBUG_MODE === 'true') {
        console.log(`[DEBUG] ${message}`);
    }
}

// === One Piece Themed Professional XP Logging Function ===
async function sendXPLog(type, user, xpGain, additionalInfo = {}) {
    const logChannelId = process.env.XP_LOG_CHANNEL;
    if (!logChannelId || process.env.XP_LOG_ENABLED !== 'true') return;

    // Check specific logging settings
    const logSettings = {
        message: process.env.XP_LOG_MESSAGES === 'true',
        reaction: process.env.XP_LOG_REACTIONS === 'true',
        voice: process.env.XP_LOG_VOICE === 'true',
        levelup: true // Always log level ups if logging is enabled
    };

    if (!logSettings[type]) return;

    try {
        const channel = await client.channels.fetch(logChannelId);
        if (!channel || !channel.isTextBased()) return;

        // Create One Piece themed embed based on type
        const embed = new EmbedBuilder()
            .setTimestamp()
            .setFooter({ 
                text: '⚓ Marine Bounty Tracking System', 
                iconURL: client.user.displayAvatarURL() 
            });

        switch (type) {
            case 'message':
                embed
                    .setTitle('📜 Pirate\'s Message Bounty')
                    .setColor(0x1E3A8A) // Navy Blue
                    .setDescription('*A pirate\'s words carry weight on the Grand Line...*')
                    .addFields(
                        { name: '🏴‍☠️ Pirate', value: `**${user.username}**`, inline: true },
                        { name: '💰 Bounty Earned', value: `**+${xpGain}** ⚡`, inline: true },
                        { name: '🗺️ Location', value: `<#${additionalInfo.channelId}>`, inline: true }
                    );
                
                if (additionalInfo.totalXP) {
                    embed.addFields({ 
                        name: '💎 Total Bounty', 
                        value: `**${additionalInfo.totalXP.toLocaleString()}** ⚡`, 
                        inline: true 
                    });
                }
                if (additionalInfo.level) {
                    embed.addFields({ 
                        name: '⭐ Pirate Rank', 
                        value: `**Level ${additionalInfo.level}**`, 
                        inline: true 
                    });
                }
                embed.setAuthor({ 
                    name: 'Marine Intelligence Report'
                });
                break;

            case 'reaction':
                embed
                    .setTitle('😄 Crew Member\'s Reaction')
                    .setColor(0xF59E0B) // Amber/Gold
                    .setDescription('*Even a simple reaction shows the bond between crew members!*')
                    .addFields(
                        { name: '🏴‍☠️ Pirate', value: `**${user.username}**`, inline: true },
                        { name: '💰 Bounty Earned', value: `**+${xpGain}** ⚡`, inline: true },
                        { name: '🗺️ Location', value: `<#${additionalInfo.channelId}>`, inline: true }
                    );

                if (additionalInfo.emoji) {
                    embed.addFields({ 
                        name: '⚓ Reaction', 
                        value: additionalInfo.emoji, 
                        inline: true 
                    });
                }
                if (additionalInfo.totalXP) {
                    embed.addFields({ 
                        name: '💎 Total Bounty', 
                        value: `**${additionalInfo.totalXP.toLocaleString()}** ⚡`, 
                        inline: true 
                    });
                }
                if (additionalInfo.level) {
                    embed.addFields({ 
                        name: '⭐ Pirate Rank', 
                        value: `**Level ${additionalInfo.level}**`, 
                        inline: true 
                    });
                }
                embed.setAuthor({ 
                    name: 'Crew Bond Strengthened'
                });
                break;

            case 'voice':
                embed
                    .setTitle('🎙️ Crew Assembly Bounty')
                    .setColor(0x10B981) // Emerald Green
                    .setDescription('*Gathering with fellow pirates strengthens the crew!*')
                    .addFields(
                        { name: '🏴‍☠️ Pirate', value: `**${user.username}**`, inline: true },
                        { name: '💰 Bounty Earned', value: `**+${xpGain}** ⚡`, inline: true },
                        { name: '🚢 Ship Deck', value: additionalInfo.channelName || 'Unknown Waters', inline: true }
                    );

                if (additionalInfo.memberCount) {
                    embed.addFields({ 
                        name: '👥 Crew Members', 
                        value: `${additionalInfo.memberCount} pirates`, 
                        inline: true 
                    });
                }
                if (additionalInfo.sessionDuration) {
                    embed.addFields({ 
                        name: '⏰ Time on Deck', 
                        value: `${additionalInfo.sessionDuration} minutes`, 
                        inline: true 
                    });
                }
                if (additionalInfo.totalXP) {
                    embed.addFields({ 
                        name: '💎 Total Bounty', 
                        value: `**${additionalInfo.totalXP.toLocaleString()}** ⚡`, 
                        inline: true 
                    });
                }
                embed.setAuthor({ 
                    name: 'Ship Assembly Log'
                });
                break;

            case 'levelup':
                embed
                    .setTitle('🌟 BOUNTY INCREASE! 🌟')
                    .setColor(0xDC2626) // Red
                    .setDescription(`**${user.username}** has reached a new level of infamy!\n*The Marines have increased their bounty!*`)
                    .addFields(
                        { name: '📰 Previous Bounty Level', value: `**Level ${additionalInfo.oldLevel}**`, inline: true },
                        { name: '🔥 NEW BOUNTY LEVEL', value: `**Level ${additionalInfo.newLevel}**`, inline: true },
                        { name: '💎 Total Bounty', value: `**${additionalInfo.totalXP.toLocaleString()}** ⚡`, inline: true }
                    );

                if (additionalInfo.roleReward && additionalInfo.roleReward !== 'your_role_id_here') {
                    embed.addFields({ 
                        name: '🏆 New Title Earned', 
                        value: `<@&${additionalInfo.roleReward}>`, 
                        inline: false 
                    });
                    embed.setColor(0xFFD700); // Gold for role rewards
                    embed.setDescription(`**${user.username}** has gained a new title!\n*🎉 The World Government recognizes their growing threat! 🎉*`);
                }

                // Add special level milestone messages
                if (additionalInfo.newLevel === 50) {
                    embed.setDescription(`**${user.username}** has reached the legendary Level 50!\n*🏴‍☠️ They've ascended to YONKO status! One of the Four Emperors! 🏴‍☠️*`);
                } else if (additionalInfo.newLevel === 45) {
                    embed.setDescription(`**${user.username}** has reached Level 45!\n*⚡ They've become a feared Yonko Commander! ⚡*`);
                } else if (additionalInfo.newLevel === 40) {
                    embed.setDescription(`**${user.username}** has reached Level 40!\n*🗡️ They've achieved Warlord status! 🗡️*`);
                } else if (additionalInfo.newLevel === 35) {
                    embed.setDescription(`**${user.username}** has reached Level 35!\n*🧭 They've become a trusted First Mate! 🧭*`);
                } else if (additionalInfo.newLevel === 30) {
                    embed.setDescription(`**${user.username}** has reached Level 30!\n*🗺️ They've mastered navigation of the Grand Line! 🗺️*`);
                } else if (additionalInfo.newLevel === 25) {
                    embed.setDescription(`**${user.username}** has reached Level 25!\n*⚓ They've earned the rank of Boatswain! ⚓*`);
                } else if (additionalInfo.newLevel === 20) {
                    embed.setDescription(`**${user.username}** has reached Level 20!\n*⚓ They've become the ship's Helmsman! ⚓*`);
                } else if (additionalInfo.newLevel === 15) {
                    embed.setDescription(`**${user.username}** has reached Level 15!\n*💣 They've proven themselves as a skilled Gunner! 💣*`);
                } else if (additionalInfo.newLevel === 10) {
                    embed.setDescription(`**${user.username}** has reached Level 10!\n*🧨 They've advanced to Powder Monkey! 🧨*`);
                } else if (additionalInfo.newLevel === 5) {
                    embed.setDescription(`**${user.username}** has reached Level 5!\n*🔨 They've become a reliable Deckhand! 🔨*`);
                }
                
                embed.setAuthor({ 
                    name: 'WORLD GOVERNMENT BOUNTY UPDATE'
                });
                break;
        }

        // Add user avatar as thumbnail with One Piece frame effect
        if (user.displayAvatarURL) {
            embed.setThumbnail(user.displayAvatarURL({ size: 128 }));
        }

        await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error('[BOUNTY LOG] Failed to send professional log:', err);
    }
}

// === Main XP Update Function ===
async function updateUserLevel(userId, guildId, xpGain, activityType, additionalInfo = {}) {
    try {
        // Get current user data
        const userQuery = `
            SELECT total_xp, level, messages, reactions, voice_time 
            FROM user_levels 
            WHERE user_id = $1 AND guild_id = $2
        `;
        let userResult = await db.query(userQuery, [userId, guildId]);
        
        let currentXP = 0;
        let currentLevel = 0;
        let messages = 0;
        let reactions = 0;
        let voiceTime = 0;
        
        if (userResult.rows.length > 0) {
            const row = userResult.rows[0];
            currentXP = row.total_xp;
            currentLevel = row.level;
            messages = row.messages;
            reactions = row.reactions;
            voiceTime = row.voice_time;
        }
        
        // Apply XP multiplier
        const multiplier = parseFloat(process.env.XP_MULTIPLIER) || 1.0;
        const finalXP = Math.floor(xpGain * multiplier);
        const newTotalXP = currentXP + finalXP;
        const newLevel = calculateLevel(newTotalXP);
        
        // Update activity counters
        if (activityType === 'message') messages++;
        if (activityType === 'reaction') reactions++;
        if (activityType === 'voice') voiceTime += 1; // 1 minute increment
        
        // Upsert user data
        const upsertQuery = `
            INSERT INTO user_levels (user_id, guild_id, total_xp, level, messages, reactions, voice_time)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (user_id, guild_id)
            DO UPDATE SET 
                total_xp = $3,
                level = $4,
                messages = $5,
                reactions = $6,
                voice_time = $7
        `;
        
        await db.query(upsertQuery, [userId, guildId, newTotalXP, newLevel, messages, reactions, voiceTime]);
        
        // Debug logging
        await debugLog(`XP Update: User ${userId}, Activity: ${activityType}, XP: +${finalXP}, Total: ${newTotalXP}, Level: ${newLevel}`);
        
        // Get user object for logging
        const guild = client.guilds.cache.get(guildId);
        let user = null;
        if (guild) {
            try {
                const member = await guild.members.fetch(userId);
                user = member.user;
            } catch (error) {
                user = { username: 'Unknown User', discriminator: '0000', displayAvatarURL: () => null };
            }
        }
        
        // Professional XP logging (for non-levelup activities)
        if (user && type !== 'levelup') {
            await sendXPLog(activityType, user, finalXP, {
                ...additionalInfo,
                totalXP: newTotalXP,
                level: newLevel
            });
        }
        
        // Check for level up
        if (newLevel > currentLevel) {
            await handleLevelUp(userId, guildId, newLevel, currentLevel, newTotalXP);
        }
        
        return finalXP;
    } catch (error) {
        console.error('Error updating user level:', error);
        return 0;
    }
}

async function handleLevelUp(userId, guildId, newLevel, oldLevel, totalXP) {
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;
        
        const user = await guild.members.fetch(userId);
        if (!user) return;
        
        await debugLog(`Level Up: ${user.user.tag} reached level ${newLevel}`);
        
        // Check for role rewards
        const roleId = process.env[`LEVEL_${newLevel}_ROLE`];
        if (roleId && roleId !== 'your_role_id_here') {
            try {
                const role = guild.roles.cache.get(roleId);
                if (role && !user.roles.cache.has(roleId)) {
                    await user.roles.add(role);
                    console.log(`[LEVEL UP] Added role ${role.name} to ${user.user.tag}`);
                }
            } catch (error) {
                console.error(`Error adding role for level ${newLevel}:`, error);
            }
        }
        
        // ONLY send One Piece themed level up message, no regular embed
        const levelUpEnabled = process.env.LEVELUP_ENABLED !== 'false';
        if (levelUpEnabled) {
            // Send the One Piece themed level up log
            await sendXPLog('levelup', user.user, 0, {
                newLevel,
                oldLevel,
                totalXP,
                roleReward: process.env[`LEVEL_${newLevel}_ROLE`]
            });
        }
    } catch (error) {
        console.error('Error handling level up:', error);
    }
}

// === INLINE COMMAND DEFINITIONS ===

// Level Command
const levelCommand = {
    data: {
        name: 'level',
        description: 'Check your or someone\'s level and stats',
        options: [
            {
                name: 'user',
                description: 'User to check (optional)',
                type: 6,
                required: false
            }
        ]
    },
    async execute(interaction, client) {
        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const guildId = interaction.guildId;
            
            // Get user data
            const userQuery = `
                SELECT total_xp, level, messages, reactions, voice_time 
                FROM user_levels 
                WHERE user_id = $1 AND guild_id = $2
            `;
            const result = await client.db.query(userQuery, [targetUser.id, guildId]);
            
            let userData = {
                total_xp: 0,
                level: 0,
                messages: 0,
                reactions: 0,
                voice_time: 0
            };
            
            if (result.rows.length > 0) {
                userData = result.rows[0];
            }
            
            // Calculate progress to next level
            const currentLevelXP = calculateXPForLevel(userData.level);
            const nextLevelXP = calculateXPForLevel(userData.level + 1);
            const progressXP = userData.total_xp - currentLevelXP;
            const neededXP = nextLevelXP - currentLevelXP;
            const progressPercent = Math.floor((progressXP / neededXP) * 100);
            
            // Create progress bar
            const progressBarLength = 20;
            const filledBars = Math.floor((progressPercent / 100) * progressBarLength);
            const emptyBars = progressBarLength - filledBars;
            const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);
            
            const embed = new EmbedBuilder()
                .setTitle(`🏴‍☠️ ${targetUser.username}'s Bounty Report`)
                .setColor(0x00AE86)
                .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
                .addFields(
                    { name: '⭐ Pirate Level', value: `**${userData.level}**`, inline: true },
                    { name: '💎 Total Bounty', value: `**${userData.total_xp.toLocaleString()}** ⚡`, inline: true },
                    { name: '📈 Progress', value: `${progressPercent}%`, inline: true },
                    { name: '📊 Progress Bar', value: `\`${progressBar}\`\n${progressXP.toLocaleString()}/${neededXP.toLocaleString()} XP`, inline: false },
                    { name: '📜 Messages', value: userData.messages.toLocaleString(), inline: true },
                    { name: '😄 Reactions', value: userData.reactions.toLocaleString(), inline: true },
                    { name: '🎙️ Voice Time', value: `${userData.voice_time} min`, inline: true }
                )
                .setFooter({ text: '⚓ Marine Intelligence Report' })
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in level command:', error);
            await interaction.reply({ content: 'An error occurred while fetching level data.', ephemeral: true });
        }
    }
};

// Leaderboard Command
const leaderboardCommand = {
    data: {
        name: 'leaderboard',
        description: 'Show the server leaderboard',
        options: [
            {
                name: 'page',
                description: 'Page number (default: 1)',
                type: 4,
                required: false
            },
            {
                name: 'type',
                description: 'Leaderboard type',
                type: 3,
                required: false,
                choices: [
                    { name: 'Total XP', value: 'xp' },
                    { name: 'Messages', value: 'messages' },
                    { name: 'Voice Time', value: 'voice' },
                    { name: 'Reactions', value: 'reactions' }
                ]
            }
        ]
    },
    async execute(interaction, client) {
        try {
            const page = interaction.options.getInteger('page') || 1;
            const type = interaction.options.getString('type') || 'xp';
            const guildId = interaction.guildId;
            const usersPerPage = 10;
            const offset = (page - 1) * usersPerPage;
            
            // Determine sort column
            let sortColumn = 'total_xp';
            let title = '💎 Bounty Leaderboard';
            switch (type) {
                case 'messages':
                    sortColumn = 'messages';
                    title = '📜 Message Leaderboard';
                    break;
                case 'voice':
                    sortColumn = 'voice_time';
                    title = '🎙️ Voice Leaderboard';
                    break;
                case 'reactions':
                    sortColumn = 'reactions';
                    title = '😄 Reaction Leaderboard';
                    break;
            }
            
            // Get leaderboard data
            const leaderboardQuery = `
                SELECT user_id, total_xp, level, messages, reactions, voice_time
                FROM user_levels 
                WHERE guild_id = $1 
                ORDER BY ${sortColumn} DESC 
                LIMIT $2 OFFSET $3
            `;
            const result = await client.db.query(leaderboardQuery, [guildId, usersPerPage, offset]);
            
            if (result.rows.length === 0) {
                await interaction.reply({ content: 'No users found on the leaderboard!', ephemeral: true });
                return;
            }
            
            const embed = new EmbedBuilder()
                .setTitle(title)
                .setColor(0xFFD700)
                .setFooter({ text: `⚓ Page ${page} • Marine Archives` })
                .setTimestamp();
            
            let description = '';
            for (let i = 0; i < result.rows.length; i++) {
                const userData = result.rows[i];
                const rank = offset + i + 1;
                
                let emoji = '🥉';
                if (rank === 1) emoji = '🥇';
                else if (rank === 2) emoji = '🥈';
                else if (rank <= 10) emoji = '🏴‍☠️';
                
                let value;
                switch (type) {
                    case 'messages':
                        value = `${userData.messages.toLocaleString()} messages`;
                        break;
                    case 'voice':
                        value = `${userData.voice_time.toLocaleString()} minutes`;
                        break;
                    case 'reactions':
                        value = `${userData.reactions.toLocaleString()} reactions`;
                        break;
                    default:
                        value = `${userData.total_xp.toLocaleString()} ⚡ (Level ${userData.level})`;
                }
                
                try {
                    const user = await client.users.fetch(userData.user_id);
                    description += `${emoji} **#${rank}** ${user.username} - ${value}\n`;
                } catch (error) {
                    description += `${emoji} **#${rank}** Unknown User - ${value}\n`;
                }
            }
            
            embed.setDescription(description);
            
            // Add navigation buttons
            const row = new ActionRowBuilder();
            
            if (page > 1) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`leaderboard_${type}_${page - 1}`)
                        .setLabel('◀️ Previous')
                        .setStyle(ButtonStyle.Primary)
                );
            }
            
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`leaderboard_${type}_${page + 1}`)
                    .setLabel('Next ▶️')
                    .setStyle(ButtonStyle.Primary)
            );
            
            const components = row.components.length > 0 ? [row] : [];
            await interaction.reply({ embeds: [embed], components });
            
        } catch (error) {
            console.error('Error in leaderboard command:', error);
            await interaction.reply({ content: 'An error occurred while fetching leaderboard data.', ephemeral: true });
        }
    }
};

// Settings Command
const settingsCommand = {
    data: {
        name: 'settings',
        description: 'View bot settings (Admin only)'
    },
    async execute(interaction, client) {
        try {
            // Check admin permissions
            if (!interaction.member.permissions.has('Administrator')) {
                await interaction.reply({ content: 'You need Administrator permissions to use this command.', ephemeral: true });
                return;
            }
            
            const embed = new EmbedBuilder()
                .setTitle('🔧 Bot Configuration')
                .setColor(0x00AE86)
                .addFields(
                    { name: '📝 Message XP', value: `${process.env.MESSAGE_XP_MIN || 25}-${process.env.MESSAGE_XP_MAX || 35} XP`, inline: true },
                    { name: '😄 Reaction XP', value: `${process.env.REACTION_XP_MIN || 25}-${process.env.REACTION_XP_MAX || 35} XP`, inline: true },
                    { name: '🎙️ Voice XP', value: `${process.env.VOICE_XP_MIN || 45}-${process.env.VOICE_XP_MAX || 55} XP/min`, inline: true },
                    { name: '⏰ Message Cooldown', value: `${(parseInt(process.env.MESSAGE_COOLDOWN) || 60000) / 1000}s`, inline: true },
                    { name: '⏰ Reaction Cooldown', value: `${(parseInt(process.env.REACTION_COOLDOWN) || 300000) / 1000}s`, inline: true },
                    { name: '⏰ Voice Cooldown', value: `${(parseInt(process.env.VOICE_COOLDOWN) || 180000) / 1000}s`, inline: true },
                    { name: '🧮 Formula', value: process.env.FORMULA_CURVE || 'exponential', inline: true },
                    { name: '📈 Multiplier', value: process.env.FORMULA_MULTIPLIER || '1.75', inline: true },
                    { name: '🏆 Max Level', value: process.env.MAX_LEVEL || '50', inline: true }
                )
                .setFooter({ text: '⚓ Configure via Environment Variables' })
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in settings command:', error);
            await interaction.reply({ content: 'An error occurred while fetching settings.', ephemeral: true });
        }
    }
};

// Register commands
client.commands.set('level', levelCommand);
client.commands.set('leaderboard', leaderboardCommand);
client.commands.set('settings', settingsCommand);

// === Database Initialization ===
async function initializeDatabase() {
    try {
        // Create user_levels table
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_levels (
                user_id VARCHAR(20) NOT NULL,
                guild_id VARCHAR(20) NOT NULL,
                total_xp INTEGER DEFAULT 0,
                level INTEGER DEFAULT 0,
                messages INTEGER DEFAULT 0,
                reactions INTEGER DEFAULT 0,
                voice_time INTEGER DEFAULT 0,
                PRIMARY KEY (user_id, guild_id)
            )
        `);
        
        // Add last_updated column if it doesn't exist (for existing databases)
        try {
            await db.query(`
                ALTER TABLE user_levels 
                ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT NOW()
            `);
        } catch (error) {
            console.log('[INFO] last_updated column already exists or cannot be added');
        }
        
        // Create voice_sessions table
        await db.query(`
            CREATE TABLE IF NOT EXISTS voice_sessions (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(20) NOT NULL,
                guild_id VARCHAR(20) NOT NULL,
                channel_id VARCHAR(20) NOT NULL,
                start_time TIMESTAMP DEFAULT NOW(),
                end_time TIMESTAMP,
                duration INTEGER DEFAULT 0,
                xp_awarded INTEGER DEFAULT 0
            )
        `);
        
        // Create guild_settings table
        await db.query(`
            CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id VARCHAR(20) PRIMARY KEY,
                level_roles JSONB DEFAULT '{}',
                settings JSONB DEFAULT '{}'
            )
        `);
        
        console.log('[INFO] Database tables initialized successfully');
        
        if (process.env.DEBUG_DATABASE === 'true') {
            const userCount = await db.query('SELECT COUNT(*) FROM user_levels');
            console.log(`[DEBUG] Database has ${userCount.rows[0].count} user records`);
        }
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// === Slash Command Handler ===
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() && !interaction.isButton()) return;
    
    try {
        if (interaction.isCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            
            await command.execute(interaction, client);
        }
        
        // Handle button interactions for leaderboard pagination
        if (interaction.isButton() && interaction.customId.startsWith('leaderboard_')) {
            const parts = interaction.customId.split('_');
            const type = parts[1];
            const page = parseInt(parts[2]) || 1;
            
            await interaction.deferUpdate();
            
            // Create a proper mock interaction for the leaderboard command
            const mockInteraction = {
                ...interaction,
                deferReply: async () => {}, // Mock function - already deferred with deferUpdate
                editReply: async (options) => await interaction.editReply(options),
                reply: async (options) => await interaction.editReply(options),
                options: {
                    getString: (name) => {
                        if (name === 'type') return type;
                        return null;
                    },
                    getInteger: (name) => name === 'page' ? page : null
                }
            };
            
            // Get the leaderboard command and execute it
            const leaderboardCommand = client.commands.get('leaderboard');
            if (leaderboardCommand) {
                await leaderboardCommand.execute(mockInteraction, client);
            }
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
        try {
            const errorMessage = 'An error occurred while executing this command.';
            if (interaction.deferred) {
                await interaction.editReply(errorMessage);
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        } catch (e) {
            console.error('Error sending error message:', e);
        }
    }
});

// === XP Event Handlers ===
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    
    const userId = message.author.id;
    const guildId = message.guildId;
    const cooldownKey = `${userId}-${guildId}`;
    const cooldownTime = parseInt(process.env.MESSAGE_COOLDOWN) || 60000;
    
    // Check cooldown
    if (messageCooldowns.has(cooldownKey)) {
        const expirationTime = messageCooldowns.get(cooldownKey) + cooldownTime;
        if (Date.now() < expirationTime) return;
    }
    
    // Set cooldown
    messageCooldowns.set(cooldownKey, Date.now());
    setTimeout(() => messageCooldowns.delete(cooldownKey), cooldownTime);
    
    // Award XP
    const minXP = parseInt(process.env.MESSAGE_XP_MIN) || 25;
    const maxXP = parseInt(process.env.MESSAGE_XP_MAX) || 35;
    const xpAmount = getRandomXP(minXP, maxXP);
    
    await updateUserLevel(userId, guildId, xpAmount, 'message', {
        channelId: message.channel.id,
        messageLength: message.content.length
    });
});

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot || !reaction.message.guild) return;
    
    const userId = user.id;
    const guildId = reaction.message.guildId;
    const cooldownKey = `${userId}-${guildId}`;
    const cooldownTime = parseInt(process.env.REACTION_COOLDOWN) || 300000;
    
    // Check cooldown
    if (reactionCooldowns.has(cooldownKey)) {
        const expirationTime = reactionCooldowns.get(cooldownKey) + cooldownTime;
        if (Date.now() < expirationTime) return;
    }
    
    // Set cooldown
    reactionCooldowns.set(cooldownKey, Date.now());
    setTimeout(() => reactionCooldowns.delete(cooldownKey), cooldownTime);
    
    // Award XP
    const minXP = parseInt(process.env.REACTION_XP_MIN) || 25;
    const maxXP = parseInt(process.env.REACTION_XP_MAX) || 35;
    const xpAmount = getRandomXP(minXP, maxXP);
    
    await updateUserLevel(userId, guildId, xpAmount, 'reaction', {
        channelId: reaction.message.channel.id,
        emoji: reaction.emoji.name || reaction.emoji.toString(),
        messageAuthor: reaction.message.author.username
    });
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.id || oldState.id;
    const guildId = newState.guild.id;
    
    if (!userId || !guildId) return;
    
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;
    
    const sessionKey = `${userId}-${guildId}`;
    
    // User joined a voice channel
    if (!oldState.channelId && newState.channelId) {
        voiceSessions.set(sessionKey, {
            channelId: newState.channelId,
            startTime: Date.now(),
            lastXPTime: Date.now()
        });
        await debugLog(`Voice session started: ${member.user.tag} joined ${newState.channel.name}`);
    }
    
    // User left a voice channel
    else if (oldState.channelId && !newState.channelId) {
        const session = voiceSessions.get(sessionKey);
        if (session) {
            const duration = Math.floor((Date.now() - session.startTime) / 60000); // minutes
            voiceSessions.delete(sessionKey);
            
            // Record session in database
            try {
                await db.query(`
                    INSERT INTO voice_sessions (user_id, guild_id, channel_id, start_time, end_time, duration)
                    VALUES ($1, $2, $3, to_timestamp($4/1000), NOW(), $5)
                `, [userId, guildId, session.channelId, session.startTime, duration]);
            } catch (error) {
                console.error('Error recording voice session:', error);
            }
            
            await debugLog(`Voice session ended: ${member.user.tag} left after ${duration} minutes`);
        }
    }
    
    // User switched channels
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        const session = voiceSessions.get(sessionKey);
        if (session) {
            session.channelId = newState.channelId;
            await debugLog(`Voice session moved: ${member.user.tag} moved to ${newState.channel.name}`);
        }
    }
});

// Voice XP Award Loop
setInterval(async () => {
    for (const [sessionKey, session] of voiceSessions.entries()) {
        try {
            const [userId, guildId] = sessionKey.split('-');
            const guild = client.guilds.cache.get(guildId);
            if (!guild) continue;
            
            const channel = guild.channels.cache.get(session.channelId);
            if (!channel) continue;
            
            // Check minimum members requirement
            const minMembers = parseInt(process.env.VOICE_MIN_MEMBERS) || 2;
            const humanMembers = channel.members.filter(m => !m.user.bot);
            if (humanMembers.size < minMembers) continue;
            
            // Check anti-AFK if enabled
            if (process.env.VOICE_ANTI_AFK === 'true') {
                const member = humanMembers.get(userId);
                if (member && (member.voice.mute || member.voice.deaf)) {
                    continue;
                }
            }
            
            // Check voice cooldown
            const cooldownTime = parseInt(process.env.VOICE_COOLDOWN) || 60000;
            if (Date.now() - session.lastXPTime < cooldownTime) continue;
            
            // Award XP
            const minXP = parseInt(process.env.VOICE_XP_MIN) || 45;
            const maxXP = parseInt(process.env.VOICE_XP_MAX) || 55;
            const xpAmount = getRandomXP(minXP, maxXP);
            
            const sessionDuration = Math.floor((Date.now() - session.startTime) / 60000);
            
            await updateUserLevel(userId, guildId, xpAmount, 'voice', {
                channelName: channel.name,
                memberCount: humanMembers.size,
                sessionDuration: sessionDuration
            });
            
            session.lastXPTime = Date.now();
            
            // Log XP if enabled
            if (process.env.DEBUG_VOICE === 'true') {
                await debugLog(`Voice XP awarded: ${userId} (+${xpAmount} XP) in ${channel.name}`);
            }
            
        } catch (error) {
            console.error('Error in voice XP loop:', error);
        }
    }
}, 60000); // Check every minute

// === Bot Ready Event ===
client.once('ready', async () => {
    console.log(`[INFO] Bot logged in as ${client.user.tag}`);
    
    // Initialize database
    await initializeDatabase();
    
    // Register slash commands
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        
        const commands = [
            {
                name: 'level',
                description: 'Check your or someone\'s level and stats',
                options: [
                    {
                        name: 'user',
                        description: 'User to check (optional)',
                        type: 6,
                        required: false
                    }
                ]
            },
            {
                name: 'leaderboard',
                description: 'Show the server leaderboard',
                options: [
                    {
                        name: 'page',
                        description: 'Page number (default: 1)',
                        type: 4,
                        required: false
                    },
                    {
                        name: 'type',
                        description: 'Leaderboard type',
                        type: 3,
                        required: false,
                        choices: [
                            { name: 'Total XP', value: 'xp' },
                            { name: 'Messages', value: 'messages' },
                            { name: 'Voice Time', value: 'voice' },
                            { name: 'Reactions', value: 'reactions' }
                        ]
                    }
                ]
            },
            {
                name: 'settings',
                description: 'View bot settings (Admin only)'
            }
        ];
        
        if (process.env.DEBUG_COMMANDS === 'true') {
            console.log('[DEBUG] Registering slash commands...');
        }
        
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        
        console.log('[INFO] Slash commands registered successfully');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
    
    // Set bot status
    client.user.setActivity('for XP gains!', { type: 'WATCHING' });
    
    console.log('[INFO] Discord Leveling Bot is fully operational!');
});

// === Error Handling ===
client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

// === Login ===
client.login(process.env.DISCORD_TOKEN);

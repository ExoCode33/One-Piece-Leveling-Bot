calculateLevel(totalXP) {
        switch (this.config.formulaCurve) {
            case 'linear':
                return Math.floor(totalXP / (1000 * this.config.formulaMultiplier));
            case 'exponential':
                return Math.floor(Math.pow(totalXP / (100 * this.config.formulaMultiplier), 0.5));
            case 'logarithmic':
                return Math.floor(Math.log(totalXP / 100 + 1) * this.config.formulaMultiplier * 10);
            default:
                // Default exponential curve matching your calculator
                return Math.floor(Math.pow(totalXP / (100 * this.config.formulaMultiplier), 0.5));
        }
    }

    calculateXPForLevel(level) {
        switch (this.config.formulaCurve) {
            case 'linear':
                return level * 1000 * this.config.formulaMultiplier;
            case 'exponential':
                return Math.floor(Math.pow(level, 2) * 100 * this.config.formulaMultiplier);
            case 'logarithmic':
                return Math.floor((Math.exp(level / (this.config.formulaMultiplier * 10)) - 1) * 100);
            default:
                // Default exponential curve
                return Math.floor(Math.pow(level, 2) * 100 * this.config.formulaMultiplier);
        }
    }

    async handleLevelUp(userId, guildId, newLevel, oldLevel) {
        try {
            this.debugXPLog(`🎉 Processing level up for user ${userId}: ${oldLevel} → ${newLevel}`);
            
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;
            
            const user = await guild.members.fetch(userId);
            if (!user) return;
            
            // Check for role rewards from environment variables
            if (this.levelRoles[newLevel]) {
                const roleId = this.levelRoles[newLevel];
                const role = guild.roles.cache.get(roleId);
                if (role && !user.roles.cache.has(roleId)) {
                    await user.roles.add(role);
                    this.debugXPLog(`🏆 Added Level ${newLevel} role "${role.name}" to ${user.user.username}`);
                }
            }
            
            // Send level up message with One Piece theme
            if (this.levelUpConfig.enabled) {
                let channel = null;
                
                // Try to find channel by ID first
                if (this.levelUpConfig.channel) {
                    channel = guild.channels.cache.get(this.levelUpConfig.channel);
                    this.debugXPLog(`🔍 Looking for level up channel by ID: ${this.levelUpConfig.channel}`);
                }
                
                // If no ID channel found, try to find by name
                if (!channel && this.levelUpConfig.channelName) {
                    channel = guild.channels.cache.find(ch => 
                        ch.type === 0 && // Text channel
                        ch.name.toLowerCase() === this.levelUpConfig.channelName.toLowerCase() &&
                        ch.permissionsFor(guild.members.me).has(['SendMessages', 'EmbedLinks'])
                    );
                    this.debugXPLog(`🔍 Looking for level up channel by name: ${this.levelUpConfig.channelName}`);
                }
                
                // If still no channel, try to find a general channel
                if (!channel) {
                    channel = guild.channels.cache.find(ch => 
                        ch.type === 0 && // Text channel
                        ch.permissionsFor(guild.members.me).has(['SendMessages', 'EmbedLinks']) &&
                        (ch.name.includes('general') || ch.name.includes('chat') || ch.name.includes('level') || ch.name.includes('bounty'))
                    );
                    this.debugXPLog(`🔍 Looking for fallback level up channel`);
                }
                
                if (channel) {
                    this.debugXPLog(`📢 Sending level up message to channel: ${channel.name}`);
                    
                    // Get bounty amount for current level
                    const bountyAmount = this.getBountyForLevel(newLevel);
                    const oldBountyAmount = this.getBountyForLevel(oldLevel);
                    
                    let message = this.levelUpConfig.message
                        .replace('{user}', this.levelUpConfig.pingUser ? `<@${userId}>` : user.user.username)
                        .replace('{level}', newLevel.toString())
                        .replace('{oldlevel}', oldLevel.toString())
                        .replace('{bounty}', `₿${bountyAmount}`)
                        .replace('{oldbounty}', `₿${oldBountyAmount}`);
                    
                    const embed = new EmbedBuilder()
                        .setColor('#FF6B00') // Orange like One Piece
                        .setTitle('🏴‍☠️ BOUNTY UPDATE!')
                        .setDescription(message)
                        .setThumbnail(user.user.displayAvatarURL())
                        .setTimestamp()
                        .setFooter({ text: 'World Government • Marine Headquarters' });
                    
                    if (this.levelUpConfig.showProgress) {
                        embed.addFields(
                            { name: '⚔️ Previous Bounty', value: `₿${oldBountyAmount}`, inline: true },
                            { name: '💰 New Bounty', value: `₿${bountyAmount}`, inline: true },
                            { name: '🏴‍☠️ Pirate Level', value: `${newLevel}`, inline: true }
                        );
                    }
                    
                    if (this.levelUpConfig.showXP) {
                        const userData = await this.db.query(
                            'SELECT total_xp FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                            [userId, guildId]
                        );
                        if (userData.rows.length > 0) {
                            embed.addFields({ name: '⭐ Total Reputation', value: userData.rows[0].total_xp.toLocaleString(), inline: true });
                        }
                    }
                    
                    if (this.levelUpConfig.showRole && this.levelRoles[newLevel]) {
                        const role = guild.roles.cache.get(this.levelRoles[newLevel]);
                        if (role) {
                            embed.addFields({ name: '🎖️ New Title', value: role.name, inline: true });
                        }
                    }
                    
                    // Add One Piece flavor text based on level
                    const flavorText = this.getFlavorTextForLevel(newLevel);
                    if (flavorText) {
                        embed.addFields({ name: '📰 Marine Report', value: flavorText, inline: false });
                    }
                    
                    await channel.send({ embeds: [embed] });
                    this.debugXPLog(`✅ Level up message sent successfully`);
                } else {
                    this.debugXPLog(`⚠️ No suitable channel found for level up message`);
                }
            }
        } catch (error) {
            console.error('❌ Level up handling error:', error);
            this.debugXPLog(`❌ Level up handling error:`, error);
        }
    }

    async getGuildSettings(guildId) {
        try {
            this.debugDatabaseLog(`Fetching guild settings for ${guildId}`);
            
            const result = await this.db.query(
                'SELECT * FROM guild_settings WHERE guild_id = $1',
                [guildId]
            );
            
            if (result.rows.length === 0) {
                this.debugDatabaseLog(`Creating default guild settings for ${guildId}`);
                
                // Create default settings
                await this.db.query(`
                    INSERT INTO guild_settings (guild_id, level_roles, xp_multiplier, voice_xp_rate, message_xp_min, message_xp_max, reaction_xp)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [guildId, JSON.stringify({}), 1.0, 1, 15, 25, 5]);
                
                return {
                    level_roles: {},
                    xp_multiplier: 1.0,
                    voice_xp_rate: 1,
                    message_xp_min: 15,
                    message_xp_max: 25,
                    reaction_xp: 5,
                    level_up_channel: null
                };
            }
            
            this.debugDatabaseLog(`Guild settings retrieved successfully`);
            return result.rows[0];
        } catch (error) {
            console.error('❌ Get guild settings error:', error);
            this.debugDatabaseLog(`❌ Get guild settings error:`, error);
            return {
                level_roles: {},
                xp_multiplier: 1.0,
                voice_xp_rate: 1,
                message_xp_min: 15,
                message_xp_max: 25,
                reaction_xp: 5,
                level_up_channel: null
            };
        }
    }

    async handleLevelCommand(interaction) {
        this.debugCommandLog(`Handling /level command`);
        
        const targetUser = interaction.options.getUser('user') || interaction.user;
        
        const result = await this.db.query(
            'SELECT * FROM user_levels WHERE user_id = $1 AND guild_id = $2',
            [targetUser.id, interaction.guild.id]
        );
        
        if (result.rows.length === 0) {
            return await interaction.reply({ 
                content: `${targetUser.username} hasn't started their pirate journey yet! 🏴‍☠️`, 
                flags: 64 // MessageFlags.Ephemeral
            });
        }
        
        const userData = result.rows[0];
        const currentLevelXP = this.calculateXPForLevel(userData.level);
        const nextLevelXP = this.calculateXPForLevel(userData.level + 1);
        const progressXP = userData.total_xp - currentLevelXP;
        const neededXP = nextLevelXP - currentLevelXP;
        const bountyAmount = this.getBountyForLevel(userData.level);
        
        // Handle level 0 display
        const bountyDisplay = userData.level === 0 ? 'No Bounty Yet' : `₿${bountyAmount}`;
        const statusText = userData.level === 0 ? 'Rookie' : `Level ${userData.level} Pirate`;
        
        const embed = new EmbedBuilder()
            .setColor(userData.level === 0 ? '#95a5a6' : '#FF6B00')
            .setTitle(`🏴‍☠️ ${targetUser.username}'s ${userData.level === 0 ? 'Rookie Profile' : 'Bounty Poster'}`)
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields(
                { name: '💰 Current Bounty', value: bountyDisplay, inline: true },
                { name: '⚔️ Status', value: statusText, inline: true },
                { name: '⭐ Total Reputation', value: userData.total_xp.toLocaleString(), inline: true },
                { name: '📈 Progress to Next Level', value: `${progressXP.toLocaleString()}/${neededXP.toLocaleString()} Rep`, inline: true },
                { name: '💬 Messages Sent', value: userData.messages.toLocaleString(), inline: true },
                { name: '👍 Reactions Given', value: userData.reactions.toLocaleString(), inline: true },
                { name: '🎤 Voice Activity', value: `${Math.floor(userData.voice_time / 60)}h ${userData.voice_time % 60}m`, inline: true }
            )
            .setFooter({ text: userData.level === 0 ? 'ROOKIE • WORLD GOVERNMENT MONITORING' : 'WANTED • DEAD OR ALIVE • World Government' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }

    async handleLeaderboardCommand(interaction) {
        this.debugCommandLog(`Handling /leaderboard command`);
        
        try {
            const guild = interaction.guild;
            const excludeRoleId = this.leaderboardConfig.excludeRole;
            
            // Get leaderboard data - fetch more to account for excluded members
            const result = await this.db.query(
                'SELECT user_id, level, total_xp FROM user_levels WHERE guild_id = $1 ORDER BY total_xp DESC LIMIT 25',
                [interaction.guild.id]
            );
            
            if (result.rows.length === 0) {
                return await interaction.reply({ 
                    content: 'No pirates have started their journey yet! 🏴‍☠️', 
                    flags: 64 // MessageFlags.Ephemeral
                });
            }

            // Separate excluded (Pirate King) and regular pirates
            let pirateEmperors = [];
            let regularPirates = [];
            
            for (const userData of result.rows) {
                try {
                    const member = await guild.members.fetch(userData.user_id);
                    
                    // Check if user has excluded role (Pirate King)
                    if (excludeRoleId && member.roles.cache.has(excludeRoleId)) {
                        pirateEmperors.push({
                            member,
                            level: userData.level,
                            totalXp: userData.total_xp
                        });
                    } else {
                        regularPirates.push({
                            member,
                            level: userData.level,
                            totalXp: userData.total_xp
                        });
                    }
                } catch (error) {
                    // User left server, skip
                    continue;
                }
            }

            // Limit regular pirates to top 10
            regularPirates = regularPirates.slice(0, 10);

            if (pirateEmperors.length === 0 && regularPirates.length === 0) {
                return await interaction.reply({ 
                    content: 'No eligible pirates found for the leaderboard! 🏴‍☠️', 
                    flags: 64 // MessageFlags.Ephemeral
                });
            }

            // Update top player role (only for regular pirates)
            if (regularPirates.length > 0) {
                await this.updateTopPlayerRole(guild, regularPirates[0].member);
            }

            // Create leaderboard embed with One Piece bounty theme
            const embed = new EmbedBuilder()
                .setColor('#D4AF37') // Gold color like bounty posters
                .setTitle('📰 WORLD ECONOMIC NEWS PAPER 📰')
                .setDescription('**═══════════════════════════════════**\n🚨 **EMERGENCY BOUNTY UPDATE** 🚨\n**═══════════════════════════════════**')
                .setFooter({ 
                    text: '⚖️ WORLD GOVERNMENT OFFICIAL PUBLICATION ⚖️ • MARINE HEADQUARTERS'
                })
                .setTimestamp();
            
            let description = '```\n╔═══════════════════════════════════╗\n║        MOST WANTED CRIMINALS      ║\n║     DEAD OR ALIVE - REWARD SET    ║\n╚═══════════════════════════════════╝\n```\n\n';

            // Add Pirate Emperors section if any exist
            if (pirateEmperors.length > 0) {
                description += '```diff\n+ ═══════ 👑 PIRATE KING 👑 ═══════\n```\n\n';
                
                for (let i = 0; i < pirateEmperors.length; i++) {
                    const userData = pirateEmperors[i];
                    const bountyAmount = this.getBountyForLevel(userData.level);
                    
                    description += '```yaml\n';
                    description += `WANTED: ${userData.member.user.username.toUpperCase()}\n`;
                    description += `BOUNTY: ₿${bountyAmount}\n`;
                    description += `THREAT LEVEL: EXTREME\n`;
                    description += `STATUS: PIRATE KING\n`;
                    description += '```\n';
                    description += `⚔️ **Level ${userData.level}** | ⭐ **${userData.totalXp.toLocaleString()} Rep**\n\n`;
                }
                
                description += '```\n═══════════════════════════════════\n```\n\n';
            }

            // Add regular competition section
            if (regularPirates.length > 0) {
                description += '```diff\n- ═══════ 🏆 ACTIVE BOUNTIES 🏆 ═══════\n```\n\n';
                
                for (let i = 0; i < regularPirates.length; i++) {
                    const userData = regularPirates[i];
                    const bountyAmount = this.getBountyForLevel(userData.level);
                    
                    let rankEmoji;
                    let threat;
                    if (i === 0) {
                        rankEmoji = '🥇';
                        threat = 'EXTREMELY DANGEROUS';
                    } else if (i === 1) {
                        rankEmoji = '🥈';
                        threat = 'HIGHLY DANGEROUS';
                    } else if (i === 2) {
                        rankEmoji = '🥉';
                        threat = 'VERY DANGEROUS';
                    } else {
                        rankEmoji = `**${i + 1}.**`;
                        threat = 'DANGEROUS';
                    }
                    
                    description += '```css\n';
                    description += `[RANK ${i + 1}] ${userData.member.user.username.toUpperCase()}\n`;
                    description += `BOUNTY: ₿${bountyAmount}\n`;
                    description += `THREAT: ${threat}\n`;
                    description += '```\n';
                    description += `${rankEmoji} ⚔️ **Level ${userData.level}** | ⭐ **${userData.totalXp.toLocaleString()} Rep**\n\n`;
                }
            }
            
            // Add footer info about sections
            description += '```\n╔═══════════════════════════════════╗\n║  REPORT SIGHTINGS TO YOUR LOCAL   ║\n║        MARINE BASE IMMEDIATELY    ║\n╚═══════════════════════════════════╝\n```\n';
            
            embed.setDescription(description);
            
            // Dynamic footer based on content
            let footerText = '⚖️ WORLD GOVERNMENT OFFICIAL PUBLICATION ⚖️ • MARINE HEADQUARTERS';
            if (pirateEmperors.length > 0) {
                const kingText = pirateEmperors.length === 1 ? 'Pirate King reigns' : 'Pirate Kings reign';
                footerText = `🚨 ALERT: ${kingText} supreme! 🚨 • ${footerText}`;
            }
            embed.setFooter({ text: footerText });

            await interaction.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('❌ Leaderboard command error:', error);
            this.debugCommandLog(`❌ Leaderboard command error:`, error);
            await interaction.reply({ 
                content: 'An error occurred while fetching the leaderboard.', 
                flags: 64 // MessageFlags.Ephemeral
            });
        }
    }

    async updateTopPlayerRole(guild, topMember) {
        try {
            const topRoleId = this.leaderboardConfig.topRole;
            if (!topRoleId) return; // No top role configured
            
            const topRole = guild.roles.cache.get(topRoleId);
            if (!topRole) return; // Role doesn't exist
            
            // Remove the role from everyone who currently has it
            const membersWithRole = guild.members.cache.filter(member => member.roles.cache.has(topRoleId));
            for (const [, member] of membersWithRole) {
                if (member.id !== topMember.id) {
                    await member.roles.remove(topRole);
                    this.debugCommandLog(`Removed top role from ${member.user.username}`);
                }
            }
            
            // Give the role to the current #1 player
            if (!topMember.roles.cache.has(topRoleId)) {
                await topMember.roles.add(topRole);
                this.debugCommandLog(`Assigned top role to ${topMember.user.username}`);
            }
            
        } catch (error) {
            console.error('❌ Error updating top player role:', error);
            this.debugCommandLog(`❌ Error updating top player role:`, error);
        }
    }

    async handleSetLevelRoleCommand(interaction) {
        this.debugCommandLog(`Handling /setlevelrole command`);
        
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return await interaction.reply({ 
                content: 'You need the "Manage Roles" permission to use this command.', 
                flags: 64 // MessageFlags.Ephemeral
            });
        }
        
        const level = interaction.options.getInteger('level');
        const role = interaction.options.getRole('role');
        
        if (![5, 10, 15, 20, 25, 30, 35, 40, 45, 50].includes(level)) {
            return await interaction.reply({ 
                content: 'Level must be one of: 5, 10, 15, 20, 25, 30, 35, 40, 45, 50', 
                flags: 64 // MessageFlags.Ephemeral
            });
        }
        
        const settings = await this.getGuildSettings(interaction.guild.id);
        settings.level_roles[level] = role ? role.id : null;
        
        await this.db.query(
            'UPDATE guild_settings SET level_roles = $1 WHERE guild_id = $2',
            [JSON.stringify(settings.level_roles), interaction.guild.id]
        );
        
        const message = role 
            ? `Level ${level} role set to ${role.name}`
            : `Level ${level} role removed`;
            
        await interaction.reply({ 
            content: message, 
            flags: 64 // MessageFlags.Ephemeral
        });
    }

    async handleLevelRolesCommand(interaction) {
        this.debugCommandLog(`Handling /levelroles command`);
        
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Level Roles Configuration')
            .setTimestamp();
        
        let description = '';
        for (const [level, roleId] of Object.entries(this.levelRoles)) {
            const role = roleId ? interaction.guild.roles.cache.get(roleId) : null;
            const roleName = role ? role.name : 'Not Set';
            description += `Level ${level}: ${roleName}\n`;
        }
        
        embed.setDescription(description || 'No level roles configured via environment variables');
        embed.setFooter({ text: 'Configure roles using Railway environment variables (LEVEL_X_ROLE)' });
        
        await interaction.reply({ embeds: [embed] });
    }

    async handleSettingsCommand(interaction) {
        this.debugCommandLog(`Handling /settings command`);
        
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🔧 Server Leveling Settings')
            .setTimestamp();
        
        // XP Settings
        embed.addFields(
            { name: '💬 Message XP', value: `${this.config.messageXPMin}-${this.config.messageXPMax} (${this.config.messageCooldown/1000}s cooldown)`, inline: true },
            { name: '👍 Reaction XP', value: `${this.config.reactionXPMin}-${this.config.reactionXPMax} (${this.config.reactionCooldown/1000}s cooldown)`, inline: true },
            { name: '🎤 Voice XP', value: `${this.config.voiceXPMin}-${this.config.voiceXPMax}/min (${this.config.voiceCooldown/1000}s cooldown)`, inline: true },
            { name: '📊 Formula', value: `${this.config.formulaCurve} (×${this.config.formulaMultiplier})`, inline: true },
            { name: '🎯 Max Level', value: this.config.maxLevel.toString(), inline: true },
            { name: '✨ XP Multiplier', value: `×${this.config.xpMultiplier}`, inline: true }
        );
        
        // Voice Settings
        embed.addFields(
            { name: '🔊 Voice Requirements', value: `Min ${this.config.voiceMinMembers} members\nAFK Detection: ${this.config.voiceAntiAFK ? '✅' : '❌'}`, inline: true }
        );
        
        // Level Up Settings
        embed.addFields(
            { name: '🎉 Level Up Messages', value: `${this.levelUpConfig.enabled ? '✅ Enabled' : '❌ Disabled'}\nPing User: ${this.levelUpConfig.pingUser ? '✅' : '❌'}`, inline: true }
        );
        
        // Debug Settings
        embed.addFields(
            { name: '🐛 Debug Status', value: `Main: ${this.debugMode ? '✅' : '❌'}\nVoice: ${this.debugVoice ? '✅' : '❌'}\nXP: ${this.debugXP ? '✅' : '❌'}\nDB: ${this.debugDatabase ? '✅' : '❌'}\nCmds: ${this.debugCommands ? '✅' : '❌'}`, inline: true }
        );
        
        // Level Roles
        let rolesText = '';
        let roleCount = 0;
        for (const [level, roleId] of Object.entries(this.levelRoles)) {
            if (roleId) {
                const role = interaction.guild.roles.cache.get(roleId);
                if (role && roleCount < 5) { // Show max 5 roles
                    rolesText += `Level ${level}: ${role.name}\n`;
                    roleCount++;
                }
            }
        }
        
        if (rolesText) {
            embed.addFields({ name: '🏆 Level Roles', value: rolesText + (roleCount === 5 ? '...' : ''), inline: false });
        }
        
        await interaction.reply({ embeds: [embed] });
    }

    async handleReloadCommand(interaction) {
        this.debugCommandLog(`Handling /reload command`);
        
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return await interaction.reply({ 
                content: 'You need the "Manage Server" permission to use this command.', 
                flags: 64 // MessageFlags.Ephemeral
            });
        }
        
        // Reload configuration from environment variables
        this.debugMode = process.env.DEBUG_MODE === 'true' || false;
        this.debugVoice = process.env.DEBUG_VOICE === 'true' || false;
        this.debugXP = process.env.DEBUG_XP === 'true' || false;
        this.debugDatabase = process.env.DEBUG_DATABASE === 'true' || false;
        this.debugCommands = process.env.DEBUG_COMMANDS === 'true' || false;
        
        this.config = {
            // Message XP
            messageXPMin: parseInt(process.env.MESSAGE_XP_MIN) || 25,
            messageXPMax: parseInt(process.env.MESSAGE_XP_MAX) || 35,
            messageCooldown: parseInt(process.env.MESSAGE_COOLDOWN) || 60000,
            
            // Voice XP  
            voiceXPMin: parseInt(process.env.VOICE_XP_MIN) || 45,
            voiceXPMax: parseInt(process.env.VOICE_XP_MAX) || 55,
            voiceCooldown: parseInt(process.env.VOICE_COOLDOWN) || 180000,
            voiceMinMembers: parseInt(process.env.VOICE_MIN_MEMBERS) || 2,
            voiceAntiAFK: process.env.VOICE_ANTI_AFK === 'true' || true,
            
            // Reaction XP
            reactionXPMin: parseInt(process.env.REACTION_XP_MIN) || 25,
            reactionXPMax: parseInt(process.env.REACTION_XP_MAX) || 35,
            reactionCooldown: parseInt(process.env.REACTION_COOLDOWN) || 300000,
            
            // Formula settings
            formulaCurve: process.env.FORMULA_CURVE || 'exponential',
            formulaMultiplier: parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75,
            maxLevel: parseInt(process.env.MAX_LEVEL) || 50,
            
            // Global settings
            xpMultiplier: parseFloat(process.env.XP_MULTIPLIER) || 1.0
        };

        this.levelRoles = {
            0: process.env.LEVEL_0_ROLE || null,
            5: process.env.LEVEL_5_ROLE || null,
            10: process.env.LEVEL_10_ROLE || null,
            15: process.env.LEVEL_15_ROLE || null,
            20: process.env.LEVEL_20_ROLE || null,
            25: process.env.LEVEL_25_ROLE || null,
            30: process.env.LEVEL_30_ROLE || null,
            35: process.env.LEVEL_35_ROLE || null,
            40: process.env.LEVEL_40_ROLE || null,
            45: process.env.LEVEL_45_ROLE || null,
            50: process.env.LEVEL_50_ROLE || null
        };
        
        this.levelUpConfig = {
            enabled: process.env.LEVELUP_ENABLED !== 'false',
            channel: process.env.LEVELUP_CHANNEL || null,
            channelName: process.env.LEVELUP_CHANNEL_NAME || null,
            message: process.env.LEVELUP_MESSAGE || '⚡ **BREAKING NEWS!** ⚡\n📰 *World Economic News* reports that **{user}** has become a more notorious pirate!\n\n💰 **NEW BOUNTY:** {bounty}\n⚔️ **THREAT LEVEL:** Level {level} Pirate\n\n*The World Government has issued an updated wanted poster!*',
            showXP: process.env.LEVELUP_SHOW_XP !== 'false',
            showProgressconst { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, ActivityType } = require('discord.js');
const { Pool } = require('pg');
require('dotenv').config();

class LevelingBot {
    constructor() {
        // Debug configuration from environment variables
        this.debugMode = process.env.DEBUG_MODE === 'true' || false;
        this.debugVoice = process.env.DEBUG_VOICE === 'true' || false;
        this.debugXP = process.env.DEBUG_XP === 'true' || false;
        this.debugDatabase = process.env.DEBUG_DATABASE === 'true' || false;
        this.debugCommands = process.env.DEBUG_COMMANDS === 'true' || false;

        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMembers
            ]
        });

        // PostgreSQL connection
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });

        // Voice tracking
        this.voiceTracker = new Map();
        
        // Cooldown tracking (prevent spam)
        this.messageCooldowns = new Map();
        this.reactionCooldowns = new Map();

        // XP Configuration from environment variables
        this.config = {
            // Message XP
            messageXPMin: parseInt(process.env.MESSAGE_XP_MIN) || 25,
            messageXPMax: parseInt(process.env.MESSAGE_XP_MAX) || 35,
            messageCooldown: parseInt(process.env.MESSAGE_COOLDOWN) || 60000, // 60 seconds
            
            // Voice XP  
            voiceXPMin: parseInt(process.env.VOICE_XP_MIN) || 45,
            voiceXPMax: parseInt(process.env.VOICE_XP_MAX) || 55,
            voiceCooldown: parseInt(process.env.VOICE_COOLDOWN) || 180000, // 180 seconds
            voiceMinMembers: parseInt(process.env.VOICE_MIN_MEMBERS) || 2,
            voiceAntiAFK: process.env.VOICE_ANTI_AFK === 'true' || true,
            
            // Reaction XP
            reactionXPMin: parseInt(process.env.REACTION_XP_MIN) || 25,
            reactionXPMax: parseInt(process.env.REACTION_XP_MAX) || 35,
            reactionCooldown: parseInt(process.env.REACTION_COOLDOWN) || 300000, // 300 seconds
            
            // Formula settings
            formulaCurve: process.env.FORMULA_CURVE || 'exponential', // 'linear', 'exponential', 'logarithmic'
            formulaMultiplier: parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75,
            maxLevel: parseInt(process.env.MAX_LEVEL) || 50,
            
            // Global settings
            xpMultiplier: parseFloat(process.env.XP_MULTIPLIER) || 1.0
        };

        // Level roles from environment variables
        this.levelRoles = {
            0: process.env.LEVEL_0_ROLE || null,  // Starter role
            5: process.env.LEVEL_5_ROLE || null,
            10: process.env.LEVEL_10_ROLE || null,
            15: process.env.LEVEL_15_ROLE || null,
            20: process.env.LEVEL_20_ROLE || null,
            25: process.env.LEVEL_25_ROLE || null,
            30: process.env.LEVEL_30_ROLE || null,
            35: process.env.LEVEL_35_ROLE || null,
            40: process.env.LEVEL_40_ROLE || null,
            45: process.env.LEVEL_45_ROLE || null,
            50: process.env.LEVEL_50_ROLE || null
        };

        // Level up message configuration with One Piece theme
        this.levelUpConfig = {
            enabled: process.env.LEVELUP_ENABLED !== 'false',
            channel: process.env.LEVELUP_CHANNEL || null,
            channelName: process.env.LEVELUP_CHANNEL_NAME || null,
            message: process.env.LEVELUP_MESSAGE || '⚡ **BREAKING NEWS!** ⚡\n📰 *World Economic News* reports that **{user}** has become a more notorious pirate!\n\n💰 **NEW BOUNTY:** {bounty}\n⚔️ **THREAT LEVEL:** Level {level} Pirate\n\n*The World Government has issued an updated wanted poster!*',
            showXP: process.env.LEVELUP_SHOW_XP !== 'false',
            showProgress: process.env.LEVELUP_SHOW_PROGRESS !== 'false',
            showRole: process.env.LEVELUP_SHOW_ROLE !== 'false',
            pingUser: process.env.LEVELUP_PING_USER === 'true' || false
        };

        this.leaderboardConfig = {
            topRole: process.env.LEADERBOARD_TOP_ROLE || null,
            excludeRole: process.env.LEADERBOARD_EXCLUDE_ROLE || null
        };
        
        this.debugLog('🔄', 'Configuration reloaded from environment variables');
        this.debugLog('🤖', 'Updated config:', this.config);
        this.debugLog('🏆', 'Updated level roles:', this.levelRoles);
        this.debugLog('🎉', 'Updated level up config:', this.levelUpConfig);
        this.debugLog('🥇', 'Updated leaderboard config:', this.leaderboardConfig);
        
        await interaction.reply({ 
            content: '✅ Configuration reloaded from environment variables!\n' +
                     `🐛 Debug mode: ${this.debugMode ? 'ON' : 'OFF'}\n` +
                     `🎤 Voice debug: ${this.debugVoice ? 'ON' : 'OFF'}\n` +
                     `💫 XP debug: ${this.debugXP ? 'ON' : 'OFF'}\n` +
                     `🗄️ Database debug: ${this.debugDatabase ? 'ON' : 'OFF'}\n` +
                     `⚡ Commands debug: ${this.debugCommands ? 'ON' : 'OFF'}`, 
            flags: 64 // MessageFlags.Ephemeral
        });
    }

    async handleInitRookiesCommand(interaction) {
        this.debugCommandLog(`Handling /initrookies command`);
        
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ 
                content: 'You need the "Administrator" permission to use this command.', 
                flags: 64 // MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply();

        try {
            const guild = interaction.guild;
            const level0RoleId = this.levelRoles[0];
            
            if (!level0RoleId) {
                return await interaction.editReply({ content: '❌ Level 0 role not configured! Set LEVEL_0_ROLE in environment variables.' });
            }

            const level0Role = guild.roles.cache.get(level0RoleId);
            if (!level0Role) {
                return await interaction.editReply({ content: '❌ Level 0 role not found! Check the role ID in environment variables.' });
            }

            // Get all bounty role IDs
            const bountyRoleIds = Object.values(this.levelRoles).filter(id => id !== null);
            
            // Fetch all guild members
            await guild.members.fetch();
            
            let processedCount = 0;
            let assignedCount = 0;
            let errorCount = 0;

            const embed = new EmbedBuilder()
                .setColor('#FF6B00')
                .setTitle('🏴‍☠️ Initializing Rookie Pirates...')
                .setDescription('Processing server members...')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            for (const [userId, member] of guild.members.cache) {
                processedCount++;
                
                // Skip bots
                if (member.user.bot) {
                    this.debugCommandLog(`Skipping bot: ${member.user.username}`);
                    continue;
                }

                // Check if user already has any bounty role
                const hasBountyRole = member.roles.cache.some(role => bountyRoleIds.includes(role.id));
                
                // If they don't have any bounty role, give them Level 0
                if (!hasBountyRole) {
                    try {
                        await member.roles.add(level0Role);
                        assignedCount++;
                        this.debugCommandLog(`Assigned Level 0 role to ${member.user.username}`);
                    } catch (error) {
                        errorCount++;
                        console.error(`Failed to assign role to ${member.user.username}:`, error);
                        this.debugCommandLog(`Failed to assign role to ${member.user.username}:`, error.message);
                    }
                } else {
                    this.debugCommandLog(`${member.user.username} already has a bounty role`);
                }

                // Update progress every 50 members
                if (processedCount % 50 === 0) {
                    const progressEmbed = new EmbedBuilder()
                        .setColor('#FF6B00')
                        .setTitle('🏴‍☠️ Initializing Rookie Pirates...')
                        .setDescription(`Processed: ${processedCount} members\nAssigned: ${assignedCount} rookies`)
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [progressEmbed] });
                }
            }

            // Final result
            const resultEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Rookie Initialization Complete!')
                .addFields(
                    { name: '👥 Total Members Processed', value: processedCount.toString(), inline: true },
                    { name: '🆕 New Rookies Assigned', value: assignedCount.toString(), inline: true },
                    { name: '❌ Errors', value: errorCount.toString(), inline: true },
                    { name: '🏴‍☠️ Role Assigned', value: level0Role.name, inline: false }
                )
                .setFooter({ text: 'All eligible members now have bounty roles!' })
                .setTimestamp();

            await interaction.editReply({ embeds: [resultEmbed] });

        } catch (error) {
            console.error('❌ Init rookies command error:', error);
            this.debugCommandLog(`❌ Init rookies command error:`, error);
            await interaction.editReply({ content: '❌ An error occurred while initializing rookies. Check console for details.' });
        }
    }

    async handleDebugCommand(interaction) {
        this.debugCommandLog(`Handling /debug command`);
        
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return await interaction.reply({ 
                content: 'You need the "Manage Server" permission to use this command.', 
                flags: 64 // MessageFlags.Ephemeral
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const enabled = interaction.options.getBoolean('enabled');

        switch (subcommand) {
            case 'all':
                this.debugMode = enabled;
                this.debugVoice = enabled;
                this.debugXP = enabled;
                this.debugDatabase = enabled;
                this.debugCommands = enabled;
                break;
            case 'voice':
                this.debugVoice = enabled;
                break;
            case 'xp':
                this.debugXP = enabled;
                break;
            case 'database':
                this.debugDatabase = enabled;
                break;
            case 'commands':
                this.debugCommands = enabled;
                break;
            case 'status':
                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('🐛 Debug Status')
                    .addFields(
                        { name: '🤖 Main Debug', value: this.debugMode ? '✅ ON' : '❌ OFF', inline: true },
                        { name: '🎤 Voice Debug', value: this.debugVoice ? '✅ ON' : '❌ OFF', inline: true },
                        { name: '💫 XP Debug', value: this.debugXP ? '✅ ON' : '❌ OFF', inline: true },
                        { name: '🗄️ Database Debug', value: this.debugDatabase ? '✅ ON' : '❌ OFF', inline: true },
                        { name: '⚡ Commands Debug', value: this.debugCommands ? '✅ ON' : '❌ OFF', inline: true }
                    )
                    .setFooter({ text: 'Use /debug <category> <true/false> to toggle debugging' })
                    .setTimestamp();
                
                return await interaction.reply({ embeds: [embed], flags: 64 });
        }

        const statusText = enabled ? 'enabled' : 'disabled';
        const emoji = enabled ? '✅' : '❌';
        
        await interaction.reply({ 
            content: `${emoji} Debug ${subcommand} ${statusText}!`, 
            flags: 64 // MessageFlags.Ephemeral
        });
    }

    setupCommands() {
        const commands = [
            new SlashCommandBuilder()
                .setName('level')
                .setDescription('Check your or someone else\'s level')
                .addUserOption(option => 
                    option.setName('user')
                        .setDescription('The user to check')
                        .setRequired(false)
                ),
            
            new SlashCommandBuilder()
                .setName('leaderboard')
                .setDescription('View the server leaderboard'),
            
            new SlashCommandBuilder()
                .setName('setlevelrole')
                .setDescription('Set a role reward for a specific level')
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('The level (5, 10, 15, 20, 25, 30, 35, 40, 45, 50)')
                        .setRequired(true)
                        .addChoices(
                            { name: '5', value: 5 },
                            { name: '10', value: 10 },
                            { name: '15', value: 15 },
                            { name: '20', value: 20 },
                            { name: '25', value: 25 },
                            { name: '30', value: 30 },
                            { name: '35', value: 35 },
                            { name: '40', value: 40 },
                            { name: '45', value: 45 },
                            { name: '50', value: 50 }
                        )
                )
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to give (leave empty to remove)')
                        .setRequired(false)
                )
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
            
            new SlashCommandBuilder()
                .setName('levelroles')
                .setDescription('View all configured level roles'),
            
            new SlashCommandBuilder()
                .setName('settings')
                .setDescription('View server leveling settings'),
            
            new SlashCommandBuilder()
                .setName('reload')
                .setDescription('Reload configuration from environment variables')
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

            new SlashCommandBuilder()
                .setName('initrookies')
                .setDescription('Assign Level 0 role to all members without bounty roles')
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

            new SlashCommandBuilder()
                .setName('debug')
                .setDescription('Toggle debug logging for different components')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('all')
                        .setDescription('Toggle all debug categories')
                        .addBooleanOption(option =>
                            option.setName('enabled')
                                .setDescription('Enable or disable all debugging')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('voice')
                        .setDescription('Toggle voice XP debugging')
                        .addBooleanOption(option =>
                            option.setName('enabled')
                                .setDescription('Enable or disable voice debugging')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('xp')
                        .setDescription('Toggle XP debugging')
                        .addBooleanOption(option =>
                            option.setName('enabled')
                                .setDescription('Enable or disable XP debugging')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('database')
                        .setDescription('Toggle database debugging')
                        .addBooleanOption(option =>
                            option.setName('enabled')
                                .setDescription('Enable or disable database debugging')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('commands')
                        .setDescription('Toggle commands debugging')
                        .addBooleanOption(option =>
                            option.setName('enabled')
                                .setDescription('Enable or disable commands debugging')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('status')
                        .setDescription('Show current debug status')
                )
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        ];

        this.client.once('ready', async () => {
            try {
                this.debugLog('⚡', 'Registering slash commands...');
                await this.client.application.commands.set(commands);
                this.debugLog('✅', 'Slash commands registered successfully');
            } catch (error) {
                console.error('❌ Error registering commands:', error);
                this.debugLog('❌', 'Error registering commands:', error);
            }
        });
    }

    async start() {
        try {
            this.debugLog('🚀', 'Starting bot...');
            await this.client.login(process.env.DISCORD_TOKEN);
        } catch (error) {
            console.error('❌ Failed to start bot:', error);
            this.debugLog('❌', 'Failed to start bot:', error);
        }
    }
}

// Start the bot
const bot = new LevelingBot();
bot.start();

        // Leaderboard configuration
        this.leaderboardConfig = {
            topRole: process.env.LEADERBOARD_TOP_ROLE || null,
            excludeRole: process.env.LEADERBOARD_EXCLUDE_ROLE || null
        };

        this.debugLog('🤖', 'Bot Configuration:', this.config);
        this.debugLog('🏆', 'Level Roles:', this.levelRoles);
        this.debugLog('🎉', 'Level Up Config:', this.levelUpConfig);
        this.debugLog('🥇', 'Leaderboard Config:', this.leaderboardConfig);

        this.initializeDatabase();
        this.setupEventHandlers();
        this.setupCommands();
    }

    // Enhanced debug logging system
    debugLog(category, ...args) {
        if (!this.debugMode) return;
        
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${category}`, ...args);
    }

    debugVoiceLog(...args) {
        if (!this.debugVoice) return;
        this.debugLog('🎤', ...args);
    }

    debugXPLog(...args) {
        if (!this.debugXP) return;
        this.debugLog('💫', ...args);
    }

    debugDatabaseLog(...args) {
        if (!this.debugDatabase) return;
        this.debugLog('🗄️', ...args);
    }

    debugCommandLog(...args) {
        if (!this.debugCommands) return;
        this.debugLog('⚡', ...args);
    }

    async initializeDatabase() {
        try {
            this.debugDatabaseLog('Initializing database tables...');
            
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS user_levels (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    guild_id TEXT NOT NULL,
                    messages INTEGER DEFAULT 0,
                    reactions INTEGER DEFAULT 0,
                    voice_time INTEGER DEFAULT 0,
                    total_xp BIGINT DEFAULT 0,
                    level INTEGER DEFAULT 0,
                    last_message_time DATE DEFAULT CURRENT_DATE,
                    last_reaction_time DATE DEFAULT CURRENT_DATE,
                    UNIQUE(user_id, guild_id)
                );
            `);

            await this.db.query(`
                CREATE TABLE IF NOT EXISTS guild_settings (
                    guild_id TEXT PRIMARY KEY,
                    level_roles JSON DEFAULT '{}',
                    xp_multiplier REAL DEFAULT 1.0,
                    voice_xp_rate INTEGER DEFAULT 1,
                    message_xp_min INTEGER DEFAULT 15,
                    message_xp_max INTEGER DEFAULT 25,
                    reaction_xp INTEGER DEFAULT 5,
                    level_up_channel TEXT,
                    created_at DATE DEFAULT CURRENT_DATE
                );
            `);

            await this.db.query(`
                CREATE TABLE IF NOT EXISTS voice_sessions (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    guild_id TEXT NOT NULL,
                    start_time DATE DEFAULT CURRENT_DATE,
                    end_time DATE,
                    duration INTEGER DEFAULT 0
                );
            `);

            this.debugDatabaseLog('✅ Database tables initialized successfully');
        } catch (error) {
            console.error('❌ Database initialization error:', error);
        }
    }

    setupEventHandlers() {
        this.client.once('ready', () => {
            console.log(`✅ Logged in as ${this.client.user.tag}`);
            this.debugLog('🚀', `Bot started with debug mode: ${this.debugMode ? 'ON' : 'OFF'}`);
            this.debugLog('🎤', `Voice debug: ${this.debugVoice ? 'ON' : 'OFF'}`);
            this.debugLog('💫', `XP debug: ${this.debugXP ? 'ON' : 'OFF'}`);
            this.debugLog('🗄️', `Database debug: ${this.debugDatabase ? 'ON' : 'OFF'}`);
            this.debugLog('⚡', `Commands debug: ${this.debugCommands ? 'ON' : 'OFF'}`);
            
            this.client.user.setActivity('Leveling System', { type: ActivityType.Watching });
        });

        // Message XP
        this.client.on('messageCreate', async (message) => {
            if (message.author.bot || !message.guild) return;
            
            const cooldownKey = `${message.author.id}-${message.guild.id}`;
            const now = Date.now();
            
            this.debugXPLog(`Message from ${message.author.username} in ${message.guild.name}`);
            
            // 60 second cooldown for message XP (configurable)
            if (this.messageCooldowns.has(cooldownKey)) {
                const cooldownEnd = this.messageCooldowns.get(cooldownKey);
                if (now < cooldownEnd) {
                    this.debugXPLog(`❄️ Message XP on cooldown for ${message.author.username} (${Math.ceil((cooldownEnd - now) / 1000)}s remaining)`);
                    return;
                }
            }
            
            this.messageCooldowns.set(cooldownKey, now + this.config.messageCooldown);
            
            const xpGain = Math.floor(Math.random() * (this.config.messageXPMax - this.config.messageXPMin + 1)) + this.config.messageXPMin;
            this.debugXPLog(`💬 Awarding ${xpGain} XP to ${message.author.username} for message`);
            
            await this.addXP(message.author.id, message.guild.id, xpGain, 'message');
        });

        // Reaction XP
        this.client.on('messageReactionAdd', async (reaction, user) => {
            if (user.bot || !reaction.message.guild) return;
            
            const cooldownKey = `${user.id}-${reaction.message.guild.id}`;
            const now = Date.now();
            
            this.debugXPLog(`Reaction from ${user.username} in ${reaction.message.guild.name}`);
            
            // 30 second cooldown for reaction XP (configurable)
            if (this.reactionCooldowns.has(cooldownKey)) {
                const cooldownEnd = this.reactionCooldowns.get(cooldownKey);
                if (now < cooldownEnd) {
                    this.debugXPLog(`❄️ Reaction XP on cooldown for ${user.username} (${Math.ceil((cooldownEnd - now) / 1000)}s remaining)`);
                    return;
                }
            }
            
            this.reactionCooldowns.set(cooldownKey, now + this.config.reactionCooldown);
            
            const reactionXP = Math.floor(Math.random() * (this.config.reactionXPMax - this.config.reactionXPMin + 1)) + this.config.reactionXPMin;
            this.debugXPLog(`👍 Awarding ${reactionXP} XP to ${user.username} for reaction`);
            
            await this.addXP(user.id, reaction.message.guild.id, reactionXP, 'reaction');
        });

        // Voice XP tracking with AFK detection and ENHANCED DEBUG LOGGING
        this.client.on('voiceStateUpdate', async (oldState, newState) => {
            const userId = newState.id;
            const guildId = newState.guild.id;
            
            this.debugVoiceLog(`Voice State Update: ${newState.member.user.username}`);
            this.debugVoiceLog(`   Old Channel: ${oldState.channelId || 'None'}`);
            this.debugVoiceLog(`   New Channel: ${newState.channelId || 'None'}`);
            
            // User joined a voice channel
            if (!oldState.channelId && newState.channelId) {
                this.debugVoiceLog(`✅ ${newState.member.user.username} JOINED voice channel ${newState.channelId}`);
                const sessionData = {
                    startTime: Date.now(),
                    channelId: newState.channelId,
                    lastActivity: Date.now()
                };
                this.voiceTracker.set(`${userId}-${guildId}`, sessionData);
                this.debugVoiceLog(`   Voice tracker set:`, sessionData);
            }
            
            // User left a voice channel or switched channels
            if (oldState.channelId && (!newState.channelId || oldState.channelId !== newState.channelId)) {
                this.debugVoiceLog(`❌ ${newState.member.user.username} LEFT voice channel ${oldState.channelId}`);
                const session = this.voiceTracker.get(`${userId}-${guildId}`);
                if (session) {
                    const duration = Math.floor((Date.now() - session.startTime) / 1000);
                    this.debugVoiceLog(`   Session duration: ${duration} seconds`);
                    await this.processVoiceXP(userId, guildId, duration, oldState.channelId);
                    this.voiceTracker.delete(`${userId}-${guildId}`);
                } else {
                    this.debugVoiceLog(`   ⚠️  No session found for ${userId}-${guildId}`);
                }
                
                // If switched channels, start new session
                if (newState.channelId && oldState.channelId !== newState.channelId) {
                    this.debugVoiceLog(`🔄 ${newState.member.user.username} SWITCHED to channel ${newState.channelId}`);
                    const sessionData = {
                        startTime: Date.now(),
                        channelId: newState.channelId,
                        lastActivity: Date.now()
                    };
                    this.voiceTracker.set(`${userId}-${guildId}`, sessionData);
                    this.debugVoiceLog(`   New session started:`, sessionData);
                }
            }
            
            // Update activity for AFK detection (mute/deafen changes)
            if (oldState.channelId && newState.channelId && oldState.channelId === newState.channelId) {
                const session = this.voiceTracker.get(`${userId}-${guildId}`);
                if (session) {
                    // Update activity if user unmutes or undeafens
                    if ((oldState.mute && !newState.mute) || (oldState.deaf && !newState.deaf) || 
                        (oldState.selfMute && !newState.selfMute) || (oldState.selfDeaf && !newState.selfDeaf)) {
                        session.lastActivity = Date.now();
                        this.debugVoiceLog(`🔊 ${newState.member.user.username} became active (unmuted/undeafened)`);
                        this.debugVoiceLog(`   Updated session:`, session);
                    }
                }
            }
        });

        // Slash commands
        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            
            this.debugCommandLog(`Command received: /${interaction.commandName} from ${interaction.user.username} in ${interaction.guild?.name}`);
            
            try {
                switch (interaction.commandName) {
                    case 'level':
                        await this.handleLevelCommand(interaction);
                        break;
                    case 'leaderboard':
                        await this.handleLeaderboardCommand(interaction);
                        break;
                    case 'setlevelrole':
                        await this.handleSetLevelRoleCommand(interaction);
                        break;
                    case 'levelroles':
                        await this.handleLevelRolesCommand(interaction);
                        break;
                    case 'settings':
                        await this.handleSettingsCommand(interaction);
                        break;
                    case 'reload':
                        await this.handleReloadCommand(interaction);
                        break;
                    case 'initrookies':
                        await this.handleInitRookiesCommand(interaction);
                        break;
                    case 'debug':
                        await this.handleDebugCommand(interaction);
                        break;
                }
                this.debugCommandLog(`✅ Command /${interaction.commandName} completed successfully`);
            } catch (error) {
                console.error('❌ Command error:', error);
                this.debugCommandLog(`❌ Command /${interaction.commandName} failed:`, error.message);
                await interaction.reply({ 
                    content: 'An error occurred while executing the command.', 
                    flags: 64 // MessageFlags.Ephemeral
                });
            }
        });
    }

    getBountyForLevel(level) {
        // Progressive bounty increase every level, respecting role milestones
        if (level <= 0) return '0';
        
        // Level 1-4: Build up to first role
        if (level === 1) return '5,000,000';
        if (level === 2) return '10,000,000';
        if (level === 3) return '18,000,000';
        if (level === 4) return '25,000,000';
        
        // Level 5-9: Build up to second role  
        if (level === 5) return '30,000,000';    // Role milestone
        if (level === 6) return '38,000,000';
        if (level === 7) return '48,000,000';
        if (level === 8) return '60,000,000';
        if (level === 9) return '75,000,000';
        
        // Level 10-14: Build up to third role
        if (level === 10) return '81,000,000';   // Role milestone
        if (level === 11) return '90,000,000';
        if (level === 12) return '100,000,000';
        if (level === 13) return '110,000,000';
        if (level === 14) return '115,000,000';
        
        // Level 15-19: Build up to fourth role
        if (level === 15) return '120,000,000';  // Role milestone
        if (level === 16) return '135,000,000';
        if (level === 17) return '155,000,000';
        if (level === 18) return '177,000,000';
        if (level === 19) return '190,000,000';
        
        // Level 20-24: Build up to fifth role
        if (level === 20) return '200,000,000';  // Role milestone
        if (level === 21) return '230,000,000';
        if (level === 22) return '260,000,000';
        if (level === 23) return '290,000,000';
        if (level === 24) return '310,000,000';
        
        // Level 25-29: Build up to sixth role
        if (level === 25) return '320,000,000';  // Role milestone
        if (level === 26) return '360,000,000';
        if (level === 27) return '410,000,000';
        if (level === 28) return '450,000,000';
        if (level === 29) return '480,000,000';
        
        // Level 30-34: Build up to seventh role
        if (level === 30) return '500,000,000';  // Role milestone
        if (level === 31) return '580,000,000';
        if (level === 32) return '670,000,000';
        if (level === 33) return '760,000,000';
        if (level === 34) return '820,000,000';
        
        // Level 35-39: Build up to eighth role
        if (level === 35) return '860,000,000';  // Role milestone
        if (level === 36) return '920,000,000';
        if (level === 37) return '980,000,000';
        if (level === 38) return '1,020,000,000';
        if (level === 39) return '1,040,000,000';
        
        // Level 40-44: Build up to ninth role
        if (level === 40) return '1,057,000,000'; // Role milestone
        if (level === 41) return '1,150,000,000';
        if (level === 42) return '1,250,000,000';
        if (level === 43) return '1,350,000,000';
        if (level === 44) return '1,450,000,000';
        
        // Level 45-49: Build up to tenth role
        if (level === 45) return '1,500,000,000'; // Role milestone
        if (level === 46) return '1,800,000,000';
        if (level === 47) return '2,200,000,000';
        if (level === 48) return '2,600,000,000';
        if (level === 49) return '2,900,000,000';
        
        // Level 50+: Yonko territory
        if (level === 50) return '3,000,000,000'; // Role milestone
        if (level <= 55) return `${3000 + (level - 50) * 200},000,000`; // +200M per level
        if (level <= 60) return `${4000 + (level - 55) * 120},000,000`; // +120M per level
        
        // Beyond level 60 - legendary territory
        const baseBounty = 4600000000; // 4.6 billion base
        const multiplier = Math.pow(1.1, level - 60);
        const bounty = Math.floor(baseBounty * multiplier);
        return bounty.toLocaleString();
    }

    getFlavorTextForLevel(level) {
        const flavorTexts = {
            0: "*New individual detected. No criminal activity reported. Continue monitoring.*",
            5: "*Criminal activity confirmed in East Blue region. Initial bounty authorized.*",
            10: "*Multiple incidents involving Marine personnel. Elevated threat status.*",
            15: "*Subject has crossed into Grand Line territory. Enhanced surveillance required.*",
            20: "*Dangerous individual. Multiple Marine casualties reported. Caution advised.*",
            25: "*HIGH PRIORITY TARGET: Classified as extremely dangerous. Deploy specialized units.*",
            30: "*ADVANCED COMBATANT: Confirmed use of advanced fighting techniques. Vice Admiral response.*",
            35: "*TERRITORIAL THREAT: Capable of commanding large operations. Fleet mobilization recommended.*",
            40: "*ELITE LEVEL THREAT: Extreme danger to Marine operations. Admiral consultation required.*",
            45: "*EXTRAORDINARY ABILITIES: Unprecedented power levels detected. Maximum security protocols.*",
            50: "*EMPEROR CLASS THREAT: Controls vast territories. Considered one of the most dangerous pirates.*",
            55: "*LEGENDARY THREAT LEVEL: Power exceeds known classifications. Ultimate priority target.*",
            60: "*WORLD-LEVEL THREAT: Potential to challenge global balance. All resources authorized.*"
        };
        
        return flavorTexts[level] || null;
    }

    async processVoiceXP(userId, guildId, duration, channelId) {
        try {
            this.debugVoiceLog(`🎯 Processing voice XP for user ${userId}, duration: ${duration}s`);
            
            const channel = this.client.channels.cache.get(channelId);
            if (!channel) {
                this.debugVoiceLog(`❌ Channel ${channelId} not found`);
                return;
            }
            
            this.debugVoiceLog(`   Channel name: ${channel.name}`);
            
            // Check if duration was long enough
            if (duration >= 60) { // At least 1 minute
                this.debugVoiceLog(`✅ Duration requirement met (${duration}s >= 60s)`);
                
                // Check for AFK if enabled
                let activeTime = duration;
                if (this.config.voiceAntiAFK) {
                    const session = this.voiceTracker.get(`${userId}-${guildId}`);
                    if (session && session.lastActivity) {
                        const timeSinceActivity = (Date.now() - session.lastActivity) / 1000;
                        this.debugVoiceLog(`   Time since last activity: ${timeSinceActivity}s`);
                        // If inactive for more than 10 minutes, reduce XP accordingly
                        if (timeSinceActivity > 600) {
                            activeTime = Math.max(0, duration - timeSinceActivity);
                            this.debugVoiceLog(`   Reduced active time due to AFK: ${activeTime}s`);
                        }
                    }
                }
                
                // Apply cooldown check for voice XP
                const cooldownKey = `voice-${userId}-${guildId}`;
                const now = Date.now();
                const lastVoiceXP = this.voiceTracker.get(cooldownKey) || 0;
                const cooldownRemaining = this.config.voiceCooldown - (now - lastVoiceXP);
                
                this.debugVoiceLog(`   Cooldown check: ${cooldownRemaining}ms remaining`);
                
                if (now - lastVoiceXP >= this.config.voiceCooldown) {
                    const minutes = Math.floor(activeTime / 60);
                    this.debugVoiceLog(`   Active minutes: ${minutes}`);
                    
                    if (minutes > 0) {
                        const baseVoiceXP = Math.floor(Math.random() * (this.config.voiceXPMax - this.config.voiceXPMin + 1)) + this.config.voiceXPMin;
                        const totalVoiceXP = baseVoiceXP * minutes;
                        this.debugVoiceLog(`💰 Awarding ${totalVoiceXP} voice XP (${baseVoiceXP} per minute × ${minutes} minutes)`);
                        
                        await this.addXP(userId, guildId, totalVoiceXP, 'voice');
                        this.voiceTracker.set(cooldownKey, now);
                        this.debugVoiceLog(`✅ Voice XP awarded successfully!`);
                    } else {
                        this.debugVoiceLog(`⏱️  No full minutes of activity (${activeTime}s)`);
                    }
                } else {
                    this.debugVoiceLog(`🚫 Voice XP on cooldown for ${Math.ceil(cooldownRemaining / 1000)} more seconds`);
                }
            } else {
                this.debugVoiceLog(`⏱️  Session too short (${duration}s < 60s minimum)`);
            }
            
            // Log voice session to database
            await this.db.query(
                'INSERT INTO voice_sessions (user_id, guild_id, duration) VALUES ($1, $2, $3)',
                [userId, guildId, duration]
            );
            this.debugVoiceLog(`📊 Voice session logged to database`);
            
        } catch (error) {
            console.error('❌ Voice XP processing error:', error);
            this.debugVoiceLog(`❌ Voice XP processing error:`, error);
        }
    }

    async addXP(userId, guildId, xpAmount, type) {
        try {
            const finalXP = Math.floor(xpAmount * this.config.xpMultiplier);
            this.debugXPLog(`Adding ${finalXP} XP (type: ${type}) for user ${userId}`);
            
            // Calculate voice time in minutes for database
            let voiceMinutes = 0;
            if (type === 'voice') {
                voiceMinutes = Math.floor(xpAmount / ((this.config.voiceXPMin + this.config.voiceXPMax) / 2));
            }
            
            const result = await this.db.query(`
                INSERT INTO user_levels (user_id, guild_id, total_xp, ${type === 'message' ? 'messages' : type === 'reaction' ? 'reactions' : 'voice_time'})
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, guild_id)
                DO UPDATE SET
                    total_xp = user_levels.total_xp + $3,
                    ${type === 'message' ? 'messages = user_levels.messages + 1' : 
                      type === 'reaction' ? 'reactions = user_levels.reactions + 1' : 
                      'voice_time = user_levels.voice_time + $4'}
                RETURNING total_xp, level
            `, [userId, guildId, finalXP, type === 'voice' ? voiceMinutes : 1]);
            
            const newTotalXP = result.rows[0].total_xp;
            const currentLevel = result.rows[0].level;
            const newLevel = this.calculateLevel(newTotalXP);
            
            this.debugXPLog(`   New total XP: ${newTotalXP}, Current level: ${currentLevel}, Calculated level: ${newLevel}`);
            
            if (newLevel > currentLevel) {
                await this.db.query(
                    'UPDATE user_levels SET level = $1 WHERE user_id = $2 AND guild_id = $3',
                    [newLevel, userId, guildId]
                );
                
                this.debugXPLog(`🎉 Level up! ${currentLevel} → ${newLevel}`);
                await this.handleLevelUp(userId, guildId, newLevel, currentLevel);
            }
        } catch (error) {
            console.error('❌ Add XP error:', error);
            this.debugXPLog(`❌ Add XP error:`, error);
        }
    }

    calculateLevel(totalXP) {
        switch (this.config.formul

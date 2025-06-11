// commands.js - Discord Bot Command Handlers
const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

// Simple debug replacement (matches main bot)
const debug = {
    command: (...args) => console.log('[CMD]', ...args),
    error: (category, ...args) => console.error('[ERROR]', category, ...args),
    success: (category, ...args) => console.log('[SUCCESS]', category, ...args),
    levelup: (...args) => console.log('[LEVELUP]', ...args)
};

class BotCommands {
    constructor(bot) {
        this.bot = bot;
        this.client = bot.client;
        this.db = bot.db;
        this.config = bot.config;
        this.levelRoles = bot.levelRoles;
        this.levelUpConfig = bot.levelUpConfig;
        this.leaderboardConfig = bot.leaderboardConfig;
        this.xpLogConfig = bot.xpLogConfig;
    }

    // Get command definitions
    getCommandDefinitions() {
        return [
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
                .setDescription('View the server leaderboard')
                .addBooleanOption(option =>
                    option.setName('short_version')
                        .setDescription('Show only top 3 pirates (true) or top 10 pirates (false)')
                        .setRequired(false)
                ),
            
            new SlashCommandBuilder()
                .setName('setlevelrole')
                .setDescription('Set a role reward for a specific level (use environment variables)')
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('The level (5, 10, 15, 20, 25, 30, 35, 40, 45, 50)')
                        .setRequired(true)
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
                .setDescription('Debug system status')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('status')
                        .setDescription('Show current debug status')
                )
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        ];
    }

    // Handle command execution
    async handleCommand(interaction) {
        debug.command(`Command: /${interaction.commandName} from ${interaction.user.username}`);
        
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
                default:
                    await interaction.reply({ 
                        content: 'Unknown command!', 
                        flags: 64
                    });
            }
            debug.command(`Command /${interaction.commandName} completed successfully`);
        } catch (error) {
            debug.error('Command Execution', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: 'An error occurred while executing the command.', 
                    flags: 64
                });
            } else if (interaction.deferred) {
                await interaction.editReply({ 
                    content: 'An error occurred while executing the command.'
                });
            }
        }
    }

    async handleLevelCommand(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        
        const result = await this.db.query(
            'SELECT * FROM user_levels WHERE user_id = $1 AND guild_id = $2',
            [targetUser.id, interaction.guild.id]
        );
        
        if (result.rows.length === 0) {
            return await interaction.reply({ 
                content: `${targetUser.username} hasn't started their pirate journey yet! 🏴‍☠️`, 
                flags: 64
            });
        }
        
        const userData = result.rows[0];
        const currentLevelXP = this.bot.calculateXPForLevel(userData.level);
        const nextLevelXP = this.bot.calculateXPForLevel(userData.level + 1);
        const progressXP = userData.total_xp - currentLevelXP;
        const neededXP = nextLevelXP - currentLevelXP;
        const bountyAmount = this.bot.getBountyForLevel(userData.level);
        
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
        try {
            const guild = interaction.guild;
            const excludeRoleId = this.leaderboardConfig.excludeRole;
            const shortVersion = interaction.options.getBoolean('short_version') || false;
            
            debug.command(`Leaderboard command - Short version: ${shortVersion}, Exclude Role ID: ${excludeRoleId}`);
            
            const result = await this.db.query(
                'SELECT user_id, level, total_xp FROM user_levels WHERE guild_id = $1 ORDER BY total_xp DESC LIMIT 25',
                [interaction.guild.id]
            );
            
            if (result.rows.length === 0) {
                return await interaction.reply({ 
                    content: 'No pirates have started their journey yet! 🏴‍☠️', 
                    flags: 64
                });
            }

            let pirateEmperors = [];
            let regularPirates = [];
            
            for (const userData of result.rows) {
                try {
                    const member = await guild.members.fetch(userData.user_id);
                    
                    // Check if member has the excluded role (these become Pirate Kings)
                    if (excludeRoleId && member.roles.cache.has(excludeRoleId)) {
                        debug.command(`Found Pirate King: ${member.user.username} (has excluded role)`);
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
                    debug.error(`Failed to fetch member ${userData.user_id}:`, error);
                    continue;
                }
            }

            debug.command(`Pirate Emperors found: ${pirateEmperors.length}, Regular Pirates: ${regularPirates.length}`);

            // Limit regular pirates based on short_version option
            const maxRegularPirates = shortVersion ? 3 : 10;
            regularPirates = regularPirates.slice(0, maxRegularPirates);

            if (pirateEmperors.length === 0 && regularPirates.length === 0) {
                return await interaction.reply({ 
                    content: 'No eligible pirates found for the leaderboard! 🏴‍☠️', 
                    flags: 64
                });
            }

            const embed = new EmbedBuilder()
                .setColor('#D4AF37')
                .setTitle('📰 WORLD ECONOMIC NEWS PAPER 📰')
                .setDescription(`**═══════════════════════════════════**\n🚨 **${shortVersion ? 'URGENT' : 'EMERGENCY'} BOUNTY UPDATE** 🚨\n**═══════════════════════════════════**`)
                .setFooter({ 
                    text: `⚖️ WORLD GOVERNMENT OFFICIAL PUBLICATION ⚖️ • ${shortVersion ? 'URGENT BULLETIN' : 'MARINE HEADQUARTERS'}`
                })
                .setTimestamp();
            
            let description = shortVersion ? 
                '```\n╔═══════════════════════════════════╗\n║       URGENT BOUNTY BULLETIN      ║\n║      TOP CRIMINALS IDENTIFIED     ║\n╚═══════════════════════════════════╝\n```\n\n' :
                '```\n╔═══════════════════════════════════╗\n║        MOST WANTED CRIMINALS      ║\n║     DEAD OR ALIVE - REWARD SET    ║\n╚═══════════════════════════════════╝\n```\n\n';

            // Add Pirate Kings section
            if (pirateEmperors.length > 0) {
                description += '```diff\n+ ═══════ 👑 PIRATE EMPERORS 👑 ═══════\n```\n\n';
                
                for (let i = 0; i < pirateEmperors.length; i++) {
                    const userData = pirateEmperors[i];
                    const bountyAmount = this.bot.getBountyForLevel(userData.level);
                    
                    description += '```yaml\n';
                    description += `WANTED: ${userData.member.user.username.toUpperCase()}\n`;
                    description += `BOUNTY: ₿${bountyAmount}\n`;
                    description += `THREAT LEVEL: WORLD-CLASS\n`;
                    description += `STATUS: PIRATE EMPEROR\n`;
                    description += '```\n';
                    description += `👑 **Level ${userData.level}** | ⭐ **${userData.totalXp.toLocaleString()} Rep**\n\n`;
                }
                
                description += '```\n═══════════════════════════════════\n```\n\n';
            }

            // Add regular competition section
            if (regularPirates.length > 0) {
                const sectionTitle = shortVersion ? 
                    '```diff\n- ═══════ 🔥 TOP THREATS 🔥 ═══════\n```\n\n' :
                    '```diff\n- ═══════ 🏆 ACTIVE BOUNTIES 🏆 ═══════\n```\n\n';
                
                description += sectionTitle;
                
                for (let i = 0; i < regularPirates.length; i++) {
                    const userData = regularPirates[i];
                    const bountyAmount = this.bot.getBountyForLevel(userData.level);
                    
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
                
                // Add "and X more..." if short version and there are more pirates
                if (shortVersion && result.rows.length > 3 + pirateEmperors.length) {
                    const remainingCount = Math.min(result.rows.length - 3 - pirateEmperors.length, 7);
                    description += `*... and ${remainingCount} more dangerous pirates*\n\n`;
                }
            }
            
            const footerMessage = shortVersion ?
                '```\n╔═══════════════════════════════════╗\n║   USE /leaderboard FOR FULL LIST  ║\n║     STAY VIGILANT, STAY SAFE      ║\n╚═══════════════════════════════════╝\n```\n' :
                '```\n╔═══════════════════════════════════╗\n║  REPORT SIGHTINGS TO YOUR LOCAL   ║\n║        MARINE BASE IMMEDIATELY    ║\n╚═══════════════════════════════════╝\n```\n';
            
            description += footerMessage;
            
            embed.setDescription(description);
            
            let footerText = shortVersion ? 
                '⚖️ WORLD GOVERNMENT URGENT BULLETIN ⚖️ • TOP THREATS ONLY' :
                '⚖️ WORLD GOVERNMENT OFFICIAL PUBLICATION ⚖️ • MARINE HEADQUARTERS';
                
            if (pirateEmperors.length > 0) {
                const emperorText = pirateEmperors.length === 1 ? 'Pirate Emperor reigns' : 'Pirate Emperors reign';
                footerText = `🚨 ALERT: ${emperorText} supreme! 🚨 • ${footerText}`;
            }
            embed.setFooter({ text: footerText });

            await interaction.reply({ embeds: [embed] });
            
        } catch (error) {
            debug.error('Leaderboard Command', error);
            await interaction.reply({ 
                content: 'An error occurred while fetching the leaderboard.', 
                flags: 64
            });
        }
    }

    async handleSetLevelRoleCommand(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return await interaction.reply({ 
                content: 'You need the "Manage Roles" permission to use this command.', 
                flags: 64
            });
        }
        
        await interaction.reply({ 
            content: 'Level roles are configured via environment variables. Use Railway dashboard to set LEVEL_X_ROLE variables.', 
            flags: 64
        });
    }

    async handleLevelRolesCommand(interaction) {
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
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🔧 Server Leveling Settings')
            .setTimestamp();
        
        embed.addFields(
            { name: '💬 Message XP', value: `${this.config.messageXPMin}-${this.config.messageXPMax} (${this.config.messageCooldown/1000}s cooldown)`, inline: true },
            { name: '👍 Reaction XP', value: `${this.config.reactionXPMin}-${this.config.reactionXPMax} (${this.config.reactionCooldown/1000}s cooldown)`, inline: true },
            { name: '🎤 Voice XP', value: `${this.config.voiceXPMin}-${this.config.voiceXPMax}/min (${this.config.voiceCooldown/1000}s cooldown)`, inline: true },
            { name: '📊 Formula', value: `${this.config.formulaCurve} (×${this.config.formulaMultiplier})`, inline: true },
            { name: '🎯 Max Level', value: this.config.maxLevel.toString(), inline: true },
            { name: '✨ XP Multiplier', value: `×${this.config.xpMultiplier}`, inline: true },
            { name: '🔊 Voice Requirements', value: `Min ${this.config.voiceMinMembers} members\nAFK Detection: ${this.config.voiceAntiAFK ? '✅' : '❌'}`, inline: true },
            { name: '🎉 Level Up Messages', value: `${this.levelUpConfig.enabled ? '✅ Enabled' : '❌ Disabled'}\nPing User: ${this.levelUpConfig.pingUser ? '✅' : '❌'}`, inline: true },
            { name: '📊 XP Logging', value: `${this.xpLogConfig.enabled ? '✅ Enabled' : '❌ Disabled'}\nChannel: ${this.xpLogConfig.channelName || 'Not Set'}`, inline: true },
            { name: '🏆 Leaderboard', value: `Exclude Role: ${this.leaderboardConfig.excludeRole ? '✅ Set' : '❌ Not Set'}\nTop Role: ${this.leaderboardConfig.topRole ? '✅ Set' : '❌ Not Set'}`, inline: true }
        );
        
        await interaction.reply({ embeds: [embed] });
    }

    async handleReloadCommand(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return await interaction.reply({ 
                content: 'You need the "Manage Server" permission to use this command.', 
                flags: 64
            });
        }
        
        // Call the bot's reload method
        this.bot.reloadConfiguration();
        
        debug.success('Configuration Reload', 'All configurations reloaded');
        
        await interaction.reply({ 
            content: '✅ Configuration reloaded from environment variables!', 
            flags: 64
        });
    }

    async handleInitRookiesCommand(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ 
                content: 'You need the "Administrator" permission to use this command.', 
                flags: 64
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

            const bountyRoleIds = Object.values(this.levelRoles).filter(id => id !== null);
            await guild.members.fetch();
            
            let processedCount = 0;
            let assignedCount = 0;
            let errorCount = 0;

            for (const [userId, member] of guild.members.cache) {
                processedCount++;
                
                if (member.user.bot) continue;

                const hasBountyRole = member.roles.cache.some(role => bountyRoleIds.includes(role.id));
                
                if (!hasBountyRole) {
                    try {
                        await member.roles.add(level0Role);
                        assignedCount++;
                    } catch (error) {
                        errorCount++;
                    }
                }
            }

            const resultEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Rookie Initialization Complete!')
                .addFields(
                    { name: '👥 Total Members Processed', value: processedCount.toString(), inline: true },
                    { name: '🆕 New Rookies Assigned', value: assignedCount.toString(), inline: true },
                    { name: '❌ Errors', value: errorCount.toString(), inline: true },
                    { name: '🏴‍☠️ Role Assigned', value: level0Role.name, inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [resultEmbed] });

        } catch (error) {
            debug.error('Init Rookies Command', error);
            await interaction.editReply({ content: '❌ An error occurred while initializing rookies.' });
        }
    }

    async handleDebugCommand(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return await interaction.reply({ 
                content: 'You need the "Manage Server" permission to use this command.', 
                flags: 64
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'status') {
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🐛 Debug Status')
                .setDescription('```\nBasic debug logging enabled.\nCreate debug.js file for advanced debugging.\n```')
                .addFields(
                    { name: '🔧 Configuration', value: `Message XP: ${this.config.messageXPMin}-${this.config.messageXPMax}\nVoice XP: ${this.config.voiceXPMin}-${this.config.voiceXPMax}\nReaction XP: ${this.config.reactionXPMin}-${this.config.reactionXPMax}`, inline: true },
                    { name: '🏆 Leaderboard Config', value: `Exclude Role: ${this.leaderboardConfig.excludeRole || 'Not Set'}\nTop Role: ${this.leaderboardConfig.topRole || 'Not Set'}`, inline: true },
                    { name: '📊 XP Logging', value: `Enabled: ${this.xpLogConfig.enabled ? '✅' : '❌'}\nChannel: ${this.xpLogConfig.channelName || 'Not Set'}`, inline: true }
                )
                .setTimestamp();
            
            return await interaction.reply({ embeds: [embed], flags: 64 });
        }

        await interaction.reply({ 
            content: '❌ Debug modules not loaded. Create debug.js file for advanced debugging.', 
            flags: 64
        });
    }
}

module.exports = BotCommands;

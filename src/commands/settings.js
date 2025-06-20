// src/commands/settings.js - Updated with XP Boost Management

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('⚓ Marine Intelligence Settings - Server Configuration')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View current server settings'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('levelup-channel')
                .setDescription('Set the channel for level up announcements')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Channel for level up messages')
                        .setRequired(false)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('excluded-role')
                .setDescription('Set role to exclude from XP tracking (Pirate King)')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('Role to exclude from XP tracking')
                        .setRequired(false)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('xp-multiplier')
                .setDescription('Set global XP multiplier for the server')
                .addNumberOption(option =>
                    option
                        .setName('multiplier')
                        .setDescription('XP multiplier (0.1x to 5.0x)')
                        .setRequired(true)
                        .setMinValue(0.1)
                        .setMaxValue(5.0)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('xp-boost')
                .setDescription('Manage XP boosts for roles')
                .addStringOption(option =>
                    option
                        .setName('action')
                        .setDescription('Action to perform')
                        .setRequired(true)
                        .addChoices(
                            { name: '📈 Add/Update Role Boost', value: 'set' },
                            { name: '📉 Remove Role Boost', value: 'remove' },
                            { name: '📋 List All Boosts', value: 'list' },
                            { name: '🗑️ Clear All Boosts', value: 'clear' },
                            { name: '⚡ Apply Preset Boost', value: 'preset' }
                        ))
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('Role to boost (required for set/remove/preset)')
                        .setRequired(false)
                )
                .addNumberOption(option =>
                    option
                        .setName('multiplier')
                        .setDescription('XP boost multiplier (0.1x to 10.0x, required for set)')
                        .setRequired(false)
                        .setMinValue(0.1)
                        .setMaxValue(10.0)
                )
                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('Custom name for the boost (optional)')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName('preset')
                        .setDescription('Preset boost type (for preset action)')
                        .setRequired(false)
                        .addChoices(
                            { name: '👑 Premium Member (2.0x)', value: 'premium' },
                            { name: '💎 VIP Member (1.5x)', value: 'vip' },
                            { name: '🎖️ Veteran Member (1.4x)', value: 'veteran' },
                            { name: '🤝 Server Supporter (1.3x)', value: 'supporter' },
                            { name: '🚀 Discord Nitro Booster (1.25x)', value: 'booster' },
                            { name: '⚡ Active Member (1.2x)', value: 'active' },
                            { name: '🛡️ Community Helper (1.15x)', value: 'helper' },
                            { name: '🔧 Staff Efficiency (1.1x)', value: 'moderator' }
                        )
                )),

    async execute(interaction) {
        // Check administrator permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '❌ **Access Denied**\n\n⚓ **Marine Intelligence Settings** require **Administrator** permissions.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const { db } = require('../../index'); // Get database from index.js

        try {
            if (subcommand === 'view') {
                await this.handleViewSettings(interaction, db);
            } else if (subcommand === 'levelup-channel') {
                await this.handleLevelUpChannel(interaction, db);
            } else if (subcommand === 'excluded-role') {
                await this.handleExcludedRole(interaction, db);
            } else if (subcommand === 'xp-multiplier') {
                await this.handleXPMultiplier(interaction, db);
            } else if (subcommand === 'xp-boost') {
                await this.handleXPBoost(interaction, db);
            }
        } catch (error) {
            console.error('[SETTINGS ERROR]', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🚨 MARINE INTELLIGENCE - SETTINGS ERROR')
                .setDescription('```diff\n- CONFIGURATION UPDATE FAILED\n- SYSTEM ERROR DETECTED```')
                .addFields({
                    name: '📋 Error Details',
                    value: `\`\`\`${error.message}\`\`\``
                })
                .setTimestamp()
                .setFooter({ text: 'Marine Intelligence Network' });

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },

    async handleViewSettings(interaction, db) {
        await interaction.deferReply();

        try {
            // Get guild settings
            const settingsResult = await db.query(
                'SELECT * FROM guild_settings WHERE guild_id = $1',
                [interaction.guild.id]
            );

            const settings = settingsResult.rows[0] || {};

            // Get XP boosts
            const XPBoostManager = require('../utils/xpBoost');
            const boostManager = new XPBoostManager(db);
            const boosts = await boostManager.getGuildBoosts(interaction.guild.id);
            const boostStats = await boostManager.getBoostStats(interaction.guild.id);

            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('⚓ MARINE INTELLIGENCE - SERVER CONFIGURATION')
                .setDescription('```diff\n+ CURRENT SURVEILLANCE PARAMETERS\n+ CLASSIFICATION: OPERATIONAL SETTINGS```')
                .setThumbnail(interaction.guild.iconURL({ size: 128 }));

            // Basic Settings
            let basicSettings = '```yaml\n';
            basicSettings += `Server: ${interaction.guild.name}\n`;
            basicSettings += `Global XP Multiplier: ${settings.xp_multiplier || 1.0}x\n`;
            
            if (settings.levelup_channel) {
                const channel = interaction.guild.channels.cache.get(settings.levelup_channel);
                basicSettings += `Level Up Channel: ${channel ? `#${channel.name}` : 'Channel not found'}\n`;
            } else {
                basicSettings += `Level Up Channel: Not set\n`;
            }

            if (settings.excluded_role) {
                const role = interaction.guild.roles.cache.get(settings.excluded_role);
                basicSettings += `Excluded Role: ${role ? `@${role.name}` : 'Role not found'}\n`;
            } else {
                basicSettings += `Excluded Role: Not set\n`;
            }

            basicSettings += '```';

            embed.addFields({
                name: '🔧 BASIC CONFIGURATION',
                value: basicSettings,
                inline: false
            });

            // XP Boost Settings
            let boostSettings = '```yaml\n';
            boostSettings += `Total Role Boosts: ${boostStats.total_boosts || 0}\n`;
            if (boostStats.total_boosts > 0) {
                boostSettings += `Average Multiplier: ${parseFloat(boostStats.avg_multiplier).toFixed(2)}x\n`;
                boostSettings += `Highest Boost: ${parseFloat(boostStats.max_multiplier).toFixed(2)}x\n`;
                boostSettings += `Lowest Boost: ${parseFloat(boostStats.min_multiplier).toFixed(2)}x\n`;
            }
            boostSettings += '```';

            embed.addFields({
                name: '⚡ XP BOOST SUMMARY',
                value: boostSettings,
                inline: false
            });

            // Active Boosts (show top 5)
            if (boosts.length > 0) {
                let activeBoosts = '```diff\n';
                boosts.slice(0, 5).forEach(boost => {
                    const role = interaction.guild.roles.cache.get(boost.role_id);
                    const roleName = role ? role.name : 'Unknown Role';
                    const boostName = boost.boost_name || 'Custom Boost';
                    activeBoosts += `+ ${roleName}: ${boost.boost_multiplier}x (${boostName})\n`;
                });
                if (boosts.length > 5) {
                    activeBoosts += `+ ... and ${boosts.length - 5} more boosts\n`;
                }
                activeBoosts += '```';

                embed.addFields({
                    name: '🎯 ACTIVE ROLE BOOSTS',
                    value: activeBoosts,
                    inline: false
                });
            }

            embed.setFooter({ 
                text: `⚓ Marine Intelligence Network • ${interaction.guild.memberCount} Total Marines` 
            })
            .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[SETTINGS] Error viewing settings:', error);
            await interaction.editReply({
                content: '❌ **Failed to load settings**\n\nPlease try again.'
            });
        }
    },

    async handleLevelUpChannel(interaction, db) {
        const channel = interaction.options.getChannel('channel');

        try {
            if (channel) {
                // Set level up channel
                await db.query(`
                    INSERT INTO guild_settings (guild_id, levelup_channel, updated_at)
                    VALUES ($1, $2, CURRENT_TIMESTAMP)
                    ON CONFLICT (guild_id)
                    DO UPDATE SET
                        levelup_channel = $2,
                        updated_at = CURRENT_TIMESTAMP
                `, [interaction.guild.id, channel.id]);

                // Update cache
                if (!global.guildSettings) global.guildSettings = new Map();
                const currentSettings = global.guildSettings.get(interaction.guild.id) || {};
                currentSettings.levelupChannel = channel.id;
                global.guildSettings.set(interaction.guild.id, currentSettings);

                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('⚓ MARINE INTELLIGENCE - CONFIGURATION UPDATE')
                    .setDescription('```diff\n+ LEVEL UP CHANNEL CONFIGURED\n+ BOUNTY ANNOUNCEMENTS ACTIVATED```')
                    .addFields({
                        name: '📢 Level Up Channel',
                        value: `\`\`\`yaml\nChannel: #${channel.name}\nChannel ID: ${channel.id}\nStatus: ACTIVE\n\`\`\``,
                        inline: false
                    })
                    .setFooter({ text: 'Marine Intelligence Network' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });

            } else {
                // Remove level up channel
                await db.query(`
                    UPDATE guild_settings 
                    SET levelup_channel = NULL, updated_at = CURRENT_TIMESTAMP
                    WHERE guild_id = $1
                `, [interaction.guild.id]);

                // Update cache
                if (!global.guildSettings) global.guildSettings = new Map();
                const currentSettings = global.guildSettings.get(interaction.guild.id) || {};
                currentSettings.levelupChannel = null;
                global.guildSettings.set(interaction.guild.id, currentSettings);

                const embed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setTitle('⚓ MARINE INTELLIGENCE - CONFIGURATION UPDATE')
                    .setDescription('```diff\n- LEVEL UP CHANNEL DISABLED\n- BOUNTY ANNOUNCEMENTS DEACTIVATED```')
                    .setFooter({ text: 'Marine Intelligence Network' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
            }
        } catch (error) {
            console.error('[SETTINGS] Error setting level up channel:', error);
            await interaction.reply({
                content: '❌ **Failed to update level up channel**\n\nPlease try again.',
                ephemeral: true
            });
        }
    },

    async handleExcludedRole(interaction, db) {
        const role = interaction.options.getRole('role');

        try {
            if (role) {
                // Set excluded role
                await db.query(`
                    INSERT INTO guild_settings (guild_id, excluded_role, updated_at)
                    VALUES ($1, $2, CURRENT_TIMESTAMP)
                    ON CONFLICT (guild_id)
                    DO UPDATE SET
                        excluded_role = $2,
                        updated_at = CURRENT_TIMESTAMP
                `, [interaction.guild.id, role.id]);

                // Update cache
                if (!global.guildSettings) global.guildSettings = new Map();
                const currentSettings = global.guildSettings.get(interaction.guild.id) || {};
                currentSettings.excludedRole = role.id;
                global.guildSettings.set(interaction.guild.id, currentSettings);

                const embed = new EmbedBuilder()
                    .setColor(0xFFD700) // Gold for Pirate King
                    .setTitle('⚓ MARINE INTELLIGENCE - PIRATE KING DESIGNATION')
                    .setDescription('```diff\n+ PIRATE KING ROLE CONFIGURED\n+ SPECIAL CLASSIFICATION ACTIVATED```')
                    .addFields({
                        name: '👑 Pirate King Role',
                        value: `\`\`\`yaml\nRole: @${role.name}\nRole ID: ${role.id}\nMembers: ${role.members.size}\nStatus: EXCLUDED FROM XP TRACKING\n\`\`\``,
                        inline: false
                    })
                    .setFooter({ text: 'Marine Intelligence Network - Emperor Classification' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });

            } else {
                // Remove excluded role
                await db.query(`
                    UPDATE guild_settings 
                    SET excluded_role = NULL, updated_at = CURRENT_TIMESTAMP
                    WHERE guild_id = $1
                `, [interaction.guild.id]);

                // Update cache
                if (!global.guildSettings) global.guildSettings = new Map();
                const currentSettings = global.guildSettings.get(interaction.guild.id) || {};
                currentSettings.excludedRole = null;
                global.guildSettings.set(interaction.guild.id, currentSettings);

                const embed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setTitle('⚓ MARINE INTELLIGENCE - CONFIGURATION UPDATE')
                    .setDescription('```diff\n- PIRATE KING ROLE REMOVED\n- ALL USERS NOW TRACKED```')
                    .setFooter({ text: 'Marine Intelligence Network' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
            }
        } catch (error) {
            console.error('[SETTINGS] Error setting excluded role:', error);
            await interaction.reply({
                content: '❌ **Failed to update excluded role**\n\nPlease try again.',
                ephemeral: true
            });
        }
    },

    async handleXPMultiplier(interaction, db) {
        const multiplier = interaction.options.getNumber('multiplier');

        try {
            // Update XP multiplier
            await db.query(`
                INSERT INTO guild_settings (guild_id, xp_multiplier, updated_at)
                VALUES ($1, $2, CURRENT_TIMESTAMP)
                ON CONFLICT (guild_id)
                DO UPDATE SET
                    xp_multiplier = $2,
                    updated_at = CURRENT_TIMESTAMP
            `, [interaction.guild.id, multiplier]);

            // Update cache
            if (!global.guildSettings) global.guildSettings = new Map();
            const currentSettings = global.guildSettings.get(interaction.guild.id) || {};
            currentSettings.xpMultiplier = multiplier;
            global.guildSettings.set(interaction.guild.id, currentSettings);

            const embed = new EmbedBuilder()
                .setColor(multiplier > 1.0 ? 0x00FF00 : multiplier < 1.0 ? 0xFF6B6B : 0x4A90E2)
                .setTitle('⚓ MARINE INTELLIGENCE - XP MULTIPLIER UPDATE')
                .setDescription('```diff\n+ GLOBAL XP MULTIPLIER CONFIGURED\n+ ALL MARINES AFFECTED```')
                .addFields({
                    name: '📊 XP Multiplier Settings',
                    value: `\`\`\`yaml\nPrevious Multiplier: ${global.guildSettings.get(interaction.guild.id)?.xpMultiplier || 1.0}x\nNew Multiplier: ${multiplier}x\nChange: ${multiplier > 1.0 ? '+' : ''}${((multiplier - 1.0) * 100).toFixed(0)}%\nStatus: ${multiplier > 1.0 ? 'BOOSTED' : multiplier < 1.0 ? 'REDUCED' : 'NORMAL'}\n\`\`\``,
                    inline: false
                })
                .setFooter({ text: 'Marine Intelligence Network - Global Configuration' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('[SETTINGS] Error setting XP multiplier:', error);
            await interaction.reply({
                content: '❌ **Failed to update XP multiplier**\n\nPlease try again.',
                ephemeral: true
            });
        }
    },

    async handleXPBoost(interaction, db) {
        await interaction.deferReply();

        const XPBoostManager = require('../utils/xpBoost');
        const boostManager = new XPBoostManager(db);
        
        const action = interaction.options.getString('action');
        const role = interaction.options.getRole('role');
        const multiplier = interaction.options.getNumber('multiplier');
        const name = interaction.options.getString('name');
        const preset = interaction.options.getString('preset');

        try {
            if (action === 'set') {
                if (!role || !multiplier) {
                    return await interaction.editReply({
                        content: '❌ **Missing Parameters**\n\nRole and multiplier are required for setting boosts.'
                    });
                }

                const boost = await boostManager.setRoleBoost(
                    interaction.guild.id, 
                    role.id, 
                    multiplier, 
                    name || `${role.name} Boost`
                );

                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('⚡ XP BOOST CONFIGURED')
                    .setDescription('```diff\n+ ROLE BOOST ACTIVATED\n+ ENHANCED XP GENERATION```')
                    .addFields({
                        name: '🎯 Boost Details',
                        value: `\`\`\`yaml\nRole: @${role.name}\nMultiplier: ${multiplier}x\nBoost Name: ${boost.boost_name}\nMembers Affected: ${role.members.size}\nStatus: ACTIVE\n\`\`\``,
                        inline: false
                    })
                    .setFooter({ text: 'Marine Intelligence Network - Boost System' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } else if (action === 'remove') {
                if (!role) {
                    return await interaction.editReply({
                        content: '❌ **Missing Role**\n\nRole is required for removing boosts.'
                    });
                }

                const removed = await boostManager.removeRoleBoost(interaction.guild.id, role.id);

                if (removed) {
                    const embed = new EmbedBuilder()
                        .setColor(0xFF6B6B)
                        .setTitle('⚡ XP BOOST REMOVED')
                        .setDescription('```diff\n- ROLE BOOST DEACTIVATED\n- STANDARD XP RATES RESTORED```')
                        .addFields({
                            name: '🎯 Removal Details',
                            value: `\`\`\`yaml\nRole: @${role.name}\nPrevious Boost: REMOVED\nMembers Affected: ${role.members.size}\nStatus: STANDARD XP\n\`\`\``,
                            inline: false
                        })
                        .setFooter({ text: 'Marine Intelligence Network - Boost System' })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                } else {
                    await interaction.editReply({
                        content: `❌ **No boost found for @${role.name}**\n\nThis role doesn't have an active XP boost.`
                    });
                }

            } else if (action === 'list') {
                const boosts = await boostManager.getGuildBoosts(interaction.guild.id);

                if (boosts.length === 0) {
                    const embed = new EmbedBuilder()
                        .setColor(0x808080)
                        .setTitle('⚡ XP BOOSTS - NO ACTIVE BOOSTS')
                        .setDescription('```diff\n- NO ROLE BOOSTS CONFIGURED\n- ALL ROLES USE STANDARD XP RATES```')
                        .addFields({
                            name: '💡 Getting Started',
                            value: '```yaml\nUse: /settings xp-boost action:preset\nTo quickly set up common boosts, or\nUse: /settings xp-boost action:set\nTo create custom boosts\n```',
                            inline: false
                        })
                        .setFooter({ text: 'Marine Intelligence Network - Boost System' })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                    return;
                }

                const embed = new EmbedBuilder()
                    .setColor(0x4A90E2)
                    .setTitle('⚡ ACTIVE XP BOOSTS')
                    .setDescription('```diff\n+ ROLE BOOST CONFIGURATION\n+ ENHANCED XP GENERATION ACTIVE```');

                // Split boosts into chunks to avoid field limits
                const chunksSize = 10;
                for (let i = 0; i < boosts.length; i += chunksSize) {
                    const chunk = boosts.slice(i, i + chunksSize);
                    let boostList = '```yaml\n';
                    
                    chunk.forEach((boost, index) => {
                        const role = interaction.guild.roles.cache.get(boost.role_id);
                        const roleName = role ? role.name : 'Unknown Role';
                        const memberCount = role ? role.members.size : 0;
                        
                        boostList += `${i + index + 1}. ${roleName}\n`;
                        boostList += `   Multiplier: ${boost.boost_multiplier}x\n`;
                        boostList += `   Name: ${boost.boost_name || 'Custom Boost'}\n`;
                        boostList += `   Members: ${memberCount}\n\n`;
                    });
                    
                    boostList += '```';

                    embed.addFields({
                        name: i === 0 ? '🎯 BOOST CONFIGURATION' : `🎯 CONTINUED (${Math.floor(i / chunksSize) + 1})`,
                        value: boostList,
                        inline: false
                    });
                }

                embed.setFooter({ text: `Marine Intelligence Network • ${boosts.length} Active Boosts` })
                     .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } else if (action === 'clear') {
                const clearedCount = await boostManager.clearGuildBoosts(interaction.guild.id);

                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('⚡ ALL XP BOOSTS CLEARED')
                    .setDescription('```diff\n- ALL ROLE BOOSTS REMOVED\n- STANDARD XP RATES RESTORED```')
                    .addFields({
                        name: '🗑️ Cleanup Results',
                        value: `\`\`\`yaml\nBoosts Removed: ${clearedCount}\nAffected Roles: ${clearedCount}\nStatus: ALL ROLES STANDARD XP\nAction: IRREVERSIBLE\n\`\`\``,
                        inline: false
                    })
                    .setFooter({ text: 'Marine Intelligence Network - Boost System' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } else if (action === 'preset') {
                if (!role || !preset) {
                    const presets = boostManager.getPresetBoosts();
                    let presetList = '```yaml\nAvailable Presets:\n\n';
                    Object.entries(presets).forEach(([key, value]) => {
                        presetList += `${key}: ${value.multiplier}x - ${value.name}\n`;
                    });
                    presetList += '```';

                    return await interaction.editReply({
                        content: `❌ **Missing Parameters**\n\nRole and preset are required.\n\n${presetList}`
                    });
                }

                const boost = await boostManager.applyPresetBoost(interaction.guild.id, role.id, preset);

                const embed = new EmbedBuilder()
                    .setColor(0x9B59B6)
                    .setTitle('⚡ PRESET BOOST APPLIED')
                    .setDescription('```diff\n+ PRESET CONFIGURATION ACTIVATED\n+ OPTIMIZED XP BOOST ENABLED```')
                    .addFields({
                        name: '🎯 Preset Details',
                        value: `\`\`\`yaml\nRole: @${role.name}\nPreset: ${preset.toUpperCase()}\nMultiplier: ${boost.boost_multiplier}x\nBoost Name: ${boost.boost_name}\nMembers Affected: ${role.members.size}\nStatus: ACTIVE\n\`\`\``,
                        inline: false
                    })
                    .setFooter({ text: 'Marine Intelligence Network - Preset System' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('[SETTINGS] Error handling XP boost:', error);
            await interaction.editReply({
                content: `❌ **XP Boost Error**\n\n${error.message}`
            });
        }
    }
};

module.exports.XPBoostManager = require('../utils/xpBoost');

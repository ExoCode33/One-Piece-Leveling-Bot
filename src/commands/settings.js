// src/commands/settings.js - Fixed version without problematic XPBoostManager creation

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('🔧 Configure server leveling settings (Administrator only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option
                .setName('action')
                .setDescription('What setting would you like to change?')
                .setRequired(true)
                .addChoices(
                    { name: '📢 Set Level Up Channel', value: 'levelup-channel' },
                    { name: '📊 Set XP Log Channel', value: 'xp-log-channel' },
                    { name: '⚡ Set XP Multiplier', value: 'xp-multiplier' },
                    { name: '🔄 Toggle Level Up Announcements', value: 'toggle-levelup' },
                    { name: '🔄 Toggle XP Logging', value: 'toggle-xp-logs' },
                    { name: '👁️ View Current Settings', value: 'view' },
                    // XP BOOST OPTIONS
                    { name: '⚡ Add/Update Role XP Boost', value: 'add-boost' },
                    { name: '🗑️ Remove Role XP Boost', value: 'remove-boost' },
                    { name: '📋 List All XP Boosts', value: 'list-boosts' },
                    { name: '🎯 Apply Preset XP Boost', value: 'preset-boost' },
                    { name: '💥 Clear All XP Boosts', value: 'clear-boosts' }
                )
        )
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Channel to use (for levelup-channel or xp-log-channel)')
                .setRequired(false)
                .addChannelTypes(0)
        )
        .addNumberOption(option =>
            option
                .setName('multiplier')
                .setDescription('XP multiplier value (0.1 to 5.0 for global, 0.1 to 10.0 for role boost)')
                .setRequired(false)
                .setMinValue(0.1)
                .setMaxValue(10.0)
        )
        .addBooleanOption(option =>
            option
                .setName('enabled')
                .setDescription('Enable or disable (for toggle options)')
                .setRequired(false)
        )
        .addRoleOption(option =>
            option
                .setName('role')
                .setDescription('Role for XP boost operations')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('boost-name')
                .setDescription('Custom name for the XP boost')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('preset')
                .setDescription('Preset boost type')
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
        ),

    async execute(interaction) {
        try {
            // Double-check administrator permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.reply({
                    content: '❌ **Access Denied**\n\nYou need Administrator permissions to use this command.',
                    ephemeral: true
                });
            }

            const action = interaction.options.getString('action');
            const channel = interaction.options.getChannel('channel');
            const multiplier = interaction.options.getNumber('multiplier');
            const enabled = interaction.options.getBoolean('enabled');
            const role = interaction.options.getRole('role');
            const boostName = interaction.options.getString('boost-name');
            const preset = interaction.options.getString('preset');
            const guildId = interaction.guild.id;

            // Initialize guild settings if not exists
            if (!global.guildSettings) {
                global.guildSettings = new Map();
            }

            // Get current settings or create defaults
            let guildSettings = global.guildSettings.get(guildId) || {
                levelupChannel: null,
                levelupEnabled: true,
                xpLogChannel: null,
                xpLogEnabled: false,
                xpMultiplier: 1.0
            };

            // Handle XP boost actions
            if (['add-boost', 'remove-boost', 'list-boosts', 'preset-boost', 'clear-boosts'].includes(action)) {
                return await this.handleXPBoostActions(interaction, action, role, multiplier, boostName, preset);
            }

            switch (action) {
                case 'levelup-channel':
                    if (!channel) {
                        return await interaction.reply({
                            content: '❌ **Missing Parameter**\n\nPlease specify a channel for level up announcements.',
                            ephemeral: true
                        });
                    }

                    if (!channel.permissionsFor(interaction.guild.members.me).has(['SendMessages', 'EmbedLinks'])) {
                        return await interaction.reply({
                            content: `❌ **Permission Error**\n\nI don't have permission to send messages in ${channel}.`,
                            ephemeral: true
                        });
                    }

                    guildSettings.levelupChannel = channel.id;
                    global.guildSettings.set(guildId, guildSettings);
                    const saveSuccess1 = await this.saveGuildSettings(guildId, guildSettings);

                    return await interaction.reply({
                        embeds: [new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('✅ Level Up Channel Updated')
                            .setDescription(`Level up announcements will now be sent to ${channel}${saveSuccess1 ? '\n\n✅ Settings saved to database' : '\n\n⚠️ Settings saved in memory only'}`)
                            .setFooter({ text: '⚓ Marine Intelligence • Settings Updated' })
                            .setTimestamp()
                        ]
                    });

                case 'xp-log-channel':
                    if (!channel) {
                        return await interaction.reply({
                            content: '❌ **Missing Parameter**\n\nPlease specify a channel for XP activity logs.',
                            ephemeral: true
                        });
                    }

                    if (!channel.permissionsFor(interaction.guild.members.me).has(['SendMessages', 'EmbedLinks'])) {
                        return await interaction.reply({
                            content: `❌ **Permission Error**\n\nI don't have permission to send messages in ${channel}.`,
                            ephemeral: true
                        });
                    }

                    guildSettings.xpLogChannel = channel.id;
                    guildSettings.xpLogEnabled = true;
                    global.guildSettings.set(guildId, guildSettings);
                    const saveSuccess2 = await this.saveGuildSettings(guildId, guildSettings);

                    return await interaction.reply({
                        embeds: [new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('✅ XP Log Channel Updated')
                            .setDescription(`XP activity logs will now be sent to ${channel}\n\n*XP logging has been automatically enabled.*${saveSuccess2 ? '\n\n✅ Settings saved to database' : '\n\n⚠️ Settings saved in memory only'}`)
                            .setFooter({ text: '⚓ Marine Intelligence • Settings Updated' })
                            .setTimestamp()
                        ]
                    });

                case 'xp-multiplier':
                    if (multiplier === null) {
                        return await interaction.reply({
                            content: '❌ **Missing Parameter**\n\nPlease specify an XP multiplier value (0.1 to 5.0).',
                            ephemeral: true
                        });
                    }

                    if (multiplier > 5.0) {
                        return await interaction.reply({
                            content: '❌ **Invalid Value**\n\nGlobal XP multiplier must be between 0.1 and 5.0.',
                            ephemeral: true
                        });
                    }

                    guildSettings.xpMultiplier = multiplier;
                    global.guildSettings.set(guildId, guildSettings);
                    const saveSuccess3 = await this.saveGuildSettings(guildId, guildSettings);

                    return await interaction.reply({
                        embeds: [new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('✅ XP Multiplier Updated')
                            .setDescription(`XP multiplier set to **${multiplier}x**\n\nAll XP gains will be multiplied by this amount.${saveSuccess3 ? '\n\n✅ Settings saved to database' : '\n\n⚠️ Settings saved in memory only'}`)
                            .setFooter({ text: '⚓ Marine Intelligence • Settings Updated' })
                            .setTimestamp()
                        ]
                    });

                case 'toggle-levelup':
                    if (enabled === null) {
                        return await interaction.reply({
                            content: '❌ **Missing Parameter**\n\nPlease specify whether to enable or disable level up announcements.',
                            ephemeral: true
                        });
                    }

                    guildSettings.levelupEnabled = enabled;
                    global.guildSettings.set(guildId, guildSettings);
                    await this.saveGuildSettings(guildId, guildSettings);

                    return await interaction.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(enabled ? '#00FF00' : '#FF6B6B')
                            .setTitle(`${enabled ? '✅' : '❌'} Level Up Announcements ${enabled ? 'Enabled' : 'Disabled'}`)
                            .setDescription(enabled ? 
                                'Level up announcements are now **enabled**.' :
                                'Level up announcements are now **disabled**.'
                            )
                            .setFooter({ text: '⚓ Marine Intelligence • Settings Updated' })
                            .setTimestamp()
                        ]
                    });

                case 'toggle-xp-logs':
                    if (enabled === null) {
                        return await interaction.reply({
                            content: '❌ **Missing Parameter**\n\nPlease specify whether to enable or disable XP logging.',
                            ephemeral: true
                        });
                    }

                    if (enabled && !guildSettings.xpLogChannel) {
                        return await interaction.reply({
                            content: '❌ **Configuration Error**\n\nYou must set an XP log channel first.',
                            ephemeral: true
                        });
                    }
                    
                    guildSettings.xpLogEnabled = enabled;
                    global.guildSettings.set(guildId, guildSettings);
                    await this.saveGuildSettings(guildId, guildSettings);

                    return await interaction.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(enabled ? '#00FF00' : '#FF6B6B')
                            .setTitle(`${enabled ? '✅' : '❌'} XP Logging ${enabled ? 'Enabled' : 'Disabled'}`)
                            .setDescription(enabled ? 
                                'XP activity logging is now **enabled**.' :
                                'XP activity logging is now **disabled**.'
                            )
                            .setFooter({ text: '⚓ Marine Intelligence • Settings Updated' })
                            .setTimestamp()
                        ]
                    });

                case 'view':
                    return await this.handleViewSettings(interaction, guildSettings);

                default:
                    return await interaction.reply({
                        content: '❌ **Unknown Action**\n\nPlease use a valid action from the dropdown.',
                        ephemeral: true
                    });
            }

        } catch (error) {
            console.error('Settings command error:', error);
            
            if (!interaction.replied) {
                return await interaction.reply({
                    content: '❌ **Error**\n\nSomething went wrong while updating settings. Please try again.',
                    ephemeral: true
                });
            }
        }
    },

    // Handle view settings - SAFE VERSION
    async handleViewSettings(interaction, guildSettings) {
        try {
            let boosts = [];
            let boostStats = { total_boosts: 0, max_multiplier: 1.0, avg_multiplier: 1.0 };

            // SAFELY use global XP boost manager - NO NEW INSTANCES
            if (global.xpBoostManager) {
                try {
                    boosts = await global.xpBoostManager.getGuildBoosts(interaction.guild.id);
                    boostStats = await global.xpBoostManager.getBoostStats(interaction.guild.id);
                } catch (error) {
                    console.error('[SETTINGS] Error getting boost info:', error);
                }
            }

            const embed = new EmbedBuilder()
                .setColor('#4A90E2')
                .setTitle('🔧 Server Leveling Settings')
                .setDescription('Current configuration for this server')
                .addFields(
                    {
                        name: '📢 Level Up Announcements',
                        value: `**Status:** ${guildSettings.levelupEnabled ? '✅ Enabled' : '❌ Disabled'}\n**Channel:** ${guildSettings.levelupChannel ? `<#${guildSettings.levelupChannel}>` : '❌ Not Set'}`,
                        inline: false
                    },
                    {
                        name: '📊 XP Activity Logging',
                        value: `**Status:** ${guildSettings.xpLogEnabled ? '✅ Enabled' : '❌ Disabled'}\n**Channel:** ${guildSettings.xpLogChannel ? `<#${guildSettings.xpLogChannel}>` : '❌ Not Set'}`,
                        inline: false
                    },
                    {
                        name: '⚡ XP Multiplier',
                        value: `**Current:** ${guildSettings.xpMultiplier}x\n**Effect:** All XP gains are multiplied by this amount`,
                        inline: false
                    }
                );

            // Add XP boost info if available
            if (boosts.length > 0) {
                let boostInfo = `**Total Role Boosts:** ${boosts.length}\n`;
                boostInfo += `**Highest Boost:** ${parseFloat(boostStats.max_multiplier || 1.0).toFixed(2)}x\n`;
                boostInfo += `**Average Boost:** ${parseFloat(boostStats.avg_multiplier || 1.0).toFixed(2)}x\n\n`;
                
                const topBoosts = boosts.slice(0, 3);
                topBoosts.forEach(boost => {
                    const role = interaction.guild.roles.cache.get(boost.role_id);
                    if (role) {
                        boostInfo += `• **${role.name}:** ${boost.boost_multiplier}x\n`;
                    }
                });
                
                if (boosts.length > 3) {
                    boostInfo += `*...and ${boosts.length - 3} more boosts*`;
                }

                embed.addFields({
                    name: '🚀 XP Role Boosts',
                    value: boostInfo,
                    inline: false
                });
            } else {
                embed.addFields({
                    name: '🚀 XP Role Boosts',
                    value: global.xpBoostManager ? 
                        '**No role boosts configured**\nUse `/settings action:add-boost` to create boosts' :
                        '**XP Boost system not available**\nRestart bot to initialize',
                    inline: false
                });
            }

            embed.setFooter({ text: '⚓ Marine Intelligence • Settings Overview' })
                 .setTimestamp();

            return await interaction.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('[SETTINGS] Error in view settings:', error);
            
            // Fallback view without boost info
            const embed = new EmbedBuilder()
                .setColor('#4A90E2')
                .setTitle('🔧 Server Leveling Settings')
                .setDescription('Current configuration for this server')
                .addFields(
                    {
                        name: '📢 Level Up Announcements',
                        value: `**Status:** ${guildSettings.levelupEnabled ? '✅ Enabled' : '❌ Disabled'}\n**Channel:** ${guildSettings.levelupChannel ? `<#${guildSettings.levelupChannel}>` : '❌ Not Set'}`,
                        inline: false
                    },
                    {
                        name: '📊 XP Activity Logging',
                        value: `**Status:** ${guildSettings.xpLogEnabled ? '✅ Enabled' : '❌ Disabled'}\n**Channel:** ${guildSettings.xpLogChannel ? `<#${guildSettings.xpLogChannel}>` : '❌ Not Set'}`,
                        inline: false
                    },
                    {
                        name: '⚡ XP Multiplier',
                        value: `**Current:** ${guildSettings.xpMultiplier || 1.0}x\n**Effect:** All XP gains are multiplied by this amount`,
                        inline: false
                    },
                    {
                        name: '🚀 XP Role Boosts',
                        value: '⚠️ Boost information unavailable',
                        inline: false
                    }
                )
                .setFooter({ text: '⚓ Marine Intelligence • Settings Overview' })
                .setTimestamp();

            return await interaction.reply({ embeds: [embed] });
        }
    },

    // Handle XP boost actions - SAFE VERSION
    async handleXPBoostActions(interaction, action, role, multiplier, boostName, preset) {
        try {
            await interaction.deferReply();

            // Check if global XP boost manager exists
            if (!global.xpBoostManager) {
                return await interaction.editReply({
                    content: '❌ **XP Boost System Unavailable**\n\nXP boost manager is not initialized. Please restart the bot.'
                });
            }

            const boostManager = global.xpBoostManager;

            switch (action) {
                case 'add-boost':
                    if (!role || !multiplier) {
                        return await interaction.editReply({
                            content: '❌ **Missing Parameters**\n\nPlease specify both a role and multiplier for XP boost.'
                        });
                    }

                    const boost = await boostManager.setRoleBoost(
                        interaction.guild.id,
                        role.id,
                        multiplier,
                        boostName || `${role.name} Boost`
                    );

                    const addEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('⚡ XP Boost Added')
                        .setDescription(`**Role:** ${role}\n**Multiplier:** ${multiplier}x\n**Name:** ${boost.boost_name}\n**Members Affected:** ${role.members.size}`)
                        .setFooter({ text: '⚓ Marine Intelligence • XP Boost System' })
                        .setTimestamp();

                    return await interaction.editReply({ embeds: [addEmbed] });

                case 'remove-boost':
                    if (!role) {
                        return await interaction.editReply({
                            content: '❌ **Missing Parameter**\n\nPlease specify a role to remove XP boost from.'
                        });
                    }

                    const removed = await boostManager.removeRoleBoost(interaction.guild.id, role.id);

                    if (removed) {
                        const removeEmbed = new EmbedBuilder()
                            .setColor('#FF6B6B')
                            .setTitle('🗑️ XP Boost Removed')
                            .setDescription(`**Role:** ${role}\n**Status:** Boost removed`)
                            .setFooter({ text: '⚓ Marine Intelligence • XP Boost System' })
                            .setTimestamp();

                        return await interaction.editReply({ embeds: [removeEmbed] });
                    } else {
                        return await interaction.editReply({
                            content: `❌ **No boost found** for ${role}`
                        });
                    }

                case 'list-boosts':
                    const boosts = await boostManager.getGuildBoosts(interaction.guild.id);

                    if (boosts.length === 0) {
                        return await interaction.editReply({
                            content: '📋 **No XP Boosts Configured**\n\nUse `/settings action:add-boost` to create your first boost!'
                        });
                    }

                    let boostList = '';
                    boosts.forEach((boost, index) => {
                        const role = interaction.guild.roles.cache.get(boost.role_id);
                        if (role) {
                            boostList += `**${index + 1}.** ${role.name}: **${boost.boost_multiplier}x**\n`;
                        }
                    });

                    const listEmbed = new EmbedBuilder()
                        .setColor('#4A90E2')
                        .setTitle(`📋 Active XP Boosts (${boosts.length})`)
                        .setDescription(boostList)
                        .setFooter({ text: '⚓ Marine Intelligence • XP Boost System' })
                        .setTimestamp();

                    return await interaction.editReply({ embeds: [listEmbed] });

                case 'preset-boost':
                    if (!role || !preset) {
                        return await interaction.editReply({
                            content: '❌ **Missing Parameters**\n\nPlease specify both a role and preset type.'
                        });
                    }

                    const presetBoost = await boostManager.applyPresetBoost(interaction.guild.id, role.id, preset);

                    const presetEmbed = new EmbedBuilder()
                        .setColor('#9B59B6')
                        .setTitle('🎯 Preset XP Boost Applied')
                        .setDescription(`**Role:** ${role}\n**Preset:** ${preset.toUpperCase()}\n**Multiplier:** ${presetBoost.boost_multiplier}x`)
                        .setFooter({ text: '⚓ Marine Intelligence • Preset System' })
                        .setTimestamp();

                    return await interaction.editReply({ embeds: [presetEmbed] });

                case 'clear-boosts':
                    const clearedCount = await boostManager.clearGuildBoosts(interaction.guild.id);

                    const clearEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('💥 All XP Boosts Cleared')
                        .setDescription(`**Boosts Removed:** ${clearedCount}\n⚠️ *This action cannot be undone*`)
                        .setFooter({ text: '⚓ Marine Intelligence • XP Boost System' })
                        .setTimestamp();

                    return await interaction.editReply({ embeds: [clearEmbed] });
            }

        } catch (error) {
            console.error('[SETTINGS] XP Boost error:', error);
            await interaction.editReply({
                content: `❌ **XP Boost Error**\n\n${error.message}`
            });
        }
    },

    // Save guild settings to database - BETTER VERSION
    async saveGuildSettings(guildId, settings) {
        try {
            // Try multiple ways to access the database
            let database = null;
            
            // Method 1: Try global xpTracker
            if (global.xpTracker && global.xpTracker.db) {
                database = global.xpTracker.db;
                console.log('[SETTINGS] Using database from global.xpTracker');
            }
            
            // Method 2: Try require from index (fallback)
            if (!database) {
                try {
                    const { db } = require('../../index');
                    if (db) {
                        database = db;
                        console.log('[SETTINGS] Using database from index.js require');
                    }
                } catch (requireError) {
                    console.log('[SETTINGS] Could not require database from index.js:', requireError.message);
                }
            }
            
            if (!database) {
                console.error('[SETTINGS] No database connection available - settings will not persist');
                return false;
            }

            const result = await database.query(`
                INSERT INTO guild_settings (guild_id, levelup_channel, levelup_enabled, xp_log_channel, xp_log_enabled, xp_multiplier, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
                ON CONFLICT (guild_id)
                DO UPDATE SET
                    levelup_channel = EXCLUDED.levelup_channel,
                    levelup_enabled = EXCLUDED.levelup_enabled,
                    xp_log_channel = EXCLUDED.xp_log_channel,
                    xp_log_enabled = EXCLUDED.xp_log_enabled,
                    xp_multiplier = EXCLUDED.xp_multiplier,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            `, [
                guildId,
                settings.levelupChannel,
                settings.levelupEnabled,
                settings.xpLogChannel,
                settings.xpLogEnabled,
                settings.xpMultiplier
            ]);

            console.log(`[SETTINGS] ✅ Successfully saved settings for guild ${guildId}`);
            console.log(`[SETTINGS] Database result:`, result.rows[0]);
            return true;

        } catch (error) {
            console.error('[SETTINGS] ❌ Error saving to database:', error);
            console.error('[SETTINGS] Settings data that failed to save:', {
                guildId,
                settings
            });
            return false;
        }
    }
};

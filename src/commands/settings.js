// src/commands/settings.js - Fixed with working database storage and admin permissions

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('🔧 Configure server leveling settings (Administrator only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Require Admin permission
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
                    { name: '👁️ View Current Settings', value: 'view' }
                )
        )
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Channel to use (for levelup-channel or xp-log-channel)')
                .setRequired(false)
                .addChannelTypes(0) // Text channel only
        )
        .addNumberOption(option =>
            option
                .setName('multiplier')
                .setDescription('XP multiplier value (0.1 to 5.0)')
                .setRequired(false)
                .setMinValue(0.1)
                .setMaxValue(5.0)
        )
        .addBooleanOption(option =>
            option
                .setName('enabled')
                .setDescription('Enable or disable (for toggle options)')
                .setRequired(false)
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

            switch (action) {
                case 'levelup-channel':
                    if (!channel) {
                        return await interaction.reply({
                            content: '❌ **Missing Parameter**\n\nPlease specify a channel for level up announcements.',
                            ephemeral: true
                        });
                    }

                    // Validate channel permissions
                    if (!channel.permissionsFor(interaction.guild.members.me).has(['SendMessages', 'EmbedLinks'])) {
                        return await interaction.reply({
                            content: `❌ **Permission Error**\n\nI don't have permission to send messages in ${channel}. Please ensure I have **Send Messages** and **Embed Links** permissions.`,
                            ephemeral: true
                        });
                    }

                    guildSettings.levelupChannel = channel.id;
                    global.guildSettings.set(guildId, guildSettings);
                    
                    // Save to database
                    await this.saveGuildSettings(guildId, guildSettings);

                    return await interaction.reply({
                        embeds: [new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('✅ Level Up Channel Updated')
                            .setDescription(`Level up announcements will now be sent to ${channel}`)
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

                    // Validate channel permissions
                    if (!channel.permissionsFor(interaction.guild.members.me).has(['SendMessages', 'EmbedLinks'])) {
                        return await interaction.reply({
                            content: `❌ **Permission Error**\n\nI don't have permission to send messages in ${channel}. Please ensure I have **Send Messages** and **Embed Links** permissions.`,
                            ephemeral: true
                        });
                    }

                    guildSettings.xpLogChannel = channel.id;
                    guildSettings.xpLogEnabled = true; // Auto-enable when setting channel
                    global.guildSettings.set(guildId, guildSettings);
                    
                    // Save to database
                    await this.saveGuildSettings(guildId, guildSettings);

                    return await interaction.reply({
                        embeds: [new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('✅ XP Log Channel Updated')
                            .setDescription(`XP activity logs will now be sent to ${channel}\n\n*XP logging has been automatically enabled.*`)
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

                    guildSettings.xpMultiplier = multiplier;
                    global.guildSettings.set(guildId, guildSettings);
                    
                    // Save to database
                    await this.saveGuildSettings(guildId, guildSettings);

                    return await interaction.reply({
                        embeds: [new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('✅ XP Multiplier Updated')
                            .setDescription(`XP multiplier set to **${multiplier}x**\n\nAll XP gains will be multiplied by this amount.`)
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
                    
                    // Save to database
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
                            content: '❌ **Configuration Error**\n\nYou must set an XP log channel first using the `xp-log-channel` action.',
                            ephemeral: true
                        });
                    }
                    
                    guildSettings.xpLogEnabled = enabled;
                    global.guildSettings.set(guildId, guildSettings);
                    
                    // Save to database
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
                        )
                        .setFooter({ text: '⚓ Marine Intelligence • Settings Overview' })
                        .setTimestamp();

                    return await interaction.reply({ embeds: [embed] });

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

    // Save guild settings to database
    async saveGuildSettings(guildId, settings) {
        try {
            if (!global.xpTracker || !global.xpTracker.db) {
                console.error('[SETTINGS] Database not available');
                return;
            }

            await global.xpTracker.db.query(`
                INSERT INTO guild_settings (guild_id, levelup_channel, levelup_enabled, xp_log_channel, xp_log_enabled, xp_multiplier, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
                ON CONFLICT (guild_id)
                DO UPDATE SET
                    levelup_channel = $2,
                    levelup_enabled = $3,
                    xp_log_channel = $4,
                    xp_log_enabled = $5,
                    xp_multiplier = $6,
                    updated_at = CURRENT_TIMESTAMP
            `, [
                guildId,
                settings.levelupChannel,
                settings.levelupEnabled,
                settings.xpLogChannel,
                settings.xpLogEnabled,
                settings.xpMultiplier
            ]);

            console.log(`[SETTINGS] Saved settings for guild ${guildId}`);

        } catch (error) {
            console.error('[SETTINGS] Error saving to database:', error);
        }
    }
};

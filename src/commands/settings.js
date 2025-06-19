// src/commands/settings.js - Fixed with working database storage and admin permissions

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('🔧 Configure server leveling settings (Administrator only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Require Admin permission
        .addSubcommand(subcommand =>
            subcommand
                .setName('levelup-channel')
                .setDescription('Set the channel for level up announcements')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The channel to send level up announcements')
                        .setRequired(true)
                        .addChannelTypes(0) // Text channel only
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('xp-log-channel')
                .setDescription('Set the channel for XP activity logs')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The channel to send XP logs')
                        .setRequired(true)
                        .addChannelTypes(0) // Text channel only
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('xp-multiplier')
                .setDescription('Set the XP multiplier for this server')
                .addNumberOption(option =>
                    option
                        .setName('multiplier')
                        .setDescription('XP multiplier (0.1 to 5.0)')
                        .setRequired(true)
                        .setMinValue(0.1)
                        .setMaxValue(5.0)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle-levelup')
                .setDescription('Enable or disable level up announcements')
                .addBooleanOption(option =>
                    option
                        .setName('enabled')
                        .setDescription('Enable level up announcements')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle-xp-logs')
                .setDescription('Enable or disable XP activity logging')
                .addBooleanOption(option =>
                    option
                        .setName('enabled')
                        .setDescription('Enable XP activity logs')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View current server settings')
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

            const subcommand = interaction.options.getSubcommand();
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

            switch (subcommand) {
                case 'levelup-channel':
                    const levelupChannel = interaction.options.getChannel('channel');
                    
                    // Validate channel permissions
                    if (!levelupChannel.permissionsFor(interaction.guild.members.me).has(['SendMessages', 'EmbedLinks'])) {
                        return await interaction.reply({
                            content: `❌ **Permission Error**\n\nI don't have permission to send messages in ${levelupChannel}. Please ensure I have **Send Messages** and **Embed Links** permissions.`,
                            ephemeral: true
                        });
                    }

                    guildSettings.levelupChannel = levelupChannel.id;
                    global.guildSettings.set(guildId, guildSettings);
                    
                    // Save to database
                    await this.saveGuildSettings(guildId, guildSettings);

                    return await interaction.reply({
                        embeds: [new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('✅ Level Up Channel Updated')
                            .setDescription(`Level up announcements will now be sent to ${levelupChannel}`)
                            .setFooter({ text: '⚓ Marine Intelligence • Settings Updated' })
                            .setTimestamp()
                        ]
                    });

                case 'xp-log-channel':
                    const xpLogChannel = interaction.options.getChannel('channel');
                    
                    // Validate channel permissions
                    if (!xpLogChannel.permissionsFor(interaction.guild.members.me).has(['SendMessages', 'EmbedLinks'])) {
                        return await interaction.reply({
                            content: `❌ **Permission Error**\n\nI don't have permission to send messages in ${xpLogChannel}. Please ensure I have **Send Messages** and **Embed Links** permissions.`,
                            ephemeral: true
                        });
                    }

                    guildSettings.xpLogChannel = xpLogChannel.id;
                    guildSettings.xpLogEnabled = true; // Auto-enable when setting channel
                    global.guildSettings.set(guildId, guildSettings);
                    
                    // Save to database
                    await this.saveGuildSettings(guildId, guildSettings);

                    return await interaction.reply({
                        embeds: [new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('✅ XP Log Channel Updated')
                            .setDescription(`XP activity logs will now be sent to ${xpLogChannel}\n\n*XP logging has been automatically enabled.*`)
                            .setFooter({ text: '⚓ Marine Intelligence • Settings Updated' })
                            .setTimestamp()
                        ]
                    });

                case 'xp-multiplier':
                    const multiplier = interaction.options.getNumber('multiplier');
                    
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
                    const levelupEnabled = interaction.options.getBoolean('enabled');
                    
                    guildSettings.levelupEnabled = levelupEnabled;
                    global.guildSettings.set(guildId, guildSettings);
                    
                    // Save to database
                    await this.saveGuildSettings(guildId, guildSettings);

                    return await interaction.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(levelupEnabled ? '#00FF00' : '#FF6B6B')
                            .setTitle(`${levelupEnabled ? '✅' : '❌'} Level Up Announcements ${levelupEnabled ? 'Enabled' : 'Disabled'}`)
                            .setDescription(levelupEnabled ? 
                                'Level up announcements are now **enabled**.' :
                                'Level up announcements are now **disabled**.'
                            )
                            .setFooter({ text: '⚓ Marine Intelligence • Settings Updated' })
                            .setTimestamp()
                        ]
                    });

                case 'toggle-xp-logs':
                    const xpLogEnabled = interaction.options.getBoolean('enabled');
                    
                    if (xpLogEnabled && !guildSettings.xpLogChannel) {
                        return await interaction.reply({
                            content: '❌ **Configuration Error**\n\nYou must set an XP log channel first using `/settings xp-log-channel`.',
                            ephemeral: true
                        });
                    }
                    
                    guildSettings.xpLogEnabled = xpLogEnabled;
                    global.guildSettings.set(guildId, guildSettings);
                    
                    // Save to database
                    await this.saveGuildSettings(guildId, guildSettings);

                    return await interaction.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(xpLogEnabled ? '#00FF00' : '#FF6B6B')
                            .setTitle(`${xpLogEnabled ? '✅' : '❌'} XP Logging ${xpLogEnabled ? 'Enabled' : 'Disabled'}`)
                            .setDescription(xpLogEnabled ? 
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
                        content: '❌ **Unknown Subcommand**\n\nPlease use a valid subcommand.',
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

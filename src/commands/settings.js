// src/commands/settings.js - With auto-dismiss for ephemeral messages

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { autoDissmissEphemeralMessage } = require('../utils/bountySystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Configure bot settings for this server')
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View current server settings')
        )
        .addSubcommand(sub =>
            sub.setName('excluded-role')
                .setDescription('Set the excluded role (Pirate King role)')
                .addRoleOption(option => 
                    option.setName('role')
                        .setDescription('Role to exclude from XP tracking (set as Pirate King)')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('levelup-channel')
                .setDescription('Set the channel for level up announcements')
                .addChannelOption(option => 
                    option.setName('channel')
                        .setDescription('Channel for level up messages')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('xp-multiplier')
                .setDescription('Set the XP multiplier for this server')
                .addNumberOption(option => 
                    option.setName('multiplier')
                        .setDescription('XP multiplier (0.1 to 5.0)')
                        .setRequired(true)
                        .setMinValue(0.1)
                        .setMaxValue(5.0)
                )
        )
        .addSubcommand(sub =>
            sub.setName('reset')
                .setDescription('Reset all server settings to default')
                .addBooleanOption(option => 
                    option.setName('confirm')
                        .setDescription('Confirm you want to reset all settings')
                        .setRequired(true)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Check permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Access Denied')
                .setDescription('You need Administrator permissions to use this command.')
                .setColor('#FF0000');
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
            autoDissmissEphemeralMessage(interaction, 20000);
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const subcommand = interaction.options.getSubcommand();
            const guildId = interaction.guild.id;

            // Get XP tracker from global
            const xpTracker = global.xpTracker;
            if (!xpTracker) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ System Error')
                    .setDescription('XP Tracker is not initialized. Please restart the bot.')
                    .setColor('#FF0000');
                
                await interaction.editReply({ embeds: [embed] });
                autoDissmissEphemeralMessage(interaction, 20000);
                return;
            }

            const db = xpTracker.db;

            // First, ensure the guild_settings table has the columns we need
            await this.ensureGuildSettingsColumns(db);

            switch (subcommand) {
                case 'view': {
                    try {
                        // Get current settings
                        const settings = global.guildSettings?.get(guildId) || {};
                        
                        // Get role and channel names
                        let excludedRoleName = 'None';
                        if (settings.excludedRole) {
                            const role = interaction.guild.roles.cache.get(settings.excludedRole);
                            excludedRoleName = role ? role.name : 'Role not found';
                        }

                        let levelupChannelName = 'Not set';
                        const envChannel = process.env.LEVELUP_CHANNEL;
                        if (envChannel && envChannel !== 'your_levelup_channel_id') {
                            const channel = interaction.guild.channels.cache.get(envChannel);
                            levelupChannelName = channel ? `#${channel.name}` : 'Channel not found';
                        }

                        // Count total users with XP
                        const userCountResult = await db.query(
                            'SELECT COUNT(*) as count FROM user_levels WHERE guild_id = $1',
                            [guildId]
                        );
                        const totalUsers = userCountResult.rows[0]?.count || 0;

                        const embed = new EmbedBuilder()
                            .setTitle('⚙️ Server Settings')
                            .setDescription(`Current configuration for **${interaction.guild.name}**`)
                            .addFields(
                                { name: '👑 Excluded Role (Pirate King)', value: excludedRoleName, inline: true },
                                { name: '📢 Level Up Channel', value: levelupChannelName, inline: true },
                                { name: '⚡ XP Multiplier', value: `${settings.xpMultiplier || 1.0}x`, inline: true },
                                { name: '📊 Total Users Tracked', value: totalUsers.toString(), inline: true },
                                { name: '🎯 Max Level', value: process.env.MAX_LEVEL || '50', inline: true },
                                { name: '📝 Level Up Messages', value: process.env.LEVELUP_ENABLED === 'true' ? 'Enabled' : 'Disabled', inline: true }
                            )
                            .setColor('#4169E1')
                            .setThumbnail(interaction.guild.iconURL())
                            .setFooter({ text: 'Use /settings to modify these values' })
                            .setTimestamp();

                        // Add XP rates section
                        embed.addFields(
                            { name: '💬 Message XP', value: `${process.env.MESSAGE_XP_MIN || 25}-${process.env.MESSAGE_XP_MAX || 35} (${Math.floor((parseInt(process.env.MESSAGE_COOLDOWN) || 60000) / 1000)}s cooldown)`, inline: true },
                            { name: '😄 Reaction XP', value: `${process.env.REACTION_XP_MIN || 25}-${process.env.REACTION_XP_MAX || 35} (${Math.floor((parseInt(process.env.REACTION_COOLDOWN) || 300000) / 1000)}s cooldown)`, inline: true },
                            { name: '🎙️ Voice XP', value: `${process.env.VOICE_XP_MIN || 45}-${process.env.VOICE_XP_MAX || 55}/min`, inline: true }
                        );

                        await interaction.editReply({ embeds: [embed] });
                        autoDissmissEphemeralMessage(interaction, 20000);
                        return;
                    } catch (error) {
                        console.error('[SETTINGS] Error viewing settings:', error);
                        const embed = new EmbedBuilder()
                            .setTitle('❌ Error Loading Settings')
                            .setDescription('Failed to load server settings.')
                            .setColor('#FF0000');
                        
                        await interaction.editReply({ embeds: [embed] });
                        autoDissmissEphemeralMessage(interaction, 20000);
                        return;
                    }
                }

                case 'excluded-role': {
                    const role = interaction.options.getRole('role');
                    
                    try {
                        if (role) {
                            // Set excluded role
                            await db.query(
                                `INSERT INTO guild_settings (guild_id, excluded_role, xp_multiplier) 
                                 VALUES ($1, $2, $3) 
                                 ON CONFLICT (guild_id) 
                                 DO UPDATE SET excluded_role = $2`,
                                [guildId, role.id, 1.0]
                            );

                            // Update global settings
                            const currentSettings = global.guildSettings?.get(guildId) || {};
                            global.guildSettings.set(guildId, {
                                ...currentSettings,
                                excludedRole: role.id
                            });

                            const embed = new EmbedBuilder()
                                .setTitle('✅ Excluded Role Set')
                                .setDescription(`**${role.name}** is now the Pirate King role and will be excluded from XP tracking.`)
                                .addFields(
                                    { name: '👑 Role', value: role.name, inline: true },
                                    { name: '🎯 Effect', value: 'Members with this role will not gain XP', inline: true },
                                    { name: '📊 Leaderboard', value: 'Will appear separately as "Pirate King"', inline: true }
                                )
                                .setColor('#FFD700')
                                .setFooter({ text: 'Members will need to rejoin voice channels for changes to take effect' });

                            await interaction.editReply({ embeds: [embed] });
                            autoDissmissEphemeralMessage(interaction, 20000);
                            return;
                        } else {
                            // Remove excluded role
                            await db.query(
                                `UPDATE guild_settings 
                                 SET excluded_role = NULL 
                                 WHERE guild_id = $1`,
                                [guildId]
                            );

                            // Update global settings
                            const currentSettings = global.guildSettings?.get(guildId) || {};
                            global.guildSettings.set(guildId, {
                                ...currentSettings,
                                excludedRole: null
                            });

                            const embed = new EmbedBuilder()
                                .setTitle('✅ Excluded Role Removed')
                                .setDescription('No role is now excluded from XP tracking. All members will gain XP normally.')
                                .setColor('#00FF00');

                            await interaction.editReply({ embeds: [embed] });
                            autoDissmissEphemeralMessage(interaction, 20000);
                            return;
                        }
                    } catch (error) {
                        console.error('[SETTINGS] Error setting excluded role:', error);
                        const embed = new EmbedBuilder()
                            .setTitle('❌ Error Setting Role')
                            .setDescription('Failed to update excluded role setting.')
                            .setColor('#FF0000');
                        
                        await interaction.editReply({ embeds: [embed] });
                        autoDissmissEphemeralMessage(interaction, 20000);
                        return;
                    }
                }

                case 'levelup-channel': {
                    const channel = interaction.options.getChannel('channel');
                    
                    try {
                        if (channel) {
                            if (!channel.isTextBased()) {
                                const embed = new EmbedBuilder()
                                    .setTitle('❌ Invalid Channel')
                                    .setDescription('Please select a text channel for level up announcements.')
                                    .setColor('#FF0000');
                                
                                await interaction.editReply({ embeds: [embed] });
                                autoDissmissEphemeralMessage(interaction, 20000);
                                return;
                            }

                            const embed = new EmbedBuilder()
                                .setTitle('📝 Level Up Channel Setting')
                                .setDescription('To set the level up channel, you need to update your environment variable.')
                                .addFields(
                                    { name: '🎯 Selected Channel', value: `${channel}`, inline: true },
                                    { name: '📋 Environment Variable', value: '`LEVELUP_CHANNEL`', inline: true },
                                    { name: '🆔 Channel ID', value: `\`${channel.id}\``, inline: true },
                                    { name: '⚙️ How to Set', value: 'Update your `LEVELUP_CHANNEL` environment variable with the channel ID above and restart the bot.', inline: false }
                                )
                                .setColor('#FFA500')
                                .setFooter({ text: 'This requires server restart after environment update' });

                            await interaction.editReply({ embeds: [embed] });
                            autoDissmissEphemeralMessage(interaction, 20000);
                            return;
                        } else {
                            const embed = new EmbedBuilder()
                                .setTitle('📢 Current Level Up Channel')
                                .setDescription('Level up channel is controlled by the `LEVELUP_CHANNEL` environment variable.')
                                .addFields(
                                    { name: '📝 Current Setting', value: process.env.LEVELUP_CHANNEL || 'Not set', inline: true },
                                    { name: '🔧 To Change', value: 'Update the `LEVELUP_CHANNEL` environment variable', inline: true }
                                )
                                .setColor('#4169E1');

                            await interaction.editReply({ embeds: [embed] });
                            autoDissmissEphemeralMessage(interaction, 20000);
                            return;
                        }
                    } catch (error) {
                        console.error('[SETTINGS] Error with levelup channel:', error);
                        const embed = new EmbedBuilder()
                            .setTitle('❌ Error Setting Channel')
                            .setDescription('Failed to process levelup channel setting.')
                            .setColor('#FF0000');
                        
                        await interaction.editReply({ embeds: [embed] });
                        autoDissmissEphemeralMessage(interaction, 20000);
                        return;
                    }
                }

                case 'xp-multiplier': {
                    const multiplier = interaction.options.getNumber('multiplier');
                    
                    try {
                        // Update in database
                        await db.query(
                            `INSERT INTO guild_settings (guild_id, xp_multiplier) 
                             VALUES ($1, $2) 
                             ON CONFLICT (guild_id) 
                             DO UPDATE SET xp_multiplier = $2`,
                            [guildId, multiplier]
                        );

                        // Update global settings
                        const currentSettings = global.guildSettings?.get(guildId) || {};
                        global.guildSettings.set(guildId, {
                            ...currentSettings,
                            xpMultiplier: multiplier
                        });

                        const embed = new EmbedBuilder()
                            .setTitle('✅ XP Multiplier Updated')
                            .setDescription(`XP multiplier has been set to **${multiplier}x**`)
                            .addFields(
                                { name: '⚡ New Multiplier', value: `${multiplier}x`, inline: true },
                                { name: '📊 Effect', value: multiplier > 1 ? 'Faster XP gain' : multiplier < 1 ? 'Slower XP gain' : 'Normal XP gain', inline: true },
                                { name: '🎯 Applies To', value: 'All future XP gains', inline: true }
                            )
                            .setColor(multiplier > 1 ? '#00FF00' : multiplier < 1 ? '#FFA500' : '#4169E1')
                            .setFooter({ text: 'This affects all message, reaction, and voice XP gains' });

                        await interaction.editReply({ embeds: [embed] });
                        autoDissmissEphemeralMessage(interaction, 20000);
                        return;
                    } catch (error) {
                        console.error('[SETTINGS] Error setting XP multiplier:', error);
                        const embed = new EmbedBuilder()
                            .setTitle('❌ Error Setting Multiplier')
                            .setDescription('Failed to update XP multiplier.')
                            .setColor('#FF0000');
                        
                        await interaction.editReply({ embeds: [embed] });
                        autoDissmissEphemeralMessage(interaction, 20000);
                        return;
                    }
                }

                case 'reset': {
                    const confirmed = interaction.options.getBoolean('confirm');
                    
                    if (!confirmed) {
                        const embed = new EmbedBuilder()
                            .setTitle('❌ Reset Cancelled')
                            .setDescription('You must confirm the reset by setting the confirm option to `True`.')
                            .setColor('#FF0000');
                        
                        await interaction.editReply({ embeds: [embed] });
                        autoDissmissEphemeralMessage(interaction, 20000);
                        return;
                    }

                    try {
                        // Reset settings in database
                        await db.query(
                            `UPDATE guild_settings 
                             SET excluded_role = NULL, xp_multiplier = 1.0 
                             WHERE guild_id = $1`,
                            [guildId]
                        );

                        // Reset global settings
                        global.guildSettings.set(guildId, {
                            excludedRole: null,
                            levelupChannel: null,
                            xpMultiplier: 1.0
                        });

                        const embed = new EmbedBuilder()
                            .setTitle('✅ Settings Reset')
                            .setDescription('All server settings have been reset to default values.')
                            .addFields(
                                { name: '👑 Excluded Role', value: 'None', inline: true },
                                { name: '⚡ XP Multiplier', value: '1.0x', inline: true },
                                { name: '📢 Level Up Channel', value: 'Environment default', inline: true }
                            )
                            .setColor('#4169E1')
                            .setFooter({ text: 'All members will now gain XP normally' });

                        await interaction.editReply({ embeds: [embed] });
                        autoDissmissEphemeralMessage(interaction, 20000);
                        return;
                    } catch (error) {
                        console.error('[SETTINGS] Error resetting settings:', error);
                        const embed = new EmbedBuilder()
                            .setTitle('❌ Error Resetting Settings')
                            .setDescription('Failed to reset server settings.')
                            .setColor('#FF0000');
                        
                        await interaction.editReply({ embeds: [embed] });
                        autoDissmissEphemeralMessage(interaction, 20000);
                        return;
                    }
                }

                default: {
                    const embed = new EmbedBuilder()
                        .setTitle('❌ Invalid Subcommand')
                        .setDescription('Please use a valid subcommand.')
                        .setColor('#FF0000');
                    
                    await interaction.editReply({ embeds: [embed] });
                    autoDissmissEphemeralMessage(interaction, 20000);
                    return;
                }
            }

        } catch (error) {
            console.error('[SETTINGS] Error in settings command:', error);
            const embed = new EmbedBuilder()
                .setTitle('❌ Command Error')
                .setDescription('An unexpected error occurred while executing the settings command.')
                .setColor('#FF0000');
            
            await interaction.editReply({ embeds: [embed] });
            autoDissmissEphemeralMessage(interaction, 20000);
        }
    },

    // Helper function to ensure the guild_settings table has required columns
    async ensureGuildSettingsColumns(db) {
        try {
            // Check if excluded_role column exists
            const checkExcludedRoleCol = await db.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'guild_settings' AND column_name = 'excluded_role'
            `);
            
            if (checkExcludedRoleCol.rows.length === 0) {
                console.log('[SETTINGS] Adding excluded_role column to guild_settings table...');
                await db.query(`
                    ALTER TABLE guild_settings 
                    ADD COLUMN excluded_role VARCHAR(20)
                `);
                console.log('[SETTINGS] ✅ Added excluded_role column');
            }

            // Check if levelup_channel column exists  
            const checkLevelupChannelCol = await db.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'guild_settings' AND column_name = 'levelup_channel'
            `);
            
            if (checkLevelupChannelCol.rows.length === 0) {
                console.log('[SETTINGS] Adding levelup_channel column to guild_settings table...');
                await db.query(`
                    ALTER TABLE guild_settings 
                    ADD COLUMN levelup_channel VARCHAR(20)
                `);
                console.log('[SETTINGS] ✅ Added levelup_channel column');
            }

        } catch (error) {
            console.error('[SETTINGS] Error ensuring guild_settings columns:', error);
        }
    }
};

// src/commands/admin.js - Fixed Admin Commands

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Show bot settings (Admin only)'),

    async execute(interaction, client, xpTracker) {
        try {
            // Check permissions
            if (!interaction.member.permissions.has('Administrator')) {
                return await interaction.reply({ 
                    content: '❌ You need Administrator permissions to use this command.', 
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            const embed = new EmbedBuilder()
                .setTitle('🔧 Bot Configuration Settings')
                .setColor(0x0099FF)
                .addFields(
                    { name: '💬 Message XP', value: `${process.env.MESSAGE_XP_MIN || 25}-${process.env.MESSAGE_XP_MAX || 35} XP`, inline: true },
                    { name: '🔊 Voice XP', value: `${process.env.VOICE_XP_MIN || 45}-${process.env.VOICE_XP_MAX || 55} XP/min`, inline: true },
                    { name: '👍 Reaction XP', value: `${process.env.REACTION_XP_MIN || 25}-${process.env.REACTION_XP_MAX || 35} XP`, inline: true },
                    { name: '⏰ Message Cooldown', value: `${(parseInt(process.env.MESSAGE_COOLDOWN) || 60000) / 1000}s`, inline: true },
                    { name: '⏰ Voice Cooldown', value: `${(parseInt(process.env.VOICE_COOLDOWN) || 60000) / 1000}s`, inline: true },
                    { name: '⏰ Reaction Cooldown', value: `${(parseInt(process.env.REACTION_COOLDOWN) || 300000) / 1000}s`, inline: true },
                    { name: '📊 Formula Type', value: process.env.FORMULA_CURVE || 'exponential', inline: true },
                    { name: '🔢 Formula Multiplier', value: process.env.FORMULA_MULTIPLIER || '1.75', inline: true },
                    { name: '🎯 Max Level', value: process.env.MAX_LEVEL || '50', inline: true },
                    { name: '✨ XP Multiplier', value: process.env.XP_MULTIPLIER || '1.0', inline: true },
                    { name: '👥 Min Voice Members', value: process.env.VOICE_MIN_MEMBERS || '2', inline: true },
                    { name: '💤 Anti-AFK Voice', value: process.env.VOICE_ANTI_AFK === 'true' ? '✅ Enabled' : '❌ Disabled', inline: true }
                );

            // Add level up settings
            const levelUpInfo = [
                `**Enabled:** ${process.env.LEVELUP_ENABLED !== 'false' ? '✅' : '❌'}`,
                `**Show XP:** ${process.env.LEVELUP_SHOW_XP === 'true' ? '✅' : '❌'}`,
                `**Show Progress:** ${process.env.LEVELUP_SHOW_PROGRESS === 'true' ? '✅' : '❌'}`,
                `**Show Role:** ${process.env.LEVELUP_SHOW_ROLE === 'true' ? '✅' : '❌'}`,
                `**Ping User:** ${process.env.LEVELUP_PING_USER === 'true' ? '✅' : '❌'}`
            ].join('\n');

            embed.addFields({ name: '🎉 Level Up Messages', value: levelUpInfo, inline: false });

            // Add XP logging settings
            const xpLogInfo = [
                `**XP Log Enabled:** ${process.env.XP_LOG_ENABLED === 'true' ? '✅' : '❌'}`,
                `**Log Messages:** ${process.env.XP_LOG_MESSAGES === 'true' ? '✅' : '❌'}`,
                `**Log Reactions:** ${process.env.XP_LOG_REACTIONS === 'true' ? '✅' : '❌'}`,
                `**Log Voice:** ${process.env.XP_LOG_VOICE === 'true' ? '✅' : '❌'}`
            ].join('\n');

            embed.addFields({ name: '📊 XP Logging', value: xpLogInfo, inline: false });

            // Add channel info
            const channelInfo = [];
            if (process.env.LEVELUP_CHANNEL && process.env.LEVELUP_CHANNEL !== 'your_levelup_channel_id') {
                channelInfo.push(`**Level Up Channel:** <#${process.env.LEVELUP_CHANNEL}>`);
            }
            if (process.env.XP_LOG_CHANNEL && process.env.XP_LOG_CHANNEL !== 'your_log_channel_id') {
                channelInfo.push(`**XP Log Channel:** <#${process.env.XP_LOG_CHANNEL}>`);
            }

            if (channelInfo.length > 0) {
                embed.addFields({ name: '📺 Channels', value: channelInfo.join('\n'), inline: false });
            }

            // Add role rewards info
            const roleRewards = [];
            for (let i = 5; i <= 50; i += 5) {
                const roleId = process.env[`LEVEL_${i}_ROLE`];
                if (roleId && roleId !== 'your_role_id_here') {
                    try {
                        const role = interaction.guild.roles.cache.get(roleId);
                        if (role) {
                            roleRewards.push(`**Level ${i}:** ${role.name}`);
                        } else {
                            roleRewards.push(`**Level ${i}:** ❌ Role not found`);
                        }
                    } catch (error) {
                        roleRewards.push(`**Level ${i}:** ❌ Error`);
                    }
                }
            }

            if (roleRewards.length > 0) {
                // Split into chunks if too many roles
                const chunks = [];
                for (let i = 0; i < roleRewards.length; i += 10) {
                    chunks.push(roleRewards.slice(i, i + 10));
                }
                
                chunks.forEach((chunk, index) => {
                    embed.addFields({ 
                        name: index === 0 ? '🏆 Role Rewards' : `🏆 Role Rewards (continued ${index + 1})`, 
                        value: chunk.join('\n'), 
                        inline: false 
                    });
                });
            }

            // Add debug settings
            const debugInfo = [
                `**Debug Mode:** ${process.env.DEBUG_MODE === 'true' ? '✅' : '❌'}`,
                `**Debug XP:** ${process.env.DEBUG_XP === 'true' ? '✅' : '❌'}`,
                `**Debug Voice:** ${process.env.DEBUG_VOICE === 'true' ? '✅' : '❌'}`,
                `**Debug Database:** ${process.env.DEBUG_DATABASE === 'true' ? '✅' : '❌'}`,
                `**Debug Commands:** ${process.env.DEBUG_COMMANDS === 'true' ? '✅' : '❌'}`
            ].join('\n');

            embed.addFields({ name: '🐛 Debug Settings', value: debugInfo, inline: false });

            embed.setFooter({ text: '⚓ Configure via Railway Environment Variables' });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in settings command:', error);
            try {
                await interaction.editReply('An error occurred while fetching settings.');
            } catch {}
        }
    }
};

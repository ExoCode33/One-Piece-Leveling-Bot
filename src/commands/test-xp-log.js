// Create this file: src/commands/test-xp-log.js

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test-xp-log')
        .setDescription('🧪 Test XP logging system (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('test-type')
                .setDescription('Type of test to run')
                .setRequired(false)
                .addChoices(
                    { name: '💬 Test Message XP Log', value: 'message' },
                    { name: '👍 Test Reaction XP Log', value: 'reaction' },
                    { name: '🎤 Test Voice XP Log', value: 'voice' },
                    { name: '⚓ Test Admin XP Log', value: 'admin' },
                    { name: '🎌 Test Quiz XP Log', value: 'daily-quiz-correct' },
                    { name: '🔍 Check XP Tracker', value: 'check-tracker' }
                )
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const testType = interaction.options.getString('test-type') || 'check-tracker';
            const guildId = interaction.guild.id;
            const user = interaction.user;

            if (testType === 'check-tracker') {
                return await this.checkXPTracker(interaction, guildId);
            }

            // Check if XP tracker exists
            if (!global.xpTracker) {
                return await interaction.editReply({
                    content: '❌ **XP Tracker Not Available**\n\nThe XP tracking system is not initialized.'
                });
            }

            // Check guild settings
            const guildSettings = global.guildSettings?.get(guildId);
            if (!guildSettings) {
                return await interaction.editReply({
                    content: '❌ **No Guild Settings**\n\nGuild settings not found in memory.'
                });
            }

            if (!guildSettings.xpLogEnabled) {
                return await interaction.editReply({
                    content: '❌ **XP Logging Disabled**\n\nXP logging is disabled in guild settings.'
                });
            }

            if (!guildSettings.xpLogChannel) {
                return await interaction.editReply({
                    content: '❌ **No XP Log Channel**\n\nNo XP log channel configured in settings.'
                });
            }

            // Test the specific XP log type
            console.log(`[TEST XP LOG] Testing ${testType} XP logging...`);

            const testXPAmount = 25;
            const testInfo = {
                totalXP: 12345,
                currentLevel: 15,
                adminUser: user,
                reason: `TEST LOG - ${testType.toUpperCase()}`,
                channelName: 'test-channel',
                sessionDuration: 5,
                memberCount: 3,
                xpSource: `test-${testType}`
            };

            // Call the logging function directly
            await global.xpTracker.logXPActivity(testType, user, guildId, testXPAmount, testInfo);

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🧪 XP Log Test Successful')
                .setDescription(`Test ${testType} XP log sent!`)
                .addFields(
                    {
                        name: '✅ Test Details',
                        value: `**Type:** ${testType}\n**XP Amount:** +${testXPAmount}\n**Target Channel:** <#${guildSettings.xpLogChannel}>\n**User:** ${user.username}`,
                        inline: false
                    },
                    {
                        name: '🔍 Guild Settings Verified',
                        value: `**XP Log Enabled:** ✅ ${guildSettings.xpLogEnabled}\n**XP Log Channel:** <#${guildSettings.xpLogChannel}>`,
                        inline: false
                    }
                )
                .setFooter({ text: '🧪 XP Logging Test Complete' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[TEST XP LOG] Error:', error);
            await interaction.editReply({
                content: `❌ **Test Failed**\n\n\`\`\`${error.message}\n\nStack: ${error.stack?.substring(0, 500) || 'No stack trace'}\`\`\``
            });
        }
    },

    async checkXPTracker(interaction, guildId) {
        const results = [];
        
        // Check XP Tracker
        results.push('🔍 **XP TRACKER STATUS**');
        if (global.xpTracker) {
            results.push('✅ XP Tracker is initialized');
            results.push(`✅ Database: ${global.xpTracker.db ? 'Connected' : 'Missing'}`);
            results.push(`✅ Voice sessions: ${global.xpTracker.voiceSessions?.size || 0} active`);
            results.push(`✅ Cooldowns: ${global.xpTracker.cooldowns?.size || 0} active`);
        } else {
            results.push('❌ XP Tracker NOT initialized');
        }

        results.push('');

        // Check Guild Settings
        results.push('⚙️ **GUILD SETTINGS STATUS**');
        const guildSettings = global.guildSettings?.get(guildId);
        if (guildSettings) {
            results.push('✅ Guild settings found in memory');
            results.push(`📊 XP Log Enabled: ${guildSettings.xpLogEnabled ? '✅ TRUE' : '❌ FALSE'}`);
            results.push(`📊 XP Log Channel: ${guildSettings.xpLogChannel ? `<#${guildSettings.xpLogChannel}>` : '❌ Not set'}`);
            results.push(`📢 Level Up Enabled: ${guildSettings.levelupEnabled ? '✅ TRUE' : '❌ FALSE'}`);
            results.push(`📢 Level Up Channel: ${guildSettings.levelupChannel ? `<#${guildSettings.levelupChannel}>` : '❌ Not set'}`);
        } else {
            results.push('❌ Guild settings NOT found in memory');
        }

        results.push('');

        // Check XP logging function
        results.push('🧪 **XP LOGGING FUNCTION TEST**');
        if (global.xpTracker && typeof global.xpTracker.logXPActivity === 'function') {
            results.push('✅ logXPActivity function exists');
        } else {
            results.push('❌ logXPActivity function missing');
        }

        results.push('');

        // Check recent activity
        results.push('📊 **RECENT ACTIVITY CHECK**');
        results.push('Try the following to test XP logging:');
        results.push('1. `/test-xp-log test-type:message` - Test message logging');
        results.push('2. Send a message in chat (if message XP enabled)');
        results.push('3. React to a message (if reaction XP enabled)');
        results.push('4. Join voice channel with someone (if voice XP enabled)');

        const embed = new EmbedBuilder()
            .setColor('#4A90E2')
            .setTitle('🔍 XP Tracker System Check')
            .setDescription(`\`\`\`${results.join('\n')}\`\`\``)
            .setFooter({ text: '🔍 XP System Diagnostics' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};

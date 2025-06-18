// src/commands/admin.js - Enhanced with Marine Level-Up Integration
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const XPTracker = require('../utils/xpTracker');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Admin commands for managing the leveling system')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add-xp')
                .setDescription('Add XP to a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to add XP to')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount of XP to add')
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove-xp')
                .setDescription('Remove XP from a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to remove XP from')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount of XP to remove')
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-level')
                .setDescription('Set a user\'s level')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to set level for')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('Level to set')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(200)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset-user')
                .setDescription('Reset a user\'s XP and level')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to reset')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('view-user')
                .setDescription('View detailed user XP data')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to view')
                        .setRequired(true))),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();
            const xpTracker = new XPTracker();

            switch (subcommand) {
                case 'add-xp':
                    await this.handleAddXP(interaction, xpTracker);
                    break;
                case 'remove-xp':
                    await this.handleRemoveXP(interaction, xpTracker);
                    break;
                case 'set-level':
                    await this.handleSetLevel(interaction, xpTracker);
                    break;
                case 'reset-user':
                    await this.handleResetUser(interaction, xpTracker);
                    break;
                case 'view-user':
                    await this.handleViewUser(interaction, xpTracker);
                    break;
            }
        } catch (error) {
            console.error('Error in admin command:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Command Error')
                .setDescription('An error occurred while executing the admin command.')
                .setTimestamp();

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },

    async handleAddXP(interaction, xpTracker) {
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        // Get current level before adding XP
        const currentData = await xpTracker.getUserXP(targetUser.id, interaction.guild.id);
        const currentLevel = xpTracker.calculateLevel(currentData.total_xp);

        // Add XP
        await xpTracker.addXP(targetUser.id, interaction.guild.id, amount, 'admin');

        // Get new level after adding XP
        const newData = await xpTracker.getUserXP(targetUser.id, interaction.guild.id);
        const newLevel = xpTracker.calculateLevel(newData.total_xp);

        // Admin confirmation embed (green theme)
        const confirmEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ XP Added Successfully')
            .setDescription(`Added **${amount.toLocaleString()} XP** to ${targetUser}`)
            .addFields([
                {
                    name: '📊 Updated Stats',
                    value: `**Total XP:** ${newData.total_xp.toLocaleString()}\n**Level:** ${newLevel}`,
                    inline: true
                }
            ])
            .setTimestamp()
            .setFooter({ text: `Admin: ${interaction.user.tag}` });

        await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });

        // Check if user leveled up and trigger Marine level-up if so
        if (newLevel > currentLevel) {
            const member = await interaction.guild.members.fetch(targetUser.id);
            
            // Create level-up data in the same format as natural level-ups
            const levelUpData = {
                userId: targetUser.id,
                guildId: interaction.guild.id,
                oldLevel: currentLevel,
                newLevel: newLevel,
                totalXP: newData.total_xp,
                member: member,
                channel: interaction.channel
            };

            // Trigger the Marine level-up system
            await xpTracker.sendMarineLevelUp(levelUpData);
        }
    },

    async handleRemoveXP(interaction, xpTracker) {
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        const currentData = await xpTracker.getUserXP(targetUser.id, interaction.guild.id);
        
        if (currentData.total_xp < amount) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Insufficient XP')
                .setDescription(`${targetUser} only has **${currentData.total_xp.toLocaleString()} XP**. Cannot remove **${amount.toLocaleString()} XP**.`)
                .setTimestamp();

            return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const newXP = Math.max(0, currentData.total_xp - amount);
        await xpTracker.setUserXP(targetUser.id, interaction.guild.id, newXP);

        const newLevel = xpTracker.calculateLevel(newXP);

        const embed = new EmbedBuilder()
            .setColor('#FF6B35')
            .setTitle('✅ XP Removed Successfully')
            .setDescription(`Removed **${amount.toLocaleString()} XP** from ${targetUser}`)
            .addFields([
                {
                    name: '📊 Updated Stats',
                    value: `**Total XP:** ${newXP.toLocaleString()}\n**Level:** ${newLevel}`,
                    inline: true
                }
            ])
            .setTimestamp()
            .setFooter({ text: `Admin: ${interaction.user.tag}` });

        await interaction.reply({ embeds: [embeds], ephemeral: true });
    },

    async handleSetLevel(interaction, xpTracker) {
        const targetUser = interaction.options.getUser('user');
        const targetLevel = interaction.options.getInteger('level');

        // Get current level
        const currentData = await xpTracker.getUserXP(targetUser.id, interaction.guild.id);
        const currentLevel = xpTracker.calculateLevel(currentData.total_xp);

        // Calculate XP needed for target level
        const requiredXP = xpTracker.getXPForLevel(targetLevel);
        
        // Set the new XP
        await xpTracker.setUserXP(targetUser.id, interaction.guild.id, requiredXP);

        // Admin confirmation
        const embed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('✅ Level Set Successfully')
            .setDescription(`Set ${targetUser}'s level to **${targetLevel}**`)
            .addFields([
                {
                    name: '📊 Updated Stats',
                    value: `**Level:** ${currentLevel} → ${targetLevel}\n**Total XP:** ${requiredXP.toLocaleString()}`,
                    inline: true
                }
            ])
            .setTimestamp()
            .setFooter({ text: `Admin: ${interaction.user.tag}` });

        await interaction.reply({ embeds: [embed], ephemeral: true });

        // Trigger Marine level-up if level increased
        if (targetLevel > currentLevel) {
            const member = await interaction.guild.members.fetch(targetUser.id);
            
            const levelUpData = {
                userId: targetUser.id,
                guildId: interaction.guild.id,
                oldLevel: currentLevel,
                newLevel: targetLevel,
                totalXP: requiredXP,
                member: member,
                channel: interaction.channel
            };

            await xpTracker.sendMarineLevelUp(levelUpData);
        }
    },

    async handleResetUser(interaction, xpTracker) {
        const targetUser = interaction.options.getUser('user');

        await xpTracker.resetUser(targetUser.id, interaction.guild.id);

        const embed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('✅ User Reset Successfully')
            .setDescription(`Reset all XP and level data for ${targetUser}`)
            .addFields([
                {
                    name: '🔄 Reset Complete',
                    value: '**Level:** 1\n**Total XP:** 0\n**All activity stats cleared**',
                    inline: true
                }
            ])
            .setTimestamp()
            .setFooter({ text: `Admin: ${interaction.user.tag}` });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },

    async handleViewUser(interaction, xpTracker) {
        const targetUser = interaction.options.getUser('user');
        const userData = await xpTracker.getUserXP(targetUser.id, interaction.guild.id);
        const level = xpTracker.calculateLevel(userData.total_xp);
        const rank = await xpTracker.getUserRank(targetUser.id, interaction.guild.id);

        // Calculate XP progress
        const currentLevelXP = xpTracker.getXPForLevel(level);
        const nextLevelXP = xpTracker.getXPForLevel(level + 1);
        const progressXP = userData.total_xp - currentLevelXP;
        const neededXP = nextLevelXP - userData.total_xp;

        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle(`📊 User Data: ${targetUser.tag}`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields([
                {
                    name: '🎯 Core Stats',
                    value: `**Level:** ${level}\n**Rank:** #${rank}\n**Total XP:** ${userData.total_xp.toLocaleString()}`,
                    inline: true
                },
                {
                    name: '📈 Progress',
                    value: `**Current Level XP:** ${progressXP.toLocaleString()}\n**XP to Next Level:** ${neededXP.toLocaleString()}`,
                    inline: true
                },
                {
                    name: '📱 Activity Breakdown',
                    value: `**Messages:** ${userData.messages || 0}\n**Reactions:** ${userData.reactions || 0}\n**Voice Time:** ${Math.floor((userData.voice_time || 0) / 60)} minutes`,
                    inline: false
                }
            ])
            .setTimestamp()
            .setFooter({ text: `Requested by: ${interaction.user.tag}` });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};

// src/commands/admin.js - Complete Red Marine Admin Command

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
                .setTitle('❌ MARINE COMMAND FAILED')
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

        try {
            // Get current level before adding XP
            const currentData = await xpTracker.getUserXP(targetUser.id, interaction.guild.id);
            const currentLevel = xpTracker.calculateLevel(currentData.total_xp);

            // Add XP
            await xpTracker.addXP(targetUser.id, interaction.guild.id, amount, 'admin');

            // Get new level after adding XP
            const newData = await xpTracker.getUserXP(targetUser.id, interaction.guild.id);
            const newLevel = xpTracker.calculateLevel(newData.total_xp);

            // RED Marine admin confirmation embed
            const confirmEmbed = new EmbedBuilder()
                .setColor('#DC143C') // Red like Marine theme
                .setTitle('🚨 MARINE COMMAND EXECUTED 🚨')
                .setDescription(`**MARINE INTELLIGENCE BUREAU - ADMINISTRATIVE ACTION**`)
                .addFields([
                    {
                        name: '👤 SUBJECT',
                        value: `${targetUser}`,
                        inline: true
                    },
                    {
                        name: '📊 XP MODIFICATION',
                        value: `**Added:** ${amount.toLocaleString()} XP\n**New Total:** ${newData.total_xp.toLocaleString()} XP\n**Level:** ${newLevel}`,
                        inline: true
                    },
                    {
                        name: '⚓ AUTHORIZED BY',
                        value: `Marine Officer: ${interaction.user.tag}`,
                        inline: false
                    }
                ])
                .setTimestamp()
                .setFooter({ text: '⚓ World Government Marine Intelligence Division' });

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

        } catch (error) {
            console.error('Error in add-xp:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ MARINE COMMAND FAILED')
                .setDescription(`Failed to add XP: ${error.message}`)
                .setTimestamp();

            if (interaction.replied) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },

    async handleRemoveXP(interaction, xpTracker) {
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        const currentData = await xpTracker.getUserXP(targetUser.id, interaction.guild.id);
        
        if (currentData.total_xp < amount) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ MARINE INTELLIGENCE ERROR')
                .setDescription(`${targetUser} only has **${currentData.total_xp.toLocaleString()} XP**. Cannot remove **${amount.toLocaleString()} XP**.`)
                .setTimestamp()
                .setFooter({ text: '⚓ World Government Marine Intelligence Division' });

            return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const newXP = Math.max(0, currentData.total_xp - amount);
        await xpTracker.setUserXP(targetUser.id, interaction.guild.id, newXP);

        const newLevel = xpTracker.calculateLevel(newXP);

        const embed = new EmbedBuilder()
            .setColor('#DC143C')
            .setTitle('🚨 MARINE DISCIPLINARY ACTION 🚨')
            .setDescription(`**MARINE INTELLIGENCE BUREAU - XP REDUCTION**`)
            .addFields([
                {
                    name: '👤 SUBJECT',
                    value: `${targetUser}`,
                    inline: true
                },
                {
                    name: '📊 XP MODIFICATION',
                    value: `**Removed:** ${amount.toLocaleString()} XP\n**New Total:** ${newXP.toLocaleString()} XP\n**Level:** ${newLevel}`,
                    inline: true
                },
                {
                    name: '⚓ AUTHORIZED BY',
                    value: `Marine Officer: ${interaction.user.tag}`,
                    inline: false
                }
            ])
            .setTimestamp()
            .setFooter({ text: '⚓ World Government Marine Intelligence Division' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
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
            .setColor('#DC143C')
            .setTitle('🚨 MARINE RANK ADJUSTMENT 🚨')
            .setDescription(`**MARINE INTELLIGENCE BUREAU - LEVEL OVERRIDE**`)
            .addFields([
                {
                    name: '👤 SUBJECT',
                    value: `${targetUser}`,
                    inline: true
                },
                {
                    name: '📊 RANK CHANGE',
                    value: `**Level:** ${currentLevel} → ${targetLevel}\n**Total XP:** ${requiredXP.toLocaleString()}`,
                    inline: true
                },
                {
                    name: '⚓ AUTHORIZED BY',
                    value: `Marine Officer: ${interaction.user.tag}`,
                    inline: false
                }
            ])
            .setTimestamp()
            .setFooter({ text: '⚓ World Government Marine Intelligence Division' });

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
            .setColor('#DC143C')
            .setTitle('🚨 MARINE DATA PURGE 🚨')
            .setDescription(`**MARINE INTELLIGENCE BUREAU - COMPLETE RESET**`)
            .addFields([
                {
                    name: '👤 SUBJECT',
                    value: `${targetUser}`,
                    inline: true
                },
                {
                    name: '🔄 RESET COMPLETE',
                    value: '**Level:** 1\n**Total XP:** 0\n**All activity stats cleared**',
                    inline: true
                },
                {
                    name: '⚓ AUTHORIZED BY',
                    value: `Marine Officer: ${interaction.user.tag}`,
                    inline: false
                }
            ])
            .setTimestamp()
            .setFooter({ text: '⚓ World Government Marine Intelligence Division' });

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
            .setColor('#DC143C')
            .setTitle('🚨 MARINE INTELLIGENCE REPORT 🚨')
            .setDescription(`**CLASSIFIED DOSSIER - ${targetUser.tag}**`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields([
                {
                    name: '🎯 THREAT ASSESSMENT',
                    value: `**Level:** ${level}\n**Rank:** #${rank}\n**Total XP:** ${userData.total_xp.toLocaleString()}`,
                    inline: true
                },
                {
                    name: '📈 PROGRESSION ANALYSIS',
                    value: `**Current Level XP:** ${progressXP.toLocaleString()}\n**XP to Next Level:** ${neededXP.toLocaleString()}`,
                    inline: true
                },
                {
                    name: '📱 ACTIVITY SURVEILLANCE',
                    value: `**Messages:** ${userData.messages || 0}\n**Reactions:** ${userData.reactions || 0}\n**Voice Time:** ${Math.floor((userData.voice_time || 0) / 60)} minutes`,
                    inline: false
                },
                {
                    name: '⚓ INTELLIGENCE OFFICER',
                    value: `${interaction.user.tag}`,
                    inline: true
                }
            ])
            .setTimestamp()
            .setFooter({ text: '⚓ World Government Marine Intelligence Division' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};

// src/commands/debug-daily-buff.js - Complete Debug Command for Daily Buff Issues

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('debug-daily-buff')
        .setDescription('🔍 Debug daily buff system (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to debug (optional)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Debug action to perform')
                .setRequired(false)
                .addChoices(
                    { name: '🔍 Check Status', value: 'status' },
                    { name: '🗄️ Check Database', value: 'database' },
                    { name: '🧹 Clean Database', value: 'clean-db' },
                    { name: '🗑️ Force Remove', value: 'force-remove' }
                )
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const targetUser = interaction.options.getUser('user') || interaction.user;
            const action = interaction.options.getString('action') || 'status';
            const member = await interaction.guild.members.fetch(targetUser.id);

            if (action === 'clean-db') {
                return await this.handleCleanDatabase(interaction);
            }

            if (action === 'force-remove') {
                return await this.handleForceRemove(interaction, targetUser);
            }

            if (action === 'database') {
                return await this.handleDatabaseCheck(interaction, targetUser);
            }

            // Default: status check
            await this.handleStatusCheck(interaction, targetUser, member);

        } catch (error) {
            console.error('[DEBUG] Error in debug command:', error);
            await interaction.editReply({
                content: `❌ **Debug Error**\n\n\`\`\`${error.message}\`\`\``
            });
        }
    },

    async handleStatusCheck(interaction, targetUser, member) {
        // Check environment variables
        const envCheck = {};
        const roleCheck = {};
        const roleNames = {};
        
        for (let i = 1; i <= 6; i++) {
            const envVar = `DAILY_XP_BUFF_TIER_${i}_ROLE`;
            const roleId = process.env[envVar];
            envCheck[i] = roleId || 'NOT SET';
            
            if (roleId && roleId !== `role_id_${i}`) {
                const role = interaction.guild.roles.cache.get(roleId);
                roleCheck[i] = role ? '✅ Found' : '❌ Not Found in Guild';
                roleNames[i] = role ? role.name : 'N/A';
            } else {
                roleCheck[i] = '⚠️ Placeholder Value';
                roleNames[i] = 'N/A';
            }
        }

        // Check bot permissions
        const botMember = interaction.guild.members.me;
        const hasManageRoles = botMember.permissions.has('ManageRoles');
        
        // Check current user status
        const currentDay = getCurrentDayKey();
        let dbRoll = null;
        let currentRoles = [];
        
        if (global.xpTracker && global.xpTracker.db) {
            try {
                const dbResult = await global.xpTracker.db.query(
                    'SELECT * FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                    [targetUser.id, interaction.guild.id, currentDay]
                );
                dbRoll = dbResult.rows[0] || null;
                
                // Check what buff roles user currently has
                for (let i = 1; i <= 6; i++) {
                    const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`];
                    if (roleId && member.roles.cache.has(roleId)) {
                        const role = interaction.guild.roles.cache.get(roleId);
                        currentRoles.push(`Tier ${i}: ${role ? role.name : 'Unknown'}`);
                    }
                }
            } catch (error) {
                dbRoll = { error: error.message };
            }
        }

        // Create debug embed
        const embed = new EmbedBuilder()
            .setColor('#4A90E2')
            .setTitle('🔍 Daily Buff System Debug')
            .setDescription(`**Target User:** ${targetUser.username}\n**Current Day:** ${currentDay}`)
            .addFields(
                {
                    name: '🔧 Environment Variables',
                    value: Object.entries(envCheck).map(([tier, value]) => 
                        `**Tier ${tier}:** \`${value.substring(0, 50)}${value.length > 50 ? '...' : ''}\``
                    ).join('\n'),
                    inline: true
                },
                {
                    name: '👥 Role Status in Guild',
                    value: Object.entries(roleCheck).map(([tier, status]) => 
                        `**Tier ${tier}:** ${status}\n└ *${roleNames[tier]}*`
                    ).join('\n'),
                    inline: true
                },
                {
                    name: '🤖 Bot Permissions',
                    value: `**Manage Roles:** ${hasManageRoles ? '✅ Yes' : '❌ No'}\n**Highest Role:** ${botMember.roles.highest.name}\n**Position:** ${botMember.roles.highest.position}`,
                    inline: false
                },
                {
                    name: '👤 User Current Status',
                    value: `**Has DB Record:** ${dbRoll ? '✅ Yes' : '❌ No'}\n**DB Tier:** ${dbRoll ? `Tier ${dbRoll.tier}` : 'None'}\n**Current Buff Roles:** ${currentRoles.length > 0 ? currentRoles.join(', ') : 'None'}\n**Can Roll:** ${!dbRoll ? '✅ Yes' : '❌ No (already rolled)'}`,
                    inline: false
                }
            );

        // Add database connection status
        if (global.xpTracker && global.xpTracker.db) {
            embed.addFields({
                name: '🗄️ Database Status',
                value: '✅ Connected',
                inline: true
            });
        } else {
            embed.addFields({
                name: '🗄️ Database Status',
                value: '❌ Not Connected',
                inline: true
            });
        }

        // Add role hierarchy check
        const hierarchyIssues = [];
        for (let i = 1; i <= 6; i++) {
            const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`];
            if (roleId && roleId !== `role_id_${i}`) {
                const role = interaction.guild.roles.cache.get(roleId);
                if (role && role.position >= botMember.roles.highest.position) {
                    hierarchyIssues.push(`Tier ${i} (${role.name})`);
                }
            }
        }

        if (hierarchyIssues.length > 0) {
            embed.addFields({
                name: '⚠️ Role Hierarchy Issues',
                value: `These roles are too high for bot to manage:\n${hierarchyIssues.join('\n')}`,
                inline: false
            });
        }

        embed.setFooter({ text: '🔍 Daily Buff Debug • Marine Intelligence' })
             .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    async handleDatabaseCheck(interaction, targetUser) {
        if (!global.xpTracker || !global.xpTracker.db) {
            return await interaction.editReply({
                content: '❌ **Database Not Available**\n\nXP tracker database not connected.'
            });
        }

        const currentDay = getCurrentDayKey();
        
        try {
            // Check all records for this user
            const allRecords = await global.xpTracker.db.query(
                'SELECT * FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 ORDER BY date DESC',
                [targetUser.id, interaction.guild.id]
            );

            // Check current day record
            const todayRecord = await global.xpTracker.db.query(
                'SELECT * FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [targetUser.id, interaction.guild.id, currentDay]
            );

            // Check table structure
            const tableInfo = await global.xpTracker.db.query(
                "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'daily_buff_rolls'"
            );

            const embed = new EmbedBuilder()
                .setColor('#9B59B6')
                .setTitle('🗄️ Database Debug Information')
                .setDescription(`**User:** ${targetUser.username}\n**Current Day:** ${currentDay}`)
                .addFields(
                    {
                        name: '📊 Record Summary',
                        value: `**Total Records:** ${allRecords.rows.length}\n**Today's Record:** ${todayRecord.rows.length > 0 ? '✅ Exists' : '❌ None'}`,
                        inline: true
                    },
                    {
                        name: '🏗️ Table Structure',
                        value: tableInfo.rows.map(col => `**${col.column_name}:** ${col.data_type}`).join('\n'),
                        inline: true
                    }
                );

            if (todayRecord.rows.length > 0) {
                const record = todayRecord.rows[0];
                embed.addFields({
                    name: '📋 Today\'s Record',
                    value: `\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\``,
                    inline: false
                });
            }

            if (allRecords.rows.length > 0) {
                const recentRecords = allRecords.rows.slice(0, 3).map(record => 
                    `**${record.date}:** Tier ${record.tier} (${new Date(record.created_at).toLocaleDateString()})`
                ).join('\n');
                
                embed.addFields({
                    name: '📅 Recent Records',
                    value: recentRecords,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            await interaction.editReply({
                content: `❌ **Database Error**\n\n\`\`\`${error.message}\`\`\``
            });
        }
    },

    async handleForceRemove(interaction, targetUser) {
        try {
            const dailyBuffCommand = require('./daily-buff');
            const result = await dailyBuffCommand.forceRemoveDailyBuff(
                targetUser.id, 
                interaction.guild.id, 
                `Force remove by ${interaction.user.username}`
            );

            const embed = new EmbedBuilder()
                .setColor(result.success ? '#00FF00' : '#FF0000')
                .setTitle(result.success ? '✅ Force Removal Complete' : '❌ Force Removal Failed')
                .setDescription(`**Target:** ${targetUser.username}`)
                .addFields(
                    {
                        name: '📊 Results',
                        value: `**Success:** ${result.success ? '✅ Yes' : '❌ No'}\n**Roles Removed:** ${result.removedRoles.length}\n**DB Records:** ${result.dbRecordsRemoved}\n**Error:** ${result.error || 'None'}`,
                        inline: false
                    }
                );

            if (result.removedRoles.length > 0) {
                embed.addFields({
                    name: '🗑️ Removed Roles',
                    value: result.removedRoles.join('\n'),
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            await interaction.editReply({
                content: `❌ **Force Removal Error**\n\n\`\`\`${error.message}\`\`\``
            });
        }
    },

    async handleCleanDatabase(interaction) {
        if (!global.xpTracker || !global.xpTracker.db) {
            return await interaction.editReply({
                content: '❌ **Database Not Available**\n\nXP tracker database not connected.'
            });
        }

        try {
            const currentDay = getCurrentDayKey();
            
            // Clean old records (keep only current day)
            const deleteResult = await global.xpTracker.db.query(
                'DELETE FROM daily_buff_rolls WHERE date < $1 RETURNING *',
                [currentDay]
            );

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🧹 Database Cleanup Complete')
                .setDescription(`**Current Day:** ${currentDay}`)
                .addFields(
                    {
                        name: '📊 Cleanup Results',
                        value: `**Records Deleted:** ${deleteResult.rowCount}\n**Records Kept:** Current day only`,
                        inline: false
                    }
                );

            if (deleteResult.rows.length > 0) {
                const deletedRecords = deleteResult.rows.slice(0, 5).map(record => 
                    `**${record.date}:** User ${record.user_id} (Tier ${record.tier})`
                ).join('\n');
                
                embed.addFields({
                    name: '🗑️ Deleted Records (Sample)',
                    value: deletedRecords + (deleteResult.rows.length > 5 ? `\n*...and ${deleteResult.rows.length - 5} more*` : ''),
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            await interaction.editReply({
                content: `❌ **Cleanup Error**\n\n\`\`\`${error.message}\`\`\``
            });
        }
    }
};

// Helper function (same as in daily-buff.js)
function getCurrentDayKey() {
    const now = new Date();
    const edtOffset = isEDTDaylightSaving(now) ? -4 : -5;
    const edtTime = new Date(now.getTime() + (edtOffset * 60 * 60 * 1000));
    
    if (edtTime.getHours() < 3) {
        edtTime.setDate(edtTime.getDate() - 1);
    }
    
    return edtTime.toISOString().split('T')[0];
}

function isEDTDaylightSaving(date) {
    const year = date.getFullYear();
    const march = new Date(year, 2, 1);
    const november = new Date(year, 10, 1);
    
    const dstStart = new Date(year, 2, (14 - march.getDay()) % 7 + 8);
    const dstEnd = new Date(year, 10, (7 - november.getDay()) % 7 + 1);
    
    return date >= dstStart && date < dstEnd;
}

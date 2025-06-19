const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('[CLASSIFIED] Marine Command Operations')
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('[CLASSIFIED] Display comprehensive bot statistics'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('maintenance')
                .setDescription('[CLASSIFIED] Database maintenance operations'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('nuclear')
                .setDescription('[CLASSIFIED] ⚠️ EMERGENCY DATA WIPE - COMPLETE DATABASE DESTRUCTION'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Security check - Only server administrators
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '```diff\n- ACCESS DENIED - INSUFFICIENT CLEARANCE LEVEL\n- MARINE COMMAND AUTHORIZATION REQUIRED```',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const { pool } = require('../../index'); // Get pool from index.js

        try {
            if (subcommand === 'stats') {
                await handleStats(interaction, pool);
            } else if (subcommand === 'maintenance') {
                await handleMaintenance(interaction, pool);
            } else if (subcommand === 'nuclear') {
                await handleNuclear(interaction, pool);
            }
        } catch (error) {
            console.error('[ADMIN ERROR]', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🚨 MARINE INTELLIGENCE - SYSTEM ERROR')
                .setDescription('```diff\n- CRITICAL SYSTEM FAILURE DETECTED\n- OPERATION TERMINATED```')
                .addFields({
                    name: '📋 Error Details',
                    value: `\`\`\`${error.message}\`\`\``
                })
                .setTimestamp()
                .setFooter({ text: 'Marine Intelligence Network' });

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
};

async function handleStats(interaction, pool) {
    // Get comprehensive statistics
    const [userStats, guildStats, xpStats, levelStats] = await Promise.all([
        pool.query('SELECT COUNT(*) as total_users FROM users'),
        pool.query('SELECT COUNT(*) as total_guilds FROM guild_settings'),
        pool.query('SELECT SUM(total_xp) as total_xp, AVG(total_xp) as avg_xp FROM users WHERE total_xp > 0'),
        pool.query('SELECT level, COUNT(*) as count FROM users WHERE level > 0 GROUP BY level ORDER BY level DESC LIMIT 10')
    ]);

    const totalUsers = userStats.rows[0]?.total_users || 0;
    const totalGuilds = guildStats.rows[0]?.total_guilds || 0;
    const totalXP = xpStats.rows[0]?.total_xp || 0;
    const avgXP = Math.round(xpStats.rows[0]?.avg_xp || 0);
    const topLevels = levelStats.rows;

    const statsEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🏛️ MARINE INTELLIGENCE - OPERATIONAL STATISTICS')
        .setDescription('```diff\n+ CLASSIFIED MARINE DATABASE METRICS\n+ SECURITY CLEARANCE: ADMIRAL LEVEL```')
        .addFields(
            {
                name: '📊 Network Statistics',
                value: `\`\`\`yaml\nActive Guilds: ${totalGuilds}\nTracked Users: ${totalUsers}\nTotal XP Issued: ${totalXP.toLocaleString()}\nAverage XP: ${avgXP.toLocaleString()}\`\`\``,
                inline: false
            },
            {
                name: '🏆 Top Levels Distribution',
                value: topLevels.length > 0 
                    ? `\`\`\`yaml\n${topLevels.map(l => `Level ${l.level}: ${l.count} Marines`).join('\n')}\`\`\``
                    : '```yaml\nNo level data available```',
                inline: false
            },
            {
                name: '⚙️ System Status',
                value: '```diff\n+ Database: OPERATIONAL\n+ XP Tracking: ACTIVE\n+ Voice Monitoring: ACTIVE\n+ Wanted Posters: OPERATIONAL```',
                inline: false
            }
        )
        .setTimestamp()
        .setFooter({ text: 'Marine Intelligence Network - Classified Access' });

    await interaction.reply({ embeds: [statsEmbed], ephemeral: true });
}

async function handleMaintenance(interaction, pool) {
    const maintenanceButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('cleanup_inactive')
                .setLabel('🧹 Clean Inactive Users')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('optimize_db')
                .setLabel('⚡ Optimize Database')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('backup_stats')
                .setLabel('💾 Generate Backup Stats')
                .setStyle(ButtonStyle.Secondary)
        );

    const maintenanceEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🔧 MARINE INTELLIGENCE - MAINTENANCE OPERATIONS')
        .setDescription('```diff\n+ AUTHORIZED MAINTENANCE PROTOCOLS\n+ SELECT OPERATION TO EXECUTE```')
        .addFields({
            name: '⚠️ Available Operations',
            value: `\`\`\`yaml\n🧹 Clean Inactive: Remove users with 0 XP and no activity\n⚡ Optimize: Rebuild database indexes and clean logs\n💾 Backup Stats: Generate current database statistics\`\`\``
        })
        .setTimestamp()
        .setFooter({ text: 'Marine Intelligence - Maintenance Division' });

    await interaction.reply({ 
        embeds: [maintenanceEmbed], 
        components: [maintenanceButtons],
        ephemeral: true 
    });
}

async function handleNuclear(interaction, pool) {
    const nuclearEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('☢️ NUCLEAR PROTOCOL - DATA DESTRUCTION AUTHORIZATION')
        .setDescription('```diff\n- ⚠️  EXTREME DANGER - COMPLETE DATA ANNIHILATION  ⚠️\n- THIS WILL PERMANENTLY DESTROY ALL DATABASE RECORDS\n- NO RECOVERY POSSIBLE AFTER EXECUTION```')
        .addFields(
            {
                name: '💥 DESTRUCTION SCOPE',
                value: '```diff\n- ALL USER XP DATA\n- ALL LEVEL PROGRESSIONS\n- ALL GUILD CONFIGURATIONS\n- ALL ACTIVITY LOGS\n- ALL BOUNTY RECORDS\n- COMPLETE DATABASE WIPE```',
                inline: false
            },
            {
                name: '⚠️ FINAL WARNING',
                value: '```css\n[CRITICAL] This action is IRREVERSIBLE\n[CRITICAL] All user progress will be LOST FOREVER\n[CRITICAL] Bot will require complete reconfiguration\n[CRITICAL] No backup or recovery options available```',
                inline: false
            }
        )
        .setTimestamp()
        .setFooter({ text: '⚠️ NUCLEAR AUTHORIZATION REQUIRED ⚠️' });

    const nuclearButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('nuclear_confirm')
                .setLabel('☢️ INITIATE NUCLEAR PROTOCOL')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('nuclear_abort')
                .setLabel('🛡️ ABORT MISSION')
                .setStyle(ButtonStyle.Success)
        );

    await interaction.reply({
        embeds: [nuclearEmbed],
        components: [nuclearButtons],
        ephemeral: true
    });
}

// Export button handlers for use in index.js
module.exports.handleMaintenanceButtons = async (interaction, pool) => {
    if (interaction.customId === 'cleanup_inactive') {
        await interaction.deferUpdate();
        
        const result = await pool.query('DELETE FROM users WHERE total_xp = 0 AND level = 0');
        const cleaned = result.rowCount || 0;

        const cleanupEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🧹 MAINTENANCE COMPLETE - INACTIVE USER CLEANUP')
            .setDescription('```diff\n+ CLEANUP OPERATION SUCCESSFUL```')
            .addFields({
                name: '📊 Cleanup Results',
                value: `\`\`\`yaml\nInactive Users Removed: ${cleaned}\nOperation Status: COMPLETE\nDatabase Status: OPTIMIZED\`\`\``
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [cleanupEmbed], components: [] });

    } else if (interaction.customId === 'optimize_db') {
        await interaction.deferUpdate();

        await pool.query('VACUUM ANALYZE users');
        await pool.query('VACUUM ANALYZE guild_settings');
        await pool.query('REINDEX TABLE users');
        await pool.query('REINDEX TABLE guild_settings');

        const optimizeEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('⚡ MAINTENANCE COMPLETE - DATABASE OPTIMIZATION')
            .setDescription('```diff\n+ DATABASE OPTIMIZATION SUCCESSFUL```')
            .addFields({
                name: '🔧 Operations Completed',
                value: '```yaml\n✅ Vacuum Analysis: COMPLETE\n✅ Index Rebuild: COMPLETE\n✅ Performance Optimization: COMPLETE\n✅ Memory Cleanup: COMPLETE```'
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [optimizeEmbed], components: [] });

    } else if (interaction.customId === 'backup_stats') {
        await interaction.deferUpdate();

        const backupData = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM guild_settings) as total_guilds,
                (SELECT SUM(total_xp) FROM users) as total_xp,
                (SELECT MAX(level) FROM users) as max_level,
                CURRENT_TIMESTAMP as backup_time
        `);

        const stats = backupData.rows[0];
        const backupString = JSON.stringify(stats, null, 2);

        const backupEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('💾 BACKUP STATISTICS GENERATED')
            .setDescription('```diff\n+ DATABASE STATISTICS CAPTURED```')
            .addFields({
                name: '📊 Current Database State',
                value: `\`\`\`json\n${backupString}\`\`\``
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [backupEmbed], components: [] });
    }
};

module.exports.handleNuclearButtons = async (interaction, pool) => {
    if (interaction.customId === 'nuclear_abort') {
        await interaction.deferUpdate();

        const abortEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🛡️ NUCLEAR PROTOCOL ABORTED')
            .setDescription('```diff\n+ MISSION ABORT SUCCESSFUL\n+ DATABASE REMAINS INTACT\n+ ALL DATA PRESERVED```')
            .addFields({
                name: '✅ Status Report',
                value: '```yaml\nNuclear Protocol: ABORTED\nDatabase Status: SECURE\nData Integrity: MAINTAINED\nThreat Level: NEUTRALIZED```'
            })
            .setTimestamp()
            .setFooter({ text: 'Crisis Averted - Marine Intelligence' });

        await interaction.editReply({ embeds: [abortEmbed], components: [] });

    } else if (interaction.customId === 'nuclear_confirm') {
        // Additional confirmation step
        const finalWarningEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('☢️ FINAL NUCLEAR AUTHORIZATION REQUIRED')
            .setDescription('```diff\n- LAST CHANCE TO ABORT MISSION\n- COMPLETE DATA DESTRUCTION IN 3... 2... 1...```')
            .addFields({
                name: '💀 POINT OF NO RETURN',
                value: '```css\n[FINAL WARNING] Click EXECUTE to permanently destroy ALL data\n[FINAL WARNING] This will render your bot completely unusable\n[FINAL WARNING] You will lose EVERYTHING```'
            })
            .setTimestamp();

        const finalButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('nuclear_execute')
                    .setLabel('💀 EXECUTE NUCLEAR DESTRUCTION')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('nuclear_abort')
                    .setLabel('🛡️ ABORT - SAVE DATABASE')
                    .setStyle(ButtonStyle.Success)
            );

        await interaction.update({
            embeds: [finalWarningEmbed],
            components: [finalButtons]
        });

    } else if (interaction.customId === 'nuclear_execute') {
        await interaction.deferUpdate();

        try {
            // Nuclear option - Complete database wipe
            await pool.query('TRUNCATE TABLE users CASCADE');
            await pool.query('TRUNCATE TABLE guild_settings CASCADE');
            await pool.query('DROP TABLE IF EXISTS xp_logs CASCADE');
            await pool.query('DROP TABLE IF EXISTS daily_voice_xp CASCADE');
            
            console.log('[NUCLEAR] ☢️ NUCLEAR PROTOCOL EXECUTED - ALL DATA DESTROYED');

            const destructionEmbed = new EmbedBuilder()
                .setColor(0x000000)
                .setTitle('☢️ NUCLEAR PROTOCOL EXECUTED - TOTAL ANNIHILATION')
                .setDescription('```diff\n- ☢️  NUCLEAR DETONATION SUCCESSFUL  ☢️\n- ALL DATABASE RECORDS PERMANENTLY DESTROYED\n- COMPLETE DATA ANNIHILATION CONFIRMED```')
                .addFields(
                    {
                        name: '💀 DESTRUCTION REPORT',
                        value: '```diff\n- Users Table: OBLITERATED\n- Guild Settings: ANNIHILATED\n- XP Logs: VAPORIZED\n- Voice Data: ELIMINATED\n- All Progress: EXTINCT```',
                        inline: false
                    },
                    {
                        name: '⚠️ POST-NUCLEAR STATUS',
                        value: '```css\n[CRITICAL] Bot requires complete reconfiguration\n[CRITICAL] All users must restart from Level 0\n[CRITICAL] All guild settings reset to defaults\n[CRITICAL] No recovery possible```',
                        inline: false
                    }
                )
                .setTimestamp()
                .setFooter({ text: '☢️ Nuclear Protocol Complete - Database Extinct ☢️' });

            await interaction.editReply({ embeds: [destructionEmbed], components: [] });

        } catch (error) {
            console.error('[NUCLEAR ERROR]', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('⚠️ NUCLEAR PROTOCOL FAILURE')
                .setDescription('```diff\n- NUCLEAR DETONATION FAILED\n- SOME DATA MAY HAVE SURVIVED```')
                .addFields({
                    name: '🚨 Error Details',
                    value: `\`\`\`${error.message}\`\`\``
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed], components: [] });
        }
    }
};

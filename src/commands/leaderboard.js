// src/commands/leaderboard.js - Leaderboard Command Handler
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

// Simple debug replacement
const debug = {
    command: (...args) => console.log('[CMD]', ...args),
    error: (category, ...args) => console.error('[ERROR]', category, ...args)
};

class LeaderboardCommands {
    constructor(bot) {
        this.bot = bot;
        this.client = bot.client;
        this.db = bot.db;
        this.updateConfig();
    }

    // Update configuration references
    updateConfig() {
        this.config = this.bot.config;
        this.leaderboardConfig = this.bot.leaderboardConfig;
    }

    // Get command definitions
    getDefinitions() {
        return [
            new SlashCommandBuilder()
                .setName('leaderboard')
                .setDescription('View the server leaderboard')
                .addBooleanOption(option =>
                    option.setName('short_version')
                        .setDescription('Show only top 3 pirates (true) or top 10 pirates (false)')
                        .setRequired(false)
                )
        ];
    }

    // Handle leaderboard command
    async handleLeaderboard(interaction) {
        try {
            const guild = interaction.guild;
            const excludeRoleId = this.leaderboardConfig.excludeRole;
            const shortVersion = interaction.options.getBoolean('short_version') || false;
            
            debug.command(`Leaderboard command - Short version: ${shortVersion}, Exclude Role ID: ${excludeRoleId}`);
            
            // Get top users from database
            const result = await this.db.query(
                'SELECT user_id, level, total_xp FROM user_levels WHERE guild_id = $1 ORDER BY total_xp DESC LIMIT 25',
                [interaction.guild.id]
            );
            
            if (result.rows.length === 0) {
                return await interaction.reply({ 
                    content: 'No pirates have started their journey yet! 🏴‍☠️\n\n*Be the first to gain reputation by sending messages, adding reactions, or joining voice channels!*', 
                    flags: 64
                });
            }

            let pirateEmperors = [];
            let regularPirates = [];
            
            // Categorize users based on exclude role
            for (const userData of result.rows) {
                try {
                    const member = await guild.members.fetch(userData.user_id);
                    
                    // Skip bots
                    if (member.user.bot) continue;
                    
                    // Check if member has the excluded role (these become Pirate Emperors)
                    if (excludeRoleId && member.roles.cache.has(excludeRoleId)) {
                        debug.command(`Found Pirate Emperor: ${member.user.username} (has excluded role)`);
                        pirateEmperors.push({
                            member,
                            level: userData.level,
                            totalXp: userData.total_xp
                        });
                    } else {
                        regularPirates.push({
                            member,
                            level: userData.level,
                            totalXp: userData.total_xp
                        });
                    }
                } catch (error) {
                    debug.error(`Failed to fetch member ${userData.user_id}:`, error);
                    continue;
                }
            }

            debug.command(`Pirate Emperors found: ${pirateEmperors.length}, Regular Pirates: ${regularPirates.length}`);

            // Limit regular pirates based on short_version option
            const maxRegularPirates = shortVersion ? 3 : 10;
            regularPirates = regularPirates.slice(0, maxRegularPirates);

            if (pirateEmperors.length === 0 && regularPirates.length === 0) {
                return await interaction.reply({ 
                    content: 'No eligible pirates found for the leaderboard! 🏴‍☠️', 
                    flags: 64
                });
            }

            // Create main embed
            const embed = new EmbedBuilder()
                .setColor('#D4AF37')
                .setTitle('📰 WORLD ECONOMIC NEWS PAPER 📰')
                .setDescription(`**═══════════════════════════════════**\n🚨 **${shortVersion ? 'URGENT' : 'EMERGENCY'} BOUNTY UPDATE** 🚨\n**═══════════════════════════════════**`)
                .setTimestamp();
            
            let description = shortVersion ? 
                '```\n╔═══════════════════════════════════╗\n║       URGENT BOUNTY BULLETIN      ║\n║      TOP CRIMINALS IDENTIFIED     ║\n╚═══════════════════════════════════╝\n```\n\n' :
                '```\n╔═══════════════════════════════════╗\n║        MOST WANTED CRIMINALS      ║\n║     DEAD OR ALIVE - REWARD SET    ║\n╚═══════════════════════════════════╝\n```\n\n';

            // Add Pirate Emperors section
            if (pirateEmperors.length > 0) {
                description += '```diff\n+ ═══════ 👑 PIRATE EMPERORS 👑 ═══════\n```\n\n';
                
                for (let i = 0; i < pirateEmperors.length; i++) {
                    const userData = pirateEmperors[i];
                    const bountyAmount = this.bot.getBountyForLevel(userData.level);
                    
                    description += '```yaml\n';
                    description += `WANTED: ${userData.member.user.username.toUpperCase()}\n`;
                    description += `BOUNTY: ₿${bountyAmount}\n`;
                    description += `THREAT LEVEL: WORLD-CLASS\n`;
                    description += `STATUS: PIRATE EMPEROR\n`;
                    description += '```\n';
                    description += `👑 **Level ${userData.level}** | ⭐ **${userData.totalXp.toLocaleString()} Rep**\n\n`;
                }
                
                description += '```\n═══════════════════════════════════\n```\n\n';
            }

            // Add regular competition section
            if (regularPirates.length > 0) {
                const sectionTitle = shortVersion ? 
                    '```diff\n- ═══════ 🔥 TOP THREATS 🔥 ═══════\n```\n\n' :
                    '```diff\n- ═══════ 🏆 ACTIVE BOUNTIES 🏆 ═══════\n```\n\n';
                
                description += sectionTitle;
                
                for (let i = 0; i < regularPirates.length; i++) {
                    const userData = regularPirates[i];
                    const bountyAmount = this.bot.getBountyForLevel(userData.level);
                    
                    let rankEmoji;
                    let threat;
                    if (i === 0) {
                        rankEmoji = '🥇';
                        threat = 'EXTREMELY DANGEROUS';
                    } else if (i === 1) {
                        rankEmoji = '🥈';
                        threat = 'HIGHLY DANGEROUS';
                    } else if (i === 2) {
                        rankEmoji = '🥉';
                        threat = 'VERY DANGEROUS';
                    } else if (i === 3) {
                        rankEmoji = '4️⃣';
                        threat = 'DANGEROUS';
                    } else if (i === 4) {
                        rankEmoji = '5️⃣';
                        threat = 'DANGEROUS';
                    } else {
                        rankEmoji = `**${i + 1}.**`;
                        threat = 'WANTED';
                    }
                    
                    description += '```css\n';
                    description += `[RANK ${i + 1}] ${userData.member.user.username.toUpperCase()}\n`;
                    description += `BOUNTY: ₿${bountyAmount}\n`;
                    description += `THREAT: ${threat}\n`;
                    description += '```\n';
                    description += `${rankEmoji} ⚔️ **Level ${userData.level}** | ⭐ **${userData.totalXp.toLocaleString()} Rep**\n\n`;
                }
                
                // Add "and X more..." if short version and there are more pirates
                if (shortVersion && result.rows.length > 3 + pirateEmperors.length) {
                    const remainingCount = Math.min(result.rows.length - 3 - pirateEmperors.length, 7);
                    description += `*... and ${remainingCount} more dangerous pirates*\n\n`;
                }
            }
            
            // Add footer message
            const footerMessage = shortVersion ?
                '```\n╔═══════════════════════════════════╗\n║   USE /leaderboard FOR FULL LIST  ║\n║     STAY VIGILANT, STAY SAFE      ║\n╚═══════════════════════════════════╝\n```\n' :
                '```\n╔═══════════════════════════════════╗\n║  REPORT SIGHTINGS TO YOUR LOCAL   ║\n║        MARINE BASE IMMEDIATELY    ║\n╚═══════════════════════════════════╝\n```\n';
            
            description += footerMessage;
            
            embed.setDescription(description);
            
            // Set footer text
            let footerText = shortVersion ? 
                '⚖️ WORLD GOVERNMENT URGENT BULLETIN ⚖️ • TOP THREATS ONLY' :
                '⚖️ WORLD GOVERNMENT OFFICIAL PUBLICATION ⚖️ • MARINE HEADQUARTERS';
                
            if (pirateEmperors.length > 0) {
                const emperorText = pirateEmperors.length === 1 ? 'Pirate Emperor reigns' : 'Pirate Emperors reign';
                footerText = `🚨 ALERT: ${emperorText} supreme! 🚨 • ${footerText}`;
            }
            
            embed.setFooter({ text: footerText });

            await interaction.reply({ embeds: [embed] });
            
        } catch (error) {
            debug.error('Leaderboard Command', error);
            await interaction.reply({ 
                content: 'An error occurred while fetching the leaderboard. Please try again later.', 
                flags: 64
            });
        }
    }
}

module.exports = LeaderboardCommands;

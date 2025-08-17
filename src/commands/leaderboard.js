// src/commands/leaderboard.js - Complete file with fixed message deletion logic

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { getBountyForLevel } = require('../utils/bountySystem');
const path = require('path');

// Register custom fonts
try {
    registerFont(path.join(__dirname, '../../assets/fonts/captkd.ttf'), { family: 'CaptainKiddNF' });
    registerFont(path.join(__dirname, '../../assets/fonts/Cinzel-Bold.otf'), { family: 'Cinzel' });
    registerFont(path.join(__dirname, '../../assets/fonts/Times New Normal Regular.ttf'), { family: 'TimesNewNormal' });
    console.log('[DEBUG] Successfully registered custom fonts for wanted posters');
} catch (error) {
    console.error('[ERROR] Failed to register custom fonts:', error.message);
    console.log('[INFO] Falling back to system fonts');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Show server leaderboard')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of leaderboard to show')
                .setRequired(false)
                .addChoices(
                    { name: 'Top 3 Bounties', value: 'posters' },
                    { name: 'Top 10 Bounties', value: 'long' },
                    { name: 'All The Bounties', value: 'full' }
                )),

    async execute(interaction) {
        const isButton = interaction.isButton ? interaction.isButton() : false;
        const type = isButton ? interaction.customId.split('_')[1] : (interaction.options?.getString('type') || 'posters');

        console.log('[DEBUG] Leaderboard type:', type);

        // Defer the interaction early to prevent timeout
        try {
            if (isButton) {
                await interaction.deferUpdate();
            } else {
                await interaction.deferReply();
            }
        } catch (error) {
            console.log('[DEBUG] Could not defer interaction:', error.message);
            return;
        }

        // UPDATED: More conservative message cleanup - only for button interactions and with stricter filtering
        if (isButton) {
            const interactionTime = interaction.createdTimestamp;
            
            // Only run cleanup for button interactions, and wait longer
            setTimeout(async () => {
                try {
                    console.log('[LEADERBOARD] Starting conservative message cleanup...');
                    
                    const messages = await interaction.channel.messages.fetch({ limit: 50 }); // Reduced from 100 to 50
                    const toDelete = messages.filter(msg => {
                        // Only delete messages from our bot
                        if (msg.author.id !== interaction.client.user.id) return false;
                        
                        // Don't delete messages created after this button interaction
                        if (msg.createdTimestamp >= interactionTime) return false;
                        
                        // UPDATED: Only delete messages older than 30 seconds to avoid deleting current leaderboards
                        if (msg.createdTimestamp > (interactionTime - 30000)) return false;
                        
                        // UPDATED: More specific criteria - only delete if it's clearly an old leaderboard
                        if (msg.embeds.length > 0) {
                            const embed = msg.embeds[0];
                            
                            // Only delete if it's clearly a leaderboard embed AND it's old
                            const isLeaderboardEmbed = (
                                embed.author?.name?.includes('WORLD GOVERNMENT INTELLIGENCE BUREAU') ||
                                embed.title?.includes('BOUNTY UPDATE') ||
                                embed.description?.includes('TOP') && embed.description?.includes('WANTED')
                            );
                            
                            // UPDATED: Don't delete level-up messages or individual bounty updates
                            const isLevelUpMessage = (
                                embed.title?.includes('WORLD GOVERNMENT BOUNTY UPDATE') ||
                                embed.description?.includes('has reached a new level of infamy')
                            );
                            
                            // Only delete leaderboard embeds, not level-up messages
                            return isLeaderboardEmbed && !isLevelUpMessage;
                        }
                        
                        // Check for wanted poster attachments from old leaderboards
                        if (msg.attachments.size > 0) {
                            const hasWantedPoster = msg.attachments.some(attachment => 
                                attachment.name?.includes('wanted_') || 
                                attachment.name?.includes('bounty_')
                            );
                            
                            // UPDATED: Only delete if it's clearly from a leaderboard (has leaderboard buttons)
                            if (hasWantedPoster && msg.components && msg.components.length > 0) {
                                const hasLeaderboardButtons = msg.components.some(row => 
                                    row.components?.some(button => 
                                        button.customId?.includes('leaderboard_') ||
                                        button.label?.includes('Bounties')
                                    )
                                );
                                return hasLeaderboardButtons;
                            }
                        }
                        
                        return false;
                    });
                    
                    console.log(`[LEADERBOARD] Found ${toDelete.size} old leaderboard messages to delete (older than 30s)`);
                    
                    // Delete messages with longer delays to avoid rate limits
                    let deleteCount = 0;
                    for (const msg of toDelete.values()) {
                        try {
                            // Only delete up to 5 old messages to be conservative
                            if (deleteCount >= 5) break;
                            
                            await msg.delete();
                            deleteCount++;
                            console.log(`[LEADERBOARD] Deleted old message ${msg.id}`);
                            
                            // Longer delay between deletions
                            await new Promise(resolve => setTimeout(resolve, 500));
                        } catch (error) {
                            console.log(`[LEADERBOARD] Could not delete message ${msg.id}:`, error.message);
                        }
                    }
                    
                    console.log(`[LEADERBOARD] Cleanup complete: deleted ${deleteCount} old messages`);
                } catch (error) {
                    console.log('[LEADERBOARD] Could not clean up previous messages:', error.message);
                }
            }, 2000); // Wait 2 seconds before cleanup
        }

        try {
            // Get XP tracker instance from global
            const xpTracker = global.xpTracker;
            if (!xpTracker) {
                console.error('[ERROR] XP Tracker not found in global scope');
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Error')
                    .setDescription('XP Tracker not initialized. Please restart the bot.')
                    .setColor('#FF0000');

                return await interaction.editReply({ embeds: [errorEmbed], components: [] });
            }

            // Get excluded role ID from guild settings
            const settings = global.guildSettings?.get(interaction.guild.id) || {};
            const excludedRoleId = settings.excludedRole || process.env.LEADERBOARD_EXCLUDE_ROLE;
            console.log('[DEBUG] Excluded role ID:', excludedRoleId);
            
            // Get top users from database using the XP tracker
            console.log('[DEBUG] Getting leaderboard from XP tracker...');
            const leaderboardData = await xpTracker.getLeaderboard(interaction.guild.id);
            
            // Extract the users array from the leaderboard data
            const allUsers = leaderboardData?.users || [];
            console.log('[DEBUG] Raw users from database:', allUsers.length);

            // Find Pirate King manually by checking guild members with excluded role
            let pirateKing = null;
            if (excludedRoleId) {
                try {
                    const guild = interaction.guild;
                    const role = guild.roles.cache.get(excludedRoleId);
                    if (role && role.members.size > 0) {
                        // Get the first member with the Pirate King role
                        const pirateKingMember = role.members.first();
                        if (pirateKingMember) {
                            pirateKing = {
                                userId: pirateKingMember.user.id,
                                level: 55,
                                total_xp: 999999999,
                                messages: 0,
                                reactions: 0,
                                voice_time: 0,
                                member: pirateKingMember,
                                isPirateKing: true
                            };
                            console.log('[DEBUG] Found Pirate King:', pirateKingMember.displayName);
                        }
                    }
                } catch (error) {
                    console.error('[DEBUG] Error finding Pirate King:', error);
                }
            }

            // Filter users and remove any that have the excluded role
            const filteredUsers = [];

            console.log('[DEBUG] Processing users...');
            
            // Batch fetch members for better performance
            const userIds = allUsers.map(u => u.userId);
            const members = new Map();
            
            try {
                // Try to fetch all members at once
                const fetchedMembers = await interaction.guild.members.fetch({ user: userIds });
                fetchedMembers.forEach(member => members.set(member.id, member));
            } catch (error) {
                console.log('[DEBUG] Batch fetch failed, falling back to individual fetches');
                // Fallback to individual fetches if batch fails
                for (const user of allUsers) {
                    try {
                        const member = await interaction.guild.members.fetch(user.userId).catch(() => null);
                        if (member) members.set(user.userId, member);
                    } catch (err) {
                        console.log('[DEBUG] Could not fetch member:', user.userId);
                    }
                }
            }

            // Process users with cached members, excluding Pirate King from regular list
            for (const user of allUsers) {
                const member = members.get(user.userId);
                if (!member) continue;

                // Skip users with excluded role (they will be shown as Pirate King separately)
                if (excludedRoleId && member.roles.cache.has(excludedRoleId)) {
                    console.log('[DEBUG] Skipping excluded role user from regular leaderboard:', member.displayName);
                    continue;
                }

                filteredUsers.push({ ...user, member });
            }

            console.log('[DEBUG] Filtered users (excluding Pirate King):', filteredUsers.length);
            console.log('[DEBUG] Pirate King found:', !!pirateKing);

            if (!pirateKing && filteredUsers.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('🏴‍☠️ No Bounties Found')
                    .setDescription('No pirates have earned bounties yet!')
                    .setColor('#FF6B35');

                return await interaction.editReply({ embeds: [embed], components: [] });
            }

            // Create navigation buttons
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('leaderboard_posters_1_xp')
                        .setLabel('Top 3 Bounties')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('leaderboard_long_1_xp')
                        .setLabel('Top 10 Bounties')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('leaderboard_full_1_xp')
                        .setLabel('All The Bounties')
                        .setStyle(ButtonStyle.Danger)
                );

            // Helper function to get threat level name
            function getThreatLevelName(level) {
                if (level >= 55) return "LEGENDARY THREAT";
                if (level >= 50) return "EMPEROR CLASS";
                if (level >= 45) return "EXTRAORDINARY";
                if (level >= 40) return "ELITE LEVEL";
                if (level >= 35) return "TERRITORIAL";
                if (level >= 30) return "ADVANCED COMBATANT";
                if (level >= 25) return "HIGH PRIORITY";
                if (level >= 20) return "DANGEROUS";
                if (level >= 15) return "GRAND LINE";
                if (level >= 10) return "ELEVATED";
                if (level >= 5) return "CONFIRMED CRIMINAL";
                if (level >= 1) return "WANTED CRIMINAL";
                return "CIVILIAN";
            }

            if (type === 'posters') {
                // TOP 3 BOUNTIES
                const headerEmbed = new EmbedBuilder()
                    .setAuthor({ 
                        name: '🌐 WORLD GOVERNMENT INTELLIGENCE BUREAU'
                    })
                    .setColor(0xFF0000);

                let headerValue = `🚨 **TOP 3 MOST WANTED PIRATES** 🚨\n\n`;
                headerValue += `\`\`\`diff\n- MARINE INTELLIGENCE DIRECTIVE:\n- The following individuals represent the highest threat\n- levels currently under surveillance. Immediate\n- response protocols are authorized for any sightings.\n\`\`\``;

                headerEmbed.addFields({
                    name: '📋 OPERATION BRIEFING',
                    value: headerValue,
                    inline: false
                });

                // Send header first
                if (isButton) {
                    await interaction.editReply({ embeds: [headerEmbed] });
                } else {
                    await interaction.editReply({ embeds: [headerEmbed] });
                }

                // Only get Level 1+ users for canvas generation
                const level1PlusUsers = filteredUsers.filter(user => user.level >= 1);
                console.log('[DEBUG] Level 1+ users for canvas:', level1PlusUsers.length);

                // Create posters for Pirate King + Top 3 Level 1+ users
                const postersToShow = [];
                if (pirateKing) postersToShow.push(pirateKing);
                postersToShow.push(...level1PlusUsers.slice(0, 3));

                console.log('[DEBUG] Creating', postersToShow.length, 'posters for Top 3 (Level 1+ only)');

                // Send each poster with red intelligence embed
                for (let i = 0; i < postersToShow.length; i++) {
                    const userData = postersToShow[i];
                    const isPirateKingData = userData.isPirateKing || false;
                    const rank = isPirateKingData ? 'PIRATE KING' : `RANK ${i + (pirateKing ? 0 : 1)}`;
                    
                    try {
                        const canvas = await createWantedPoster(userData, interaction.guild);
                        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `wanted_${userData.userId}.png` });
                        
                        // Get bounty amount for embed
                        const bountyAmount = getBountyForLevel(userData.level, isPirateKingData);
                        
                        // Create intelligence embed for each poster
                        const embed = new EmbedBuilder()
                            .setAuthor({ 
                                name: '🌐 WORLD GOVERNMENT INTELLIGENCE BUREAU'
                            })
                            .setColor(isPirateKingData ? 0xFFD700 : 0xFF0000);

                        let intelligenceValue = `\`\`\`diff\n- Alias: ${userData.member.displayName}\n- Bounty: ฿${bountyAmount.toLocaleString()}\n- Level: ${userData.level} | Rank: ${rank}\n- Threat: ${isPirateKingData ? 'PIRATE KING' : getThreatLevelName(userData.level)}\n- Activity: ${userData.messages + userData.reactions + Math.floor(userData.voice_time / 60) > 1000 ? 'HIGH' : userData.messages + userData.reactions + Math.floor(userData.voice_time / 60) > 500 ? 'MODERATE' : userData.messages + userData.reactions + Math.floor(userData.voice_time / 60) > 100 ? 'LOW' : 'MINIMAL'}\n\`\`\``;

                        embed.addFields({
                            name: '📊 INTELLIGENCE SUMMARY',
                            value: intelligenceValue,
                            inline: false
                        });

                        if (isPirateKingData) {
                            embed.addFields({
                                name: '👑 SPECIAL CLASSIFICATION',
                                value: `\`\`\`diff\n- EMPEROR STATUS CONFIRMED\n- MAXIMUM THREAT DESIGNATION\n- APPROACH WITH EXTREME CAUTION\n\`\`\``,
                                inline: false
                            });
                        }

                        embed.setImage(`attachment://wanted_${userData.userId}.png`)
                            .setFooter({ 
                                text: `⚓ Marine Intelligence Division • Classification: ${isPirateKingData ? 'EMPEROR' : getThreatLevelName(userData.level)}`
                            })
                            .setTimestamp();

                        // Send individual poster - add buttons only to the last one
                        const isLastPoster = (i === postersToShow.length - 1);
                        const messageOptions = { embeds: [embed], files: [attachment] };
                        if (isLastPoster) {
                            messageOptions.components = [buttons];
                        }
                        
                        await interaction.followUp(messageOptions);
                        
                        // Small delay between posters
                        if (i < postersToShow.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                        
                    } catch (error) {
                        console.error('[ERROR] Error creating poster for user', userData.userId, ':', error);
                        continue;
                    }
                }

            } else if (type === 'long') {
                // TOP 10 BOUNTIES
                const headerEmbed = new EmbedBuilder()
                    .setAuthor({ 
                        name: '🌐 WORLD GOVERNMENT INTELLIGENCE BUREAU'
                    })
                    .setColor(0xFF0000);

                let headerValue = `🚨 **TOP 10 MOST WANTED PIRATES** 🚨\n\n`;
                headerValue += `\`\`\`diff\n- EXTENDED SURVEILLANCE REPORT:\n- This comprehensive assessment covers the ten most\n- dangerous pirates currently under Marine observation.\n- All personnel are advised to review threat profiles\n- and maintain heightened alert status.\n\`\`\``;

                headerEmbed.addFields({
                    name: '📋 EXTENDED OPERATION BRIEFING',
                    value: headerValue,
                    inline: false
                });

                // Send header first
                if (isButton) {
                    await interaction.editReply({ embeds: [headerEmbed] });
                } else {
                    await interaction.editReply({ embeds: [headerEmbed] });
                }

                // Only get Level 1+ users for canvas generation
                const level1PlusUsers = filteredUsers.filter(user => user.level >= 1);
                console.log('[DEBUG] Level 1+ users for canvas:', level1PlusUsers.length);

                // Create posters for Pirate King + Top 10 Level 1+ users
                const postersToShow = [];
                if (pirateKing) postersToShow.push(pirateKing);
                postersToShow.push(...level1PlusUsers.slice(0, 10));

                console.log('[DEBUG] Creating', postersToShow.length, 'posters for Top 10 (Level 1+ only)');

                // Send each poster with red intelligence embed
                for (let i = 0; i < postersToShow.length; i++) {
                    const userData = postersToShow[i];
                    const isPirateKingData = userData.isPirateKing || false;
                    const rank = isPirateKingData ? 'PIRATE KING' : `RANK ${i + (pirateKing ? 0 : 1)}`;
                    
                    try {
                        const canvas = await createWantedPoster(userData, interaction.guild);
                        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `wanted_${userData.userId}.png` });
                        
                        // Get bounty amount for embed
                        const bountyAmount = getBountyForLevel(userData.level, isPirateKingData);
                        
                        // Create intelligence embed for each poster
                        const embed = new EmbedBuilder()
                            .setAuthor({ 
                                name: '🌐 WORLD GOVERNMENT INTELLIGENCE BUREAU'
                            })
                            .setColor(isPirateKingData ? 0xFFD700 : 0xFF0000);

                        let intelligenceValue = `\`\`\`diff\n- Alias: ${userData.member.displayName}\n- Bounty: ฿${bountyAmount.toLocaleString()}\n- Level: ${userData.level} | Rank: ${rank}\n- Threat: ${isPirateKingData ? 'PIRATE KING' : getThreatLevelName(userData.level)}\n- Activity: ${userData.messages + userData.reactions + Math.floor(userData.voice_time / 60) > 1000 ? 'HIGH' : userData.messages + userData.reactions + Math.floor(userData.voice_time / 60) > 500 ? 'MODERATE' : userData.messages + userData.reactions + Math.floor(userData.voice_time / 60) > 100 ? 'LOW' : 'MINIMAL'}\n\`\`\``;

                        embed.addFields({
                            name: '📊 INTELLIGENCE SUMMARY',
                            value: intelligenceValue,
                            inline: false
                        });

                        if (isPirateKingData) {
                            embed.addFields({
                                name: '👑 SPECIAL CLASSIFICATION',
                                value: `\`\`\`diff\n- EMPEROR STATUS CONFIRMED\n- MAXIMUM THREAT DESIGNATION\n- APPROACH WITH EXTREME CAUTION\n\`\`\``,
                                inline: false
                            });
                        }

                        embed.setImage(`attachment://wanted_${userData.userId}.png`)
                            .setFooter({ 
                                text: `⚓ Marine Intelligence Division • Classification: ${isPirateKingData ? 'EMPEROR' : getThreatLevelName(userData.level)}`
                            })
                            .setTimestamp();

                        // Send individual poster - add buttons only to the last one
                        const isLastPoster = (i === postersToShow.length - 1);
                        const messageOptions = { embeds: [embed], files: [attachment] };
                        if (isLastPoster) {
                            messageOptions.components = [buttons];
                        }
                        
                        await interaction.followUp(messageOptions);
                        
                        // Small delay between posters
                        if (i < postersToShow.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                        
                    } catch (error) {
                        console.error('[ERROR] Error creating poster for user', userData.userId, ':', error);
                        continue;
                    }
                }

            } else if (type === 'full') {
                // ALL THE BOUNTIES - Text only
                const level1Plus = filteredUsers.filter(user => user.level >= 1);
                
                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: '🌐 WORLD GOVERNMENT INTELLIGENCE BUREAU'
                    })
                    .setColor(0xFF0000);

                let intelligenceValue = `🚨 **COMPLETE BOUNTY DATABASE** 🚨\n\n`;

                if (pirateKing) {
                    const pirateKingBounty = getBountyForLevel(pirateKing.level, true);
                    intelligenceValue += `\`\`\`diff\n- EMPEROR: ${pirateKing.member.displayName}\n- Bounty: ฿${pirateKingBounty.toLocaleString()}\n- Level: ${pirateKing.level} | PIRATE KING\n\`\`\`\n\n`;
                }

                // Split users into chunks to avoid Discord's character limit
                const chunkSize = 8;
                const chunks = [];
                for (let i = 0; i < level1Plus.length; i += chunkSize) {
                    chunks.push(level1Plus.slice(i, i + chunkSize));
                }

                // First field with header info
                let headerInfo = `\`\`\`diff\n- COMPLETE SURVEILLANCE DATABASE\n- Active Threats: ${level1Plus.length + (pirateKing ? 1 : 0)}\n- Last Updated: ${new Date().toLocaleString()}\n- Civilian Count: ${filteredUsers.filter(user => user.level === 0).length}\n\`\`\``;
                
                embed.addFields({
                    name: '📊 DATABASE STATUS',
                    value: headerInfo,
                    inline: false
                });

                // Add pirates in chunks
                chunks.forEach((chunk, chunkIndex) => {
                    let chunkValue = `\`\`\`diff\n`;
                    chunk.forEach((user, index) => {
                        const globalIndex = chunkIndex * chunkSize + index + 1;
                        const bountyAmount = getBountyForLevel(user.level);
                        const threatLevel = getThreatLevelName(user.level);
                        chunkValue += `- ${String(globalIndex).padStart(2, '0')}. ${user.member.displayName}\n`;
                        chunkValue += `-     ฿${bountyAmount.toLocaleString()} | Lv.${user.level}\n`;
                        chunkValue += `-     ${threatLevel.substring(0, 15)}\n\n`;
                    });
                    chunkValue += `\`\`\``;

                    embed.addFields({
                        name: chunkIndex === 0 ? '🏴‍☠️ ACTIVE THREATS' : `🏴‍☠️ CONTINUED (${chunkIndex + 1})`,
                        value: chunkValue,
                        inline: false
                    });
                });

                embed.setFooter({ 
                    text: `⚓ Marine Intelligence Division • ${level1Plus.length + (pirateKing ? 1 : 0)} Active Profiles`
                })
                .setTimestamp();

                if (isButton) {
                    await interaction.editReply({ 
                        embeds: [embed], 
                        files: [], 
                        components: [buttons] 
                    });
                } else {
                    await interaction.editReply({ 
                        embeds: [embed], 
                        components: [buttons] 
                    });
                }
            }

        } catch (error) {
            console.error('[ERROR] Error in leaderboard command:', error);
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription(`Failed to load leaderboard: ${error.message}`)
                .setColor('#FF0000');

            await interaction.editReply({ embeds: [errorEmbed], components: [] }).catch(console.error);
        }
    }
};

// Canvas function for wanted posters
async function createWantedPoster(userData, guild) {
    const width = 600, height = 900;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Load and draw scroll texture background
    try {
        const scrollTexture = await loadImage(path.join(__dirname, '../../assets/scroll_texture.jpg'));
        ctx.drawImage(scrollTexture, 0, 0, width, height);
        console.log('[DEBUG] Successfully loaded scroll texture background');
    } catch (error) {
        console.log('[DEBUG] Scroll texture not found, using fallback parchment color');
        ctx.fillStyle = '#f5e6c5';
        ctx.fillRect(0, 0, width, height);
    }
    
    // Borders
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, width, height);
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, width - 20, height - 20);
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, width - 36, height - 36);

    // WANTED title
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '81px CaptainKiddNF, Arial, sans-serif';
    const wantedY = height * (1 - 92/100);
    const wantedX = (50/100) * width;
    ctx.fillText('WANTED', wantedX, wantedY);

    // Image Box
    const photoSize = (95/100) * 400;
    const photoX = ((50/100) * width) - (photoSize/2);
    const photoY = height * (1 - 65/100) - (photoSize/2);
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeRect(photoX, photoY, photoSize, photoSize);

    let member = null;
    try {
        if (guild && userData.userId) member = await guild.members.fetch(userData.userId);
    } catch {}
    
    const avatarArea = { x: photoX + 3, y: photoY + 3, width: photoSize - 6, height: photoSize - 6 };
    if (member) {
        try {
            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true });
            const avatar = await loadImage(avatarURL);
            
            ctx.save();
            ctx.beginPath();
            ctx.rect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
            ctx.clip();
            
            ctx.filter = 'contrast(0.95) sepia(0.05)';
            ctx.drawImage(avatar, avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
            ctx.filter = 'none';
            
            ctx.restore();
        } catch {
            console.log('[DEBUG] No avatar found, texture will show through');
        }
    }

    // "DEAD OR ALIVE"
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '57px CaptainKiddNF, Arial, sans-serif';
    const deadOrAliveY = height * (1 - 39/100);
    const deadOrAliveX = (50/100) * width;
    ctx.fillText('DEAD OR ALIVE', deadOrAliveX, deadOrAliveY);

    // Name
    ctx.font = '69px CaptainKiddNF, Arial, sans-serif';
    let displayName = 'UNKNOWN PIRATE';
    if (member) displayName = member.displayName.replace(/[^\w\s-]/g, '').toUpperCase().substring(0, 16);
    else if (userData.userId) displayName = `PIRATE ${userData.userId.slice(-4)}`;
    
    // Check if name is too long and adjust
    ctx.textAlign = 'center';
    let nameWidth = ctx.measureText(displayName).width;
    if (nameWidth > width - 60) {
        ctx.font = '55px CaptainKiddNF, Arial, sans-serif';
    }
    
    const nameY = height * (1 - 30/100);
    const nameX = (50/100) * width;
    ctx.fillText(displayName, nameX, nameY);

    // Berry Symbol and Bounty Numbers
    const berryBountyGap = 5;
    
    // Get BOUNTY amount for user's level and check if Pirate King
    const isPirateKingData = userData.isPirateKing || false;
    const bountyAmount = getBountyForLevel(userData.level, isPirateKingData);
    const bountyStr = bountyAmount.toLocaleString();
    
    console.log(`[LEADERBOARD] Level ${userData.level} ${isPirateKingData ? '(PIRATE KING)' : ''} = Bounty ฿${bountyStr}`);
    
    ctx.font = '54px Cinzel, Georgia, serif';
    const bountyTextWidth = ctx.measureText(bountyStr).width;
    
    // Berry symbol size
    const berrySize = (32/100) * 150;
    
    // Calculate total width of the bounty unit (berry + gap + text)
    const gapPixels = (berryBountyGap/100) * width;
    const totalBountyWidth = berrySize + gapPixels + bountyTextWidth;
    
    // Center the entire bounty unit horizontally
    const bountyUnitStartX = (width - totalBountyWidth) / 2;
    
    // Position berry symbol at the start of the centered unit
    const berryX = bountyUnitStartX + (berrySize/2);
    const berryY = height * (1 - 22/100) - (berrySize/2);
    
    let berryImg;
    try {
        const berryPath = path.join(__dirname, '../../assets/berry.png');
        berryImg = await loadImage(berryPath);
    } catch {
        // Create simple berry symbol
        const berryCanvas = createCanvas(berrySize, berrySize);
        const berryCtx = berryCanvas.getContext('2d');
        berryCtx.fillStyle = '#111';
        berryCtx.font = `bold ${berrySize}px serif`;
        berryCtx.textAlign = 'center';
        berryCtx.textBaseline = 'middle';
        berryCtx.fillText('฿', berrySize/2, berrySize/2);
        berryImg = berryCanvas;
    }
    
    ctx.drawImage(berryImg, berryX - (berrySize/2), berryY, berrySize, berrySize);

    // Position bounty numbers with fixed gap from berry
    const bountyX = bountyUnitStartX + berrySize + gapPixels;
    const bountyY = height * (1 - 22/100);
    
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111';
    ctx.fillText(bountyStr, bountyX, bountyY);

    // One Piece logo
    try {
        const onePieceLogoPath = path.join(__dirname, '../../assets/one-piece-symbol.png');
        const onePieceLogo = await loadImage(onePieceLogoPath);
        const logoSize = (26/100) * 200;
        const logoX = ((50/100) * width) - (logoSize/2);
        const logoY = height * (1 - 4.5/100) - (logoSize/2);
        
        ctx.globalAlpha = 0.6;
        ctx.filter = 'sepia(0.2) brightness(0.9)';
        ctx.drawImage(onePieceLogo, logoX, logoY, logoSize, logoSize);
        ctx.globalAlpha = 1.0;
        ctx.filter = 'none';
    } catch {
        console.log('[DEBUG] One Piece logo not found at assets/one-piece-symbol.png');
    }

    // "MARINE" text
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font = '24px TimesNewNormal, Times, serif';
    ctx.fillStyle = '#111';
    
    const marineText = 'M A R I N E';
    const marineX = (96/100) * width;
    const marineY = height * (1 - 2/100);
    ctx.fillText(marineText, marineX, marineY);

    return canvas;
}

// Handle button interactions for leaderboard navigation
module.exports.handleButtonInteraction = async function(interaction, xpTracker) {
    if (!interaction.customId.startsWith('leaderboard_')) return;

    try {
        // Extract type from button customId (leaderboard_posters_1_xp -> posters)
        const parts = interaction.customId.split('_');
        const type = parts[1]; // posters, long, full
        
        console.log(`[DEBUG] Button interaction for type: ${type}`);
        
        // Call the main execute function with the button interaction
        await module.exports.execute(interaction);
        
    } catch (error) {
        console.error('[ERROR] Button interaction error:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription('Failed to process button interaction.')
            .setColor('#FF0000');

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(console.error);
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(console.error);
        }
    }
};

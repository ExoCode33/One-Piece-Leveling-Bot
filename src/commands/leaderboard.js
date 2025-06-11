// src/commands/leaderboard.js - Enhanced One Piece Themed Leaderboard with Authentic Wanted Posters

const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getBountyForLevel, PIRATE_KING_BOUNTY } = require('../utils/bountySystem');
const Canvas = require('canvas');

const LEADERBOARD_EXCLUDE_ROLE = process.env.LEADERBOARD_EXCLUDE_ROLE; // Role ID for Pirate King

function pirateRankEmoji(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '🏴‍☠️';
}

// Enhanced threat levels with One Piece flavor
function getThreatLevel(level) {
    const threatLevels = {
        0: "Rookie pirate spotted in East Blue waters",
        5: "Wanted for theft and disturbing the peace",
        10: "Defeated multiple Marine squads",
        15: "Entered the Grand Line - Dangerous individual",
        20: "Defeated Marine Captain - High combat ability",
        25: "WANTED: Extremely dangerous - Avoid confrontation",
        30: "Mastered advanced combat techniques",
        35: "Commands large crew - Territorial threat",
        40: "Rival to Marine Vice Admiral level",
        45: "Possesses rare Devil Fruit abilities",
        50: "YONKO LEVEL THREAT - Avoid at all costs"
    };

    let applicableLevel = 0;
    for (let threatLevel of Object.keys(threatLevels).map(Number).sort((a, b) => b - a)) {
        if (level >= threatLevel) {
            applicableLevel = threatLevel;
            break;
        }
    }
    
    return threatLevels[applicableLevel];
}

function getThreatLevelShort(level) {
    if (level >= 50) return 'YONKO CLASS';
    if (level >= 45) return 'DEVIL FRUIT USER';
    if (level >= 40) return 'VICE ADMIRAL RIVAL';
    if (level >= 35) return 'CREW CAPTAIN';
    if (level >= 30) return 'MASTER COMBATANT';
    if (level >= 25) return 'EXTREMELY DANGEROUS';
    if (level >= 20) return 'CAPTAIN LEVEL';
    if (level >= 15) return 'GRAND LINE PIRATE';
    if (level >= 10) return 'SQUAD DESTROYER';
    if (level >= 5) return 'WANTED CRIMINAL';
    return 'ROOKIE PIRATE';
}

// Enhanced wanted poster creation with authentic One Piece styling
async function createWantedPoster(user, rank, bounty, threatLevel, guild) {
    try {
        // FIXED SIZE FOR ALL POSTERS
        const canvas = Canvas.createCanvas(300, 400);
        const ctx = canvas.getContext('2d');

        // Create dark textured background
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, '#0a0a0a');
        gradient.addColorStop(0.5, '#111111');
        gradient.addColorStop(1, '#080808');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 300, 400);

        // Add dark texture/grunge effects
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        for (let i = 0; i < 100; i++) {
            ctx.beginPath();
            ctx.arc(Math.random() * 300, Math.random() * 400, Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Main red border (thick)
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, 292, 392);

        // Inner decorative border
        ctx.strokeStyle = '#DC143C';
        ctx.lineWidth = 3;
        ctx.strokeRect(12, 12, 276, 376);

        // === ATTEMPT TEXT RENDERING WITH DIFFERENT APPROACH ===
        
        // Try to register a font first
        try {
            // "WANTED" text - try multiple approaches
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(75, 25, 150, 35); // Red background
            
            // Approach 1: Simple text
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '24px sans-serif';
            ctx.fillText('WANTED', 150, 42);
            
            // If that doesn't work, try with strokeText
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.strokeText('WANTED', 150, 42);
            
        } catch (e) {
            console.log('Font approach 1 failed, trying approach 2');
        }

        // "DEAD OR ALIVE" text
        try {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(90, 65, 120, 20); // White background
            ctx.fillStyle = '#000000';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('DEAD OR ALIVE', 150, 75);
            ctx.strokeStyle = '#000000';
            ctx.strokeText('DEAD OR ALIVE', 150, 75);
        } catch (e) {
            console.log('Font approach 2 failed');
        }

        // Try Canvas measureText to verify fonts are working
        try {
            const testText = 'TEST';
            const metrics = ctx.measureText(testText);
            console.log('Canvas text metrics working:', metrics.width > 0);
        } catch (e) {
            console.log('Canvas text metrics failed');
        }

        // Decorative line under header
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(40, 95);
        ctx.lineTo(260, 95);
        ctx.stroke();

        // Get user avatar and create photo frame
        let member;
        try {
            member = await guild.members.fetch(user.userId);
        } catch (err) {
            member = null;
        }

        // Photo frame (consistent size and centered)
        const frameX = 100;  // Centered: (300 - 100) / 2 = 100
        const frameY = 110;
        const frameWidth = 100;
        const frameHeight = 130;
        
        // White photo frame background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(frameX - 8, frameY - 8, frameWidth + 16, frameHeight + 16);
        
        // Photo frame shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(frameX - 6, frameY - 6, frameWidth + 12, frameHeight + 12);
        
        // Photo frame border
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 3;
        ctx.strokeRect(frameX - 8, frameY - 8, frameWidth + 16, frameHeight + 16);

        if (member) {
            try {
                const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
                const avatar = await Canvas.loadImage(avatarURL);
                
                // Clip to photo area
                ctx.save();
                ctx.beginPath();
                ctx.rect(frameX, frameY, frameWidth, frameHeight - 30); // Leave space for name
                ctx.clip();
                
                // Draw avatar to fill the frame
                const aspectRatio = avatar.width / avatar.height;
                let drawWidth = frameWidth;
                let drawHeight = frameWidth / aspectRatio;
                
                if (drawHeight < frameHeight - 30) {
                    drawHeight = frameHeight - 30;
                    drawWidth = drawHeight * aspectRatio;
                }
                
                const drawX = frameX + (frameWidth - drawWidth) / 2;
                const drawY = frameY + (frameHeight - 30 - drawHeight) / 2;
                
                ctx.drawImage(avatar, drawX, drawY, drawWidth, drawHeight);
                ctx.restore();
            } catch (imgError) {
                console.log('Avatar loading failed, using placeholder');
                ctx.fillStyle = '#DDD';
                ctx.fillRect(frameX, frameY, frameWidth, frameHeight - 30);
            }
        } else {
            // Placeholder if no avatar
            ctx.fillStyle = '#DDD';
            ctx.fillRect(frameX, frameY, frameWidth, frameHeight - 30);
        }

        // Black name zone below photo
        ctx.fillStyle = '#000000';
        ctx.fillRect(frameX, frameY + frameHeight - 30, frameWidth, 30);

        // Pirate name on black zone with white text - TRY AGAIN
        try {
            const displayName = member ? member.displayName : `User ${user.userId}`;
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(displayName.toUpperCase().substring(0, 12), frameX + frameWidth/2, frameY + frameHeight - 15);
            
            // Also try stroke text
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.strokeText(displayName.toUpperCase().substring(0, 12), frameX + frameWidth/2, frameY + frameHeight - 15);
        } catch (e) {
            console.log('Name text failed');
        }

        // Bounty amount - FIX THE ACTUAL VALUES
        try {
            ctx.fillStyle = '#8B0000';
            ctx.fillRect(75, 260, 150, 30); // Red background
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Format bounty properly
            let bountyText;
            if (bounty >= 1000000000) {
                bountyText = `${(bounty / 1000000000).toFixed(1)}B`;
            } else if (bounty >= 1000000) {
                bountyText = `${(bounty / 1000000).toFixed(0)}M`;
            } else if (bounty >= 1000) {
                bountyText = `${(bounty / 1000).toFixed(0)}K`;
            } else {
                bountyText = bounty.toString();
            }
            
            ctx.fillText(`₿${bountyText}`, 150, 275);
            ctx.strokeStyle = '#FFFFFF';
            ctx.strokeText(`₿${bountyText}`, 150, 275);
        } catch (e) {
            console.log('Bounty text failed');
        }

        // "BERRY" text - TRY AGAIN
        try {
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(110, 295, 80, 20); // Yellow background
            ctx.fillStyle = '#000000';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('BERRY', 150, 305);
            ctx.strokeStyle = '#000000';
            ctx.strokeText('BERRY', 150, 305);
        } catch (e) {
            console.log('Berry text failed');
        }

        // Threat assessment text - FIX CONTENT
        try {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(35, threatBoxY + 5, 230, 30); // White background
            ctx.fillStyle = '#000000';
            ctx.font = '8px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('THREAT ASSESSMENT', 150, threatBoxY + 8);
            
            // Simplify threat text
            ctx.font = '7px sans-serif';
            let simpleThreat;
            if (threatLevel.includes('YONKO')) {
                simpleThreat = 'YONKO LEVEL THREAT';
            } else if (threatLevel.includes('PIRATE KING')) {
                simpleThreat = 'PIRATE KING CLASS';
            } else if (threatLevel.includes('dangerous')) {
                simpleThreat = 'EXTREMELY DANGEROUS';
            } else if (threatLevel.includes('Grand Line')) {
                simpleThreat = 'GRAND LINE PIRATE';
            } else {
                simpleThreat = 'ROOKIE PIRATE';
            }
            
            ctx.fillText(simpleThreat, 150, threatBoxY + 22);
        } catch (e) {
            console.log('Threat text failed');
        }

        // Level/XP info - FIX CONTENT  
        try {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(75, 375, 150, 20); // White background
            ctx.fillStyle = '#000000';
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Format XP for display
            let xpText;
            if (user.xp >= 1000000) {
                xpText = `${(user.xp / 1000000).toFixed(1)}M XP`;
            } else if (user.xp >= 1000) {
                xpText = `${(user.xp / 1000).toFixed(1)}K XP`;
            } else {
                xpText = `${user.xp} XP`;
            }
            
            ctx.fillText(`Level ${user.level} • ${xpText}`, 150, 385);
        } catch (e) {
            console.log('Level text failed');
        }

        // Rank badge text
        try {
            ctx.fillStyle = '#8B0000';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (rank === 'KING') {
                ctx.fillText('K', badgeX, badgeY);
            } else {
                ctx.fillText(`${rank}`, badgeX, badgeY);
            }
        } catch (e) {
            console.log('Badge text failed');
        }

        // Rank badge in corner
        const badgeX = 260;
        const badgeY = 45;
        
        // Badge background
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, 20, 0, Math.PI * 2);
        ctx.fill();
        
        // Badge border
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, 20, 0, Math.PI * 2);
        ctx.stroke();

        return canvas.toBuffer();
    } catch (error) {
        console.error('Error creating wanted poster:', error);
        return null;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the most notorious pirates!')
        .addStringOption(option =>
            option.setName('view')
                .setDescription('Leaderboard type')
                .setRequired(false)
                .addChoices(
                    { name: 'Top 3 Wanted Posters', value: 'posters' },
                    { name: 'Top 10 List', value: 'long' },
                    { name: 'Full Leaderboard', value: 'full' }
                )
        ),
    async execute(interaction, client, xpTracker) {
        const isButtonInteraction = interaction.deferred;
        
        let guild = interaction.guild;
        let guildId = interaction.guildId;
        
        if (!guild && guildId) {
            try {
                guild = await client.guilds.fetch(guildId);
            } catch (err) {
                console.error('Failed to fetch guild:', err);
            }
        }
        
        if (!guild || !guildId) {
            const errorMessage = "This command can only be used in a server, not in DMs.";
            return isButtonInteraction 
                ? interaction.editReply({ content: errorMessage })
                : interaction.reply({ content: errorMessage, ephemeral: true });
        }

        const view = interaction.options.getString('view') || 'posters';

        let leaderboard;
        try {
            leaderboard = await xpTracker.getLeaderboard(guildId);
        } catch (err) {
            console.error('Database error in leaderboard:', err);
            const errorMessage = "Database error occurred. Please try again later.";
            return isButtonInteraction 
                ? interaction.editReply({ content: errorMessage })
                : interaction.reply({ content: errorMessage, ephemeral: true });
        }

        if (!leaderboard || !Array.isArray(leaderboard)) {
            const errorMessage = "No leaderboard data available.";
            return isButtonInteraction 
                ? interaction.editReply({ content: errorMessage })
                : interaction.reply({ content: errorMessage, ephemeral: true });
        }

        // Pirate King detection
        let pirateKingUser = null;
        if (LEADERBOARD_EXCLUDE_ROLE) {
            try {
                const members = await guild.members.fetch();
                const king = members.find(m => m.roles.cache.has(LEADERBOARD_EXCLUDE_ROLE));
                if (king) {
                    pirateKingUser = leaderboard.find(u => u.userId === king.user.id);
                    if (pirateKingUser) {
                        leaderboard = leaderboard.filter(u => u.userId !== king.user.id);
                    }
                }
            } catch (err) {
                console.error('Error finding Pirate King:', err);
                pirateKingUser = null;
            }
        }

        // If no role-based Pirate King, check if top user has reached level 50
        if (!pirateKingUser && leaderboard.length > 0) {
            const topUser = leaderboard[0];
            if (topUser.level >= 50) {
                pirateKingUser = topUser;
                leaderboard = leaderboard.slice(1); // Remove from regular leaderboard
            }
        }

        leaderboard = leaderboard.filter(user => user && typeof user.xp === 'number');
        leaderboard.sort((a, b) => b.xp - a.xp);

        // Create navigation buttons
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('leaderboard_posters_1_xp')
                .setLabel('🎯 Top 3 Posters')
                .setStyle(view === 'posters' ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('leaderboard_long_1_xp')
                .setLabel('📋 Top 10 List')
                .setStyle(view === 'long' ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('leaderboard_full_1_xp')
                .setLabel('📜 Full Board')
                .setStyle(view === 'full' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        );

        if (view === 'posters') {
            // Create wanted posters for ALL pirates (Pirate King + Top 3) in one embed
            const topThree = leaderboard.slice(0, 3);
            const allPirates = [];
            
            // Add Pirate King first if exists
            if (pirateKingUser) {
                allPirates.push({
                    user: pirateKingUser,
                    rank: 'KING',
                    isPirateKing: true
                });
            }
            
            // Add top 3 pirates
            for (let i = 0; i < topThree.length; i++) {
                allPirates.push({
                    user: topThree[i],
                    rank: i + 1,
                    isPirateKing: false
                });
            }
            
            // Create all posters and embeds
            const attachments = [];
            const allEmbeds = [];
            
            for (let i = 0; i < allPirates.length; i++) {
                const pirate = allPirates[i];
                const user = pirate.user;
                const rank = pirate.rank;
                
                const bounty = pirate.isPirateKing ? PIRATE_KING_BOUNTY : getBountyForLevel(user.level);
                const threatLevel = pirate.isPirateKing ? 'PIRATE KING - Supreme ruler of all pirates' : getThreatLevel(user.level);
                const threat = pirate.isPirateKing ? 'PIRATE KING CLASS' : getThreatLevelShort(user.level);
                
                const posterBuffer = await createWantedPoster(user, rank, bounty, threatLevel, guild);
                if (posterBuffer) {
                    const attachment = new AttachmentBuilder(posterBuffer, { 
                        name: `wanted_poster_${i + 1}.png` 
                    });
                    attachments.push(attachment);
                    
                    // Create individual embed for each poster (same width as Pirate King)
                    const posterEmbed = new EmbedBuilder()
                        .setColor(pirate.isPirateKing ? 0xFFD700 : 0x1a1a1a)
                        .setTitle(pirate.isPirateKing ? '👑 **PIRATE KING**' : `${pirateRankEmoji(rank)} **#${rank}** WANTED PIRATE`)
                        .setDescription(`<@${user.userId}> - Level ${user.level}\n\nThe following individual is considered extremely dangerous and should be approached with extreme caution.\n\u200B`)
                        .addFields(
                            {
                                name: '💰 Bounty',
                                value: `฿${bounty.toLocaleString()}`,
                                inline: true
                            },
                            {
                                name: '⚠️ Threat',
                                value: threat,
                                inline: true
                            },
                            {
                                name: '💎 Total XP',
                                value: `${user.xp.toLocaleString()}`,
                                inline: true
                            },
                            {
                                name: '📈 Status',
                                value: pirate.isPirateKing ? 'Supreme ruler who conquered the Grand Line' :
                                       rank === 1 ? 'Most dangerous pirate in the server' : 
                                       rank === 2 ? 'Rising through the ranks' : 
                                       'New to the Grand Line',
                                inline: false
                            },
                            {
                                name: '\u200B',
                                value: '\u200B',
                                inline: false
                            }
                        )
                        .setImage(`attachment://wanted_poster_${i + 1}.png`)
                        .setFooter({ text: 'World Government • Marine Headquarters • Justice Will Prevail' })
                        .setTimestamp();
                    
                    allEmbeds.push(posterEmbed);
                }
            }

            // Create header embed (consistent width)
            const headerEmbed = new EmbedBuilder()
                .setColor(0x8B0000)
                .setTitle('🏴‍☠️ MOST WANTED PIRATES 🏴‍☠️')
                .setDescription('**🎯 TOP MOST DANGEROUS CRIMINALS**\nThe following individuals are considered extremely dangerous and should be approached with extreme caution.\n\u200B')
                .addFields(
                    {
                        name: '\u200B',
                        value: '\u200B',
                        inline: false
                    }
                )
                .setFooter({ text: 'World Government • Marine Headquarters • Justice Will Prevail' })
                .setTimestamp();

            // Add header embed to the beginning
            allEmbeds.unshift(headerEmbed);

            // Send all posters together with buttons
            if (allEmbeds.length > 0) {
                if (isButtonInteraction) {
                    await interaction.editReply({ 
                        embeds: allEmbeds, 
                        files: attachments,
                        components: [row]
                    });
                } else {
                    await interaction.reply({ 
                        embeds: allEmbeds, 
                        files: attachments,
                        components: [row]
                    });
                }
            }

            return;

        } else if (view === 'full') {
            // Full text list
            let text = '🏴‍☠️ **COMPLETE PIRATE REGISTRY** 🏴‍☠️\n\n';
            let rank = 1;

            if (pirateKingUser) {
                text += `👑 **PIRATE KING**: <@${pirateKingUser.userId}> - Level ${pirateKingUser.level} - ฿${PIRATE_KING_BOUNTY.toLocaleString()}\n\n`;
            }

            for (const user of leaderboard) {
                const bounty = getBountyForLevel(user.level);
                text += `${pirateRankEmoji(rank)} **${rank}.** <@${user.userId}> — Level **${user.level}** — ฿**${bounty.toLocaleString()}**\n`;
                rank++;
            }

            if (leaderboard.length === 0) {
                text += "No pirates have earned any bounty yet! Set sail and make your mark on the Grand Line!";
            }
            
            const finalText = text.length > 1900 ? text.slice(0, 1900) + '\n... (truncated)' : text;
            
            const responseData = { 
                content: finalText, 
                components: [row],
                embeds: []
            };
            
            return isButtonInteraction 
                ? interaction.editReply(responseData)
                : interaction.reply(responseData);

        } else {
            // Top 10 list with enhanced styling (same poster layout for top 3)
            const topTen = leaderboard.slice(0, 10);
            const topThree = topTen.slice(0, 3);

            // Create embed description
            let embedDescription = '**🎯 TOP 3 MOST DANGEROUS CRIMINALS**\nThe following individuals are considered extremely dangerous and should be approached with extreme caution.\n\n';
            
            let initialReplyDone = false;
            
            // Add Pirate King if exists
            if (pirateKingUser) {
                // Create Pirate King poster
                const kingBounty = PIRATE_KING_BOUNTY;
                const kingThreat = 'PIRATE KING - Supreme ruler of all pirates';
                const kingPosterBuffer = await createWantedPoster(pirateKingUser, '👑', kingBounty, kingThreat, guild);
                
                if (kingPosterBuffer) {
                    const kingAttachment = new AttachmentBuilder(kingPosterBuffer, { 
                        name: 'pirate_king_poster.png' 
                    });
                    
                    // Create Pirate King embed first
                    const kingEmbed = new EmbedBuilder()
                        .setColor(0xFFD700)
                        .setTitle('🏴‍☠️ MOST WANTED PIRATES 🏴‍☠️')
                        .setDescription(embedDescription)
                        .addFields(
                            {
                                name: '👑 **PIRATE KING**',
                                value: `<@${pirateKingUser.userId}> - Level ${pirateKingUser.level}`,
                                inline: false
                            },
                            {
                                name: '💰 Bounty',
                                value: `฿${PIRATE_KING_BOUNTY.toLocaleString()}`,
                                inline: true
                            },
                            {
                                name: '⚠️ Threat',
                                value: 'PIRATE KING CLASS',
                                inline: true
                            },
                            {
                                name: '💎 Total XP',
                                value: `${pirateKingUser.xp.toLocaleString()}`,
                                inline: true
                            },
                            {
                                name: '📈 Status',
                                value: 'Supreme ruler who conquered the Grand Line',
                                inline: false
                            }
                        )
                        .setImage('attachment://pirate_king_poster.png')
                        .setFooter({ text: 'World Government • Marine Headquarters • Justice Will Prevail' })
                        .setTimestamp();

                    // Send Pirate King first
                    if (isButtonInteraction) {
                        await interaction.editReply({ embeds: [kingEmbed], files: [kingAttachment], components: [row] });
                    } else {
                        await interaction.reply({ embeds: [kingEmbed], files: [kingAttachment], components: [row] });
                    }
                    initialReplyDone = true;
                }
            }

            // If no Pirate King, send initial embed first
            if (!initialReplyDone) {
                const initialEmbed = new EmbedBuilder()
                    .setColor(0x1a1a1a)
                    .setTitle('🏴‍☠️ MOST WANTED PIRATES 🏴‍☠️')
                    .setDescription(embedDescription)
                    .setFooter({ text: 'World Government • Marine Headquarters • Justice Will Prevail' })
                    .setTimestamp();

                if (isButtonInteraction) {
                    await interaction.editReply({ embeds: [initialEmbed], components: [row] });
                } else {
                    await interaction.reply({ embeds: [initialEmbed], components: [row] });
                }
                initialReplyDone = true;
            }

            // Create top 3 posters
            const attachments = [];
            const embeds = [];
            
            for (let i = 0; i < topThree.length; i++) {
                const user = topThree[i];
                const bounty = getBountyForLevel(user.level);
                const threatLevel = getThreatLevel(user.level);
                const threat = getThreatLevelShort(user.level);
                
                const posterBuffer = await createWantedPoster(user, i + 1, bounty, threatLevel, guild);
                if (posterBuffer) {
                    const attachment = new AttachmentBuilder(posterBuffer, { 
                        name: `wanted_poster_${i + 1}.png` 
                    });
                    attachments.push(attachment);
                    
                    // Create individual embed for each poster
                    const posterEmbed = new EmbedBuilder()
                        .setColor(0x1a1a1a)
                        .addFields(
                            {
                                name: `${pirateRankEmoji(i + 1)} **#${i + 1}**`,
                                value: `<@${user.userId}> - Level ${user.level}`,
                                inline: false
                            },
                            {
                                name: '💰 Bounty',
                                value: `฿${bounty.toLocaleString()}`,
                                inline: true
                            },
                            {
                                name: '⚠️ Threat',
                                value: threat,
                                inline: true
                            },
                            {
                                name: '💎 Total XP',
                                value: `${user.xp.toLocaleString()}`,
                                inline: true
                            },
                            {
                                name: '📈 Status',
                                value: i === 0 ? 'Most dangerous pirate in the server' : 
                                       i === 1 ? 'Rising through the ranks' : 
                                       'New to the Grand Line',
                                inline: false
                            }
                        )
                        .setImage(`attachment://wanted_poster_${i + 1}.png`);
                    
                    embeds.push(posterEmbed);
                }
            }

            // Send all top 3 posters as follow-ups
            for (let i = 0; i < embeds.length; i++) {
                await interaction.followUp({ 
                    embeds: [embeds[i]], 
                    files: [attachments[i]] 
                });
            }

            // Create top 10 list embed (without posters)
            const listEmbed = new EmbedBuilder()
                .setColor(0xDC143C)
                .setTitle('⚓ COMPLETE TOP 10 RANKINGS ⚓')
                .setDescription(`
**📊 TOP 10 MOST WANTED PIRATES**

${topTen.map((user, index) => {
    const bounty = getBountyForLevel(user.level);
    const threat = getThreatLevelShort(user.level);
    return `${pirateRankEmoji(index + 1)} **#${index + 1}** <@${user.userId}>\n💰 ฿${bounty.toLocaleString()} • ⚔️ Lv.${user.level} • ⭐ ${user.xp.toLocaleString()} XP\n📍 *${threat}*`;
}).join('\n\n')}

${leaderboard.length > 10 ? `\n🏴‍☠️ *... and ${leaderboard.length - 10} more pirates sailing the seas*` : ''}
                `)
                .setFooter({ text: 'Marine Intelligence Division • Stay Vigilant' })
                .setTimestamp();

            // Send the top 10 list
            await interaction.followUp({ embeds: [listEmbed] });

            return;
        }
    }
};

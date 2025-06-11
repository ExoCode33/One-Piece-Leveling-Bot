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
        const canvas = Canvas.createCanvas(250, 320); // Larger poster size
        const ctx = canvas.getContext('2d');

        // Create dark textured background
        const gradient = ctx.createLinearGradient(0, 0, 0, 320);
        gradient.addColorStop(0, '#0a0a0a');
        gradient.addColorStop(0.5, '#111111');
        gradient.addColorStop(1, '#080808');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 250, 320);

        // Add dark texture/grunge effects
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        for (let i = 0; i < 100; i++) {
            ctx.beginPath();
            ctx.arc(Math.random() * 250, Math.random() * 320, Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Add noise texture
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        for (let i = 0; i < 200; i++) {
            ctx.fillRect(Math.random() * 250, Math.random() * 320, 1, 1);
        }

        // Main red border (thick)
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, 244, 314);

        // Inner decorative border
        ctx.strokeStyle = '#DC143C';
        ctx.lineWidth = 2;
        ctx.strokeRect(9, 9, 232, 302);

        // "WANTED" header with shadow effect
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        ctx.fillStyle = '#8B0000';
        ctx.font = 'bold 28px serif';
        ctx.textAlign = 'center';
        ctx.fillText('WANTED', 125, 45);
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // "DEAD OR ALIVE" subtitle
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 10px serif';
        ctx.fillText('DEAD OR ALIVE', 125, 60);

        // Decorative line under header
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(30, 70);
        ctx.lineTo(220, 70);
        ctx.stroke();

        // Get user avatar and create photo frame
        let member;
        try {
            member = await guild.members.fetch(user.userId);
        } catch (err) {
            member = null;
        }

        // Photo frame (larger, polaroid style)
        const frameX = 75;
        const frameY = 80;
        const frameWidth = 100;
        const frameHeight = 120;
        
        // White photo frame background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(frameX - 5, frameY - 5, frameWidth + 10, frameHeight + 10);
        
        // Photo frame shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(frameX - 3, frameY - 3, frameWidth + 6, frameHeight + 6);
        
        // Photo frame border
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(frameX - 5, frameY - 5, frameWidth + 10, frameHeight + 10);

        if (member) {
            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            const avatar = await Canvas.loadImage(avatarURL);
            
            // Clip to photo area
            ctx.save();
            ctx.beginPath();
            ctx.rect(frameX, frameY, frameWidth, frameHeight - 25); // Leave space for name
            ctx.clip();
            
            // Draw avatar to fill the frame
            const aspectRatio = avatar.width / avatar.height;
            let drawWidth = frameWidth;
            let drawHeight = frameWidth / aspectRatio;
            
            if (drawHeight < frameHeight - 25) {
                drawHeight = frameHeight - 25;
                drawWidth = drawHeight * aspectRatio;
            }
            
            const drawX = frameX + (frameWidth - drawWidth) / 2;
            const drawY = frameY + (frameHeight - 25 - drawHeight) / 2;
            
            ctx.drawImage(avatar, drawX, drawY, drawWidth, drawHeight);
            ctx.restore();
        } else {
            // Placeholder if no avatar
            ctx.fillStyle = '#DDD';
            ctx.fillRect(frameX, frameY, frameWidth, frameHeight - 25);
            ctx.fillStyle = '#666';
            ctx.font = '12px serif';
            ctx.textAlign = 'center';
            ctx.fillText('NO PHOTO', frameX + frameWidth/2, frameY + (frameHeight - 25)/2);
        }

        // Black name zone below photo
        ctx.fillStyle = '#000';
        ctx.fillRect(frameX, frameY + frameHeight - 25, frameWidth, 25);

        // Pirate name on black zone with white text
        const displayName = member ? member.displayName : `User ${user.userId}`;
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 9px serif';
        ctx.textAlign = 'center';
        ctx.fillText(displayName.toUpperCase().substring(0, 12), frameX + frameWidth/2, frameY + frameHeight - 10);

        // Bounty amount (larger)
        ctx.fillStyle = '#8B0000';
        ctx.font = 'bold 18px serif';
        ctx.textAlign = 'center';
        ctx.fillText(`₿${bounty.toLocaleString()}`, 125, 230);

        // Berry symbol decoration
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 12px serif';
        ctx.fillText('BERRY', 125, 245);

        // Threat level box (larger)
        const threatBoxY = 255;
        ctx.fillStyle = 'rgba(139, 0, 0, 0.2)';
        ctx.fillRect(25, threatBoxY, 200, 35);
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 1;
        ctx.strokeRect(25, threatBoxY, 200, 35);

        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 7px serif';
        ctx.textAlign = 'center';
        ctx.fillText('THREAT ASSESSMENT', 125, threatBoxY + 10);
        ctx.font = '6px serif';
        ctx.fillText(threatLevel.substring(0, 35), 125, threatBoxY + 22);

        // Level and XP info (larger)
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 8px serif';
        ctx.fillText(`Level ${user.level} • ${user.xp.toLocaleString()} XP`, 125, 305);

        // Rank badge in corner (larger)
        const badgeX = 220;
        const badgeY = 35;
        
        // Badge background
        ctx.fillStyle = rank === '👑' ? '#FFD700' : '#FFD700';
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, 15, 0, Math.PI * 2);
        ctx.fill();
        
        // Badge border
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, 15, 0, Math.PI * 2);
        ctx.stroke();
        
        // Rank number or crown
        ctx.fillStyle = '#8B0000';
        ctx.font = 'bold 10px serif';
        ctx.textAlign = 'center';
        ctx.fillText(rank === '👑' ? '👑' : `#${rank}`, badgeX, badgeY + 3);

        // Date stamp (smaller)
        ctx.fillStyle = '#999';
        ctx.font = '6px serif';
        ctx.textAlign = 'center';
        const currentDate = new Date().toLocaleDateString();
        ctx.fillText(`Issued: ${currentDate}`, 125, 315);

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
                    leaderboard = leaderboard.filter(u => u.userId !== king.user.id);
                }
            } catch (err) {
                pirateKingUser = null;
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
            // Create wanted posters for top 3 (all in one embed with side-by-side layout)
            const topThree = leaderboard.slice(0, 3);
            
            // Create embed description parts
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
            
            // Create regular top 3 posters
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

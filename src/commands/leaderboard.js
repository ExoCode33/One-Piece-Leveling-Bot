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
        const canvas = Canvas.createCanvas(500, 650);
        const ctx = canvas.getContext('2d');

        // Create aged paper background
        const gradient = ctx.createLinearGradient(0, 0, 0, 650);
        gradient.addColorStop(0, '#F5E6D3');
        gradient.addColorStop(0.5, '#F4E4BC');
        gradient.addColorStop(1, '#E8D5B0');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 500, 650);

        // Add paper texture/aging effects
        ctx.fillStyle = 'rgba(139, 69, 19, 0.1)';
        for (let i = 0; i < 50; i++) {
            ctx.beginPath();
            ctx.arc(Math.random() * 500, Math.random() * 650, Math.random() * 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Main red border (thick)
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 12;
        ctx.strokeRect(6, 6, 488, 638);

        // Inner decorative border
        ctx.strokeStyle = '#DC143C';
        ctx.lineWidth = 3;
        ctx.strokeRect(25, 25, 450, 600);

        // Decorative corner elements
        const cornerSize = 30;
        ctx.fillStyle = '#8B0000';
        // Top left corner
        ctx.fillRect(25, 25, cornerSize, 5);
        ctx.fillRect(25, 25, 5, cornerSize);
        // Top right corner
        ctx.fillRect(445, 25, cornerSize, 5);
        ctx.fillRect(470, 25, 5, cornerSize);
        // Bottom left corner
        ctx.fillRect(25, 620, cornerSize, 5);
        ctx.fillRect(25, 595, 5, cornerSize);
        // Bottom right corner
        ctx.fillRect(445, 620, cornerSize, 5);
        ctx.fillRect(470, 595, 5, cornerSize);

        // "WANTED" header with shadow effect
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        ctx.fillStyle = '#8B0000';
        ctx.font = 'bold 56px serif';
        ctx.textAlign = 'center';
        ctx.fillText('WANTED', 250, 85);
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // "DEAD OR ALIVE" subtitle
        ctx.fillStyle = '#000';
        ctx.font = 'bold 18px serif';
        ctx.fillText('DEAD OR ALIVE', 250, 110);

        // Decorative line under header
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(80, 120);
        ctx.lineTo(420, 120);
        ctx.stroke();

        // Get user avatar and create photo frame
        let member;
        try {
            member = await guild.members.fetch(user.userId);
        } catch (err) {
            member = null;
        }

        // Photo frame (polaroid style)
        const frameX = 150;
        const frameY = 140;
        const frameWidth = 200;
        const frameHeight = 220;
        
        // White photo frame background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(frameX - 10, frameY - 10, frameWidth + 20, frameHeight + 20);
        
        // Photo frame shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(frameX - 8, frameY - 8, frameWidth + 16, frameHeight + 16);
        
        // Photo frame border
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 3;
        ctx.strokeRect(frameX - 10, frameY - 10, frameWidth + 20, frameHeight + 20);

        if (member) {
            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512 });
            const avatar = await Canvas.loadImage(avatarURL);
            
            // Clip to photo area
            ctx.save();
            ctx.beginPath();
            ctx.rect(frameX, frameY, frameWidth, frameHeight - 40); // Leave space for name
            ctx.clip();
            
            // Draw avatar to fill the frame
            const aspectRatio = avatar.width / avatar.height;
            let drawWidth = frameWidth;
            let drawHeight = frameWidth / aspectRatio;
            
            if (drawHeight < frameHeight - 40) {
                drawHeight = frameHeight - 40;
                drawWidth = drawHeight * aspectRatio;
            }
            
            const drawX = frameX + (frameWidth - drawWidth) / 2;
            const drawY = frameY + (frameHeight - 40 - drawHeight) / 2;
            
            ctx.drawImage(avatar, drawX, drawY, drawWidth, drawHeight);
            ctx.restore();
        } else {
            // Placeholder if no avatar
            ctx.fillStyle = '#DDD';
            ctx.fillRect(frameX, frameY, frameWidth, frameHeight - 40);
            ctx.fillStyle = '#666';
            ctx.font = '20px serif';
            ctx.textAlign = 'center';
            ctx.fillText('NO PHOTO', frameX + frameWidth/2, frameY + (frameHeight - 40)/2);
        }

        // Pirate name on photo
        const displayName = member ? member.displayName : `User ${user.userId}`;
        ctx.fillStyle = '#000';
        ctx.font = 'bold 18px serif';
        ctx.textAlign = 'center';
        ctx.fillText(displayName.toUpperCase(), frameX + frameWidth/2, frameY + frameHeight - 15);

        // Bounty amount (large and prominent)
        ctx.fillStyle = '#8B0000';
        ctx.font = 'bold 48px serif';
        ctx.textAlign = 'center';
        ctx.fillText(`₿${bounty.toLocaleString()}`, 250, 420);

        // Berry symbol decoration
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 32px serif';
        ctx.fillText('BERRY', 250, 450);

        // Threat level box
        const threatBoxY = 470;
        ctx.fillStyle = 'rgba(139, 0, 0, 0.1)';
        ctx.fillRect(50, threatBoxY, 400, 60);
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(50, threatBoxY, 400, 60);

        ctx.fillStyle = '#000';
        ctx.font = 'bold 14px serif';
        ctx.textAlign = 'center';
        ctx.fillText('THREAT ASSESSMENT', 250, threatBoxY + 20);
        ctx.font = '12px serif';
        ctx.fillText(threatLevel, 250, threatBoxY + 40);

        // Level and XP info
        ctx.fillStyle = '#000';
        ctx.font = 'bold 16px serif';
        ctx.fillText(`Level ${user.level} • ${user.xp.toLocaleString()} XP`, 250, 560);

        // Rank badge in corner
        const badgeX = 420;
        const badgeY = 60;
        
        // Badge background
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, 35, 0, Math.PI * 2);
        ctx.fill();
        
        // Badge border
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, 35, 0, Math.PI * 2);
        ctx.stroke();
        
        // Rank number
        ctx.fillStyle = '#8B0000';
        ctx.font = 'bold 20px serif';
        ctx.textAlign = 'center';
        ctx.fillText(`#${rank}`, badgeX, badgeY + 7);

        // Marine/World Government stamps
        ctx.fillStyle = 'rgba(139, 0, 0, 0.3)';
        ctx.font = 'bold 24px serif';
        ctx.save();
        ctx.translate(80, 580);
        ctx.rotate(-0.3);
        ctx.fillText('MARINE', 0, 0);
        ctx.restore();

        ctx.save();
        ctx.translate(380, 580);
        ctx.rotate(0.2);
        ctx.fillText('WORLD GOVT', 0, 0);
        ctx.restore();

        // Bottom decorative border
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(50, 590);
        ctx.lineTo(450, 590);
        ctx.stroke();

        // Date stamp
        ctx.fillStyle = '#666';
        ctx.font = '12px serif';
        ctx.textAlign = 'center';
        const currentDate = new Date().toLocaleDateString();
        ctx.fillText(`Issued: ${currentDate}`, 250, 615);

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
            // Create wanted posters for top 3
            const topThree = leaderboard.slice(0, 3);
            const attachments = [];
            
            for (let i = 0; i < topThree.length; i++) {
                const user = topThree[i];
                const bounty = getBountyForLevel(user.level);
                const threatLevel = getThreatLevel(user.level);
                
                const posterBuffer = await createWantedPoster(user, i + 1, bounty, threatLevel, guild);
                if (posterBuffer) {
                    const attachment = new AttachmentBuilder(posterBuffer, { 
                        name: `wanted_poster_${i + 1}.png` 
                    });
                    attachments.push(attachment);
                }
            }

            // Create a newspaper-style embed
            const embed = new EmbedBuilder()
                .setColor(0x8B0000)
                .setTitle('🏴‍☠️ MOST WANTED PIRATES 🏴‍☠️')
                .setDescription(`
**📰 WORLD GOVERNMENT BOUNTY BULLETIN**
*Latest updates from Marine Headquarters*

**🎯 TOP 3 MOST DANGEROUS CRIMINALS**
The following individuals are considered extremely dangerous and should be approached with extreme caution.

${pirateKingUser ? `👑 **PIRATE KING**: <@${pirateKingUser.userId}> - ฿${PIRATE_KING_BOUNTY.toLocaleString()}\n` : ''}

${topThree.map((user, index) => {
    const bounty = getBountyForLevel(user.level);
    const threat = getThreatLevelShort(user.level);
    return `${pirateRankEmoji(index + 1)} **#${index + 1}** <@${user.userId}> - Level ${user.level}\n💰 **Bounty:** ฿${bounty.toLocaleString()}\n⚠️ **Threat:** ${threat}\n`;
}).join('\n')}

*Wanted posters attached below. Report any sightings immediately to your local Marine base.*
                `)
                .setFooter({ text: 'World Government • Marine Headquarters • Justice Will Prevail' })
                .setTimestamp();

            const responseData = { 
                embeds: [embed], 
                files: attachments,
                components: [row]
            };
            
            return isButtonInteraction 
                ? interaction.editReply(responseData)
                : interaction.reply(responseData);

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
            // Top 10 list with enhanced styling
            const topTen = leaderboard.slice(0, 10);

            const embed = new EmbedBuilder()
                .setColor(0xDC143C)
                .setTitle('⚓ GRAND LINE BOUNTY RANKINGS ⚓')
                .setDescription(`
**📊 TOP 10 MOST WANTED PIRATES**

${pirateKingUser ? `👑 **PIRATE KING**\n<@${pirateKingUser.userId}> • Level ${pirateKingUser.level} • ฿${PIRATE_KING_BOUNTY.toLocaleString()}\n\n` : ''}

${topTen.map((user, index) => {
    const bounty = getBountyForLevel(user.level);
    const threat = getThreatLevelShort(user.level);
    return `${pirateRankEmoji(index + 1)} **#${index + 1}** <@${user.userId}>\n💰 ฿${bounty.toLocaleString()} • ⚔️ Lv.${user.level} • ⭐ ${user.xp.toLocaleString()} XP\n📍 *${threat}*`;
}).join('\n\n')}

${leaderboard.length > 10 ? `\n🏴‍☠️ *... and ${leaderboard.length - 10} more pirates sailing the seas*` : ''}
                `)
                .setFooter({ text: 'Marine Intelligence Division • Stay Vigilant' })
                .setTimestamp();

            const responseData = { 
                embeds: [embed], 
                components: [row]
            };
            
            return isButtonInteraction 
                ? interaction.editReply(responseData)
                : interaction.reply(responseData);
        }
    }
};

// src/commands/leaderboard.js - One Piece Themed Leaderboard with Custom Fonts
const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getBountyForLevel, PIRATE_KING_BOUNTY } = require('../utils/bountySystem');
const Canvas = require('canvas');
const path = require('path');

const LEADERBOARD_EXCLUDE_ROLE = process.env.LEADERBOARD_EXCLUDE_ROLE; // Pirate King Role ID
const berryPath = path.join(__dirname, '../../assets/berry.png'); // Make sure your berry.png is here
const onePieceLogoPath = path.join(__dirname, '../../assets/one-piece-symbol.png'); // One Piece logo

// Register custom fonts
try {
    Canvas.registerFont(path.join(__dirname, '../../assets/fonts/captkd.ttf'), { family: 'CaptainKiddNF' });
    Canvas.registerFont(path.join(__dirname, '../../assets/fonts/Cinzel-Bold.otf'), { family: 'Cinzel' }); // Changed to Bold
    Canvas.registerFont(path.join(__dirname, '../../assets/fonts/Times New Normal Regular.ttf'), { family: 'TimesNewNormal' });
    console.log('[DEBUG] Successfully registered custom fonts for wanted posters');
} catch (error) {
    console.error('[ERROR] Failed to register custom fonts:', error.message);
    console.log('[INFO] Falling back to system fonts');
}

function pirateRankEmoji(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '🏴‍☠️';
}

// Utility: draw wanted poster with CUSTOM FONTS and scroll texture background
async function createWantedPoster(user, rank, bounty, guild) {
    const width = 600, height = 900;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Load and draw scroll texture background
    try {
        const scrollTexture = await Canvas.loadImage(path.join(__dirname, '../../assets/scroll_texture.jpg'));
        
        // Draw the texture to fill the entire canvas
        ctx.drawImage(scrollTexture, 0, 0, width, height);
        
        console.log('[DEBUG] Successfully loaded scroll texture background');
    } catch (error) {
        console.log('[INFO] Scroll texture not found, using fallback parchment color');
        // Fallback to original parchment background if texture fails to load
        ctx.fillStyle = '#f5e6c5';
        ctx.fillRect(0, 0, width, height);
    }
    
    // All borders and elements go on top of the texture
    // All borders now black for consistency
    ctx.strokeStyle = '#000000'; // Outer border - black
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, width, height);
    
    ctx.strokeStyle = '#000000'; // Middle border - black
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, width - 20, height - 20);
    
    ctx.strokeStyle = '#000000'; // Inner border - black
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, width - 36, height - 36);

    // WANTED title - Size 27, Horiz 50, Vert 92
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '81px CaptainKiddNF, Arial, sans-serif'; // Size 27/100 * 300 = 81px
    const wantedY = height * (1 - 92/100); // Vert 92: 92% from bottom = 8% from top
    const wantedX = (50/100) * width; // Horiz 50: centered
    ctx.fillText('WANTED', wantedX, wantedY);

    // Image Box - Size 95, Horiz 50, Vert 65 with slightly wider border
    const photoSize = (95/100) * 400; // Size 95/100 * reasonable max = 380px
    const photoX = ((50/100) * width) - (photoSize/2); // Horiz 50: centered
    const photoY = height * (1 - 65/100) - (photoSize/2); // Vert 65: 65% from bottom
    
    // Slightly wider black border
    ctx.strokeStyle = '#000000'; // Black border
    ctx.lineWidth = 3; // Increased from 1 to 3 for wider border
    ctx.strokeRect(photoX, photoY, photoSize, photoSize);
    
    // No white background - image goes directly on texture

    let member = null;
    try {
        if (guild && user.userId) member = await guild.members.fetch(user.userId);
    } catch {}
    
    const avatarArea = { x: photoX + 3, y: photoY + 3, width: photoSize - 6, height: photoSize - 6 }; // Adjusted for wider border
    if (member) {
        try {
            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true });
            const avatar = await Canvas.loadImage(avatarURL);
            
            ctx.save();
            ctx.beginPath();
            ctx.rect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
            ctx.clip();
            
            // Subtle weathering effect
            ctx.filter = 'contrast(0.95) sepia(0.05)';
            ctx.drawImage(avatar, avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
            ctx.filter = 'none';
            
            ctx.restore();
        } catch {
            // If no avatar, just leave the texture showing through with border
            console.log('No avatar found, texture will show through');
        }
    }

    // "DEAD OR ALIVE" - Size 19, Horiz 50, Vert 39
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '57px CaptainKiddNF, Arial, sans-serif'; // Size 19/100 * 300 = 57px
    const deadOrAliveY = height * (1 - 39/100); // Vert 39: 39% from bottom
    const deadOrAliveX = (50/100) * width; // Horiz 50: centered
    ctx.fillText('DEAD OR ALIVE', deadOrAliveX, deadOrAliveY);

    // Name ("SHANKS") - Size 23, Horiz 50, Vert 30
    ctx.font = '69px CaptainKiddNF, Arial, sans-serif'; // Size 23/100 * 300 = 69px
    let displayName = 'UNKNOWN PIRATE';
    if (member) displayName = member.displayName.replace(/[^\w\s-]/g, '').toUpperCase().substring(0, 16);
    else if (user.userId) displayName = `PIRATE ${user.userId.slice(-4)}`;
    
    // Check if name is too long and adjust
    ctx.textAlign = 'center';
    let nameWidth = ctx.measureText(displayName).width;
    if (nameWidth > width - 60) {
        ctx.font = '55px CaptainKiddNF, Arial, sans-serif';
    }
    
    const nameY = height * (1 - 30/100); // Vert 30: 30% from bottom
    const nameX = (50/100) * width; // Horiz 50: centered
    ctx.fillText(displayName, nameX, nameY);

    // Berry Symbol and Bounty Numbers - Dynamic centering with fixed distance
    // Calculate the fixed distance between berry and numbers (22 - 17 = 5 in our scale)
    const berryBountyGap = 5; // Fixed gap in our 1-100 scale
    
    // Measure bounty text width to calculate total unit width
    const bountyStr = bounty.toLocaleString();
    ctx.font = '54px Cinzel, Georgia, serif'; // Set font to measure text
    const bountyTextWidth = ctx.measureText(bountyStr).width;
    
    // Berry symbol size
    const berrySize = (32/100) * 150; // Size 32/100 * reasonable max = 48px
    
    // Calculate total width of the bounty unit (berry + gap + text)
    const gapPixels = (berryBountyGap/100) * width; // Convert gap to pixels
    const totalBountyWidth = berrySize + gapPixels + bountyTextWidth;
    
    // Center the entire bounty unit horizontally
    const bountyUnitStartX = (width - totalBountyWidth) / 2;
    
    // Position berry symbol at the start of the centered unit
    const berryX = bountyUnitStartX + (berrySize/2); // Center of berry symbol
    const berryY = height * (1 - 22/100) - (berrySize/2); // Vert 22: 22% from bottom
    
    let berryImg;
    try {
        berryImg = await Canvas.loadImage(berryPath);
    } catch {
        // Create simple berry symbol
        const berryCanvas = Canvas.createCanvas(berrySize, berrySize);
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
    const bountyX = bountyUnitStartX + berrySize + gapPixels; // Start after berry + gap
    const bountyY = height * (1 - 22/100); // Vert 22: 22% from bottom (same as berry)
    
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111';
    ctx.fillText(bountyStr, bountyX, bountyY);

    // One Piece logo - Size 26, Horiz 50, Vert 4.5
    try {
        const onePieceLogo = await Canvas.loadImage(onePieceLogoPath);
        const logoSize = (26/100) * 200; // Size 26/100 * reasonable max = 52px
        const logoX = ((50/100) * width) - (logoSize/2); // Horiz 50: centered
        const logoY = height * (1 - 4.5/100) - (logoSize/2); // Vert 4.5: 4.5% from bottom
        
        ctx.globalAlpha = 0.6;
        ctx.filter = 'sepia(0.2) brightness(0.9)';
        ctx.drawImage(onePieceLogo, logoX, logoY, logoSize, logoSize);
        ctx.globalAlpha = 1.0;
        ctx.filter = 'none';
    } catch {
        console.log('One Piece logo not found at assets/one-piece-symbol.png');
    }

    // "MARINE" - Size 8, Horiz 96, Vert 2
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font = '24px TimesNewNormal, Times, serif'; // Size 8/100 * 300 = 24px
    ctx.fillStyle = '#111';
    
    const marineText = 'M A R I N E';
    const marineX = (96/100) * width; // Horiz 96: very far right
    const marineY = height * (1 - 2/100); // Vert 2: 2% from bottom
    ctx.fillText(marineText, marineX, marineY);

    return canvas.toBuffer('image/png');
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
                    { name: 'Top 3 Bounties', value: 'posters' },
                    { name: 'Top 10 Bounties', value: 'long' },
                    { name: 'All The Bounties', value: 'full' }
                )
        ),
    async execute(interaction, client, xpTracker) {
        let guild = interaction.guild;
        let guildId = interaction.guildId;
        if (!guild && guildId) {
            try {
                guild = await client.guilds.fetch(guildId);
            } catch (err) {
                return interaction.reply({ content: "Could not resolve server info.", ephemeral: true });
            }
        }
        if (!guild || !guildId) {
            return interaction.reply({ content: "This command can only be used in a server, not in DMs.", ephemeral: true });
        }

        const view = interaction.options.getString('view') || 'posters';

        let leaderboard;
        try {
            leaderboard = await xpTracker.getLeaderboard(guildId);
        } catch (err) {
            return interaction.reply({ content: "Database error occurred. Please try again later.", ephemeral: true });
        }
        if (!leaderboard || !Array.isArray(leaderboard)) {
            return interaction.reply({ content: "No leaderboard data available.", ephemeral: true });
        }

        // Filter to only show members level 1 or more
        leaderboard = leaderboard.filter(user => user && typeof user.xp === 'number' && user.level >= 1);

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
            } catch { pirateKingUser = null; }
        }
        if (!pirateKingUser && leaderboard.length > 0 && leaderboard[0].level >= 50) {
            pirateKingUser = leaderboard[0];
            leaderboard = leaderboard.slice(1);
        }

        leaderboard.sort((a, b) => b.xp - a.xp);

        // Create navigation buttons with red styling
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('leaderboard_posters_1_xp')
                .setLabel('🎯 Top 3 Bounties')
                .setStyle(view === 'posters' ? ButtonStyle.Danger : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('leaderboard_long_1_xp')
                .setLabel('📋 Top 10 Bounties')
                .setStyle(view === 'long' ? ButtonStyle.Danger : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('leaderboard_full_1_xp')
                .setLabel('📜 All The Bounties')
                .setStyle(view === 'full' ? ButtonStyle.Danger : ButtonStyle.Secondary)
        );

        if (view === 'posters') {
            // Top 3 Bounties - Canvas wanted posters only, no individual embeds
            const topThree = leaderboard.slice(0, 3);
            const allPirates = [];
            if (pirateKingUser) allPirates.push({ user: pirateKingUser, rank: 'KING', isPirateKing: true });
            for (let i = 0; i < topThree.length; i++) {
                allPirates.push({ user: topThree[i], rank: i + 1, isPirateKing: false });
            }

            // Header embed only
            const headerEmbed = new EmbedBuilder()
                .setColor(0x8B0000)
                .setTitle('🏴‍☠️ TOP 3 BOUNTIES 🏴‍☠️')
                .setDescription('The World Government has issued these bounties for the most dangerous criminals on the Grand Line.\n\u200B')
                .setFooter({ text: 'World Government • Marine Headquarters • Justice Will Prevail' })
                .setTimestamp();

            await interaction.reply({ embeds: [headerEmbed], components: [row] });

            // Generate and send canvas posters only (no individual embeds)
            for (let i = 0; i < Math.min(allPirates.length, 4); i++) {
                const pirate = allPirates[i];
                const user = pirate.user;
                const rank = pirate.rank;
                const bounty = pirate.isPirateKing ? PIRATE_KING_BOUNTY : getBountyForLevel(user.level);
                try {
                    const posterBuffer = await createWantedPoster(user, rank, bounty, guild);
                    if (posterBuffer) {
                        const attachment = new AttachmentBuilder(posterBuffer, { name: `wanted_poster_${i + 1}.png` });
                        // Send only the canvas image, no embed
                        await interaction.followUp({ files: [attachment] });
                    }
                } catch (e) { 
                    console.error('Error creating poster:', e);
                }
            }
            return;
        } else if (view === 'long') {
            // Top 10 Bounties - Canvas format like Top 3
            const topTen = leaderboard.slice(0, 10);
            const allPirates = [];
            if (pirateKingUser) allPirates.push({ user: pirateKingUser, rank: 'KING', isPirateKing: true });
            for (let i = 0; i < topTen.length; i++) {
                allPirates.push({ user: topTen[i], rank: i + 1, isPirateKing: false });
            }

            // Header embed
            const headerEmbed = new EmbedBuilder()
                .setColor(0x8B0000)
                .setTitle('🏴‍☠️ TOP 10 BOUNTIES 🏴‍☠️')
                .setDescription('The most notorious criminals on the Grand Line with their wanted posters!\n\u200B')
                .setFooter({ text: 'Marine Intelligence • World Government Bounty Board' })
                .setTimestamp();

            // Show Pirate King if exists
            if (pirateKingUser) {
                headerEmbed.addFields({
                    name: '👑 PIRATE KING (Excluded Role)',
                    value: `🏴‍☠️ **Pirate:** <@${pirateKingUser.userId}>\n💰 **Bounty:** ฿${PIRATE_KING_BOUNTY.toLocaleString()}\n⚔️ **Level:** ${pirateKingUser.level}\n💎 **Total XP:** ${pirateKingUser.xp.toLocaleString()}\n📍 **Status:** Ruler of the Grand Line`,
                    inline: false
                });
            }

            await interaction.reply({ embeds: [headerEmbed], components: [row] });

            // Generate and send wanted posters with individual embeds for each pirate
            for (let i = 0; i < Math.min(allPirates.length, 11); i++) {
                const pirate = allPirates[i];
                const user = pirate.user;
                const rank = pirate.rank;
                const bounty = pirate.isPirateKing ? PIRATE_KING_BOUNTY : getBountyForLevel(user.level);
                
                try {
                    const posterBuffer = await createWantedPoster(user, rank, bounty, guild);
                    if (posterBuffer) {
                        const attachment = new AttachmentBuilder(posterBuffer, { name: `wanted_poster_${i + 1}.png` });
                        const posterEmbed = new EmbedBuilder()
                            .setColor(pirate.isPirateKing ? 0xFFD700 : 0x8B0000)
                            .setTitle(pirate.isPirateKing ? '👑 PIRATE KING' : `${pirateRankEmoji(rank)} RANK ${rank}`)
                            .addFields(
                                { name: '🏴‍☠️ Pirate', value: `<@${user.userId}>`, inline: true },
                                { name: '💰 Bounty', value: `฿${bounty.toLocaleString()}`, inline: true },
                                { name: '⚔️ Level', value: `${user.level}`, inline: true },
                                { name: '💎 Total XP', value: `${user.xp.toLocaleString()}`, inline: true },
                                { name: '📍 Status', value: pirate.isPirateKing ? 'Ruler of the Grand Line' :
                                    rank === 1 ? 'Most Dangerous Pirate' : 
                                    rank === 2 ? 'Rising Star' : 
                                    rank === 3 ? 'Notorious Criminal' : 'Wanted Pirate', inline: true }
                            )
                            .setImage(`attachment://wanted_poster_${i + 1}.png`)
                            .setFooter({ text: `Marine Intelligence • Report any sightings immediately • Bounty #${String(i + 1).padStart(3, '0')}` });
                        await interaction.followUp({ embeds: [posterEmbed], files: [attachment] });
                    }
                } catch (e) { 
                    console.error('Error creating poster:', e);
                }
            }
            return;
        } else {
            // All The Bounties - Text-only format, absolutely NO canvas or embeds
            let text = '🏴‍☠️ **ALL THE BOUNTIES** 🏴‍☠️\n\n';
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
            
            // ONLY send text - no followUp messages, no canvas generation
            await interaction.reply({ 
                content: finalText, 
                components: [row]
            });
            return; // Important: return immediately to prevent any canvas generation
        }
    },
};

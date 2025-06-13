const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
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
            const excludedRoleId = settings.excludedRole;
            console.log('[DEBUG] Excluded role ID:', excludedRoleId);
            
            // Get top users from database using the XP tracker
            console.log('[DEBUG] Getting leaderboard from XP tracker...');
            const allUsers = await xpTracker.getLeaderboard(interaction.guild.id);
            console.log('[DEBUG] Raw users from database:', allUsers?.length || 0);

            if (!allUsers || allUsers.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('🏴‍☠️ No Bounties Found')
                    .setDescription('No pirates have earned bounties yet!')
                    .setColor('#FF6B35');

                return await interaction.editReply({ embeds: [embed], components: [] });
            }

            // Filter users and separate Pirate King
            const filteredUsers = [];
            let pirateKing = null;

            console.log('[DEBUG] Processing users...');
            for (const user of allUsers) {
                try {
                    console.log('[DEBUG] Processing user:', user.userId);
                    const member = await interaction.guild.members.fetch(user.userId).catch(() => null);
                    if (!member) {
                        console.log('[DEBUG] Member not found:', user.userId);
                        continue;
                    }

                    if (excludedRoleId && member.roles.cache.has(excludedRoleId)) {
                        pirateKing = { ...user, member };
                        console.log('[DEBUG] Found Pirate King:', member.displayName);
                    } else {
                        filteredUsers.push({ ...user, member });
                    }
                } catch (error) {
                    console.log('[DEBUG] Error fetching member:', user.userId, error.message);
                    continue;
                }
            }

            console.log('[DEBUG] Filtered users:', filteredUsers.length);
            console.log('[DEBUG] Pirate King found:', !!pirateKing);

            // Create navigation buttons
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('leaderboard_posters_1_xp')
                        .setLabel('Top 3 Bounties')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🏆'),
                    new ButtonBuilder()
                        .setCustomId('leaderboard_long_1_xp')
                        .setLabel('Top 10 Bounties')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📊'),
                    new ButtonBuilder()
                        .setCustomId('leaderboard_full_1_xp')
                        .setLabel('All The Bounties')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('📜')
                );

            if (type === 'posters') {
                // TOP 3 BOUNTIES - Show Pirate King + Top 3 with canvas and embeds
                const headerEmbed = new EmbedBuilder()
                    .setTitle('🏆 Top 3 Bounties')
                    .setDescription('The most notorious pirates in the server!')
                    .setColor('#FFD700');

                // Send header first
                await interaction.editReply({ embeds: [headerEmbed], components: [buttons] });

                // Create posters for Pirate King + Top 3
                const postersToShow = [];
                if (pirateKing) postersToShow.push(pirateKing);
                postersToShow.push(...filteredUsers.slice(0, 3));

                console.log('[DEBUG] Creating', postersToShow.length, 'posters for Top 3');

                // Send each poster with embed
                for (let i = 0; i < postersToShow.length; i++) {
                    const userData = postersToShow[i];
                    const isPirateKing = pirateKing && userData === pirateKing;
                    const rank = isPirateKing ? 'PIRATE KING' : `RANK ${i + (pirateKing ? 0 : 1)}`;
                    
                    try {
                        const canvas = await createWantedPoster(userData, interaction.guild);
                        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `wanted_${userData.userId}.png` });
                        
                        // Create detailed embed for each poster
                        const embed = new EmbedBuilder()
                            .setColor(isPirateKing ? '#FF0000' : '#FF6B35')
                            .addFields(
                                { name: '🏴‍☠️ Rank', value: rank, inline: true },
                                { name: '🏴‍☠️ Pirate', value: userData.member.displayName, inline: true },
                                { name: '💰 Bounty', value: `฿${userData.xp.toLocaleString()}`, inline: true },
                                { name: '⚔️ Level', value: userData.level.toString(), inline: true },
                                { name: '💎 Total XP', value: userData.xp.toLocaleString(), inline: true },
                                { name: '⚡ Status', value: isPirateKing ? 'Excluded Role' : 'Notorious Criminal', inline: true }
                            )
                            .setImage(`attachment://wanted_${userData.userId}.png`)
                            .setFooter({ text: `Marine Intelligence • Report any sightings immediately • Bounty #${String(i + 1).padStart(3, '0')}` });

                        await interaction.followUp({ embeds: [embed], files: [attachment] });
                    } catch (error) {
                        console.error('[ERROR] Error creating poster for user', userData.userId, ':', error);
                        continue;
                    }
                }

            } else if (type === 'long') {
                // TOP 10 BOUNTIES - Show Pirate King + Top 10 with canvas and embeds
                const headerEmbed = new EmbedBuilder()
                    .setTitle('📊 Top 10 Bounties')
                    .setDescription('The most wanted pirates in the server!')
                    .setColor('#4169E1');

                // Add Pirate King info to header if exists
                if (pirateKing) {
                    headerEmbed.addFields({
                        name: '👑 Pirate King',
                        value: `${pirateKing.member.displayName} - ฿${pirateKing.xp.toLocaleString()} (Level ${pirateKing.level}) - **Excluded Role**`,
                        inline: false
                    });
                }

                // Send header first
                await interaction.editReply({ embeds: [headerEmbed], components: [buttons] });

                // Create posters for Pirate King + Top 10
                const postersToShow = [];
                if (pirateKing) postersToShow.push(pirateKing);
                postersToShow.push(...filteredUsers.slice(0, 10));

                console.log('[DEBUG] Creating', postersToShow.length, 'posters for Top 10');

                // Send each poster with embed
                for (let i = 0; i < postersToShow.length; i++) {
                    const userData = postersToShow[i];
                    const isPirateKing = pirateKing && userData === pirateKing;
                    const rank = isPirateKing ? 'PIRATE KING' : `RANK ${i + (pirateKing ? 0 : 1)}`;
                    
                    try {
                        const canvas = await createWantedPoster(userData, interaction.guild);
                        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `wanted_${userData.userId}.png` });
                        
                        // Create detailed embed for each poster
                        const embed = new EmbedBuilder()
                            .setColor(isPirateKing ? '#FF0000' : '#FF6B35')
                            .addFields(
                                { name: '🏴‍☠️ Rank', value: rank, inline: true },
                                { name: '🏴‍☠️ Pirate', value: userData.member.displayName, inline: true },
                                { name: '💰 Bounty', value: `฿${userData.xp.toLocaleString()}`, inline: true },
                                { name: '⚔️ Level', value: userData.level.toString(), inline: true },
                                { name: '💎 Total XP', value: userData.xp.toLocaleString(), inline: true },
                                { name: '⚡ Status', value: isPirateKing ? 'Excluded Role' : 'Notorious Criminal', inline: true }
                            )
                            .setImage(`attachment://wanted_${userData.userId}.png`)
                            .setFooter({ text: `Marine Intelligence • Report any sightings immediately • Bounty #${String(i + 1).padStart(3, '0')}` });

                        await interaction.followUp({ embeds: [embed], files: [attachment] });
                    } catch (error) {
                        console.error('[ERROR] Error creating poster for user', userData.userId, ':', error);
                        continue;
                    }
                }

            } else if (type === 'full') {
                // ALL THE BOUNTIES - Text only, no canvas, level 1+
                const level1Plus = filteredUsers.filter(user => user.level >= 1);
                
                let content = '```\n📜 ALL THE BOUNTIES 📜\n';
                content += '═══════════════════════════════════════\n\n';

                if (pirateKing) {
                    content += `👑 PIRATE KING: ${pirateKing.member.displayName}\n`;
                    content += `   ฿${pirateKing.xp.toLocaleString()} | Level ${pirateKing.level} | Excluded Role\n\n`;
                }

                content += '🏴‍☠️ NOTORIOUS PIRATES:\n';
                content += '───────────────────────────────────────\n';

                level1Plus.forEach((user, index) => {
                    content += `${index + 1}. ${user.member.displayName}\n`;
                    content += `   ฿${user.xp.toLocaleString()} | Level ${user.level}\n`;
                });

                content += '\n═══════════════════════════════════════\n';
                content += `Total Pirates: ${level1Plus.length + (pirateKing ? 1 : 0)}\n`;
                content += '```';

                await interaction.editReply({ 
                    content: content, 
                    embeds: [], 
                    files: [], 
                    components: [buttons] 
                });
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

async function createWantedPoster(userData, guild) {
    const width = 600, height = 900;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Load and draw scroll texture background
    try {
        const scrollTexture = await loadImage(path.join(__dirname, '../../assets/scroll_texture.jpg'));
        
        // Draw the texture to fill the entire canvas
        ctx.drawImage(scrollTexture, 0, 0, width, height);
        
        console.log('[DEBUG] Successfully loaded scroll texture background');
    } catch (error) {
        console.log('[DEBUG] Scroll texture not found, using fallback parchment color');
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
        if (guild && userData.userId) member = await guild.members.fetch(userData.userId);
    } catch {}
    
    const avatarArea = { x: photoX + 3, y: photoY + 3, width: photoSize - 6, height: photoSize - 6 }; // Adjusted for wider border
    if (member) {
        try {
            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true });
            const avatar = await loadImage(avatarURL);
            
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
            console.log('[DEBUG] No avatar found, texture will show through');
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
    else if (userData.userId) displayName = `PIRATE ${userData.userId.slice(-4)}`;
    
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
    const bountyStr = userData.xp.toLocaleString();
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
    const bountyX = bountyUnitStartX + berrySize + gapPixels; // Start after berry + gap
    const bountyY = height * (1 - 22/100); // Vert 22: 22% from bottom (same as berry)
    
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111';
    ctx.fillText(bountyStr, bountyX, bountyY);

    // One Piece logo - Size 26, Horiz 50, Vert 4.5
    try {
        const onePieceLogoPath = path.join(__dirname, '../../assets/one-piece-symbol.png');
        const onePieceLogo = await loadImage(onePieceLogoPath);
        const logoSize = (26/100) * 200; // Size 26/100 * reasonable max = 52px
        const logoX = ((50/100) * width) - (logoSize/2); // Horiz 50: centered
        const logoY = height * (1 - 4.5/100) - (logoSize/2); // Vert 4.5: 4.5% from bottom
        
        ctx.globalAlpha = 0.6;
        ctx.filter = 'sepia(0.2) brightness(0.9)';
        ctx.drawImage(onePieceLogo, logoX, logoY, logoSize, logoSize);
        ctx.globalAlpha = 1.0;
        ctx.filter = 'none';
    } catch {
        console.log('[DEBUG] One Piece logo not found at assets/one-piece-symbol.png');
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

    return canvas;
}

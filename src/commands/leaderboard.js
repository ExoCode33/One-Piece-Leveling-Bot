const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { getBountyForLevel } = require('../utils/bountySystem'); // ADDED: Import bounty system
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

        // If this is a button interaction, delete previous messages in background (don't await)
        if (isButton) {
            // Run cleanup asynchronously without blocking
            interaction.channel.messages.fetch({ limit: 10 })
                .then(messages => {
                    const toDelete = messages.filter(msg => 
                        msg.author.id === interaction.client.user.id && 
                        msg.embeds.length > 0 &&
                        msg.id !== interaction.message.id &&
                        msg.embeds[0]?.footer?.text?.includes('Marine Intelligence')
                    );
                    
                    // Delete messages in background
                    toDelete.forEach(msg => msg.delete().catch(() => {}));
                })
                .catch(() => {});
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

            // Process users with cached members
            for (const user of allUsers) {
                const member = members.get(user.userId);
                if (!member) continue;

                if (excludedRoleId && member.roles.cache.has(excludedRoleId)) {
                    pirateKing = { ...user, member };
                    console.log('[DEBUG] Found Pirate King:', member.displayName);
                } else {
                    filteredUsers.push({ ...user, member });
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
                return "MONITORING";
            }

            if (type === 'posters') {
                // TOP 3 BOUNTIES - Show Pirate King + Top 3 with canvas and red intelligence embeds
                const headerEmbed = new EmbedBuilder()
                    .setAuthor({ 
                        name: '🌐 WORLD GOVERNMENT INTELLIGENCE BUREAU'
                    })
                    .setColor(0xFF0000);

                // Add Pirate King to header if exists
                let headerValue = `🚨 **TOP 3 MOST WANTED PIRATES** 🚨\n\n`;
                
                if (pirateKing) {
                    const pirateKingBounty = getBountyForLevel(pirateKing.level);
                    headerValue += `\`\`\`diff\n+ EMPEROR STATUS ALERT\n+ Subject: ${pirateKing.member.displayName}\n+ Bounty: ฿${pirateKingBounty.toLocaleString()}\n+ Classification: PIRATE KING\n+ Status: EXCLUDED FROM STANDARD TRACKING\n! EXTREME CAUTION REQUIRED\n\`\`\`\n\n`;
                }

                headerValue += `\`\`\`diff\n- MARINE INTELLIGENCE DIRECTIVE:\n- The following individuals represent the highest threat\n- levels currently under surveillance. Immediate\n- response protocols are authorized for any sightings.\n\`\`\``;

                headerEmbed.addFields({
                    name: '📋 OPERATION BRIEFING',
                    value: headerValue,
                    inline: false
                });

                // Send header first
                if (isButton) {
                    await interaction.editReply({ embeds: [headerEmbed], components: [buttons] });
                } else {
                    await interaction.editReply({ embeds: [headerEmbed], components: [buttons] });
                }

                // Create posters for Pirate King + Top 3
                const postersToShow = [];
                if (pirateKing) postersToShow.push(pirateKing);
                postersToShow.push(...filteredUsers.slice(0, 3));

                console.log('[DEBUG] Creating', postersToShow.length, 'posters for Top 3');

                // Send each poster with red intelligence embed
                for (let i = 0; i < postersToShow.length; i++) {
                    const userData = postersToShow[i];
                    const isPirateKing = pirateKing && userData === pirateKing;
                    const rank = isPirateKing ? 'PIRATE KING' : `RANK ${i + (pirateKing ? 0 : 1)}`;
                    
                    try {
                        const canvas = await createWantedPoster(userData, interaction.guild);
                        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `wanted_${userData.userId}.png` });
                        
                        // Get bounty amount for embed
                        const bountyAmount = getBountyForLevel(userData.level);
                        
                        // Create red intelligence embed for each poster
                        const embed = new EmbedBuilder()
                            .setAuthor({ 
                                name: '🌐 WORLD GOVERNMENT INTELLIGENCE BUREAU'
                            })
                            .setColor(0xFF0000);

                        // Intelligence summary for this pirate
                        let intelligenceValue = `\`\`\`diff\n- Alias: ${userData.member.displayName}\n- Bounty: ฿${bountyAmount.toLocaleString()}\n- Level: ${userData.level} | Rank: ${rank}\n- Threat: ${getThreatLevelName(userData.level)}\n- Activity: ${userData.messages + userData.reactions + Math.floor(userData.voice_time / 60) > 1000 ? 'HIGH' : userData.messages + userData.reactions + Math.floor(userData.voice_time / 60) > 500 ? 'MODERATE' : userData.messages + userData.reactions + Math.floor(userData.voice_time / 60) > 100 ? 'LOW' : 'MINIMAL'}\n\`\`\``;

                        embed.addFields({
                            name: '📊 INTELLIGENCE SUMMARY',
                            value: intelligenceValue,
                            inline: false
                        });

                        if (isPirateKing) {
                            embed.addFields({
                                name: '👑 SPECIAL CLASSIFICATION',
                                value: `\`\`\`diff\n+ EMPEROR STATUS CONFIRMED\n+ EXCLUDED FROM BOUNTY TRACKING\n+ MAXIMUM THREAT DESIGNATION\n! APPROACH WITH EXTREME CAUTION\n\`\`\``,
                                inline: false
                            });
                        }

                        embed.setImage(`attachment://wanted_${userData.userId}.png`)
                            .setFooter({ 
                                text: `⚓ Marine Intelligence Division • Classification: ${isPirateKing ? 'EMPEROR' : getThreatLevelName(userData.level)}`
                            })
                            .setTimestamp();

                        await interaction.followUp({ embeds: [embed], files: [attachment], components: [buttons] });
                    } catch (error) {
                        console.error('[ERROR] Error creating poster for user', userData.userId, ':', error);
                        continue;
                    }
                }

            } else if (type === 'long') {
                // TOP 10 BOUNTIES - Show Pirate King + Top 10 with canvas and red intelligence embeds
                const headerEmbed = new EmbedBuilder()
                    .setAuthor({ 
                        name: '🌐 WORLD GOVERNMENT INTELLIGENCE BUREAU'
                    })
                    .setColor(0xFF0000);

                // Add comprehensive header for top 10
                let headerValue = `🚨 **TOP 10 MOST WANTED PIRATES** 🚨\n\n`;
                
                if (pirateKing) {
                    const pirateKingBounty = getBountyForLevel(pirateKing.level);
                    headerValue += `\`\`\`diff\n+ EMPEROR STATUS ALERT\n+ Subject: ${pirateKing.member.displayName}\n+ Bounty: ฿${pirateKingBounty.toLocaleString()}\n+ Classification: PIRATE KING\n+ Status: EXCLUDED FROM STANDARD TRACKING\n! EXTREME CAUTION REQUIRED\n\`\`\`\n\n`;
                }

                headerValue += `\`\`\`diff\n- EXTENDED SURVEILLANCE REPORT:\n- This comprehensive assessment covers the ten most\n- dangerous pirates currently under Marine observation.\n- All personnel are advised to review threat profiles\n- and maintain heightened alert status.\n\`\`\``;

                headerEmbed.addFields({
                    name: '📋 EXTENDED OPERATION BRIEFING',
                    value: headerValue,
                    inline: false
                });

                // Send header first
                if (isButton) {
                    await interaction.editReply({ embeds: [headerEmbed], components: [buttons] });
                } else {
                    await interaction.editReply({ embeds: [headerEmbed], components: [buttons] });
                }

                // Create posters for Pirate King + Top 10
                const postersToShow = [];
                if (pirateKing) postersToShow.push(pirateKing);
                postersToShow.push(...filteredUsers.slice(0, 10));

                console.log('[DEBUG] Creating', postersToShow.length, 'posters for Top 10');

                // Send each poster with red intelligence embed
                for (let i = 0; i < postersToShow.length; i++) {
                    const userData = postersToShow[i];
                    const isPirateKing = pirateKing && userData === pirateKing;
                    const rank = isPirateKing ? 'PIRATE KING' : `RANK ${i + (pirateKing ? 0 : 1)}`;
                    
                    try {
                        const canvas = await createWantedPoster(userData, interaction.guild);
                        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `wanted_${userData.userId}.png` });
                        
                        // Get bounty amount for embed
                        const bountyAmount = getBountyForLevel(userData.level);
                        const voiceHours = Math.floor(userData.voice_time / 3600);
                        const voiceMinutes = Math.floor((userData.voice_time % 3600) / 60);
                        
                        // Create detailed red intelligence embed for each poster
                        const embed = new EmbedBuilder()
                            .setAuthor({ 
                                name: '🌐 WORLD GOVERNMENT INTELLIGENCE BUREAU'
                            })
                            .setColor(0xFF0000);

                        // Detailed intelligence summary for top 10
                        let intelligenceValue = `\`\`\`diff\n- Alias: ${userData.member.displayName}\n- Bounty: ฿${bountyAmount.toLocaleString()}\n- Level: ${userData.level} | Rank: ${rank}\n- Threat: ${getThreatLevelName(userData.level)}\n- Messages: ${userData.messages.toLocaleString()}\n- Voice: ${voiceHours}h ${voiceMinutes}m\n- Activity: ${userData.messages + userData.reactions + Math.floor(userData.voice_time / 60) > 1000 ? 'HIGH' : userData.messages + userData.reactions + Math.floor(userData.voice_time / 60) > 500 ? 'MODERATE' : userData.messages + userData.reactions + Math.floor(userData.voice_time / 60) > 100 ? 'LOW' : 'MINIMAL'}\n\`\`\``;

                        embed.addFields({
                            name: '📊 INTELLIGENCE SUMMARY',
                            value: intelligenceValue,
                            inline: false
                        });

                        if (isPirateKing) {
                            embed.addFields({
                                name: '👑 SPECIAL CLASSIFICATION',
                                value: `\`\`\`diff\n+ EMPEROR STATUS CONFIRMED\n+ EXCLUDED FROM BOUNTY TRACKING\n+ MAXIMUM THREAT DESIGNATION\n! APPROACH WITH EXTREME CAUTION\n\`\`\``,
                                inline: false
                            });
                        }

                        embed.setImage(`attachment://wanted_${userData.userId}.png`)
                            .setFooter({ 
                                text: `⚓ Marine Intelligence Division • Classification: ${isPirateKing ? 'EMPEROR' : getThreatLevelName(userData.level)}`
                            })
                            .setTimestamp();

                        await interaction.followUp({ embeds: [embed], files: [attachment], components: [buttons] });
                    } catch (error) {
                        console.error('[ERROR] Error creating poster for user', userData.userId, ':', error);
                        continue;
                    }
                }

            } else if (type === 'full') {
                // ALL THE BOUNTIES - Red intelligence report style, text only, no canvas, level 1+
                const level1Plus = filteredUsers.filter(user => user.level >= 1);
                
                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: '🌐 WORLD GOVERNMENT INTELLIGENCE BUREAU'
                    })
                    .setColor(0xFF0000);

                let intelligenceValue = `🚨 **COMPLETE BOUNTY DATABASE** 🚨\n\n`;

                if (pirateKing) {
                    const pirateKingBounty = getBountyForLevel(pirateKing.level);
                    intelligenceValue += `\`\`\`diff\n+ EMPEROR: ${pirateKing.member.displayName}\n+ Bounty: ฿${pirateKingBounty.toLocaleString()}\n+ Level: ${pirateKing.level} | PIRATE KING\n\`\`\`\n\n`;
                }

                // Split users into chunks to avoid Discord's 1024 character limit
                const chunkSize = 8; // Reduced chunk size
                const chunks = [];
                for (let i = 0; i < level1Plus.length; i += chunkSize) {
                    chunks.push(level1Plus.slice(i, i + chunkSize));
                }

                // First field with header info
                let headerInfo = `\`\`\`yaml\nCOMPLETE SURVEILLANCE DATABASE\nActive Threats: ${level1Plus.length + (pirateKing ? 1 : 0)}\nLast Updated: ${new Date().toLocaleString()}\n\`\`\``;
                
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
                        chunkValue += `${String(globalIndex).padStart(2, '0')}. ${user.member.displayName}\n`;
                        chunkValue += `    ฿${bountyAmount.toLocaleString()} | Lv.${user.level}\n`;
                        chunkValue += `    ${threatLevel.substring(0, 15)}\n\n`;
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

// FIXED: Canvas function now uses bounty amounts instead of XP
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

    // Berry Symbol and Bounty Numbers - FIXED TO USE BOUNTY AMOUNTS
    const berryBountyGap = 5; // Fixed gap in our 1-100 scale
    
    // FIXED: Get BOUNTY amount for user's level instead of XP
    const bountyAmount = getBountyForLevel(userData.level);
    const bountyStr = bountyAmount.toLocaleString();
    
    console.log(`[LEADERBOARD] Level ${userData.level} = Bounty ฿${bountyStr}`);
    
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

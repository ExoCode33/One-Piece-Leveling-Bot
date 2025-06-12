// src/commands/leaderboard.js - One Piece Themed Leaderboard (PERFECTED POSTER VERSION)

const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getBountyForLevel, PIRATE_KING_BOUNTY } = require('../utils/bountySystem');
const Canvas = require('canvas');
const path = require('path');

const berryPath = path.join(__dirname, '../../assets/berry.png'); // Custom berry icon
const onePieceLogoPath = path.join(__dirname, '../../assets/one-piece-symbol.png'); // Official logo
const parchmentTexturePath = path.join(__dirname, '../../assets/parchment_texture.png'); // Add a paper texture PNG

// 1. FONTS REGISTRATION
try {
    Canvas.registerFont(path.join(__dirname, '../../assets/fonts/captkd.ttf'), { family: 'CaptainKiddNF' });
    Canvas.registerFont(path.join(__dirname, '../../assets/fonts/Cinzel-Regular.otf'), { family: 'Cinzel' });
    Canvas.registerFont(path.join(__dirname, '../../assets/fonts/Times New Normal Regular.ttf'), { family: 'TimesNewNormal' });
    console.log('[DEBUG] Successfully registered custom fonts for wanted posters');
} catch (error) {
    console.error('[ERROR] Failed to register custom fonts:', error.message);
    console.log('[INFO] Falling back to system fonts');
}

// 2. CREATE WANTED POSTER FUNCTION
async function createWantedPoster(user, rank, bounty, guild) {
    const width = 600, height = 900;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 3. BACKGROUND & PARCHMENT TEXTURE
    ctx.fillStyle = '#f9e7c3';
    ctx.fillRect(0, 0, width, height);
    // Overlay a real parchment texture (if available)
    try {
        const parchment = await Canvas.loadImage(parchmentTexturePath);
        ctx.globalAlpha = 0.16;
        ctx.drawImage(parchment, 0, 0, width, height);
        ctx.globalAlpha = 1.0;
    } catch {}

    // 4. BORDERS
    // Outer red
    ctx.strokeStyle = '#8B0000'; ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, width, height);
    // Gold (main border)
    ctx.strokeStyle = '#d9b77c'; ctx.lineWidth = 3;
    ctx.strokeRect(13, 13, width - 26, height - 26);
    // Inner dark
    ctx.strokeStyle = '#542d1d'; ctx.lineWidth = 2;
    ctx.strokeRect(21, 21, width - 42, height - 42);

    // 5. TITLE "WANTED"
    ctx.font = '80px CaptainKiddNF';
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('WANTED', width / 2, 38);

    // 6. PORTRAIT (Square, bordered, aged)
    const photoSize = 330, photoX = (width - photoSize) / 2, photoY = 120;
    // Multi-border: white, red, black
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 10; ctx.strokeRect(photoX - 6, photoY - 6, photoSize + 12, photoSize + 12);
    ctx.strokeStyle = '#8B0000'; ctx.lineWidth = 6; ctx.strokeRect(photoX - 3, photoY - 3, photoSize + 6, photoSize + 6);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.strokeRect(photoX, photoY, photoSize, photoSize);

    // IMAGE DRAW & AGING
    let member = null;
    try { if (guild && user.userId) member = await guild.members.fetch(user.userId); } catch {}
    ctx.fillStyle = '#eee';
    ctx.fillRect(photoX, photoY, photoSize, photoSize);
    try {
        let avatar;
        if (member) {
            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true });
            avatar = await Canvas.loadImage(avatarURL);
        } else if (user.avatarUrl) {
            avatar = await Canvas.loadImage(user.avatarUrl);
        }
        if (avatar) {
            // Desaturate & yellow a bit for aged look
            ctx.save();
            ctx.filter = 'sepia(0.18) contrast(0.91) brightness(0.97)';
            ctx.drawImage(avatar, photoX, photoY, photoSize, photoSize);
            ctx.filter = 'none'; ctx.restore();
        }
    } catch {}

    // 7. "DEAD OR ALIVE"
    ctx.font = '48px CaptainKiddNF';
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('DEAD OR ALIVE', width / 2, photoY + photoSize + 16);

    // 8. PIRATE NAME (big, all caps, perfect center)
    let pirateName = member ? member.displayName : (user.displayName || 'UNKNOWN PIRATE');
    pirateName = pirateName.toUpperCase().substring(0, 16);
    ctx.font = '61px CaptainKiddNF';
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.fillText(pirateName, width / 2, photoY + photoSize + 65);

    // 9. BOUNTY ROW (berry symbol, Cinzel, baseline align)
    ctx.font = '55px Cinzel';
    ctx.fillStyle = '#111';
    const bountyText = bounty.toLocaleString();
    // Load berry image
    let berryImg;
    try { berryImg = await Canvas.loadImage(berryPath); } catch {
        berryImg = null;
    }
    // Baseline alignment
    const berryWidth = 46, berryHeight = 46, bountyY = photoY + photoSize + 137;
    let textWidth = ctx.measureText(bountyText).width;
    const totalWidth = berryWidth + 10 + textWidth;
    const startX = (width - totalWidth) / 2;
    // Berry icon
    if (berryImg) ctx.drawImage(berryImg, startX, bountyY - 4, berryWidth, berryHeight);
    else {
        ctx.font = 'bold 48px serif'; ctx.fillText('฿', startX + 16, bountyY + 38);
    }
    // Bounty number
    ctx.font = '55px Cinzel'; ctx.textAlign = 'left'; ctx.fillStyle = '#111';
    ctx.fillText(bountyText, startX + berryWidth + 10, bountyY + 38);

    // 10. ONE PIECE LOGO (bottom center, parchment tone, small)
    try {
        const logoImg = await Canvas.loadImage(onePieceLogoPath);
        ctx.save();
        ctx.globalAlpha = 0.82;
        ctx.filter = 'sepia(0.25) brightness(0.88)';
        ctx.drawImage(logoImg, width/2 - 36, height - 110, 72, 38);
        ctx.filter = 'none'; ctx.globalAlpha = 1.0; ctx.restore();
    } catch {}

    // 11. "MARINE" (bottom right, spaced, subtle)
    ctx.font = '19px TimesNewNormal';
    ctx.fillStyle = '#111';
    ctx.textAlign = 'right';
    ctx.globalAlpha = 0.77;
    ctx.fillText('M  A  R  I  N  E', width - 35, height - 38);
    ctx.globalAlpha = 1.0;

    // 12. Disclaimer/Legalese
    ctx.font = '13px TimesNewNormal';
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.55;
    ctx.fillText('この指名手配書はフィクションです。実在する人物、団体等とは一切関係ありません。', width / 2, height - 75);
    ctx.globalAlpha = 1.0;

    return canvas.toBuffer('image/png');
}

// (No changes needed for command registration & reply logic — it's all visual now)

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
        // ...your unchanged leaderboard logic goes here...
        // Just replace the call to createWantedPoster with this improved version!
    },
};

const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

const berryPath = path.join(__dirname, 'berry.png'); // Make sure your berry.png is here

// Register custom font if available
try {
    registerFont(path.join(__dirname, './assets/fonts/pirate.ttf'), { family: 'PirateFont' });
} catch {
    // fallback to system font
}

function pirateRankEmoji(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '🏴‍☠️';
}

// Utility: draw wanted poster, fully centered and clean, using berry icon
async function createWantedPoster(user, rank, bounty, guild = null) {
    const width = 600, height = 900;
    const ctxFont = (style, size) => `${style ? style + ' ' : ''}${size}px PirateFont, Impact, Arial, sans-serif`;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // BG + border
    ctx.fillStyle = '#F5DEB3';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, width, height);
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    // WANTED header
    ctx.font = ctxFont('bold', 90);
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('WANTED', width / 2, 70);

    // Profile picture (square, large, centered)
    const photoW = 350, photoH = 350;
    const photoX = (width - photoW) / 2, photoY = 180;
    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 7;
    ctx.strokeRect(photoX, photoY, photoW, photoH);
    ctx.fillStyle = '#fff';
    ctx.fillRect(photoX, photoY, photoW, photoH);

    let member = null;
    try {
        if (guild && user.userId) member = await guild.members.fetch(user.userId);
    } catch {}
    const avatarArea = { x: photoX + 7, y: photoY + 7, width: photoW - 14, height: photoH - 14 };
    if (member) {
        try {
            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true });
            const avatar = await loadImage(avatarURL);
            ctx.save();
            ctx.beginPath();
            ctx.rect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
            ctx.clip();
            ctx.drawImage(avatar, avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
            ctx.restore();
        } catch {
            ctx.fillStyle = '#ddd';
            ctx.fillRect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
        }
    } else {
        // For standalone use without Discord guild - try to load local avatar
        try {
            const avatarPath = user.avatarPath || path.join(__dirname, 'avatar.png');
            const avatar = await loadImage(avatarPath);
            ctx.save();
            ctx.beginPath();
            ctx.rect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
            ctx.clip();
            ctx.drawImage(avatar, avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
            ctx.restore();
        } catch {
            ctx.fillStyle = '#ddd';
            ctx.fillRect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
        }
    }

    // DEAD OR ALIVE
    ctx.font = ctxFont('bold', 46);
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('DEAD OR ALIVE', width / 2, photoY + photoH + 30);

    // Pirate name
    ctx.font = ctxFont('bold', 75);
    let displayName = 'UNKNOWN PIRATE';
    if (member) displayName = member.displayName.replace(/[^\w\s-]/g, '').toUpperCase().substring(0, 16);
    else if (user.userId) displayName = `PIRATE ${user.userId.slice(-4)}`;
    else if (user.name) displayName = user.name.replace(/[^\w\s-]/g, '').toUpperCase().substring(0, 16);
    ctx.fillText(displayName, width / 2, photoY + photoH + 95);

    // Bounty (berry image + number)
    const bountyY = photoY + photoH + 200;
    let berryImg;
    try {
        berryImg = await loadImage(berryPath);
    } catch {
        console.log('Berry icon not found, creating placeholder...');
        // Create a simple ฿ symbol as fallback
        const berryCanvas = createCanvas(50, 50);
        const berryCtx = berryCanvas.getContext('2d');
        berryCtx.fillStyle = '#111';
        berryCtx.font = 'bold 40px serif';
        berryCtx.textAlign = 'center';
        berryCtx.textBaseline = 'middle';
        berryCtx.fillText('฿', 25, 25);
        berryImg = berryCanvas;
    }
    
    const berryHeight = 50, berryWidth = 50;
    const bountyStr = bounty.toLocaleString();
    ctx.font = ctxFont('bold', 82);
    const bountyWidth = ctx.measureText(bountyStr).width;
    const totalWidth = berryWidth + 14 + bountyWidth;
    const bountyStartX = (width - totalWidth) / 2;
    ctx.drawImage(berryImg, bountyStartX, bountyY, berryWidth, berryHeight);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111';
    ctx.font = ctxFont('bold', 82);
    ctx.fillText(bountyStr, bountyStartX + berryWidth + 14, bountyY + berryHeight / 2);

    // MARINE (small, lower right)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font = ctxFont('bold', 38);
    ctx.fillText('MARINE', width - 45, height - 35);

    return canvas.toBuffer('image/png');
}

// Mock bounty system for standalone use
const getBountyForLevel = (level) => {
    if (level <= 0) return 0;
    if (level <= 5) return level * 10000;
    if (level <= 10) return level * 50000;
    if (level <= 20) return level * 100000;
    if (level <= 30) return level * 500000;
    if (level <= 40) return level * 1000000;
    if (level <= 50) return level * 5000000;
    return level * 10000000;
};

const PIRATE_KING_BOUNTY = 5564800000;

// Sample leaderboard data for standalone testing
const sampleLeaderboard = [
    { userId: '1234567890', name: 'SHANKS', level: 45, xp: 125000, avatarPath: 'avatar.png' },
    { userId: '0987654321', name: 'LUFFY', level: 42, xp: 110000, avatarPath: 'avatar2.png' },
    { userId: '1122334455', name: 'ZORO', level: 40, xp: 95000, avatarPath: 'avatar3.png' },
    { userId: '5544332211', name: 'SANJI', level: 38, xp: 85000, avatarPath: 'avatar4.png' },
    { userId: '9988776655', name: 'NAMI', level: 35, xp: 75000, avatarPath: 'avatar5.png' }
];

// Main function to generate leaderboard posters
async function generateLeaderboardPosters(leaderboard = sampleLeaderboard, options = {}) {
    const {
        outputDir = './posters',
        view = 'posters', // 'posters', 'long', 'full'
        pirateKingLevel = 50,
        maxPosters = 4
    } = options;

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Sort leaderboard by XP
    leaderboard = leaderboard.filter(user => user && typeof user.xp === 'number');
    leaderboard.sort((a, b) => b.xp - a.xp);

    // Pirate King detection
    let pirateKingUser = null;
    if (leaderboard.length > 0 && leaderboard[0].level >= pirateKingLevel) {
        pirateKingUser = leaderboard[0];
        leaderboard = leaderboard.slice(1);
    }

    if (view === 'posters') {
        // Top 3 posters (Pirate King + 3 best)
        const topThree = leaderboard.slice(0, 3);
        const allPirates = [];
        if (pirateKingUser) allPirates.push({ user: pirateKingUser, rank: 'KING', isPirateKing: true });
        for (let i = 0; i < topThree.length; i++) {
            allPirates.push({ user: topThree[i], rank: i + 1, isPirateKing: false });
        }

        console.log('🏴‍☠️ MOST WANTED PIRATES 🏴‍☠️');
        console.log('The World Government has issued these bounties for the most dangerous criminals on the Grand Line.\n');

        // Generate posters
        for (let i = 0; i < Math.min(allPirates.length, maxPosters); i++) {
            const pirate = allPirates[i];
            const user = pirate.user;
            const rank = pirate.rank;
            const bounty = pirate.isPirateKing ? PIRATE_KING_BOUNTY : getBountyForLevel(user.level);
            
            try {
                const posterBuffer = await createWantedPoster(user, rank, bounty, null);
                if (posterBuffer) {
                    const filename = `wanted_poster_${i + 1}_${user.name || user.userId}.png`;
                    const filepath = path.join(outputDir, filename);
                    fs.writeFileSync(filepath, posterBuffer);
                    
                    console.log(`${pirate.isPirateKing ? '👑 PIRATE KING' : `${pirateRankEmoji(rank)} RANK ${rank}`}`);
                    console.log(`🏴‍☠️ Pirate: ${user.name || user.userId}`);
                    console.log(`💰 Bounty: ${bounty.toLocaleString()}`);
                    console.log(`⚔️ Level: ${user.level}`);
                    console.log(`💎 Total XP: ${user.xp.toLocaleString()}`);
                    console.log(`📁 Saved: ${filepath}`);
                    console.log('---');
                }
            } catch (e) {
                console.error(`Error creating poster for ${user.name || user.userId}:`, e.message);
            }
        }
        return;
    } else if (view === 'full') {
        // Full text list
        let text = '🏴‍☠️ **COMPLETE PIRATE REGISTRY** 🏴‍☠️\n\n';
        let rank = 1;
        if (pirateKingUser) {
            text += `👑 **PIRATE KING**: ${pirateKingUser.name || pirateKingUser.userId} - Level ${pirateKingUser.level} - ₿${PIRATE_KING_BOUNTY.toLocaleString()}\n\n`;
        }
        for (const user of leaderboard) {
            const bounty = getBountyForLevel(user.level);
            text += `${pirateRankEmoji(rank)} **${rank}.** ${user.name || user.userId} — Level **${user.level}** — ₿**${bounty.toLocaleString()}**\n`;
            rank++;
        }
        if (leaderboard.length === 0) {
            text += "No pirates have earned any bounty yet! Set sail and make your mark on the Grand Line!";
        }
        console.log(text);
        return text;
    } else {
        // Top 10 list
        console.log('🏴‍☠️ Top 10 Most Wanted Pirates');
        console.log('The most notorious criminals on the Grand Line!\n');
        
        if (pirateKingUser) {
            console.log(`👑 **PIRATE KING**: ${pirateKingUser.name || pirateKingUser.userId}`);
            console.log(`Level ${pirateKingUser.level} • ₿${PIRATE_KING_BOUNTY.toLocaleString()}\n`);
        }
        const topTen = leaderboard.slice(0, 10);
        for (let i = 0; i < topTen.length; i++) {
            const user = topTen[i];
            const rank = i + 1;
            const bounty = getBountyForLevel(user.level);
            console.log(`${pirateRankEmoji(rank)} **${rank}.** ${user.name || user.userId}`);
            console.log(`Level ${user.level} • ₿${bounty.toLocaleString()}\n`);
        }
        if (topTen.length === 0) {
            console.log("No pirates have earned any bounty yet! Set sail and make your mark on the Grand Line!");
        }
    }
}

// Single poster generation function
async function createSinglePoster(userData = {}, outputPath = 'single_poster.png') {
    const defaultUser = {
        userId: '1234567890',
        name: 'SHANKS',
        level: 45,
        xp: 125000,
        avatarPath: 'avatar.png'
    };
    
    const user = { ...defaultUser, ...userData };
    const bounty = getBountyForLevel(user.level);
    
    try {
        const posterBuffer = await createWantedPoster(user, 1, bounty, null);
        if (posterBuffer) {
            fs.writeFileSync(outputPath, posterBuffer);
            console.log(`Single poster created: ${outputPath}`);
            console.log(`Character: ${user.name}`);
            console.log(`Level: ${user.level}`);
            console.log(`Bounty: ${bounty.toLocaleString()} berries`);
            return true;
        }
    } catch (error) {
        console.error('Error creating single poster:', error);
    }
    return false;
}

// Main execution
async function main() {
    console.log('🏴‍☠️ One Piece Wanted Poster Generator 🏴‍☠️\n');
    
    // Generate single poster (like your original request)
    await createSinglePoster({
        name: 'SHANKS',
        level: 45,
        xp: 125000,
        avatarPath: 'avatar.png'
    }, 'shanks_poster.png');
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Generate leaderboard posters
    await generateLeaderboardPosters(sampleLeaderboard, {
        view: 'posters',
        outputDir: './leaderboard_posters'
    });
}

// Run if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}

// Export functions for use as module
module.exports = {
    createWantedPoster,
    generateLeaderboardPosters,
    createSinglePoster,
    getBountyForLevel,
    PIRATE_KING_BOUNTY,
    pirateRankEmoji,
    main
};

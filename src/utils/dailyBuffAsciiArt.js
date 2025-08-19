// src/utils/dailyBuffAsciiArt.js - Dynamic Mathematical ASCII Animation

class DailyBuffAsciiAnimator {
    
    // Animation Configuration
    static ANIMATION_CONFIG = {
        BUILDUP_DELAY: 600,      
        EXPLOSION_DELAY: 200,    
        FINAL_PAUSE: 2000,       
        BUILDUP_FRAMES: 8,       
        EXPLOSION_FRAMES: 15,    
        AFTERGLOW_FRAMES: 3      
    };

    // Get tier-specific configuration
    static getTierConfig(tier) {
        const configs = {
            1: { name: 'COMMON', color: '#22C55E' },
            2: { name: 'RARE', color: '#3B82F6' },
            3: { name: 'EPIC', color: '#8B5CF6' },
            4: { name: 'LEGENDARY', color: '#F59E0B' },
            5: { name: 'MYTHICAL', color: '#F97316' },
            6: { name: 'DIVINE', color: '#EF4444' }
        };
        return configs[tier] || configs[1];
    }

    // Character sets for different intensities
    static getCharset(intensity = 'medium') {
        const charsets = {
            light: '·░▒',
            medium: '░▒▓█',
            heavy: '⠀⠁⠂⠃⠄⠅⠆⠇⠈⠉⠊⠋⠌⠍⠎⠏⠐⠑⠒⠓⠔⠕⠖⠗⠘⠙⠚⠛⠜⠝⠞⠟⠠⠡⠢⠣⠤⠥⠦⠧⠨⠩⠪⠫⠬⠭⠮⠯⠰⠱⠲⠳⠴⠵⠶⠷⠸⠹⠺⠻⠼⠽⠾⠿⡀⡁⡂⡃⡄⡅⡆⡇⡈⡉⡊⡋⡌⡍⡎⡏⡐⡑⡒⡓⡔⡕⡖⡗⡘⡙⡚⡛⡜⡝⡞⡟⡠⡡⡢⡣⡤⡥⡦⡧⡨⡩⡪⡫⡬⡭⡮⡯⡰⡱⡲⡳⡴⡵⡶⡷⡸⡹⡺⡻⡼⡽⡾⡿⢀⢁⢂⢃⢄⢅⢆⢇⢈⢉⢊⢋⢌⢍⢎⢏⢐⢑⢒⢓⢔⢕⢖⢗⢘⢙⢚⢛⢜⢝⢞⢟⢠⢡⢢⢣⢤⢥⢦⢧⢨⢩⢪⢫⢬⢭⢮⢯⢰⢱⢲⢳⢴⢵⢶⢷⢸⢹⢺⢻⢼⢽⢾⢿⣀⣁⣂⣃⣄⣅⣆⣇⣈⣉⣊⣋⣌⣍⣎⣏⣐⣑⣒⣓⣔⣕⣖⣗⣘⣙⣚⣛⣜⣝⣞⣟⣠⣡⣢⣣⣤⣥⣦⣧⣨⣩⣪⣫⣬⣭⣮⣯⣰⣱⣲⣳⣴⣵⣶⣷⣸⣹⣺⣻⣼⣽⣾⣿',
            explosion: '·░▒▓█◊◈◉●○◯⬢⬡⬟⬠',
            crystalline: '◊◈◉●○◯⬢⬡⬟⬠◐◑◒◓◔◕'
        };
        return charsets[intensity] || charsets.medium;
    }

    // Mathematical pattern generators based on your HTML
    static generatePattern(x, y, time, frameWidth, frameHeight, pattern = 'centerSpiral') {
        const xConstant = -0.01;
        const yConstant = 50;
        const frameMultiplier = 0.1;
        const globalVal = 5;

        let mirrorX = x;
        let mirrorY = y;

        // Mirror on Y axis like your code
        if (y > frameHeight / 2) {
            mirrorY = frameHeight - y;
        }

        let value;

        switch (pattern) {
            case 'centerSpiral': {
                let dx = mirrorX - frameWidth / 2;
                let dy = mirrorY - frameHeight / 2;
                let theta = Math.atan2(dy, dx) + xConstant;
                let curvature = Math.sin(theta * yConstant);
                let wave = globalVal * Math.sin(mirrorX * xConstant + time);
                let density = Math.sin(theta * frameMultiplier);
                let localSpeed = Math.sin(mirrorX * xConstant + mirrorY * yConstant);
                let r = (theta + (time + localSpeed) * frameMultiplier + curvature + wave) * (1 + density);
                value = Math.sin(r);
                break;
            }
            case 'expanding': {
                value = Math.sin(Math.sqrt((mirrorX - frameWidth / 2) * (mirrorX - frameWidth / 2) + (mirrorY - frameHeight / 2) * (mirrorY - frameHeight / 2)) * frameMultiplier + time * frameMultiplier);
                break;
            }
            case 'burst': {
                value = Math.sin((mirrorX - frameWidth / 2) * (mirrorX - frameWidth / 2) + (mirrorY - frameHeight / 2) * (mirrorY - frameHeight / 2) + time) * (yConstant / xConstant);
                break;
            }
            case 'concentricCircles': {
                value = Math.sin(Math.sqrt((mirrorX - frameWidth / 2) * (mirrorX - frameWidth / 2) + (mirrorY - frameHeight / 2) * (mirrorY - frameHeight / 2)) + time);
                break;
            }
            case 'swirling': {
                value = Math.sin(mirrorX * xConstant + time) + Math.cos(mirrorY * yConstant + time);
                break;
            }
            case 'spiralWave': {
                value = Math.sin(mirrorX * xConstant + time) + Math.cos(Math.sqrt(mirrorY * mirrorY + mirrorX * mirrorX) + time);
                break;
            }
            case 'cross': {
                value = Math.sin((mirrorX - frameWidth / 2) * (mirrorX - frameWidth / 2) * xConstant + time * frameMultiplier) + Math.cos((mirrorY - frameHeight / 2) * (mirrorY - frameHeight / 2) * yConstant + time * frameMultiplier);
                break;
            }
            case 'radialRays': {
                value = Math.sin(mirrorX * xConstant + mirrorY * yConstant) * Math.cos(time);
                break;
            }
            case 'helix': {
                value = Math.sin(mirrorX * xConstant + mirrorY * yConstant + time) * Math.cos(mirrorY * yConstant + time * 2);
                break;
            }
            case 'pulsating': {
                value = Math.sin((mirrorX * xConstant + mirrorY * yConstant) * frameMultiplier + time);
                break;
            }
            default:
                value = 0;
                break;
        }

        return value;
    }

    // Generate ASCII frame using mathematical patterns
    static generateFrame(time, frameWidth = 40, frameHeight = 20, pattern = 'centerSpiral', charset = '░▒▓█') {
        let output = '';

        for (let y = 0; y < frameHeight; y++) {
            for (let x = 0; x < frameWidth; x++) {
                const value = this.generatePattern(x, y, time, frameWidth, frameHeight, pattern);
                const index = Math.floor((value + 2) / 4 * charset.length);
                const char = charset[index] || charset.charAt(charset.length - 1);
                output += char;
            }
            output += '\n';
        }

        return output.trim();
    }

    // PHASE 1: Energy Detection & Buildup (8 frames)
    static createDetectionFrame(frame) {
        const time = frame * 0.5;
        const intensity = Math.min(frame / 7, 1); // Build up intensity
        
        if (frame < 2) {
            // Start with minimal activity
            return this.generateFrame(time, 40, 12, 'centerSpiral', '·');
        } else if (frame < 4) {
            // Growing energy
            return this.generateFrame(time, 40, 15, 'expanding', '·░');
        } else if (frame < 6) {
            // Swirling buildup
            return this.generateFrame(time, 40, 18, 'swirling', '·░▒');
        } else {
            // Critical mass
            return this.generateFrame(time, 40, 20, 'centerSpiral', '░▒▓');
        }
    }

    // PHASE 2: Massive Explosion Sequence (15 frames)
    static createExplosionFrame(frame) {
        const time = frame * 0.3;
        const patterns = [
            'cross',           // Initial cross burst
            'burst',           // Expanding burst
            'radialRays',      // Rays shooting out
            'expanding',       // Growing circle
            'concentricCircles', // Ripple waves
            'spiralWave',      // Spiral energy
            'swirling',        // Swirling vortex
            'helix',           // Helical patterns
            'pulsating',       // Pulsing energy
            'centerSpiral',    // Complex spiral
            'burst',           // Secondary burst
            'concentricCircles', // More ripples
            'swirling',        // Final swirl
            'expanding',       // Stabilizing
            'centerSpiral'     // Final form
        ];

        const pattern = patterns[Math.min(frame, patterns.length - 1)];
        const charset = this.getCharset('explosion');
        
        return this.generateFrame(time, 45, 22, pattern, charset);
    }

    // PHASE 3: Final Result Matrices - Tier-specific crystalline patterns
    static createFinalResult(tier) {
        const time = 10; // Fixed time for stable pattern
        const patterns = {
            1: 'pulsating',
            2: 'concentricCircles', 
            3: 'spiralWave',
            4: 'helix',
            5: 'centerSpiral',
            6: 'burst'
        };

        const charsets = {
            1: '░▒▓',
            2: '▒▓█',
            3: '▓█◊',
            4: '█◊◈',
            5: '◊◈◉',
            6: '◈◉●○'
        };

        const pattern = patterns[tier] || patterns[1];
        const charset = charsets[tier] || charsets[1];
        
        return this.generateFrame(time, 42, 20, pattern, charset);
    }

    // Get hex color for embeds based on tier
    static getTierColorHex(tier) {
        const colors = {
            1: 0x22C55E, // Green
            2: 0x3B82F6, // Blue  
            3: 0x8B5CF6, // Purple
            4: 0xF59E0B, // Gold
            5: 0xF97316, // Orange
            6: 0xEF4444  // Red
        };
        return colors[tier] || 0x6B7280;
    }

    // Generate phase-appropriate status messages
    static getPhaseMessage(phase, frame, tier) {
        const config = this.getTierConfig(tier);
        
        const messages = {
            detection: [
                "Scanning mystical energy signature...",
                "Energy particles detected...", 
                "Magical resonance building...",
                "Enhancement pattern forming...",
                "Power matrix stabilizing...",
                "Energy concentration rising...",
                "Critical threshold approaching...",
                `${config.name} enhancement confirmed!`
            ],
            explosion: [
                "ENERGY SURGE DETECTED!",
                "MASSIVE POWER DISCHARGE!",
                "ENHANCEMENT MATERIALIZATION!",
                "CROSS PATTERN FORMING!",
                "RADIAL BURST EXPANDING!",
                "SPIRAL ENERGY MANIFESTING!",
                "VORTEX STABILIZATION!",
                "HELICAL PATTERNS ACTIVE!",
                "POWER CRYSTALLIZATION!",
                "MATRIX SOLIDIFICATION!",
                "SECONDARY WAVE DETECTED!",
                "RIPPLE HARMONICS ACTIVE!",
                "FINAL SPIRAL FORMATION!",
                "ENERGY STABILIZATION!", 
                "ENHANCEMENT COMPLETE!"
            ]
        };

        if (phase === 'detection') {
            return messages.detection[Math.min(frame, messages.detection.length - 1)];
        } else if (phase === 'explosion') {
            return messages.explosion[Math.min(frame, messages.explosion.length - 1)];
        }
        
        return "Processing enhancement...";
    }

    // Create animated ASCII art sequence data
    static createAnimationSequence(tier) {
        const config = this.getTierConfig(tier);
        const sequence = [];

        // Phase 1: Detection frames
        for (let i = 0; i < this.ANIMATION_CONFIG.BUILDUP_FRAMES; i++) {
            sequence.push({
                phase: 'detection',
                frame: i,
                ascii: this.createDetectionFrame(i),
                message: this.getPhaseMessage('detection', i, tier),
                progress: Math.round(((i + 1) / this.ANIMATION_CONFIG.BUILDUP_FRAMES) * 100),
                delay: this.ANIMATION_CONFIG.BUILDUP_DELAY,
                color: '#4A90E2'
            });
        }

        // Phase 2: Explosion frames
        for (let i = 0; i < this.ANIMATION_CONFIG.EXPLOSION_FRAMES; i++) {
            sequence.push({
                phase: 'explosion',
                frame: i,
                ascii: this.createExplosionFrame(i),
                message: this.getPhaseMessage('explosion', i, tier),
                progress: 100,
                delay: this.ANIMATION_CONFIG.EXPLOSION_DELAY,
                color: this.getTierColorHex(tier)
            });
        }

        // Phase 3: Final result
        sequence.push({
            phase: 'result',
            frame: 0,
            ascii: this.createFinalResult(tier),
            message: `${config.name} Enhancement Acquired!`,
            progress: 100,
            delay: this.ANIMATION_CONFIG.FINAL_PAUSE,
            color: this.getTierColorHex(tier),
            tier: tier,
            config: config
        });

        return sequence;
    }

    // Create a simple loading bar animation
    static createLoadingBar(progress, width = 20) {
        const filled = Math.floor((progress / 100) * width);
        const empty = width - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
    }

    // Create status display with progress
    static createStatusDisplay(sequenceItem, tier) {
        const loadingBar = this.createLoadingBar(sequenceItem.progress);
        const config = this.getTierConfig(tier);
        
        return `**${sequenceItem.message}**

\`\`\`
${sequenceItem.ascii}
\`\`\`

**Energy Reading:** ${sequenceItem.progress}%
**Progress:** [${loadingBar}] ${sequenceItem.progress}%
${sequenceItem.phase === 'result' ? `**Enhancement:** ${config.name} (${this.getBuffMultiplier(tier)}x)` : ''}`;
    }

    // Get buff multiplier for tier
    static getBuffMultiplier(tier) {
        const multipliers = {
            1: 1.1,
            2: 1.2,
            3: 1.3,
            4: 1.5,
            5: 1.7,
            6: 2.0
        };
        return multipliers[tier] || 1.1;
    }
}

// Export the class
module.exports = DailyBuffAsciiAnimator;

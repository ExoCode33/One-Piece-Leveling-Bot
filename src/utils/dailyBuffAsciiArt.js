// src/utils/dailyBuffAsciiArt.js - ASCII Art Animation for Daily Buff System

class DailyBuffAsciiAnimator {
    
    // Animation Configuration
    static ANIMATION_CONFIG = {
        BUILDUP_DELAY: 800,      // Slow buildup for maximum tension
        EXPLOSION_DELAY: 300,    // Fast explosion frames
        FINAL_PAUSE: 2500,       // Long pause on final result
        BUILDUP_FRAMES: 8,       
        EXPLOSION_FRAMES: 12,    
        AFTERGLOW_FRAMES: 4      
    };

    // Get tier-specific configuration
    static getTierConfig(tier) {
        const configs = {
            1: { name: 'COMMON', color: '#22C55E', intensity: '░' },
            2: { name: 'RARE', color: '#3B82F6', intensity: '▒' },
            3: { name: 'EPIC', color: '#8B5CF6', intensity: '▓' },
            4: { name: 'LEGENDARY', color: '#F59E0B', intensity: '█' },
            5: { name: 'MYTHICAL', color: '#F97316', intensity: '█' },
            6: { name: 'DIVINE', color: '#EF4444', intensity: '█' }
        };
        return configs[tier] || configs[1];
    }

    // PHASE 1: Energy Detection & Buildup (8 frames)
    static createDetectionFrame(frame) {
        const frames = [
            // Frame 0: Empty space
            `⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`,

            // Frame 1: Tiny spark
            `⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`,

            // Frame 2: Small energy pulse
            `⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⢄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`,

            // Frame 3: Growing energy
            `⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣾⡆⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠂⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`,

            // Frame 4: Energy expanding
            `⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣪⣷⣦⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣾⣽⣻⣾⡆⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⣯⣿⡷⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠂⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`,

            // Frame 5: Pre-explosion buildup
            `⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡀⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⣪⣷⣿⣾⣦⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣾⣽⣻⣿⣻⣾⡆⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣸⣯⣿⣿⣿⣿⡷⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⣯⣿⣿⣿⡷⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠙⠛⠋⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`,

            // Frame 6: Critical mass building
            `      ░░░░░░░     ▒▒▒▒▒▒▒     ░░░░░░░      
   ░░░          ▒▒▒       ▒▒▒          ░░░   
 ░░               ▒▒▒   ▒▒▒               ░░ 
░░      ░▒▓█  ENERGY SURGE  █▓▒░      ░░
░░         ░▒▓███  ████  ███▓▒░         ░░
 ░░            ░▒▓█████▓▒░            ░░ 
   ░░░           ░▒▓▒░           ░░░   
      ░░░░░░░               ░░░░░░░      `,

            // Frame 7: Maximum energy concentration
            `     ▒▒▒▒▒▒▒     ▓▓▓▓▓▓▓     ▒▒▒▒▒▒▒     
  ▒▒▒         ▓▓▓       ▓▓▓         ▒▒▒  
▒▒              ▓▓▓   ▓▓▓              ▒▒
▒    ▒▓█  CRITICAL MASS  █▓▒    ▒
▒▒       ▒▓████  ████  ████▓▒       ▒▒
▒▒         ▒▓████████████▓▒         ▒▒
  ▒▒▒        ▒▓████████▓▒        ▒▒▒  
     ▒▒▒▒▒▒▒     ▓▓▓     ▒▒▒▒▒▒▒     `
        ];
        
        return frames[Math.min(frame, frames.length - 1)] || frames[0];
    }

    // PHASE 2: Massive Explosion Sequence (12 frames)
    static createExplosionFrame(frame) {
        const explosionFrames = [
            // Frame 0: Initial burst
            `████████████████████████████████████████████
██                                        ██
██    ███████  ██      ██  ██████████    ██
██    ██       ██      ██  ██      ██    ██
██    ███████  ██      ██  ███████       ██
██    ██       ██      ██  ██            ██
██    ███████  ██████████  ██            ██
██                                        ██
████████████████████████████████████████████`,

            // Frame 1: Cross explosion
            `████████████████████████████████████████████
████████████████████████████████████████████
████████████████████████████████████████████
████████████████████████████████████████████
████████████████████████████████████████████
████████████████████████████████████████████
████████████████████████████████████████████
████████████████████████████████████████████
████████████████████████████████████████████`,

            // Frame 2: Star burst pattern
            `        ████        ████████        ████        
    ████████████    ████████    ████████████    
████████████████████████████████████████████████
████████████████████████████████████████████████
████████████████████████████████████████████████
████████████████████████████████████████████████
████████████████████████████████████████████████
    ████████████    ████████    ████████████    
        ████        ████████        ████        `,

            // Frame 3: Massive expansion
            `████████████████████████████████████████████
████████████████████████████████████████████
████████████████████████████████████████████
████████████████████████████████████████████
████████████████████████████████████████████
████████████████████████████████████████████
████████████████████████████████████████████
████████████████████████████████████████████
████████████████████████████████████████████`,

            // Frame 4: Energy waves rippling outward
            `▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
████████████████████████████████████████████
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓`,

            // Frame 5: Diamond crystallization
            `        ██████████████████████████████        
    ██████████████████████████████████████████    
██████████████████████████████████████████████████
██████████████████████████████████████████████████
████████████        ████        ████████████
██████████████████████████████████████████████████
██████████████████████████████████████████████████
    ██████████████████████████████████████████    
        ██████████████████████████████        `,

            // Frame 6: Spiral energy pattern
            `     ██████████████████████████████████     
   ████████████████████████████████████████████   
 ████████████████████████████████████████████████ 
████████████████████████████████████████████████
████████████████████████████████████████████████
████████████████████████████████████████████████
 ████████████████████████████████████████████████ 
   ████████████████████████████████████████████   
     ██████████████████████████████████████     `,

            // Frame 7: Multiple ring explosions
            `████████████████████████████████████████████
████ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ████
██░░                                    ░░██
██░   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   ░██
██░   ▓░                          ░▓   ░██
██░   ▓░   ██████████████████   ░▓   ░██
██░   ▓░                          ░▓   ░██
██░   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   ░██
██░░                                    ░░██
████ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ████
████████████████████████████████████████████`,

            // Frame 8: Swirling vortex
            `     ████████████████████████████████████     
   ██████████████████████████████████████████   
 ████████████████████████████████████████████████ 
████████████████████████████████████████████████
████████████████████████████████████████████████
████████████████████████████████████████████████
████████████████████████████████████████████████
████████████████████████████████████████████████
 ████████████████████████████████████████████████ 
   ██████████████████████████████████████████   
     ████████████████████████████████████     `,

            // Frame 9: Lightning cracks
            `▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▓░                                          ░▓
▓░      ░▒▓█   MASSIVE ENERGY   █▓▒░      ░▓
▓░        ░▒▓████████████████▓▒░        ░▓
▓░          ░▒▓██████████▓▒░          ░▓
▓░            ░▒▓██████▓▒░            ░▓
▓░              ░▒▓██▓▒░              ░▓
▓░                ░▒░                ░▓
▓░                                          ░▓
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓`,

            // Frame 10: Energy stabilization
            `        ████████████████████████████        
      ████████████████████████████████████      
    ████████████████████████████████████████    
  ████████████████████████████████████████████  
████████████████████████████████████████████████
████████████████████████████████████████████████
████████████████████████████████████████████████
████████████████████████████████████████████████
  ████████████████████████████████████████████  
    ████████████████████████████████████████    
      ████████████████████████████████████      
        ████████████████████████████        `,

            // Frame 11: Final stabilization pattern
            `        ████████████████████████████        
      ██████████████████████████████████████      
    ██████████████████████████████████████████    
  ██████████████████████████████████████████████  
██████████████████████████████████████████████████
██████████████████████████████████████████████████
██████████████████████████████████████████████████
██████████████████████████████████████████████████
██████████████████████████████████████████████████
  ██████████████████████████████████████████████  
    ██████████████████████████████████████████    
      ██████████████████████████████████████      
        ████████████████████████████        `
        ];
        
        return explosionFrames[Math.min(frame, explosionFrames.length - 1)] || explosionFrames[0];
    }

    // PHASE 3: Final Result with Tier-Specific Pattern
    static createFinalResult(tier) {
        const config = this.getTierConfig(tier);
        const buffTiers = {
            1: { name: 'Marine Training', multiplier: 1.1 },
            2: { name: 'Enhanced Drill', multiplier: 1.2 },
            3: { name: 'Elite Protocol', multiplier: 1.3 },
            4: { name: 'Admiral Focus', multiplier: 1.5 },
            5: { name: 'Fleet Command', multiplier: 1.7 },
            6: { name: 'World Government Authorization', multiplier: 2.0 }
        };

        const buff = buffTiers[tier];
        
        // Create tier-specific final patterns
        const patterns = {
            1: // Common - Simple matrix
`     ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     
   ░░                                   ░░   
 ░░      COMMON ENHANCEMENT MATRIX      ░░ 
░░         ░░░░░░░░░░░░░░░░░░░░░░         ░░
░░       ░░                  ░░       ░░
░░     ░░   MARINE TRAINING   ░░     ░░
░░       ░░                  ░░       ░░
░░         ░░░░░░░░░░░░░░░░░░░░░░         ░░
 ░░      MULTIPLIER: ${buff.multiplier}x          ░░ 
   ░░                                   ░░   
     ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     `,
            
            2: // Rare - Enhanced design
`     ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒     
   ▒▒                                   ▒▒   
 ▒▒        RARE ENHANCEMENT MATRIX       ▒▒ 
▒▒         ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒         ▒▒
▒▒       ▒▒                    ▒▒       ▒▒
▒▒     ▒▒     ENHANCED DRILL     ▒▒     ▒▒
▒▒       ▒▒                    ▒▒       ▒▒
▒▒         ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒         ▒▒
 ▒▒       MULTIPLIER: ${buff.multiplier}x           ▒▒ 
   ▒▒                                   ▒▒   
     ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒     `,
            
            3: // Epic - Advanced design
`     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓     
   ▓▓                                   ▓▓   
 ▓▓        EPIC ENHANCEMENT MATRIX       ▓▓ 
▓▓         ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓         ▓▓
▓▓       ▓▓      ░░░░░░░░      ▓▓       ▓▓
▓▓     ▓▓       ELITE       ▓▓     ▓▓
▓▓       ▓▓     PROTOCOL     ▓▓       ▓▓
▓▓         ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓         ▓▓
 ▓▓       MULTIPLIER: ${buff.multiplier}x           ▓▓ 
   ▓▓                                   ▓▓   
     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓     `,
            
            4: // Legendary - Golden design
`     ████████████████████████████████████     
   ██                                   ██   
 ██      LEGENDARY ENHANCEMENT MATRIX     ██ 
██         ████████████████████████         ██
██       ██      ░▒▓▓▓▓▓▒░      ██       ██
██     ██        ADMIRAL        ██     ██
██       ██       FOCUS        ██       ██
██         ████████████████████████         ██
 ██       MULTIPLIER: ${buff.multiplier}x           ██ 
   ██                                   ██   
     ████████████████████████████████████     `,
            
            5: // Mythical - Intense design
`     ████████████████████████████████████     
   ██  ░▒▓█████████████████████████▓▒░  ██   
 ██     MYTHICAL ENHANCEMENT MATRIX     ██ 
██         ████████████████████████         ██
██       ██   ░▒▓███████████▓▒░   ██       ██
██     ██      FLEET COMMAND      ██     ██
██       ██   ░▒▓███████████▓▒░   ██       ██
██         ████████████████████████         ██
 ██       MULTIPLIER: ${buff.multiplier}x           ██ 
   ██  ░▒▓█████████████████████████▓▒░  ██   
     ████████████████████████████████████     `,
            
            6: // Divine - Ultimate design
`     ████████████████████████████████████     
   ██  ░▒▓██████ DIVINE ██████▓▒░  ██   
 ██     WORLD GOVERNMENT AUTHORIZATION    ██ 
██    ░▒▓████████████████████████▓▒░    ██
██  ░▒▓██   ████████████████   ██▓▒░  ██
██ ▓██     MAXIMUM  POWER     ██▓ ██
██  ░▒▓██   ████████████████   ██▓▒░  ██
██    ░▒▓████████████████████████▓▒░    ██
 ██       MULTIPLIER: ${buff.multiplier}x           ██ 
   ██  ░▒▓██████ DIVINE ██████▓▒░  ██   
     ████████████████████████████████████     `
        };

        return patterns[tier] || patterns[1];
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

    // Generate tier-specific status messages for animation phases
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
                "MATRIX CRYSTALLIZATION!",
                "POWER STABILIZATION!",
                "ENERGY CONSOLIDATION!",
                "PATTERN SOLIDIFICATION!",
                "ENHANCEMENT COMPLETE!",
                "BUFF MATRIX LOCKED!",
                "POWER LEVEL CONFIRMED!",
                "ENERGY SIGNATURE STABLE!",
                "ENHANCEMENT ACTIVATED!"
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
**Status:** ${sequenceItem.phase === 'detection' ? 'Scanning...' : 
             sequenceItem.phase === 'explosion' ? 'Energy discharge!' : 
             'Enhancement complete!'}
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

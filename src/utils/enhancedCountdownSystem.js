// src/utils/enhancedCountdownSystem.js - Complete Enhanced Countdown System with 10 Square Emojis
// Updates every 2 seconds with color progression: Green → Yellow → Red

const { EmbedBuilder } = require('discord.js');

class EnhancedCountdownSystem {
    constructor() {
        this.countdownTimers = new Map(); // Track active countdowns
        this.updateInterval = 2000; // 2 seconds
    }

    /**
     * Create countdown with 10 square emojis
     * @param {number} totalSeconds - Total countdown time in seconds
     * @param {number} currentSeconds - Current remaining seconds
     * @returns {Object} - Countdown display object
     */
    createCountdownDisplay(totalSeconds, currentSeconds) {
        const totalSquares = 10;
        const timePerSquare = totalSeconds / totalSquares;
        
        // Calculate how many squares should be filled based on remaining time
        const remainingSquares = Math.ceil(currentSeconds / timePerSquare);
        const filledSquares = Math.max(0, Math.min(totalSquares, remainingSquares));
        
        // Determine color based on percentage remaining
        const percentageRemaining = (currentSeconds / totalSeconds) * 100;
        let squareEmoji;
        let colorName;
        let embedColor;
        
        if (percentageRemaining > 60) {
            squareEmoji = '🟩'; // Green squares
            colorName = 'Green';
            embedColor = [46, 204, 113]; // Green
        } else if (percentageRemaining > 30) {
            squareEmoji = '🟨'; // Yellow squares
            colorName = 'Yellow';
            embedColor = [255, 193, 7]; // Yellow
        } else {
            squareEmoji = '🟥'; // Red squares
            colorName = 'Red';
            embedColor = [231, 76, 60]; // Red
        }
        
        // Create the visual countdown bar
        const filledBar = squareEmoji.repeat(filledSquares);
        const emptyBar = '⬛'.repeat(totalSquares - filledSquares);
        const countdownBar = filledBar + emptyBar;
        
        return {
            bar: countdownBar,
            emoji: squareEmoji,
            color: colorName,
            embedColor: embedColor,
            remainingSeconds: currentSeconds,
            remainingSquares: filledSquares,
            percentageRemaining: Math.round(percentageRemaining),
            timeText: this.formatTime(currentSeconds)
        };
    }

    /**
     * Format seconds into MM:SS format
     * @param {number} seconds 
     * @returns {string}
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Create countdown embed for Discord
     * @param {string} title - Embed title
     * @param {string} description - Embed description
     * @param {Object} countdownData - Countdown display data
     * @param {Object} additionalInfo - Extra information to display
     * @returns {EmbedBuilder}
     */
    createCountdownEmbed(title, description, countdownData, additionalInfo = {}) {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(countdownData.embedColor)
            .addFields(
                {
                    name: '⏰ Time Remaining',
                    value: `**${countdownData.timeText}** (${countdownData.remainingSeconds}s)`,
                    inline: true
                },
                {
                    name: '📊 Progress',
                    value: `${countdownData.percentageRemaining}% remaining`,
                    inline: true
                },
                {
                    name: '🎯 Countdown Timer',
                    value: `${countdownData.bar}\n\`${countdownData.color} Phase - ${countdownData.remainingSquares}/10 squares\``,
                    inline: false
                }
            )
            .setTimestamp();

        // Add additional fields if provided
        if (additionalInfo.footer) {
            embed.setFooter({ text: additionalInfo.footer });
        }
        
        if (additionalInfo.fields) {
            embed.addFields(additionalInfo.fields);
        }

        return embed;
    }

    /**
     * Start a countdown with automatic updates every 2 seconds
     * @param {Object} interaction - Discord interaction
     * @param {number} totalSeconds - Total countdown time
     * @param {string} title - Countdown title
     * @param {string} description - Countdown description
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} - Countdown result
     */
    async startCountdown(interaction, totalSeconds, title, description, options = {}) {
        const countdownId = `${interaction.user.id}_${Date.now()}`;
        let currentSeconds = totalSeconds;
        
        try {
            // Initial countdown display
            const initialDisplay = this.createCountdownDisplay(totalSeconds, currentSeconds);
            const initialEmbed = this.createCountdownEmbed(title, description, initialDisplay, options);
            
            // Send initial message
            let message;
            if (interaction.deferred) {
                message = await interaction.editReply({ embeds: [initialEmbed] });
            } else {
                message = await interaction.reply({ embeds: [initialEmbed] });
                message = await interaction.fetchReply();
            }

            // Set up countdown timer
            const countdownTimer = setInterval(async () => {
                currentSeconds -= 2; // Decrease by 2 seconds each interval
                
                if (currentSeconds <= 0) {
                    // Countdown finished
                    clearInterval(countdownTimer);
                    this.countdownTimers.delete(countdownId);
                    
                    const finishedEmbed = this.createFinishedEmbed(title, options);
                    await message.edit({ embeds: [finishedEmbed] }).catch(console.error);
                    
                    // Call completion callback if provided
                    if (options.onComplete) {
                        await options.onComplete(interaction, message);
                    }
                    
                    return;
                }
                
                // Update countdown display
                const updatedDisplay = this.createCountdownDisplay(totalSeconds, currentSeconds);
                const updatedEmbed = this.createCountdownEmbed(title, description, updatedDisplay, options);
                
                try {
                    await message.edit({ embeds: [updatedEmbed] });
                } catch (error) {
                    console.error('[COUNTDOWN] Error updating countdown:', error);
                    clearInterval(countdownTimer);
                    this.countdownTimers.delete(countdownId);
                }
                
                // Call update callback if provided
                if (options.onUpdate) {
                    await options.onUpdate(interaction, message, currentSeconds);
                }
                
            }, this.updateInterval);
            
            // Store countdown info
            this.countdownTimers.set(countdownId, {
                timer: countdownTimer,
                message: message,
                totalSeconds: totalSeconds,
                currentSeconds: currentSeconds,
                startTime: Date.now()
            });
            
            return {
                success: true,
                countdownId: countdownId,
                message: message,
                timer: countdownTimer
            };
            
        } catch (error) {
            console.error('[COUNTDOWN] Error starting countdown:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create finished countdown embed
     * @param {string} title - Original title
     * @param {Object} options - Options object
     * @returns {EmbedBuilder}
     */
    createFinishedEmbed(title, options = {}) {
        const embed = new EmbedBuilder()
            .setTitle(`⏰ ${title} - Time's Up!`)
            .setDescription(options.finishedMessage || '```diff\n- COUNTDOWN COMPLETED\n- TIME HAS EXPIRED\n```')
            .setColor([231, 76, 60]) // Red
            .addFields({
                name: '🚨 Status',
                value: '⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛\n`Countdown Finished - 0/10 squares`',
                inline: false
            })
            .setTimestamp();

        if (options.footer) {
            embed.setFooter({ text: options.footer });
        }

        return embed;
    }

    /**
     * Stop a specific countdown
     * @param {string} countdownId - Countdown ID to stop
     * @returns {boolean} - Success status
     */
    stopCountdown(countdownId) {
        const countdown = this.countdownTimers.get(countdownId);
        if (countdown) {
            clearInterval(countdown.timer);
            this.countdownTimers.delete(countdownId);
            console.log(`[COUNTDOWN] Stopped countdown: ${countdownId}`);
            return true;
        }
        return false;
    }

    /**
     * Stop all active countdowns
     */
    stopAllCountdowns() {
        for (const [countdownId, countdown] of this.countdownTimers.entries()) {
            clearInterval(countdown.timer);
            console.log(`[COUNTDOWN] Stopped countdown: ${countdownId}`);
        }
        this.countdownTimers.clear();
        console.log('[COUNTDOWN] All countdowns stopped');
    }

    /**
     * Get countdown status
     * @param {string} countdownId - Countdown ID
     * @returns {Object|null} - Countdown status or null
     */
    getCountdownStatus(countdownId) {
        const countdown = this.countdownTimers.get(countdownId);
        if (countdown) {
            const elapsed = Date.now() - countdown.startTime;
            const elapsedSeconds = Math.floor(elapsed / 1000);
            const remainingSeconds = Math.max(0, countdown.totalSeconds - elapsedSeconds);
            
            return {
                countdownId,
                totalSeconds: countdown.totalSeconds,
                elapsedSeconds,
                remainingSeconds,
                isActive: remainingSeconds > 0
            };
        }
        return null;
    }

    /**
     * Quiz-specific countdown (integrates with your existing quiz system)
     * @param {Object} interaction - Discord interaction
     * @param {number} questionNumber - Current question number
     * @param {string} difficulty - Question difficulty
     * @param {number} timeLimit - Time limit in seconds (default 20)
     * @returns {Promise<Object>}
     */
    async startQuizCountdown(interaction, questionNumber, difficulty, timeLimit = 20) {
        const difficultyEmoji = {
            'Easy': '🟢',
            'Medium': '🟡', 
            'Hard': '🔴'
        };

        const title = `${difficultyEmoji[difficulty]} Question ${questionNumber}/5 • ${difficulty}`;
        const description = `**Answer the question before time runs out!**\n*Select your choice using the buttons below*`;

        const options = {
            footer: `Progressive Quiz System • Question ${questionNumber} • Difficulty: ${difficulty}`,
            fields: [
                {
                    name: '📝 Quiz Progress',
                    value: `Question **${questionNumber}** of **5**\nDifficulty: **${difficulty}**`,
                    inline: true
                }
            ],
            finishedMessage: '```diff\n- QUIZ QUESTION TIMEOUT\n- Time expired for this question\n```',
            onUpdate: async (interaction, message, remainingSeconds) => {
                // Log countdown updates if needed
                if (remainingSeconds <= 5) {
                    console.log(`[QUIZ COUNTDOWN] ${remainingSeconds} seconds remaining for question ${questionNumber}`);
                }
            },
            onComplete: async (interaction, message) => {
                console.log(`[QUIZ COUNTDOWN] Question ${questionNumber} timed out`);
                // Handle quiz timeout logic here
            }
        };

        return await this.startCountdown(interaction, timeLimit, title, description, options);
    }

    /**
     * Daily buff countdown (integrates with your daily buff system)
     * @param {Object} interaction - Discord interaction
     * @param {number} tier - Current tier
     * @param {number} timeLimit - Time limit in seconds (default 20)
     * @returns {Promise<Object>}
     */
    async startDailyBuffCountdown(interaction, tier, timeLimit = 20) {
        const tierNames = { 1: 'Common', 2: 'Rare', 3: 'Epic', 4: 'Legendary', 5: 'Divine' };
        const tierName = tierNames[tier] || 'Unknown';

        const title = `🎰 Daily Buff Challenge - ${tierName} Tier`;
        const description = `**Secure your ${tierName} enhancement!**\n*Make your choice before time expires*`;

        const options = {
            footer: `Enhancement Intelligence • ${tierName} Tier Challenge`,
            fields: [
                {
                    name: '🏆 Current Target',
                    value: `**${tierName}** Enhancement\nTier **${tier}** of **5**`,
                    inline: true
                }
            ],
            finishedMessage: '```diff\n- ENHANCEMENT CHALLENGE TIMEOUT\n- Time expired - no enhancement awarded\n```',
            onComplete: async (interaction, message) => {
                console.log(`[DAILY BUFF COUNTDOWN] Tier ${tier} challenge timed out`);
            }
        };

        return await this.startCountdown(interaction, timeLimit, title, description, options);
    }

    /**
     * Generic marine-themed countdown
     * @param {Object} interaction - Discord interaction
     * @param {number} timeLimit - Time limit in seconds
     * @param {string} operation - Operation name
     * @param {Object} customOptions - Custom options
     * @returns {Promise<Object>}
     */
    async startMarineCountdown(interaction, timeLimit, operation, customOptions = {}) {
        const title = `⚓ Marine Operation: ${operation}`;
        const description = customOptions.description || `**Mission briefing in progress...**\n*Standby for further instructions*`;

        const options = {
            footer: customOptions.footer || '⚓ Marine Intelligence Division',
            finishedMessage: customOptions.finishedMessage || '```diff\n- MARINE OPERATION COMPLETED\n- Mission window closed\n```',
            ...customOptions
        };

        return await this.startCountdown(interaction, timeLimit, title, description, options);
    }

    /**
     * Cleanup method for graceful shutdown
     */
    cleanup() {
        console.log('[COUNTDOWN] Starting cleanup...');
        this.stopAllCountdowns();
        console.log('[COUNTDOWN] Cleanup complete');
    }
}

// Export the countdown system
module.exports = EnhancedCountdownSystem;

/*
USAGE EXAMPLES:

// In your daily-buff.js command:
const EnhancedCountdownSystem = require('../utils/enhancedCountdownSystem');
const countdownSystem = new EnhancedCountdownSystem();

// Start a quiz countdown
const result = await countdownSystem.startQuizCountdown(interaction, 1, 'Medium', 20);

// Start a daily buff countdown  
const result = await countdownSystem.startDailyBuffCountdown(interaction, 3, 20);

// Start a custom marine countdown
const result = await countdownSystem.startMarineCountdown(interaction, 30, 'Bounty Update', {
    description: '**Updating bounty database...**\nPlease wait while records are processed',
    finishedMessage: '```diff\n+ BOUNTY UPDATE COMPLETE\n+ All records synchronized\n```',
    onComplete: async (interaction, message) => {
        console.log('Bounty update completed');
    }
});

// In your cleanup (index.js shutdown):
process.on('SIGINT', () => {
    countdownSystem.cleanup();
    process.exit(0);
});
*/

// debug.js - Advanced Debug System for Discord Leveling Bot
require('dotenv').config();

class DebugLogger {
    constructor() {
        // Debug configuration from environment variables
        this.debugMode = process.env.DEBUG_MODE === 'true' || false;
        this.debugVoice = process.env.DEBUG_VOICE === 'true' || false;
        this.debugXP = process.env.DEBUG_XP === 'true' || false;
        this.debugDatabase = process.env.DEBUG_DATABASE === 'true' || false;
        this.debugCommands = process.env.DEBUG_COMMANDS === 'true' || false;
        this.debugLevelUp = process.env.DEBUG_LEVELUP === 'true' || false;
        this.debugLeaderboard = process.env.DEBUG_LEADERBOARD === 'true' || false;

        console.log('🐛 Debug Logger initialized:');
        console.log(`   Main: ${this.debugMode ? 'ON' : 'OFF'}`);
        console.log(`   Voice: ${this.debugVoice ? 'ON' : 'OFF'}`);
        console.log(`   XP: ${this.debugXP ? 'ON' : 'OFF'}`);
        console.log(`   Database: ${this.debugDatabase ? 'ON' : 'OFF'}`);
        console.log(`   Commands: ${this.debugCommands ? 'ON' : 'OFF'}`);
        console.log(`   Level Up: ${this.debugLevelUp ? 'ON' : 'OFF'}`);
        console.log(`   Leaderboard: ${this.debugLeaderboard ? 'ON' : 'OFF'}`);
    }

    // Get formatted timestamp
    getTimestamp() {
        return new Date().toISOString();
    }

    // Generic debug logging method
    log(category, enabled, ...args) {
        if (!enabled && !this.debugMode) return;
        
        const timestamp = this.getTimestamp();
        console.log(`[${timestamp}] ${category}`, ...args);
    }

    // Main debug logging
    debug(...args) {
        this.log('🤖', this.debugMode, ...args);
    }

    // Voice XP specific logging
    voice(...args) {
        this.log('🎤', this.debugVoice, ...args);
    }

    // XP calculation logging
    xp(...args) {
        this.log('💫', this.debugXP, ...args);
    }

    // Database operation logging
    database(...args) {
        this.log('🗄️', this.debugDatabase, ...args);
    }

    // Command execution logging
    command(...args) {
        this.log('⚡', this.debugCommands, ...args);
    }

    // Level up process logging
    levelup(...args) {
        this.log('🎉', this.debugLevelUp, ...args);
    }

    // Leaderboard processing logging
    leaderboard(...args) {
        this.log('🏆', this.debugLeaderboard, ...args);
    }

    // Error logging (always shown)
    error(category, ...args) {
        const timestamp = this.getTimestamp();
        console.error(`[${timestamp}] ❌ ${category}`, ...args);
    }

    // Success logging (always shown)
    success(category, ...args) {
        const timestamp = this.getTimestamp();
        console.log(`[${timestamp}] ✅ ${category}`, ...args);
    }

    // Warning logging (always shown)
    warn(category, ...args) {
        const timestamp = this.getTimestamp();
        console.warn(`[${timestamp}] ⚠️ ${category}`, ...args);
    }

    // Voice session detailed logging
    voiceSession(userId, action, data = {}) {
        if (!this.debugVoice) return;
        
        this.voice(`Voice Session - User: ${userId}, Action: ${action}`);
        if (Object.keys(data).length > 0) {
            this.voice(`   Data:`, data);
        }
    }

    // XP transaction logging
    xpTransaction(userId, guildId, amount, type, details = {}) {
        if (!this.debugXP) return;
        
        this.xp(`XP Transaction - User: ${userId}, Guild: ${guildId}`);
        this.xp(`   Amount: ${amount}, Type: ${type}`);
        if (Object.keys(details).length > 0) {
            this.xp(`   Details:`, details);
        }
    }

    // Database query logging
    dbQuery(query, params = [], result = null) {
        if (!this.debugDatabase) return;
        
        this.database(`Database Query: ${query.substring(0, 100)}${query.length > 100 ? '...' : ''}`);
        if (params.length > 0) {
            this.database(`   Parameters:`, params);
        }
        if (result) {
            this.database(`   Result: ${result.rowCount || 0} rows affected`);
        }
    }

    // Command execution tracking
    commandExecution(commandName, userId, guildId, success = true, error = null) {
        if (!this.debugCommands) return;
        
        const status = success ? '✅ SUCCESS' : '❌ FAILED';
        this.command(`${status} - Command: /${commandName}`);
        this.command(`   User: ${userId}, Guild: ${guildId}`);
        if (error) {
            this.command(`   Error:`, error.message || error);
        }
    }

    // Level up process tracking
    levelUpProcess(userId, guildId, oldLevel, newLevel, roleAssigned = false) {
        if (!this.debugLevelUp) return;
        
        this.levelup(`Level Up Process - User: ${userId}`);
        this.levelup(`   Guild: ${guildId}, ${oldLevel} → ${newLevel}`);
        this.levelup(`   Role Assigned: ${roleAssigned ? 'Yes' : 'No'}`);
    }

    // Leaderboard generation tracking
    leaderboardGeneration(guildId, totalUsers, pirateKings, regularPirates) {
        if (!this.debugLeaderboard) return;
        
        this.leaderboard(`Leaderboard Generation - Guild: ${guildId}`);
        this.leaderboard(`   Total Users: ${totalUsers}`);
        this.leaderboard(`   Pirate Kings: ${pirateKings}`);
        this.leaderboard(`   Regular Pirates: ${regularPirates}`);
    }

    // Cooldown tracking
    cooldownCheck(type, userId, guildId, remaining) {
        if (!this.debugXP) return;
        
        if (remaining > 0) {
            this.xp(`❄️ Cooldown Active - Type: ${type}, User: ${userId}`);
            this.xp(`   Remaining: ${Math.ceil(remaining / 1000)}s`);
        } else {
            this.xp(`🟢 Cooldown Clear - Type: ${type}, User: ${userId}`);
        }
    }

    // Performance timing
    startTimer(label) {
        if (!this.debugMode) return null;
        
        const start = Date.now();
        this.debug(`⏱️ Timer Started: ${label}`);
        return start;
    }

    endTimer(label, startTime) {
        if (!this.debugMode || !startTime) return;
        
        const duration = Date.now() - startTime;
        this.debug(`⏱️ Timer Ended: ${label} - Duration: ${duration}ms`);
    }

    // Reload debug configuration
    reload() {
        const oldConfig = {
            debugMode: this.debugMode,
            debugVoice: this.debugVoice,
            debugXP: this.debugXP,
            debugDatabase: this.debugDatabase,
            debugCommands: this.debugCommands,
            debugLevelUp: this.debugLevelUp,
            debugLeaderboard: this.debugLeaderboard
        };

        this.debugMode = process.env.DEBUG_MODE === 'true' || false;
        this.debugVoice = process.env.DEBUG_VOICE === 'true' || false;
        this.debugXP = process.env.DEBUG_XP === 'true' || false;
        this.debugDatabase = process.env.DEBUG_DATABASE === 'true' || false;
        this.debugCommands = process.env.DEBUG_COMMANDS === 'true' || false;
        this.debugLevelUp = process.env.DEBUG_LEVELUP === 'true' || false;
        this.debugLeaderboard = process.env.DEBUG_LEADERBOARD === 'true' || false;

        this.success('Debug Config Reloaded');
        this.debug('Old Config:', oldConfig);
        this.debug('New Config:', {
            debugMode: this.debugMode,
            debugVoice: this.debugVoice,
            debugXP: this.debugXP,
            debugDatabase: this.debugDatabase,
            debugCommands: this.debugCommands,
            debugLevelUp: this.debugLevelUp,
            debugLeaderboard: this.debugLeaderboard
        });
    }

    // Toggle specific debug categories
    toggle(category, enabled) {
        switch (category) {
            case 'all':
                this.debugMode = enabled;
                this.debugVoice = enabled;
                this.debugXP = enabled;
                this.debugDatabase = enabled;
                this.debugCommands = enabled;
                this.debugLevelUp = enabled;
                this.debugLeaderboard = enabled;
                break;
            case 'voice':
                this.debugVoice = enabled;
                break;
            case 'xp':
                this.debugXP = enabled;
                break;
            case 'database':
                this.debugDatabase = enabled;
                break;
            case 'commands':
                this.debugCommands = enabled;
                break;
            case 'levelup':
                this.debugLevelUp = enabled;
                break;
            case 'leaderboard':
                this.debugLeaderboard = enabled;
                break;
            default:
                this.warn('Debug Toggle', `Unknown category: ${category}`);
                return false;
        }

        this.success('Debug Toggle', `${category} debug ${enabled ? 'enabled' : 'disabled'}`);
        return true;
    }

    // Get current debug status
    getStatus() {
        return {
            main: this.debugMode,
            voice: this.debugVoice,
            xp: this.debugXP,
            database: this.debugDatabase,
            commands: this.debugCommands,
            levelup: this.debugLevelUp,
            leaderboard: this.debugLeaderboard
        };
    }

    // Format debug status for display
    getStatusString() {
        const status = this.getStatus();
        return Object.entries(status)
            .map(([key, value]) => `${key}: ${value ? '✅' : '❌'}`)
            .join('\n');
    }
}

// Export singleton instance
module.exports = new DebugLogger();

// src/commands/index.js - Command Router and Handler
const { SlashCommandBuilder } = require('discord.js');

// Import individual command modules
const levelCommands = require('./level');
const leaderboardCommands = require('./leaderboard');
const adminCommands = require('./admin');
const utilityCommands = require('./utility');

// Simple debug replacement
const debug = {
    command: (...args) => console.log('[CMD]', ...args),
    error: (category, ...args) => console.error('[ERROR]', category, ...args),
    success: (category, ...args) => console.log('[SUCCESS]', category, ...args)
};

class CommandHandler {
    constructor(bot) {
        this.bot = bot;
        this.client = bot.client;
        this.db = bot.db;
        
        // Initialize command modules with bot instance
        this.levelCommands = new levelCommands(bot);
        this.leaderboardCommands = new leaderboardCommands(bot);
        this.adminCommands = new adminCommands(bot);
        this.utilityCommands = new utilityCommands(bot);
    }

    // Get all command definitions
    getCommandDefinitions() {
        return [
            // Level Commands
            ...this.levelCommands.getDefinitions(),
            
            // Leaderboard Commands
            ...this.leaderboardCommands.getDefinitions(),
            
            // Admin Commands
            ...this.adminCommands.getDefinitions(),
            
            // Utility Commands
            ...this.utilityCommands.getDefinitions()
        ];
    }

    // Handle command execution
    async handleCommand(interaction) {
        debug.command(`Command: /${interaction.commandName} from ${interaction.user.username}`);
        
        try {
            const commandName = interaction.commandName;
            
            // Route to appropriate command handler
            switch (commandName) {
                // Level Commands
                case 'level':
                    await this.levelCommands.handleLevel(interaction);
                    break;
                
                // Leaderboard Commands
                case 'leaderboard':
                    await this.leaderboardCommands.handleLeaderboard(interaction);
                    break;
                
                // Admin Commands
                case 'setlevelrole':
                    await this.adminCommands.handleSetLevelRole(interaction);
                    break;
                case 'reload':
                    await this.adminCommands.handleReload(interaction);
                    break;
                case 'initrookies':
                    await this.adminCommands.handleInitRookies(interaction);
                    break;
                
                // Utility Commands
                case 'levelroles':
                    await this.utilityCommands.handleLevelRoles(interaction);
                    break;
                case 'settings':
                    await this.utilityCommands.handleSettings(interaction);
                    break;
                case 'debug':
                    await this.utilityCommands.handleDebug(interaction);
                    break;
                
                default:
                    await interaction.reply({ 
                        content: 'Unknown command!', 
                        flags: 64
                    });
            }
            
            debug.command(`Command /${interaction.commandName} completed successfully`);
            
        } catch (error) {
            debug.error('Command Execution', error);
            
            // Handle different interaction states
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: 'An error occurred while executing the command.', 
                    flags: 64
                });
            } else if (interaction.deferred) {
                await interaction.editReply({ 
                    content: 'An error occurred while executing the command.'
                });
            }
        }
    }

    // Update configuration for all command modules
    updateConfiguration() {
        this.levelCommands.updateConfig();
        this.leaderboardCommands.updateConfig();
        this.adminCommands.updateConfig();
        this.utilityCommands.updateConfig();
    }
}

module.exports = CommandHandler;

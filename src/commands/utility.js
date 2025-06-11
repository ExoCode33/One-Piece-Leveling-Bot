// utility.js

/**
 * Sends an XP or tracking log message to the log channel if XP_LOG_CHANNEL is set.
 * @param {Client} client - The Discord.js client.
 * @param {string} content - The message to send.
 */
async function sendXPLog(client, content) {
    const logChannelId = process.env.XP_LOG_CHANNEL;
    if (!logChannelId) return;

    try {
        const channel = await client.channels.fetch(logChannelId);
        if (channel && channel.isTextBased()) {
            await channel.send(content);
        }
    } catch (err) {
        console.error('[XP LOG] Failed to send log:', err);
    }
}

// Export so you can use this in your main bot code
module.exports = {
    sendXPLog,
    // Add other utility functions here as needed
};

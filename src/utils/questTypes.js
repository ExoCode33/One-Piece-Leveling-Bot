// src/utils/questTypes.js - Quest Definitions (Easy to Edit)

// Quest type definitions - EASILY EDITABLE
function getQuestTypes() {
    return {
        messages: {
            name: 'Communication Intelligence',
            description: 'Send messages to gather intelligence',
            minTarget: 15,
            maxTarget: 30,
            baseXP: 150,
            category: 'communication'
        },
        reactions: {
            name: 'Reaction Surveillance', 
            description: 'React to messages for data collection',
            minTarget: 8,
            maxTarget: 15,
            baseXP: 100,
            category: 'interaction'
        },
        voice_time: {
            name: 'Voice Communication Monitor',
            description: 'Spend time in voice channels (minutes)',
            minTarget: 30,
            maxTarget: 60,
            baseXP: 200,
            category: 'voice'
        },
        voice_sessions: {
            name: 'Voice Session Analysis',
            description: 'Join voice channels for intelligence gathering',
            minTarget: 3,
            maxTarget: 6,
            baseXP: 120,
            category: 'voice'
        },
        early_bird: {
            name: 'Early Operations',
            description: 'Be active before 10 AM EST (any activity)',
            minTarget: 1,
            maxTarget: 1,
            baseXP: 100,
            category: 'special',
            timeWindow: { start: 0, end: 10 } // 0-10 AM EST
        },
        night_owl: {
            name: 'Night Operations',
            description: 'Be active after 10 PM EST (any activity)', 
            minTarget: 1,
            maxTarget: 1,
            baseXP: 100,
            category: 'special',
            timeWindow: { start: 22, end: 24 } // 10 PM - Midnight EST
        },
        social_butterfly: {
            name: 'Social Intelligence Network',
            description: 'Interact in different channels',
            minTarget: 3,
            maxTarget: 5,
            baseXP: 130,
            category: 'exploration'
        },
        streak_keeper: {
            name: 'Consistency Analysis',
            description: 'Maintain daily activity streak',
            minTarget: 1,
            maxTarget: 1,
            baseXP: 80,
            category: 'special'
        },
        channel_explorer: {
            name: 'Territory Reconnaissance',
            description: 'Send messages in different text channels',
            minTarget: 4,
            maxTarget: 7,
            baseXP: 110,
            category: 'exploration'
        },
        reaction_collector: {
            name: 'Interaction Specialist',
            description: 'Give reactions to boost morale',
            minTarget: 12,
            maxTarget: 20,
            baseXP: 90,
            category: 'interaction'
        },
        voice_champion: {
            name: 'Extended Communication',
            description: 'Spend significant time in voice (minutes)',
            minTarget: 90,
            maxTarget: 120,
            baseXP: 300,
            category: 'voice'
        }
    };
}

module.exports = { getQuestTypes };

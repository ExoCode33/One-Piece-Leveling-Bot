} else if (qNum < 10) {
                        // Continue to next question after timeout, but show brief timeout notice
                        try {
                            const timeoutNotice = new EmbedBuilder()
                                .setColor('#FF6B6B')
                                .setTitle(`⏰ Question ${qNum} Timed Out`)
                                .setDescription(`Moving to Question ${qNum + 1}/10...`)
                                .setFooter({ text: 'Auto-continuing in 2 seconds' });
                            
                            await msg.edit({ embeds: [timeoutNotice], components: [] });
                            
                            // Wait 2 seconds then continue
                            setTimeout(async () => {
                                const deletePromise = msg.delete().catch(() => {});
                                const nextQuestionPromise = this.ask(interaction, userId, guildId, member, qNum + 1, tier, rerollsUsed, newResults);
                                
                                await Promise.all([deletePromise, nextQuestionPromise]);
                            }, 2000);
                            
                        } catch (error) {
                            console.error(`[DAILY QUIZ] Error handling timeout transition:`, error);
                            // Fallback: continue immediately
                            const deletePromise = msg.delete().catch(() => {});
                            const nextQuestionPromise = this.ask(interaction, userId, guildId, member, qNum + 1, tier, rerollsUsed, newResults);
                            
                            await Promise.all([deletePromise, nextQuestionPromise]);
                        }
                    } else {
                        // Last question - handle completion with testing mode support
                        const totalSuccessful = newResults.filter(r => r === true).length;
                        
                        // ✅ NEW: Testing mode - skip database/role operations
                        if (!TESTING_MODE) {
                            if (totalSuccessful > 0) {
                                await this.apply(userId, guildId, member, totalSuccessful);
                            } else {
                                await this.saveFail(userId, guildId);
                            }
                        } else {
                            console.log(`[DAILY QUIZ] TESTING MODE: Would ${totalSuccessful > 0 ? `award tier ${totalSuccessful}` : 'save failure'} for ${member.displayName} (database skipped)`);
                        }
                        
                        let xpMultiplier = 'Unknown';
                        if (totalSuccessful > 0) {
                            try {
                                const roleId = process.env[`DAILY_QUIZ_TIER_${totalSuccessful}_ROLE`];
                                if (roleId && global.xpBoostManager) {
                                    const boostInfo = await global.xpBoostManager.getRoleBoost(guildId, roleId);
                                    if (boostInfo && boostInfo.boost_multiplier) {
                                        xpMultiplier = `${boostInfo.boost_multiplier}x`;
                                    }
                                }
                            } catch (error) {
                                console.error('[DAILY BUFF] Error getting XP multiplier:', error);
                                xpMultiplier = 'Active';
                            }
                        }
                        
                        const tierName = totalSuccessful > 0 ? (TIER_NAMES[totalSuccessful] || 'Enhancement') : 'No Enhancement';
                        const resultTitle = TESTING_MODE ? 
                            `🧪 TEST TIMEOUT - ${tierName}` : 
                            '⏰ Time\'s Up! Challenge Complete';
                        
                        const timeout = new EmbedBuilder()
                            .setColor(totalSuccessful > 0 ? (TIER_COLORS[totalSuccessful] || '#FF0000') : '#FF0000')
                            .setTitle(resultTitle)
                            .setDescription(totalSuccessful > 0 ? 
                                `**${tierName}** ${TESTING_MODE ? 'achieved (testing)' : 'earned'} based on your ${totalSuccessful} correct answers.${TESTING_MODE ? '\n\n🧪 **TESTING MODE**: No roles or database changes made' : ''}` :
                                `No enhancement ${TESTING_MODE ? 'simulated' : 'earned'}.`)
                            .addFields({ 
                                name: '📊 Final Results', 
                                value: `**Correct Answers:** ${totalSuccessful}/10\n**Questions Attempted:** ${qNum}/10\n**Tier ${TESTING_MODE ? 'Simulated' : 'Earned'}:** ${this.getTierEmoji(totalSuccessful)} ${tierName}${TESTING_MODE ? '\n🧪 **Testing Mode Active**' : ''}`, 
                                inline: false 
                            })
                            .addFields({ name: '💡 Next Attempt', value: TESTING_MODE ? 'Available Now!' : `<t:${getReset()}:R>`, inline: false })
                            .setFooter({ text: `Daily Quiz System • ${TESTING_MODE ? 'Testing Mode • ' : ''}Timed Out` })
                            .setTimestamp();
                            
                        try {
                            await msg.edit({ embeds: [timeout], components: [] });
                        } catch (error) {
                            console.error(`[DAILY QUIZ] Error showing timeout message:`, error);
                        }
                    }// src/commands/daily-quiz.js - Enhanced Daily Quiz System with Renamed Tables and Testing Mode
// 
// ✅ NEW ENVIRONMENT VARIABLES NEEDED:
// 
// TESTING MODE:
// DAILY_QUIZ_TESTING_MODE="true"  # Allows unlimited quiz attempts without saving roles/database
//
// CHANNEL RESTRICTION:
// DAILY_QUIZ_CHANNEL="123456789012345678"  # Channel ID where quiz can be used
//
// FLAT XP REWARD (bypasses all multipliers):
// DAILY_QUIZ_CORRECT_ANSWER_XP="500"  # Flat 500 XP per correct answer, no multipliers
//
// INDIVIDUAL TIER XP CAPS (replace default daily voice XP cap when you have a buff):
// DAILY_QUIZ_TIER_1_XP_CAP="2000"    # Common buff increases cap to 2,000 XP
// DAILY_QUIZ_TIER_2_XP_CAP="3000"    # Uncommon buff increases cap to 3,000 XP  
// DAILY_QUIZ_TIER_3_XP_CAP="5000"    # Rare buff increases cap to 5,000 XP
// DAILY_QUIZ_TIER_4_XP_CAP="8000"    # Epic buff increases cap to 8,000 XP
// DAILY_QUIZ_TIER_5_XP_CAP="15000"   # Legendary buff increases cap to 15,000 XP
// DAILY_QUIZ_TIER_6_XP_CAP="25000"   # Legendary+ buff increases cap to 25,000 XP
// DAILY_QUIZ_TIER_7_XP_CAP="40000"   # Mythic buff increases cap to 40,000 XP
// DAILY_QUIZ_TIER_8_XP_CAP="60000"   # Mythic+ buff increases cap to 60,000 XP
// DAILY_QUIZ_TIER_9_XP_CAP="90000"   # Divine buff increases cap to 90,000 XP
// DAILY_QUIZ_TIER_10_XP_CAP="150000" # Divine Perfect buff increases cap to 150,000 XP
//
// EXISTING VARIABLES (updated naming):
// DAILY_QUIZ_TIER_1_ROLE="role_id" # Role IDs for each tier
// DAILY_QUIZ_TIER_2_ROLE="role_id" # etc...

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const TIER_COLORS = { 
    1: [255, 255, 255], // Common - White
    2: [76, 175, 80],   // Uncommon - Green  
    3: [33, 150, 243],  // Rare - Blue
    4: [156, 39, 176],  // Epic - Purple
    5: [255, 193, 7],   // Legendary - Yellow
    6: [255, 193, 7],   // Legendary - Yellow
    7: [255, 87, 34],   // Mythic - Orange
    8: [255, 87, 34],   // Mythic - Orange
    9: [255, 20, 20],   // Divine - Red
    10: [255, 20, 20]   // Divine - Red
};

const TIER_NAMES = { 
    1: 'Common', 
    2: 'Uncommon', 
    3: 'Rare', 
    4: 'Epic', 
    5: 'Legendary', 
    6: 'Legendary', 
    7: 'Mythic', 
    8: 'Mythic', 
    9: 'Divine', 
    10: 'Divine' 
};

const TIER_DESC = { 
    1: '⚪ Common boost', 
    2: '🟢 Uncommon power', 
    3: '🔵 Rare ability', 
    4: '🟣 Epic mastery', 
    5: '🟡 Legendary might', 
    6: '🟡 Legendary supremacy', 
    7: '🟠 Mythic transcendence', 
    8: '🟠 Mythic dominance', 
    9: '🔴 Divine ascension', 
    10: '🔴 Divine perfection' 
};

// ✅ NEW: Testing mode flag
const TESTING_MODE = process.env.DAILY_QUIZ_TESTING_MODE === 'true';

// Enhanced fallback questions focused on anime lore
const FALLBACK = {
    'Easy': [
        { question: "Who is the main protagonist of One Piece?", options: ["Monkey D. Luffy", "Roronoa Zoro", "Nami", "Sanji"], answer: "Monkey D. Luffy" },
        { question: "What is Luffy's Devil Fruit called?", options: ["Gomu Gomu no Mi", "Mera Mera no Mi", "Hito Hito no Mi", "Yami Yami no Mi"], answer: "Gomu Gomu no Mi" },
        { question: "What is the name of Luffy's pirate crew?", options: ["Straw Hat Pirates", "Red Hair Pirates", "Whitebeard Pirates", "Heart Pirates"], answer: "Straw Hat Pirates" },
        { question: "In Naruto, what village is Naruto from?", options: ["Hidden Leaf Village", "Hidden Sand Village", "Hidden Mist Village", "Hidden Cloud Village"], answer: "Hidden Leaf Village" },
        { question: "What color is Pikachu in Pokemon?", options: ["Yellow", "Blue", "Red", "Green"], answer: "Yellow" },
        { question: "In Dragon Ball, what are the magical orbs called?", options: ["Dragon Balls", "Power Orbs", "Magic Spheres", "Wish Stones"], answer: "Dragon Balls" }
    ],
    'Medium': [
        { question: "What is the name of the sea where most of One Piece takes place?", options: ["Grand Line", "East Blue", "West Blue", "Red Line"], answer: "Grand Line" },
        { question: "In Attack on Titan, what is Eren's Titan form called?", options: ["Attack Titan", "Colossal Titan", "Female Titan", "Beast Titan"], answer: "Attack Titan" },
        { question: "Who is known as 'Humanity's Strongest Soldier' in Attack on Titan?", options: ["Levi Ackerman", "Erwin Smith", "Mikasa Ackerman", "Eren Yeager"], answer: "Levi Ackerman" },
        { question: "In One Piece, what is the ultimate treasure called?", options: ["One Piece", "All Blue", "Void Century", "Poneglyph"], answer: "One Piece" },
        { question: "What is the name of the ninja academy in Naruto?", options: ["Ninja Academy", "Shinobi School", "Konoha Academy", "Leaf Academy"], answer: "Ninja Academy" },
        { question: "In My Hero Academia, what is Deku's real name?", options: ["Izuku Midoriya", "Katsuki Bakugo", "Shoto Todoroki", "Tenya Iida"], answer: "Izuku Midoriya" }
    ],
    'Hard': [
        { question: "In One Piece, where do the Straw Hats first meet Brook?", options: ["Thriller Bark", "Sabaody Archipelago", "Water 7", "Enies Lobby"], answer: "Thriller Bark" },
        { question: "What is Roy Mustang's title in Fullmetal Alchemist?", options: ["Flame Alchemist", "Steel Alchemist", "State Alchemist", "Fire Colonel"], answer: "Flame Alchemist" },
        { question: "In One Piece, what is the name of the island where the World Government is located?", options: ["Mariejois", "Enies Lobby", "Impel Down", "Marineford"], answer: "Mariejois" },
        { question: "What is the name of the technique Luffy learns during the timeskip?", options: ["Haki", "Rokushiki", "Fishman Karate", "Electro"], answer: "Haki" },
        { question: "In Hunter x Hunter, what is Gon's father's name?", options: ["Ging Freecss", "Silva Zoldyck", "Isaac Netero", "Leorio Paradinight"], answer: "Ging Freecss" },
        { question: "What is the name of the school in Kill la Kill?", options: ["Honnouji Academy", "Kiryuin Academy", "Satsuki Academy", "Ryuko Academy"], answer: "Honnouji Academy" }
    ]
};

// Handle secure tier button
                    if (btn.customId.startsWith('stop_')) {
                        if (testingMode) {
                            await btn.editReply({
                                content: '🧪 **Testing Mode**: Cannot secure tiers in testing mode!',
                                components: []
                            });
                            return;
                        }
                        
                        const successfulAnswers = questionResults.filter(result => result === true).length;
                        const securedTier = successfulAnswers;
                        
                        await this.apply(userId, guildId, member, securedTier);
                        
                        let xpMultiplier = 'Unknown';
                        try {
                            const roleId = process.env[`DAILY_QUIZ_TIER_${securedTier}_ROLE`];
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
                        
                        const res = new EmbedBuilder()
                            .setTitle('Strategic Withdrawal - Tier Secured!')
                            .setColor(TIER_COLORS[securedTier])
                            .setDescription(`**${TIER_NAMES[securedTier]}** secured!\n*${TIER_DESC[securedTier]}*\n**XP Multiplier:** ${xpMultiplier}`)
                            .addFields({ 
                                name: '📊 Results', 
                                value: `Score: ${securedTier}/10\n**Buff Received:** ${this.getTierEmoji(securedTier)} ${TIER_NAMES[securedTier]} (${xpMultiplier})\n**Challenge by:** ${member.displayName}\nNext: <t:${getReset()}:R>`, 
                                inline: false 
                            })
                            .setFooter({ text: `${this.getTierEmoji(securedTier)} ${TIER_NAMES[securedTier]} ${xpMultiplier} Active` })
                            .setTimestamp();
                        await btn.editReply({ embeds: [res], components: [] });
                        collector.stop(); 
                        return;
                    }

                    // Handle answer selection (same logic for both modes)
                    const [, , , , isCorrectStr, currentRerollsUsed] = btn.customId.split('_');
                    const isCorrect = isCorrectStr === 'true';
                    const passedRerollsUsed = parseInt(currentRerollsUsed);
                    
                    const selectedOption = q.options[parseInt(btn.customId.split('_')[3])];
                    console.log(`[DAILY BUFF] Q${qNum} Answer attempt by ${member.displayName}: Selected "${selectedOption}" | Correct: ${isCorrect} | Expected: "${q.answer}"${testingMode ? ' [TESTING]' : ''}`);
                    
                    if (isCorrect) {
                        const newResults = [...questionResults, true];
                        
                        // ✅ OPTIMIZED: Only award XP in non-testing mode
                        if (!testingMode) {
                            const correctAnswerXP = parseInt(process.env.DAILY_QUIZ_CORRECT_ANSWER_XP) || 500;
                            if (global.xpTracker && correctAnswerXP > 0) {
                                try {
                                    await global.xpTracker.awardXP(userId, guildId, correctAnswerXP, 'daily-quiz-correct', member.user, true);
                                    console.log(`[DAILY QUIZ] Q${qNum} FLAT XP: Awarded ${correctAnswerXP} XP to ${member.displayName} (no multipliers applied)`);
                                } catch (error) {
                                    console.error(`[DAILY BUFF] Error awarding flat XP for correct answer:`, error);
                                }
                            }
                        } else {
                            console.log(`[DAILY QUIZ] Q${qNum} TESTING MODE: No XP awarded to ${member.displayName}`);
                        }
                        
                        if (qNum === 10) {
                            // Final question completion
                            const totalSuccessful = newResults.filter(r => r === true).length;
                            
                            // ✅ OPTIMIZED: Only apply rewards in non-testing mode
                            if (!testingMode) {
                                await this.apply(userId, guildId, member, totalSuccessful);
                            
                                let xpMultiplier = 'Unknown';
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
                                
                                const tierName = totalSuccessful === 10 ? 'DIVINE PERFECTION' : TIER_NAMES[totalSuccessful] || 'No Enhancement';
                                const res = new EmbedBuilder()
                                    .setTitle(totalSuccessful === 10 ? '🔴 DIVINE PERFECTION ACHIEVED!' : `🎯 Challenge Complete - ${tierName}`)
                                    .setColor(totalSuccessful > 0 ? TIER_COLORS[totalSuccessful] : '#FF0000')
                                    .setDescription(totalSuccessful > 0 ? 
                                        `**${tierName}** unlocked!\n*${TIER_DESC[totalSuccessful] || 'Challenge completed'}*\n\n**XP Multiplier:** ${xpMultiplier}` :
                                        '**No Enhancement** earned. Better luck tomorrow!')
                                    .addFields({ 
                                        name: '📊 Final Results', 
                                        value: `**Correct Answers:** ${totalSuccessful}/10\n**Buff Received:** ${this.getTierEmoji(totalSuccessful)} ${tierName}${totalSuccessful > 0 ? ` (${xpMultiplier})` : ''}\n**Challenge by:** ${member.displayName}\nNext: <t:${getReset()}:R>`, 
                                        inline: false 
                                    })
                                    .setFooter({ text: totalSuccessful > 0 ? `${this.getTierEmoji(totalSuccessful)} ${tierName} ${xpMultiplier} Active` : 'Challenge Complete' })
                                    .setTimestamp();
                                await btn.editReply({ embeds: [res], components: [] });
                            } else {
                                // Testing mode completion
                                const tierName = totalSuccessful === 10 ? 'DIVINE PERFECTION' : TIER_NAMES[totalSuccessful] || 'No Enhancement';
                                const res = new EmbedBuilder()
                                    .setTitle('🧪 Testing Complete - No Rewards Given')
                                    .setColor('#FFA500')
                                    .setDescription(`**Testing Results:** ${totalSuccessful}/10 correct answers\n\n*In normal mode, this would have earned: **${tierName}***\n\n⚠️ **TESTING MODE**: No roles or XP multipliers awarded`)
                                    .addFields({ 
                                        name: '📊 Test Results', 
                                        value: `**Correct Answers:** ${totalSuccessful}/10\n**Would Have Earned:** ${this.getTierEmoji(totalSuccessful)} ${tierName}\n**Challenge by:** ${member.displayName} 🧪\n**Mode:** Testing (No Rewards)`, 
                                        inline: false 
                                    })
                                    .setFooter({ text: '🧪 Testing Mode Complete - No Actual Rewards Given' })
                                    .setTimestamp();
                                await btn.editReply({ embeds: [res], components: [] });
                            }
                        } else {
                            // Continue to next question
                            const successfulAnswers = newResults.filter(r => r === true).length;
                            const cont = new EmbedBuilder()
                                .setTitle(`✅ Correct! ${successfulAnswers} Successful`)
                                .setColor([46, 204, 113])
                                .setDescription(`Great job! You now have **${successfulAnswers}** successful answers.${testingMode ? '\n\n🧪 **Testing Mode**: Continue for practice, no rewards given' : ''}`)
                                .addFields({ name: '🎯 Progress', value: `Next: Question ${qNum + 1}/10\nSuccessful: ${successfulAnswers}/10`, inline: false })
                                .setFooter({ text: testingMode ? '🧪 Testing Mode - Continue the challenge' : 'Continue the challenge or secure your current progress' })
                                .setTimestamp();
                            
                            const contBtnComponents = [
                                new ButtonBuilder()
                                    .setCustomId(`cont_${userId}_${qNum + 1}_${passedRerollsUsed}`)
                                    .setLabel(`Continue to Question ${qNum + 1}`)
                                    .setStyle(ButtonStyle.Success)
                            ];
                            
                            if (!testingMode) {
                                contBtnComponents.push(
                                    new ButtonBuilder()
                                        .setCustomId(`claim_${userId}_${successfulAnswers}`)
                                        .setLabel(`Secure ${TIER_NAMES[successfulAnswers] || 'Current'} Buff`)
                                        .setStyle(ButtonStyle.Secondary)
                                        .setEmoji('🛡️')
                                );
                            }
                            
                            const contBtn = new ActionRowBuilder().addComponents(contBtnComponents);
                            
                            await btn.editReply({ embeds: [cont], components: [contBtn] });
                            
                            // ✅ OPTIMIZED: Shorter timeout for faster pace
                            const contColl = btn.message.createMessageComponentCollector({ time: 15000, filter: i => i.user.id === userId });
                            contColl.on('collect', async (contBtn) => {
                                await contBtn.deferUpdate();
                                if (contBtn.customId.startsWith('cont_')) {
                                    const [, , nextQNum, passedRerollsUsed] = contBtn.customId.split('_');
                                    contColl.stop();
                                    
                                    console.log(`[DAILY QUIZ] User clicked continue after correct answer, proceeding to Q${nextQNum} immediately`);
                                    
                                    // ✅ OPTIMIZED: Instant transition to next question
                                    try {
                                        await btn.message.delete();
                                    } catch (error) {
                                        console.log('[DAILY QUIZ] Could not delete continue message:', error.message);
                                    }
                                    
                                    await this.ask(interaction, userId, guildId, member, parseInt(nextQNum), tier, parseInt(passedRerollsUsed), newResults);
                                    
                                } else {
                                    if (testingMode) {
                                        await contBtn.editReply({
                                            content: '🧪 **Testing Mode**: Cannot claim rewards in testing mode!',
                                            components: []
                                        });
                                        return;
                                    }
                                    
                                    const cTier = parseInt(contBtn.customId.split('_')[2]); 
                                    const actualSuccessful = newResults.filter(r => r === true).length;
                                    const finalTier = Math.min(cTier, actualSuccessful);
                                    
                                    await this.apply(userId, guildId, member, finalTier);
                                    
                                    let xpMultiplier = 'Unknown';
                                    try {
                                        const roleId = process.env[`DAILY_QUIZ_TIER_${finalTier}_ROLE`];
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
                                    
                                    const claim = new EmbedBuilder()
                                        .setTitle('Strategic Withdrawal - Tier Secured!')
                                        .setColor(TIER_COLORS[finalTier] || '#FF0000')
                                        .setDescription(`**${TIER_NAMES[finalTier] || 'Enhancement'}** secured!\n*${TIER_DESC[finalTier] || 'Challenge ended'}*\n**XP Multiplier:** ${xpMultiplier}`)
                                        .addFields({ 
                                            name: '📊 Results', 
                                            value: `Successful Answers: ${actualSuccessful}/10\n**Buff Received:** ${this.getTierEmoji(finalTier)} ${TIER_NAMES[finalTier] || 'Enhancement'} (${xpMultiplier})\n**Challenge by:** ${member.displayName}\nNext: <t:${getReset()}:R>`, 
                                            inline: false 
                                        })
                                        .setFooter({ text: `${this.getTierEmoji(finalTier)} ${TIER_NAMES[finalTier] || 'Enhancement'} ${xpMultiplier} Active` })
                                        .setTimestamp();
                                    await contBtn.editReply({ embeds: [claim], components: [] }); 
                                    contColl.stop();
                                }
                            });
                        }
                    } else {
                        // Wrong answer handling (same for both modes)
                        const newResults = [...questionResults, false];
                        
                        console.log(`[DAILY BUFF] Q${qNum} INCORRECT by ${member.displayName}: Selected "${selectedOption}" | Showing correct answer: "${q.answer}"${testingMode ? ' [TESTING]' : ''}`);
                        
                        // ✅ OPTIMIZED: Brief answer reveal then continue
                        const answerRevealEmbed = new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle(`❌ Wrong Answer - Question ${qNum}/10${testingMode ? ' [Testing]' : ''}`)
                            .setDescription(`**Your Answer:** ${selectedOption}\n**Correct Answer:** 🎯 ${q.answer}${testingMode ? '\n\n🧪 **Testing Mode**: Continue for practice' : ''}`)
                            .addFields({
                                name: '⏳ Next Question Loading...',
                                value: qNum < 10 ? `Question ${qNum + 1}/10 starting immediately` : 'Calculating final results...',
                                inline: false
                            })
                            .setFooter({ text: testingMode ? '🧪 Testing Mode • Processing...' : 'Processing answer...' })
                            .setTimestamp();

                        await btn.editReply({ embeds: [answerRevealEmbed], components: [] });
                        
                        // ✅ OPTIMIZED: Shorter delay then instant continuation
                        setTimeout(async () => {
                            if (qNum < 10) {
                                // Continue to next question
                                try {
                                    await btn.message.delete();
                                } catch (error) {
                                    console.log('[DAILY QUIZ] Could not delete reveal message:', error.message);
                                }
                                
                                await this.ask(interaction, userId, guildId, member, qNum + 1, tier, passedRerollsUsed, newResults);
                            } else {
                                // Last question completion
                                const totalSuccessful = newResults.filter(r => r === true).length;
                                
                                // ✅ OPTIMIZED: Only apply rewards in non-testing mode
                                if (!testingMode) {
                                    if (totalSuccessful > 0) {
                                        await this.apply(userId, guildId, member, totalSuccessful);
                                    } else {
                                        await this.saveFail(userId, guildId);
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
                                    const tierEmoji = this.getTierEmoji(totalSuccessful);
                                    
                                    const res = new EmbedBuilder()
                                        .setTitle(`🏁 Challenge Complete - ${tierName}`)
                                        .setColor(totalSuccessful > 0 ? (TIER_COLORS[totalSuccessful] || '#FF0000') : '#FF0000')
                                        .setDescription(totalSuccessful > 0 ? 
                                            `**${tierName}** earned!\n*${TIER_DESC[totalSuccessful] || 'Challenge completed'}*\n**XP Multiplier:** ${xpMultiplier}` :
                                            '**No Enhancement** earned. Try again tomorrow!')
                                        .addFields({ 
                                            name: '📊 Final Results', 
                                            value: `**Correct Answers:** ${totalSuccessful}/10\n**Buff Received:** ${tierEmoji} ${tierName}${totalSuccessful > 0 ? ` (${xpMultiplier})` : ''}\n**Challenge by:** ${member.displayName}\n**Next Challenge:** <t:${getReset()}:R>`, 
                                            inline: false 
                                        })
                                        .setFooter({ text: totalSuccessful > 0 ? `${tierEmoji} ${tierName} ${xpMultiplier} Active Until Reset` : 'Challenge Complete - No Buff Awarded' })
                                        .setTimestamp();
                                        
                                    try {
                                        await btn.editReply({ embeds: [res], components: [] });
                                    } catch (error) {
                                        console.error('[DAILY BUFF] Error editing reply after final answer:', error);
                                    }
                                } else {
                                    // Testing mode final completion
                                    const tierName = totalSuccessful > 0 ? (TIER_NAMES[totalSuccessful] || 'Enhancement') : 'No Enhancement';
                                    const tierEmoji = this.getTierEmoji(totalSuccessful);
                                    
                                    const res = new EmbedBuilder()
                                        .setTitle('🧪 Testing Complete - Final Results')
                                        .setColor('#FFA500')
                                        .setDescription(`**Testing Results:** ${totalSuccessful}/10 correct answers\n\n*In normal mode, this would have earned: **${tierName}***\n\n⚠️ **TESTING MODE**: No roles or XP multipliers awarded`)
                                        .addFields({ 
                                            name: '📊 Test Results', 
                                            value: `**Correct Answers:** ${totalSuccessful}/10\n**Would Have Earned:** ${tierEmoji} ${tierName}\n**Challenge by:** ${member.displayName} 🧪\n**Mode:** Testing (No Rewards)`, 
                                            inline: false 
                                        })
                                        .setFooter({ text: '🧪 Testing Mode Complete - No Actual Rewards Given' })
                                        .setTimestamp();
                                        
                                    try {
                                        await btn.editReply({ embeds: [res], components: [] });
                                    } catch (error) {
                                        console.error('[DAILY BUFF] Error editing testing mode reply:', error);
                                    }
                                }
                            }
                        }, 1000); // 1 second delay
                    }
                    collector.stop();
                } catch (error) { 
                    console.error('[QUIZ] Button error:', error); 
                    clearInterval(timer); 
                }
            });

            // ✅ ENHANCED: Unified timeout handling with continue prompt and abandon option
            collector.on('end', async (collected) => {
                clearInterval(timer);
                if (collected.size === 0) {
                    console.log(`[DAILY QUIZ] Q${qNum} timed out for ${member.displayName} after 22 seconds${testingMode ? ' [TESTING]' : ''}`);
                    
                    const newResults = [...questionResults, false];
                    
                    if (qNum === 10) {
                        // Final question timeout - complete immediately
                        const totalSuccessful = newResults.filter(r => r === true).length;
                        
                        // ✅ OPTIMIZED: Only apply rewards in non-testing mode
                        if (!testingMode) {
                            if (totalSuccessful > 0) {
                                await this.apply(userId, guildId, member, totalSuccessful);
                            } else {
                                await this.saveFail(userId, guildId);
                            }
                            
                            const tierName = totalSuccessful > 0 ? (TIER_NAMES[totalSuccessful] || 'Enhancement') : 'No Enhancement';
                            const timeout = new EmbedBuilder()
                                .setColor(totalSuccessful > 0 ? (TIER_COLORS[totalSuccessful] || '#FF0000') : '#FF0000')
                                .setTitle('⏰ Time\'s Up! Challenge Complete')
                                .setDescription(totalSuccessful > 0 ? 
                                    `**${tierName}** earned based on your ${totalSuccessful} correct answers.` :
                                    'No enhancement earned.')
                                .addFields({ 
                                    name: '📊 Final Results', 
                                    value: `**Correct Answers:** ${totalSuccessful}/10\n**Questions Attempted:** ${qNum}/10\n**Tier Earned:** ${this.getTierEmoji(totalSuccessful)} ${tierName}`, 
                                    inline: false 
                                })
                                .addFields({ name: '💡 Next Attempt', value: `<t:${getReset()}:R>`, inline: false })
                                .setFooter({ text: 'Daily Quiz System • Timed Out' })
                                .setTimestamp();
                                
                            try {
                                await msg.edit({ embeds: [timeout], components: [] });
                            } catch (error) {
                                console.error(`[DAILY QUIZ] Error showing timeout message:`, error);
                            }
                        } else {
                            // Testing mode timeout
                            const tierName = totalSuccessful > 0 ? (TIER_NAMES[totalSuccessful] || 'Enhancement') : 'No Enhancement';
                            const timeout = new EmbedBuilder()
                                .setColor('#FFA500')
                                .setTitle('⏰ Testing Timeout - Results')
                                .setDescription(`**Testing Results:** ${totalSuccessful}/10 correct answers\n\n*In normal mode, this would have earned: **${tierName}***\n\n⚠️ **TESTING MODE**: No roles or XP multipliers awarded`)
                                .addFields({ 
                                    name: '📊 Test Results', 
                                    value: `**Correct Answers:** ${totalSuccessful}/10\n**Questions Attempted:** ${qNum}/10\n**Would Have Earned:** ${this.getTierEmoji(totalSuccessful)} ${tierName}`, 
                                    inline: false 
                                })
                                .setFooter({ text: '🧪 Testing Mode Timeout - No Actual Rewards Given' })
                                .setTimestamp();
                                
                            try {
                                await msg.edit({ embeds: [timeout], components: [] });
                            } catch (error) {
                                console.error(`[DAILY QUIZ] Error showing testing timeout message:`, error);
                            }
                        }
                    } else {
                        // ✅ ENHANCED: Mid-quiz timeout with continue prompt and abandon option
                        const successfulAnswers = newResults.filter(r => r === true).length;
                        
                        const timeoutPromptEmbed = new EmbedBuilder()
                            .setColor('#FF6B6B')
                            .setTitle(`⏰ Time's Up - Question ${qNum}/10${testingMode ? ' [Testing]' : ''}`)
                            .setDescription(`No answer selected in time for Question ${qNum}.${testingMode ? '\n\n🧪 **Testing Mode**: Continue for practice' : ''}`)
                            .addFields(
                                {
                                    name: '📊 Current Progress',
                                    value: `**Successful Answers:** ${successfulAnswers}/${qNum}\n**Questions Remaining:** ${10 - qNum}\n**Current Score:** ${successfulAnswers}/10`,
                                    inline: true
                                },
                                {
                                    name: '🎯 Options',
                                    value: `**Continue:** Move to Question ${qNum + 1}/10\n**Abandon:** End quiz and ${successfulAnswers > 0 && !testingMode ? `secure ${TIER_NAMES[successfulAnswers]} tier` : 'exit'}`,
                                    inline: true
                                }
                            )
                            .setFooter({ text: testingMode ? '🧪 Testing Mode - Choose your next action' : 'Choose your next action' })
                            .setTimestamp();
                        
                        // Create continue and abandon buttons
                        const timeoutButtons = [];
                        
                        timeoutButtons.push(
                            new ButtonBuilder()
                                .setCustomId(`timeout_continue_${userId}_${qNum + 1}`)
                                .setLabel(`▶️ Continue to Question ${qNum + 1}`)
                                .setStyle(ButtonStyle.Success)
                                .setEmoji('▶️')
                        );
                        
                        // Add abandon button (secure tier if possible, or just quit)
                        if (successfulAnswers > 0 && !testingMode) {
                            timeoutButtons.push(
                                new ButtonBuilder()
                                    .setCustomId(`timeout_abandon_secure_${userId}_${successfulAnswers}`)
                                    .setLabel(`🛡️ Secure ${TIER_NAMES[successfulAnswers]} & Exit`)
                                    .setStyle(ButtonStyle.Secondary)
                                    .setEmoji('🛡️')
                            );
                        } else {
                            timeoutButtons.push(
                                new ButtonBuilder()
                                    .setCustomId(`timeout_abandon_quit_${userId}`)
                                    .setLabel('❌ Abandon Quiz')
                                    .setStyle(ButtonStyle.Secondary)
                                    .setEmoji('❌')
                            );
                        }
                        
                        const timeoutButtonRow = new ActionRowBuilder().addComponents(timeoutButtons);
                        
                        try {
                            await msg.edit({ embeds: [timeoutPromptEmbed], components: [timeoutButtonRow] });
                        } catch (error) {
                            console.log('[DAILY QUIZ] Could not edit timeout prompt:', error.message);
                            // Fallback to auto-continue
                            setTimeout(async () => {
                                try { await msg.delete(); } catch {}
                                await this.ask(interaction, userId, guildId, member, qNum + 1, tier, rerollsUsed, newResults);
                            }, 2000);
                            return;
                        }
                        
                        // ✅ ENHANCED: Timeout button collector with smooth transitions
                        const timeoutCollector = msg.createMessageComponentCollector({ 
                            time: 30000, 
                            filter: i => i.user.id === userId && i.customId.startsWith('timeout_')
                        });
                        
                        timeoutCollector.on('collect', async (timeoutBtn) => {
                            try {
                                await timeoutBtn.deferUpdate();
                                timeoutCollector.stop();
                                
                                if (timeoutBtn.customId.startsWith('timeout_continue_')) {
                                    // Continue to next question
                                    const [, , , nextQNum] = timeoutBtn.customId.split('_');
                                    
                                    console.log(`[DAILY QUIZ] User chose to continue after timeout, proceeding to Q${nextQNum}`);
                                    
                                    // ✅ SMOOTH TRANSITION: Show brief loading then immediate question
                                    const loadingEmbed = new EmbedBuilder()
                                        .setColor('#00FF00')
                                        .setTitle(`⚡ Loading Question ${nextQNum}/10...`)
                                        .setDescription(`Preparing next question...${testingMode ? '\n\n🧪 **Testing Mode**: Continue for practice' : ''}`)
                                        .setFooter({ text: testingMode ? '🧪 Testing Mode - Loading...' : 'Loading next question...' });
                                    
                                    await timeoutBtn.editReply({ embeds: [loadingEmbed], components: [] });
                                    
                                    // ✅ SMOOTH: Brief pause then delete and show question
                                    setTimeout(async () => {
                                        try {
                                            await timeoutBtn.message.delete();
                                        } catch (error) {
                                            console.log('[DAILY QUIZ] Could not delete loading message:', error.message);
                                        }
                                        
                                        await this.ask(interaction, userId, guildId, member, parseInt(nextQNum), tier, rerollsUsed, newResults);
                                    }, 800); // Smooth 0.8 second transition
                                    
                                } else if (timeoutBtn.customId.startsWith('timeout_abandon_secure_')) {
                                    // Secure current tier and exit
                                    const [, , , , securedTier] = timeoutBtn.customId.split('_');
                                    const tierToSecure = parseInt(securedTier);
                                    
                                    console.log(`[DAILY QUIZ] User chose to secure tier ${tierToSecure} and exit`);
                                    
                                    if (!testingMode) {
                                        await this.apply(userId, guildId, member, tierToSecure);
                                    }
                                    
                                    let xpMultiplier = 'Unknown';
                                    if (!testingMode) {
                                        try {
                                            const roleId = process.env[`DAILY_QUIZ_TIER_${tierToSecure}_ROLE`];
                                            if (roleId && global.xpBoostManager) {
                                                const boostInfo = await global.xpBoostManager.getRoleBoost(guildId, roleId);
                                                if (boostInfo && boostInfo.boost_multiplier) {
                                                    xpMultiplier = `${boostInfo.boost_multiplier}x`;
                                                }
                                            }
                                        } catch (error) {
                                            xpMultiplier = 'Active';
                                        }
                                    }
                                    
                                    const secureEmbed = new EmbedBuilder()
                                        .setTitle(testingMode ? '🧪 Testing Abandoned - No Rewards' : 'Quiz Abandoned - Tier Secured!')
                                        .setColor(testingMode ? '#FFA500' : TIER_COLORS[tierToSecure])
                                        .setDescription(testingMode ? 
                                            `**Testing Results:** ${successfulAnswers}/10 correct answers\n\n*In normal mode, this would have secured: **${TIER_NAMES[tierToSecure]}***\n\n⚠️ **TESTING MODE**: No roles awarded` :
                                            `**${TIER_NAMES[tierToSecure]}** secured!\n*${TIER_DESC[tierToSecure]}*\n**XP Multiplier:** ${xpMultiplier}`)
                                        .addFields({ 
                                            name: testingMode ? '📊 Test Results' : '📊 Results', 
                                            value: testingMode ?
                                                `**Score:** ${successfulAnswers}/10\n**Questions Attempted:** ${qNum}/10\n**Would Have Earned:** ${this.getTierEmoji(tierToSecure)} ${TIER_NAMES[tierToSecure]}\n**Mode:** Testing (No Rewards)` :
                                                `**Score:** ${successfulAnswers}/10\n**Questions Attempted:** ${qNum}/10\n**Buff Received:** ${this.getTierEmoji(tierToSecure)} ${TIER_NAMES[tierToSecure]} (${xpMultiplier})\n**Challenge by:** ${member.displayName}\nNext: <t:${getReset()}:R>`, 
                                            inline: false 
                                        })
                                        .setFooter({ text: testingMode ? '🧪 Testing Mode - Quiz Abandoned' : `${this.getTierEmoji(tierToSecure)} ${TIER_NAMES[tierToSecure]} ${xpMultiplier} Active` })
                                        .setTimestamp();
                                    
                                    await timeoutBtn.editReply({ embeds: [secureEmbed], components: [] });
                                    
                                } else if (timeoutBtn.customId.startsWith('timeout_abandon_quit_')) {
                                    // Quit without securing anything
                                    console.log(`[DAILY QUIZ] User chose to abandon quiz completely`);
                                    
                                    if (!testingMode && successfulAnswers === 0) {
                                        await this.saveFail(userId, guildId);
                                    }
                                    
                                    const quitEmbed = new EmbedBuilder()
                                        .setTitle(testingMode ? '🧪 Testing Abandoned' : 'Quiz Abandoned')
                                        .setColor('#FF6B6B')
                                        .setDescription(testingMode ? 
                                            `**Testing Results:** ${successfulAnswers}/10 correct answers\n\n⚠️ **TESTING MODE**: No progress saved` :
                                            `Quiz ended early after ${qNum} questions.${successfulAnswers === 0 ? '\n\nNo enhancement earned.' : ''}`)
                                        .addFields({ 
                                            name: '📊 Final Status', 
                                            value: testingMode ?
                                                `**Score:** ${successfulAnswers}/10\n**Questions Attempted:** ${qNum}/10\n**Mode:** Testing (No Impact)` :
                                                `**Correct Answers:** ${successfulAnswers}/10\n**Questions Attempted:** ${qNum}/10\n**Result:** Quiz abandoned\n**Next Attempt:** <t:${getReset()}:R>`, 
                                            inline: false 
                                        })
                                        .setFooter({ text: testingMode ? '🧪 Testing Mode Complete' : 'Quiz Abandoned - Try Again Tomorrow' })
                                        .setTimestamp();
                                    
                                    await timeoutBtn.editReply({ embeds: [quitEmbed], components: [] });
                                }
                                
                            } catch (error) {
                                console.error('[DAILY QUIZ] Error handling timeout button:', error);
                                // Fallback to auto-continue
                                try {
                                    await timeoutBtn.message.delete();
                                } catch {}
                                await this.ask(interaction, userId, guildId, member, qNum + 1, tier, rerollsUsed, newResults);
                            }
                        });
                        
                        // ✅ ENHANCED: Auto-continue if no response to timeout prompt
                        timeoutCollector.on('end', async (collected) => {
                            if (collected.size === 0) {
                                console.log(`[DAILY QUIZ] Timeout prompt also timed out, auto-continuing to Q${qNum + 1}`);
                                
                                // Auto-continue message
                                const autoContEmbed = new EmbedBuilder()
                                    .setColor('#FFA500')
                                    .setTitle('⏰ Auto-Continuing...')
                                    .setDescription(`No response received. Automatically continuing to Question ${qNum + 1}/10...${testingMode ? '\n\n🧪 **Testing Mode**: Auto-continuing for practice' : ''}`)
                                    .setFooter({ text: testingMode ? '🧪 Testing Mode - Auto-continuing...' : 'Auto-continuing to next question...' });
                                
                                try {
                                    await msg.edit({ embeds: [autoContEmbed], components: [] });
                                } catch (error) {
                                    console.log('[DAILY QUIZ] Could not show auto-continue message:', error.message);
                                }
                                
                                // Brief pause then continue
                                setTimeout(async () => {
                                    try {
                                        await msg.delete();
                                    } catch (error) {
                                        console.log('[DAILY QUIZ] Could not delete auto-continue message:', error.message);
                                    }
                                    
                                    await this.ask(interaction, userId, guildId, member, qNum + 1, tier, rerollsUsed, newResults);
                                }, 2000);
                            }
                        });
                    }
                }
            });
        } catch (error) { 
            console.error('[QUIZ] Question error:', error); 
        }
    },

    // ✅ DATABASE FUNCTIONS: Only called in non-testing mode
    async checkRoll(userId, guildId) { 
        try {
            const currentDay = getCurrentDayKey();
            console.log(`[DAILY QUIZ] Checking database for user ${userId}, guild ${guildId}, day ${currentDay}`);
            
            const r = await global.xpTracker.db.query(
                'SELECT tier FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3', 
                [userId, guildId, currentDay]
            ); 
            
            console.log(`[DAILY QUIZ] Database query result:`, r.rows);
            
            if (r.rows.length > 0) {
                const result = { tier: r.rows[0].tier };
                console.log(`[DAILY QUIZ] Found existing record:`, result);
                return result;
            }
            
            console.log(`[DAILY QUIZ] No existing record found for user ${userId}`);
            return null;
        } catch (error) {
            console.error('[DAILY QUIZ] Error checking roll:', error);
            return null; 
        } 
    },

    // Helper methods
    getTierEmoji(tier) {
        const tierEmojis = { 
            0: '⬛',    // None
            1: '⚪',    // Common - White
            2: '🟢',    // Uncommon - Green
            3: '🔵',    // Rare - Blue
            4: '🟣',    // Epic - Purple
            5: '🟡',    // Legendary - Yellow
            6: '🟡',    // Legendary - Yellow
            7: '🟠',    // Mythic - Orange
            8: '🟠',    // Mythic - Orange
            9: '🔴',    // Divine - Red
            10: '🔴'    // Divine - Red
        };
        return tierEmojis[tier] || '⬛';
    },

    // ✅ GET TIER XP CAP: Only used for normal mode
    async getTierXPCap(userId, guildId) {
        try {
            const currentDay = getCurrentDayKey();
            const guild = global.xpTracker.client.guilds.cache.get(guildId);
            const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
            
            if (member) {
                // Check for tier roles (highest tier wins)
                for (let i = 10; i >= 1; i--) { 
                    const roleId = process.env[`DAILY_QUIZ_TIER_${i}_ROLE`];
                    if (roleId && roleId !== `role_id_${i}` && member.roles.cache.has(roleId)) {
                        const tierXPCap = parseInt(process.env[`DAILY_QUIZ_TIER_${i}_XP_CAP`]);
                        if (tierXPCap && tierXPCap > 0) {
                            
                            // Check existing tier XP
                            const result = await global.xpTracker.db.query(
                                'SELECT current_xp FROM daily_buff_xp_caps WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                                [userId, guildId, currentDay]
                            );
                            
                            let currentXP = 0;

                            if (result.rows.length > 0) {
                                // User already has tier record
                                currentXP = result.rows[0].current_xp || 0;
                            } else {
                                // Check default system for XP to carry over
                                const defaultXP = global.xpTracker.dailyResetManager ? 
                                    global.xpTracker.dailyResetManager.getDailyVoiceXP(userId, guildId, currentDay) : 0;
                                
                                if (defaultXP > 0) {
                                    console.log(`[DAILY QUIZ] 🔄 Carrying over ${defaultXP} XP from default to tier ${i} for ${member.displayName}`);
                                    currentXP = defaultXP;
                                    
                                    // Create tier record with carried over XP
                                    await global.xpTracker.db.query(`
                                        INSERT INTO daily_buff_xp_caps (user_id, guild_id, date, tier, xp_cap, current_xp, created_at, updated_at)
                                        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                                        ON CONFLICT (user_id, guild_id, date)
                                        DO UPDATE SET
                                            tier = $4,
                                            xp_cap = $5,
                                            current_xp = GREATEST(daily_buff_xp_caps.current_xp, $6),
                                            updated_at = CURRENT_TIMESTAMP
                                    `, [userId, guildId, currentDay, i, tierXPCap, defaultXP]);
                                } else {
                                    // No existing XP, create fresh tier record
                                    await global.xpTracker.db.query(`
                                        INSERT INTO daily_buff_xp_caps (user_id, guild_id, date, tier, xp_cap, current_xp, created_at, updated_at)
                                        VALUES ($1, $2, $3, $4, $5, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                                        ON CONFLICT (user_id, guild_id, date)
                                        DO UPDATE SET
                                            tier = $4,
                                            xp_cap = $5,
                                            updated_at = CURRENT_TIMESTAMP
                                    `, [userId, guildId, currentDay, i, tierXPCap]);
                                }
                            }
                            
                            return {
                                tier: i,
                                cap: tierXPCap,
                                currentXP: currentXP,
                                remaining: Math.max(0, tierXPCap - currentXP),
                                hasCustomCap: true
                            };
                        }
                    }
                }
            }

            // Default cap
            const defaultCap = parseInt(process.env.DAILY_VOICE_XP_CAP) || 1500;
            let currentXP = 0;
            
            if (global.xpTracker && global.xpTracker.dailyResetManager) {
                currentXP = global.xpTracker.dailyResetManager.getDailyVoiceXP(userId, guildId, currentDay);
            }
            
            return {
                tier: 0,
                cap: defaultCap,
                currentXP: currentXP,
                remaining: Math.max(0, defaultCap - currentXP),
                hasCustomCap: false
            };

        } catch (error) {
            console.error('[DAILY QUIZ] Error getting tier XP cap:', error);
            const defaultCap = parseInt(process.env.DAILY_VOICE_XP_CAP) || 1500;
            return {
                tier: 0,
                cap: defaultCap,
                currentXP: 0,
                remaining: defaultCap,
                hasCustomCap: false
            };
        }
    },

    // Update tier XP usage
    async updateTierXPUsage(userId, guildId, xpGained) {
        try {
            const currentDay = getCurrentDayKey();
            
            await global.xpTracker.db.query(`
                UPDATE daily_buff_xp_caps 
                SET current_xp = current_xp + $1, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $2 AND guild_id = $3 AND date = $4
            `, [xpGained, userId, guildId, currentDay]);

        } catch (error) {
            console.error('[DAILY QUIZ] Error updating tier XP usage:', error);
        }
    },

    // Get current day
    getCurrentDay() {
        return getCurrentDayKey();
    },

    // Check EDT
    isEDT(date) {
        const year = date.getFullYear();
        const marchSecondSunday = new Date(year, 2, 8);
        marchSecondSunday.setDate(marchSecondSunday.getDate() + (7 - marchSecondSunday.getDay()));
        const novemberFirstSunday = new Date(year, 10, 1);
        novemberFirstSunday.setDate(novemberFirstSunday.getDate() + (7 - novemberFirstSunday.getDay()));
        return date >= marchSecondSunday && date < novemberFirstSunday;
    },

    // ✅ GET BUFF: Only called in normal mode
    async getBuff(userId, guildId, member) {
        try {
            const r = await global.xpTracker.db.query('SELECT tier FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3', [userId, guildId, getDay()]);
            if (r.rows.length > 0) { 
                const t = r.rows[0].tier; 
                return { tier: t, name: t === 0 ? 'Challenge Failed' : TIER_NAMES[t], multiplier: t === 0 ? 'None' : 'Active' }; 
            }
            for (let i = 1; i <= 10; i++) { 
                const roleId = process.env[`DAILY_QUIZ_TIER_${i}_ROLE`]; 
                if (roleId && roleId !== `role_id_${i}` && member.roles.cache.has(roleId)) {
                    return { tier: i, name: TIER_NAMES[i], multiplier: 'Active' }; 
                }
            }
            return { tier: 0, name: 'No Enhancement', multiplier: 'None' };
        } catch { 
            return { tier: 0, name: 'Error', multiplier: 'None' }; 
        }
    },

    // ✅ APPLY: Only called in non-testing mode
    async apply(userId, guildId, member, tier) {
        try {
            console.log(`[DAILY QUIZ] Applying tier ${tier} to ${member.displayName} (Normal Mode)`);
            
            // Remove all tier roles including tier 10
            for (let i = 1; i <= 10; i++) { 
                const roleId = process.env[`DAILY_QUIZ_TIER_${i}_ROLE`]; 
                if (roleId && roleId !== `role_id_${i}` && member.roles.cache.has(roleId)) { 
                    const role = member.guild.roles.cache.get(roleId); 
                    if (role) await member.roles.remove(role); 
                } 
            }

            if (tier > 0) { 
                const roleId = process.env[`DAILY_QUIZ_TIER_${tier}_ROLE`]; 
                if (roleId && roleId !== `role_id_${tier}`) { 
                    const role = member.guild.roles.cache.get(roleId); 
                    if (role) { 
                        await member.roles.add(role); 
                        await this.setTierXPCap(userId, guildId, tier);
                        console.log(`[DAILY BUFF] ✅ Awarded ${role.name} with tier-specific XP cap`); 
                    } 
                } 
            }
            await this.save(userId, guildId, tier);
        } catch (error) { 
            console.error('[DAILY QUIZ] Apply error:', error); 
        }
    },

    // ✅ SET TIER XP CAP: Only called in non-testing mode
    async setTierXPCap(userId, guildId, tier) {
        try {
            const tierXPCap = parseInt(process.env[`DAILY_QUIZ_TIER_${tier}_XP_CAP`]);
            
            if (!tierXPCap || tierXPCap <= 0) {
                console.log(`[DAILY QUIZ] No XP cap configured for tier ${tier}`);
                return;
            }

            const currentDay = getCurrentDayKey();

            // Get existing XP from default system for carryover
            let existingXP = 0;
            if (global.xpTracker && global.xpTracker.dailyResetManager) {
                existingXP = global.xpTracker.dailyResetManager.getDailyVoiceXP(userId, guildId, currentDay);
            }

            // Create/update tier record with XP carryover
            await global.xpTracker.db.query(`
                INSERT INTO daily_buff_xp_caps (user_id, guild_id, date, tier, xp_cap, current_xp, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, guild_id, date)
                DO UPDATE SET
                    tier = $4,
                    xp_cap = $5,
                    current_xp = GREATEST(daily_buff_xp_caps.current_xp, $6),
                    updated_at = CURRENT_TIMESTAMP
            `, [userId, guildId, currentDay, tier, tierXPCap, existingXP]);

            if (existingXP > 0) {
                console.log(`[DAILY QUIZ] ✅ Set tier ${tier} XP cap with carryover: ${existingXP}/${tierXPCap} XP for ${guildId}:${userId}`);
            } else {
                console.log(`[DAILY QUIZ] ✅ Set tier ${tier} XP cap: ${tierXPCap.toLocaleString()} XP for ${guildId}:${userId}`);
            }

        } catch (error) {
            console.error('[DAILY QUIZ] Error setting tier XP cap:', error);
        }
    },

    // ✅ SAVE: Only called in non-testing mode
    async save(userId, guildId, tier) {
        try {
            await global.xpTracker.db.query('CREATE TABLE IF NOT EXISTS daily_buff_rolls (user_id VARCHAR(20), guild_id VARCHAR(20), date DATE, tier INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, guild_id, date))');
            await global.xpTracker.db.query('INSERT INTO daily_buff_rolls (user_id, guild_id, date, tier) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, guild_id, date) DO UPDATE SET tier = $4', [userId, guildId, getDay(), tier]);
            console.log(`[DAILY QUIZ] ✅ Saved tier ${tier} to database`);
        } catch (error) { 
            console.error('[DAILY QUIZ] Save error:', error); 
        }
    },

    // ✅ SAVE FAIL: Only called in non-testing mode
    async saveFail(userId, guildId) {
        try {
            await global.xpTracker.db.query('INSERT INTO daily_buff_rolls (user_id, guild_id, date, tier, created_at) VALUES ($1, $2, $3, 0, CURRENT_TIMESTAMP) ON CONFLICT (user_id, guild_id, date) DO UPDATE SET tier = 0', [userId, guildId, getDay()]);
            console.log('[DAILY QUIZ] ❌ Saved failed attempt to database');
        } catch (error) { 
            console.error('[DAILY QUIZ] Save failed error:', error); 
        }
    }
};// src/commands/daily-quiz.js - COMPLETE OPTIMIZED Daily Quiz System

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

// Check if testing mode is enabled
function isTestingMode() {
    return process.env.DAILY_QUIZ_TESTING_MODE === 'true';
}

// Timezone helpers
function getCurrentDayKey() {
    if (isTestingMode()) {
        return `test-mode-${new Date().toISOString().split('T')[0]}`;
    }
    
    const now = new Date();
    const estOffset = isESTDaylightSaving(now) ? -4 : -5;
    const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
    
    if (estTime.getHours() < 3) {
        estTime.setDate(estTime.getDate() - 1);
    }
    
    return estTime.toISOString().split('T')[0];
}

function isESTDaylightSaving(date) {
    const year = date.getFullYear();
    const march = new Date(year, 2, 1);
    const november = new Date(year, 10, 1);
    
    const dstStart = new Date(year, 2, (14 - march.getDay()) % 7 + 8);
    const dstEnd = new Date(year, 10, (7 - november.getDay()) % 7 + 1);
    
    return date >= dstStart && date < dstEnd;
}

function getNextResetUnixTimestamp() {
    const now = new Date();
    const estOffset = isESTDaylightSaving(now) ? -4 : -5;
    const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
    
    const nextReset = new Date(estTime);
    nextReset.setHours(3, 0, 0, 0);
    
    const currentTimeInMinutes = (estTime.getHours() * 60) + estTime.getMinutes();
    const resetTimeInMinutes = (3 * 60) + 0;
    
    if (currentTimeInMinutes >= resetTimeInMinutes) {
        nextReset.setDate(nextReset.getDate() + 1);
    }
    
    const utcReset = new Date(nextReset.getTime() - (estOffset * 60 * 60 * 1000));
    return Math.floor(utcReset.getTime() / 1000);
}

// Enhanced question fetching
async function fetchQuestion(difficulty) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const apiUrls = [
            'https://opentdb.com/api.php?amount=1&category=31&type=multiple',
            'https://aniquizapi.vercel.app/api/quiz',
        ];
        
        for (const apiUrl of apiUrls) {
            try {
                console.log(`[API] Trying ${apiUrl.includes('opentdb') ? 'OpenTDB' : 'AniQuiz'} API...`);
                
                const response = await fetch(apiUrl, {
                    method: 'GET',
                    headers: { 'User-Agent': 'DiscordBot-AnimeQuiz/1.0', 'Accept': 'application/json' },
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    const data = await response.json();
                    let question, options, answer;
                    
                    if (data.results && data.results.length > 0) {
                        const result = data.results[0];
                        question = result.question;
                        answer = result.correct_answer;
                        options = [...result.incorrect_answers, result.correct_answer].sort(() => Math.random() - 0.5);
                        
                        const badKeywords = ['voice actor', 'voiced by', 'seiyuu', 'dub', 'english dub', 'studio', 'director', 'composer'];
                        if (badKeywords.some(keyword => question.toLowerCase().includes(keyword))) {
                            console.log('[API] Skipping voice actor/production question');
                            continue;
                        }
                    } else if (data.data?.question || data.question) {
                        const questionData = data.data || data;
                        question = questionData.question;
                        options = Array.isArray(questionData.options) ? questionData.options : [];
                        answer = questionData.correct;
                        
                        const badKeywords = ['voice actor', 'voiced by', 'seiyuu', 'dub', 'english dub', 'studio', 'director', 'composer'];
                        if (badKeywords.some(keyword => question.toLowerCase().includes(keyword))) {
                            console.log('[API] Skipping voice actor/production question');
                            continue;
                        }
                    } else {
                        continue;
                    }
                    
                    const clean = (text) => {
                        if (!text) return '';
                        return text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#x([0-9A-Fa-f]+);/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
                            .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(parseInt(d, 10))).trim();
                    };
                    
                    question = clean(question);
                    answer = clean(answer);
                    options = options.map(opt => clean(opt)).filter(opt => opt.length > 0);
                    
                    if (!question || options.length < 2 || !answer) continue;
                    
                    if (!options.includes(answer)) {
                        const match = options.find(opt => opt.toLowerCase() === answer.toLowerCase());
                        if (match) answer = match;
                        else if (options.length >= 4) options[3] = answer;
                        else options.push(answer);
                    }
                    
                    if (options.length > 4) {
                        const correctIndex = options.indexOf(answer);
                        const others = options.filter((opt, i) => i !== correctIndex);
                        const randomOthers = others.sort(() => 0.5 - Math.random()).slice(0, 3);
                        options = [answer, ...randomOthers].sort(() => 0.5 - Math.random());
                    }
                    
                    console.log(`[API] ✅ Fetched ${difficulty} anime lore question from ${apiUrl.includes('opentdb') ? 'OpenTDB' : 'AniQuiz'}`);
                    console.log(`[QUESTION DEBUG] Q${difficulty}: "${question}" | Answer: "${answer}" | Options: [${options.join(', ')}]`);
                    return { question, options, answer, difficulty };
                }
            } catch (error) {
                console.log(`[API] API ${apiUrl} failed: ${error.message}`);
                continue;
            }
        }
    } catch (error) {
        console.log(`[API] ❌ All APIs failed: ${error.message}`);
    }
    
    console.log(`[API] 🛡️ Using enhanced fallback ${difficulty} question`);
    const fallbacks = FALLBACK[difficulty] || FALLBACK['Medium'];
    const selectedQuestion = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    console.log(`[QUESTION DEBUG FALLBACK] Q${difficulty}: "${selectedQuestion.question}" | Answer: "${selectedQuestion.answer}" | Options: [${selectedQuestion.options.join(', ')}]`);
    return selectedQuestion;
}

function getDay() { return getCurrentDayKey(); }
function getReset() { return getNextResetUnixTimestamp(); }

module.exports = {
    data: new SlashCommandBuilder().setName('daily-quiz').setDescription('🎌 Ultimate anime challenge! 10 questions, Divine mastery awaits!'),

    async execute(interaction) {
        try {
            const testingMode = isTestingMode();
            
            // Check if command is used in the correct channel (still enforced in testing mode)
            const allowedChannelId = process.env.DAILY_QUIZ_CHANNEL;
            
            if (allowedChannelId && interaction.channel.id !== allowedChannelId) {
                const allowedChannel = interaction.guild.channels.cache.get(allowedChannelId);
                const channelMention = allowedChannel ? `<#${allowedChannelId}>` : `channel ID: ${allowedChannelId}`;
                
                return await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#FF6B6B')
                        .setTitle(`🚫 Wrong Channel${testingMode ? ' [Testing Mode]' : ''}`)
                        .setDescription(`The daily quiz can only be used in ${channelMention}.${testingMode ? '\n\n🧪 **Testing Mode Active** - but channel restriction still applies!' : ''}\n\nPlease go to the correct channel to take the challenge!`)
                        .setFooter({ text: testingMode ? '🧪 Testing Mode • Channel Restriction Active' : 'Daily Quiz • Channel Restriction' })
                        .setTimestamp()
                    ],
                    ephemeral: true
                });
            }

            const userId = interaction.user.id, guildId = interaction.guild.id, member = interaction.member;
            
            // ✅ OPTIMIZED: Only check database in normal mode
            if (!testingMode) {
                if (!global.xpTracker?.db) {
                    return await interaction.reply({ 
                        content: '❌ System unavailable - XP tracker not initialized', 
                        ephemeral: true 
                    });
                }

                const existingRecord = await this.checkRoll(userId, guildId);
                console.log(`[DAILY QUIZ] Checking existing record for ${interaction.user.username}:`, existingRecord);
                
                if (existingRecord && existingRecord.tier >= 0) {
                    console.log(`[DAILY QUIZ] User ${interaction.user.username} already completed quiz today with tier ${existingRecord.tier}`);
                    
                    const buff = await this.getBuff(userId, guildId, member);
                    const embed = new EmbedBuilder()
                        .setColor('#FF6B6B')
                        .setAuthor({ name: '🎌 ULTIMATE ANIME MASTERY CHALLENGE' })
                        .setTitle('Daily Challenge Already Completed')
                        .setDescription(`You've already completed today's challenge!\n\n**Current Enhancement:** ${buff.name}\n**Next Challenge:** <t:${getReset()}:R>`)
                        .addFields({
                            name: '📊 Today\'s Results',
                            value: `**Score:** ${existingRecord.tier}/10\n**Tier Earned:** ${this.getTierEmoji(existingRecord.tier)} ${TIER_NAMES[existingRecord.tier] || 'No Enhancement'}\n**Status:** Challenge complete for today`,
                            inline: false
                        })
                        .setFooter({ text: 'Enhancement Intelligence • Ultimate System' })
                        .setTimestamp();
                    return await interaction.reply({ embeds: [embed], ephemeral: true });
                }
            } else {
                console.log(`[DAILY QUIZ] Testing mode - allowing unlimited attempts for ${interaction.user.username}`);
            }
            
            await interaction.deferReply();
            
            // Start the quiz (same for both modes)
            await this.ask(interaction, userId, guildId, member, 1, 0, 0);
            
        } catch (error) {
            console.error('[DAILY QUIZ] Execute error:', error);
            const content = '❌ Error occurred. Please try again.';
            try {
                if (interaction.deferred) {
                    await interaction.editReply({ content });
                } else {
                    await interaction.reply({ content, ephemeral: true });
                }
            } catch (replyError) {
                console.error('[DAILY QUIZ] Reply error:', replyError);
            }
        }
    },

    // ✅ OPTIMIZED: Single unified quiz function for both modes
    async ask(interaction, userId, guildId, member, qNum, tier, rerollsUsed = 0, questionResults = []) {
        try {
            const testingMode = isTestingMode();
            
            // 10-question structure: 2 Easy, 4 Medium, 4 Hard
            const difficulties = ['Easy', 'Easy', 'Medium', 'Medium', 'Medium', 'Medium', 'Hard', 'Hard', 'Hard', 'Hard'];
            const diff = difficulties[qNum - 1];
            console.log(`[DAILY BUFF] Starting Question ${qNum}/10 - Difficulty: ${diff} - User: ${member.displayName}${testingMode ? ' [TESTING MODE]' : ''}`);
            const q = await fetchQuestion(diff);
            console.log(`[DAILY BUFF] Question ${qNum} loaded: "${q.question}" | Correct: "${q.answer}"`);
            let time = 20;

            // Create embed function (same for both modes)
            const makeEmbed = (timeRemaining) => {
                const diffEmoji = { 'Easy': '🟢', 'Medium': '🟡', 'Hard': '🔴' };
                
                // Create countdown bar
                const totalTime = 20;
                const totalSquares = 10;
                const timePerSquare = totalTime / totalSquares;
                const remainingSquares = Math.ceil(timeRemaining / timePerSquare);
                const filledSquares = Math.max(0, Math.min(totalSquares, remainingSquares));
                
                // RGB Color progression
                const percentageRemaining = (timeRemaining / totalTime) * 100;
                let squareEmoji, embedColor;
                
                if (percentageRemaining > 66) {
                    const intensity = (percentageRemaining - 66) / 34;
                    squareEmoji = '🟩';
                    embedColor = [
                        Math.floor(46 + (30 * (1 - intensity))),
                        204,
                        Math.floor(113 - (50 * (1 - intensity)))
                    ];
                } else if (percentageRemaining > 33) {
                    const intensity = (percentageRemaining - 33) / 33;
                    squareEmoji = '🟨';
                    embedColor = [
                        Math.floor(200 + (55 * (1 - intensity))),
                        Math.floor(150 + (50 * intensity)),
                        Math.floor(7 + (50 * intensity))
                    ];
                } else {
                    const intensity = percentageRemaining / 33;
                    squareEmoji = '🟥';
                    embedColor = [
                        255,
                        Math.floor(87 * intensity),
                        Math.floor(34 * intensity)
                    ];
                }
                
                const filledBar = squareEmoji.repeat(filledSquares);
                const emptyBar = '⬛'.repeat(totalSquares - filledSquares);
                const countdownBar = filledBar + emptyBar;
                
                // 10-question progress bar with result tracking
                const createProgressBar = () => {
                    const steps = [];
                    for (let i = 1; i <= 10; i++) {
                        if (i <= questionResults.length) {
                            steps.push(questionResults[i - 1] ? '🟩' : '🟥');
                        } else if (i === qNum) {
                            steps.push('⬜');
                        } else {
                            steps.push('⬛');
                        }
                    }
                    return steps.join(' ');
                };
                
                const progressSteps = createProgressBar();
                const mins = Math.floor(timeRemaining / 60);
                const secs = timeRemaining % 60;
                const timeText = `${mins}:${secs.toString().padStart(2, '0')}`;

                // Tier system display based on successful answers
                const successfulAnswers = questionResults.filter(result => result === true).length;
                const currentTargetTier = Math.min(10, successfulAnswers + 1);
                const securedTier = successfulAnswers;

                const challengeTitle = testingMode ? 
                    '🧪 TESTING MODE - ULTIMATE ANIME MASTERY CHALLENGE' : 
                    '🎌 ULTIMATE ANIME MASTERY CHALLENGE';

                return new EmbedBuilder()
                    .setAuthor({ name: challengeTitle })
                    .setTitle(`${diffEmoji[diff]} Question ${qNum}/10 • ${diff}${testingMode ? ' [TEST]' : ''}`)
                    .setColor(embedColor)
                    .setDescription(`## **${q.question}**\n\n**Challenge by:** ${member.displayName}${testingMode ? ' 🧪' : ''}\n\n*Select your answer using the buttons below*${testingMode ? '\n\n⚠️ **TESTING MODE**: No roles will be awarded' : ''}`)
                    .addFields(
                        {
                            name: '📊 Challenge Progress (10 Questions)',
                            value: progressSteps,
                            inline: false
                        },
                        {
                            name: '⏰ Time Remaining',
                            value: `**${timeText}** (${timeRemaining} seconds)\n${countdownBar}`,
                            inline: false
                        },
                        {
                            name: testingMode ? '🧪 Test Results (No Rewards)' : '🎯 Tier Progression',
                            value: testingMode ? 
                                `**Score:** ${successfulAnswers}/10\n**Next Answer:** Would target ${TIER_NAMES[currentTargetTier] || 'Complete'}\n*Testing mode - no actual rewards*` :
                                (securedTier > 0 ? 
                                    `**Secured:** ${this.getTierEmoji(securedTier)} ${TIER_NAMES[securedTier]}\n**Target:** ${this.getTierEmoji(currentTargetTier)} ${TIER_NAMES[currentTargetTier]}` : 
                                    `**Target:** ${this.getTierEmoji(currentTargetTier)} ${TIER_NAMES[currentTargetTier]}\n*${TIER_DESC[currentTargetTier]}*`),
                            inline: false
                        },
                        {
                            name: '🎲 Rerolls Available',
                            value: `**${3 - rerollsUsed}/3** rerolls remaining`,
                            inline: true
                        }
                    )
                    .setFooter({ text: `Enhancement Intelligence • Difficulty: ${diff}${testingMode ? ' • TESTING MODE' : ''} • ${new Date().toLocaleTimeString()}` })
                    .setTimestamp();
            };

            // Create answer buttons (same for both modes)
            const btns = q.options.map((opt, i) => new ButtonBuilder()
                .setCustomId(`q_${userId}_${qNum}_${i}_${opt === q.answer}_${rerollsUsed}`)
                .setLabel(opt.substring(0, 70))
                .setStyle(ButtonStyle.Success)
                .setEmoji(['1️⃣', '2️⃣', '3️⃣', '4️⃣'][i]));

            // Create action buttons (same for both modes)
            const actionButtons = [];
            
            const successfulAnswers = questionResults.filter(result => result === true).length;
            if (!testingMode && qNum > 1 && successfulAnswers > 0) {
                actionButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`stop_${userId}_${qNum}`)
                        .setLabel(`🛡️ Secure ${TIER_NAMES[successfulAnswers]} Buff`)
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🛡️')
                );
            }
            
            actionButtons.push(
                new ButtonBuilder()
                    .setCustomId(`reroll_${userId}_${qNum}_${rerollsUsed}`)
                    .setLabel(rerollsUsed >= 3 ? '🎲 No Rerolls Left' : `🎲 Reroll (${3 - rerollsUsed} left)`)
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🎲')
                    .setDisabled(rerollsUsed >= 3)
            );

            // Button layout (same for both modes)
            const rows = [
                new ActionRowBuilder().addComponents(btns.slice(0, 2)),
                new ActionRowBuilder().addComponents(btns.slice(2, 4))
            ];
            
            if (actionButtons.length > 0) {
                rows.push(new ActionRowBuilder().addComponents(actionButtons));
            }

            let msg; 
            let embed = makeEmbed(time);
            
            // Display question (same for both modes)
            try {
                if (qNum === 1 && rerollsUsed === 0) { 
                    await interaction.editReply({ embeds: [embed], components: rows }); 
                    msg = await interaction.fetchReply(); 
                } else {
                    // ✅ OPTIMIZED: Direct question display for smooth transitions
                    msg = await interaction.followUp({ embeds: [embed], components: rows });
                }
                
                console.log(`[DAILY QUIZ] Q${qNum} message loaded successfully for ${member.displayName}${testingMode ? ' [TESTING]' : ''}`);
                
            } catch (error) {
                console.error(`[DAILY QUIZ] Error loading Q${qNum} message:`, error);
                try {
                    msg = await interaction.followUp({ 
                        embeds: [embed], 
                        components: rows 
                    });
                } catch (retryError) {
                    console.error(`[DAILY QUIZ] Retry failed for Q${qNum}:`, retryError);
                    return;
                }
            }

            // Timer updates (same for both modes)
            const timer = setInterval(async () => {
                time -= 2;
                if (time <= 0) { 
                    clearInterval(timer); 
                    return; 
                }
                try { 
                    if (msg && msg.edit) {
                        await msg.edit({ embeds: [makeEmbed(time)], components: rows }).catch(() => {
                            console.log(`[DAILY QUIZ] Timer update failed for Q${qNum}, stopping timer`);
                            clearInterval(timer);
                        }); 
                    } else {
                        console.log(`[DAILY QUIZ] Message no longer valid for Q${qNum}, stopping timer`);
                        clearInterval(timer);
                    }
                } catch (error) { 
                    console.error(`[DAILY QUIZ] Timer error for Q${qNum}:`, error);
                    clearInterval(timer); 
                }
            }, 2000);

            // Collector (same for both modes)
            const collector = msg.createMessageComponentCollector({ 
                time: 22000,
                filter: i => i.user.id === userId 
            });

            collector.on('collect', async (btn) => {
                try {
                    clearInterval(timer); 
                    
                    if (!btn.deferred && !btn.replied) {
                        await btn.deferUpdate();
                    }
                    
                    console.log(`[DAILY QUIZ] Q${qNum} button clicked by ${member.displayName}: ${btn.customId}${testingMode ? ' [TESTING]' : ''}`);
                    
                    // Handle reroll button (same for both modes)
                    if (btn.customId.startsWith('reroll_')) {
                        const [, , currentQNum, currentRerollsUsed] = btn.customId.split('_');
                        const rerollsUsedNum = parseInt(currentRerollsUsed);
                        
                        if (rerollsUsedNum >= 3) {
                            return;
                        }
                        
                        collector.stop();
                        
                        // ✅ OPTIMIZED: Instant reroll transition
                        try {
                            await btn.message.delete();
                        } catch (error) {
                            console.log('[DAILY QUIZ] Could not delete message:', error.message);
                        }
                        
                        await this.ask(interaction, userId, guildId, member, parseInt(currentQNum), tier, rerollsUsedNum + 1, questionResults);
                        return;
                    }
                    
                    // Handle secure tier button
                    if (btn.customId.startsWith('stop_')) {
                        if (testingMode) {
                            await btn.editReply({
                                content: '🧪 **Testing Mode**: Cannot secure tiers in testing mode!',
                                components: []

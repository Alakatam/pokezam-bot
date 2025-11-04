const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ProgressiveDailyRewards = require('../utils/ProgressiveDailyRewards');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your progressive daily rewards! Streak bonuses, milestones, and special rewards!'),

    async execute(interaction, { database, userManager, cardManager, questManager }) {
        const userId = interaction.user.id;
        
        try {
            // Get user data
            let userData = await userManager.getUser(userId);
            if (!userData) {
                return interaction.reply({
                    content: '❌ You need to use `/start` first to begin your Pokémon TCG journey!',
                    flags: 64 // ephemeral flag
                });
            }

            // Ensure coins column is initialized (for users created before coins were added)
            if (userData.coins === null || userData.coins === undefined) {
                await database.run(`
                    UPDATE users SET coins = 0 WHERE id = ? AND coins IS NULL
                `, [userId]);
                userData.coins = 0;
            }

            // Check if user already claimed daily reward (resets at 22:00 ET daily)
            const now = new Date();
            const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
            
            // Calculate the last 22:00 ET reset time
            const lastResetTime = new Date(easternTime);
            lastResetTime.setHours(22, 0, 0, 0);
            
            // If it's before 22:00 ET today, the reset was yesterday at 22:00 ET
            if (easternTime.getHours() < 22) {
                lastResetTime.setDate(lastResetTime.getDate() - 1);
            }
            
            const resetTimestamp = Math.floor(lastResetTime.getTime() / 1000);
            const lastClaimTimestamp = userData.last_daily_claim ? new Date(userData.last_daily_claim).getTime() / 1000 : 0;
            
            if (lastClaimTimestamp > resetTimestamp) {
                // Calculate next reset time (22:00 ET)
                const nextReset = new Date(easternTime);
                nextReset.setHours(22, 0, 0, 0);
                
                // If it's already past 22:00 ET today, next reset is tomorrow
                if (easternTime.getHours() >= 22) {
                    nextReset.setDate(nextReset.getDate() + 1);
                }
                
                const timeUntilReset = nextReset.getTime() - easternTime.getTime();
                const hoursLeft = Math.floor(timeUntilReset / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));
                
                // Create YAML cooldown message
                let yamlCooldown = '```yaml\n';
                yamlCooldown += '#════════════════════════════════\n';
                yamlCooldown += '# ⏰ DAILY REWARD COOLDOWN\n';
                yamlCooldown += '#════════════════════════════════\n\n';
                yamlCooldown += `👤 USER: ${interaction.user.displayName}\n`;
                yamlCooldown += `📅 LAST CLAIM: ${new Date(userData.last_daily_claim).toLocaleString("en-US", {timeZone: "America/New_York", dateStyle: "short", timeStyle: "short"})}\n\n`;
                yamlCooldown += '⏳ TIME REMAINING:\n';
                yamlCooldown += `   Hours: ${hoursLeft}h\n`;
                yamlCooldown += `   Minutes: ${minutesLeft}m\n\n`;
                yamlCooldown += '💡 TIP:\n';
                yamlCooldown += '   Daily rewards reset at 22:00 ET!\n';
                yamlCooldown += '   Come back tomorrow for more rewards!\n\n';
                yamlCooldown += '#════════════════════════════════\n';
                yamlCooldown += '```';

                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#FF6B6B')
                        .setTitle('⏰ Daily Reward Already Claimed')
                        .setDescription(yamlCooldown)
                        .setTimestamp()
                        .setFooter({ 
                            text: 'Daily rewards reset at 22:00 ET!',
                            iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                        })
                    ],
                    flags: 64 // ephemeral flag
                });
            }

            // Initialize Progressive Daily Rewards system
            const progressiveRewards = new ProgressiveDailyRewards(database);

            // Calculate progressive streak (based on 22:00 ET resets)
            let streakCount = 1;
            
            if (userData.last_daily_claim) {
                const lastClaimTime = new Date(userData.last_daily_claim);
                const lastClaimEastern = new Date(lastClaimTime.toLocaleString("en-US", {timeZone: "America/New_York"}));
                
                // Calculate expected previous reset time (yesterday at 22:00 ET)
                const expectedPrevReset = new Date(easternTime);
                expectedPrevReset.setHours(22, 0, 0, 0);
                expectedPrevReset.setDate(expectedPrevReset.getDate() - 1);
                
                // If current time is before today's 22:00 ET, subtract one more day
                if (easternTime.getHours() < 22) {
                    expectedPrevReset.setDate(expectedPrevReset.getDate() - 1);
                }
                
                // Check if last claim was within the previous reset period (streak continues)
                const timeDiffHours = Math.abs(lastClaimEastern.getTime() - expectedPrevReset.getTime()) / (1000 * 60 * 60);
                
                if (timeDiffHours <= 24) {
                    // User claimed within the last reset period, increment streak
                    streakCount = (userData.daily_streak || 0) + 1;
                } else {
                    // User missed days, reset streak
                    streakCount = 1;
                }
            }

            // Calculate progressive rewards based on streak
            const rewards = await progressiveRewards.calculateDailyRewards(userId, streakCount);
            
            // Calculate new totals including milestone bonuses
            let totalGold = rewards.gold;
            let totalXP = rewards.xp;
            
            if (rewards.milestones && rewards.milestones.length > 0) {
                rewards.milestones.forEach(milestone => {
                    totalGold += milestone.bonusGold;
                    totalXP += milestone.bonusXP;
                });
            }
            
            // Update user data with progressive rewards
            const newXP = userData.xp + totalXP;
            const newCoins = (userData.coins || 0) + rewards.coins;
            const newGold = userData.gold + totalGold;
            const newLevel = userManager.calculateLevel(newXP);
            const leveledUp = newLevel > userData.level;

            // Update database with current timestamp and new streak
            const claimTimestamp = now.toISOString();
            await database.run(`
                UPDATE users 
                SET xp = ?, coins = ?, gold = ?, level = ?, last_daily_claim = ?, daily_streak = ?
                WHERE id = ?
            `, [newXP, newCoins, newGold, newLevel, claimTimestamp, streakCount, userId]);

            // Add the progressive item to user's inventory
            await database.run(`
                INSERT INTO user_items (user_id, item_id, quantity)
                VALUES (?, ?, 1)
                ON CONFLICT (user_id, item_id) DO UPDATE SET
                    quantity = user_items.quantity + 1
            `, [userId, rewards.item]);

            // Add Daily Charm for all daily claims
            await database.run(`
                INSERT INTO user_items (user_id, item_id, quantity)
                VALUES (?, ?, 1)
                ON CONFLICT (user_id, item_id) DO UPDATE SET
                    quantity = user_items.quantity + 1
            `, [userId, 'Daily Charm']);

            // Daily Charm is now a manual activation item - use /use daily-charm to activate!

            // Create progressive reward display
            const yamlRewards = progressiveRewards.createProgressiveRewardDisplay(rewards, interaction.user.displayName);

            // Update progress display
            let progressInfo = '\n📊 PROGRESS UPDATE:\n';
            progressInfo += `   🏆 Level: ${newLevel}${leveledUp ? ' (LEVEL UP! 🎉)' : ''}\n`;
            progressInfo += `   💰 Total Gold: ${newGold.toLocaleString()}\n`;
            progressInfo += `   🪙 Total Coins: ${newCoins.toLocaleString()}\n`;
            progressInfo += `   ✨ Total XP: ${newXP.toLocaleString()}\n\n`;
            progressInfo += '💡 NEXT STEPS:\n';
            progressInfo += '   /use daily-charm - Activate your Daily Charm! 🍀\n';
            progressInfo += '   /quest - View daily quests\n';
            progressInfo += '   /inventory - Check your items\n';
            progressInfo += '   /profile - See your progress\n';
            
            const finalDisplay = yamlRewards.replace('#═══════════════════════════════════════════════════\n```', progressInfo + '\n#═══════════════════════════════════════════════════\n```');

            const rewardEmbed = new EmbedBuilder()
                .setTitle(`${rewards.special ? '🌟 SPECIAL ' : '🎁 '}Daily Rewards - Day ${streakCount}!`)
                .setDescription(finalDisplay)
                .setColor(rewards.special ? '#FFD700' : '#4CAF50')
                .setTimestamp()
                .setFooter({ 
                    text: `Next reward at 22:00 ET • ${rewards.streakProtection ? 'Streak Protection Active' : 'Keep your streak going!'}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                });

            // Add milestone bonus rewards if applicable
            if (rewards.milestoneReward) {
                // Add milestone bonus gold
                if (rewards.milestoneBonus) {
                    await database.run(`UPDATE users SET gold = gold + ? WHERE id = ?`, [rewards.milestoneBonus, userId]);
                }
                
                // Add milestone bonus item
                if (rewards.milestoneItem) {
                    await database.run(`
                        INSERT INTO user_items (user_id, item_id, quantity)
                        VALUES (?, ?, 1)
                        ON CONFLICT (user_id, item_id) DO UPDATE SET
                            quantity = user_items.quantity + 1
                    `, [userId, rewards.milestoneItem]);
                }
            }

            // Send milestone celebration if applicable
            if (rewards.milestoneReward) {
                const celebrationEmbed = new EmbedBuilder()
                    .setTitle(`🎊 MILESTONE ACHIEVED! Day ${streakCount}! 🎊`)
                    .setDescription(`**${rewards.milestoneName}**\n\n${rewards.milestoneMessage}\n\n🏆 **Milestone Rewards:**\n${rewards.milestoneBonus ? `💰 ${rewards.milestoneBonus.toLocaleString()} Gold\n` : ''}${rewards.milestoneItem ? `🎁 ${rewards.milestoneItem}\n` : ''}`)
                    .setColor('#FFD700')
                    .setTimestamp();
                
                await interaction.followUp({ embeds: [celebrationEmbed] });
            }

            await interaction.reply({ embeds: [rewardEmbed] });

        } catch (error) {
            console.error('Error in daily command:', error);
            await interaction.reply({
                content: '❌ An error occurred while claiming your daily rewards. Please try again!',
                flags: 64 // ephemeral flag
            });
        }
    }
};

// Helper function to get appropriate emoji for items
function getItemEmoji(itemName) {
    const emojiMap = {
        'Gold Boost': '🏆',
        'Luck Boost': '🍀',
        'XP Boost': '📈',
        'Rare Boost': '💎',
        'Shiny Boost': '✨',
        'Daily Charm': '🍀'
    };
    
    return emojiMap[itemName] || '🎁';
}
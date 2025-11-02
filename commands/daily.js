const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily rewards! Includes XP, items, and a Daily Charm.'),

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

            // Define shop items for random reward
            const shopItems = [
                // Cheaper items (higher chance)
                { name: 'Gold Boost', cost: 50, weight: 40 },
                { name: 'Luck Boost', cost: 75, weight: 35 },
                
                // Medium items
                { name: 'XP Boost', cost: 100, weight: 15 },
                { name: 'Rare Boost', cost: 150, weight: 8 },
                
                // Expensive items (lower chance)
                { name: 'Shiny Boost', cost: 300, weight: 2 }
            ];

            // Calculate total weight for weighted random selection
            const totalWeight = shopItems.reduce((sum, item) => sum + item.weight, 0);
            let randomWeight = Math.floor(Math.random() * totalWeight);
            
            // Select item based on weighted probability
            let selectedItem = shopItems[0];
            for (const item of shopItems) {
                randomWeight -= item.weight;
                if (randomWeight <= 0) {
                    selectedItem = item;
                    break;
                }
            }

            // Calculate rewards
            const xpReward = 250;
            const coinReward = Math.floor(Math.random() * 50) + 25; // 25-75 coins bonus
            const itemReward = selectedItem.name;

            // Update user data  
            const newXP = userData.xp + xpReward;
            const newCoins = (userData.coins || 0) + coinReward;
            const newLevel = userManager.calculateLevel(newXP);
            const leveledUp = newLevel > userData.level;

            // Update database with current timestamp
            const claimTimestamp = now.toISOString();
            await database.run(`
                UPDATE users 
                SET xp = ?, coins = ?, level = ?, last_daily_claim = ?
                WHERE id = ?
            `, [newXP, newCoins, newLevel, claimTimestamp, userId]);

            // Add the item to user's inventory
            await database.run(`
                INSERT OR REPLACE INTO user_items (user_id, item_id, quantity)
                VALUES (?, ?, COALESCE((SELECT quantity FROM user_items WHERE user_id = ? AND item_id = ?), 0) + 1)
            `, [userId, itemReward, userId, itemReward]);

            // Add Daily Charm to inventory
            await database.run(`
                INSERT OR REPLACE INTO user_items (user_id, item_id, quantity)
                VALUES (?, ?, COALESCE((SELECT quantity FROM user_items WHERE user_id = ? AND item_id = ?), 0) + 1)
            `, [userId, 'Daily Charm', userId, 'Daily Charm']);

            // Create streak tracking (based on 22:00 ET resets)
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

            // Update streak
            await database.run(`
                UPDATE users 
                SET daily_streak = ?
                WHERE id = ?
            `, [streakCount, userId]);

            // Create professional YAML reward display
            let yamlRewards = '```yaml\n';
            yamlRewards += '#════════════════════════════════\n';
            yamlRewards += '# 🎁 DAILY REWARDS CLAIMED\n';
            yamlRewards += '#════════════════════════════════\n\n';
            
            yamlRewards += `👋 WELCOME BACK: ${interaction.user.displayName}\n`;
            yamlRewards += `📅 DATE: ${new Date().toLocaleDateString()}\n\n`;
            
            yamlRewards += '🎁 REWARDS EARNED:\n';
            yamlRewards += `   📈 Experience: +${xpReward} XP\n`;
            yamlRewards += `   🪙 Bonus Coins: +${coinReward} coins\n`;
            yamlRewards += `   🎯 Random Item: ${getItemEmoji(itemReward)} ${itemReward}\n`;
            yamlRewards += `   ✨ Daily Charm: 🍀 Daily Charm (+1)\n\n`;
            
            yamlRewards += '📊 PROGRESS UPDATE:\n';
            yamlRewards += `   🏆 Level: ${newLevel}${leveledUp ? ' (LEVEL UP! 🎉)' : ''}\n`;
            yamlRewards += `   💰 Total Coins: ${newCoins.toLocaleString()}\n`;
            yamlRewards += `   🔥 Daily Streak: ${streakCount} day${streakCount > 1 ? 's' : ''}\n\n`;
            
            if (streakCount === 7) {
                yamlRewards += '🏆 STREAK BONUS:\n';
                yamlRewards += '   ✨ Shiny Boost earned for 7-day streak!\n\n';
            }
            
            yamlRewards += '💡 NEXT STEPS:\n';
            yamlRewards += '   /inventory - View your items\n';
            yamlRewards += '   /profile - Check your progress\n';
            yamlRewards += '   /shop - Browse the shop\n\n';
            yamlRewards += '#════════════════════════════════\n';
            yamlRewards += '```';

            const rewardEmbed = new EmbedBuilder()
                .setTitle('🎁 Daily Rewards Claimed!')
                .setDescription(yamlRewards)
                .setColor('#4CAF50')
                .setTimestamp()
                .setFooter({ 
                    text: `Next daily reward at 22:00 ET • Streak bonus at 7 days`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                });

            // Add streak bonus rewards for milestones
            if (streakCount === 7) {
                await database.run(`
                    INSERT OR REPLACE INTO user_items (user_id, item_id, quantity)
                    VALUES (?, ?, COALESCE((SELECT quantity FROM user_items WHERE user_id = ? AND item_id = ?), 0) + 1)
                `, [userId, 'Shiny Boost', userId, 'Shiny Boost']);

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
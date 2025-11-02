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

            // Check if user already claimed daily reward today
            const now = new Date();
            const today = now.toDateString(); // Gets date in format like "Sat Nov 02 2025"
            
            if (userData.last_daily_claim === today) {
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(0, 0, 0, 0);
                
                const timeUntilReset = tomorrow.getTime() - now.getTime();
                const hoursLeft = Math.floor(timeUntilReset / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));
                
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#FF6B6B')
                        .setTitle('⏰ Daily Reward Already Claimed')
                        .setDescription(`You've already claimed your daily rewards today!\n\n⏳ **Next claim available in:** ${hoursLeft}h ${minutesLeft}m`)
                        .setFooter({ text: 'Daily rewards reset at midnight!' })
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
            const newLevel = Math.floor(newXP / 1000) + 1;
            const leveledUp = newLevel > userData.level;

            // Update database
            await database.run(`
                UPDATE users 
                SET xp = ?, coins = ?, level = ?, last_daily_claim = ?
                WHERE id = ?
            `, [newXP, newCoins, newLevel, today, userId]);

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

            // Create streak tracking
            let streakCount = 1;
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayString = yesterday.toDateString();
            
            if (userData.last_daily_claim === yesterdayString) {
                // User claimed yesterday, increment streak
                streakCount = (userData.daily_streak || 0) + 1;
            } else if (userData.last_daily_claim && userData.last_daily_claim !== today) {
                // User missed days, reset streak
                streakCount = 1;
            }

            // Update streak
            await database.run(`
                UPDATE users 
                SET daily_streak = ?
                WHERE id = ?
            `, [streakCount, userId]);

            // Create reward embed
            const rewardEmbed = new EmbedBuilder()
                .setColor('#4CAF50')
                .setTitle('🎁 Daily Rewards Claimed!')
                .setDescription(`Welcome back, ${interaction.user.displayName}! Here are your daily rewards:`)
                .addFields(
                    {
                        name: '📈 Experience Points',
                        value: `+${xpReward} XP`,
                        inline: true
                    },
                    {
                        name: '🪙 Bonus Coins',
                        value: `+${coinReward} coins`,
                        inline: true
                    },
                    {
                        name: '🎯 Random Item',
                        value: `${getItemEmoji(itemReward)} ${itemReward}`,
                        inline: true
                    },
                    {
                        name: '✨ Daily Charm',
                        value: '🍀 Daily Charm (+1)',
                        inline: true
                    },
                    {
                        name: '🔥 Daily Streak',
                        value: `${streakCount} day${streakCount > 1 ? 's' : ''}`,
                        inline: true
                    },
                    {
                        name: '💎 Current Stats',
                        value: `Level ${newLevel} • ${newCoins} coins`,
                        inline: true
                    }
                )
                .setFooter({ 
                    text: `Next daily reward available tomorrow! | Streak bonus at 7 days` 
                })
                .setTimestamp();

            // Add level up notification if applicable
            if (leveledUp) {
                rewardEmbed.addFields({
                    name: '🎉 Level Up!',
                    value: `Congratulations! You've reached **Level ${newLevel}**!`,
                    inline: false
                });
            }

            // Add streak bonus rewards for milestones
            if (streakCount === 7) {
                await database.run(`
                    INSERT OR REPLACE INTO user_items (user_id, item_id, quantity)
                    VALUES (?, ?, COALESCE((SELECT quantity FROM user_items WHERE user_id = ? AND item_id = ?), 0) + 1)
                `, [userId, 'Shiny Boost', userId, 'Shiny Boost']);

                rewardEmbed.addFields({
                    name: '🏆 Weekly Streak Bonus!',
                    value: '✨ **Shiny Boost** - Complete 7 days in a row!',
                    inline: false
                });
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
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');
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

            // Helper to safely parse dates from string or numeric timestamps
            const parseClaimDate = (val) => {
                if (!val) return null;
                if (typeof val === 'number') return new Date(val);
                const num = Number(val);
                return !isNaN(num) ? new Date(num) : new Date(val);
            };

            // Check if user already claimed daily reward (resets at 20:00 ET daily)
            const now = new Date();
            const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
            
            // Calculate the last 20:00 ET reset time
            const lastResetTime = new Date(easternTime);
            lastResetTime.setHours(20, 0, 0, 0);
            
            // If it's before 20:00 ET today, the reset was yesterday at 20:00 ET
            if (easternTime.getHours() < 20) {
                lastResetTime.setDate(lastResetTime.getDate() - 1);
            }
            
            const resetTimestamp = Math.floor(lastResetTime.getTime() / 1000);
            const lastClaimDate = parseClaimDate(userData.last_daily_claim);
            const lastClaimTimestamp = lastClaimDate ? Math.floor(lastClaimDate.getTime() / 1000) : 0;
            
            if (lastClaimTimestamp > resetTimestamp) {
                // Calculate next reset time (20:00 ET)
                const nextReset = new Date(easternTime);
                nextReset.setHours(20, 0, 0, 0);
                
                // If it's already past 20:00 ET today, next reset is tomorrow
                if (easternTime.getHours() >= 22) {
                    nextReset.setDate(nextReset.getDate() + 1);
                }
                
                const timeUntilReset = nextReset.getTime() - easternTime.getTime();
                const hoursLeft = Math.floor(timeUntilReset / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));
                
                return interaction.reply({
                    embeds: [EmbedUtils.createBaseEmbed({
                        author: { name: `${interaction.user.displayName}'s Daily Rewards`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) },
                        title: '⏰ Daily Reward Already Claimed',
                        description: `**You have already claimed your daily reward for today!**\n\nReturn in **${hoursLeft}h ${minutesLeft}m** (20:00 ET) to claim your next streak bonus!`,
                        color: EmbedUtils.palette.warning,
                        footerText: 'Daily rewards reset at 20:00 ET daily • Pokézam',
                        footerIcon: interaction.user.displayAvatarURL({ dynamic: true }),
                        fields: [
                            { name: '📅 Last Claim', value: `\`${lastClaimDate ? lastClaimDate.toLocaleString("en-US", {timeZone: "America/New_York", dateStyle: "short", timeStyle: "short"}) : 'Never'}\``, inline: true },
                            { name: '🔥 Current Streak', value: `\`${userData.daily_streak || 1} Days\``, inline: true }
                        ]
                    })],
                    flags: 64 // ephemeral flag
                });
            }

            // Initialize Progressive Daily Rewards system
            const progressiveRewards = new ProgressiveDailyRewards(database);

            // Calculate progressive streak (based on 20:00 ET resets)
            let streakCount = 1;
            
            if (userData.last_daily_claim) {
                const lastClaimTime = parseClaimDate(userData.last_daily_claim);
                const lastClaimEastern = lastClaimTime ? new Date(lastClaimTime.toLocaleString("en-US", {timeZone: "America/New_York"})) : null;
                
                if (lastClaimEastern) {
                    // Calculate expected previous reset time (yesterday at 20:00 ET)
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
            const claimTimestamp = now.getTime();
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

            await require('../utils/recordAchievementEvent')(
                database,
                userId,
                'daily_claimed',
                1,
                { streak: streakCount, gold: totalGold, xp: totalXP, coins: rewards.coins }
            );

            // Daily Charm is now a manual activation item - use /use daily-charm to activate!

            const rewardFields = [
                { name: '🎁 Claimed Rewards', value: `• **Gold:** \`+${totalGold.toLocaleString()}\` 🪙\n• **Coins:** \`+${rewards.coins.toLocaleString()}\` 🪙\n• **XP:** \`+${totalXP.toLocaleString()}\` ✨\n• **Item Bonus:** \`1x ${rewards.item}\``, inline: false },
                { name: '🔥 Current Streak', value: `\`${streakCount} Days\` ${rewards.special ? '🌟 **(Special Streak Milestone!)**' : ''}`, inline: true },
                { name: '🏆 Level Progress', value: `Level \`${newLevel}\`${leveledUp ? ' 🎉 **LEVEL UP!**' : ''}\n\`${newGold.toLocaleString()}\` Total Gold`, inline: true }
            ];

            const rewardEmbed = EmbedUtils.createBaseEmbed({
                author: { name: `${interaction.user.displayName}'s Daily Bonus`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) },
                title: `${rewards.special ? '🌟 SPECIAL ' : '🎁 '}Daily Rewards Claimed — Day ${streakCount}!`,
                description: `**Great job, ${interaction.user.displayName}!** Keep your daily streak going to unlock higher multiplier tiers and exclusive milestone rewards.`,
                color: rewards.special ? EmbedUtils.palette.gold : EmbedUtils.palette.success,
                footerText: `Next reward resets at 20:00 ET • ${rewards.streakProtection ? 'Streak Protection Active' : 'Pokézam Daily'}`,
                footerIcon: interaction.user.displayAvatarURL({ dynamic: true }),
                fields: rewardFields
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
                const celebrationEmbed = EmbedUtils.createBaseEmbed({
                    title: `🎊 Milestone Achieved • Day ${streakCount}!`,
                    description: `**${rewards.milestoneName}**\n\n${rewards.milestoneMessage}\n\n🏆 **Milestone Rewards:**\n${rewards.milestoneBonus ? `💰 ${rewards.milestoneBonus.toLocaleString()} Gold\n` : ''}${rewards.milestoneItem ? `🎁 ${rewards.milestoneItem}\n` : ''}`,
                    color: EmbedUtils.palette.warning
                });
                
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
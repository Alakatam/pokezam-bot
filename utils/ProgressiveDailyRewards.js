class ProgressiveDailyRewards {
    constructor(database) {
        this.db = database;
        this.rewardTiers = this.initializeRewardTiers();
    }

    // Define progressive reward tiers with increasing value
    initializeRewardTiers() {
        return {
            // Daily milestone rewards (special days get extra rewards)
            daily: {
                1: { gold: 100, xp: 50, item: 'Daily Charm', special: false },
                2: { gold: 120, xp: 60, item: 'Luck Boost', special: false },
                3: { gold: 150, xp: 75, item: 'Gold Boost', special: false },
                4: { gold: 180, xp: 90, item: 'XP Boost', special: false },
                5: { gold: 200, xp: 100, item: 'Rare Boost', special: false },
                6: { gold: 250, xp: 125, item: 'Luck Boost', special: false },
                7: { gold: 1000, xp: 300, item: 'Shiny Boost', special: true, milestone: 'Weekly Champion' },
                8: { gold: 150, xp: 80, item: 'Daily Charm', special: false },
                9: { gold: 180, xp: 90, item: 'Gold Boost', special: false },
                10: { gold: 200, xp: 100, item: 'XP Boost', special: false },
                11: { gold: 220, xp: 110, item: 'Rare Boost', special: false },
                12: { gold: 250, xp: 125, item: 'Luck Boost', special: false },
                13: { gold: 280, xp: 140, item: 'Gold Boost', special: false },
                14: { gold: 1500, xp: 400, item: 'Ultra Boost', special: true, milestone: 'Bi-Weekly Master' },
                15: { gold: 200, xp: 100, item: 'Daily Charm', special: false },
                16: { gold: 220, xp: 110, item: 'Luck Boost', special: false },
                17: { gold: 250, xp: 125, item: 'Gold Boost', special: false },
                18: { gold: 280, xp: 140, item: 'XP Boost', special: false },
                19: { gold: 300, xp: 150, item: 'Rare Boost', special: false },
                20: { gold: 350, xp: 175, item: 'Shiny Boost', special: false },
                21: { gold: 2000, xp: 500, item: 'Legendary Boost', special: true, milestone: 'Tri-Weekly Legend' },
                22: { gold: 250, xp: 125, item: 'Daily Charm', special: false },
                23: { gold: 280, xp: 140, item: 'Luck Boost', special: false },
                24: { gold: 300, xp: 150, item: 'Gold Boost', special: false },
                25: { gold: 350, xp: 175, item: 'XP Boost', special: false },
                26: { gold: 400, xp: 200, item: 'Rare Boost', special: false },
                27: { gold: 450, xp: 225, item: 'Shiny Boost', special: false },
                28: { gold: 3000, xp: 600, item: 'Ultra Boost', special: true, milestone: '4-Week Warrior' },
                29: { gold: 350, xp: 175, item: 'Legendary Boost', special: false },
                30: { gold: 5000, xp: 1000, item: 'Master Boost', special: true, milestone: 'Monthly Legend' }
            },

            // Extended rewards for super long streaks
            extended: {
                45: { gold: 7500, xp: 1500, item: 'Champion Boost', special: true, milestone: '45-Day Champion' },
                60: { gold: 10000, xp: 2000, item: 'Mythical Boost', special: true, milestone: '60-Day Mythical' },
                90: { gold: 15000, xp: 3000, item: 'Legendary Boost', special: true, milestone: '90-Day Legendary' },
                100: { gold: 20000, xp: 4000, item: 'Master Boost', special: true, milestone: '100-Day Master' },
                365: { gold: 50000, xp: 10000, item: 'Yearly Boost', special: true, milestone: 'Annual Champion' }
            }
        };
    }

    // Get reward for specific streak day
    getStreakReward(streakDay) {
        // Check daily rewards first (1-30 cycle)
        const dailyDay = ((streakDay - 1) % 30) + 1;
        let baseReward = this.rewardTiers.daily[dailyDay];
        
        if (!baseReward) {
            // Fallback for days beyond 30
            baseReward = { gold: 200, xp: 100, item: 'Daily Charm', special: false };
        }

        // Check for extended milestone rewards
        const extendedReward = this.rewardTiers.extended[streakDay];
        if (extendedReward) {
            return {
                ...extendedReward,
                isExtended: true,
                baseReward: baseReward
            };
        }

        // Apply streak multiplier for longer streaks
        let multiplier = 1;
        if (streakDay > 30) {
            multiplier = 1 + Math.floor((streakDay - 30) / 30) * 0.1; // 10% increase every 30 days
        }

        return {
            ...baseReward,
            gold: Math.floor(baseReward.gold * multiplier),
            xp: Math.floor(baseReward.xp * multiplier),
            multiplier: multiplier > 1 ? multiplier : undefined
        };
    }

    // Calculate progressive rewards with streak bonuses
    async calculateDailyRewards(userId, currentStreak) {
        const reward = this.getStreakReward(currentStreak);
        
        // Base calculations
        const goldReward = reward.gold;
        const xpReward = reward.xp;
        const itemReward = reward.item;
        const coinBonus = Math.floor(Math.random() * 50) + 25; // 25-75 coins bonus

        // Special milestone rewards
        const milestoneRewards = [];
        if (reward.special && reward.milestone) {
            milestoneRewards.push({
                type: 'milestone',
                title: reward.milestone,
                description: this.getMilestoneDescription(currentStreak),
                bonusGold: Math.floor(goldReward * 0.5), // 50% bonus gold for milestones
                bonusXP: Math.floor(xpReward * 0.5)
            });
        }

        // Streak protection (premium feature simulation)
        const hasStreakProtection = await this.checkStreakProtection(userId);

        return {
            streak: currentStreak,
            gold: goldReward,
            xp: xpReward,
            coins: coinBonus,
            item: itemReward,
            milestones: milestoneRewards,
            streakProtection: hasStreakProtection,
            special: reward.special || false,
            multiplier: reward.multiplier,
            isExtended: reward.isExtended || false
        };
    }

    // Get milestone description for celebrations
    getMilestoneDescription(streakDay) {
        const milestones = {
            7: "One full week of dedication! You've earned your stripes as a Daily Trainer!",
            14: "Two weeks strong! Your commitment is paying off with amazing rewards!",
            21: "Three weeks of excellence! You're becoming a true Pokemon Master!",
            28: "Four weeks of unwavering dedication! Your training regimen is legendary!",
            30: "30 DAYS ACHIEVED! You are now a Monthly Champion with incredible rewards!",
            45: "45 days of pure determination! Champion status unlocked!",
            60: "60 days of mythical dedication! You've transcended ordinary trainers!",
            90: "90 DAYS LEGENDARY! Your commitment is the stuff of legends!",
            100: "100 DAYS MASTERY! You have achieved the ultimate daily training milestone!",
            365: "ONE YEAR ANNIVERSARY! You are the Annual Champion - the apex of dedication!"
        };

        return milestones[streakDay] || "Another day of amazing progress on your journey!";
    }

    // Check if user has streak protection (could be premium feature)
    async checkStreakProtection(userId) {
        try {
            // Return false if no database available (for testing)
            if (!this.db) return false;
            
            // For now, everyone gets 1 free streak protection per month
            const user = await this.db.get('SELECT * FROM users WHERE id = ?', [userId]);
            const now = new Date();
            const currentMonth = now.getMonth();
            
            // Simple streak protection logic (could be expanded)
            return user && user.level >= 5; // Level 5+ users get streak protection
        } catch (error) {
            console.error('Error checking streak protection:', error);
            return false;
        }
    }

    // Create celebration notification for milestone achievements
    async createMilestoneNotification(interaction, streakDay, milestone) {
        const celebrations = {
            7: { emoji: '🎊', color: '#4CAF50' },
            14: { emoji: '🎉', color: '#2196F3' },
            21: { emoji: '🏆', color: '#FF9800' },
            28: { emoji: '👑', color: '#9C27B0' },
            30: { emoji: '🌟', color: '#FFD700' },
            45: { emoji: '💎', color: '#E91E63' },
            60: { emoji: '🔥', color: '#F44336' },
            90: { emoji: '⚡', color: '#FF5722' },
            100: { emoji: '🚀', color: '#795548' },
            365: { emoji: '🎆', color: '#607D8B' }
        };

        const celebration = celebrations[streakDay] || { emoji: '🎁', color: '#4CAF50' };

        // Send milestone notification after delay for dramatic effect
        setTimeout(async () => {
            try {
                await interaction.followUp({
                    content: `${celebration.emoji} **MILESTONE ACHIEVED!** ${celebration.emoji}\n\n**${milestone.title}**\n*${milestone.description}*\n\n**Bonus Rewards:**\n🪙 +${milestone.bonusGold} Gold\n✨ +${milestone.bonusXP} XP`,
                    ephemeral: false
                });
            } catch (error) {
                console.error('Error sending milestone notification:', error);
            }
        }, 3000); // 3 second delay for dramatic effect
    }

    // Generate progressive reward description for embed
    createProgressiveRewardDisplay(rewards, username) {
        let yamlContent = '```yaml\n';
        yamlContent += '#═══════════════════════════════════════════════════\n';
        yamlContent += `# ${rewards.special ? '🌟' : '🎁'} ${rewards.special ? 'SPECIAL ' : ''}DAILY REWARDS - DAY ${rewards.streak}\n`;
        yamlContent += '#═══════════════════════════════════════════════════\n\n';
        
        yamlContent += `👤 TRAINER: "${username}"\n`;
        yamlContent += `🔥 STREAK: ${rewards.streak} day${rewards.streak > 1 ? 's' : ''}\n`;
        yamlContent += `📅 DATE: ${new Date().toLocaleDateString()}\n\n`;

        // Show rewards with progressive styling
        yamlContent += '🎁 TODAY\'S REWARDS:\n';
        yamlContent += `   💰 Gold: ${rewards.gold.toLocaleString()}${rewards.multiplier ? ` (${Math.round((rewards.multiplier - 1) * 100)}% streak bonus!)` : ''}\n`;
        yamlContent += `   ✨ Experience: ${rewards.xp.toLocaleString()} XP\n`;
        yamlContent += `   🪙 Bonus Coins: ${rewards.coins} coins\n`;
        yamlContent += `   🎯 Daily Item: ${this.getItemEmoji(rewards.item)} ${rewards.item}\n`;
        
        if (rewards.streakProtection) {
            yamlContent += `   🛡️ Streak Protection: ACTIVE\n`;
        }

        // Show milestone rewards
        if (rewards.milestones && rewards.milestones.length > 0) {
            yamlContent += '\n🏆 MILESTONE REWARDS:\n';
            rewards.milestones.forEach(milestone => {
                yamlContent += `   🎊 Title: "${milestone.title}"\n`;
                yamlContent += `   💎 Bonus Gold: +${milestone.bonusGold.toLocaleString()}\n`;
                yamlContent += `   ⭐ Bonus XP: +${milestone.bonusXP.toLocaleString()}\n`;
            });
        }

        // Show upcoming milestones
        yamlContent += '\n📈 UPCOMING MILESTONES:\n';
        const upcomingMilestones = this.getUpcomingMilestones(rewards.streak);
        upcomingMilestones.forEach(milestone => {
            yamlContent += `   Day ${milestone.day}: ${milestone.reward} ${milestone.emoji}\n`;
        });

        // Streak calendar preview
        yamlContent += '\n📅 STREAK PREVIEW:\n';
        yamlContent += this.createStreakCalendar(rewards.streak);

        yamlContent += '\n#═══════════════════════════════════════════════════\n';
        yamlContent += '```';

        return yamlContent;
    }

    // Get upcoming milestones for motivation
    getUpcomingMilestones(currentStreak) {
        const milestones = [7, 14, 21, 30, 45, 60, 90, 100, 365];
        const upcoming = milestones.filter(day => day > currentStreak).slice(0, 3);
        
        const milestoneRewards = {
            7: { reward: '1,000 gold + Shiny Boost', emoji: '🎊' },
            14: { reward: '1,500 gold + Ultra Boost', emoji: '🎉' },
            21: { reward: '2,000 gold + Legendary Boost', emoji: '🏆' },
            30: { reward: '5,000 gold + Master Boost', emoji: '🌟' },
            45: { reward: '7,500 gold + Champion Boost', emoji: '💎' },
            60: { reward: '10,000 gold + Mythical Boost', emoji: '🔥' },
            90: { reward: '15,000 gold + Legendary Boost', emoji: '⚡' },
            100: { reward: '20,000 gold + Master Boost', emoji: '🚀' },
            365: { reward: '50,000 gold + Yearly Boost', emoji: '🎆' }
        };

        return upcoming.map(day => ({
            day,
            ...milestoneRewards[day]
        }));
    }

    // Create visual streak calendar 
    createStreakCalendar(currentStreak) {
        let calendar = '   ';
        
        // Show last 7 days and next 7 days
        for (let i = -3; i <= 10; i++) {
            const day = currentStreak + i;
            if (day <= 0) continue;
            
            let symbol;
            if (i < 0) {
                symbol = '✅'; // Past days
            } else if (i === 0) {
                symbol = '🔥'; // Today
            } else if (this.rewardTiers.daily[((day - 1) % 30) + 1]?.special || this.rewardTiers.extended[day]) {
                symbol = '🌟'; // Special future days
            } else {
                symbol = '📅'; // Regular future days
            }
            
            calendar += `${day}${symbol} `;
        }
        
        return calendar + '\n   ^TODAY     ^NEXT MILESTONE';
    }

    // Get appropriate emoji for items
    getItemEmoji(itemName) {
        const emojiMap = {
            'Daily Charm': '🍀',
            'Gold Boost': '🏆', 
            'Luck Boost': '🍀',
            'XP Boost': '📈',
            'Rare Boost': '💎',
            'Shiny Boost': '✨',
            'Ultra Boost': '🔷',
            'Legendary Boost': '🌟',
            'Master Boost': '👑',
            'Champion Boost': '🏅',
            'Mythical Boost': '🔥',
            'Yearly Boost': '🎆'
        };
        
        return emojiMap[itemName] || '🎁';
    }
}

module.exports = ProgressiveDailyRewards;
const { EmbedBuilder } = require('discord.js');

class SmartNotificationManager {
    constructor() {
        this.celebrationEmojis = ['🎉', '🥳', '🎊', '🌟', '💫', '⭐', '✨', '🎁'];
        this.rareCardThresholds = {
            legendary: ['secret', 'rainbow', 'gold'],
            ultra: ['ultra', 'ex', 'gx', 'vmax', 'vstar', 'break', 'prime'],
            holo: ['holo'],
            special: ['prism', 'amazing', 'radiant', 'ace spec']
        };
    }

    // Enhanced rare card notification with smart features
    async sendRareCardNotification(interaction, detailedCard, variant, variantInfo, rarityInfo) {
        try {
            const rarity = detailedCard.rarity?.toLowerCase() || '';
            const notificationLevel = this.getRarityNotificationLevel(rarity);
            
            // Only notify for Holo Rare and above
            if (notificationLevel === 'none') {
                return null;
            }

            // Create enhanced notification embed
            const notification = await this.createEnhancedNotification(
                interaction, detailedCard, variant, variantInfo, rarityInfo, notificationLevel
            );

            // Add smart reactions based on rarity
            await this.addSmartReactions(interaction, notificationLevel);

            // Send follow-up celebration message for ultra rare+ cards
            if (['legendary', 'ultra', 'special'].includes(notificationLevel)) {
                await this.sendCelebrationFollowUp(interaction, detailedCard, notificationLevel);
            }

            // Update user's rare pull statistics
            await this.updateRarePullStats(interaction.user.id, notificationLevel, interaction);

            return notification;

        } catch (error) {
            console.error('Error in smart rare card notification:', error);
            return null;
        }
    }

    // Determine notification level based on card rarity
    getRarityNotificationLevel(rarity) {
        if (this.rareCardThresholds.legendary.some(r => rarity.includes(r))) {
            return 'legendary';
        }
        if (this.rareCardThresholds.ultra.some(r => rarity.includes(r))) {
            return 'ultra';
        }
        if (this.rareCardThresholds.special.some(r => rarity.includes(r))) {
            return 'special';
        }
        if (this.rareCardThresholds.holo.some(r => rarity.includes(r))) {
            return 'holo';
        }
        if (rarity.includes('rare')) {
            return 'rare';
        }
        return 'none';
    }

    // Create enhanced notification embed with smart messaging
    async createEnhancedNotification(interaction, detailedCard, variant, variantInfo, rarityInfo, level) {
        const messages = this.getSmartMessages(level, detailedCard.name, interaction.user.username);
        const colors = this.getNotificationColors(level);
        
        const embed = new EmbedBuilder()
            .setTitle(`${messages.titleEmoji} ${messages.title}`)
            .setColor(colors.primary)
            .setTimestamp();

        // Enhanced description with excitement level
        let description = `${messages.excitement}\n\n`;
        description += `**${detailedCard.name}** has been added to ${interaction.user.username}'s collection!\n`;
        description += `**Set:** ${detailedCard.set_name || 'Unknown'}\n`;
        description += `**Rarity:** ${detailedCard.rarity}\n`;
        
        if (variant !== 'normal') {
            description += `**Variant:** ${variantInfo.displayName} ${variantInfo.emoji}\n`;
        }

        // Add rarity-specific bonus info
        if (level === 'legendary') {
            description += `\n🏆 **LEGENDARY STATUS ACHIEVED!**\n`;
            description += `This is one of the rarest cards in the entire collection!`;
        } else if (level === 'ultra') {
            description += `\n💎 **ULTRA RARE DISCOVERY!**\n`;
            description += `Less than 5% of all pulls reach this rarity level!`;
        } else if (level === 'special') {
            description += `\n🌟 **SPECIAL MECHANICS CARD!**\n`;
            description += `This card has unique gameplay mechanics!`;
        } else if (level === 'holo') {
            description += `\n✨ **HOLOGRAPHIC SHINE!**\n`;
            description += `The card sparkles with holographic effects!`;
        }

        embed.setDescription(description);

        // Add card image if available
        const imageUrl = detailedCard.image_large || detailedCard.image_small;
        if (imageUrl) {
            embed.setImage(imageUrl);
        }

        // Enhanced footer with pull statistics
        embed.setFooter({
            text: `${messages.footer} • ${this.getRandomCelebrationMessage()}`,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true })
        });

        return embed;
    }

    // Add smart reactions based on rarity level  
    async addSmartReactions(interaction, level) {
        try {
            const reply = await interaction.fetchReply();
            const reactionSets = {
                legendary: ['🌟', '🎊', '🏆', '💫', '🎉'],
                ultra: ['💎', '⭐', '🎉', '✨'],
                special: ['🌟', '🎯', '🎊', '💫'],
                holo: ['✨', '⭐', '🎉'],
                rare: ['⭐', '🎉']
            };

            const reactions = reactionSets[level] || ['⭐'];
            
            // Add reactions with small delays for effect
            for (let i = 0; i < reactions.length; i++) {
                setTimeout(async () => {
                    try {
                        await reply.react(reactions[i]);
                    } catch (error) {
                        // Ignore reaction errors
                    }
                }, i * 500);
            }
        } catch (error) {
            console.error('Error adding smart reactions:', error);
        }
    }

    // Send celebration follow-up for ultra rare+ cards
    async sendCelebrationFollowUp(interaction, detailedCard, level) {
        if (!['legendary', 'ultra', 'special'].includes(level)) return;

        try {
            setTimeout(async () => {
                const celebrationMessages = {
                    legendary: [
                        `🌟 INCREDIBLE! ${interaction.user.username} just pulled a **LEGENDARY** ${detailedCard.name}!`,
                        `🏆 HISTORY MADE! This ${detailedCard.name} is an absolute LEGEND!`,
                        `💫 COSMIC PULL! ${interaction.user.username} defied all odds with this ${detailedCard.name}!`
                    ],
                    ultra: [
                        `💎 AMAZING! ${interaction.user.username} struck **ULTRA RARE** gold with ${detailedCard.name}!`,
                        `⚡ ELECTRIC! This ${detailedCard.name} is absolutely stunning!`,
                        `🚀 STELLAR PULL! ${interaction.user.username} is on fire!`
                    ],
                    special: [
                        `🌟 SPECIAL! ${interaction.user.username} found a unique ${detailedCard.name}!`,
                        `🎯 BULLSEYE! This ${detailedCard.name} has special powers!`,
                        `✨ MAGICAL! ${interaction.user.username} discovered something special!`
                    ]
                };

                const messages = celebrationMessages[level];
                const randomMessage = messages[Math.floor(Math.random() * messages.length)];
                
                await interaction.followUp({
                    content: randomMessage,
                    ephemeral: false
                });
            }, 2000); // 2 second delay for dramatic effect
        } catch (error) {
            console.error('Error sending celebration follow-up:', error);
        }
    }

    // Update user's rare pull statistics
    async updateRarePullStats(userId, level, interaction) {
        try {
            // Get database from interaction context
            const database = interaction.client.database || interaction.database;
            if (!database) return;

            const statColumns = {
                legendary: 'legendary_pulls',
                ultra: 'ultra_pulls', 
                special: 'special_pulls',
                holo: 'holo_pulls',
                rare: 'rare_pulls'
            };

            const column = statColumns[level];
            if (column) {
                await database.run(`
                    UPDATE users SET ${column} = COALESCE(${column}, 0) + 1 WHERE id = ?
                `, [userId]);
            }

            // Also update total rare pulls counter
            await database.run(`
                UPDATE users SET total_rare_pulls = COALESCE(total_rare_pulls, 0) + 1 WHERE id = ?
            `, [userId]);

        } catch (error) {
            console.error('Error updating rare pull stats:', error);
        }
    }

    // Get smart messages based on rarity level
    getSmartMessages(level, cardName, username) {
        const messageTemplates = {
            legendary: {
                titleEmoji: '🌟✨',
                title: 'LEGENDARY PULL ACHIEVED!',
                excitement: '🎊 **ABSOLUTELY INCREDIBLE!** 🎊\nYou have just witnessed the rarest of the rare!',
                footer: `${username} achieved LEGENDARY status`
            },
            ultra: {
                titleEmoji: '💎⚡',
                title: 'ULTRA RARE DISCOVERY!',
                excitement: '💎 **PHENOMENAL PULL!** 💎\nThis is an extraordinary find!',
                footer: `${username} struck ultra rare gold`
            },
            special: {
                titleEmoji: '🌟🎯',
                title: 'SPECIAL CARD FOUND!',
                excitement: '🌟 **REMARKABLE!** 🌟\nYou found something truly special!',
                footer: `${username} discovered unique mechanics`
            },
            holo: {
                titleEmoji: '✨⭐',
                title: 'HOLOGRAPHIC RARE!',
                excitement: '✨ **FANTASTIC!** ✨\nThe holographic shine is mesmerizing!',
                footer: `${username} pulled a shimmering holo`
            },
            rare: {
                titleEmoji: '⭐🎉',
                title: 'Rare Card Pulled!',
                excitement: '⭐ **EXCELLENT!** ⭐\nA solid rare addition to your collection!',
                footer: `${username} found a valuable rare`
            }
        };

        return messageTemplates[level] || messageTemplates.rare;
    }

    // Get notification colors based on rarity
    getNotificationColors(level) {
        const colorSchemes = {
            legendary: { primary: '#FF6B35', secondary: '#FFD23F' }, // Orange-gold
            ultra: { primary: '#E91E63', secondary: '#9C27B0' },     // Pink-purple
            special: { primary: '#FF9800', secondary: '#FFC107' },   // Amber-yellow
            holo: { primary: '#9B59B6', secondary: '#8E44AD' },      // Purple
            rare: { primary: '#3498DB', secondary: '#2980B9' }       // Blue
        };

        return colorSchemes[level] || colorSchemes.rare;
    }

    // Get random celebration message for footer
    getRandomCelebrationMessage() {
        const messages = [
            'Keep the luck rolling!',
            'Amazing collection growing!',
            'The cards are calling to you!',
            'Destiny favors the bold!',
            'Your luck is legendary!',
            'The rarest finds await!',
            'Collection goals achieved!',
            'Pure card drawing magic!'
        ];

        return messages[Math.floor(Math.random() * messages.length)];
    }

    // Check if user has achieved rare pull milestones
    async checkRarePullMilestones(userId, level, interaction) {
        try {
            const database = interaction.client.database || interaction.database;
            if (!database) return;

            // Get user's current stats
            const user = await database.get('SELECT * FROM users WHERE id = ?', [userId]);
            if (!user) return;

            const milestones = {
                legendary: [1, 5, 10, 25, 50],
                ultra: [5, 10, 25, 50, 100],
                holo: [10, 25, 50, 100, 250]
            };

            const statColumns = {
                legendary: user.legendary_pulls || 0,
                ultra: user.ultra_pulls || 0,
                holo: user.holo_pulls || 0
            };

            // Check if user hit a milestone
            if (milestones[level] && statColumns[level]) {
                const currentCount = statColumns[level];
                if (milestones[level].includes(currentCount)) {
                    await this.sendMilestoneNotification(interaction, level, currentCount);
                }
            }

        } catch (error) {
            console.error('Error checking rare pull milestones:', error);
        }
    }

    // Send milestone achievement notification
    async sendMilestoneNotification(interaction, level, count) {
        try {
            const milestoneEmbed = new EmbedBuilder()
                .setTitle('🏆 Rare Pull Milestone Achieved!')
                .setDescription(`Congratulations! You've pulled **${count}** ${level} cards!`)
                .setColor('#FFD700')
                .setTimestamp()
                .setFooter({
                    text: `${interaction.user.username} • Milestone Master`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                });

            await interaction.followUp({
                embeds: [milestoneEmbed],
                ephemeral: false
            });

        } catch (error) {
            console.error('Error sending milestone notification:', error);
        }
    }
}

module.exports = SmartNotificationManager;
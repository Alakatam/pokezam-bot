const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('active-boosts')
        .setDescription('⚡ Check all your currently active item effects and buffs'),

    async execute(interaction, { database, userManager }) {
        try {
            await interaction.deferReply();

            const userId = interaction.user.id;

            // Ensure user exists
            let user = await userManager.getUser(userId);
            if (!user) {
                user = await userManager.createUser(userId, interaction.user.username);
            }

            // Get active effects
            const activeEffects = await this.getActiveEffects(database, userId);

            if (activeEffects.length === 0) {
                return await interaction.editReply({
                    embeds: [EmbedUtils.createBaseEmbed({
                        author: { name: `${interaction.user.displayName}'s Active Boosts`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) },
                        title: '😴 No Active Boosts',
                        description: `**You currently have no active item effects or boosts running.**\n\nVisit the **/shop** to purchase boost items, or check your **/inventory** to activate items you already own!`,
                        color: EmbedUtils.palette.accent,
                        footerText: 'Visit /shop to purchase boost items • Pokézam',
                        footerIcon: interaction.user.displayAvatarURL({ dynamic: true }),
                        fields: [
                            { name: '🪙 Gold Boosts', value: 'Amulet Coin, Fortune Charm', inline: true },
                            { name: '🍀 Luck Boosts', value: 'Shiny Charm, Rainbow Feather', inline: true },
                            { name: '⚡ Cooldown Skips', value: 'Quick Ball, Master Ball', inline: true }
                        ]
                    })]
                });
            }

            // Display active effects
            await interaction.editReply({
                embeds: [this.createActiveBoostsEmbed(interaction.user, activeEffects)]
            });

        } catch (error) {
            console.error('Error in active-boosts command:', error);
            await interaction.editReply({
                embeds: [EmbedUtils.createErrorEmbed(
                    'Active Boosts Error',
                    'An error occurred while checking your active effects. Please try again!'
                )]
            });
        }
    },

    async getActiveEffects(database, userId) {
        const now = Math.floor(Date.now() / 1000);
        
        // Clean up expired effects first
        await database.run(`
            DELETE FROM active_effects 
            WHERE user_id = ? AND expires_at IS NOT NULL AND expires_at <= ?
        `, [userId, now]);

        // Clean up used-up effects
        await database.run(`
            DELETE FROM active_effects 
            WHERE user_id = ? AND uses_remaining IS NOT NULL AND uses_remaining <= 0
        `, [userId]);

        // Get remaining active effects
        const effects = await database.all(`
            SELECT * FROM active_effects 
            WHERE user_id = ? AND (
                (expires_at IS NULL OR expires_at > ?) OR 
                (uses_remaining IS NULL OR uses_remaining > 0)
            )
            ORDER BY created_at DESC
        `, [userId, now]);

        return effects;
    },

    createActiveBoostsEmbed(user, activeEffects) {
        const now = Math.floor(Date.now() / 1000);
        const fields = [];

        const grouped = this.groupEffectsByCategory(activeEffects);

        Object.entries(grouped).forEach(([category, effects]) => {
            const emoji = this.getCategoryEmoji(category);
            const lines = effects.map(effect => {
                const name = this.getItemDisplayName(effect.effect_type);
                const mult = effect.multiplier && effect.multiplier !== 1.0 ? ` \`(${effect.multiplier}x)\`` : '';

                let statusStr = '';
                if (effect.expires_at && effect.expires_at > now) {
                    const timeLeft = effect.expires_at - now;
                    const hours = Math.floor(timeLeft / 3600);
                    const mins = Math.floor((timeLeft % 3600) / 60);
                    const secs = timeLeft % 60;
                    let timeStr = hours > 0 ? `${hours}h ${mins}m` : (mins > 0 ? `${mins}m ${secs}s` : `${secs}s`);
                    statusStr += ` ⏳ **${timeStr}** left`;
                }

                if (effect.uses_remaining && effect.uses_remaining > 0) {
                    statusStr += ` ⚡ **${effect.uses_remaining}** uses left`;
                }

                return `• **${name}**${mult}${statusStr}`;
            }).join('\n');

            fields.push({
                name: `${emoji} ${category}`,
                value: lines,
                inline: false
            });
        });

        return EmbedUtils.createBaseEmbed({
            author: { name: `${user.displayName || user.username}'s Active Boosts`, iconURL: user.displayAvatarURL({ dynamic: true }) },
            title: `⚡ Active Effects & Boosters (\`${activeEffects.length}\`)`,
            description: 'Your trainer buffs and active item effects are running below:',
            color: activeEffects.length >= 3 ? EmbedUtils.palette.gold : EmbedUtils.palette.brand,
            footerText: 'Effects run automatically • Use /use to activate items',
            footerIcon: user.displayAvatarURL({ dynamic: true }),
            fields
        });
    },

    groupEffectsByCategory(effects) {
        const groups = {};
        
        effects.forEach(effect => {
            const category = this.getCategoryDisplayName(effect.category);
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(effect);
        });
        
        return groups;
    },

    getCategoryDisplayName(category) {
        const categoryNames = {
            'gold_boost': 'GOLD BOOSTS',
            'xp_boost': 'XP BOOSTS',
            'luck_boost': 'LUCK BOOSTS',
            'draw_boost': 'DRAW BOOSTS',
            'quality_filter': 'QUALITY FILTERS',
            'auto_sell': 'AUTO SELLERS',
            'discount': 'DISCOUNTS',
            'multi_boost': 'MULTI_BOOST'
        };
        return categoryNames[category] || category.toUpperCase();
    },

    getCategoryEmoji(category) {
        const emojis = {
            'GOLD BOOSTS': '💰',
            'XP BOOSTS': '🥇',
            'LUCK BOOSTS': '🍀',
            'DRAW BOOSTS': '🎴',
            'QUALITY FILTERS': '⚙️',
            'AUTO SELLERS': '🔍',
            'DISCOUNTS': '🎫',
            'MULTI_BOOST': '🌟'
        };
        return emojis[category] || '⚡';
    },

    getItemDisplayName(itemId) {
        const names = {
            'amulet_coin': 'Amulet Coin',
            'pay_day_voucher': 'Pay Day Voucher',
            'lucky_egg': 'Lucky Egg',
            'gold_incense': 'Gold Incense',
            'shop_coupon': 'Shop Coupon',
            'collectors_charm': 'Collector\'s Charm',
            'shiny_charm': 'Shiny Charm',
            'wishing_star': 'Wishing Star',
            'four_leaf_clover': 'Four-Leaf Clover',
            'card_magnet': 'Card Magnet',
            'bulk_repel': 'Bulk Repel',
            'professors_sifter': 'Professor\'s Sifter',
            'welcome_charm': 'Welcome Charm'
        };
        return names[itemId] || itemId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
};
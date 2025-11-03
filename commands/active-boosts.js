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
                const yamlDescription = '```yaml\n' +
                    '#═══════════════════════════════════════════════════\n' +
                    `# 😴 ${interaction.user.displayName.toUpperCase()}'S ACTIVE EFFECTS\n` +
                    '#═══════════════════════════════════════════════════\n\n' +
                    `📊 OVERVIEW:\n` +
                    `   Total Active Effects: 0\n` +
                    `   Status             : "NO ACTIVE BOOSTS"\n` +
                    `   Last Updated       : "${new Date().toLocaleString()}"\n\n` +
                    `💡 GET STARTED:\n` +
                    `   - Visit /shop to buy useful items\n` +
                    `   - Use /use to activate items from inventory\n` +
                    `   - Check /inventory to see what items you own\n` +
                    `   - Claim /daily rewards for Daily Charm bonus\n\n` +
                    `🎯 AVAILABLE BOOSTS:\n` +
                    `   - Gold Multipliers (Amulet Coin, Lucky Coin)\n` +
                    `   - Luck Enhancers (Shiny Charm, Rainbow Feather)\n` +
                    `   - Cooldown Skips (Quick Ball, Master Ball)\n` +
                    `   - Multi Boosts (Divine Blessing, Sacred Orb)\n\n` +
                    '#═══════════════════════════════════════════════════\n' +
                    '```';
                
                return await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setTitle('😴 No Active Effects')
                        .setDescription(yamlDescription)
                        .setColor('#6B73FF')
                        .setTimestamp()
                        .setFooter({ 
                            text: 'Visit /shop to get started with boosts!',
                            iconURL: interaction.user.displayAvatarURL({ dynamic: true })
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
        
        let yamlDescription = '```yaml\n';
        yamlDescription += '#═══════════════════════════════════════════════════\n';
        yamlDescription += `# ⚡ ${user.username.toUpperCase()}'S ACTIVE EFFECTS\n`;
        yamlDescription += '#═══════════════════════════════════════════════════\n\n';
        
        yamlDescription += `📊 OVERVIEW:\n`;
        yamlDescription += `   Total Active Effects: ${activeEffects.length}\n`;
        yamlDescription += `   Status             : "ENHANCED GAMEPLAY"\n`;
        yamlDescription += `   Last Updated       : "${new Date().toLocaleString()}"\n\n`;

        // Group effects by category
        const groupedEffects = this.groupEffectsByCategory(activeEffects);

        Object.entries(groupedEffects).forEach(([category, effects]) => {
            yamlDescription += `${this.getCategoryEmoji(category)} ${category.toUpperCase()} EFFECTS:\n`;
            
            effects.forEach(effect => {
                const itemName = this.getItemDisplayName(effect.effect_type);
                const multiplierText = effect.multiplier !== 1.0 ? ` (${effect.multiplier}x)` : '';
                
                yamlDescription += `   ${itemName}${multiplierText}:\n`;
                
                if (effect.expires_at && effect.expires_at > now) {
                    const timeLeft = effect.expires_at - now;
                    const hours = Math.floor(timeLeft / 3600);
                    const minutes = Math.floor((timeLeft % 3600) / 60);
                    const seconds = timeLeft % 60;
                    
                    let timeString = '';
                    if (hours > 0) timeString += `${hours}h `;
                    if (minutes > 0) timeString += `${minutes}m `;
                    if (hours === 0 && minutes < 5) timeString += `${seconds}s`;
                    
                    yamlDescription += `     Time Remaining   : "${timeString.trim()}"\n`;
                    yamlDescription += `     Expires At       : "${new Date(effect.expires_at * 1000).toLocaleTimeString()}"\n`;
                }
                
                if (effect.uses_remaining && effect.uses_remaining > 0) {
                    yamlDescription += `     Uses Remaining   : ${effect.uses_remaining}\n`;
                    yamlDescription += `     Consumption      : "Per Command Use"\n`;
                }
                
                yamlDescription += `     Effect Status    : "ACTIVE"\n`;
                yamlDescription += '\n';
            });
        });

        yamlDescription += '💡 TIPS:\n';
        yamlDescription += '   • Effects stack if they\'re different categories\n';
        yamlDescription += '   • Time-based effects run in the background\n';
        yamlDescription += '   • Use-based effects consume on each action\n';
        yamlDescription += '   • Check back anytime with /active-boosts\n\n';
        yamlDescription += '#═══════════════════════════════════════════════════\n';
        yamlDescription += '```';

        // Determine embed color based on number of active effects
        let embedColor = '#00D9FF'; // Default blue
        if (activeEffects.length >= 5) embedColor = '#FFD700'; // Gold for lots of effects
        else if (activeEffects.length >= 3) embedColor = '#00FF00'; // Green for several effects
        else if (activeEffects.length >= 1) embedColor = '#FFA500'; // Orange for some effects

        return new EmbedBuilder()
            .setTitle(`⚡ Active Effects (${activeEffects.length})`)
            .setDescription(yamlDescription)
            .setColor(embedColor)
            .setTimestamp()
            .setFooter({ 
                text: 'Effects update automatically | Use /use to activate more items',
                iconURL: user.displayAvatarURL({ dynamic: true })
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
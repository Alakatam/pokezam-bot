const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');

// Item definitions with complete details
const SHOP_ITEMS = {
    // Gold Boost Items
    'amulet_coin': {
        name: 'Amulet Coin',
        description: 'Doubles gold earned from packs for 1 hour',
        category: 'gold_boost',
        price: 50000,
        emoji: '🪙',
        effect: { type: 'gold_boost', multiplier: 2.0, duration: 3600 }
    },
    'golden_horseshoe': {
        name: 'Golden Horseshoe',
        description: 'Triples gold earned from packs for 30 minutes',
        category: 'gold_boost',
        price: 85000,
        emoji: '🌟',
        effect: { type: 'gold_boost', multiplier: 3.0, duration: 1800 }
    },
    'fortune_charm': {
        name: 'Fortune Charm',
        description: '5x gold from packs for 15 minutes',
        category: 'gold_boost',
        price: 150000,
        emoji: '🍀',
        effect: { type: 'gold_boost', multiplier: 5.0, duration: 900 }
    },

    // Luck Boost Items
    'collectors_charm': {
        name: "Collector's Charm",
        description: '2x chance of rare cards for 1 hour',
        category: 'luck_boost',
        price: 75000,
        emoji: '✨',
        effect: { type: 'luck_boost', multiplier: 2.0, duration: 3600 }
    },
    'shiny_charm': {
        name: 'Shiny Charm',
        description: '3x chance of rare cards for 30 minutes',
        category: 'luck_boost',
        price: 120000,
        emoji: '🌈',
        effect: { type: 'luck_boost', multiplier: 3.0, duration: 1800 }
    },
    'rainbow_feather': {
        name: 'Rainbow Feather',
        description: '5x chance of rare cards for 15 minutes',
        category: 'luck_boost',
        price: 200000,
        emoji: '🪶',
        effect: { type: 'luck_boost', multiplier: 5.0, duration: 900 }
    },

    // Quality of Life Items
    'quick_ball': {
        name: 'Quick Ball',
        description: 'Skip cooldowns on next 10 card draws',
        category: 'quality_filter',
        price: 35000,
        emoji: '⚡',
        effect: { type: 'skip_cooldown', uses: 10 }
    },
    'master_ball': {
        name: 'Master Ball',
        description: 'Skip cooldowns on next 25 card draws',
        category: 'quality_filter',
        price: 65000,
        emoji: '🏀',
        effect: { type: 'skip_cooldown', uses: 25 }
    },
    'premier_ball': {
        name: 'Premier Ball',
        description: 'Skip cooldowns on next 50 card draws',
        category: 'quality_filter',
        price: 110000,
        emoji: '⭐',
        effect: { type: 'skip_cooldown', uses: 50 }
    },

    // Container Items
    'mystery_box': {
        name: 'Mystery Box',
        description: 'Contains random valuable items worth 15000-50000 gold',
        category: 'container',
        price: 40000,
        emoji: '📦',
        effect: { type: 'container', contents: 'random_items', value_range: [15000, 50000] }
    },
    'treasure_chest': {
        name: 'Treasure Chest',
        description: 'Contains random valuable items worth 40000-120000 gold',
        category: 'container',
        price: 90000,
        emoji: '💰',
        effect: { type: 'container', contents: 'random_items', value_range: [40000, 120000] }
    },
    'legendary_vault': {
        name: 'Legendary Vault',
        description: 'Contains random valuable items worth 100000-300000 gold',
        category: 'container',
        price: 250000,
        emoji: '🏛️',
        effect: { type: 'container', contents: 'random_items', value_range: [100000, 300000] }
    },

    // Multi-Effect Items
    'lucky_coin': {
        name: 'Lucky Coin',
        description: '1.5x gold AND 1.5x luck for 2 hours',
        category: 'multi_boost',
        price: 100000,
        emoji: '🎯',
        effect: { type: 'multi_boost', gold_multiplier: 1.5, luck_multiplier: 1.5, duration: 7200 }
    },
    'sacred_orb': {
        name: 'Sacred Orb',
        description: '2x gold AND 2x luck for 1 hour',
        category: 'multi_boost',
        price: 180000,
        emoji: '🔮',
        effect: { type: 'multi_boost', gold_multiplier: 2.0, luck_multiplier: 2.0, duration: 3600 }
    },
    'divine_blessing': {
        name: 'Divine Blessing',
        description: '3x gold AND 3x luck for 30 minutes',
        category: 'multi_boost',
        price: 500000,
        emoji: '👑',
        effect: { type: 'multi_boost', gold_multiplier: 3.0, luck_multiplier: 3.0, duration: 1800 }
    },

    // Special Items (Not purchasable)
    'welcome_charm': {
        name: 'Welcome Charm',
        description: '+25% gold & 2x rare chance for 125 card draws',
        category: 'special',
        price: 0,
        emoji: '🎁',
        effect: { type: 'welcome_charm', gold_multiplier: 1.25, luck_multiplier: 2.0, uses: 125 }
    }
};

const CATEGORIES = [
    { 
        id: 'gold_boost', 
        name: 'Gold Boost Items', 
        emoji: '🪙', 
        description: 'Increase gold earned from activities',
        page: 1
    },
    { 
        id: 'luck_boost', 
        name: 'Luck Boost Items', 
        emoji: '🍀', 
        description: 'Increase chances of rare cards',
        page: 2
    },
    { 
        id: 'quality_filter', 
        name: 'Quality of Life', 
        emoji: '⚡', 
        description: 'Skip cooldowns and enhance gameplay',
        page: 3
    },
    { 
        id: 'container', 
        name: 'Container Items', 
        emoji: '📦', 
        description: 'Mystery boxes with random valuable contents',
        page: 4
    }
];

module.exports = {
    SHOP_ITEMS,
    CATEGORIES,
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Browse and purchase items from the Pokézam shop')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Filter items by category')
                .setRequired(false)
                .addChoices(
                    { name: 'Gold Boost Items', value: 'gold_boost' },
                    { name: 'Luck Boost Items', value: 'luck_boost' },
                    { name: 'Quality of Life', value: 'quality_filter' },
                    { name: 'Container Items', value: 'container' },
                    { name: 'Multi-Effect Items', value: 'multi_boost' }
                )),

    async execute(interaction, { database, userManager }) {
        try {
            await interaction.deferReply();

            const user = await userManager.getUser(interaction.user.id);

            if (!user || !user.has_started) {
                const lockedEmbed = EmbedUtils.createBaseEmbed({
                    title: '🛒 Shop Locked • Adventure Required',
                    description: 'Your trainer account is still on standby. Complete `/start` to unlock the full shop and premium progression system.',
                    color: EmbedUtils.palette.success,
                    footerText: 'Starter access unlocks gold boosts, rare chance upgrades, and premium loot routes.',
                    footerIcon: interaction.user.displayAvatarURL({ dynamic: true }),
                    fields: [
                        { name: '✨ Starter Prizes', value: '💰 1,500g starter wallet\n🎁 Welcome Charm bonus\n📦 Treasure chest unlock', inline: false },
                        { name: '🚀 Quick Unlock', value: 'Use `/start` to activate your trainer path and gain access to the market.', inline: false }
                    ]
                });

                return await interaction.editReply({ embeds: [lockedEmbed] });
            }

            const currentPage = 1; // Start with page 1 (Gold Boost)

            // Generate shop page
            const { embed, components } = await this.generateShopPage(currentPage, user, interaction.user.id);

            await interaction.editReply({
                embeds: [embed],
                components: components
            });

        } catch (error) {
            console.error('Error in shop command:', error);
            const reply = {
                content: '❌ An error occurred while loading the shop. Please try again!',
                ephemeral: true
            };

            if (interaction.deferred) {
                await interaction.editReply(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    },

    // Format effect information for YAML display
    formatEffectInfo(effect) {
        switch (effect.type) {
            case 'gold_boost':
                return `${effect.multiplier}x Gold for ${Math.floor(effect.duration / 60)} minutes`;
            case 'luck_boost':
                return `${effect.multiplier}x Rare chance for ${Math.floor(effect.duration / 60)} minutes`;
            case 'skip_cooldown':
                return `Skip cooldown for ${effect.uses} card draws`;
            case 'container':
                return `Random items worth ${effect.value_range[0]}-${effect.value_range[1]} gold`;
            case 'multi_boost':
                return `${effect.gold_multiplier}x Gold & ${effect.luck_multiplier}x Luck for ${Math.floor(effect.duration / 60)} minutes`;
            case 'welcome_charm':
                return `${effect.gold_multiplier}x Gold & ${effect.luck_multiplier}x Luck for ${effect.uses} uses`;
            default:
                return 'Special effect item';
        }
    },

    // Handle purchase button interactions
    async handlePurchase(interaction, database, userManager, itemId) {
        try {
            const item = SHOP_ITEMS[itemId];
            if (!item) {
                return await interaction.editReply({
                    content: '❌ Item not found!',
                    components: []
                });
            }

            const user = await userManager.getUser(interaction.user.id);
            
            // Check if user can afford the item
            if (user.gold < item.price) {
                return await interaction.editReply({
                    content: `❌ **Insufficient Gold!**\n\nYou need **${item.price.toLocaleString()}g** but only have **${user.gold.toLocaleString()}g**.`,
                    components: []
                });
            }

            // Deduct gold and add item to inventory
            const goldSpent = await userManager.spendGold(interaction.user.id, item.price);
            if (!goldSpent) {
                return await interaction.editReply({
                    content: '❌ **Transaction Failed!** Insufficient gold or user not found.',
                    components: []
                });
            }
            await database.addUserItem(interaction.user.id, itemId, 1);

            const successEmbed = EmbedUtils.createBaseEmbed({
                title: '✅ Purchase Successful',
                description: `**${item.emoji} ${item.name}** has been added to your inventory.`,
                color: EmbedUtils.palette.success,
                footerText: `Paid ${item.price.toLocaleString()}g • New balance ${(user.gold - item.price).toLocaleString()}g`,
                footerIcon: interaction.user.displayAvatarURL({ dynamic: true }),
                fields: [
                    { name: '📦 Item Effect', value: this.formatEffectInfo(item.effect), inline: false },
                    { name: '⚡ Next Step', value: `Use "/use ${itemId}" to activate it, or open "/inventory" to review your collection.`, inline: false }
                ]
            });

            await interaction.editReply({
                embeds: [successEmbed],
                components: []
            });

        } catch (error) {
            console.error('Error handling shop purchase:', error);
            await interaction.editReply({
                content: '❌ An error occurred while processing your purchase. Please try again!',
                components: []
            });
        }
    },

    // Generate shop page with pagination
    async generateShopPage(pageNumber, user, userId) {
        const category = CATEGORIES[pageNumber - 1];
        if (!category) {
            // If invalid page, default to page 1
            return this.generateShopPage(1, user, userId);
        }

        // Get items for the current category
        const items = Object.entries(SHOP_ITEMS).filter(([id, item]) => 
            item.category === category.id && item.price > 0
        );

        const itemSummary = items.length > 0
            ? items.map(([id, item]) => {
                const canAfford = user.gold >= item.price;
                const status = canAfford ? '✅ Affordable' : '❌ Too expensive';
                return `**${item.emoji} ${item.name}**\nPrice: **${item.price.toLocaleString()}g** • ${status}\nEffect: ${this.formatEffectInfo(item.effect)}`;
            }).join('\n\n')
            : 'No items are available in this category yet.';

        const embed = EmbedUtils.createBaseEmbed({
            title: `🏪 Pokézam Shop • ${category.name}`,
            description: `**Wallet:** ${user.gold.toLocaleString()}g\n**Category:** ${category.description}\n**Page:** ${pageNumber}/${CATEGORIES.length}`,
            color: EmbedUtils.palette.warning,
            footerText: `Elite market access • Page ${pageNumber}/${CATEGORIES.length}`,
            footerIcon: null,
            fields: [
                { name: '📦 Shop Highlights', value: itemSummary, inline: false }
            ]
        });

        // Create navigation buttons
        const navigationRow = new ActionRowBuilder();

        // Previous button
        navigationRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`shop_prev_${pageNumber}_${userId}`)
                .setLabel('⬅️ Previous')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(pageNumber === 1)
        );

        // Page indicator
        navigationRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`shop_page_indicator_${userId}`)
                .setLabel(`${pageNumber}/${CATEGORIES.length}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );

        // Next button
        navigationRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`shop_next_${pageNumber}_${userId}`)
                .setLabel('➡️ Next')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(pageNumber === CATEGORIES.length)
        );

        const components = [navigationRow];

        // Create purchase buttons for items in this category
        const purchaseButtons = [];
        items.forEach(([id, item]) => {
            const canAfford = user.gold >= item.price;
            purchaseButtons.push(
                new ButtonBuilder()
                    .setCustomId(`shop_buy_${id}_${userId}`)
                    .setLabel(`${item.emoji} ${item.name} (${item.price}g)`)
                    .setStyle(canAfford ? ButtonStyle.Success : ButtonStyle.Danger)
                    .setDisabled(!canAfford)
            );
        });

        // Add purchase buttons in rows of 4 (to leave room for navigation)
        if (purchaseButtons.length > 0) {
            for (let i = 0; i < purchaseButtons.length; i += 4) {
                const row = new ActionRowBuilder()
                    .addComponents(purchaseButtons.slice(i, i + 4));
                components.push(row);
            }
        }

        return { embed, components };
    },

    // Handle page navigation
    async handlePageNavigation(interaction, database, userManager, direction, currentPage) {
        try {
            const user = await userManager.getUser(interaction.user.id);
            
            let newPage = currentPage;
            if (direction === 'next' && currentPage < CATEGORIES.length) {
                newPage = currentPage + 1;
            } else if (direction === 'prev' && currentPage > 1) {
                newPage = currentPage - 1;
            }

            const { embed, components } = await this.generateShopPage(newPage, user, interaction.user.id);

            await interaction.update({
                embeds: [embed],
                components: components
            });

        } catch (error) {
            console.error('Error handling shop navigation:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred while navigating. Please try again!',
                    ephemeral: true
                });
            } else {
                await interaction.followUp({
                    content: '❌ An error occurred while navigating. Please try again!',
                    ephemeral: true
                });
            }
        }
    }
};
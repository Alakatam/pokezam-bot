const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Import item definitions from shop
const SHOP_ITEMS = {
    // Gold Boost Items
    'amulet_coin': {
        name: 'Amulet Coin',
        description: 'Doubles gold earned from packs for 1 hour',
        category: 'gold_boost',
        emoji: '🪙'
    },
    'golden_horseshoe': {
        name: 'Golden Horseshoe',
        description: 'Triples gold earned from packs for 30 minutes',
        category: 'gold_boost',
        emoji: '🌟'
    },
    'fortune_charm': {
        name: 'Fortune Charm',
        description: '5x gold from packs for 15 minutes',
        category: 'gold_boost',
        emoji: '🍀'
    },

    // Luck Boost Items
    'collectors_charm': {
        name: "Collector's Charm",
        description: '2x chance of rare cards for 1 hour',
        category: 'luck_boost',
        emoji: '✨'
    },
    'shiny_charm': {
        name: 'Shiny Charm',
        description: '3x chance of rare cards for 30 minutes',
        category: 'luck_boost',
        emoji: '🌈'
    },
    'rainbow_feather': {
        name: 'Rainbow Feather',
        description: '5x chance of rare cards for 15 minutes',
        category: 'luck_boost',
        emoji: '🪶'
    },

    // Quality of Life Items
    'quick_ball': {
        name: 'Quick Ball',
        description: 'Skip cooldowns on next 10 card draws',
        category: 'quality_filter',
        emoji: '⚡'
    },
    'master_ball': {
        name: 'Master Ball',
        description: 'Skip cooldowns on next 25 card draws',
        category: 'quality_filter',
        emoji: '🏀'
    },
    'premier_ball': {
        name: 'Premier Ball',
        description: 'Skip cooldowns on next 50 card draws',
        category: 'quality_filter',
        emoji: '⭐'
    },

    // Container Items
    'mystery_box': {
        name: 'Mystery Box',
        description: 'Contains random valuable items worth 200-800 gold',
        category: 'container',
        emoji: '📦'
    },
    'treasure_chest': {
        name: 'Treasure Chest',
        description: 'Contains random valuable items worth 500-2000 gold',
        category: 'container',
        emoji: '💰'
    },
    'legendary_vault': {
        name: 'Legendary Vault',
        description: 'Contains random valuable items worth 1500-5000 gold',
        category: 'container',
        emoji: '🏛️'
    },

    // Multi-Effect Items
    'lucky_coin': {
        name: 'Lucky Coin',
        description: '1.5x gold AND 1.5x luck for 2 hours',
        category: 'multi_boost',
        emoji: '🎯'
    },
    'sacred_orb': {
        name: 'Sacred Orb',
        description: '2x gold AND 2x luck for 1 hour',
        category: 'multi_boost',
        emoji: '🔮'
    },
    'divine_blessing': {
        name: 'Divine Blessing',
        description: '3x gold AND 3x luck for 30 minutes',
        category: 'multi_boost',
        emoji: '👑'
    },

    // Special Items
    'welcome_charm': {
        name: 'Welcome Charm',
        description: '+25% gold & 2x rare chance for 125 card draws',
        category: 'special',
        emoji: '🎁'
    },
    'store_key': {
        name: 'Store Key',
        description: 'Permanently unlocks the Collector Shop',
        category: 'special',
        emoji: '🔑'
    }
};

const CATEGORIES = {
    'gold_boost': { name: 'Gold Boost Items', emoji: '🪙' },
    'luck_boost': { name: 'Luck Boost Items', emoji: '🍀' },
    'quality_filter': { name: 'Quality of Life', emoji: '⚡' },
    'container': { name: 'Container Items', emoji: '📦' },
    'multi_boost': { name: 'Multi-Effect Items', emoji: '🌟' },
    'special': { name: 'Special Items', emoji: '🎁' }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('View your item inventory and manage your items')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('View another user\'s inventory (optional)')
                .setRequired(false)),

    async execute(interaction, { database, userManager }) {
        try {
            await interaction.deferReply();

            const targetUser = interaction.options.getUser('user') || interaction.user;
            const userId = targetUser.id;
            
            // Get user data and items
            const user = await userManager.getUser(userId);
            if (!user) {
                return await interaction.editReply({
                    content: '❌ User not found in the database!',
                    ephemeral: true
                });
            }

            // Check if user has started their adventure (only for self-check)
            if (userId === interaction.user.id && !user.has_started) {
                return await interaction.editReply({
                    embeds: [EmbedUtils.createBaseEmbed({
                        author: { name: `${interaction.user.displayName}'s Inventory`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) },
                        title: '🔒 Trainer Bag Locked',
                        description: `**Welcome, ${interaction.user.displayName}!** You haven't started your adventure yet.\n\nType **/start** to receive your starter bag with starting gold, treasure chest, and welcome charm!`,
                        color: EmbedUtils.palette.brand,
                        footerText: 'Type /start to unlock your inventory',
                        footerIcon: interaction.user.displayAvatarURL({ dynamic: true }),
                        fields: [
                            { name: '🎁 Starter Rewards', value: '• **1,500** 🪙 Starting Gold\n• **Treasure Chest** 📦\n• **Welcome Charm** 🍀 (125 Uses)', inline: true },
                            { name: '🎒 Bag Features', value: '• Boost Items & Charms\n• Container Chests\n• Quality of Life Perks', inline: true }
                        ]
                    })]
                });
            }

            const userItems = await database.getAllUserItems(userId);
            
            // Create sleek modern inventory display
            const fields = [];
            fields.push({
                name: '👛 Wallet Summary',
                value: `• **Gold Balance:** \`${user.gold.toLocaleString()}\` 🪙\n• **Items Owned:** \`${userItems.length}\`\n• **Rank:** \`${user.level >= 10 ? 'Veteran Trainer' : 'Novice Trainer'}\``,
                inline: false
            });

            if (userItems.length === 0) {
                fields.push({
                    name: '📦 Inventory Contents',
                    value: 'Your inventory is currently empty! Visit the **/shop** to purchase boost items, charms, and chests.',
                    inline: false
                });
            } else {
                // Group items by category
                const groupedItems = {};
                userItems.forEach(userItem => {
                    const item = SHOP_ITEMS[userItem.item_id];
                    if (!item) return;

                    if (!groupedItems[item.category]) {
                        groupedItems[item.category] = [];
                    }
                    groupedItems[item.category].push({ ...userItem, ...item });
                });

                Object.entries(groupedItems).forEach(([categoryId, categoryItems]) => {
                    const categoryInfo = CATEGORIES[categoryId] || { name: 'Other Items', emoji: '📦' };
                    const itemList = categoryItems.map(item => {
                        const qty = item.quantity > 1 ? ` \`(x${item.quantity})\`` : '';
                        return `• **${item.emoji} ${item.name}**${qty}\n  *${item.description}* \`(/use ${item.item_id})\``;
                    }).join('\n\n');

                    fields.push({
                        name: `${categoryInfo.emoji} ${categoryInfo.name}`,
                        value: itemList,
                        inline: false
                    });
                });
            }

            const embed = EmbedUtils.createBaseEmbed({
                author: { name: `${targetUser.displayName}'s Trainer Inventory`, iconURL: targetUser.displayAvatarURL({ dynamic: true }) },
                title: '🎒 Trainer Inventory',
                description: 'Manage your active items, charms, and boosters below.',
                color: EmbedUtils.palette.brand,
                thumbnail: targetUser.displayAvatarURL({ dynamic: true }),
                footerText: 'Use /use <item_id> to activate an item • Pokézam',
                footerIcon: targetUser.displayAvatarURL({ dynamic: true }),
                fields
            });

            // Create action buttons if viewing own inventory
            const components = [];
            if (targetUser.id === interaction.user.id && userItems.length > 0) {
                // Filter for usable items and create quick-use buttons for first 3 items
                const usableItems = userItems.filter(userItem => {
                    const item = SHOP_ITEMS[userItem.item_id];
                    return item && userItem.item_id !== 'store_key' && userItem.quantity > 0;
                }).slice(0, 3);

                const buttons = usableItems.map(userItem => {
                    const item = SHOP_ITEMS[userItem.item_id];
                    const quantityDisplay = userItem.quantity > 1 ? ` (${userItem.quantity})` : '';
                    
                    return new ButtonBuilder()
                        .setCustomId(`use_item_${userItem.item_id}_${userId}`)
                        .setLabel(`${item.emoji} Use${quantityDisplay}`)
                        .setStyle(ButtonStyle.Primary);
                });

                if (buttons.length > 0) {
                    // Add refresh button
                    buttons.push(
                        new ButtonBuilder()
                            .setCustomId(`refresh_inventory_${userId}`)
                            .setLabel('🔄 Refresh')
                            .setStyle(ButtonStyle.Secondary)
                    );

                    const actionRow = new ActionRowBuilder().addComponents(buttons);
                    components.push(actionRow);
                }
            }

            await interaction.editReply({
                embeds: [embed],
                components
            });

        } catch (error) {
            console.error('Error in inventory command:', error);
            const reply = {
                content: '❌ An error occurred while loading the inventory. Please try again!',
                ephemeral: true
            };

            if (interaction.deferred) {
                await interaction.editReply(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    }
};
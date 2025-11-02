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
                const yamlContent = `\`\`\`yaml
#═══════════════════════════════════════════════════
# 🎒 INVENTORY SYSTEM LOCKED - BEGIN YOUR JOURNEY!
#═══════════════════════════════════════════════════

inventory access       : "RESTRICTED"
current items          : "None - Adventure not started"
trainer bag status     : "Empty - Awaiting onboarding"

#───────────────────────────────────────────────────
# 🎁 YOUR STARTER INVENTORY AWAITS
#───────────────────────────────────────────────────

starter package includes:
  welcome charm:
    type               : "Multi-boost item"  
    uses               : "125 charges"
    effect             : "Boosts all activities!"
    
  initial resources:
    starting gold      : "500 🪙 coins"
    trainer kit        : "Essential items"
    inventory slots    : "Full access unlocked"

#───────────────────────────────────────────────────
# 🌟 INVENTORY FEATURES TO UNLOCK
#───────────────────────────────────────────────────

item management:
  view items           : "See all owned items"
  active effects       : "Check boost status" 
  usage tracking       : "Monitor item consumption"

item categories:
  gold boosts          : "Earn more coins faster"
  luck boosts          : "Increase rare card chances"
  special items        : "Unique effects & surprises"

#───────────────────────────────────────────────────
# 🚀 START COLLECTING NOW!
#───────────────────────────────────────────────────

unlock command         : "Type '/start' to get your bag!"
adventure awaits       : "Items + Cards + Quests + More!"

#═══════════════════════════════════════════════════
\`\`\``;

                return await interaction.editReply({
                    embeds: [{
                        title: '🎒 Inventory System Locked - Begin Your Journey!',
                        description: yamlContent,
                        color: 0x9932cc,
                        timestamp: new Date().toISOString(),
                        footer: {
                            text: `${interaction.user.username}, your trainer bag awaits!`,
                            icon_url: interaction.user.displayAvatarURL()
                        }
                    }]
                });
            }

            const userItems = await database.getAllUserItems(userId);
            
            // Debug: Log user items to help troubleshoot
            console.log(`Inventory Debug - User ${userId} items:`, userItems.map(item => `${item.item_id} (qty: ${item.quantity})`));

            // Create YAML inventory display
            let yamlDescription = '```yaml\n';
            yamlDescription += '#═══════════════════════════════════════════════════\n';
            yamlDescription += `# 🎒 ${targetUser.displayName.toUpperCase()}'S INVENTORY\n`;
            yamlDescription += '#═══════════════════════════════════════════════════\n\n';
            
            yamlDescription += '💰 WALLET INFO:\n';
            yamlDescription += `   Current Balance    : ${user.gold.toLocaleString()} Gold\n`;
            yamlDescription += `   Items Owned        : ${userItems.length}\n`;
            yamlDescription += `   Account Type       : "${user.level >= 10 ? 'Veteran Trainer' : 'Novice Trainer'}"\n\n`;

            if (userItems.length === 0) {
                yamlDescription += '📦 INVENTORY STATUS:\n';
                yamlDescription += '   Status             : "EMPTY"\n';
                yamlDescription += '   Message            : "No items found"\n';
                yamlDescription += '   Suggestion         : "Visit /shop to purchase items"\n\n';
            } else {
                // Group items by category
                const groupedItems = {};
                userItems.forEach(userItem => {
                    const item = SHOP_ITEMS[userItem.item_id];
                    if (!item) {
                        console.log(`Unknown item in inventory: ${userItem.item_id}`); // Debug log
                        return;
                    }

                    if (!groupedItems[item.category]) {
                        groupedItems[item.category] = [];
                    }
                    groupedItems[item.category].push({ ...userItem, ...item });
                });

                yamlDescription += '📦 INVENTORY CONTENTS:\n\n';

                // Display items by category
                Object.entries(groupedItems).forEach(([categoryId, categoryItems]) => {
                    const categoryInfo = CATEGORIES[categoryId];
                    yamlDescription += `${categoryInfo.emoji} ${categoryInfo.name.toUpperCase()}:\n`;
                    
                    categoryItems.forEach(item => {
                        const quantityText = item.quantity > 1 ? ` (x${item.quantity})` : '';
                        yamlDescription += `   - Item Name        : "${item.emoji} ${item.name}${quantityText}"\n`;
                        yamlDescription += `     Description      : "${item.description}"\n`;
                        yamlDescription += `     Item ID          : "${item.item_id}"\n`;
                        yamlDescription += `     Category         : "${item.category}"\n`;
                    });
                    yamlDescription += '\n';
                });
            }

            yamlDescription += '💡 USAGE INSTRUCTIONS:\n';
            yamlDescription += '   Use Command        : "/use <item_name>"\n';
            yamlDescription += '   Active Effects     : "/active-boosts"\n';
            yamlDescription += '   Shop Visit         : "/shop"\n\n';
            yamlDescription += '#═══════════════════════════════════════════════════\n';
            yamlDescription += '```';

            const embed = new EmbedBuilder()
                .setTitle(`🎒 ${targetUser.displayName}'s Inventory`)
                .setDescription(yamlDescription)
                .setColor('#4A90E2')
                .setTimestamp()
                .setFooter({ 
                    text: 'Inventory System • Use /use to activate items',
                    iconURL: targetUser.displayAvatarURL({ dynamic: true })
                });

            // Create action buttons if viewing own inventory
            const components = [];
            if (targetUser.id === interaction.user.id && userItems.length > 0) {
                // Filter for usable items and create quick-use buttons for first 3 items
                const usableItems = userItems.filter(userItem => {
                    const item = SHOP_ITEMS[userItem.item_id];
                    return item && userItem.quantity > 0;
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
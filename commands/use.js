const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('use')
        .setDescription('🎒 Use items from your inventory to gain special effects')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('Select an item to use')
                .setRequired(true)
                .addChoices(
                    // 💰 Gold Boost Items
                    { name: '🪙 Amulet Coin - 2x Gold for 1 hour', value: 'amulet_coin' },
                    { name: '� Golden Horseshoe - 3x Gold for 30 minutes', value: 'golden_horseshoe' },
                    { name: '🍀 Fortune Charm - 5x Gold for 15 minutes', value: 'fortune_charm' },
                    { name: '🪙 Lucky Coin - 1.5x Gold & Luck for 2 hours', value: 'lucky_coin' },
                    
                    // ✨ Luck Boost Items
                    { name: '🍀 Collector\'s Charm - 2x Rare chance for 1 hour', value: 'collectors_charm' },
                    { name: '✨ Shiny Charm - 3x Rare chance for 30 minutes', value: 'shiny_charm' },
                    { name: '🌈 Rainbow Feather - 5x Rare chance for 15 minutes', value: 'rainbow_feather' },
                    { name: '🔮 Sacred Orb - 2x Gold & Luck for 1 hour', value: 'sacred_orb' },
                    
                    // ⚙️ Quality of Life Items
                    { name: '🏃 Quick Ball - Skip cooldowns for 10 draws', value: 'quick_ball' },
                    { name: '⚫ Master Ball - Skip cooldowns for 25 draws', value: 'master_ball' },
                    { name: '⚪ Premier Ball - Skip cooldowns for 50 draws', value: 'premier_ball' },
                    { name: '� Divine Blessing - 3x Gold & Luck for 30 min', value: 'divine_blessing' },
                    
                    // 🎁 Container Items
                    { name: '❓ Mystery Box - Random items (200-800g value)', value: 'mystery_box' },
                    { name: '📦 Treasure Chest - Random items (500-2000g value)', value: 'treasure_chest' },
                    { name: '🏆 Legendary Vault - Random items (1500-5000g value)', value: 'legendary_vault' }
                )
        ),

    async execute(interaction, { database, userManager, cardManager, questManager }) {
        try {
            await interaction.deferReply();

            const userId = interaction.user.id;
            const itemId = interaction.options.getString('item');

            // Ensure user exists
            let user = await userManager.getUser(userId);
            if (!user) {
                user = await userManager.createUser(userId, interaction.user.username);
            }

            // Check if user has the item
            const hasItem = await this.checkUserHasItem(database, userId, itemId);
            if (!hasItem) {
                return await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        '❌ Item Not Found',
                        `You don't have **${this.getItemDisplayName(itemId)}** in your inventory!\n\n💡 **Tip**: Visit \`/shop\` to purchase items or check \`/inventory\` to see what you own.`
                    )]
                });
            }

            // Check for conflicting active effects
            const conflicts = await this.checkActiveConflicts(database, userId, itemId);
            if (conflicts.length > 0) {
                return await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        '⚠️ Effect Conflict',
                        `You already have a similar effect active: **${conflicts.join(', ')}**\n\n⏰ Wait for it to expire or use a different item type.`
                    )]
                });
            }

            // Use the item
            const result = await this.useItem(database, userId, itemId, userManager);
            
            if (result.success) {
                // Remove item from inventory
                await this.removeItemFromInventory(database, userId, itemId);
                
                // Display success message
                await interaction.editReply({
                    embeds: [this.createUseItemEmbed(interaction.user, itemId, result)]
                });
            } else {
                await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        '❌ Item Use Failed',
                        result.message || 'Failed to use item. Please try again.'
                    )]
                });
            }

        } catch (error) {
            console.error('Error in use command:', error);
            await interaction.editReply({
                embeds: [EmbedUtils.createErrorEmbed(
                    'Use Item Error',
                    'An error occurred while using the item. Please try again!'
                )]
            });
        }
    },

    async checkUserHasItem(database, userId, itemId) {
        const item = await database.get(
            'SELECT * FROM user_items WHERE user_id = ? AND item_id = ? AND quantity > 0',
            [userId, itemId]
        );
        return !!item;
    },

    async checkActiveConflicts(database, userId, itemId) {
        const itemCategory = this.getItemCategory(itemId);
        const now = Math.floor(Date.now() / 1000);
        
        // Check for conflicting active effects
        const conflicts = await database.all(`
            SELECT effect_type FROM active_effects 
            WHERE user_id = ? AND category = ? AND (expires_at > ? OR uses_remaining > 0)
        `, [userId, itemCategory, now]);
        
        return conflicts.map(c => c.effect_type);
    },

    async useItem(database, userId, itemId, userManager) {
        const itemConfig = this.getItemConfig(itemId);
        if (!itemConfig) {
            return { success: false, message: 'Unknown item configuration.' };
        }

        const now = Math.floor(Date.now() / 1000);
        let expiresAt = null;
        let usesRemaining = null;

        if (itemConfig.duration) {
            expiresAt = now + itemConfig.duration;
        }
        if (itemConfig.uses) {
            usesRemaining = itemConfig.uses;
        }

        // Handle special items with immediate effects
        if (itemConfig.immediate) {
            const immediateResult = await this.handleImmediateEffect(database, userId, itemId, userManager);
            return immediateResult;
        }

        // Handle multi-effect items (add separate effects for gold and luck)
        if (itemConfig.category === 'multi_boost') {
            // Add gold boost effect
            await database.run(`
                INSERT INTO active_effects (user_id, effect_type, category, multiplier, expires_at, uses_remaining, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [userId, `${itemId}_gold`, 'gold_boost', itemConfig.goldMultiplier, expiresAt, usesRemaining, now]);
            
            // Add luck boost effect
            await database.run(`
                INSERT INTO active_effects (user_id, effect_type, category, multiplier, expires_at, uses_remaining, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [userId, `${itemId}_luck`, 'luck_boost', itemConfig.luckMultiplier, expiresAt, usesRemaining, now]);
        } else {
            // Add single effect to active_effects table
            await database.run(`
                INSERT INTO active_effects (user_id, effect_type, category, multiplier, expires_at, uses_remaining, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [userId, itemId, itemConfig.category, itemConfig.multiplier || itemConfig.goldMultiplier || 1.0, expiresAt, usesRemaining, now]);
        }

        return {
            success: true,
            duration: itemConfig.duration,
            uses: itemConfig.uses,
            description: itemConfig.description
        };
    },

    async handleImmediateEffect(database, userId, itemId, userManager) {
        switch (itemId) {
            case 'mystery_box':
                return await this.openMysteryBox(database, userId, userManager);
            case 'treasure_chest':
                return await this.openTreasureChest(database, userId, userManager);
            case 'legendary_vault':
                return await this.openLegendaryVault(database, userId, userManager);
            default:
                return { success: false, message: 'Unknown immediate effect item.' };
        }
    },

    async openMysteryBox(database, userId, userManager) {
        const rewards = [];
        const totalValue = 200 + Math.floor(Math.random() * 600); // 200-800g value
        
        // 70% chance for gold, 30% chance for items
        if (Math.random() < 0.7) {
            const goldAmount = Math.floor(totalValue * 0.8);
            await userManager.addGold(userId, goldAmount);
            rewards.push(`${goldAmount} Gold`);
        } else {
            // Add random items
            const possibleItems = ['amulet_coin', 'collectors_charm', 'quick_ball'];
            const randomItem = possibleItems[Math.floor(Math.random() * possibleItems.length)];
            await this.addItemToInventory(database, userId, randomItem, 1);
            rewards.push(this.getItemDisplayName(randomItem));
        }
        
        return {
            success: true,
            containerRewards: rewards,
            description: `Mystery Box opened! You received: ${rewards.join(', ')}`
        };
    },

    async openTreasureChest(database, userId, userManager) {
        const rewards = [];
        const totalValue = 500 + Math.floor(Math.random() * 1500); // 500-2000g value
        
        // Always give some gold
        const goldAmount = Math.floor(totalValue * 0.6);
        await userManager.addGold(userId, goldAmount);
        rewards.push(`${goldAmount} Gold`);
        
        // 60% chance for additional item
        if (Math.random() < 0.6) {
            const possibleItems = ['collectors_charm', 'shiny_charm', 'amulet_coin', 'master_ball'];
            const randomItem = possibleItems[Math.floor(Math.random() * possibleItems.length)];
            await this.addItemToInventory(database, userId, randomItem, 1);
            rewards.push(this.getItemDisplayName(randomItem));
        }
        
        return {
            success: true,
            containerRewards: rewards,
            description: `Treasure Chest opened! You received: ${rewards.join(', ')}`
        };
    },

    async openLegendaryVault(database, userId, userManager) {
        const rewards = [];
        const totalValue = 1500 + Math.floor(Math.random() * 3500); // 1500-5000g value
        
        // Always give substantial gold
        const goldAmount = Math.floor(totalValue * 0.5);
        await userManager.addGold(userId, goldAmount);
        rewards.push(`${goldAmount} Gold`);
        
        // Always give at least 1 premium item
        const premiumItems = ['rainbow_feather', 'fortune_charm', 'sacred_orb', 'divine_blessing'];
        const randomItem = premiumItems[Math.floor(Math.random() * premiumItems.length)];
        await this.addItemToInventory(database, userId, randomItem, 1);
        rewards.push(this.getItemDisplayName(randomItem));
        
        // 50% chance for second item
        if (Math.random() < 0.5) {
            const secondItem = premiumItems[Math.floor(Math.random() * premiumItems.length)];
            await this.addItemToInventory(database, userId, secondItem, 1);
            rewards.push(this.getItemDisplayName(secondItem));
        }
        
        return {
            success: true,
            containerRewards: rewards,
            description: `Legendary Vault opened! You received: ${rewards.join(', ')}`
        };
    },



    async removeItemFromInventory(database, userId, itemId) {
        // First, decrease the quantity by 1
        const result = await database.run(`
            UPDATE user_items SET quantity = quantity - 1 
            WHERE user_id = ? AND item_id = ? AND quantity > 0
        `, [userId, itemId]);

        // If the update was successful, check if quantity is now 0 and remove the row
        if (result.changes > 0) {
            await database.run(`
                DELETE FROM user_items 
                WHERE user_id = ? AND item_id = ? AND quantity <= 0
            `, [userId, itemId]);
        }

        console.log(`Removed item ${itemId} for user ${userId}. Rows affected: ${result.changes}`);
    },

    async addItemToInventory(database, userId, itemId, quantity) {
        await database.run(`
            INSERT INTO user_items (user_id, item_id, quantity) 
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + ?
        `, [userId, itemId, quantity, quantity]);
    },

    createUseItemEmbed(user, itemId, result) {
        const itemConfig = this.getItemConfig(itemId);
        const itemName = this.getItemDisplayName(itemId);
        
        let yamlDescription = '```yaml\n';
        yamlDescription += '#═══════════════════════════════════════════════════\n';
        yamlDescription += `# ✨ ITEM ACTIVATED\n`;
        yamlDescription += '#═══════════════════════════════════════════════════\n\n';
        
        yamlDescription += '🎒 ITEM DETAILS:\n';
        yamlDescription += `   Item Name          : "${itemName}"\n`;
        yamlDescription += `   Effect Type        : "${itemConfig.category.toUpperCase()}"\n`;
        yamlDescription += `   Status             : "ACTIVE"\n\n`;
        
        if (result.duration) {
            const hours = Math.floor(result.duration / 3600);
            const minutes = Math.floor((result.duration % 3600) / 60);
            yamlDescription += '⏰ DURATION INFO:\n';
            yamlDescription += `   Active Duration    : ${hours > 0 ? `${hours}h ` : ''}${minutes}m\n`;
            yamlDescription += `   Expires At         : ${new Date(Date.now() + result.duration * 1000).toLocaleTimeString()}\n`;
        }
        
        if (result.uses) {
            yamlDescription += '🔢 USAGE INFO:\n';
            yamlDescription += `   Uses Available     : ${result.uses}\n`;
            yamlDescription += `   Consumption        : "Per Command"\n`;
        }
        
        if (result.containerRewards) {
            yamlDescription += '🎁 CONTAINER REWARDS:\n';
            result.containerRewards.forEach((reward, i) => {
                yamlDescription += `   Reward ${i + 1}           : "${reward}"\n`;
            });
        }
        
        yamlDescription += '\n💡 EFFECT DESCRIPTION:\n';
        yamlDescription += `   "${result.description || itemConfig.description}"\n\n`;
        yamlDescription += '#═══════════════════════════════════════════════════\n';
        yamlDescription += '```';

        return new EmbedBuilder()
            .setTitle(`✨ ${itemName} Activated!`)
            .setDescription(yamlDescription)
            .setColor('#FFD700')
            .setTimestamp()
            .setFooter({ 
                text: 'Use /active_boosts to see all your active effects',
                iconURL: user.displayAvatarURL({ dynamic: true })
            });
    },

    getItemDisplayName(itemId) {
        const names = {
            // Gold Boost Items
            'amulet_coin': '🪙 Amulet Coin',
            'golden_horseshoe': '� Golden Horseshoe',
            'fortune_charm': '� Fortune Charm',
            // Luck Boost Items
            'collectors_charm': '🍀 Collector\'s Charm',
            'shiny_charm': '✨ Shiny Charm',
            'rainbow_feather': '🌈 Rainbow Feather',
            // Quality of Life Items
            'quick_ball': '� Quick Ball',
            'master_ball': '⚫ Master Ball',
            'premier_ball': '⚪ Premier Ball',
            // Container Items
            'mystery_box': '❓ Mystery Box',
            'treasure_chest': '� Treasure Chest',
            'legendary_vault': '🏆 Legendary Vault',
            // Multi-Effect Items
            'lucky_coin': '🪙 Lucky Coin',
            'sacred_orb': '� Sacred Orb',
            'divine_blessing': '🙏 Divine Blessing',
            // Special Items
            'welcome_charm': '� Welcome Charm'
        };
        return names[itemId] || itemId;
    },

    getItemCategory(itemId) {
        const categories = {
            // Gold Boost Items
            'amulet_coin': 'gold_boost',
            'golden_horseshoe': 'gold_boost',
            'fortune_charm': 'gold_boost',
            // Luck Boost Items
            'collectors_charm': 'luck_boost',
            'shiny_charm': 'luck_boost',
            'rainbow_feather': 'luck_boost',
            // Quality of Life Items
            'quick_ball': 'quality_filter',
            'master_ball': 'quality_filter',
            'premier_ball': 'quality_filter',
            // Container Items
            'mystery_box': 'immediate',
            'treasure_chest': 'immediate',
            'legendary_vault': 'immediate',
            // Multi-Effect Items
            'lucky_coin': 'multi_boost',
            'sacred_orb': 'multi_boost',
            'divine_blessing': 'multi_boost',
            // Special Items
            'welcome_charm': 'special'
        };
        return categories[itemId] || 'misc';
    },

    getItemConfig(itemId) {
        const configs = {
            // Gold Boost Items
            'amulet_coin': { category: 'gold_boost', multiplier: 2.0, duration: 3600, description: 'Doubles gold earned from packs for 1 hour' },
            'golden_horseshoe': { category: 'gold_boost', multiplier: 3.0, duration: 1800, description: 'Triples gold earned from packs for 30 minutes' },
            'fortune_charm': { category: 'gold_boost', multiplier: 5.0, duration: 900, description: '5x gold from packs for 15 minutes' },
            
            // Luck Boost Items
            'collectors_charm': { category: 'luck_boost', multiplier: 2.0, duration: 3600, description: '2x chance of rare cards for 1 hour' },
            'shiny_charm': { category: 'luck_boost', multiplier: 3.0, duration: 1800, description: '3x chance of rare cards for 30 minutes' },
            'rainbow_feather': { category: 'luck_boost', multiplier: 5.0, duration: 900, description: '5x chance of rare cards for 15 minutes' },
            
            // Quality of Life Items
            'quick_ball': { category: 'quality_filter', multiplier: 1.0, uses: 10, description: 'Skip cooldowns on next 10 card draws' },
            'master_ball': { category: 'quality_filter', multiplier: 1.0, uses: 25, description: 'Skip cooldowns on next 25 card draws' },
            'premier_ball': { category: 'quality_filter', multiplier: 1.0, uses: 50, description: 'Skip cooldowns on next 50 card draws' },
            
            // Container Items
            'mystery_box': { category: 'immediate', immediate: true, description: 'Contains random valuable items worth 200-800 gold' },
            'treasure_chest': { category: 'immediate', immediate: true, description: 'Contains random valuable items worth 500-2000 gold' },
            'legendary_vault': { category: 'immediate', immediate: true, description: 'Contains random valuable items worth 1500-5000 gold' },
            
            // Multi-Effect Items
            'lucky_coin': { category: 'multi_boost', goldMultiplier: 1.5, luckMultiplier: 1.5, duration: 7200, description: '1.5x gold AND 1.5x luck for 2 hours' },
            'sacred_orb': { category: 'multi_boost', goldMultiplier: 2.0, luckMultiplier: 2.0, duration: 3600, description: '2x gold AND 2x luck for 1 hour' },
            'divine_blessing': { category: 'multi_boost', goldMultiplier: 3.0, luckMultiplier: 3.0, duration: 1800, description: '3x gold AND 3x luck for 30 minutes' },
            
            // Special Items
            'welcome_charm': { category: 'special', goldMultiplier: 1.25, luckMultiplier: 2.0, uses: 125, description: '+25% gold & 2x rare chance for 125 card draws' }
        };
        return configs[itemId];
    }
};
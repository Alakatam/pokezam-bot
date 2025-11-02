const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Database = require('../database/Database');
const CardManager = require('../database/CardManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('card-info')
        .setDescription('Get detailed information about a Pokemon card')
        .addStringOption(option =>
            option.setName('card_name')
                .setDescription('The name of the card to look up')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const cardName = interaction.options.getString('card_name');
            
            const db = new Database();
            await db.connect();
            const cardManager = new CardManager(db);

            // Search for cards matching the name
            const matchingCards = await cardManager.searchCards(cardName);

            if (matchingCards.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setTitle('❌ Card Not Found')
                    .setDescription(`No cards found matching "${cardName}".\n\n💡 **Try searching with:**\n• Partial names (e.g., "Pika" for Pikachu)\n• Full card names (e.g., "Charizard")\n• Different spellings or variations`)
                    .setFooter({ text: 'Pokézam • Card database contains 14,926 cards' });

                await interaction.editReply({ embeds: [embed] });
                return;
            }

            // If multiple cards found, show the first exact match or the first result
            let selectedCard = matchingCards.find(card => 
                card.name.toLowerCase() === cardName.toLowerCase()
            ) || matchingCards[0];

            // Get ownership statistics
            const ownershipStats = await this.getCardOwnershipStats(db, selectedCard.id);
            const totalUsers = await this.getTotalUsers(db);

            // Get Master Set variant information
            const variants = this.getAvailableVariants(selectedCard);

            // Create the detailed card info embed
            const embed = new EmbedBuilder()
                .setColor(this.getRarityColor(selectedCard.rarity))
                .setTitle(`🎴 ${selectedCard.name}`)
                .setDescription(this.getCardDescription(selectedCard));

            // Add card image if available
            if (selectedCard.image_large || selectedCard.image_small) {
                embed.setThumbnail(selectedCard.image_large || selectedCard.image_small);
            }

            // Basic card information
            embed.addFields([
                {
                    name: '📊 Basic Information',
                    value: [
                        `**Set:** ${selectedCard.set_name || 'Unknown'}`,
                        `**Rarity:** ${this.getRarityDisplay(selectedCard.rarity)}`,
                        `**Number:** ${selectedCard.number || 'N/A'}`,
                        `**Unlock Level:** Level ${selectedCard.unlock_level || 1}+`
                    ].join('\n'),
                    inline: true
                }
            ]);

            // Card stats (if available)
            if (selectedCard.hp || selectedCard.types || selectedCard.retreat_cost) {
                const statsValue = [];
                if (selectedCard.hp) statsValue.push(`**HP:** ${selectedCard.hp}`);
                if (selectedCard.types) {
                    try {
                        const types = JSON.parse(selectedCard.types);
                        if (Array.isArray(types) && types.length > 0) {
                            statsValue.push(`**Type(s):** ${types.join(', ')}`);
                        }
                    } catch (e) {
                        // Handle non-JSON types
                        if (selectedCard.types !== 'null') {
                            statsValue.push(`**Type:** ${selectedCard.types}`);
                        }
                    }
                }
                if (selectedCard.retreat_cost !== null) {
                    statsValue.push(`**Retreat Cost:** ${selectedCard.retreat_cost}`);
                }

                if (statsValue.length > 0) {
                    embed.addFields([{
                        name: '⚡ Card Stats',
                        value: statsValue.join('\n'),
                        inline: true
                    }]);
                }
            }

            // Master Set variants available
            if (variants.length > 0) {
                embed.addFields([{
                    name: '✨ Available Variants',
                    value: variants.map(variant => `• ${variant}`).join('\n'),
                    inline: false
                }]);
            }

            // Ownership statistics
            const ownershipPercentage = totalUsers > 0 ? ((ownershipStats.owners / totalUsers) * 100).toFixed(1) : '0.0';
            
            embed.addFields([{
                name: '👥 Ownership Statistics',
                value: [
                    `**Owners:** ${ownershipStats.owners}/${totalUsers} users (${ownershipPercentage}%)`,
                    `**Total Copies:** ${ownershipStats.totalCopies}`,
                    `**Rarity Status:** ${this.getOwnershipRarityStatus(ownershipStats.owners, totalUsers)}`
                ].join('\n'),
                inline: false
            }]);

            // Estimated value based on rarity and ownership
            const estimatedValue = this.calculateEstimatedValue(selectedCard, ownershipStats.owners, totalUsers);
            embed.addFields([{
                name: '💰 Estimated Value',
                value: `${estimatedValue.gold} gold\n*${estimatedValue.description}*`,
                inline: true
            }]);

            // Collection tips
            embed.addFields([{
                name: '🎯 Collection Tips',
                value: this.getCollectionTips(selectedCard),
                inline: true
            }]);

            // If multiple matches were found, show alternatives
            if (matchingCards.length > 1) {
                const alternatives = matchingCards
                    .filter(card => card.id !== selectedCard.id)
                    .slice(0, 5)
                    .map(card => `• ${card.name} (${card.set_name})`)
                    .join('\n');

                if (alternatives) {
                    embed.addFields([{
                        name: `🔍 Other matches for "${cardName}" (${matchingCards.length - 1} more)`,
                        value: alternatives,
                        inline: false
                    }]);
                }
            }

            embed.setFooter({ 
                text: `Pokézam Card Info • Database ID: ${selectedCard.id} • Updated ${this.getLastUpdatedText(selectedCard.last_updated)}` 
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Card info command error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('❌ Error')
                .setDescription('There was an error looking up the card information. Please try again.')
                .setFooter({ text: 'If this persists, please contact support' });

            await interaction.editReply({ embeds: [errorEmbed] });
        } finally {
            if (db) {
                db.close();
            }
        }
    },

    // Helper methods
    async getCardOwnershipStats(db, cardId) {
        const result = await db.get(
            `SELECT 
                COUNT(DISTINCT user_id) as owners,
                SUM(quantity) as totalCopies
            FROM user_cards 
            WHERE card_id = ?`,
            [cardId]
        );

        return {
            owners: result?.owners || 0,
            totalCopies: result?.totalCopies || 0
        };
    },

    async getTotalUsers(db) {
        const result = await db.get('SELECT COUNT(*) as total FROM users WHERE has_started = 1');
        return result?.total || 0;
    },

    getAvailableVariants(card) {
        const variants = [];
        if (card.variant_normal) variants.push('🎴 Normal');
        if (card.variant_reverse) variants.push('🔄 Reverse Holo');
        if (card.variant_holo) variants.push('✨ Holographic');
        if (card.variant_first_edition) variants.push('🥇 First Edition');
        if (card.variant_promo) variants.push('🎁 Promo');
        
        return variants.length > 0 ? variants : ['🎴 Normal'];
    },

    getRarityColor(rarity) {
        const rarityColors = {
            'Common': '#95A5A6',
            'Uncommon': '#3498DB',
            'Rare': '#E74C3C',
            'Holo Rare': '#9B59B6',
            'Ultra Rare': '#F39C12',
            'Secret Rare': '#E67E22',
            'Legendary': '#FFD700'
        };
        return rarityColors[rarity] || '#95A5A6';
    },

    getRarityDisplay(rarity) {
        const rarityEmojis = {
            'Common': '📄 Common',
            'Uncommon': '🎴 Uncommon',
            'Rare': '⭐ Rare',
            'Holo Rare': '✨ Holo Rare',
            'Ultra Rare': '💎 Ultra Rare',
            'Secret Rare': '🏆 Secret Rare',
            'Legendary': '👑 Legendary'
        };
        return rarityEmojis[rarity] || `${rarity}`;
    },

    getCardDescription(card) {
        const descriptions = [];
        
        if (card.flavor_text && card.flavor_text !== 'null') {
            try {
                descriptions.push(`*"${card.flavor_text}"*`);
            } catch (e) {
                // Handle flavor text parsing
            }
        }

        if (card.artist && card.artist !== 'null') {
            descriptions.push(`🎨 **Artist:** ${card.artist}`);
        }

        if (descriptions.length === 0) {
            descriptions.push(`A ${card.rarity} card from the ${card.set_name} set.`);
        }

        return descriptions.join('\n\n');
    },

    getOwnershipRarityStatus(owners, totalUsers) {
        if (totalUsers === 0) return 'Unknown';
        
        const percentage = (owners / totalUsers) * 100;
        
        if (percentage === 0) return '🌟 Never Owned - Legendary Status!';
        if (percentage < 1) return '💎 Extremely Rare - Less than 1% own this!';
        if (percentage < 5) return '🏆 Very Rare - Only a few collectors have this';
        if (percentage < 15) return '⭐ Rare - Uncommon in collections';
        if (percentage < 30) return '🎴 Moderate - Decent rarity';
        if (percentage < 50) return '📄 Common - Many collectors have this';
        return '🎯 Very Common - Widely collected';
    },

    calculateEstimatedValue(card, owners, totalUsers) {
        let baseValue = 10; // Base gold value
        
        // Rarity multiplier
        const rarityMultipliers = {
            'Common': 1,
            'Uncommon': 2,
            'Rare': 5,
            'Holo Rare': 15,
            'Ultra Rare': 50,
            'Secret Rare': 150,
            'Legendary': 300
        };
        
        baseValue *= (rarityMultipliers[card.rarity] || 1);
        
        // Ownership scarcity multiplier
        if (totalUsers > 0) {
            const ownershipPercentage = (owners / totalUsers) * 100;
            if (ownershipPercentage === 0) baseValue *= 10; // Never owned
            else if (ownershipPercentage < 1) baseValue *= 5; // Extremely rare
            else if (ownershipPercentage < 5) baseValue *= 3; // Very rare
            else if (ownershipPercentage < 15) baseValue *= 2; // Rare
        }
        
        // Master Set variant bonus
        let variantBonus = '';
        if (card.variant_first_edition) {
            baseValue *= 1.5;
            variantBonus = ' (First Edition bonus)';
        } else if (card.variant_holo) {
            baseValue *= 1.2;
            variantBonus = ' (Holo bonus)';
        }
        
        const finalValue = Math.round(baseValue);
        
        return {
            gold: finalValue,
            description: `Based on ${card.rarity} rarity and ownership scarcity${variantBonus}`
        };
    },

    getCollectionTips(card) {
        const tips = [];
        
        // Level requirement tip
        if (card.unlock_level > 1) {
            tips.push(`📈 Requires Level ${card.unlock_level}+ to draw`);
        }
        
        // Rarity-specific tips
        if (card.rarity === 'Secret Rare' || card.rarity === 'Legendary') {
            tips.push('🍀 Use luck boost items for better chances');
        } else if (card.rarity === 'Ultra Rare' || card.rarity === 'Holo Rare') {
            tips.push('💫 Try Premium Packs for better odds');
        }
        
        // Master Set tips
        if (card.variant_first_edition || card.variant_holo) {
            tips.push('🎁 Available in Master Packs');
        }
        
        // Default tip
        if (tips.length === 0) {
            tips.push('🎯 Available in all pack types');
        }
        
        return tips.join('\n');
    },

    getLastUpdatedText(timestamp) {
        if (!timestamp) return 'Unknown';
        
        const date = new Date(timestamp * 1000);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return `${Math.floor(diffDays / 30)} months ago`;
    }
};
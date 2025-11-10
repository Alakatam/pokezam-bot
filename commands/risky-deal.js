const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('risky_deal')
        .setDescription('💀 Make a risky gamble with Vex the Gamble-Broker! Risk a card for a chance to upgrade it!')
        .addStringOption(option =>
            option.setName('card')
                .setDescription('Card to gamble (format: set-number, e.g., base1-4)')
                .setRequired(true)
        ),
    cooldown: 10, // 10 seconds cooldown

    // PROBABILITY TABLE - The Core of the Risky Deal System
    // Format: [lossChance, drawChance, winChance]
    rarityProbabilities: {
        'Common': { loss: 0, draw: 90, win: 10, downgrade: null, upgrade: 'Uncommon' },
        'Uncommon': { loss: 25, draw: 65, win: 10, downgrade: 'Common', upgrade: 'Rare' },
        'Rare': { loss: 25, draw: 65, win: 10, downgrade: 'Uncommon', upgrade: ['Rare Holo', 'Rare ACE', 'Rare Holo EX'] },
        'Rare Holo': { loss: 35, draw: 55, win: 10, downgrade: 'Rare', upgrade: ['Rare Ultra', 'Hyper Rare', 'Ultra Rare'] },
        'Rare Holo EX': { loss: 35, draw: 55, win: 10, downgrade: 'Rare', upgrade: ['Rare Ultra', 'Hyper Rare'] },
        'Rare Holo GX': { loss: 35, draw: 55, win: 10, downgrade: 'Rare', upgrade: ['Rare Ultra', 'Hyper Rare'] },
        'Rare Holo V': { loss: 35, draw: 55, win: 10, downgrade: 'Rare', upgrade: ['Rare Ultra', 'Hyper Rare'] },
        'Rare Holo VMAX': { loss: 40, draw: 55, win: 5, downgrade: 'Rare Holo', upgrade: 'Rare Secret' },
        'Rare Ultra': { loss: 40, draw: 55, win: 5, downgrade: 'Rare Holo', upgrade: 'Rare Secret' },
        'Hyper Rare': { loss: 40, draw: 55, win: 5, downgrade: 'Rare Holo', upgrade: 'Rare Secret' },
        'Ultra Rare': { loss: 40, draw: 55, win: 5, downgrade: 'Rare Holo', upgrade: 'Rare Secret' },
        'Rare Secret': { loss: 30, draw: 70, win: 0, downgrade: ['Rare Ultra', 'Hyper Rare'], upgrade: null },
        'Rare Rainbow': { loss: 30, draw: 70, win: 0, downgrade: ['Rare Ultra', 'Hyper Rare'], upgrade: null },
        'Illustration Rare': { loss: 30, draw: 70, win: 0, downgrade: ['Rare Ultra', 'Hyper Rare'], upgrade: null }
    },

    async execute(interaction, { database, userManager, cardManager }) {
        try {
            await interaction.deferReply();

            const userId = interaction.user.id;
            const cardInput = interaction.options.getString('card').toLowerCase();

            // Ensure user exists
            let user = await userManager.getUser(userId);
            if (!user) {
                user = await userManager.createUser(userId, interaction.user.username);
            }

            // Check if user has started
            if (!user.has_started) {
                return await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        '🚫 Adventure Not Started',
                        'You must start your adventure with /start before making deals with Vex!'
                    )]
                });
            }

            // Parse card ID (format: set-number, e.g., base1-4)
            const cardParts = cardInput.split('-');
            if (cardParts.length !== 2) {
                return await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        '❌ Invalid Card Format',
                        'Please use the format: **set-number** (e.g., base1-4, xy1-10)'
                    )]
                });
            }

            const setId = cardParts[0];
            const cardNumber = cardParts[1];

            // Get the card from database
            const card = await database.get(`
                SELECT * FROM cards 
                WHERE LOWER(set_id) = ? AND number = ?
            `, [setId, cardNumber]);

            if (!card) {
                return await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        '❌ Card Not Found',
                        'No card found with that ID!'
                    )]
                });
            }

            // Check if user owns this card
            const userCard = await database.get(`
                SELECT * FROM user_cards 
                WHERE user_id = ? AND card_id = ?
            `, [userId, card.id]);

            if (!userCard || userCard.quantity < 1) {
                return await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        '🚫 Card Not Owned',
                        'You don\'t own this card!'
                    )]
                });
            }

            // EXECUTE THE GAMBLE IMMEDIATELY
            const probTable = this.rarityProbabilities[card.rarity] || this.rarityProbabilities['Rare'];
            const outcome = this.rollOutcome(card.rarity);
            const newCard = await this.getNewCard(database, card, outcome, probTable);

            if (!newCard) {
                throw new Error('Could not find replacement card');
            }

            // Remove original card
            if (userCard.quantity === 1) {
                await database.run(
                    'DELETE FROM user_cards WHERE user_id = ? AND card_id = ?',
                    [userId, card.id]
                );
            } else {
                await database.run(
                    'UPDATE user_cards SET quantity = quantity - 1 WHERE user_id = ? AND card_id = ?',
                    [userId, card.id]
                );
            }

            // Add new card
            await cardManager.addCardToUser(userId, newCard.id, 1);

            // Show enhanced result with card image
            const newCardImage = newCard.image_url_large || newCard.image_url_small || 
                                newCard.image_large || newCard.image_small;

            let resultEmbed;
            if (outcome === 'win') {
                resultEmbed = new EmbedBuilder()
                    .setTitle('🎰 VEX\'S GAMBLE HOUSE')
                    .setDescription(
                        `## 📈 WONDROUS TRADE!\n\n` +
                        `### Your Gamble:\n` +
                        `\`\`\`diff\n` +
                        `- You Risked: ${card.name} [${card.rarity}]\n` +
                        `+ You Won:    ${newCard.name} [${newCard.rarity}]\n` +
                        `\`\`\`\n` +
                        `> *"Hehehehe... Fortune favors the bold today! Your luck runs deep, mortal."* 🎉\n\n` +
                        `**Roll Result:** WIN ✨ (${probTable.win}% chance)`
                    )
                    .setColor('#00FF00')
                    .setThumbnail('https://i.imgur.com/8ZqKQNJ.png');
            } else if (outcome === 'draw') {
                resultEmbed = new EmbedBuilder()
                    .setTitle('🎰 VEX\'S GAMBLE HOUSE')
                    .setDescription(
                        `## 😐 FAIR EXCHANGE\n\n` +
                        `### Your Gamble:\n` +
                        `\`\`\`yaml\n` +
                        `You Risked: ${card.name} [${card.rarity}]\n` +
                        `You Got:    ${newCard.name} [${newCard.rarity}]\n` +
                        `\`\`\`\n` +
                        `> *"A fair trade. Boring, but balanced. The cards mock us both."* 🃏\n\n` +
                        `**Roll Result:** DRAW ⚖️ (${probTable.draw}% chance)`
                    )
                    .setColor('#FFAA00')
                    .setThumbnail('https://i.imgur.com/8ZqKQNJ.png');
            } else {
                resultEmbed = new EmbedBuilder()
                    .setTitle('🎰 VEX\'S GAMBLE HOUSE')
                    .setDescription(
                        `## 📉 UNLUCKY TRADE!\n\n` +
                        `### Your Gamble:\n` +
                        `\`\`\`diff\n` +
                        `- You Risked: ${card.name} [${card.rarity}]\n` +
                        `- You Got:    ${newCard.name} [${newCard.rarity}]\n` +
                        `\`\`\`\n` +
                        `> *"BAHAHAHA! You should have walked away, fool! The house always wins!"* 💸\n\n` +
                        `**Roll Result:** LOSS 💀 (${probTable.loss}% chance)`
                    )
                    .setColor('#FF0000')
                    .setThumbnail('https://i.imgur.com/8ZqKQNJ.png');
            }

            if (newCardImage) {
                resultEmbed.setImage(newCardImage);
            }

            resultEmbed.setFooter({ text: `🎲 All trades are final • Gambled: ${card.set_id}-${card.number}` });

            await interaction.editReply({ embeds: [resultEmbed] });

        } catch (error) {
            console.error('Error in risky_deal command:', error);
            await interaction.editReply({
                embeds: [EmbedUtils.createErrorEmbed(
                    'Gamble Error',
                    'Vex has disappeared into the shadows. Try again later!'
                )]
            });
        }
    },

    // Helper: Roll for outcome based on rarity
    rollOutcome(rarity) {
        const probTable = this.rarityProbabilities[rarity];
        if (!probTable) {
            // Fallback for unknown rarities (treat as Rare)
            return this.rollOutcome('Rare');
        }

        const roll = Math.random() * 100;
        
        if (roll < probTable.loss) {
            return 'loss';
        } else if (roll < probTable.loss + probTable.draw) {
            return 'draw';
        } else {
            return 'win';
        }
    },

    // Helper: Get new card based on outcome
    async getNewCard(database, originalCard, outcome, probTable) {
        let targetRarity = null;

        if (outcome === 'loss' && probTable.downgrade) {
            // Downgrade
            targetRarity = Array.isArray(probTable.downgrade) 
                ? probTable.downgrade[Math.floor(Math.random() * probTable.downgrade.length)]
                : probTable.downgrade;
        } else if (outcome === 'win' && probTable.upgrade) {
            // Upgrade
            targetRarity = Array.isArray(probTable.upgrade) 
                ? probTable.upgrade[Math.floor(Math.random() * probTable.upgrade.length)]
                : probTable.upgrade;
        } else {
            // Draw - same rarity, different card
            targetRarity = originalCard.rarity;
        }

        // Query for a random card of target rarity (exclude the original card)
        const cardCount = await database.get(`
            SELECT COUNT(*) as count FROM cards 
            WHERE rarity = ? AND id != ?
            AND api_id IS NOT NULL
            AND (image_url_large IS NOT NULL OR image_url_small IS NOT NULL)
        `, [targetRarity, originalCard.id]);

        if (!cardCount || cardCount.count === 0) {
            // Fallback: Return any random card (shouldn't happen)
            return await database.get(`
                SELECT * FROM cards 
                WHERE id != ? 
                AND api_id IS NOT NULL
                LIMIT 1
            `, [originalCard.id]);
        }

        const offset = Math.floor(Math.random() * cardCount.count);
        return await database.get(`
            SELECT * FROM cards 
            WHERE rarity = ? AND id != ?
            AND api_id IS NOT NULL
            AND (image_url_large IS NOT NULL OR image_url_small IS NOT NULL)
            LIMIT 1 OFFSET ?
        `, [targetRarity, originalCard.id, offset]);
    }
};

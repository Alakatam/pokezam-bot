const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
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
                        'You must start your adventure with `/start` before making deals with Vex!'
                    )]
                });
            }

            // Parse card ID (format: set-number, e.g., base1-4)
            const cardParts = cardInput.split('-');
            if (cardParts.length !== 2) {
                return await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        '❌ Invalid Card Format',
                        'Please use the format: **set-number** (e.g., `base1-4`, `xy1-10`)\n\nCheck your `/binder` for card IDs!'
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
                        `No card found with ID: **${cardInput}**\n\nCheck your `/binder` for valid card IDs!`
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
                        `You don't own **${card.name}** from **${card.set_name}**!\n\nYou can only gamble cards you own.`
                    )]
                });
            }

            // Check if user has duplicates (recommended for safety)
            const warningText = userCard.quantity === 1 
                ? '\n\n⚠️ **WARNING**: This is your only copy! You could lose it forever!'
                : `\n\n✅ You have **${userCard.quantity} copies** of this card.`;

            // Show initial Vex introduction with confirmation
            const initialEmbed = new EmbedBuilder()
                .setTitle('🎲 Vex the Gamble-Broker')
                .setDescription(
                    `*Vex emerges from the shadows, shuffling a deck of unmarked cards...*\n\n` +
                    `"Feeling lucky? Show me what you'll risk. Remember... **all trades are final.**"\n\n` +
                    `╔═══════════════════════════════╗\n` +
                    `║  **Your Offered Card:**\n` +
                    `║  ${card.name}\n` +
                    `║  Set: ${card.set_name}\n` +
                    `║  Rarity: ${card.rarity}\n` +
                    `║  ID: ${setId}-${cardNumber}\n` +
                    `╚═══════════════════════════════╝` +
                    warningText
                )
                .setColor('#8B0000')
                .setFooter({ text: '⚠️ All trades are permanent and cannot be undone!' });

            const confirmButton = new ButtonBuilder()
                .setCustomId(`vex_confirm_${userId}_${card.id}`)
                .setLabel('🎲 Accept the Gamble')
                .setStyle(ButtonStyle.Danger);

            const cancelButton = new ButtonBuilder()
                .setCustomId(`vex_cancel_${userId}`)
                .setLabel('🚶 Walk Away')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

            await interaction.editReply({
                embeds: [initialEmbed],
                components: [row]
            });

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

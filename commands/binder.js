const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('binder')
        .setDescription('📋 Browse your card binder with detailed filtering options')
        .addUserOption(option =>
            option.setName('trainer')
                .setDescription('View another trainer\'s binder')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('set')
                .setDescription('Filter by specific set ID')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('pokemon')
                .setDescription('Search for specific Pokémon name')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('rarity')
                .setDescription('Filter by card rarity')
                .setRequired(false)
                .addChoices(
                    { name: 'Common', value: 'Common' },
                    { name: 'Uncommon', value: 'Uncommon' },
                    { name: 'Rare', value: 'Rare' },
                    { name: 'Rare Holo', value: 'Rare Holo' },
                    { name: 'Ultra Rare', value: 'Ultra Rare' },
                    { name: 'Secret Rare', value: 'Secret Rare' }
                )
        )
        .addStringOption(option =>
            option.setName('filter')
                .setDescription('Special filters')
                .setRequired(false)
                .addChoices(
                    { name: 'Owned Cards Only', value: 'owned' },
                    { name: 'Duplicates Only (2+)', value: 'duplicates' },
                    { name: 'Missing Cards', value: 'missing' },
                    { name: 'All Cards', value: 'all' }
                )
        )
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page number (25 cards per page)')
                .setRequired(false)
                .setMinValue(1)
        ),

    async execute(interaction, { database, userManager, cardManager, questManager }) {
        try {
            await interaction.deferReply();

            // Get parameters
            const targetUser = interaction.options.getUser('trainer') || interaction.user;
            const setFilter = interaction.options.getString('set');
            const pokemonFilter = interaction.options.getString('pokemon');
            const rarityFilter = interaction.options.getString('rarity');
            const typeFilter = interaction.options.getString('filter') || 'owned';
            const currentPage = Math.max(1, interaction.options.getInteger('page') || 1);

            // Ensure user exists in database
            let user = await userManager.getUser(targetUser.id);
            if (!user) {
                user = await userManager.createUser(targetUser.id, targetUser.username);
            }

            // Get filtered cards
            const { cards, totalCards, totalPages } = await this.getFilteredCards(
                database, targetUser.id, setFilter, pokemonFilter, rarityFilter, typeFilter, currentPage
            );

            // Display the collection with enhanced colors
            await this.displayBinder(interaction, targetUser, cards, {
                setFilter,
                pokemonFilter,
                rarityFilter,
                typeFilter,
                currentPage,
                totalCards,
                totalPages
            });

        } catch (error) {
            console.error('Error in binder command:', error);
            await interaction.editReply({
                embeds: [EmbedUtils.createErrorEmbed(
                    'Binder Error',
                    'Failed to load your card binder. Please try again!'
                )]
            });
        }
    },

    async getFilteredCards(database, userId, setFilter, pokemonFilter, rarityFilter, typeFilter, currentPage) {
        const cardsPerPage = 25;
        const offset = (currentPage - 1) * cardsPerPage;
        let baseQuery, countQuery;
        let params = [userId];
        let whereConditions = [];

        // Base queries depending on filter type
        switch (typeFilter) {
            case 'owned':
                baseQuery = `
                    SELECT c.*, uc.quantity, uc.obtained_at
                    FROM user_cards uc
                    INNER JOIN cards c ON uc.card_id = c.id
                    WHERE uc.user_id = ? AND uc.quantity > 0
                `;
                countQuery = `
                    SELECT COUNT(*) as total
                    FROM user_cards uc
                    INNER JOIN cards c ON uc.card_id = c.id
                    WHERE uc.user_id = ? AND uc.quantity > 0
                `;
                break;
            case 'duplicates':
                baseQuery = `
                    SELECT c.*, uc.quantity, uc.obtained_at
                    FROM user_cards uc
                    INNER JOIN cards c ON uc.card_id = c.id
                    WHERE uc.user_id = ? AND uc.quantity > 1
                `;
                countQuery = `
                    SELECT COUNT(*) as total
                    FROM user_cards uc
                    INNER JOIN cards c ON uc.card_id = c.id
                    WHERE uc.user_id = ? AND uc.quantity > 1
                `;
                break;
            case 'missing':
                baseQuery = `
                    SELECT c.*, 0 as quantity, NULL as obtained_at
                    FROM cards c
                    LEFT JOIN user_cards uc ON c.id = uc.card_id AND uc.user_id = ?
                    WHERE uc.card_id IS NULL OR uc.quantity = 0
                `;
                countQuery = `
                    SELECT COUNT(*) as total
                    FROM cards c
                    LEFT JOIN user_cards uc ON c.id = uc.card_id AND uc.user_id = ?
                    WHERE uc.card_id IS NULL OR uc.quantity = 0
                `;
                break;
            case 'all':
                baseQuery = `
                    SELECT c.*, COALESCE(uc.quantity, 0) as quantity, uc.obtained_at
                    FROM cards c
                    LEFT JOIN user_cards uc ON c.id = uc.card_id AND uc.user_id = ?
                `;
                countQuery = `
                    SELECT COUNT(*) as total
                    FROM cards c
                    LEFT JOIN user_cards uc ON c.id = uc.card_id AND uc.user_id = ?
                `;
                break;
        }

        // Add filters
        if (setFilter) {
            whereConditions.push('c.set_id = ? OR c.set_name LIKE ?');
            params.push(setFilter, `%${setFilter}%`);
        }
        
        if (pokemonFilter) {
            whereConditions.push('c.name LIKE ?');
            params.push(`%${pokemonFilter}%`);
        }
        
        if (rarityFilter) {
            whereConditions.push('c.rarity = ?');
            params.push(rarityFilter);
        }

        // Apply additional WHERE conditions
        if (whereConditions.length > 0) {
            const additionalWhere = ' AND ' + whereConditions.join(' AND ');
            baseQuery += additionalWhere;
            countQuery += additionalWhere;
        }

        // Add ordering and pagination
        // NOTE: Can't CAST number as INTEGER because some cards have alphanumeric IDs (e.g., "RC17")
        // Sort by set name, then by card name as fallback
        baseQuery += ` ORDER BY c.set_name, c.name LIMIT ${cardsPerPage} OFFSET ${offset}`;

        // Execute queries
        const cards = await database.all(baseQuery, params);
        const totalResult = await database.get(countQuery, params);
        const totalCards = totalResult.total;
        const totalPages = Math.ceil(totalCards / cardsPerPage);

        return { cards, totalCards, totalPages };
    },

    async displayBinder(interaction, targetUser, cards, filters) {
        const { setFilter, pokemonFilter, rarityFilter, typeFilter, currentPage, totalCards, totalPages } = filters;

        // Create header with enhanced colors
        let content = '```ansi\n';
        content += '\u001b[1;36m════════════════════════════════════════════════════════\u001b[0m\n';
        content += `\u001b[1;33m          ${targetUser.username.toUpperCase()}'S BINDER\u001b[0m\n`;
        content += '\u001b[1;36m════════════════════════════════════════════════════════\u001b[0m\n\n';

        // Show active filters with colors
        const activeFilters = [];
        if (setFilter) activeFilters.push(`Set: ${setFilter}`);
        if (pokemonFilter) activeFilters.push(`Pokémon: ${pokemonFilter}`);
        if (rarityFilter) activeFilters.push(`Rarity: ${rarityFilter}`);
        if (typeFilter !== 'owned') activeFilters.push(`Filter: ${typeFilter}`);

        if (activeFilters.length > 0) {
            content += '\u001b[1;35mACTIVE FILTERS: \u001b[0m' + activeFilters.join(' | ') + '\n';
        }
        content += `\u001b[1;32mPAGE ${currentPage} OF ${totalPages} | SHOWING ${cards.length} OF ${totalCards} CARDS\u001b[0m\n\n`;

        // Table header with colors
        content += '\u001b[1;37mRRT SET ID  #   CARD NAME                    QTY\u001b[0m\n';
        content += '\u001b[2;37m────────────────────────────────────────────────────\u001b[0m\n';

        // Display cards in table format with colors
        if (cards.length === 0) {
            content += '\u001b[1;31m                NO CARDS FOUND\u001b[0m\n';
            content += '\n';
            if (typeFilter === 'owned') {
                content += '\u001b[1;33m💡 TIP: Use /draw to collect cards!\u001b[0m\n';
            } else if (typeFilter === 'missing') {
                content += '\u001b[1;32m✅ Great! No missing cards here.\u001b[0m\n';
            } else if (typeFilter === 'duplicates') {
                content += '\u001b[1;34m📚 No duplicates found.\u001b[0m\n';
            }
        } else {
            cards.forEach(card => {
                const rarity = this.formatRarity(card.rarity);
                const setId = this.formatSetId(card.set_id);
                const cardId = this.formatCardId(card.number || card.card_id);
                const cardName = this.formatCardName(card.name, '');
                const owned = this.formatOwned(card.quantity);

                // Color based on rarity
                let rarityColor = '\u001b[0m'; // default
                if (card.rarity?.includes('Secret')) rarityColor = '\u001b[1;31m'; // bright red
                else if (card.rarity?.includes('Ultra')) rarityColor = '\u001b[1;35m'; // bright magenta
                else if (card.rarity?.includes('Holo')) rarityColor = '\u001b[1;36m'; // bright cyan
                else if (card.rarity?.includes('Rare')) rarityColor = '\u001b[1;33m'; // bright yellow
                else if (card.rarity?.includes('Uncommon')) rarityColor = '\u001b[1;32m'; // bright green

                content += `${rarityColor}${rarity}\u001b[0m ${setId} ${cardId} ${cardName} ${owned > 0 ? '\u001b[1;32m' : '\u001b[2;31m'}${owned}\u001b[0m\n`;
            });
        }

        content += '\n\u001b[1;36m════════════════════════════════════════════════════════\u001b[0m\n';
        content += '```';

        // Create embed with enhanced appearance
        const embed = new EmbedBuilder()
            .setTitle('📋 Pokémon Card Binder')
            .setDescription(content)
            .setColor('#4A90E2') // Nice blue color
            .setTimestamp()
            .setFooter({ 
                text: `Use the buttons to navigate pages or try different filters`,
                iconURL: targetUser.displayAvatarURL({ dynamic: true })
            });

        // Add a thumbnail for visual appeal
        embed.setThumbnail('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png');

        // Create navigation buttons with enhanced colors
        const components = [];
        
        if (totalPages > 1) {
            const navigationRow = new ActionRowBuilder();
            
            // Previous page button
            if (currentPage > 1) {
                navigationRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`binder_page_${targetUser.id}_${currentPage - 1}`)
                        .setLabel(`◀ Page ${currentPage - 1}`)
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('⬅️')
                );
            }

            // Page info button (disabled, just shows info)
            navigationRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('page_info')
                    .setLabel(`${currentPage} / ${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
                    .setEmoji('📄')
            );

            // Next page button
            if (currentPage < totalPages) {
                navigationRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`binder_page_${targetUser.id}_${currentPage + 1}`)
                        .setLabel(`Page ${currentPage + 1} ▶`)
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('➡️')
                );
            }

            components.push(navigationRow);
        }

        // Filter buttons with enhanced styling
        const filterRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`binder_filter_${targetUser.id}_owned`)
                    .setLabel('Owned')
                    .setEmoji('✅')
                    .setStyle(typeFilter === 'owned' ? ButtonStyle.Success : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`binder_filter_${targetUser.id}_duplicates`)
                    .setLabel('Duplicates')
                    .setEmoji('📚')
                    .setStyle(typeFilter === 'duplicates' ? ButtonStyle.Success : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`binder_filter_${targetUser.id}_missing`)
                    .setLabel('Missing')
                    .setEmoji('❌')
                    .setStyle(typeFilter === 'missing' ? ButtonStyle.Success : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`binder_filter_${targetUser.id}_all`)
                    .setLabel('All Cards')
                    .setEmoji('🗂️')
                    .setStyle(typeFilter === 'all' ? ButtonStyle.Success : ButtonStyle.Secondary)
            );

        components.push(filterRow);

        await interaction.editReply({
            embeds: [embed],
            components: components
        });
    },

    // Helper functions for table formatting - compact version
    formatRarity(rarity) {
        const rarityMap = {
            'Common': 'C',
            'Uncommon': 'U', 
            'Rare': 'R',
            'Rare Holo': 'H',
            'Ultra Rare': 'UR',
            'Secret Rare': 'SR'
        };
        const shortRarity = rarityMap[rarity] || '?';
        return shortRarity.padEnd(3);
    },

    formatSetId(setId) {
        if (!setId || setId === '') return 'N/A'.padEnd(7);
        return setId.substring(0, 7).padEnd(7);
    },

    formatCardId(cardId) {
        if (!cardId || cardId === '' || cardId === null) return '---';
        return cardId.toString().padStart(3);
    },

    formatCardName(name, number) {
        let cardName = name;
        if (number && number !== '') {
            cardName += ` #${number}`;
        }
        // Truncate if too long - more compact at 28 characters
        if (cardName.length > 28) {
            cardName = cardName.substring(0, 25) + '...';
        }
        return cardName.padEnd(28);
    },

    formatOwned(quantity) {
        if (quantity === 0) return ' -';
        if (quantity === 1) return ' 1';
        if (quantity < 10) return ` ${quantity}`;
        return `${quantity}`;
    },

    buildNavigation(currentPage, totalPages, totalCards, userId) {
        const row = new ActionRowBuilder();
        
        // Previous page button
        if (currentPage > 0) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`binder_page_${currentPage - 1}_${userId}`)
                    .setLabel('◀ Previous')
                    .setStyle(ButtonStyle.Primary)
            );
        }

        // Page indicator button (not clickable)
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`page_indicator_${Date.now()}`)
                .setLabel(`Page ${currentPage + 1}/${totalPages}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );

        // Next page button
        if (currentPage < totalPages - 1) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`binder_page_${currentPage + 1}_${userId}`)
                    .setLabel('Next ▶')
                    .setStyle(ButtonStyle.Primary)
            );
        }

        return row;
    }
};
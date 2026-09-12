const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('carddex-reg')
        .setDescription('📚 Browse the complete Pokémon TCG Dex with ownership tracking')
        .addUserOption(option =>
            option.setName('trainer')
                .setDescription('View another trainer\'s Card Dex')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('set')
                .setDescription('View specific set')
                .setRequired(false)
                .addChoices(
                    { name: 'Base Set', value: 'base1' },
                    { name: 'Jungle', value: 'base2' },
                    { name: 'Fossil', value: 'base3' },
                    { name: 'Team Rocket', value: 'base4' },
                    { name: 'Gym Heroes', value: 'gym1' },
                    { name: 'Gym Challenge', value: 'gym2' },
                    { name: 'Neo Genesis', value: 'neo1' },
                    { name: 'Neo Discovery', value: 'neo2' },
                    { name: 'Neo Destiny', value: 'neo3' },
                    { name: 'Neo Revelation', value: 'neo4' }
                )
        )
        .addStringOption(option =>
            option.setName('filter')
                .setDescription('Filter cards by ownership')
                .setRequired(false)
                .addChoices(
                    { name: 'All Cards', value: 'all' },
                    { name: 'Owned Only', value: 'owned' },
                    { name: 'Missing Only', value: 'missing' },
                    { name: 'Duplicates Only', value: 'duplicates' }
                )
        )
        .addStringOption(option =>
            option.setName('search')
                .setDescription('Search for specific Pokémon name')
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page number')
                .setRequired(false)
                .setMinValue(1)
        ),

    async execute(interaction, { database, userManager, cardManager }) {
        try {
            await interaction.deferReply();

            const targetUser = interaction.options.getUser('trainer') || interaction.user;
            const setFilter = interaction.options.getString('set');
            const ownershipFilter = interaction.options.getString('filter') || 'all';
            const searchQuery = interaction.options.getString('search');
            const currentPage = Math.max(1, interaction.options.getInteger('page') || 1);

            // Ensure user exists
            let user = await userManager.getUser(targetUser.id);
            if (!user) {
                user = await userManager.createUser(targetUser.id, targetUser.username);
            }

            // Get dex data
            const dexData = await this.getDexData(database, targetUser.id, {
                setFilter,
                ownershipFilter,
                searchQuery,
                currentPage
            });

            await this.displayCardDex(interaction, targetUser, dexData);

        } catch (error) {
            console.error('Error in carddex-reg command:', error);
            await interaction.editReply({
                embeds: [EmbedUtils.createErrorEmbed(
                    'Card Dex Error',
                    'Failed to load the Card Dex. Please try again!'
                )]
            });
        }
    },

    async getDexData(database, userId, options) {
        const { setFilter, ownershipFilter, searchQuery, currentPage } = options;
        const cardsPerPage = 20;
        const offset = (currentPage - 1) * cardsPerPage;

        let query = `
            SELECT 
                c.*,
                COALESCE(uc.quantity, 0) as owned_quantity,
                uc.obtained_at,
                CASE WHEN uc.quantity > 0 THEN 1 ELSE 0 END as is_owned
            FROM cards c
            LEFT JOIN user_cards uc ON c.id = uc.card_id AND uc.user_id = ?
        `;
        
        let countQuery = `
            SELECT COUNT(*) as total
            FROM cards c
            LEFT JOIN user_cards uc ON c.id = uc.card_id AND uc.user_id = ?
        `;

        let params = [userId];
        let whereConditions = [];

        // Apply filters
        if (setFilter) {
            whereConditions.push('c.set_id = ?');
            params.push(setFilter);
        }

        if (searchQuery) {
            whereConditions.push('c.name LIKE ?');
            params.push(`%${searchQuery}%`);
        }

        if (ownershipFilter === 'owned') {
            whereConditions.push('uc.quantity > 0');
        } else if (ownershipFilter === 'missing') {
            whereConditions.push('(uc.quantity IS NULL OR uc.quantity = 0)');
        } else if (ownershipFilter === 'duplicates') {
            whereConditions.push('uc.quantity > 1');
        }

        // Add WHERE clause if conditions exist
        if (whereConditions.length > 0) {
            const whereClause = ' WHERE ' + whereConditions.join(' AND ');
            query += whereClause;
            countQuery += whereClause;
        }

        // Add ordering and pagination
        // NOTE: Can't CAST number as INTEGER because some cards have alphanumeric IDs (e.g., "RC17")
        query += ` ORDER BY c.set_id, c.name LIMIT ${cardsPerPage} OFFSET ${offset}`;

        // Execute queries
        const cards = await database.all(query, params);
        const totalResult = await database.get(countQuery, params);
        const totalCards = totalResult.total;
        const totalPages = Math.ceil(totalCards / cardsPerPage);

        // Get collection stats
        const stats = await this.getCollectionStats(database, userId, setFilter);

        return {
            cards,
            totalCards,
            totalPages,
            currentPage,
            stats,
            filters: options
        };
    },

    async getCollectionStats(database, userId, setFilter = null) {
        let baseQuery = `
            SELECT 
                COUNT(*) as total_cards,
                COUNT(CASE WHEN uc.quantity > 0 THEN 1 END) as owned_cards,
                COUNT(CASE WHEN uc.quantity > 1 THEN 1 END) as duplicate_cards,
                SUM(COALESCE(uc.quantity, 0)) as total_quantity
            FROM cards c
            LEFT JOIN user_cards uc ON c.id = uc.card_id AND uc.user_id = ?
        `;

        let params = [userId];
        
        if (setFilter) {
            baseQuery += ' WHERE c.set_id = ?';
            params.push(setFilter);
        }

        const result = await database.get(baseQuery, params);
        
        const completion = result.total_cards > 0 
            ? ((result.owned_cards / result.total_cards) * 100).toFixed(1)
            : 0;

        return {
            ...result,
            completion_percentage: completion
        };
    },

    async displayCardDex(interaction, targetUser, dexData) {
        const { cards, totalCards, totalPages, currentPage, stats, filters } = dexData;
        const { setFilter, ownershipFilter, searchQuery } = filters;

        const progressBar = EmbedUtils.createProgressBar(stats.owned_cards, stats.total_cards, 12);

        const cardLines = cards.length > 0
            ? cards.map(card => {
                const cardNum = card.number ? `\`#${card.number}\`` : '`#???`';
                const ownedTag = card.is_owned ? `✅ \`x${card.owned_quantity}\`` : '❌';
                const rarityBadge = card.rarity ? `*(${card.rarity})*` : '';
                return `• ${cardNum} **${card.name}** — ${rarityBadge} ${ownedTag}`;
            }).join('\n')
            : 'No cards found matching your filter criteria.';

        const filterTags = [];
        if (setFilter) filterTags.push(`Set: \`${setFilter}\``);
        if (searchQuery) filterTags.push(`Search: \`${searchQuery}\``);
        if (ownershipFilter !== 'all') filterTags.push(`Filter: \`${ownershipFilter}\``);

        const fields = [
            {
                name: '📊 Dex Completion Progress',
                value: `• **Progress:** ${progressBar} \`(${stats.completion_percentage}%)\`\n• **Owned:** \`${stats.owned_cards.toLocaleString()}\` / \`${stats.total_cards.toLocaleString()}\` Cards\n• **Duplicates:** \`${stats.duplicate_cards.toLocaleString()}\``,
                inline: false
            }
        ];

        if (filterTags.length > 0) {
            fields.push({
                name: '🔍 Active Filters',
                value: filterTags.join(' • '),
                inline: false
            });
        }

        fields.push({
            name: `🎴 Registry Listing — Page ${currentPage}/${totalPages} (\`${totalCards.toLocaleString()}\` Matches)`,
            value: cardLines,
            inline: false
        });

        const embed = EmbedUtils.createBaseEmbed({
            author: { name: `${targetUser.displayName || targetUser.username}'s Card Dex`, iconURL: targetUser.displayAvatarURL({ dynamic: true }) },
            title: '📚 Pokémon TCG Card Registry',
            description: 'Browse cards and track collection completion below.',
            color: parseFloat(stats.completion_percentage) >= 100 ? EmbedUtils.palette.gold : EmbedUtils.palette.brand,
            footerText: `Page ${currentPage} of ${totalPages} • Pokézam Dex`,
            footerIcon: targetUser.displayAvatarURL({ dynamic: true }),
            fields
        });

        // Create action rows
        const components = [];

        // Navigation buttons (if multiple pages)
        if (totalPages > 1) {
            const navRow = new ActionRowBuilder();
            
            if (currentPage > 1) {
                navRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`carddex_page_${targetUser.id}_${currentPage - 1}`)
                        .setLabel('◀ Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('⬅️')
                );
            }

            navRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('page_info')
                    .setLabel(`${currentPage} / ${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
                    .setEmoji('📄')
            );

            if (currentPage < totalPages) {
                navRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`carddex_page_${targetUser.id}_${currentPage + 1}`)
                        .setLabel('Next ▶')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('➡️')
                );
            }

            components.push(navRow);
        }

        // Filter buttons
        const filterRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`carddex_filter_${targetUser.id}_all`)
                    .setLabel('All')
                    .setEmoji('🗂️')
                    .setStyle(ownershipFilter === 'all' ? ButtonStyle.Success : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`carddex_filter_${targetUser.id}_owned`)
                    .setLabel('Owned')
                    .setEmoji('✅')
                    .setStyle(ownershipFilter === 'owned' ? ButtonStyle.Success : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`carddex_filter_${targetUser.id}_missing`)
                    .setLabel('Missing')
                    .setEmoji('❌')
                    .setStyle(ownershipFilter === 'missing' ? ButtonStyle.Success : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`carddex_filter_${targetUser.id}_duplicates`)
                    .setLabel('Duplicates')
                    .setEmoji('📚')
                    .setStyle(ownershipFilter === 'duplicates' ? ButtonStyle.Success : ButtonStyle.Secondary)
            );

        components.push(filterRow);

        // Set selection dropdown (popular sets)
        const setSelectRow = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`carddex_set_${targetUser.id}`)
                    .setPlaceholder('🎴 Select a TCG Set to browse')
                    .addOptions([
                        { label: 'All Sets', value: 'all', emoji: '🌐', description: 'View all cards from all sets' },
                        { label: 'Base Set', value: 'base1', emoji: '🔥', description: 'Original 1998 Base Set' },
                        { label: 'Jungle', value: 'base2', emoji: '🌿', description: 'First expansion set' },
                        { label: 'Fossil', value: 'base3', emoji: '🦴', description: 'Fossil Pokémon expansion' },
                        { label: 'Team Rocket', value: 'base4', emoji: '🚀', description: 'Dark Pokémon set' },
                        { label: 'Gym Heroes', value: 'gym1', emoji: '🏟️', description: 'Kanto Gym Leaders' },
                        { label: 'Neo Genesis', value: 'neo1', emoji: '✨', description: 'Gold/Silver era begins' },
                        { label: 'Sword & Shield Base', value: 'swsh1', emoji: '⚔️', description: 'Modern era set' },
                        { label: 'Scarlet & Violet Base', value: 'sv1', emoji: '🔴', description: 'Latest generation' }
                    ])
            );

        components.push(setSelectRow);

        await interaction.editReply({
            embeds: [embed],
            components: components
        });
    },

    formatRarity(rarity) {
        const rarityMap = {
            'Common': 'Common',
            'Uncommon': 'Uncommon',
            'Rare': 'Rare',
            'Rare Holo': 'R-Holo',
            'Ultra Rare': 'Ultra',
            'Secret Rare': 'Secret'
        };
        return rarityMap[rarity] || rarity || 'Unknown';
    },

    getProgressEmoji(percentage) {
        if (percentage >= 100) return 'master-ball';
        if (percentage >= 75) return 'ultra-ball';
        if (percentage >= 50) return 'great-ball';
        return 'poke-ball';
    }
};
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('carddex-master')
        .setDescription('🎖️ Advanced Card Dex with Master Set variant tracking')
        .addUserOption(option =>
            option.setName('trainer')
                .setDescription('View another trainer\'s Master Card Dex')
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
                    { name: 'Neo Discovery', value: 'neo2' }
                )
        )
        .addStringOption(option =>
            option.setName('variant')
                .setDescription('Filter by card variant')
                .setRequired(false)
                .addChoices(
                    { name: 'All Variants', value: 'all' },
                    { name: 'Normal Only', value: 'normal' },
                    { name: 'Reverse Holo', value: 'reverse' },
                    { name: 'Holographic', value: 'holo' },
                    { name: 'First Edition', value: 'first_edition' },
                    { name: 'Promotional', value: 'promo' }
                )
        )
        .addStringOption(option =>
            option.setName('completion')
                .setDescription('Filter by completion status')
                .setRequired(false)
                .addChoices(
                    { name: 'All Cards', value: 'all' },
                    { name: 'Complete Sets (All Variants)', value: 'complete' },
                    { name: 'Partial Collections', value: 'partial' },
                    { name: 'Missing Entirely', value: 'missing' },
                    { name: 'Master Complete (All Variants)', value: 'master_complete' }
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
            const variantFilter = interaction.options.getString('variant') || 'all';
            const completionFilter = interaction.options.getString('completion') || 'all';
            const searchQuery = interaction.options.getString('search');
            const currentPage = Math.max(1, interaction.options.getInteger('page') || 1);

            // Ensure user exists
            let user = await userManager.getUser(targetUser.id);
            if (!user) {
                user = await userManager.createUser(targetUser.id, targetUser.username);
            }

            // Get master dex data
            const masterDexData = await this.getMasterDexData(database, targetUser.id, {
                setFilter,
                variantFilter,
                completionFilter,
                searchQuery,
                currentPage
            });

            await this.displayMasterCardDex(interaction, targetUser, masterDexData);

        } catch (error) {
            console.error('Error in carddex-master command:', error);
            await interaction.editReply({
                embeds: [EmbedUtils.createErrorEmbed(
                    'Master Card Dex Error',
                    'Failed to load the Master Card Dex. Please try again!'
                )]
            });
        }
    },

    async getMasterDexData(database, userId, options) {
        const { setFilter, variantFilter, completionFilter, searchQuery, currentPage } = options;
        const cardsPerPage = 15; // Fewer per page due to variant info
        const offset = (currentPage - 1) * cardsPerPage;

        let query = `
            SELECT 
                c.*,
                COALESCE(uc.quantity, 0) as total_quantity,
                COALESCE(uc.owns_normal, 0) as owns_normal,
                COALESCE(uc.owns_reverse, 0) as owns_reverse,
                COALESCE(uc.owns_holo, 0) as owns_holo,
                COALESCE(uc.owns_first_edition, 0) as owns_first_edition,
                COALESCE(uc.owns_promo, 0) as owns_promo,
                uc.obtained_at,
                -- Calculate variant completion
                (COALESCE(uc.owns_normal, 0) + 
                 COALESCE(uc.owns_reverse, 0) + 
                 COALESCE(uc.owns_holo, 0) + 
                 COALESCE(uc.owns_first_edition, 0) + 
                 COALESCE(uc.owns_promo, 0)) as variants_owned,
                (c.variant_normal + c.variant_reverse + c.variant_holo + c.variant_first_edition + c.variant_promo) as variants_available
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

        // Variant filters
        if (variantFilter !== 'all') {
            const variantMap = {
                'normal': 'uc.owns_normal = 1',
                'reverse': 'uc.owns_reverse = 1',
                'holo': 'uc.owns_holo = 1',
                'first_edition': 'uc.owns_first_edition = 1',
                'promo': 'uc.owns_promo = 1'
            };
            if (variantMap[variantFilter]) {
                whereConditions.push(variantMap[variantFilter]);
            }
        }

        // Completion filters
        if (completionFilter === 'complete') {
            whereConditions.push(`(
                COALESCE(uc.owns_normal, 0) + 
                COALESCE(uc.owns_reverse, 0) + 
                COALESCE(uc.owns_holo, 0) + 
                COALESCE(uc.owns_first_edition, 0) + 
                COALESCE(uc.owns_promo, 0)
            ) = (c.variant_normal + c.variant_reverse + c.variant_holo + c.variant_first_edition + c.variant_promo)`);
        } else if (completionFilter === 'partial') {
            whereConditions.push(`(
                COALESCE(uc.owns_normal, 0) + 
                COALESCE(uc.owns_reverse, 0) + 
                COALESCE(uc.owns_holo, 0) + 
                COALESCE(uc.owns_first_edition, 0) + 
                COALESCE(uc.owns_promo, 0)
            ) > 0 AND (
                COALESCE(uc.owns_normal, 0) + 
                COALESCE(uc.owns_reverse, 0) + 
                COALESCE(uc.owns_holo, 0) + 
                COALESCE(uc.owns_first_edition, 0) + 
                COALESCE(uc.owns_promo, 0)
            ) < (c.variant_normal + c.variant_reverse + c.variant_holo + c.variant_first_edition + c.variant_promo)`);
        } else if (completionFilter === 'missing') {
            whereConditions.push(`(
                COALESCE(uc.owns_normal, 0) + 
                COALESCE(uc.owns_reverse, 0) + 
                COALESCE(uc.owns_holo, 0) + 
                COALESCE(uc.owns_first_edition, 0) + 
                COALESCE(uc.owns_promo, 0)
            ) = 0`);
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

        // Get master collection stats
        const stats = await this.getMasterCollectionStats(database, userId, setFilter);

        return {
            cards,
            totalCards,
            totalPages,
            currentPage,
            stats,
            filters: options
        };
    },

    async getMasterCollectionStats(database, userId, setFilter = null) {
        let baseQuery = `
            SELECT 
                COUNT(*) as total_cards,
                COUNT(CASE WHEN uc.quantity > 0 THEN 1 END) as owned_cards,
                SUM(COALESCE(uc.owns_normal, 0)) as normal_variants,
                SUM(COALESCE(uc.owns_reverse, 0)) as reverse_variants,
                SUM(COALESCE(uc.owns_holo, 0)) as holo_variants,
                SUM(COALESCE(uc.owns_first_edition, 0)) as first_edition_variants,
                SUM(COALESCE(uc.owns_promo, 0)) as promo_variants,
                SUM(c.variant_normal + c.variant_reverse + c.variant_holo + c.variant_first_edition + c.variant_promo) as total_possible_variants,
                SUM(COALESCE(uc.owns_normal, 0) + COALESCE(uc.owns_reverse, 0) + COALESCE(uc.owns_holo, 0) + COALESCE(uc.owns_first_edition, 0) + COALESCE(uc.owns_promo, 0)) as total_owned_variants,
                COUNT(CASE WHEN (COALESCE(uc.owns_normal, 0) + COALESCE(uc.owns_reverse, 0) + COALESCE(uc.owns_holo, 0) + COALESCE(uc.owns_first_edition, 0) + COALESCE(uc.owns_promo, 0)) = (c.variant_normal + c.variant_reverse + c.variant_holo + c.variant_first_edition + c.variant_promo) AND (c.variant_normal + c.variant_reverse + c.variant_holo + c.variant_first_edition + c.variant_promo) > 0 THEN 1 END) as master_complete_cards
            FROM cards c
            LEFT JOIN user_cards uc ON c.id = uc.card_id AND uc.user_id = ?
        `;

        let params = [userId];
        
        if (setFilter) {
            baseQuery += ' WHERE c.set_id = ?';
            params.push(setFilter);
        }

        const result = await database.get(baseQuery, params);
        
        const cardCompletion = result.total_cards > 0 
            ? ((result.owned_cards / result.total_cards) * 100).toFixed(1)
            : 0;

        const variantCompletion = result.total_possible_variants > 0 
            ? ((result.total_owned_variants / result.total_possible_variants) * 100).toFixed(1)
            : 0;

        const masterCompletion = result.total_cards > 0 
            ? ((result.master_complete_cards / result.total_cards) * 100).toFixed(1)
            : 0;

        return {
            ...result,
            card_completion_percentage: cardCompletion,
            variant_completion_percentage: variantCompletion,
            master_completion_percentage: masterCompletion
        };
    },

    async displayMasterCardDex(interaction, targetUser, dexData) {
        const { cards, totalCards, totalPages, currentPage, stats, filters } = dexData;
        const { setFilter, variantFilter, completionFilter, searchQuery } = filters;

        // Create advanced YAML-formatted description
        let yamlDescription = '```yaml\n';
        yamlDescription += '#════════════════════════════════════════════════════════════\n';
        yamlDescription += `# 🎖️ ${targetUser.username.toUpperCase()}'S MASTER SET COLLECTION\n`;
        yamlDescription += '#════════════════════════════════════════════════════════════\n\n';
        
        // Master Collection Stats
        yamlDescription += '🏆 MASTER COLLECTION STATS:\n';
        yamlDescription += `   Total Cards         : ${stats.total_cards.toLocaleString()}\n`;
        yamlDescription += `   Owned Cards         : ${stats.owned_cards.toLocaleString()} (${stats.card_completion_percentage}%)\n`;
        yamlDescription += `   Master Complete     : ${stats.master_complete_cards.toLocaleString()} (${stats.master_completion_percentage}%)\n\n`;
        
        yamlDescription += '✨ VARIANT COLLECTION:\n';
        yamlDescription += `   Total Variants      : ${stats.total_owned_variants.toLocaleString()}/${stats.total_possible_variants.toLocaleString()} (${stats.variant_completion_percentage}%)\n`;
        yamlDescription += `   Normal Variants     : ${stats.normal_variants.toLocaleString()}\n`;
        yamlDescription += `   Reverse Holo        : ${stats.reverse_variants.toLocaleString()}\n`;
        yamlDescription += `   Holographic         : ${stats.holo_variants.toLocaleString()}\n`;
        yamlDescription += `   First Edition       : ${stats.first_edition_variants.toLocaleString()}\n`;
        yamlDescription += `   Promotional         : ${stats.promo_variants.toLocaleString()}\n`;

        // Active filters
        if (setFilter || searchQuery || variantFilter !== 'all' || completionFilter !== 'all') {
            yamlDescription += '\n🔍 ACTIVE FILTERS:\n';
            if (setFilter) yamlDescription += `   Set Filter          : "${setFilter}"\n`;
            if (searchQuery) yamlDescription += `   Search Query        : "${searchQuery}"\n`;
            if (variantFilter !== 'all') yamlDescription += `   Variant Filter      : "${variantFilter}"\n`;
            if (completionFilter !== 'all') yamlDescription += `   Completion Filter   : "${completionFilter}"\n`;
        }

        yamlDescription += '\n📄 PAGE INFO:\n';
        yamlDescription += `   Current Page        : ${currentPage} of ${totalPages}\n`;
        yamlDescription += `   Cards on Page       : ${cards.length}\n`;
        yamlDescription += `   Total Results       : ${totalCards.toLocaleString()}\n\n`;

        // Master Card List Header
        yamlDescription += '🎖️ MASTER CARD LISTING:\n';
        yamlDescription += '   #   | NAME                | SET   | VARIANTS OWNED         | STATUS\n';
        yamlDescription += '   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

        if (cards.length === 0) {
            yamlDescription += '   No cards found matching your Master Set criteria.\n';
        } else {
            cards.forEach((card, index) => {
                const cardNum = (card.number || '???').toString().padStart(3);
                const cardName = card.name.length > 15 ? card.name.substring(0, 12) + '...' : card.name;
                const setId = (card.set_id || 'N/A').toString().substring(0, 5);
                
                // Create variant ownership display
                const variants = [];
                if (card.owns_normal) variants.push('N');
                if (card.owns_reverse) variants.push('R');
                if (card.owns_holo) variants.push('H');
                if (card.owns_first_edition) variants.push('1E');
                if (card.owns_promo) variants.push('P');
                
                const variantDisplay = variants.length > 0 ? variants.join(',') : 'None';
                const variantStatus = variants.length > 0 
                    ? (card.variants_owned >= card.variants_available ? '🎖️ Master' : '⭐ Partial')
                    : '❌ Missing';
                
                yamlDescription += `   ${cardNum} | ${cardName.padEnd(15)} | ${setId.padEnd(5)} | ${variantDisplay.padEnd(15)} | ${variantStatus}\n`;
            });
        }

        yamlDescription += '\n   Legend: N=Normal, R=Reverse, H=Holo, 1E=First Edition, P=Promo\n';
        yamlDescription += '#════════════════════════════════════════════════════════════\n';
        yamlDescription += '```';

        // Create embed with enhanced master set theming
        const embed = new EmbedBuilder()
            .setTitle('🎖️ Master Set Collection Tracker')
            .setDescription(yamlDescription)
            .setColor(stats.master_completion_percentage >= 100 ? '#FFD700' : 
                     stats.master_completion_percentage >= 75 ? '#C0C0C0' :
                     stats.master_completion_percentage >= 50 ? '#CD7F32' : '#8B4513')
            .setTimestamp()
            .setFooter({ 
                text: `Master Complete: ${stats.master_completion_percentage}% | Variant Collection: ${stats.variant_completion_percentage}%`,
                iconURL: targetUser.displayAvatarURL({ dynamic: true })
            });

        // Special master set thumbnail
        const masterEmoji = this.getMasterProgressEmoji(parseFloat(stats.master_completion_percentage));
        embed.setThumbnail(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${masterEmoji}.png`);

        // Create action rows
        const components = [];

        // Navigation buttons (if multiple pages)
        if (totalPages > 1) {
            const navRow = new ActionRowBuilder();
            
            if (currentPage > 1) {
                navRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`masterdex_page_${targetUser.id}_${currentPage - 1}`)
                        .setLabel('◀ Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('⬅️')
                );
            }

            navRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('master_page_info')
                    .setLabel(`${currentPage} / ${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
                    .setEmoji('🎖️')
            );

            if (currentPage < totalPages) {
                navRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`masterdex_page_${targetUser.id}_${currentPage + 1}`)
                        .setLabel('Next ▶')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('➡️')
                );
            }

            components.push(navRow);
        }

        // Completion filter buttons
        const completionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`masterdex_completion_${targetUser.id}_all`)
                    .setLabel('All')
                    .setEmoji('🗂️')
                    .setStyle(completionFilter === 'all' ? ButtonStyle.Success : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`masterdex_completion_${targetUser.id}_master_complete`)
                    .setLabel('Master')
                    .setEmoji('🎖️')
                    .setStyle(completionFilter === 'master_complete' ? ButtonStyle.Success : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`masterdex_completion_${targetUser.id}_partial`)
                    .setLabel('Partial')
                    .setEmoji('⭐')
                    .setStyle(completionFilter === 'partial' ? ButtonStyle.Success : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`masterdex_completion_${targetUser.id}_missing`)
                    .setLabel('Missing')
                    .setEmoji('❌')
                    .setStyle(completionFilter === 'missing' ? ButtonStyle.Success : ButtonStyle.Secondary)
            );

        components.push(completionRow);

        // Variant filter dropdown
        const variantSelectRow = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`masterdex_variant_${targetUser.id}`)
                    .setPlaceholder('✨ Select variant type to filter')
                    .addOptions([
                        { label: 'All Variants', value: 'all', emoji: '🌟', description: 'Show all card variants' },
                        { label: 'Normal Cards', value: 'normal', emoji: '🎴', description: 'Standard card variants' },
                        { label: 'Reverse Holo', value: 'reverse', emoji: '🔄', description: 'Reverse holographic variants' },
                        { label: 'Holographic', value: 'holo', emoji: '✨', description: 'Full holographic variants' },
                        { label: 'First Edition', value: 'first_edition', emoji: '1️⃣', description: 'First edition prints' },
                        { label: 'Promotional', value: 'promo', emoji: '🎁', description: 'Special promo variants' }
                    ])
            );

        components.push(variantSelectRow);

        await interaction.editReply({
            embeds: [embed],
            components: components
        });
    },

    getMasterProgressEmoji(percentage) {
        if (percentage >= 100) return 'master-ball';
        if (percentage >= 90) return 'ultra-ball';
        if (percentage >= 75) return 'great-ball';
        if (percentage >= 50) return 'poke-ball';
        return 'pokeball-closed';
    }
};
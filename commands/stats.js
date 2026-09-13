const { SlashCommandBuilder } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View detailed trainer statistics')
        .addUserOption(option => option
            .setName('user')
            .setDescription('View another trainer\'s statistics')
            .setRequired(false)
        ),

    async execute(interaction, { database, userManager }) {
        const targetUser = interaction.options.getUser('user') || interaction.user;

        try {
            await interaction.deferReply();

            const user = await userManager.getUser(targetUser.id);
            if (!user) {
                return await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Trainer Not Found',
                        `${targetUser.username} has not started a trainer account yet.`
                    )]
                });
            }

            const [rarityDrawRows, collectionRarityRows, collectionTotals, collectorStats] = await Promise.all([
                database.all(`
                    SELECT rarity, draw_count
                    FROM user_rarity_draws
                    WHERE user_id = ?
                    ORDER BY draw_count DESC, rarity ASC
                `, [targetUser.id]),
                database.all(`
                    SELECT COALESCE(c.rarity, 'Unknown') AS rarity, SUM(uc.quantity) AS quantity
                    FROM user_cards uc
                    JOIN cards c ON c.id = uc.card_id
                    WHERE uc.user_id = ?
                    GROUP BY c.rarity
                    ORDER BY quantity DESC
                `, [targetUser.id]),
                database.get(`
                    SELECT COUNT(DISTINCT card_id) AS unique_cards,
                           COALESCE(SUM(quantity), 0) AS total_cards
                    FROM user_cards
                    WHERE user_id = ?
                `, [targetUser.id]),
                this.getCollectorStats(database, targetUser.id)
            ]);

            const rarityDrawBreakdown = rarityDrawRows.length
                ? rarityDrawRows.map(row => `• **${row.rarity}**: ${Number(row.draw_count || 0).toLocaleString()}`).join('\n')
                : 'No tracked draws yet. New draws will appear here.';
            const collectionRarityBreakdown = collectionRarityRows.length
                ? collectionRarityRows.map(row => `• **${row.rarity}**: ${Number(row.quantity || 0).toLocaleString()}`).join('\n')
                : 'No cards collected yet.';

            const embed = EmbedUtils.createBaseEmbed({
                title: `📊 ${targetUser.username} • Trainer Stats`,
                description: 'A detailed snapshot of this trainer\'s progress and collection.',
                color: EmbedUtils.palette.brand,
                thumbnail: EmbedUtils.resolveAvatarURL(targetUser),
                footerText: `Requested by ${interaction.user.username}`,
                footerIcon: EmbedUtils.resolveAvatarURL(interaction.user),
                fields: [
                    { name: '🎴 Card Draws', value: `${Number(user.total_draws || 0).toLocaleString()}`, inline: true },
                    { name: '🎲 Risky Deals', value: `${Number(user.risky_deals || 0).toLocaleString()}`, inline: true },
                    { name: '💰 Current Gold', value: `${Number(user.gold || 0).toLocaleString()} 🪙`, inline: true },
                    { name: '🪙 Current Coins', value: `${Number(user.coins || 0).toLocaleString()}`, inline: true },
                    { name: '🎴 Unique Cards', value: `${Number(collectionTotals?.unique_cards || 0).toLocaleString()}`, inline: true },
                    { name: '📦 Total Cards', value: `${Number(collectionTotals?.total_cards || 0).toLocaleString()}`, inline: true },
                    { name: '✨ Draws by Rarity', value: rarityDrawBreakdown, inline: false },
                    { name: '📚 Owned by Rarity', value: collectionRarityBreakdown, inline: false },
                    { name: '🏬 Collector Production', value: collectorStats, inline: false }
                ]
            });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in stats command:', error);
            const response = { embeds: [EmbedUtils.createErrorEmbed('Stats Error', 'Unable to load trainer statistics right now.')] };
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(response);
            } else {
                await interaction.reply({ ...response, flags: 64 });
            }
        }
    },

    async getCollectorStats(database, userId) {
        try {
            const shop = await database.get(`
                SELECT lifetime_coins_generated, lifetime_cards_generated, lifetime_packs_generated
                FROM collector_shops
                WHERE user_id = ?
            `, [userId]);

            if (!shop) return 'No collector shop established yet.';

            return [
                `• Coins generated: **${Number(shop.lifetime_coins_generated || 0).toLocaleString()}**`,
                `• Cards generated: **${Number(shop.lifetime_cards_generated || 0).toLocaleString()}**`,
                `• Packs generated: **${Number(shop.lifetime_packs_generated || 0).toLocaleString()}**`
            ].join('\n');
        } catch {
            return 'Collector production data unavailable.';
        }
    }
};
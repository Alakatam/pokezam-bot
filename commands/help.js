const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');

const HELP_CATEGORIES = {
    overview: {
        title: '🏆 Pokézam Command Hub',
        description: 'Your premium trainer dashboard for collection, progression, and elite rewards.',
        color: EmbedUtils.palette.brand,
        fields: [
            { name: '🎴 Core Loop', value: 'Use `/start`, `/zam`, `/quest`, and `/inventory` to build momentum fast.', inline: false },
            { name: '📦 Best First Actions', value: 'Open your starter chest, complete quests, and keep drawing for steady upgrades.', inline: false },
            { name: '⚡ Power Moves', value: 'Use `/shop`, `/binder`, `/profile`, and `/carddex-reg` to scale your collection efficiently.', inline: false }
        ]
    },
    collection: {
        title: '📚 Collection & Binder',
        description: 'Track your cards, sets, and trading progress like a pro.',
        color: EmbedUtils.palette.accent,
        fields: [
            { name: '/binder', value: 'Browse your owned cards by set and rarity.', inline: true },
            { name: '/profile', value: 'Check trainer stats, collection size, and current progress.', inline: true },
            { name: '/carddex-reg', value: 'Explore the full Pokézam TCG database and card registry.', inline: true },
            { name: '💡 Tip', value: 'Collecting rare variants early unlocks stronger gold and progression spikes.', inline: false }
        ]
    },
    progression: {
        title: '🚀 Progression & Quests',
        description: 'Push your trainer forward with quests, rewards, and consistent leveling.',
        color: EmbedUtils.palette.warning,
        fields: [
            { name: '/quest', value: 'Complete daily and weekly objectives for gold and XP.', inline: true },
            { name: '/daily', value: 'Claim your recurring daily rewards and streak bonuses.', inline: true },
            { name: '/active-boosts', value: 'Monitor current buffs, charms, and temporary bonuses.', inline: true },
            { name: '🎯 Strategy', value: 'Prioritize quest completion first, then spend gold on upgrades and boost items.', inline: false }
        ]
    },
    economy: {
        title: '💰 Economy & Shop',
        description: 'Buy smarter, stack boosts, and play the long game with efficient upgrades.',
        color: EmbedUtils.palette.success,
        fields: [
            { name: '/shop', value: 'Buy premium items, boosts, and progression enhancers.', inline: true },
            { name: '/inventory', value: 'Manage active items and your trainer inventory.', inline: true },
            { name: '/use', value: 'Activate treasure chests and consumable bonuses at the right moment.', inline: true },
            { name: '💸 Rule', value: 'Spend gold on items that increase draw efficiency and reward conversion, not random churn.', inline: false }
        ]
    }
};

function buildHelpButtons(activeCategory = 'overview') {
    const categories = [
        { id: 'overview', label: 'Overview' },
        { id: 'collection', label: 'Collection' },
        { id: 'progression', label: 'Progression' },
        { id: 'economy', label: 'Economy' }
    ];

    return new ActionRowBuilder().addComponents(
        categories.map(({ id, label }) =>
            new ButtonBuilder()
                .setCustomId(`help_${id}`)
                .setLabel(label)
                .setStyle(id === activeCategory ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setDisabled(id === activeCategory)
        )
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Open the premium Pokézam command hub and quick-start guide'),

    async execute(interaction, context) {
        await this.showHelpOverview(interaction, context);
    },

    async showHelpOverview(interaction, context) {
        try {
            const category = HELP_CATEGORIES.overview;
            const embed = EmbedUtils.createBaseEmbed({
                title: category.title,
                description: category.description,
                color: category.color,
                footerText: 'Pokézam TCG • Elite trainer guide',
                footerIcon: interaction.client.user.displayAvatarURL(),
                fields: category.fields
            });

            await interaction.reply({
                embeds: [embed],
                components: [buildHelpButtons('overview')]
            });
        } catch (error) {
            console.error('Error in help command:', error);
            await interaction.reply({
                embeds: [EmbedUtils.createErrorEmbed('Help Error', 'An error occurred while loading the command hub. Please try again!')],
                ephemeral: true
            });
        }
    },

    async showHelpCategory(interaction, categoryKey) {
        const key = categoryKey && HELP_CATEGORIES[categoryKey] ? categoryKey : 'overview';
        const category = HELP_CATEGORIES[key];

        const embed = EmbedUtils.createBaseEmbed({
            title: category.title,
            description: category.description,
            color: category.color,
            footerText: 'Pokézam TCG • Elite trainer guide',
            footerIcon: interaction.client.user.displayAvatarURL(),
            fields: category.fields
        });

        await interaction.editReply({
            embeds: [embed],
            components: [buildHelpButtons(key)]
        });
    }
};
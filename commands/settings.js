const { SlashCommandBuilder } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Manage your Pokézam privacy and display preferences')
        .addStringOption(option => option.setName('showcase').setDescription('Appear in the global rare-card showcase').setRequired(false).addChoices(
            { name: 'Public - show my pull globally', value: 'public' },
            { name: 'Private - do not post my pull globally', value: 'private' }
        ))
        .addStringOption(option => option.setName('image').setDescription('Choose the card image style used by /zam').setRequired(false).addChoices(
            { name: 'Big image', value: 'big' },
            { name: 'Small thumbnail', value: 'small' }
        ))
        .addStringOption(option => option.setName('profile').setDescription('Allow other users to view your profile').setRequired(false).addChoices(
            { name: 'Public', value: 'public' },
            { name: 'Private', value: 'private' }
        ))
        .addStringOption(option => option.setName('stats').setDescription('Allow other users to view your stats').setRequired(false).addChoices(
            { name: 'Public', value: 'public' },
            { name: 'Private', value: 'private' }
        )),

    async execute(interaction, { userManager }) {
        try {
            await interaction.deferReply({ ephemeral: true });
            let user = await userManager.getUser(interaction.user.id);
            if (!user) user = await userManager.createUser(interaction.user.id, interaction.user.username);

            const updates = {};
            const showcase = interaction.options.getString('showcase');
            const image = interaction.options.getString('image');
            const profile = interaction.options.getString('profile');
            const stats = interaction.options.getString('stats');
            if (showcase) updates.showcase_visibility = showcase;
            if (image) updates.draw_image_mode = image;
            if (profile) updates.profile_visibility = profile;
            if (stats) updates.stats_visibility = stats;

            if (Object.keys(updates).length > 0) {
                user = await userManager.updateUser(interaction.user.id, updates);
            }

            const embed = EmbedUtils.createBaseEmbed({
                title: '⚙️ Pokézam Settings',
                description: 'Your preferences are private and apply to future interactions.',
                color: EmbedUtils.palette.brand,
                fields: [
                    { name: '🌐 Global Showcase', value: user.showcase_visibility === 'private' ? 'Private - rare pulls are not posted globally' : 'Public - rare pulls may appear globally', inline: false },
                    { name: '🖼️ /zam Image', value: user.draw_image_mode === 'small' ? 'Small thumbnail' : 'Big image', inline: true },
                    { name: '👤 Profile', value: user.profile_visibility === 'private' ? 'Private' : 'Public', inline: true },
                    { name: '📊 Stats', value: user.stats_visibility === 'private' ? 'Private' : 'Public', inline: true }
                ],
                footerText: 'Use /settings with one or more options to change them.'
            });
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in settings command:', error);
            const response = { embeds: [EmbedUtils.createErrorEmbed('Settings Error', 'Unable to update your settings right now.')] };
            if (interaction.deferred || interaction.replied) await interaction.editReply(response);
            else await interaction.reply({ ...response, ephemeral: true });
        }
    }
};
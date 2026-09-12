const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('master-collection')
        .setDescription('View your Master Set collection progress and variant statistics!'),
    cooldown: 5,
    
    async execute(interaction, { database, userManager, cardManager }) {
        try {
            await interaction.deferReply();
            
            const userId = interaction.user.id;
            let user = await userManager.getUser(userId);
            
            if (!user) {
                user = await userManager.createUser(userId, interaction.user.username);
            }

            // Get Master Set statistics
            const masterSetStats = await cardManager.getUserMasterSetStats(userId);

            // Calculate overall completion
            const totalOwned = (masterSetStats.owned.normal_variants || 0) + 
                             (masterSetStats.owned.reverse_variants || 0) + 
                             (masterSetStats.owned.holo_variants || 0) + 
                             (masterSetStats.owned.first_edition_variants || 0) + 
                             (masterSetStats.owned.promo_variants || 0);

            const totalAvailable = (masterSetStats.available.normal_available || 0) + 
                                  (masterSetStats.available.reverse_available || 0) + 
                                  (masterSetStats.available.holo_available || 0) + 
                                  (masterSetStats.available.first_edition_available || 0) + 
                                  (masterSetStats.available.promo_available || 0);

            const overallCompletion = totalAvailable > 0 ? ((totalOwned / totalAvailable) * 100).toFixed(1) : 0;
            const progressBar = EmbedUtils.createProgressBar(totalOwned, totalAvailable, 12);

            const fields = [
                {
                    name: '📊 Collection Overview',
                    value: `• **Unique Cards:** \`${(masterSetStats.owned.unique_cards || 0).toLocaleString()}\`\n• **Total Cards:** \`${(masterSetStats.owned.total_cards || 0).toLocaleString()}\`\n• **Est. Value:** \`${((masterSetStats.owned.total_cards || 0) * 500).toLocaleString()}\` 🪙`,
                    inline: true
                },
                {
                    name: '🎯 Completion Progress',
                    value: `• **Progress:** ${progressBar} \`(${overallCompletion}%)\`\n• **Rank:** \`${this.getCompletionRank(parseFloat(overallCompletion))}\`\n• **Milestone:** \`${this.getNextMilestone(totalOwned)}\``,
                    inline: true
                },
                {
                    name: '🌟 Master Set Variant Distribution',
                    value: `• 🔹 **Normal:** \`${masterSetStats.owned.normal_variants || 0}\` *(${masterSetStats.completion.normal}%)*\n• 🔸 **Reverse Holo:** \`${masterSetStats.owned.reverse_variants || 0}\` *(${masterSetStats.completion.reverse}%)*\n• ✨ **Holographic:** \`${masterSetStats.owned.holo_variants || 0}\` *(${masterSetStats.completion.holo}%)*\n• 🥇 **1st Edition:** \`${masterSetStats.owned.first_edition_variants || 0}\` *(${masterSetStats.completion.first_edition}%)*\n• 🎁 **Promotional:** \`${masterSetStats.owned.promo_variants || 0}\` *(${masterSetStats.completion.promo}%)*`,
                    inline: false
                }
            ];

            const embed = EmbedUtils.createBaseEmbed({
                author: { name: `${interaction.user.displayName}'s Master Collection`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) },
                title: '🏆 Master Set Collection Progress',
                description: `Track your variant statistics, completion milestones, and rare parallel sets below.`,
                color: overallCompletion >= 50 ? EmbedUtils.palette.gold : EmbedUtils.palette.brand,
                footerText: `Level ${user.level} Trainer • ${user.gold.toLocaleString()} 🪙 Balance`,
                footerIcon: interaction.user.displayAvatarURL({ dynamic: true }),
                fields
            });

            await interaction.editReply({ embeds: [embed] });

            // Add reactions based on progress
            const reply = await interaction.fetchReply();
            await reply.react('🏆');
            
            if (masterSetStats.owned.first_edition_variants >= 5) await reply.react('🥇');
            if (masterSetStats.owned.holo_variants >= 10) await reply.react('✨');
            if (overallCompletion >= 50) await reply.react('💎');

        } catch (error) {
            console.error('Error in master collection command:', error);
            await interaction.editReply({
                embeds: [EmbedUtils.createErrorEmbed(
                    'Collection Error',
                    'An error occurred while retrieving your Master Set collection data.'
                )]
            });
        }
    },

    getCompletionRank(percentage) {
        if (percentage >= 90) return 'Master Collector 🏆';
        if (percentage >= 75) return 'Expert Collector 🥇';
        if (percentage >= 50) return 'Advanced Collector ✨';
        if (percentage >= 25) return 'Skilled Collector 🔸';
        if (percentage >= 10) return 'Rising Collector 🔹';
        if (percentage >= 5) return 'Apprentice Collector 📚';
        return 'Novice Collector 🌱';
    },

    getNextMilestone(totalOwned) {
        const milestones = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
        const nextMilestone = milestones.find(m => m > totalOwned);
        return nextMilestone ? `${nextMilestone} total variants` : 'Maximum achieved! 🏆';
    }
};
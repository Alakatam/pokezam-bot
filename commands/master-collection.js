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

            // Create collection overview embed
            let yamlDescription = '```yaml\n';
            yamlDescription += '#═══════════════════════════════════════════════════\n';
            yamlDescription += `# 🏆 ${interaction.user.username.toUpperCase()}'S MASTER SET COLLECTION\n`;
            yamlDescription += '#═══════════════════════════════════════════════════\n\n';

            yamlDescription += '📊 COLLECTION OVERVIEW:\n';
            yamlDescription += `   Unique Cards       : ${masterSetStats.owned.unique_cards || 0}\n`;
            yamlDescription += `   Total Cards        : ${masterSetStats.owned.total_cards || 0}\n`;
            yamlDescription += `   Collection Value   : ${((masterSetStats.owned.total_cards || 0) * 500).toLocaleString()} 🪙 estimated\n\n`;

            yamlDescription += '🌟 MASTER SET VARIANTS:\n';
            yamlDescription += `   🔹 Normal          : ${masterSetStats.owned.normal_variants || 0} (${masterSetStats.completion.normal}%)\n`;
            yamlDescription += `   🔸 Reverse Holo    : ${masterSetStats.owned.reverse_variants || 0} (${masterSetStats.completion.reverse}%)\n`;
            yamlDescription += `   ✨ Holographic     : ${masterSetStats.owned.holo_variants || 0} (${masterSetStats.completion.holo}%)\n`;
            yamlDescription += `   🥇 1st Edition     : ${masterSetStats.owned.first_edition_variants || 0} (${masterSetStats.completion.first_edition}%)\n`;
            yamlDescription += `   🎁 Promotional     : ${masterSetStats.owned.promo_variants || 0} (${masterSetStats.completion.promo}%)\n\n`;

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

            yamlDescription += '🎯 COMPLETION PROGRESS:\n';
            yamlDescription += `   Overall Progress   : ${overallCompletion}% (${totalOwned}/${totalAvailable})\n`;
            yamlDescription += `   Completion Rank    : ${this.getCompletionRank(parseFloat(overallCompletion))}\n\n`;

            // Show rarest variants owned
            const rareVariants = [];
            if (masterSetStats.owned.first_edition_variants > 0) {
                rareVariants.push(`🥇 ${masterSetStats.owned.first_edition_variants} First Edition`);
            }
            if (masterSetStats.owned.holo_variants > 0) {
                rareVariants.push(`✨ ${masterSetStats.owned.holo_variants} Holographic`);
            }
            if (masterSetStats.owned.promo_variants > 0) {
                rareVariants.push(`🎁 ${masterSetStats.owned.promo_variants} Promotional`);
            }

            if (rareVariants.length > 0) {
                yamlDescription += '💎 RARE VARIANTS OWNED:\n';
                rareVariants.forEach(variant => {
                    yamlDescription += `   ${variant}\n`;
                });
                yamlDescription += '\n';
            }

            yamlDescription += '📈 COLLECTION GOALS:\n';
            if (masterSetStats.owned.first_edition_variants < 10) {
                yamlDescription += `   Next Goal          : Collect ${10 - (masterSetStats.owned.first_edition_variants || 0)} more 1st Edition cards\n`;
            } else if (masterSetStats.owned.holo_variants < 25) {
                yamlDescription += `   Next Goal          : Collect ${25 - (masterSetStats.owned.holo_variants || 0)} more Holographic cards\n`;
            } else {
                yamlDescription += `   Next Goal          : Complete Master Set Collection (100%)\n`;
            }
            
            const nextMilestone = this.getNextMilestone(totalOwned);
            yamlDescription += `   Next Milestone     : ${nextMilestone}\n\n`;

            yamlDescription += '#═══════════════════════════════════════════════════\n';
            yamlDescription += '```';

            // Determine embed color and title based on progress
            let embedColor = '#3498DB';
            let embedTitle = '🏆 Master Set Collection';
            
            if (overallCompletion >= 75) {
                embedColor = '#FFD700';
                embedTitle = '🥇 Master Set Collection - Legendary Collector!';
            } else if (overallCompletion >= 50) {
                embedColor = '#9B59B6';
                embedTitle = '✨ Master Set Collection - Expert Collector!';
            } else if (overallCompletion >= 25) {
                embedColor = '#E91E63';
                embedTitle = '🔸 Master Set Collection - Advanced Collector!';
            } else if (overallCompletion >= 10) {
                embedColor = '#2ECC71';
                embedTitle = '🔹 Master Set Collection - Rising Collector!';
            }

            const embed = new EmbedBuilder()
                .setTitle(embedTitle)
                .setDescription(yamlDescription)
                .setColor(embedColor)
                .setTimestamp()
                .setFooter({ 
                    text: `Level ${user.level} • ${user.gold.toLocaleString()} 🪙`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                });

            // Add thumbnail based on collection level
            if (overallCompletion >= 50) {
                embed.setThumbnail('https://assets.tcgdx.net/en/base/base1/4'); // Charizard for high collectors
            }

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
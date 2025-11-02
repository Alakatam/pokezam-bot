const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageReactionAdd,
    async execute(reaction, user, bot) {
        // Don't track bot reactions
        if (user.bot) return;

        try {
            // Check if this is a reaction to a card (message with embeds from the bot)
            if (reaction.message.author.id === bot.client.user.id && 
                reaction.message.embeds.length > 0 &&
                reaction.emoji.name === '⭐') {
                
                // Update quest progress for "The Socialite"
                await bot.questManager.initializeUserQuests(user.id);
                const completedQuests = await bot.questManager.updateQuestProgress(user.id, 'The Socialite', 1);
                
                // Notify user if quest completed
                if (completedQuests.length > 0) {
                    try {
                        const EmbedUtils = require('../utils/EmbedUtils');
                        const questEmbed = EmbedUtils.createSuccessEmbed(
                            '🎉 Quest Completed!',
                            completedQuests.map(q => `**${q.name}** - Earned ${q.reward} 🪙 Gold!`).join('\n')
                        );
                        
                        await user.send({ embeds: [questEmbed] });
                    } catch (error) {
                        // User might have DMs disabled, that's okay
                        console.log(`Could not DM quest completion to ${user.username}`);
                    }
                }
            }
        } catch (error) {
            console.error('Error handling reaction for quest tracking:', error);
        }
    },
};
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('debug')
        .setDescription('Debug database connectivity and user data'),
    
    async execute(interaction, { database, userManager, cardManager, questManager }) {
        try {
            await interaction.deferReply({ ephemeral: true });
            
            const userId = interaction.user.id;
            let debugInfo = `🔍 **Debug Report for ${interaction.user.username}**\n\n`;
            
            // Check database connection
            try {
                const cardCount = await database.get('SELECT COUNT(*) as count FROM cards');
                debugInfo += `📊 **Database Status:**\n`;
                debugInfo += `- Cards in database: ${cardCount.count}\n`;
                debugInfo += `- Database connected: ✅\n\n`;
            } catch (error) {
                debugInfo += `📊 **Database Status:**\n`;
                debugInfo += `- Database error: ❌ ${error.message}\n\n`;
            }
            
            // Check user status
            try {
                const user = await userManager.getUser(userId);
                debugInfo += `👤 **User Status:**\n`;
                debugInfo += `- User ID: ${userId}\n`;
                debugInfo += `- User exists: ${user ? '✅' : '❌'}\n`;
                if (user) {
                    debugInfo += `- Username: ${user.username}\n`;
                    debugInfo += `- Level: ${user.level}\n`;
                    debugInfo += `- Has started: ${user.has_started ? '✅' : '❌'}\n`;
                    debugInfo += `- Gold: ${user.gold}\n`;
                }
                debugInfo += '\n';
            } catch (error) {
                debugInfo += `👤 **User Status:**\n`;
                debugInfo += `- User error: ❌ ${error.message}\n\n`;
            }
            
            // Check card availability
            try {
                const randomCard = await cardManager.getRandomCard(1);
                debugInfo += `🎴 **Card System:**\n`;
                debugInfo += `- Can get random card: ${randomCard ? '✅' : '❌'}\n`;
                if (randomCard) {
                    debugInfo += `- Sample card: ${randomCard.name} (${randomCard.set_name})\n`;
                }
                debugInfo += '\n';
            } catch (error) {
                debugInfo += `🎴 **Card System:**\n`;
                debugInfo += `- Card error: ❌ ${error.message}\n\n`;
            }
            
            // Check quest availability  
            try {
                await questManager.initializeUserQuests(userId);
                const quests = await questManager.getUserQuests(userId);
                debugInfo += `🎯 **Quest System:**\n`;
                debugInfo += `- User quests found: ${quests.length}\n`;
                if (quests.length > 0) {
                    debugInfo += `- Sample quest: ${quests[0].name}\n`;
                }
            } catch (error) {
                debugInfo += `🎯 **Quest System:**\n`;
                debugInfo += `- Quest error: ❌ ${error.message}\n\n`;
            }
            
            await interaction.editReply({
                content: debugInfo
            });
            
        } catch (error) {
            console.error('Debug command error:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: `❌ Debug command failed: ${error.message}`,
                    ephemeral: true
                });
            } else {
                await interaction.editReply({
                    content: `❌ Debug command failed: ${error.message}`
                });
            }
        }
    }
};
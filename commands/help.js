const { SlashCommandBuilder } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Get help with bot commands and features'),
    
    async execute(interaction, { database, userManager, cardManager, questManager }) {
        try {
            // Create compact help format to fit Discord's 4096 character limit
            const yamlHelp = `\`\`\`yaml
#═══════════════════════════════════════════════════
# 🎮 POKÉZAM BOT - COMMAND REFERENCE
#═══════════════════════════════════════════════════

📱 CORE COMMANDS:
   /draw                  : Draw Pokemon cards (5s cooldown)
   /profile [user]        : View trainer stats & collection
   /binder [user]         : Browse your card binder by set
   /master-collection     : View Master Set variant progress
   /quest                 : View daily & weekly challenges

🎁 PREMIUM PACKS:
   /premium-pack          : 100,000 🪙 | Enhanced variant odds
   /master-pack           : 250,000 🪙 | Guaranteed rare variants
   /vintage-pack          : 500,000 🪙 | 40% 1st Edition focus

🌟 MASTER SET VARIANTS:
   🔹 Normal             : Standard (100% gold)
   🔸 Reverse Holo       : Reverse shine (150% gold)
   ✨ Holographic        : Rainbow holo (300% gold)
   🥇 1st Edition        : Museum quality (600% gold)
   🎁 Promotional        : Special promos (400% gold)

🎯 CARD RARITIES & XP REWARDS:
   Common    : 1 XP  | 100-250 Gold | White embeds
   Uncommon  : 2 XP  | 250-400 Gold | Green embeds  
   Rare      : 5 XP  | 400-1000 Gold | Blue embeds
   Holo Rare : 10 XP | 1000-2000 Gold | Purple embeds
   Ultra/EX  : 25 XP | 2000-5000 Gold | Pink embeds
   Secret    : 50 XP | 5000-10000 Gold | Orange embeds

📊 GENERATION PROGRESSION:
   Level 1+   : Generation I (Kanto - Base Set)
   Level 35+  : Generation III (Hoenn - EX Series)
   Level 60+  : Generation IV (Sinnoh - D&P)
   Level 110+ : Generation V (Unova - B&W)
   Level 150+ : Generation VII (Alola - S&M)
   Level 200+ : Generation IX (Paldea - S&V)

🎯 QUEST SYSTEM:
   Daily quests: Steady gold income
   Weekly quests: Bigger rewards
   The Grinder: Draw 100 cards (50 🪙)
   The Socialite: React to 5 cards (25 🪙)

💡 PRO TIPS:
   • Use /binder to explore your collection
   • Complete dailies consistently for gold
   • Invest in premium packs for rare variants
   • Draw regularly to unlock new eras

#═══════════════════════════════════════════════════
\`\`\``;

            const embed = EmbedUtils.createInfoEmbed(
                '📚 Command Reference',
                yamlHelp
            );

            embed.setFooter({ 
                text: 'Happy collecting! 🎉',
                iconURL: interaction.client.user.displayAvatarURL()
            });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in help command:', error);
            await interaction.reply({
                embeds: [EmbedUtils.createErrorEmbed(
                    'Help Error',
                    'An error occurred while loading help information. Please try again!'
                )],
                ephemeral: true
            });
        }
    }
};
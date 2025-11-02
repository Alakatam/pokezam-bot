const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quest')
        .setDescription('View your daily, weekly, and monthly quests with automatic assignment'),
    
    async execute(interaction, { database, userManager, cardManager, questManager }) {
        try {
            await interaction.deferReply();
            
            const userId = interaction.user.id;
            
            // Ensure user exists
            let user = await userManager.getUser(userId);
            if (!user) {
                user = await userManager.createUser(userId, interaction.user.username);
            }

            // Check if user has started their adventure
            if (!user.has_started) {
                const yamlContent = `\`\`\`yaml
#═══════════════════════════════════════════════════
# 🎯 QUEST SYSTEM LOCKED - START YOUR ADVENTURE!
#═══════════════════════════════════════════════════

quest access           : "RESTRICTED"
trainer status         : "Adventure not started"
required action        : "Complete trainer onboarding"

#───────────────────────────────────────────────────
# 🏆 QUEST REWARDS WAITING FOR YOU
#───────────────────────────────────────────────────

daily quests:
  card hunter          : "10 XP + 150 Gold 🪙"
  collection builder   : "25 XP + 400 Gold 🪙" 
  daily dedication     : "50 XP + 800 Gold 🪙"

weekly challenges:
  collector            : "75 XP + 1,000 Gold 🪙"
  explorer             : "150 XP + 2,500 Gold 🪙"
  master               : "300 XP + 5,000 Gold 🪙"

monthly legends:
  champion             : "500 XP + 10,000 Gold 🪙"
  legend               : "1,000 XP + 25,000 Gold 🪙"
  pokemon master       : "2,000 XP + 50,000 Gold 🪙"

#───────────────────────────────────────────────────
# ✨ START YOUR JOURNEY NOW!
#───────────────────────────────────────────────────

unlock command         : "Type '/start' to begin"
benefits               : "Quests + Cards + Shop + More!"

#═══════════════════════════════════════════════════
\`\`\``;

                return await interaction.editReply({
                    embeds: [{
                        title: '🎯 Quest System Locked - Start Your Adventure!',
                        description: yamlContent,
                        color: 0xffd700,
                        timestamp: new Date().toISOString(),
                        footer: {
                            text: `${interaction.user.username}, amazing rewards await!`,
                            icon_url: interaction.user.displayAvatarURL()
                        }
                    }]
                });
            }

            // Automatically assign and initialize all quest types
            await questManager.autoAssignQuests(userId);

            // Reset expired quests based on Eastern Time
            await questManager.resetExpiredQuestsEasternTime();

            // Show daily quests by default with navigation buttons
            await this.showQuestPage(interaction, questManager, userId, 'daily');

        } catch (error) {
            console.error('Error in quest command:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Quest Error',
                        'An error occurred while loading quest information. Please try again!'
                    )]
                });
            } else {
                await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Quest Error',
                        'An error occurred while loading quest information. Please try again!'
                    )]
                });
            }
        }
    },

    async showQuestPage(interaction, questManager, userId, questType = 'daily') {
        const userQuests = await questManager.getUserQuests(userId);
        
        if (userQuests.length === 0) {
            return await interaction.editReply({
                embeds: [EmbedUtils.createInfoEmbed(
                    'No Quests Available',
                    'No quests are currently available. Check back later!'
                )]
            });
        }

        // Filter quests by type
        const filteredQuests = userQuests.filter(q => q.quest_type === questType);
        
        if (filteredQuests.length === 0) {
            return await interaction.editReply({
                embeds: [EmbedUtils.createInfoEmbed(
                    `No ${questType.charAt(0).toUpperCase() + questType.slice(1)} Quests`,
                    `No ${questType} quests are currently available!`
                )]
            });
        }

        // Create embed with YAML format (no underscores)
        const embed = this.createQuestEmbed(filteredQuests, questType, questManager, interaction.user.username);
        
        // Create navigation buttons
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('quest_daily')
                    .setLabel('Daily')
                    .setEmoji('📅')
                    .setStyle(questType === 'daily' ? ButtonStyle.Primary : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('quest_weekly')
                    .setLabel('Weekly')
                    .setEmoji('📆')
                    .setStyle(questType === 'weekly' ? ButtonStyle.Primary : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('quest_monthly')
                    .setLabel('Monthly')
                    .setEmoji('🏆')
                    .setStyle(questType === 'monthly' ? ButtonStyle.Primary : ButtonStyle.Secondary)
            );

        await interaction.editReply({ 
            embeds: [embed],
            components: [buttons]
        });
    },

    createQuestEmbed(quests, questType, questManager, username) {
        const typeEmojis = {
            'daily': '📅',
            'weekly': '📆', 
            'monthly': '🏆'
        };

        const typeTitles = {
            'daily': 'DAILY QUESTS',
            'weekly': 'WEEKLY CHALLENGES',
            'monthly': 'MONTHLY LEGENDS'
        };

        let yamlContent = `\`\`\`yaml
#═══════════════════════════════════════════════════
# ${typeEmojis[questType]} ${username.toUpperCase()}'S ${typeTitles[questType]}
#═══════════════════════════════════════════════════

`;

        // Add reset information for the current quest type
        const resetInfo = this.getNextResetInfo(questType);
        yamlContent += `⏰ ${questType.toUpperCase()} RESET SCHEDULE:\n`;
        yamlContent += `   next reset time    : ${resetInfo.nextResetTime}\n`;
        yamlContent += `   reset frequency    : ${resetInfo.frequency}\n`;
        yamlContent += `   time until reset   : ${resetInfo.timeUntilReset}\n\n`;
        
        // Add visual separator between reset info and quests
        yamlContent += `#───────────────────────────────────────────────────\n`;
        yamlContent += `# 🎯 QUEST LIST\n`;
        yamlContent += `#───────────────────────────────────────────────────\n\n`;

        quests.forEach((quest, index) => {
            const progressBar = this.createProgressBar(quest.progress, quest.target_value);
            const status = quest.completed ? '✅ COMPLETE' : '⏳ IN PROGRESS';
            const progressPercent = Math.round((quest.progress / quest.target_value) * 100);
            const resetTime = questManager.getTimeUntilReset(quest.last_reset, quest.reset_interval);
            
            yamlContent += `🎯 quest ${index + 1}:\n`;
            yamlContent += `   title              : "${quest.name}"\n`;
            yamlContent += `   description        : "${quest.description}"\n`;
            yamlContent += `   status             : ${status}\n`;
            yamlContent += `   progress           : ${progressBar} ${progressPercent}%\n`;
            yamlContent += `   completion         : ${quest.progress.toLocaleString()} / ${quest.target_value.toLocaleString()}\n`;
            yamlContent += `   reward gold        : ${quest.reward_gold.toLocaleString()} 🪙\n`;
            yamlContent += `   reward xp          : ${(quest.reward_xp || 0).toLocaleString()} ✨\n`;
            yamlContent += `   reset status       : ${quest.completed ? resetTime : 'Active'}\n`;
            
            // Add separator between quests (except for the last one)
            if (index < quests.length - 1) {
                yamlContent += `\n# ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n\n`;
            } else {
                yamlContent += `\n\n`;
            }
        });
        
        yamlContent += `#═══════════════════════════════════════════════════
\`\`\``;

        const typeColors = {
            'daily': '#00ff00',
            'weekly': '#0099ff',
            'monthly': '#ffd700'
        };

        // Get current Eastern Time for footer
        const now = new Date();
        const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
        const easternTimeString = easternTime.toLocaleString('en-US', {
            timeZone: "America/New_York",
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });

        const embed = new EmbedBuilder()
            .setTitle(`${typeEmojis[questType]} ${typeTitles[questType]}`)
            .setColor(typeColors[questType])
            .setDescription(yamlContent)
            .setTimestamp();

        return embed;
    },

    createProgressBar(current, total, length = 15) {
        const percentage = Math.min(current / total, 1);
        const filledLength = Math.round(length * percentage);
        const emptyLength = length - filledLength;
        
        const filledBar = '█'.repeat(filledLength);
        const emptyBar = '░'.repeat(emptyLength);
        
        return `${filledBar}${emptyBar}`;
    },

    getNextResetInfo(questType) {
        // Get current time in Eastern Time
        const now = new Date();
        const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
        
        let nextReset, frequency, resetDescription;
        
        if (questType === 'daily') {
            // Daily resets at 22:00 ET every day
            nextReset = new Date(easternTime);
            nextReset.setHours(22, 0, 0, 0);
            
            // If it's already past 22:00 today, set to tomorrow
            if (easternTime.getHours() >= 22) {
                nextReset.setDate(nextReset.getDate() + 1);
            }
            
            frequency = "Every day at 22:00 ET";
            resetDescription = "Daily";
            
        } else if (questType === 'weekly') {
            // Weekly resets every Sunday at 22:00 ET
            nextReset = new Date(easternTime);
            const daysUntilSunday = (7 - easternTime.getDay()) % 7;
            
            if (daysUntilSunday === 0 && easternTime.getHours() < 22) {
                // It's Sunday and before 22:00, reset today
                nextReset.setHours(22, 0, 0, 0);
            } else {
                // Set to next Sunday
                nextReset.setDate(nextReset.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));
                nextReset.setHours(22, 0, 0, 0);
            }
            
            frequency = "Every Sunday at 22:00 ET";
            resetDescription = "Weekly";
            
        } else if (questType === 'monthly') {
            // Monthly resets on the last day of the month at 22:00 ET
            nextReset = new Date(easternTime);
            const lastDayOfMonth = new Date(nextReset.getFullYear(), nextReset.getMonth() + 1, 0);
            
            if (easternTime.getDate() === lastDayOfMonth.getDate() && easternTime.getHours() < 22) {
                // It's the last day and before 22:00, reset today
                nextReset = new Date(lastDayOfMonth);
                nextReset.setHours(22, 0, 0, 0);
            } else {
                // Set to last day of next month
                nextReset = new Date(nextReset.getFullYear(), nextReset.getMonth() + 1, 0);
                nextReset.setHours(22, 0, 0, 0);
            }
            
            frequency = "Last day of month at 22:00 ET";
            resetDescription = "Monthly";
        }
        
        // Calculate time until reset
        const timeDiff = nextReset.getTime() - easternTime.getTime();
        const timeUntilReset = this.formatTimeDifference(timeDiff);
        
        // Format the next reset time
        const resetTimeOptions = {
            timeZone: "America/New_York",
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        };
        
        const nextResetTime = nextReset.toLocaleString('en-US', resetTimeOptions);
        
        return {
            nextResetTime,
            frequency,
            timeUntilReset,
            resetDescription
        };
    },

    formatTimeDifference(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const days = Math.floor(totalSeconds / (24 * 60 * 60));
        const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
        const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
        
        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }
};
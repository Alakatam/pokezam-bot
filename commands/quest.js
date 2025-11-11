const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');
const DebugManager = require('../utils/DebugManager');

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
            try {
                await questManager.autoAssignQuests(userId);
            } catch (questAssignError) {
                console.error('🚨 QUEST: Error in autoAssignQuests:', questAssignError.message);
                console.error('🚨 QUEST: Full error:', questAssignError);
            }

            // Reset expired quests based on Eastern Time
            console.log('🔍 QUEST: Starting resetExpiredQuestsEasternTime');
            try {
                await questManager.resetExpiredQuestsEasternTime();
                console.log('🔍 QUEST: resetExpiredQuestsEasternTime completed');
            } catch (resetError) {
                console.error('🚨 QUEST: Error in resetExpiredQuestsEasternTime:', resetError.message);
                console.error('🚨 QUEST: Full error:', resetError);
            }

            // Show daily quests by default with navigation buttons
            try {
                await this.showQuestPage(interaction, questManager, userId, 'daily');
            } catch (showPageError) {
                console.error('🚨 QUEST: Error in showQuestPage:', showPageError.message);
                console.error('🚨 QUEST: Full error:', showPageError);
                
                // Fallback response if quest page fails
                await interaction.editReply({
                    embeds: [{
                        title: '🔧 Quest System Maintenance',
                        description: `\`\`\`yaml
#═══════════════════════════════════════════════════
# 🎯 QUEST SYSTEM - TEMPORARY MAINTENANCE
#═══════════════════════════════════════════════════

system status          : "Under maintenance"
error type             : "Database schema mismatch"
expected resolution    : "Within 24 hours"

#───────────────────────────────────────────────────
# 🏆 WHAT'S HAPPENING
#───────────────────────────────────────────────────

issue                  : "Column alignment in progress"
user impact            : "Quests temporarily unavailable"
alternative commands   : "Use /daily, /shop, /zam, /profile"

#───────────────────────────────────────────────────
# 📈 YOUR PROGRESS IS SAFE
#───────────────────────────────────────────────────

user data              : "Fully preserved"
card collection        : "Safe and accessible"
gold balance           : "No impact"
daily rewards          : "Available via /daily command"

error details          : "${showPageError.message}"
\`\`\``,
                        color: 0xffaa00,
                        timestamp: new Date().toISOString(),
                        footer: {
                            text: `${interaction.user.username}, sorry for the inconvenience!`,
                            icon_url: interaction.user.displayAvatarURL()
                        }
                    }]
                });
            }

        } catch (error) {
            console.error('Error in quest command:', error);
            try {
                if (interaction.deferred && !interaction.replied) {
                    await interaction.editReply({
                        embeds: [EmbedUtils.createErrorEmbed(
                            'Quest Error',
                            'An error occurred while loading quest information. Please try again!'
                        )]
                    });
                } else if (!interaction.replied) {
                    await interaction.reply({
                        embeds: [EmbedUtils.createErrorEmbed(
                            'Quest Error',
                            'An error occurred while loading quest information. Please try again!'
                        )],
                        ephemeral: true
                    });
                }
            } catch (replyError) {
                console.error('Error sending quest error response:', replyError);
            }
        }
    },

    async showQuestPage(interaction, questManager, userId, questType = 'daily') {
        let userQuests;
        try {
            userQuests = await questManager.getUserQuests(userId);
        } catch (getUserQuestsError) {
            console.error('QUEST: Error in getUserQuests:', getUserQuestsError.message);
            throw getUserQuestsError; // Re-throw to be caught by parent
        }
        
        if (userQuests.length === 0) {
            return await interaction.editReply({
                embeds: [EmbedUtils.createInfoEmbed(
                    'No Quests Available',
                    'No quests are currently available. Check back later!'
                )]
            });
        }

        // Filter quests by type (include both active AND completed quests)
        const filteredQuests = userQuests.filter(q => q.quest_type === questType);
        
        if (filteredQuests.length === 0) {
            return await interaction.editReply({
                embeds: [EmbedUtils.createInfoEmbed(
                    `No ${questType.charAt(0).toUpperCase() + questType.slice(1)} Quests`,
                    `No ${questType} quests available yet. Check back later!`
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

        // COMPACT VERSION - Limit quests to fit 4096 character limit
        let yamlContent = `\`\`\`yaml\n#═══════════════════════════════════════════════════\n`;
        yamlContent += `# ${typeEmojis[questType]} ${username.toUpperCase()}'S ${typeTitles[questType]}\n`;
        yamlContent += `#═══════════════════════════════════════════════════\n\n`;

        // Add reset information for the current quest type
        const resetInfo = this.getNextResetInfo(questType);
        yamlContent += `⏰ ${questType.toUpperCase()} RESET SCHEDULE:\n`;
        yamlContent += `   next reset         : ${resetInfo.nextResetTime}\n`;
        yamlContent += `   frequency          : ${resetInfo.frequency}\n`;
        yamlContent += `   time until reset   : ${resetInfo.timeUntilReset}\n\n`;
        
        yamlContent += `#───────────────────────────────────────────────────\n`;
        yamlContent += `# 🎯 QUEST LIST (${quests.length} total)\n`;
        yamlContent += `#───────────────────────────────────────────────────\n\n`;

        // Calculate character budget per quest to stay under 4096
        const headerSize = yamlContent.length + 100; // 100 for closing
        const maxQuestChars = 4090 - headerSize; // Leave 6 char buffer
        const avgCharsPerQuest = 280; // Approximate
        const maxQuests = Math.floor(maxQuestChars / avgCharsPerQuest);

        // Show only first N quests to stay under limit
        const displayQuests = quests.slice(0, Math.min(quests.length, maxQuests));
        const hiddenCount = quests.length - displayQuests.length;

        // Separate quests into active and completed
        const activeQuests = displayQuests.filter(q => !q.completed);
        const completedQuests = displayQuests.filter(q => q.completed);

        // Show active quests first
        activeQuests.forEach((quest, index) => {
            const progressBar = this.createProgressBar(quest.progress, quest.target_value);
            const progressPercent = Math.round((quest.progress / quest.target_value) * 100);
            
            yamlContent += `🎯 quest ${index + 1}:\n`;
            yamlContent += `   title      : "${quest.name}"\n`;
            yamlContent += `   goal       : "${quest.description || 'Complete the objective'}"\n`;
            yamlContent += `   progress   : ${progressBar} ${progressPercent}%\n`;
            yamlContent += `   completion : ${quest.progress} / ${quest.target_value}\n`;
            yamlContent += `   rewards    : ${quest.reward_gold} 🪙 | ${quest.reward_xp || 0} ✨\n`;
            
            if (index < activeQuests.length - 1) {
                yamlContent += `\n# ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n\n`;
            }
        });

        // Add completed quests section
        if (completedQuests.length > 0) {
            if (activeQuests.length > 0) {
                yamlContent += `\n\n# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            }
            
            yamlContent += `# ✅ COMPLETED QUESTS (${completedQuests.length})\n\n`;
            
            completedQuests.forEach((quest, index) => {
                yamlContent += `✅ quest ${activeQuests.length + index + 1}:\n`;
                yamlContent += `   status     : "Quest Done - Reward Received"\n`;
                yamlContent += `   rewards    : ${quest.reward_gold} 🪙 | ${quest.reward_xp || 0} ✨\n`;
                
                if (index < completedQuests.length - 1) {
                    yamlContent += `\n`;
                }
            });
        }

        if (hiddenCount > 0) {
            yamlContent += `\n\n# ... ${hiddenCount} more quests (use buttons to view)\n`;
        }
        
        yamlContent += `\n#═══════════════════════════════════════════════════\n\`\`\``;

        const typeColors = {
            'daily': '#00ff00',
            'weekly': '#0099ff',
            'monthly': '#ffd700'
        };

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
        // Get current time in Eastern Time (properly!)
        const now = new Date();
        // Create Eastern Time Date object using proper UTC offset conversion
        const easternTimeString = now.toLocaleString("en-US", {timeZone: "America/New_York"});
        const easternTime = new Date(easternTimeString);
        
        let nextReset, frequency, resetDescription;
        
        // Compute timezone offset between UTC and Eastern Time for the current instant
        const etNowString = now.toLocaleString("en-US", { timeZone: "America/New_York" });
        const etNow = new Date(etNowString);
        const tzOffsetMillis = now.getTime() - etNow.getTime(); // millis to add to ET wall time to get UTC epoch

        if (questType === 'daily') {
            // Daily resets at 20:00 ET every day
            const currentET = etNow;

            const year = currentET.getFullYear();
            const month = currentET.getMonth();
            const date = currentET.getDate();

            // Build UTC epoch for ET 20:00 today
            let nextResetEpoch = Date.UTC(year, month, date, 20, 0, 0, 0) + tzOffsetMillis;

            // If it's already past 20:00 ET today, advance to tomorrow
            if (currentET.getHours() >= 20) {
                nextResetEpoch += 24 * 60 * 60 * 1000;
            }

            nextReset = new Date(nextResetEpoch);
            frequency = "Every day at 20:00 ET";
            resetDescription = "Daily";

        } else if (questType === 'weekly') {
            // Weekly resets every Sunday at 20:00 ET
            const currentET = etNow;
            const year = currentET.getFullYear();
            const month = currentET.getMonth();
            const date = currentET.getDate();

            const daysUntilSunday = (7 - currentET.getDay()) % 7;
            let targetDate = date + (daysUntilSunday === 0 && currentET.getHours() < 20 ? 0 : (daysUntilSunday === 0 ? 7 : daysUntilSunday));

            let nextResetEpoch = Date.UTC(year, month, targetDate, 20, 0, 0, 0) + tzOffsetMillis;
            nextReset = new Date(nextResetEpoch);

            frequency = "Every Sunday at 20:00 ET";
            resetDescription = "Weekly";

        } else if (questType === 'monthly') {
            // Monthly resets on 1st of month at 00:00 ET (midnight)
            const currentET = etNow;
            const year = currentET.getFullYear();
            const month = currentET.getMonth();
            const day = currentET.getDate();

            let targetYear = year;
            let targetMonth = month;

            // If we're on the 1st and it's before midnight, reset is today at 00:00
            // Otherwise, reset is next month on the 1st at 00:00
            if (day === 1 && currentET.getHours() === 0 && currentET.getMinutes() === 0) {
                // Exactly at midnight on 1st - show next month
                targetMonth = month + 1;
            } else if (day === 1 && currentET.getHours() < 24) {
                // After midnight on the 1st - show next month
                targetMonth = month + 1;
            } else {
                // Any other day - show next 1st of next month
                targetMonth = month + 1;
            }

            if (targetMonth > 11) {
                targetMonth = 0;
                targetYear = year + 1;
            }

            const nextResetEpoch = Date.UTC(targetYear, targetMonth, 1, 0, 0, 0, 0) + tzOffsetMillis;
            nextReset = new Date(nextResetEpoch);

            frequency = "1st of month at 00:00 ET";
            resetDescription = "Monthly";

            frequency = "Last day of month at 20:00 ET";
            resetDescription = "Monthly";
        }
        
        // Calculate time until reset
        const timeDiff = nextReset.getTime() - now.getTime();
        const timeUntilReset = this.formatTimeDifference(timeDiff);
        
        // Format the next reset time (use consistent ET timezone display)
        const resetTimeOptions = {
            timeZone: "America/New_York",
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        
        const nextResetTime = nextReset.toLocaleString('en-US', resetTimeOptions) + ' ET';
        
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
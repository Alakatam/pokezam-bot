const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Database = require('../database/Database');
const AchievementManager = require('../database/AchievementManager');
const UserManager = require('../database/UserManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('achievement')
        .setDescription('View your achievement progress and earned badges')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Filter achievements by category')
                .addChoices(
                    { name: '🎴 Collection', value: 'collection' },
                    { name: '⭐ Rarity', value: 'rarity' },
                    { name: '📈 Progression', value: 'progression' },
                    { name: '💰 Economy', value: 'economy' },
                    { name: '📋 Quests', value: 'quests' },
                    { name: '🌟 Community', value: 'community' },
                    { name: '🏆 All', value: 'all' }
                )
                .setRequired(false))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('View another user\'s achievements')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const category = interaction.options.getString('category') || 'all';
            
            const db = new Database();
            await db.connect();
            const achievementManager = new AchievementManager(db);
            const userManager = new UserManager(db);

            // Get user data for achievement checking
            const userData = await userManager.getUser(targetUser.id);
            if (!userData) {
                const embed = new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setTitle('❌ User Not Found')
                    .setDescription(`${targetUser.username} hasn't started their Pokemon journey yet!\n\nUse \`/start\` to begin collecting cards and earning achievements.`)
                    .setFooter({ text: 'Pokézam Achievement System' });

                await interaction.editReply({ embeds: [embed] });
                return;
            }

            // Get all achievements for this user
            let achievements = await achievementManager.getUserAchievements(targetUser.id);
            
            // Filter by category if specified
            if (category !== 'all') {
                achievements = achievements.filter(a => a.category === category);
            }

            // Get achievement stats
            const stats = await achievementManager.getAchievementStats(targetUser.id);

            // Create YAML formatted achievement display
            let yamlDescription = '```yaml\n';
            yamlDescription += '#═══════════════════════════════════════════════════\n';
            yamlDescription += `# 🏆 ${targetUser.username.toUpperCase()}'S ACHIEVEMENTS\n`;
            yamlDescription += '#═══════════════════════════════════════════════════\n\n';
            
            yamlDescription += `📊 PROGRESS OVERVIEW:\n`;
            yamlDescription += `   Total Achievements  : ${stats.total}\n`;
            yamlDescription += `   Completed          : ${stats.completed}\n`;
            yamlDescription += `   Progress           : ${stats.percentage}%\n`;
            yamlDescription += `   Category Filter    : "${category === 'all' ? 'ALL CATEGORIES' : category.toUpperCase()}"\n\n`;

            // Group achievements by category
            const categories = {};
            achievements.forEach(achievement => {
                if (!categories[achievement.category]) {
                    categories[achievement.category] = [];
                }
                categories[achievement.category].push(achievement);
            });

            // Display achievements by category in YAML format
            for (const [catName, catAchievements] of Object.entries(categories)) {
                const categoryEmoji = this.getCategoryEmoji(catName);
                yamlDescription += `${categoryEmoji} ${catName.toUpperCase()} ACHIEVEMENTS:\n`;
                
                catAchievements.forEach(achievement => {
                    const status = achievement.is_completed ? 'COMPLETED ✅' : 'IN PROGRESS 📋';
                    const progress = achievement.is_completed ? 
                        `${achievement.current_value}/${achievement.target_value}` :
                        `${achievement.current_value}/${achievement.target_value}`;
                    
                    yamlDescription += `   ${achievement.emoji} ${achievement.title}:\n`;
                    yamlDescription += `      Status          : "${status}"\n`;
                    yamlDescription += `      Progress        : ${progress}\n`;
                    yamlDescription += `      Description     : "${achievement.description}"\n`;
                    if (achievement.is_completed && achievement.reward_gold > 0) {
                        yamlDescription += `      Reward          : ${achievement.reward_gold.toLocaleString()} Gold\n`;
                    }
                    yamlDescription += '\n';
                });
            }

            yamlDescription += '#═══════════════════════════════════════════════════\n';
            yamlDescription += '```';

            const embed = new EmbedBuilder()
                .setTitle(`🏆 ${targetUser.username}'s Achievement Progress`)
                .setDescription(yamlDescription)
                .setColor('#FFD700')
                .setTimestamp()
                .setFooter({ 
                    text: `${stats.completed}/${stats.total} achievements unlocked • ${stats.percentage}% complete`,
                    iconURL: targetUser.displayAvatarURL({ dynamic: true })
                });

            // Add recent achievements if viewing own profile
            if (targetUser.id === interaction.user.id) {
                const recentAchievements = await achievementManager.getCompletedAchievements(targetUser.id);
                if (recentAchievements.length > 0) {
                    const recent = recentAchievements.slice(0, 3).map(achievement => {
                        const earnedDate = new Date(achievement.earned_at * 1000);
                        return `${achievement.emoji} **${achievement.title}** - ${this.getRelativeTime(earnedDate)}`;
                    }).join('\n');

                    embed.addFields([{
                        name: '🕒 Recently Earned',
                        value: recent,
                        inline: false
                    }]);
                }
            }

            embed.setFooter({ 
                text: `Pokézam Achievement System • ${stats.completed}/${stats.total} unlocked` 
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Achievement command error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('❌ Error')
                .setDescription('There was an error loading achievements. Please try again.')
                .setFooter({ text: 'If this persists, please contact support' });

            await interaction.editReply({ embeds: [errorEmbed] });
        } finally {
            if (db) {
                db.close();
            }
        }
    },

    // Helper methods
    createProgressBar(current, total, length = 20) {
        if (total === 0) return '▱'.repeat(length);
        
        const percentage = current / total;
        const filled = Math.round(length * percentage);
        const empty = length - filled;
        
        return '▰'.repeat(filled) + '▱'.repeat(empty);
    },

    getCategoryEmoji(category) {
        const emojis = {
            collection: '🎴',
            rarity: '⭐',
            progression: '📈',
            economy: '💰',
            quests: '📋',
            community: '🌟'
        };
        return emojis[category] || '🏆';
    },

    getProgressDisplay(achievement) {
        if (achievement.is_completed) return '✅';
        
        const progress = achievement.progress || 0;
        const target = achievement.condition_value;
        const percentage = Math.round((progress / target) * 100);
        
        return `(${progress}/${target} - ${percentage}%)`;
    },

    getProgressText(achievement) {
        if (achievement.is_completed) return 'Completed!';
        
        const progress = achievement.progress || 0;
        const target = achievement.condition_value;
        const remaining = target - progress;
        
        return `${remaining} more to go`;
    },

    chunkText(text, maxLength) {
        const chunks = [];
        const lines = text.split('\n\n');
        let currentChunk = '';
        
        for (const line of lines) {
            if (currentChunk.length + line.length + 2 > maxLength) {
                if (currentChunk) {
                    chunks.push(currentChunk);
                    currentChunk = line;
                } else {
                    // Single line is too long, truncate it
                    chunks.push(line.substring(0, maxLength - 3) + '...');
                }
            } else {
                if (currentChunk) currentChunk += '\n\n';
                currentChunk += line;
            }
        }
        
        if (currentChunk) {
            chunks.push(currentChunk);
        }
        
        return chunks;
    },

    getRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        
        if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
        return 'Just now';
    }
};
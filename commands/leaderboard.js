const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View server rankings of top Pokemon collectors')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Choose leaderboard category')
                .setRequired(false)
                .addChoices(
                    { name: '🏆 Level Rankings', value: 'level' },
                    { name: '🎴 Total Cards', value: 'cards' },
                    { name: '💎 Rare Cards', value: 'rare' },
                    { name: '🪙 Gold Wealth', value: 'gold' },
                    { name: '📊 Total Draws', value: 'draws' }
                )
        )
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page number (shows 10 users per page)')
                .setRequired(false)
                .setMinValue(1)
        ),
    
    async execute(interaction, { database, userManager }) {
        try {
            await interaction.deferReply();
            
            const category = interaction.options.getString('category') || 'level';
            const page = interaction.options.getInteger('page') || 1;
            const usersPerPage = 10;
            const offset = (page - 1) * usersPerPage;
            
            // Get total user count for pagination
            const totalUsersResult = await database.get('SELECT COUNT(*) as count FROM users WHERE has_started = 1');
            const totalUsers = totalUsersResult.count;
            const totalPages = Math.ceil(totalUsers / usersPerPage);
            
            if (page > totalPages && totalPages > 0) {
                return await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Invalid Page',
                        `Page ${page} doesn't exist! There are only ${totalPages} pages.`
                    )]
                });
            }
            
            // Build query based on category
            let orderBy = '';
            let categoryName = '';
            let categoryEmoji = '';
            let valueColumn = '';
            
            switch (category) {
                case 'level':
                    orderBy = 'ORDER BY u.level DESC, u.xp DESC';
                    categoryName = 'Level Rankings';
                    categoryEmoji = '🏆';
                    valueColumn = '"Level " || u.level || " (" || u.xp || " XP)"';
                    break;
                case 'cards':
                    orderBy = 'ORDER BY total_cards DESC, u.level DESC';
                    categoryName = 'Total Cards';
                    categoryEmoji = '🎴';
                    valueColumn = 'total_cards || " cards"';
                    break;
                case 'rare':
                    orderBy = 'ORDER BY rare_cards DESC, u.level DESC';
                    categoryName = 'Rare Cards';
                    categoryEmoji = '💎';
                    valueColumn = 'rare_cards || " rare cards"';
                    break;
                case 'gold':
                    orderBy = 'ORDER BY u.gold DESC, u.level DESC';
                    categoryName = 'Gold Wealth';
                    categoryEmoji = '🪙';
                    valueColumn = 'u.gold || " gold"';
                    break;
                case 'draws':
                    orderBy = 'ORDER BY u.total_draws DESC, u.level DESC';
                    categoryName = 'Total Draws';
                    categoryEmoji = '📊';
                    valueColumn = 'u.total_draws || " draws"';
                    break;
            }
            
            // Get leaderboard data with user stats
            const leaderboardQuery = `
                SELECT 
                    u.id,
                    u.username,
                    u.level,
                    u.xp,
                    u.gold,
                    u.total_draws,
                    COALESCE(uc.total_cards, 0) as total_cards,
                    COALESCE(uc.rare_cards, 0) as rare_cards,
                    ${valueColumn} as display_value
                FROM users u
                LEFT JOIN (
                    SELECT 
                        user_id,
                        COUNT(DISTINCT card_id) as total_cards,
                        COUNT(DISTINCT CASE WHEN c.rarity IN ('Rare', 'Holo Rare', 'Ultra Rare', 'Secret Rare') THEN card_id END) as rare_cards
                    FROM user_cards uc2
                    JOIN cards c ON uc2.card_id = c.id
                    GROUP BY user_id
                ) uc ON u.id = uc.user_id
                WHERE u.has_started = 1
                ${orderBy}
                LIMIT ? OFFSET ?
            `;
            
            const leaderboardUsers = await database.all(leaderboardQuery, [usersPerPage, offset]);
            
            if (leaderboardUsers.length === 0) {
                return await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'No Users Found',
                        'No users have started their Pokemon collection yet!'
                    )]
                });
            }
            
            // Find current user's rank in this category (if they exist)
            const userId = interaction.user.id;
            let userRank = null;
            
            // Get all users in order to find rank (SQLite compatible)
            const allUsersQuery = `
                SELECT u.id
                FROM users u
                LEFT JOIN (
                    SELECT 
                        user_id,
                        COUNT(DISTINCT card_id) as total_cards,
                        COUNT(DISTINCT CASE WHEN c.rarity IN ('Rare', 'Holo Rare', 'Ultra Rare', 'Secret Rare') THEN card_id END) as rare_cards
                    FROM user_cards uc2
                    JOIN cards c ON uc2.card_id = c.id
                    GROUP BY user_id
                ) uc ON u.id = uc.user_id
                WHERE u.has_started = 1
                ${orderBy}
            `;
            
            try {
                const allUsers = await database.all(allUsersQuery);
                userRank = allUsers.findIndex(user => user.id === userId) + 1;
                if (userRank === 0) userRank = null; // User not found
            } catch (error) {
                // User not found in rankings (hasn't started)
            }
            
            // Build leaderboard display
            let yamlDescription = '```yaml\n';
            yamlDescription += '#═══════════════════════════════════════════════════\n';
            yamlDescription += `# ${categoryEmoji} ${categoryName.toUpperCase()} LEADERBOARD\n`;
            yamlDescription += '#═══════════════════════════════════════════════════\n\n';
            
            // Add pagination info
            yamlDescription += '📊 LEADERBOARD INFO:\n';
            yamlDescription += `   Category           : "${categoryName}"\n`;
            yamlDescription += `   Page               : ${page} of ${totalPages}\n`;
            yamlDescription += `   Total Trainers     : ${totalUsers.toLocaleString()}\n`;
            if (userRank) {
                yamlDescription += `   Your Rank          : #${userRank}\n`;
            }
            yamlDescription += '\n';
            
            // Add rankings
            yamlDescription += `🏆 TOP ${Math.min(usersPerPage, leaderboardUsers.length)} TRAINERS:\n\n`;
            
            leaderboardUsers.forEach((user, index) => {
                const position = offset + index + 1;
                const medal = position <= 3 ? ['🥇', '🥈', '🥉'][position - 1] : '🏅';
                const isCurrentUser = user.id === userId;
                const prefix = isCurrentUser ? '👤' : '  ';
                
                yamlDescription += `${prefix} RANK ${position}: ${medal}\n`;
                yamlDescription += `   Trainer            : "${user.username}"\n`;
                yamlDescription += `   ${categoryName.padEnd(18)}: ${user.display_value}\n`;
                yamlDescription += `   Level              : ${user.level} (${user.xp.toLocaleString()} XP)\n`;
                
                if (index < leaderboardUsers.length - 1) {
                    yamlDescription += '\n';
                }
            });
            
            yamlDescription += '\n#═══════════════════════════════════════════════════\n';
            yamlDescription += '```';
            
            const embed = new EmbedBuilder()
                .setTitle(`${categoryEmoji} ${categoryName} Leaderboard`)
                .setDescription(yamlDescription)
                .setColor('#ffd700')
                .setTimestamp()
                .setFooter({ 
                    text: `Page ${page}/${totalPages} • Use /leaderboard category:${category} page:${page + 1} for next page`,
                    iconURL: interaction.client.user.displayAvatarURL()
                });
            
            // Add navigation tip if there are more pages
            if (totalPages > 1) {
                let navigationTip = '📖 **Navigation Tips:**\n';
                navigationTip += `• Next page: \`/leaderboard category:${category} page:${Math.min(page + 1, totalPages)}\`\n`;
                if (page > 1) {
                    navigationTip += `• Previous page: \`/leaderboard category:${category} page:${page - 1}\`\n`;
                }
                navigationTip += '• Change category with the `category` option!';
                
                embed.addFields([
                    { name: '🔗 Navigation', value: navigationTip, inline: false }
                ]);
            }
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error in leaderboard command:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Leaderboard Error',
                        'An error occurred while loading the leaderboard. Please try again!'
                    )],
                    flags: 64
                });
            } else {
                await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Leaderboard Error',
                        'An error occurred while loading the leaderboard. Please try again!'
                    )]
                });
            }
        }
    }
};
const { EmbedBuilder } = require('discord.js');

class EmbedUtils {
    static createSuccessEmbed(title, description) {
        return new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle(title)
            .setDescription(description)
            .setTimestamp();
    }

    static createErrorEmbed(title, description) {
        return new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle(title)
            .setDescription(description)
            .setTimestamp();
    }

    static createInfoEmbed(title, description) {
        return new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(title)
            .setDescription(description)
            .setTimestamp();
    }

    static createCardEmbed(card, userCard = null, user = null) {
        const embed = new EmbedBuilder()
            .setTitle(userCard ? 
                `${card.name} ${userCard.star_level > 0 ? '★'.repeat(userCard.star_level) : ''}` : 
                card.name
            )
            .setColor(this.getRarityColor(card.rarity))
            .setTimestamp();

        // Basic card info
        const fields = [
            { name: 'Set', value: card.set_name, inline: true },
            { name: 'Rarity', value: card.rarity, inline: true }
        ];

        // Add number if available (from API)
        if (card.number) {
            fields.push({ name: 'Number', value: card.number, inline: true });
        }

        // Add HP if it's a Pokemon card
        if (card.hp && card.supertype === 'Pokémon') {
            fields.push({ name: 'HP', value: card.hp.toString(), inline: true });
        }

        // Add types if available
        if (card.types) {
            const types = typeof card.types === 'string' ? JSON.parse(card.types) : card.types;
            if (Array.isArray(types) && types.length > 0) {
                fields.push({ name: 'Type(s)', value: types.join(', '), inline: true });
            }
        }

        embed.addFields(fields);

        // Add user-specific info
        if (userCard) {
            embed.addFields([
                { name: 'Quantity', value: userCard.quantity.toString(), inline: true }
            ]);
        }

        // Add artist if available
        if (card.artist) {
            embed.addFields([
                { name: 'Artist', value: card.artist, inline: true }
            ]);
        }

        // Add flavor text if available
        if (card.flavor_text) {
            embed.setDescription(card.flavor_text);
        }

        if (user) {
            const footerConfig = { text: `Collected by ${user.username}` };
            
            // Only add iconURL if user has displayAvatarURL method (Discord.js user object)
            if (typeof user.displayAvatarURL === 'function') {
                footerConfig.iconURL = user.displayAvatarURL({ dynamic: true });
            }
            
            embed.setFooter(footerConfig);
        }

        // Prioritize API images over fallback
        const imageUrl = card.image_large || card.image_small || card.image_url;
        if (imageUrl) {
            embed.setImage(imageUrl);
        }

        return embed;
    }

    static getRarityColor(rarity) {
        switch (rarity.toLowerCase()) {
            case 'common':
                return '#808080'; // Gray
            case 'uncommon':
                return '#00ff00'; // Green
            case 'rare':
                return '#0099ff'; // Blue
            case 'holo rare':
                return '#ff6600'; // Orange
            case 'ultra rare':
                return '#ff00ff'; // Magenta
            default:
                return '#ffffff'; // White
        }
    }

    static createProfileEmbed(user, userManager, collectionStats) {
        const xpInfo = userManager.getXPForNextLevel(user.xp, user.level);
        
        const embed = new EmbedBuilder()
            .setTitle(`${user.username}'s Profile`)
            .setColor('#ffd700')
            .setThumbnail(`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`)
            .addFields([
                { name: '📊 Level', value: user.level.toString(), inline: true },
                { name: '⚡ XP', value: `${xpInfo.current}/${xpInfo.required}`, inline: true },
                { name: '🪙 Gold', value: user.gold.toString(), inline: true },
                { name: '🎴 Total Draws', value: user.total_draws.toString(), inline: true },
                { name: '🃏 Unique Cards', value: collectionStats.unique_cards.toString(), inline: true },
                { name: '⭐ Star Cards', value: collectionStats.star_cards.toString(), inline: true }
            ])
            .setTimestamp();

        // Add XP progress bar
        const progressBar = this.createProgressBar(xpInfo.current, xpInfo.required);
        embed.addFields([
            { name: 'XP Progress', value: progressBar, inline: false }
        ]);

        return embed;
    }

    static createProgressBar(current, total, length = 20) {
        const percentage = Math.min(current / total, 1);
        const filledLength = Math.round(length * percentage);
        const emptyLength = length - filledLength;
        
        const filledBar = '█'.repeat(filledLength);
        const emptyBar = '░'.repeat(emptyLength);
        
        return `${filledBar}${emptyBar} ${Math.round(percentage * 100)}%`;
    }
}

module.exports = EmbedUtils;
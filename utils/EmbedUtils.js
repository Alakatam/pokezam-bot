const { EmbedBuilder } = require('discord.js');

class EmbedUtils {
    static palette = {
        brand: '#7C3AED',
        accent: '#22D3EE',
        success: '#34D399',
        warning: '#FBBF24',
        error: '#F87171',
        text: '#E5E7EB',
        muted: '#94A3B8',
        surface: '#111827',
        highlight: '#F8FAFC'
    };

    static resolveAvatarURL(user) {
        if (!user) return null;

        if (typeof user.displayAvatarURL === 'function') {
            return user.displayAvatarURL({ dynamic: true, size: 256 });
        }

        if (user.avatar && user.id) {
            return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
        }

        return null;
    }

    static createBaseEmbed({ title, description = '', color = this.palette.brand, thumbnail = null, image = null, footerText = null, footerIcon = null, fields = [], timestamp = true }) {
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setDescription(description || ' ')
            .setTimestamp();

        if (thumbnail) embed.setThumbnail(thumbnail);
        if (image) embed.setImage(image);
        if (fields.length > 0) embed.addFields(fields.map(field => ({
            name: `> ${field.name}`,
            value: String(field.value),
            inline: field.inline ?? true
        })));

        if (footerText) {
            const footerConfig = { text: footerText };
            if (footerIcon) footerConfig.iconURL = footerIcon;
            embed.setFooter(footerConfig);
        }

        if (!timestamp) embed.setTimestamp(null);

        return embed;
    }

    static createSuccessEmbed(title, description, footerText = null) {
        return this.createBaseEmbed({
            title,
            description,
            color: this.palette.success,
            footerText
        });
    }

    static createErrorEmbed(title, description, footerText = null) {
        return this.createBaseEmbed({
            title,
            description,
            color: this.palette.error,
            footerText
        });
    }

    static createInfoEmbed(title, description, footerText = null) {
        return this.createBaseEmbed({
            title,
            description,
            color: this.palette.accent,
            footerText
        });
    }

    static createCardEmbed(card, userCard = null, user = null) {
        const title = userCard && userCard.star_level > 0
            ? `${card.name} ${'★'.repeat(userCard.star_level)}`
            : card.name;

        const rarity = card.rarity || 'Unknown';
        const descriptionParts = [];
        if (card.set_name) descriptionParts.push(`Set • ${card.set_name}`);
        if (card.rarity) descriptionParts.push(`Rarity • ${card.rarity}`);
        if (card.supertype === 'Pokémon' && card.hp) descriptionParts.push(`HP • ${card.hp}`);

        const fields = [];
        if (card.number) fields.push({ name: 'Number', value: String(card.number), inline: true });
        if (card.types) {
            let types = card.types;
            if (typeof types === 'string') {
                try { types = JSON.parse(types); } catch { types = [types]; }
            }
            if (Array.isArray(types) && types.length > 0) {
                fields.push({ name: 'Type', value: types.join(', '), inline: true });
            }
        }
        if (card.artist) fields.push({ name: 'Artist', value: card.artist, inline: true });
        if (userCard) fields.push({ name: 'Quantity', value: String(userCard.quantity || 1), inline: true });

        const imageUrl = card.image_large || card.image_small || card.image_url || card.image;
        const thumbnail = card.image_small || card.image_url || null;

        return this.createBaseEmbed({
            title,
            description: descriptionParts.join('   •   ') || 'Pokémon card',
            color: this.getRarityColor(rarity),
            thumbnail,
            image: imageUrl,
            footerText: user ? `Collected by ${user.username}` : null,
            footerIcon: this.resolveAvatarURL(user),
            fields
        });
    }

    static getRarityColor(rarity) {
        const normalized = String(rarity || 'unknown').toLowerCase();

        switch (normalized) {
            case 'common':
                return '#94A3B8';
            case 'uncommon':
                return '#34D399';
            case 'rare':
                return '#60A5FA';
            case 'holo rare':
                return '#F59E0B';
            case 'ultra rare':
                return '#C084FC';
            case 'secret rare':
                return '#FDE68A';
            case 'legendary':
                return '#F472B6';
            case 'shiny':
                return '#FB7185';
            default:
                return this.palette.brand;
        }
    }

    static createProfileEmbed(user, userManager, collectionStats) {
        const xpInfo = userManager.getXPForNextLevel(user.xp, user.level);
        const avatarUrl = this.resolveAvatarURL(user);
        const progressBar = this.createProgressBar(xpInfo.current, xpInfo.required);

        return this.createBaseEmbed({
            title: `${user.username}'s Trainer Profile`,
            description: `Level ${user.level} • ${user.gold.toLocaleString()} 🪙 Gold`,
            color: this.palette.warning,
            thumbnail: avatarUrl,
            footerText: `${user.total_draws.toLocaleString()} total draws`,
            footerIcon: avatarUrl,
            fields: [
                { name: 'Level', value: user.level.toString(), inline: true },
                { name: 'XP', value: `${xpInfo.current.toLocaleString()} / ${xpInfo.required.toLocaleString()}`, inline: true },
                { name: 'Unique Cards', value: collectionStats.unique_cards.toString(), inline: true },
                { name: 'Star Cards', value: String(collectionStats.star_cards || 0), inline: true },
                { name: 'Total Draws', value: user.total_draws.toString(), inline: true },
                { name: 'Gold', value: user.gold.toString(), inline: true },
                { name: 'XP Progress', value: progressBar, inline: false }
            ]
        });
    }

    static createProgressBar(current, total, length = 18) {
        const safeTotal = Math.max(total, 1);
        const percentage = Math.min(current / safeTotal, 1);
        const filledLength = Math.round(length * percentage);
        const emptyLength = length - filledLength;
        const filledBar = '█'.repeat(Math.max(filledLength, 0));
        const emptyBar = '░'.repeat(Math.max(emptyLength, 0));

        return `${filledBar}${emptyBar} ${Math.round(percentage * 100)}%`;
    }
}

module.exports = EmbedUtils;
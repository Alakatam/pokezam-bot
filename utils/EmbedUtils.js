const { EmbedBuilder } = require('discord.js');

class EmbedUtils {
    static palette = {
        brand: '#8B5CF6',     // Electric Purple / Main Pokézam Theme
        accent: '#06B6D4',    // Bright Cyan / Ice
        success: '#10B981',   // Emerald Green
        warning: '#F59E0B',   // Amber Gold
        error: '#EF4444',     // Crimson Red
        gold: '#FFD700',      // Shining Gold
        purple: '#A855F7',    // Royal Purple
        pink: '#EC4899',      // Magenta / Pink
        dark: '#1E1E2E',      // Obsidian Dark
        muted: '#94A3B8',     // Slate Gray
        surface: '#2D3748'    // Dark Card Surface
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

    static createBaseEmbed({
        title = null,
        description = '',
        color = this.palette.brand,
        thumbnail = null,
        image = null,
        author = null,
        footerText = null,
        footerIcon = null,
        fields = [],
        timestamp = true
    }) {
        const embed = new EmbedBuilder().setColor(color);

        if (title) embed.setTitle(title);
        if (description) embed.setDescription(description);

        if (author) {
            if (typeof author === 'string') {
                embed.setAuthor({ name: author });
            } else if (typeof author === 'object' && author.name) {
                embed.setAuthor(author);
            }
        }

        if (thumbnail) embed.setThumbnail(thumbnail);
        if (image) embed.setImage(image);

        if (fields.length > 0) {
            embed.addFields(fields.map(field => ({
                name: field.name,
                value: String(field.value || ' '),
                inline: field.inline ?? true
            })));
        }

        if (footerText) {
            const footerConfig = { text: footerText };
            if (footerIcon) footerConfig.iconURL = footerIcon;
            embed.setFooter(footerConfig);
        }

        if (timestamp) {
            embed.setTimestamp();
        }

        return embed;
    }

    static createSuccessEmbed(title, description, footerText = null, footerIcon = null) {
        return this.createBaseEmbed({
            title: `✅  ${title}`,
            description,
            color: this.palette.success,
            footerText,
            footerIcon
        });
    }

    static createErrorEmbed(title, description, footerText = null, footerIcon = null) {
        return this.createBaseEmbed({
            title: `❌  ${title}`,
            description,
            color: this.palette.error,
            footerText,
            footerIcon
        });
    }

    static createInfoEmbed(title, description, footerText = null, footerIcon = null) {
        return this.createBaseEmbed({
            title: `ℹ️  ${title}`,
            description,
            color: this.palette.accent,
            footerText,
            footerIcon
        });
    }

    static createWarningEmbed(title, description, footerText = null, footerIcon = null) {
        return this.createBaseEmbed({
            title: `⚠️  ${title}`,
            description,
            color: this.palette.warning,
            footerText,
            footerIcon
        });
    }

    static getRarityDetails(rarity) {
        const norm = String(rarity || 'common').toLowerCase();
        if (norm.includes('secret') || norm.includes('rainbow')) {
            return { color: '#FDE68A', badge: '✦ SECRET RARE', emoji: '🌈' };
        }
        if (norm.includes('ultra') || norm.includes('vmax') || norm.includes('hyper') || norm.includes('star')) {
            return { color: '#C084FC', badge: '★ ULTRA RARE', emoji: '✨' };
        }
        if (norm.includes('holo')) {
            return { color: '#F59E0B', badge: '◆ HOLO RARE', emoji: '🌟' };
        }
        if (norm.includes('rare')) {
            return { color: '#60A5FA', badge: '▲ RARE', emoji: '🔷' };
        }
        if (norm.includes('uncommon')) {
            return { color: '#34D399', badge: '♦ UNCOMMON', emoji: '🟢' };
        }
        return { color: '#94A3B8', badge: '● COMMON', emoji: '⚪' };
    }

    static getRarityColor(rarity) {
        return this.getRarityDetails(rarity).color;
    }

    static createCardEmbed(card, userCard = null, user = null) {
        const rarityDetails = this.getRarityDetails(card.rarity);
        const starRating = userCard && userCard.star_level > 0 ? ` ${'★'.repeat(userCard.star_level)}` : '';
        const title = `${rarityDetails.emoji} ${card.name}${starRating}`;

        const headerBits = [];
        if (card.set_name) headerBits.push(`**Set:** ${card.set_name}`);
        if (card.rarity) headerBits.push(`**Rarity:** ${card.rarity}`);
        if (card.hp) headerBits.push(`**HP:** ${card.hp}`);

        const fields = [];
        if (card.number) fields.push({ name: '🔢 Card Number', value: `#${card.number}`, inline: true });
        
        if (card.types) {
            let types = card.types;
            if (typeof types === 'string') {
                try { types = JSON.parse(types); } catch { types = [types]; }
            }
            if (Array.isArray(types) && types.length > 0) {
                fields.push({ name: '⚡ Type', value: types.join(', '), inline: true });
            }
        }

        if (card.artist) fields.push({ name: '🎨 Artist', value: card.artist, inline: true });
        if (userCard) fields.push({ name: '📦 Quantity Owned', value: `${userCard.quantity || 1}x`, inline: true });

        const imageUrl = card.image_large || card.image_small || card.image_url || card.image;
        const avatar = user ? this.resolveAvatarURL(user) : null;

        return this.createBaseEmbed({
            author: { name: 'Pokézam TCG Collection' },
            title,
            description: headerBits.join('  •  ') || 'Pokémon TCG Card',
            color: rarityDetails.color,
            image: imageUrl,
            thumbnail: card.image_small || null,
            footerText: user ? `Collected by ${user.username || user.displayName}` : 'Pokézam TCG Bot',
            footerIcon: avatar,
            fields
        });
    }

    static createProfileEmbed(user, userManager, collectionStats) {
        const xpInfo = userManager.getXPForNextLevel(user.xp, user.level);
        const avatarUrl = this.resolveAvatarURL(user);
        const progressBar = this.createProgressBar(xpInfo.current, xpInfo.required, 14);

        return this.createBaseEmbed({
            author: { name: `${user.username}'s Trainer Profile`, iconURL: avatarUrl },
            title: `🏆 Level ${user.level} Trainer`,
            description: `**XP Progress:** ${progressBar}\n\`${xpInfo.current.toLocaleString()} / ${xpInfo.required.toLocaleString()} XP\` (${xpInfo.remaining.toLocaleString()} XP remaining)`,
            color: this.palette.brand,
            thumbnail: avatarUrl,
            footerText: `Member of Pokézam • ${user.total_draws.toLocaleString()} Total Draws`,
            footerIcon: avatarUrl,
            fields: [
                { name: '🎖️ Level', value: `\`${user.level}\``, inline: true },
                { name: '💰 Gold Balance', value: `\`${user.gold.toLocaleString()}\` 🪙`, inline: true },
                { name: '👟 Total Draws', value: `\`${user.total_draws.toLocaleString()}\``, inline: true },
                { name: '🎴 Unique Cards', value: `\`${collectionStats.unique_cards.toLocaleString()}\``, inline: true },
                { name: '📦 Total Quantity', value: `\`${(collectionStats.total_cards || 0).toLocaleString()}\``, inline: true }
            ]
        });
    }

    static createProgressBar(current, total, length = 12) {
        const safeTotal = Math.max(total, 1);
        const percentage = Math.min(Math.max(current / safeTotal, 0), 1);
        const filledLength = Math.round(length * percentage);
        const emptyLength = length - filledLength;
        const filledBar = '▰'.repeat(Math.max(filledLength, 0));
        const emptyBar = '▱'.repeat(Math.max(emptyLength, 0));

        return `\`${filledBar}${emptyBar}\` **${Math.round(percentage * 100)}%**`;
    }
}

module.exports = EmbedUtils;
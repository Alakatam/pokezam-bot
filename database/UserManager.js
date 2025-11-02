const Database = require('./Database');

class UserManager {
    constructor(database) {
        this.db = database;
    }

    async getUser(userId) {
        return await this.db.get('SELECT * FROM users WHERE id = ?', [userId]);
    }

    async createUser(userId, username) {
        const result = await this.db.run(
            'INSERT INTO users (id, username) VALUES (?, ?)',
            [userId, username]
        );
        return await this.getUser(userId);
    }

    async updateUser(userId, data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const setClause = keys.map(key => `${key} = ?`).join(', ');
        
        await this.db.run(
            `UPDATE users SET ${setClause} WHERE id = ?`,
            [...values, userId]
        );
        return await this.getUser(userId);
    }

    async addXP(userId, xp) {
        const user = await this.getUser(userId);
        if (!user) return null;

        const newXP = user.xp + xp;
        const newLevel = this.calculateLevel(newXP);
        
        await this.updateUser(userId, { xp: newXP, level: newLevel });
        
        return {
            oldLevel: user.level,
            newLevel: newLevel,
            leveledUp: newLevel > user.level
        };
    }

    async addGold(userId, gold) {
        const user = await this.getUser(userId);
        if (!user) return null;

        const newGold = Math.max(0, user.gold + gold); // Prevent negative gold
        await this.updateUser(userId, { gold: newGold });
        
        return {
            oldGold: user.gold,
            newGold: newGold,
            goldAdded: gold
        };
    }

    async spendGold(userId, amount) {
        const user = await this.getUser(userId);
        if (!user || user.gold < amount) return false;

        const newGold = user.gold - amount;
        await this.updateUser(userId, { gold: newGold });
        
        return true;
    }

    calculateLevel(xp) {
        const baseXP = 100;        // Higher base for slower progression
        const increment = 50;      // Larger increment makes higher levels much harder
        
        let level = 1;
        let xpNeeded = baseXP;
        
        while (xp >= xpNeeded) {
            xp -= xpNeeded;
            level++;
            xpNeeded = baseXP + (level - 1) * increment;
        }
        
        return level;
    }

    getXPForNextLevel(currentXP, currentLevel) {
        const baseXP = 100;
        const increment = 50;
        
        let level = 1;
        let totalXPNeeded = 0;
        let requiredXP = baseXP;
        
        while (level < currentLevel) {
            totalXPNeeded += requiredXP;
            requiredXP = baseXP + level * increment;
            level++;
        }
        
        const currentLevelXP = currentXP - totalXPNeeded;
        const nextLevelXP = requiredXP;
        
        return {
            current: currentLevelXP,
            required: nextLevelXP,
            remaining: nextLevelXP - currentLevelXP
        };
    }

    async getUnlockedGenerations(userId) {
        const user = await this.getUser(userId);
        if (!user) return [{ name: 'Generation I', level: 1 }];

        const generations = [];
        
        // Generation-based progression system (Pokemon Generations I-IX)
        if (user.level >= 1) generations.push({ name: 'Generation I', level: 1 });          // Original Series - Kanto
        if (user.level >= 10) generations.push({ name: 'Generation II', level: 10 });        // Neo Series - Johto
        if (user.level >= 20) generations.push({ name: 'Generation II (e-Card)', level: 20 }); // e-Card Series - End of Gen II
        if (user.level >= 35) generations.push({ name: 'Generation III', level: 35 });       // EX Series - Hoenn
        if (user.level >= 60) generations.push({ name: 'Generation IV (D&P)', level: 60 });  // Diamond & Pearl - Sinnoh
        if (user.level >= 80) generations.push({ name: 'Generation IV (Platinum)', level: 80 }); // Platinum Series
        if (user.level >= 90) generations.push({ name: 'Generation IV (HGSS)', level: 90 }); // HeartGold & SoulSilver
        if (user.level >= 110) generations.push({ name: 'Generation V', level: 110 });        // Black & White - Unova
        if (user.level >= 130) generations.push({ name: 'Generation VI', level: 130 });       // XY Series - Kalos
        if (user.level >= 150) generations.push({ name: 'Generation VII', level: 150 });      // Sun & Moon - Alola
        if (user.level >= 170) generations.push({ name: 'Generation VIII', level: 170 });     // Sword & Shield - Galar
        if (user.level >= 200) generations.push({ name: 'Generation IX', level: 200 });       // Scarlet & Violet - Paldea
        
        return generations;
    }

    getGenerationRequiredLevel(generationName) {
        const generationLevels = {
            'Generation I': 1,              // Original Series - Kanto
            'Generation II': 10,            // Neo Series - Johto
            'Generation II (e-Card)': 20,   // e-Card Series
            'Generation III': 35,           // EX Series - Hoenn
            'Generation IV (D&P)': 60,      // Diamond & Pearl - Sinnoh
            'Generation IV (Platinum)': 80, // Platinum Series
            'Generation IV (HGSS)': 90,     // HeartGold & SoulSilver
            'Generation V': 110,            // Black & White - Unova
            'Generation VI': 130,           // XY Series - Kalos
            'Generation VII': 150,          // Sun & Moon - Alola
            'Generation VIII': 170,         // Sword & Shield - Galar
            'Generation IX': 200            // Scarlet & Violet - Paldea
        };
        return generationLevels[generationName] || 1;
    }

    getGenerationDescription(generationName) {
        const descriptions = {
            'Generation I': 'Original Series - Kanto region with the first 151 Pokémon (1999-2000)',
            'Generation II': 'Neo Series - Johto region with Dark and Metal types (2000-2002)',
            'Generation II (e-Card)': 'e-Card Series - Digital integration with e-Reader strips (2002-2003)',
            'Generation III': 'EX Series - Hoenn region with powerful Pokémon-ex (2003-2007)',
            'Generation IV (D&P)': 'Diamond & Pearl - Sinnoh region with Pokémon LV.X (2007-2009)',
            'Generation IV (Platinum)': 'Platinum Series - Pokémon SP and advanced mechanics (2009)',
            'Generation IV (HGSS)': 'HeartGold & SoulSilver - Johto return with LEGEND cards (2009-2010)',
            'Generation V': 'Black & White Series - Unova region with Pokémon-EX and Full Art (2011-2013)',
            'Generation VI': 'XY Series - Kalos region with Mega Evolution and Fairy type (2014-2016)',
            'Generation VII': 'Sun & Moon Series - Alola region with Pokémon-GX and Tag Teams (2017-2019)',
            'Generation VIII': 'Sword & Shield Series - Galar region with Pokémon V and VMAX (2020-2022)',
            'Generation IX': 'Scarlet & Violet Series - Paldea region with Tera Pokémon-ex (2023-present)'
        };
        return descriptions[generationName] || 'Unknown generation';
    }

    // Legacy methods for backward compatibility
    async getUnlockedEras(userId) {
        const generations = await this.getUnlockedGenerations(userId);
        return generations.map(gen => gen.name);
    }

    async getUnlockedSets(userId) {
        return await this.getUnlockedEras(userId);
    }

    async getUserCollection(userId, setName = null) {
        let query = `
            SELECT uc.*, c.name, c.set_name, c.rarity, c.image_small, c.image_large
            FROM user_cards uc
            JOIN cards c ON uc.card_id = c.id
            WHERE uc.user_id = ?
        `;
        const params = [userId];

        if (setName) {
            query += ' AND c.set_name = ?';
            params.push(setName);
        }

        query += ' ORDER BY c.set_name, c.name';
        return await this.db.all(query, params);
    }

    async getCollectionStats(userId) {
        const stats = await this.db.get(`
            SELECT 
                COUNT(DISTINCT uc.card_id) as unique_cards,
                SUM(uc.quantity) as total_cards,
                COUNT(CASE WHEN uc.star_level > 0 THEN 1 END) as star_cards
            FROM user_cards uc
            WHERE uc.user_id = ?
        `, [userId]);

        const setStats = await this.db.all(`
            SELECT 
                c.set_name,
                COUNT(DISTINCT uc.card_id) as owned,
                COUNT(DISTINCT c.id) as total
            FROM cards c
            LEFT JOIN user_cards uc ON c.id = uc.card_id AND uc.user_id = ?
            GROUP BY c.set_name
        `, [userId]);

        return {
            ...stats,
            sets: setStats
        };
    }
}

module.exports = UserManager;
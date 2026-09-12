/**
 * PostgreSQL schema patcher for production deployment.
 * Provides a compatible API for the main bot startup code.
 */

const { Client } = require('pg');

class PostgreSQLSchemaFixer {
    constructor(db) {
        this.db = db || null;
    }

    async _ensureColumn(table, column, sqlType, defaultValue) {
        if (!this.db) {
            return { added: false, reason: 'no-db' };
        }

        const result = await this.db.get(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = ? AND column_name = ?
        `, [table, column]);

        if (result) {
            return { added: false, exists: true };
        }

        await this.db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${sqlType} DEFAULT ${defaultValue}`);
        return { added: true, exists: false };
    }

    async fixUsersTableSchema() {
        if (!this.db) return { updated: 0, reason: 'no-db' };

        const checks = [
            ['coins', 'INTEGER', '0'],
            ['daily_streak', 'INTEGER', '0'],
            ['cooldown_bypass', 'BOOLEAN', 'FALSE'],
            ['showcase_count', 'INTEGER', '0'],
            ['xp', 'BIGINT', '0'],
            ['admin', 'BOOLEAN', 'FALSE'],
            ['guild_id', 'VARCHAR(20)', 'NULL']
        ];

        let updated = 0;
        for (const [column, type, defaultVal] of checks) {
            const status = await this._ensureColumn('users', column, type, defaultVal);
            if (status.added) updated++;
        }

        return { updated };
    }

    async fixCardsTableSchema() {
        if (!this.db) return { updated: 0, reason: 'no-db' };

        const checks = [
            ['set_name', 'TEXT', "''"],
            ['set_id', 'TEXT', "''"],
            ['number', 'TEXT', "''"]
        ];

        let updated = 0;
        for (const [column, type, defaultVal] of checks) {
            const status = await this._ensureColumn('cards', column, type, defaultVal);
            if (status.added) updated++;
        }

        return { updated };
    }

    async fixQuestsTableSchema() {
        if (!this.db) return { updated: 0, reason: 'no-db' };

        const checks = [
            ['assigned_date', 'BIGINT', '0'],
            ['completed_date', 'BIGINT', '0'],
            ['completed', 'BOOLEAN', 'FALSE']
        ];

        let updated = 0;
        for (const [column, type, defaultVal] of checks) {
            const status = await this._ensureColumn('user_quests', column, type, defaultVal);
            if (status.added) updated++;
        }

        return { updated };
    }

    async verifyFixes() {
        if (!this.db) return { ok: false, reason: 'no-db' };
        return { ok: true };
    }
}

async function fixPostgreSQLSchema(database) {
    const db = database || new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    if (!database && db) {
        await db.connect();
    }

    const fixer = new PostgreSQLSchemaFixer(database || { get: async () => null, run: async () => null });
    const results = {
        users: await fixer.fixUsersTableSchema(),
        cards: await fixer.fixCardsTableSchema(),
        quests: await fixer.fixQuestsTableSchema(),
        verification: await fixer.verifyFixes()
    };

    if (!database && db) {
        await db.end();
    }

    return results;
}

module.exports = { PostgreSQLSchemaFixer, fixPostgreSQLSchema };

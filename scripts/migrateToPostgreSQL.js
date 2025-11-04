const fs = require('fs');
const path = require('path');
const Database = require('../database/Database');
const PostgreSQLDatabase = require('../database/PostgreSQLDatabase');

class DatabaseMigrator {
    constructor() {
        this.sourceDb = new Database();
        this.targetDb = new PostgreSQLDatabase();
    }

    async migrate() {
        console.log('🚀 Starting database migration from SQLite to PostgreSQL...');
        
        try {
            // Initialize both databases
            console.log('📂 Initializing source SQLite database...');
            await this.sourceDb.initialize();
            
            console.log('📂 Initializing target PostgreSQL database...');
            await this.targetDb.initialize();
            
            // Create tables if they don't exist
            console.log('📋 Ensuring PostgreSQL schema exists...');
            await this.createSchema();
            
            // Migrate data in dependency order
            await this.migrateCards();
            await this.migrateUsers();
            await this.migrateUserCards();
            await this.migrateQuests();
            await this.migrateActiveEffects();
            await this.migrateAchievements();
            await this.migrateSetCompletions();
            
            console.log('✅ Migration completed successfully!');
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
            throw error;
        } finally {
            // Close connections
            await this.sourceDb.close();
            await this.targetDb.close();
        }
    }

    async createSchema() {
        const schemaPath = path.join(__dirname, '..', 'database', 'postgresql_schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf8');
            // Split by semicolon and execute each statement
            const statements = schema.split(';').filter(stmt => stmt.trim());
            
            for (const statement of statements) {
                if (statement.trim()) {
                    try {
                        await this.targetDb.run(statement);
                    } catch (error) {
                        // Ignore "already exists" errors
                        if (!error.message.includes('already exists')) {
                            console.warn('Schema warning:', error.message);
                        }
                    }
                }
            }
        }
    }

    async migrateCards() {
        console.log('📇 Migrating cards...');
        const cards = await this.sourceDb.all('SELECT * FROM cards');
        
        for (const card of cards) {
            await this.targetDb.run(`
                INSERT INTO cards (id, name, set_id, set_name, rarity, image_small, image_large, 
                                 unlock_level, holo_chance, artist, hp, types, attacks, 
                                 weaknesses, resistances, retreat_cost, converted_retreat_cost, 
                                 set_series, set_printed_total, set_total, set_legalities, 
                                 set_ptcgo_code, set_release_date, set_updated_at, set_images, 
                                 national_pokedex_numbers, subtypes, supertype, rules, 
                                 regulation_mark, ancient_trait, abilities, evolves_from, 
                                 evolves_to, flavor_text)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (id) DO NOTHING
            `, [
                card.id, card.name, card.set_id, card.set_name, card.rarity, 
                card.image_small, card.image_large, card.unlock_level, card.holo_chance,
                card.artist, card.hp, card.types, card.attacks, card.weaknesses,
                card.resistances, card.retreat_cost, card.converted_retreat_cost,
                card.set_series, card.set_printed_total, card.set_total, card.set_legalities,
                card.set_ptcgo_code, card.set_release_date, card.set_updated_at, card.set_images,
                card.national_pokedex_numbers, card.subtypes, card.supertype, card.rules,
                card.regulation_mark, card.ancient_trait, card.abilities, card.evolves_from,
                card.evolves_to, card.flavor_text
            ]);
        }
        
        console.log(`✅ Migrated ${cards.length} cards`);
    }

    async migrateUsers() {
        console.log('👥 Migrating users...');
        const users = await this.sourceDb.all('SELECT * FROM users');
        
        for (const user of users) {
            await this.targetDb.run(`
                INSERT INTO users (id, trainer_level, gold, cards_collected, packs_opened, 
                                 last_daily, daily_streak, total_value, bio, favorite_pokemon, 
                                 title, created_at, last_active, notification_settings, 
                                 premium_until, premium_packs_remaining)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (id) DO UPDATE SET
                    trainer_level = EXCLUDED.trainer_level,
                    gold = EXCLUDED.gold,
                    cards_collected = EXCLUDED.cards_collected,
                    packs_opened = EXCLUDED.packs_opened,
                    last_daily = EXCLUDED.last_daily,
                    daily_streak = EXCLUDED.daily_streak,
                    total_value = EXCLUDED.total_value,
                    bio = EXCLUDED.bio,
                    favorite_pokemon = EXCLUDED.favorite_pokemon,
                    title = EXCLUDED.title,
                    last_active = EXCLUDED.last_active,
                    notification_settings = EXCLUDED.notification_settings,
                    premium_until = EXCLUDED.premium_until,
                    premium_packs_remaining = EXCLUDED.premium_packs_remaining
            `, [
                user.id, user.trainer_level, user.gold, user.cards_collected, user.packs_opened,
                user.last_daily, user.daily_streak, user.total_value, user.bio, user.favorite_pokemon,
                user.title, user.created_at, user.last_active, user.notification_settings,
                user.premium_until, user.premium_packs_remaining
            ]);
        }
        
        console.log(`✅ Migrated ${users.length} users`);
    }

    async migrateUserCards() {
        console.log('🎴 Migrating user cards...');
        const userCards = await this.sourceDb.all('SELECT * FROM user_cards');
        
        for (const userCard of userCards) {
            await this.targetDb.run(`
                INSERT INTO user_cards (user_id, card_id, quantity, is_holo, obtained_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (user_id, card_id, is_holo) DO UPDATE SET
                    quantity = quantity + EXCLUDED.quantity
            `, [
                userCard.user_id, userCard.card_id, userCard.quantity, 
                userCard.is_holo, userCard.obtained_at
            ]);
        }
        
        console.log(`✅ Migrated ${userCards.length} user cards`);
    }

    async migrateQuests() {
        console.log('🎯 Migrating quests...');
        const quests = await this.sourceDb.all('SELECT * FROM user_quests');
        
        for (const quest of quests) {
            await this.targetDb.run(`
                INSERT INTO user_quests (user_id, quest_id, progress, completed, completed_at, 
                                       rewards_claimed, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (user_id, quest_id) DO UPDATE SET
                    progress = EXCLUDED.progress,
                    completed = EXCLUDED.completed,
                    completed_at = EXCLUDED.completed_at,
                    rewards_claimed = EXCLUDED.rewards_claimed
            `, [
                quest.user_id, quest.quest_id, quest.progress, quest.completed, 
                quest.completed_at, quest.rewards_claimed, quest.created_at
            ]);
        }
        
        console.log(`✅ Migrated ${quests.length} quests`);
    }

    async migrateActiveEffects() {
        console.log('⚡ Migrating active effects...');
        const effects = await this.sourceDb.all('SELECT * FROM active_effects');
        
        for (const effect of effects) {
            await this.targetDb.run(`
                INSERT INTO active_effects (user_id, effect_type, multiplier, expires_at, created_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (user_id, effect_type) DO UPDATE SET
                    multiplier = EXCLUDED.multiplier,
                    expires_at = EXCLUDED.expires_at
            `, [
                effect.user_id, effect.effect_type, effect.multiplier, 
                effect.expires_at, effect.created_at
            ]);
        }
        
        console.log(`✅ Migrated ${effects.length} active effects`);
    }

    async migrateAchievements() {
        console.log('🏆 Migrating achievements...');
        try {
            const achievements = await this.sourceDb.all('SELECT * FROM user_achievements');
            
            for (const achievement of achievements) {
                await this.targetDb.run(`
                    INSERT INTO user_achievements (user_id, achievement_id, progress, unlocked, 
                                                 unlocked_at, notified)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT (user_id, achievement_id) DO UPDATE SET
                        progress = EXCLUDED.progress,
                        unlocked = EXCLUDED.unlocked,
                        unlocked_at = EXCLUDED.unlocked_at,
                        notified = EXCLUDED.notified
                `, [
                    achievement.user_id, achievement.achievement_id, achievement.progress,
                    achievement.unlocked, achievement.unlocked_at, achievement.notified
                ]);
            }
            
            console.log(`✅ Migrated ${achievements.length} achievements`);
        } catch (error) {
            console.log('ℹ️ No achievements table found, skipping...');
        }
    }

    async migrateSetCompletions() {
        console.log('📚 Migrating set completions...');
        try {
            const setCompletions = await this.sourceDb.all('SELECT * FROM user_set_completions');
            
            for (const completion of setCompletions) {
                await this.targetDb.run(`
                    INSERT INTO user_set_completions (user_id, set_id, completed_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT (user_id, set_id) DO NOTHING
                `, [
                    completion.user_id, completion.set_id, completion.completed_at
                ]);
            }
            
            console.log(`✅ Migrated ${setCompletions.length} set completions`);
        } catch (error) {
            console.log('ℹ️ No set completions table found, skipping...');
        }
    }
}

// Run migration if called directly
if (require.main === module) {
    const migrator = new DatabaseMigrator();
    migrator.migrate().catch(console.error);
}

module.exports = DatabaseMigrator;
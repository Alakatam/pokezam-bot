/**
 * PostgreSQL Production Deployment Fix
 * 
 * Handles deployment issues specific to PostgreSQL on Render:
 * 1. Disables SQLite-specific column migrations
 * 2. Ensures clean PostgreSQL schema initialization
 * 3. Prevents backup restoration conflicts
 */

class PostgreSQLProductionFix {
    static apply(database) {
        if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
            console.log('🐘 Applying PostgreSQL production deployment fixes...');
            
            // Override checkAndMigrateSchema to prevent SQLite-specific operations
            const originalCheckAndMigrateSchema = database.checkAndMigrateSchema;
            database.checkAndMigrateSchema = async function() {
                console.log('🐘 PostgreSQL: Skipping SQLite-specific schema migrations');
                console.log('✅ Schema managed by postgresql_schema.sql');
                return;
            };
            
            // Override the problematic column addition methods
            const originalRun = database.run;
            database.run = async function(query, params = []) {
                // Skip problematic ALTER TABLE operations that reference non-existent tables
                if (query.includes('ALTER TABLE quests') && query.includes('target_type')) {
                    console.log('🐘 PostgreSQL: Skipping quest table alteration (handled by schema)');
                    return { changes: 0 };
                }
                
                if (query.includes('ALTER TABLE users') && query.includes('_pulls')) {
                    console.log('🐘 PostgreSQL: Skipping user statistics alteration (handled by schema)');
                    return { changes: 0 };
                }
                
                // Check for PRAGMA queries (SQLite-specific)
                if (query.includes('PRAGMA')) {
                    console.log('🐘 PostgreSQL: Skipping SQLite PRAGMA query');
                    return [];
                }
                
                return originalRun.call(this, query, params);
            };
            
            console.log('✅ PostgreSQL production fixes applied');
        }
    }
}

module.exports = PostgreSQLProductionFix;
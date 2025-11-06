/**
 * Delete the migration flag file to force re-run on next startup
 * Run this locally to remove the flag, then push to trigger migration again
 */

const fs = require('fs');
const path = require('path');

const MIGRATION_FLAG_FILE = path.join(__dirname, '..', '.set_name_migration_complete');

if (fs.existsSync(MIGRATION_FLAG_FILE)) {
    fs.unlinkSync(MIGRATION_FLAG_FILE);
    console.log('✅ Migration flag file deleted - migration will run on next startup');
} else {
    console.log('ℹ️  No migration flag file found');
}

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./connection');

/**
 * Run a database migration
 * Usage: node server/db/run-migration.js migrations/001_add_multi_user_support.sql
 */

async function runMigration(migrationFile) {
  try {
    console.log(`Running migration: ${migrationFile}`);

    const migrationPath = path.join(__dirname, migrationFile);

    if (!fs.existsSync(migrationPath)) {
      console.error(`Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing SQL...');
    await db.query(sql);

    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: node run-migration.js <migration-file>');
  console.error('Example: node run-migration.js migrations/001_add_multi_user_support.sql');
  process.exit(1);
}

runMigration(migrationFile);

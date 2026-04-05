require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./connection');

async function runAllMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`Running: ${file}`);
    await db.query(sql);
    console.log(`  done`);
  }

  console.log('All migrations complete');
  await db.pool.end();
}

runAllMigrations().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

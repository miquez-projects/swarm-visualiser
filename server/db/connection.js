const { Pool } = require('pg');

// Detect if we're connecting to a remote database that requires SSL
const isRemoteDatabase = process.env.DATABASE_URL &&
  (process.env.DATABASE_URL.includes('render.com') ||
   process.env.DATABASE_URL.includes('railway.app') ||
   process.env.NODE_ENV === 'production');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemoteDatabase ? { rejectUnauthorized: false } : false
});

// Test connection
pool.on('connect', () => {
  console.log('Database connected');
});

pool.on('error', (err) => {
  console.error('Unexpected database error', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};

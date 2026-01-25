
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@libsql/client');

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN');
  process.exit(1);
}

const db = createClient({
  url,
  authToken,
});

async function migrate() {
  console.log('Starting migration to Turso...');

  try {
    // Users Table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        wallet_address TEXT UNIQUE,
        device_id TEXT,
        tier TEXT DEFAULT 'FREE',
        credits INTEGER DEFAULT 0,
        is_onboarded INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Checked/Created users table');

    // Usage Table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        token_address TEXT,
        credits_used INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('Checked/Created usage table');

    // Transactions Table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        tx_signature TEXT UNIQUE,
        amount REAL,
        currency TEXT,
        credits_added INTEGER,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('Checked/Created transactions table');

    // Scans Table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        token_address TEXT NOT NULL,
        name TEXT,
        symbol TEXT,
        image_url TEXT,
        type TEXT DEFAULT 'token',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('Checked/Created scans table');

    // Indices (LibSQL syntax is standard SQL)
    await db.execute('CREATE INDEX IF NOT EXISTS idx_usage_user_date ON usage(user_id, created_at)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_scans_user_token ON scans(user_id, token_address)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at)');

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

migrate();

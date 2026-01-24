const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env.local' });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function migrate() {
    try {
        console.log("Adding 'type' column to 'scans'...");
        try {
            await client.execute("ALTER TABLE scans ADD COLUMN type TEXT DEFAULT 'token'");
            console.log("Column 'type' added.");
        } catch (e) {
            if (e.message.includes('duplicate column')) {
                console.log("Column 'type' already exists.");
            } else {
                console.error("Failed to add column 'type':", e);
            }
        }

        console.log("Creating 'wallet_labels' table...");
        await client.execute(`
      CREATE TABLE IF NOT EXISTS wallet_labels (
        user_id TEXT NOT NULL,
        wallet_address TEXT NOT NULL,
        label TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, wallet_address)
      )
    `);
        console.log("Table 'wallet_labels' created/verified.");

    } catch (e) {
        console.error(e);
    }
}

migrate();

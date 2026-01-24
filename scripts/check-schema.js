const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env.local' });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function checkSchema() {
    try {
        console.log("Checking 'scans' table info...");
        const scansInfo = await client.execute("PRAGMA table_info(scans)");
        console.log(scansInfo.rows);

        console.log("\nChecking 'wallet_labels' table existence...");
        const labelsCheck = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='wallet_labels'");
        if (labelsCheck.rows.length > 0) {
            console.log("Table 'wallet_labels' exists.");
            const labelsInfo = await client.execute("PRAGMA table_info(wallet_labels)");
            console.log(labelsInfo.rows);
        } else {
            console.log("Table 'wallet_labels' does not exist.");
        }

    } catch (e) {
        console.error(e);
    }
}

checkSchema();

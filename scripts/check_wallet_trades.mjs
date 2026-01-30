
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import fs from 'fs';

// Load env
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) {
    process.env[k] = envConfig[k];
}

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

const wallet = '8chkaxQNZ4TZqpWzvb8p5opxwmTHJkrK69GBMUp4BqJf';
// Timestamp for Jan 1 2025: 1735689600000
const cutoff = 1735689600000;

console.log(`Checking DB via Turso for ${wallet} before 2025...`);

async function run() {
    try {
        const res = await db.execute({
            sql: `SELECT * FROM wallet_trades WHERE wallet_address = ? AND timestamp < ? LIMIT 10`,
            args: [wallet, cutoff]
        });

        if (res.rows.length === 0) {
            console.log('No old trades found in DB.');
        } else {
            res.rows.forEach(row => {
                console.log(`[DB] FOUND OLD TRADE:`, row);
                console.log(`Date:`, new Date(Number(row.timestamp)).toISOString());
            });

            // Prompt to delete? Or just log.
            console.log(`Found ${res.rows.length} erroneous trades.`);
        }

        const countRes = await db.execute({
            sql: `SELECT COUNT(*) as c FROM wallet_trades WHERE wallet_address = ?`,
            args: [wallet]
        });
        console.log(`Total trades in DB: ${countRes.rows[0].c}`);

    } catch (e) {
        console.error(e);
    }
}

run();

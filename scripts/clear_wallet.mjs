
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

async function run() {
    try {
        console.log(`Clearing stored trades and cache for ${wallet}...`);

        await db.execute({
            sql: `DELETE FROM wallet_trades WHERE wallet_address = ?`,
            args: [wallet]
        });

        await db.execute({
            sql: `DELETE FROM wallet_cache WHERE wallet_address = ?`,
            args: [wallet]
        });

        console.log('Done.');
    } catch (e) {
        console.error(e);
    }
}

run();

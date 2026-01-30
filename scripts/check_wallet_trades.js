
const Database = require('better-sqlite3');
const db = new Database('memesense.db', { verbose: console.log });
const wallet = '8chkaxQNZ4TZqpWzvb8p5opxwmTHJkrK69GBMUp4BqJf';

console.log(`Checking trades for ${wallet} before 2025...`);

const rows = db.prepare(`SELECT * FROM trades WHERE wallet_address = ? AND timestamp < 1735689600000 ORDER BY timestamp ASC LIMIT 10`).all(wallet);

if (rows.length === 0) {
    console.log('No old trades found.');
} else {
    rows.forEach(row => {
        console.log(`FOUND OLD TRADE:`, row);
        console.log(`Date:`, new Date(row.timestamp).toISOString());
    });
}

const count = db.prepare(`SELECT COUNT(*) as c FROM trades WHERE wallet_address = ?`).get(wallet);
console.log(`Total trades in DB: ${count.c}`);

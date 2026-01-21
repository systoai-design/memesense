const { initDatabase } = require('../lib/db');

const TARGET_WALLET = '2unNnTnv5DcmtdQYAJuLzg4azHu67obGL9dX8PYwxUDQ';

try {
    console.log(`Granting PREMIUM to ${TARGET_WALLET}...`);
    const db = initDatabase();

    // Check if user exists first
    const user = db.prepare('SELECT * FROM users WHERE wallet_address = ?').get(TARGET_WALLET);

    if (!user) {
        console.log('User not found. Creating user...');
        const { v4: uuidv4 } = require('uuid');
        const id = uuidv4();
        db.prepare(`
            INSERT INTO users (id, wallet_address, tier, credits)
            VALUES (?, ?, 'PREMIUM', 1000)
        `).run(id, TARGET_WALLET);
        console.log('User created with PREMIUM status.');
    } else {
        db.prepare(`
            UPDATE users 
            SET tier = 'PREMIUM', credits = 1000 
            WHERE wallet_address = ?
        `).run(TARGET_WALLET);
        console.log('User updated to PREMIUM status.');
    }

    console.log('Done.');
} catch (error) {
    console.error('Error:', error);
}

const { getClient } = require('../lib/db');
require('dotenv').config({ path: '.env.local' });

const TARGET_WALLET = 'FrCFPYpcLpeifKMBqkgq3HMivMDAtb9F2rFFhB5EAsNq';

async function run() {
    try {
        console.log(`Granting PREMIUM to ${TARGET_WALLET}...`);
        const db = getClient();

        // Check if user exists first
        const res = await db.execute({
            sql: 'SELECT * FROM users WHERE wallet_address = ?',
            args: [TARGET_WALLET]
        });
        const user = res.rows[0];

        if (!user) {
            console.log('User not found. Creating user...');
            const { v4: uuidv4 } = require('uuid');
            const id = uuidv4();
            await db.execute({
                sql: `
                    INSERT INTO users (id, wallet_address, tier, credits, device_id)
                    VALUES (?, ?, 'PREMIUM', 1000, ?)
                `,
                args: [id, TARGET_WALLET, uuidv4()]
            });
            console.log('User created with PREMIUM status.');
        } else {
            await db.execute({
                sql: `
                    UPDATE users 
                    SET tier = 'PREMIUM', credits = 1000, subscription_expiry = NULL, trial_start = NULL 
                    WHERE wallet_address = ?
                `,
                args: [TARGET_WALLET]
            });
            console.log('User updated to PREMIUM status.');
        }

        console.log('Done.');
    } catch (error) {
        console.error('Error:', error);
    }
}

run();

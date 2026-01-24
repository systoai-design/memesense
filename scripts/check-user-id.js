const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env.local' });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

const userId = process.argv[2];

async function check() {
    console.log(`Checking user ID: ${userId}`);

    if (!userId) {
        console.log("Please provide a user ID");
        return;
    }

    let sql = 'SELECT * FROM users WHERE id = ?';
    if (userId.includes('%')) {
        sql = 'SELECT * FROM users WHERE id LIKE ?';
    }

    const res = await client.execute({
        sql,
        args: [userId]
    });

    if (res.rows.length === 0) {
        console.log('User not found');
    } else {
        console.log('User found:', res.rows[0]);
    }
}

check();

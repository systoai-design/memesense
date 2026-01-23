require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@libsql/client');

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function checkUser(wallet) {
    if (!process.env.TURSO_DATABASE_URL) {
        console.error("Missing TURSO_DATABASE_URL");
        return;
    }

    try {
        const rs = await client.execute({
            sql: "SELECT * FROM users WHERE wallet_address = ?",
            args: [wallet]
        });

        console.log(`Checking wallet: ${wallet}`);
        if (rs.rows.length > 0) {
            console.log("User found:", rs.rows[0]);
        } else {
            console.log("User NOT found in database.");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

checkUser('W6Qe25zGpwRpt7k8Hrg2RANF7N88XP7JU5BEeKaTrJ2');

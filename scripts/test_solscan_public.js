require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

async function verifyPublicApi() {
    const key = process.env.SOLSCAN_API_KEY;
    console.log(`Testing Public API with Key: ${key?.substring(0, 5)}...`);

    // public-api.solscan.io ??? Or is it justapi.solscan.io?
    // Docs say v2 public API is `https://public-api.solscan.io`.

    const url = 'https://public-api.solscan.io/token/meta?address=So11111111111111111111111111111111111111112';

    try {
        const res = await fetch(url, {
            headers: { 'token': key }
        });

        console.log(`Status: ${res.status}`);
        if (res.ok) {
            const data = await res.json();
            console.log("Success:", data);
        } else {
            const text = await res.text();
            console.log("Error:", text);
        }
    } catch (e) {
        console.error(e);
    }
}

verifyPublicApi();

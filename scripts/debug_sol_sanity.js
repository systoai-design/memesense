import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getTokenData } from '../lib/dexscreener.js';

async function run() {
    console.log("Testing SOL Price Sanity Logic...");

    try {
        const wSOL = 'So11111111111111111111111111111111111111112';
        console.log(`Fetching price for ${wSOL}...`);

        const data = await getTokenData(wSOL);
        let price = data.price || 0;
        console.log(`Raw Price: ${price} (Type: ${typeof price})`);

        // Sanity Check Logic (Copied from route.js)
        if (price < 10) {
            console.warn(`[ProfitAPI] Suspicious SOL Price: $${price}. Using fallback ($150).`);
            price = 150;
        } else {
            console.log("Price passed sanity check.");
        }

        console.log(`Final Price: ${price}`);

    } catch (e) {
        console.error('Error:', e);
    }
}

run();

import { getTokenData } from '../lib/dexscreener.js';
import { getHistoricalSolPrice } from '../lib/price-history.js';

const WSOL = 'So11111111111111111111111111111111111111112';

async function run() {
    console.log("Fetching SOL Price from DexScreener...");
    try {
        const data = await getTokenData(WSOL);
        console.log("SOL Data:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Failed to fetch SOL price:", e.message);
    }

    console.log("\nChecking Historical Prices...");
    const today = Date.now();
    const priceToday = getHistoricalSolPrice(today);
    console.log(`Price for Today (${new Date(today).toISOString()}): $${priceToday}`);

    const price7d = getHistoricalSolPrice(today - 7 * 24 * 60 * 60 * 1000);
    console.log(`Price 7 days ago: $${price7d}`);
}

run();

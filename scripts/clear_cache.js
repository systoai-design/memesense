import { clearWalletTrades } from '../lib/db.js';

const WALLET = '8YWZkrj6p3HC4rbtWMc5No8A523mDcmcKxGhWmSfbCVa';

async function run() {
    console.log(`Clearing trades for ${WALLET}...`);
    const success = await clearWalletTrades(WALLET);
    if (success) {
        console.log("✅ Trades cleared successfully.");
    } else {
        console.error("❌ Failed to clear trades.");
    }
}

run();

import { getWalletHistory } from '../lib/helius.js';

const WALLET = '8YWZkrj6p3HC4rbtWMc5No8A523mDcmcKxGhWmSfbCVa';

async function run() {
    console.log(`Fetching 10 recent transactions for ${WALLET} to inspect for Tips...`);
    const history = await getWalletHistory(WALLET, 10);

    // Pick the first Sell or Buy
    const trade = history.find(t => t.type === 'SELL' || t.type === 'BUY');

    if (trade) {
        console.log(`\nInspecting Trade: ${trade.signature}`);
        console.log(`Type: ${trade.type}, Mint: ${trade.mint}`);
        // We need the RAW transaction to see native transfers that might have been filtered or summed.
        // Actually, getWalletHistory parses it. I need to see if I can access the raw transfers from the parsed object?
        // No, getWalletHistory returns the *result* object.
        // I need to fetch the raw transaction again or rely on what's in the repo?
        // Wait, I can just modify getWalletHistory to log the native transfers temporarily?
        // Or I can use getEnhancedTransactions directly here.
    }
}

// Since I can't easily see raw data from the processed output of getWalletHistory,
// I will write a script that calls getEnhancedTransactions directly.

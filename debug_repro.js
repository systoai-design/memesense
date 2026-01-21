import { getWalletHistory } from './lib/helius.js';

// Mock process.env for the key
// I'll manually set the key I saw in the route file pattern match or try to find it. 
// Wait, the lib/helius.js uses process.env.NEXT_PUBLIC_RPC_URL
// I need to provide that env var.
// I will check if `.env.local` exists or just hardcode a known public RPC or ask the user for one, 
// BUT simpler is to mock it if I can see where it usually comes from.
// The route.js does: const apiKey = process.env.NEXT_PUBLIC_RPC_URL?.match(/api-key=([a-f0-9-]+)/i)?.[1];
// I will assume the user has this env var set in their environment where the app runs.
// For this script, I will try to read the .env.local file if possible, OR just try to run it and see if it fails on missing key.

// Actually, I can view .env.local first to be sure.
// But I can't easily read it if I don't know it's there. I'll listing files.

const WALLET = '5hAgYC8TJCcEZV7LTXAzkTrm7YL29YXyQQJPCNrG84z';

async function run() {
    console.log('Starting debug for:', WALLET);
    try {
        const trades = await getWalletHistory(WALLET);
        console.log('Trades found:', trades.length);
        if (trades.length > 0) {
            console.log('Sample trade:', trades[0]);
        }
    } catch (e) {
        console.error('Debug failed:', e);
    }
}

run();

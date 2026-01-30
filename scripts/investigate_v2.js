process.env.HELIUS_RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=4bd4311b-8cf4-4f9e-9aac-e46f2375008d';
// import 'dotenv/config'; 
import { getWalletHistory } from '../lib/helius.js';
import { calculateWalletMetrics, analyzeTimeWindows } from '../lib/trade-analysis.js';
import { getBatchTokenPrices, getTokenData } from '../lib/dexscreener.js';

const WALLET = '8chkaxQNZ4TZqpWzvb8p5opxwmTHJkrK69GBMUp4BqJf';

async function investigate() {
    console.log(`Analyzing ${WALLET}...`);

    // 1. Fetch History
    const trades = await getWalletHistory(WALLET, 3000);
    console.log(`Fetched ${trades.length} trades.`);

    // 2. Initial Analysis (to find Open Positions)
    const initialAnalysis = analyzeTimeWindows(trades);
    const mAll = initialAnalysis['all'];

    // 3. Identify Open Mints
    const openMints = mAll.details
        .filter(p => p.status === 'OPEN' && p.remainingTokens > 0)
        .map(p => p.mint);

    console.log(`Found ${openMints.length} potential open positions.`);

    // 4. Fetch Prices (Live)
    const uniqueOpenMints = [...new Set(openMints)];
    let priceMap = {};
    if (uniqueOpenMints.length > 0) {
        console.log(`Fetching prices for ${uniqueOpenMints.length} tokens...`);
        // Batch fetch in chunks if needed, but getBatchTokenPrices usually handles 30
        priceMap = await getBatchTokenPrices(uniqueOpenMints.slice(0, 90)); // Limit to 90 for now
    }

    // 5. Fetch SOL Price
    const wSOL = 'So11111111111111111111111111111111111111112';
    const solData = await getTokenData(wSOL);
    const solPrice = solData.price || 130;
    console.log(`SOL Price: $${solPrice}`);

    // 6. Re-Analyze with Prices
    const finalWindows = analyzeTimeWindows(trades, priceMap, solPrice);
    const m30 = finalWindows['30d'];
    const mAllFinal = finalWindows['all'];

    console.log("\n--- 30 DAY METRICS ---");
    console.log(`Trades: ${m30.totalTrades}`);
    console.log(`Win Rate: ${m30.winRate.toFixed(2)}%`);
    console.log(`Realized PnL: ${m30.totalRealizedPnL.toFixed(2)} SOL`);

    // Sum Unrealized
    const unrealized = m30.details.reduce((acc, p) => acc + (p.status === 'OPEN' ? p.unrealizedPnL : 0), 0);
    const unrealizedUSD = m30.details.reduce((acc, p) => acc + (p.status === 'OPEN' ? p.unrealizedPnLUSD : 0), 0);
    console.log(`Unrealized PnL: ${unrealized.toFixed(2)} SOL ($${unrealizedUSD.toFixed(2)})`);

    console.log("\n--- TOP OPEN POSITIONS (Unrealized) ---");
    mAllFinal.details
        .filter(p => p.status === 'OPEN')
        .sort((a, b) => b.unrealizedPnL - a.unrealizedPnL) // Sort by Profit (Descending)
        .slice(0, 10)
        .forEach(p => {
            const price = priceMap[p.mint]?.price || 0;
            console.log(`[${p.mint}] PnL: ${p.unrealizedPnL.toFixed(2)} SOL ($${(p.unrealizedPnLUSD || 0).toFixed(2)}) | Held: ${p.remainingTokens.toFixed(2)} | Price: $${price}`);
        });
}
investigate();

import { getTokenData } from '../lib/dexscreener.js';
import { getWalletHistory } from '../lib/helius.js'; // Ensure this line exists or matches context
import { calculateWalletMetrics, analyzeTimeWindows } from '../lib/trade-analysis.js';
import { getHistoricalSolPrice } from '../lib/price-history.js';

const WALLET = '8YWZkrj6p3HC4rbtWMc5No8A523mDcmcKxGhWmSfbCVa';

async function run() {
    console.log(`Analyzing ${WALLET} for last 7 days (PnL Breakdown)...`);

    // Fetch History
    const trades = await getWalletHistory(WALLET, 3000);
    console.log(`Fetched ${trades.length} total trades.`);

    const wSOL = 'So11111111111111111111111111111111111111112';
    const solData = await getTokenData(wSOL);
    const solPrice = solData.price || 150;
    console.log(`Live SOL Price: $${solPrice}`);

    // Analyze using existing logic
    const finalWindows = analyzeTimeWindows(trades, {}, solPrice);
    const m7 = finalWindows['7d'];

    // DEBUG SPECIFIC TOKEN
    const targetMint = '2VhkKPY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB'; // Assuming full mint from log if possible, but log truncated.
    // Wait, log said "2VhkKPY1..."
    // I need to find the full mint.
    // I'll search for it in trades.
    const targetTrade = trades.find(t => t.mint.startsWith('2VhkKPY1'));
    if (targetTrade) {
        console.log(`\n[DEBUG] Found target mint: ${targetTrade.mint}`);
        // Calculate stats manually to see what's wrong
        const buys = trades.filter(t => t.mint === targetTrade.mint && t.type === 'BUY');
        const sells = trades.filter(t => t.mint === targetTrade.mint && t.type === 'SELL');
        console.log(`Buys: ${buys.length}, Sells: ${sells.length}`);
        let totalBuySol = 0;
        let totalBuyTokens = 0;
        buys.forEach(b => {
            console.log(`  BUY: ${b.timestamp} | SOL: ${b.solAmount} | Tok: ${b.tokenAmount}`);
            totalBuySol += b.solAmount;
            totalBuyTokens += b.tokenAmount;
        });
        console.log(`Total Buy SOL: ${totalBuySol}, Total Buy Tok: ${totalBuyTokens}`);
        console.log(`Computed Cost Basis: ${totalBuyTokens > 0 ? totalBuySol / totalBuyTokens : 0}`);
    } else {
        console.log("\n[DEBUG] Target mint not found in trades?");
    }

    console.log("\n--- 7 DAY SUMMARY ---");
    console.log(`Trades: ${m7.totalTrades}`);
    console.log(`Realized PnL: ${m7.totalRealizedPnL.toFixed(4)} SOL ($${m7.totalRealizedPnLUSD.toFixed(2)})`);
    console.log(`Win Rate: ${m7.winRate.toFixed(2)}%`);

    console.log("\n--- DETAILED TRADE BREAKDOWN (7d) ---");

    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

    const filteredTrades = trades.filter(t => t.timestamp >= sevenDaysAgo);

    // Sort by timestamp
    filteredTrades.sort((a, b) => a.timestamp - b.timestamp);

    let runningPnL = 0;
    let runningPnLUSD = 0;

    // Group by Mint to track closing PnL
    const stats = {};

    filteredTrades.forEach(t => {
        if (!stats[t.mint]) stats[t.mint] = { buySol: 0, buyUsd: 0, buyAmt: 0 };

        const histPrice = getHistoricalSolPrice(t.timestamp);
        const valUSD = t.solAmount * histPrice;
        let pnl = 0;
        let pnlUSD = 0;

        if (t.type === 'SELL') {
            const s = stats[t.mint];
            const avgCost = s.buyAmt > 0 ? s.buySol / s.buyAmt : 0;
            const avgCostUsd = s.buyAmt > 0 ? s.buyUsd / s.buyAmt : 0;

            pnl = t.solAmount - (avgCost * t.tokenAmount);
            pnlUSD = valUSD - (avgCostUsd * t.tokenAmount);

            runningPnL += pnl;
            runningPnLUSD += pnlUSD;
        } else {
            // BUY
            stats[t.mint].buySol += t.solAmount;
            stats[t.mint].buyUsd += valUSD;
            stats[t.mint].buyAmt += t.tokenAmount;
        }

        console.log(`[${new Date(t.timestamp).toISOString()}] ${t.type} ${t.mint.slice(0, 8)}... | Amt: ${t.tokenAmount.toFixed(1)} | SOL: ${t.solAmount.toFixed(4)} ($${valUSD.toFixed(2)}) | PnL: ${pnl.toFixed(4)} ($${pnlUSD.toFixed(2)})`);
    });

    console.log("\n--- CALCULATED TOTALS ---");
    console.log(`Running PnL: ${runningPnL.toFixed(4)} SOL`);
    console.log(`Running PnL USD: $${runningPnLUSD.toFixed(2)}`);

}

run();

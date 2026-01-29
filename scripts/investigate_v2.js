import 'dotenv/config';
import { getWalletHistory } from '../lib/helius.js';
import { calculateWalletMetrics, analyzeTimeWindows } from '../lib/trade-analysis.js';

const WALLET = 'v2yNhm4KkC87MdBkvvYiMVP7UdSyNYLrfXrFte8A5a7';

async function investigate() {
    console.log(`Analyzing ${WALLET}...`);

    // Fetch History
    const trades = await getWalletHistory(WALLET, 3000);
    console.log(`Fetched ${trades.length} trades.`);

    // Analyze Windows
    const windows = analyzeTimeWindows(trades);
    const m30 = windows['30d'];
    const mAll = windows['all'];

    console.log("\n--- 30 DAY METRICS (Target: -$12k / ~922 Trades) ---");
    console.log(`Trades: ${m30.totalTrades}`);
    console.log(`Win Rate: ${m30.winRate.toFixed(2)}%`);
    console.log(`Realized PnL: ${m30.totalRealizedPnL.toFixed(2)} SOL`);
    console.log(`Realized USD: $${m30.totalRealizedPnLUSD.toFixed(2)}`);
    // Sum Unrealized for Open positions in this window
    const unrealized = m30.details.reduce((acc, p) => acc + (p.status === 'OPEN' ? p.unrealizedPnL : 0), 0);
    const unrealizedUSD = m30.details.reduce((acc, p) => acc + (p.status === 'OPEN' ? p.unrealizedPnLUSD : 0), 0);
    console.log(`Unrealized PnL: ${unrealized.toFixed(2)} SOL ($${unrealizedUSD.toFixed(2)})`);

    console.log("\n--- ALL TIME METRICS ---");
    console.log(`Trades: ${mAll.totalTrades}`);
    console.log(`Realized PnL: ${mAll.totalRealizedPnL.toFixed(2)} SOL`);

    console.log("\n--- TOP 30D LOSSES (Realized) ---");
    m30.details
        .filter(p => p.realizedPnL < 0)
        .sort((a, b) => a.realizedPnL - b.realizedPnL)
        .slice(0, 5)
        .forEach(p => {
            console.log(`[${p.mint}] PnL: ${p.realizedPnL.toFixed(2)} SOL ($${p.pnlUsd.toFixed(2)})`);
        });
}
investigate();

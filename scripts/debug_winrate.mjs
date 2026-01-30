import { getWalletHistory } from '../lib/helius.js';
import { getHistoricalSolPrice } from '../lib/price-history.js';

const WALLET = '8chkaxQNZ4TZqpWzvb8p5opxwmTHJkrK69GBMUp4BqJf';

async function run() {
    console.log('Fetching History...');
    const trades = await getWalletHistory(WALLET, 1000);

    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

    const windowTrades = trades.filter(t => t.timestamp >= sevenDaysAgo);
    console.log(`7D Trades: ${windowTrades.length}`);

    // Calculate Avg Cost Map (All Time)
    const tokenStats = {};
    trades.forEach(t => {
        if (!tokenStats[t.mint]) tokenStats[t.mint] = { buySol: 0, buyTokens: 0 };
        if (t.type === 'BUY') {
            tokenStats[t.mint].buySol += t.solAmount;
            tokenStats[t.mint].buyTokens += t.tokenAmount;
        }
    });

    const avgCostMap = {};
    Object.keys(tokenStats).forEach(mint => {
        const s = tokenStats[mint];
        avgCostMap[mint] = s.buyTokens > 0 ? s.buySol / s.buyTokens : 0;
    });

    // Analyze Sells in Window
    let wins = 0;
    let losses = 0;
    let totalSellVol = 0;

    console.log('\n--- 7D SELLS ANALYSIS ---');
    console.log('Time | Mint | Sell SOL | Cost SOL | PnL SOL | Status');

    const sells = windowTrades.filter(t => t.type === 'SELL');

    sells.forEach(t => {
        const costPerToken = avgCostMap[t.mint] || 0;
        const totalCost = costPerToken * t.tokenAmount;
        const pnl = t.solAmount - totalCost;

        const isWin = pnl > 0;
        if (isWin) wins++; else losses++;

        totalSellVol += t.solAmount;

        const isOrphan = costPerToken === 0;
        const isDust = t.solAmount < 0.01; // < $1.50 approx

        console.log(`${new Date(t.timestamp).toISOString().split('T')[0]} | ${t.mint.slice(0, 4)}... | ${t.solAmount.toFixed(4)} | ${totalCost.toFixed(4)} | ${pnl.toFixed(4)} | ${isWin ? 'WIN' : 'LOSS'} ${isOrphan ? '(Orphan)' : ''} ${isDust ? '(Dust)' : ''}`);
    });

    console.log('\n--- STATS ---');
    console.log(`Total 7D Sells: ${sells.length}`);
    console.log(`Wins: ${wins}`);
    console.log(`Losses: ${losses}`);
    console.log(`Win Rate: ${((wins / sells.length) * 100).toFixed(2)}%`);

}

run();



const fs = require('fs');
const path = require('path');

// Manually load .env.local
try {
    const envPath = path.join(__dirname, '..', '.env.local');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["']|["']$/g, '');
                process.env[key] = value;
            }
        });
    }
} catch (e) {
    console.warn('Could not load .env.local', e);
}

const { getWalletHistory } = require('../lib/helius');
const { calculateWalletMetrics, analyzeTimeWindows } = require('../lib/trade-analysis');

// Mock fetch for Node.js environment if needed, but Next.js usually polyfills it. 
// If running with pure node, we might need 'node-fetch' or similar if not available.
// However, in modern Node (v18+), fetch is global.

async function run() {
    const wallet = 'BtevQT53ypC5Nz6yRwGm3GV4RYmQMjNJsLEP5Y3XspuR';
    console.log(`Analyzing wallet: ${wallet}`);

    try {
        console.log('Fetching history...');
        const trades = await getWalletHistory(wallet);
        console.log(`Fetched ${trades.length} trades.`);

        if (trades.length === 0) {
            console.log('No trades found or API error.');
            return;
        }

        console.log('Calculating metrics...');
        const metrics = calculateWalletMetrics(trades);

        console.log('--- Overall Metrics ---');
        console.log('Total Trades:', metrics.totalTrades);
        console.log('Total Realized PnL (SOL):', metrics.totalRealizedPnL.toFixed(4));
        console.log('Win Rate:', metrics.winRate.toFixed(2) + '%');
        console.log('Avg Single Buy:', metrics.avgSingleBuy.toFixed(4));
        console.log('Closed Positions:', metrics.closedPositionsCount);

        console.log('\n--- Top 5 Positions by PnL ---');
        metrics.details.slice(0, 5).forEach(p => {
            console.log(`${p.mint} | PnL: ${p.pnl.toFixed(4)} | Status: ${p.status} | TxCount: ${p.txCount}`);
        });

    } catch (e) {
        console.error('Error:', e);
    }
}

run();

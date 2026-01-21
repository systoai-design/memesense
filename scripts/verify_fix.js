
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
const { analyzeTimeWindows } = require('../lib/trade-analysis');
const { getBatchTokenPrices } = require('../lib/dexscreener');

async function run() {
    const wallet = 'BtevQT53ypC5Nz6yRwGm3GV4RYmQMjNJsLEP5Y3XspuR';
    console.log(`Analyzing wallet: ${wallet}`);

    try {
        console.log('1. Fetching history (Limit 10k)...');
        const trades = await getWalletHistory(wallet);
        console.log(`Fetched ${trades.length} trades.`);

        if (trades.length === 0) {
            console.log('No trades found.');
            return;
        }

        console.log('2. Identifying Open Positions...');
        const initialAnalysis = analyzeTimeWindows(trades);
        const openMints = initialAnalysis.all.details
            .filter(p => p.status === 'OPEN' && p.remainingTokens > 0)
            .map(p => p.mint);

        const uniqueMints = [...new Set(openMints)];
        console.log(`Found ${uniqueMints.length} unique tokens with open positions.`);

        console.log('3. Fetching Prices from DexScreener...');
        let priceMap = {};
        if (uniqueMints.length > 0) {
            priceMap = await getBatchTokenPrices(uniqueMints);
            console.log(`Fetched prices for ${Object.keys(priceMap).length} tokens.`);
        }

        console.log('4. Calculating Final Metrics...');
        const analysis = analyzeTimeWindows(trades, priceMap);
        const metrics = analysis.all;

        console.log('\n--- Final Metrics (ALL Time) ---');
        console.log('Total Trades:', metrics.totalTrades);
        console.log('Realized PnL (SOL):', metrics.totalRealizedPnL.toFixed(4));
        console.log('Gross Profit:', metrics.grossProfit.toFixed(4));
        console.log('Gross Loss:', metrics.grossLoss.toFixed(4));
        console.log('Win Rate:', metrics.winRate.toFixed(2) + '%');
        console.log('Win/Loss Ratio:', metrics.winLossRatio.toFixed(2));
        console.log('Profit Factor:', metrics.profitFactor.toFixed(2));
        console.log('Avg Single Buy:', metrics.avgSingleBuy.toFixed(4));
        console.log('Closed Positions:', metrics.closedPositionsCount);
        console.log('Open Positions:', metrics.openPositionsCount);

        console.log('\n--- Top 5 Open Positions (Unrealized PnL) ---');
        metrics.details
            .filter(p => p.status === 'OPEN')
            .sort((a, b) => b.unrealizedPnL - a.unrealizedPnL)
            .slice(0, 5)
            .forEach(p => {
                console.log(`${p.mint} | UnrPnL: ${p.unrealizedPnL.toFixed(4)} | Remaining: ${p.remainingTokens.toFixed(2)}`);
            });

    } catch (e) {
        console.error('Error:', e);
    }
}

run();

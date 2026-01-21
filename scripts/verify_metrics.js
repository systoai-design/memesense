// Manually load .env.local
const fs = require('fs');
const path = require('path');

console.log('--- Environment Setup ---');
try {
    const envPath = path.join(__dirname, '..', '.env.local');
    console.log('Loading env from:', envPath);

    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            // Ignore comments and empty lines
            if (!line || line.startsWith('#') || !line.includes('=')) return;

            const parts = line.split('=');
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');

            if (key && value) {
                process.env[key] = value;
                // console.log(`Set ${key}`);
            }
        });
        console.log('Environment variables loaded.');
    } else {
        console.error('ERROR: .env.local file not found at', envPath);
    }
} catch (e) {
    console.warn('Could not load .env.local', e);
}

// Verify Env
if (!process.env.NEXT_PUBLIC_RPC_URL) {
    console.error('CRITICAL: NEXT_PUBLIC_RPC_URL is missing!');
    process.exit(1);
}

const { getWalletHistory } = require('../lib/helius');
const { calculateWalletMetrics } = require('../lib/trade-analysis');
const { analyzeWallet } = require('../lib/gemini');

async function run() {
    console.log('--- Verifying New Metrics ---');
    const wallet = 'BtevQT53ypC5Nz6yRwGm3GV4RYmQMjNJsLEP5Y3XspuR';

    console.log('Fetching history...');
    const trades = await getWalletHistory(wallet);

    if (!trades.length) {
        console.error('No trades found.');
        return;
    }

    console.log(`Analyzing ${trades.length} trades...`);
    const metrics = calculateWalletMetrics(trades, {});

    console.log('\n--- TIME METRICS ---');
    console.log(`Avg Hold: ${(metrics.avgHoldTime / 60000).toFixed(2)} mins`);
    console.log(`Fastest Flip: ${(metrics.fastestFlip / 1000).toFixed(2)} sec`);
    console.log(`Longest Hold: ${(metrics.longestHold / 3600000).toFixed(2)} hours`);

    console.log('\n--- PROFITABILITY ---');
    console.log(`Profit Factor: ${metrics.profitFactor.toFixed(2)}`);
    console.log(`Win Rate: ${metrics.winRate.toFixed(2)}%`);
    console.log(`Safe Copy Margin: ${metrics.safeCopyMargin.toFixed(2)}%`);
    console.log(`Avg PnL: ${metrics.avgPnL.toFixed(4)} SOL`);

    console.log('\n--- VOLUME ---');
    console.log(`Total Volume: ${metrics.totalVolume.toFixed(2)} SOL`);
    console.log(`Tokens Traded: ${metrics.tokensTraded}`);
    console.log(`W/L: ${metrics.winCount} / ${metrics.lossCount}`);

    console.log('\n--- AI VERDICT CHECK ---');
    // Simulate Verdict Logic
    let aiStatus = 'UNPROFITABLE';
    if (metrics.profitFactor >= 1.5 && metrics.winRate > 40) aiStatus = 'PROFITABLE';
    else if (metrics.profitFactor >= 1.0) aiStatus = 'PROFITABLE (Marginal)';

    console.log(`Verdict: ${aiStatus}`);

    console.log('\n--- GEN AI SUMMARY CHECK ---');
    // Only run if key exists
    if (process.env.GEMINI_API_KEY) {
        console.log('Generating summary...');
        const summary = await analyzeWallet(metrics);
        console.log('Result:', summary);
    } else {
        console.log('Skipping Gen AI (No Key)');
    }
}

run();

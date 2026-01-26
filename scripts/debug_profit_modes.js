
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

async function run() {
    const wallet = 'BtevQT53ypC5Nz6yRwGm3GV4RYmQMjNJsLEP5Y3XspuR'; // Heavy wallet

    console.log('--- Testing Quick Scan (Limit 100) ---');
    const startQuick = Date.now();
    const quickTxs = await getWalletHistory(wallet, { limit: 100 });
    const timeQuick = Date.now() - startQuick;
    console.log(`Quick Scan: Fetched ${quickTxs.length} trades in ${timeQuick}ms`);

    if (quickTxs.length > 150) {
        console.error('FAIL: Quick Scan fetched too many transactions!');
    } else {
        console.log('PASS: Quick Scan limit accepted.');
    }

    console.log('\n--- Testing Deep Scan (Limit 1000) ---');
    const startDeep = Date.now();
    const deepTxs = await getWalletHistory(wallet, { limit: 1000 });
    const timeDeep = Date.now() - startDeep;
    console.log(`Deep Scan: Fetched ${deepTxs.length} trades in ${timeDeep}ms`);

    if (deepTxs.length < 200) {
        console.warn('WARN: Deep Scan fetched low count. Might be actual history size or limit issue.');
    } else {
        console.log('PASS: Deep Scan fetched significantly more history.');
    }

    console.log('\nVerification Complete.');
}

run();


const fs = require('fs');
const path = require('path');

try {
    const envPath = path.join(__dirname, '..', '.env.local');
    if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
    }
} catch (e) {
    console.warn('Dotenv not loaded', e);
}

const { getSniperData, getDevWalletStatus, getRealHolderData } = require('../lib/solana');

// Test Token: POPCAT (or any popular token)
const TOKEN = '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr';

async function run() {
    console.log(`Analyzing Token: ${TOKEN}`);

    console.log('\n--- Testing Snipers ---');
    const startSnipers = Date.now();
    const snipers = await getSniperData(TOKEN);
    console.log(`Snipers: Found ${snipers.totalSnipers || 0} in ${Date.now() - startSnipers}ms`);
    console.log(snipers);

    console.log('\n--- Testing Dev Wallet ---');
    const startDev = Date.now();
    const dev = await getDevWalletStatus(TOKEN, null, 100);
    console.log(`Dev Wallet: ${dev.action} in ${Date.now() - startDev}ms`);
    console.log(dev);

    console.log('\n--- Testing Real Holders (RPC) ---');
    const startHolders = Date.now();
    const holders = await getRealHolderData(TOKEN);
    console.log(`Holders: Found Top ${holders.top10Holders?.length || 0} in ${Date.now() - startHolders}ms`);

    console.log('\nDone.');
    process.exit(0);
}

run();

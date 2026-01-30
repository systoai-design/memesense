
import { getWalletHistory } from '../lib/helius.js';
import { getBatchTokenMetadata } from '../lib/helius.js';

const WALLET = '8chkaxQNZ4TZqpWzvb8p5opxwmTHJkrK69GBMUp4BqJf';

async function run() {
    console.log(`Fetching history for ${WALLET}...`);
    // Fetch last 1000 trades
    const trades = await getWalletHistory(WALLET, 1000);
    console.log(`Fetched ${trades.length} trades.`);

    // Group by mint
    const mints = [...new Set(trades.map(t => t.mint))];
    console.log(`Found ${mints.length} unique tokens.`);

    // Fetch Metadata to find GSD
    console.log('Fetching metadata...');
    const metadata = await getBatchTokenMetadata(mints);

    // Find GSD
    const gsdMint = Object.keys(metadata).find(m => metadata[m].symbol === 'GSD');

    if (!gsdMint) {
        console.log('GSD Token NOT FOUND in recent history.');
        console.log('Available Symbols:', Object.values(metadata).map(m => m.symbol).slice(0, 20));
        return;
    }

    console.log(`FOUND GSD: ${gsdMint}`);
    console.log(metadata[gsdMint]);

    // Check for Duplicates
    const sigs = trades.map(t => t.signature);
    const uniqueSigs = new Set(sigs);
    console.log(`Unique Signatures: ${uniqueSigs.size} / ${sigs.length} Trades`);

    if (uniqueSigs.size !== sigs.length) {
        console.warn('⚠️ DUPLICATE TRANSACTIONS DETECTED!');
        // Find dupes
        const seen = new Set();
        const dupes = sigs.filter(s => {
            if (seen.has(s)) return true;
            seen.add(s);
            return false;
        });
        console.log('Sample Dupes:', dupes.slice(0, 5));
    }

    // Analyze GSD Trades
    const gsdTrades = trades.filter(t => t.mint === gsdMint);
    console.log(`\n--- GSD TRADES (${gsdTrades.length}) ---`);
    console.table(gsdTrades.map(t => ({
        time: new Date(t.timestamp).toISOString(),
        type: t.type,
        sol: t.solAmount.toFixed(4),
        tokens: t.tokenAmount.toFixed(0),
        price: (t.solAmount / t.tokenAmount).toFixed(9),
        sig: t.signature.slice(0, 8) + '...'
    })));

    // Calc PnL
    let bought = 0;
    let sold = 0;
    let cost = 0;
    let rev = 0;

    gsdTrades.forEach(t => {
        if (t.type === 'BUY') {
            bought += t.tokenAmount;
            cost += t.solAmount;
        } else {
            sold += t.tokenAmount;
            rev += t.solAmount;
        }
    });

    console.log('\n--- SUMMARY ---');
    console.log(`Bought: ${bought.toFixed(2)} for ${cost.toFixed(4)} SOL`);
    console.log(`Sold:   ${sold.toFixed(2)} for ${rev.toFixed(4)} SOL`);
    console.log(`PnL:    ${(rev - cost).toFixed(4)} SOL`);
    console.log(`Avg Cost: ${(cost / bought).toFixed(9)} SOL`);
    console.log(`Avg Sell: ${(rev / sold).toFixed(9)} SOL`);

}

run();

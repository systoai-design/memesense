import { config } from 'dotenv';
config({ path: '.env.local' });
import { getWalletHistory } from '../lib/helius.js'; // Ensure this path is correct relative to script execution or move script
// To avoid path issues, I'll mock the necessary parts or copy snippets if imports fail, 
// but let's try using the existing lib since we fixed the build.
// Actually, I can't easily import from 'lib' in a script unless I treat the whole project as modules.
// I will copy-paste the minimal logic needed to fetch and analyze to avoid module hell.

const API_KEY = process.env.HELIUS_RPC_URL?.match(/api-key=([a-f0-9-]+)/i)?.[1];
const WALLET = 'E1ED87qzdUPfK2zTLgYGatEnuo1pLHfukTLUjxxG7j7y';

async function fetchHistory() {
    console.log(`Fetching history for ${WALLET}...`);
    let allTxs = [];
    let before = '';

    // Fetch 2000 txs (20 pages)
    for (let i = 0; i < 20; i++) {
        const url = `https://api.helius.xyz/v0/addresses/${WALLET}/transactions?api-key=${API_KEY}&limit=100${before}`;
        try {
            const resp = await fetch(url);
            const data = await resp.json();
            if (!data || data.length === 0) break;
            allTxs = allTxs.concat(data);
            before = `&before=${data[data.length - 1].signature}`; // This logic was flawed in previous run if data was concatenated? No, data is the new batch. Correct.
            // Wait, data[data.length-1] works for the CURRENT batch.
            console.log(`Page ${i + 1}: Fetched ${data.length} txs. Total: ${allTxs.length}`);
        } catch (e) {
            console.error(e);
            break;
        }
        await new Promise(r => setTimeout(r, 200)); // Lower delay
    }
    return allTxs;
}

function parseTrades(txs) {
    const trades = [];
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

    // Simple parser similar to lib/helius.js
    txs.forEach(tx => {
        if (!tx.tokenTransfers) return;
        const timestamp = tx.timestamp;
        const sig = tx.signature;

        const incoming = tx.tokenTransfers.filter(t => t.toUserAccount === WALLET);
        const outgoing = tx.tokenTransfers.filter(t => t.fromUserAccount === WALLET);
        const nativeIn = (tx.nativeTransfers || []).filter(t => t.toUserAccount === WALLET);
        const nativeOut = (tx.nativeTransfers || []).filter(t => t.fromUserAccount === WALLET);

        // BUY
        incoming.forEach(inT => {
            const mint = inT.mint;
            if (mint === SOL_MINT || mint === USDC_MINT) return;

            let cost = 0;
            nativeOut.forEach(n => cost += n.amount / 1e9);
            outgoing.forEach(o => {
                if (o.mint === SOL_MINT) cost += o.tokenAmount;
                if (o.mint === USDC_MINT) cost += (o.tokenAmount / 250); // Approx
            });

            if (cost > 0) trades.push({ type: 'BUY', mint, amount: inT.tokenAmount, cost, timestamp, sig });
        });

        // SELL
        outgoing.forEach(outT => {
            const mint = outT.mint;
            if (mint === SOL_MINT || mint === USDC_MINT) return;

            let gain = 0;
            nativeIn.forEach(n => gain += n.amount / 1e9);
            incoming.forEach(i => {
                if (i.mint === SOL_MINT) gain += i.tokenAmount;
                if (i.mint === USDC_MINT) gain += (i.tokenAmount / 250);
            });

            if (gain > 0) trades.push({ type: 'SELL', mint, amount: outT.tokenAmount, gain, timestamp, sig });
        });
    });
    return trades;
}

async function main() {
    const txs = await fetchHistory();
    const trades = parseTrades(txs);

    const stats = {};
    trades.forEach(t => {
        if (!stats[t.mint]) stats[t.mint] = { mint: t.mint, buySol: 0, sellSol: 0, buyAmt: 0, sellAmt: 0 };
        if (t.type === 'BUY') {
            stats[t.mint].buySol += t.cost;
            stats[t.mint].buyAmt += t.amount;
        } else {
            stats[t.mint].sellSol += t.gain;
            stats[t.mint].sellAmt += t.amount;
        }
    });

    const results = Object.values(stats).map(s => {
        const pnl = s.sellSol - s.buySol;
        return {
            mint: s.mint,
            pnlSol: pnl,
            pnlUsd: pnl * 250, // Approx
            buySol: s.buySol,
            sellSol: s.sellSol,
            remaining: s.buyAmt - s.sellAmt
        };
    }).sort((a, b) => b.pnlSol - a.pnlSol);

    console.log('\nFetching metadata for top 50 tokens to find "Dale"...');
    const top50 = results.slice(0, 50);
    const mintsToFetch = top50.map(r => r.mint);

    // Explicitly add CZSE (Lick) if not in top 50
    const LICK_MINT = 'CZSE6FyovrMTANcyuRVxCJDKtr6V9yHvAypyJWY7pump';
    if (!mintsToFetch.includes(LICK_MINT)) mintsToFetch.push(LICK_MINT);

    const metadataMap = {};

    // Batch fetch (chunk 50)
    // Actually Helius `getAssetBatch` is better but simple `getAsset` loop is easier for script
    // Or just one batch
    try {
        const resp = await fetch(`https://mainnet.helius-rpc.com/?api-key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0', id: 'batch', method: 'getAssetBatch',
                params: { ids: mintsToFetch, displayOptions: { showFungible: true } }
            })
        });
        const d = await resp.json();
        d.result?.forEach(a => {
            if (a) metadataMap[a.id] = a.content?.metadata?.symbol;
        });
    } catch (e) { console.error('Meta fetch failed', e); }

    // Print Results
    console.log('\n--- Analysis Results ---');
    console.log('Top Performers & Dale check:');

    let daleFound = false;
    mintsToFetch.forEach(mint => {
        const r = results.find(x => x.mint === mint) || stats[mint]; // fallback if not in results sort? No, results has all
        // Re-construct r if it was added manually and not in results (should be in results)
        const stat = stats[mint];
        if (!stat) return;

        const pnlSol = stat.sellSol - stat.buySol;
        const pnlUsd = pnlSol * 250;
        const symbol = metadataMap[mint] || 'UNK';

        if (symbol.toLowerCase().includes('dale')) daleFound = true;
        if (symbol.toLowerCase() === 'lick') console.log('DEBUG: Found LICK');

        // Only print Top 10 OR Dale/Lick
        const isTop10 = results.findIndex(x => x.mint === mint) < 10;
        const isTarget = symbol.toLowerCase().includes('dale') || symbol.toLowerCase() === 'lick';

        if (isTop10 || isTarget) {
            console.log(`[${symbol}] ${mint}`);
            console.log(`  PnL: $${pnlUsd.toFixed(2)} (${pnlSol.toFixed(2)} SOL)`);
            console.log(`  Buys: ${stat.buySol.toFixed(2)} SOL | Sells: ${stat.sellSol.toFixed(2)} SOL`);
        }
    });

    if (!daleFound) console.warn('WARNING: "Dale" token not found in top 50 or Lick check.');

}

main();

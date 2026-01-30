import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Connection } from '@solana/web3.js';
import { getWalletHistory } from '../lib/helius.js'; // Ensure this path is correct relative to script execution
// Note: We need to use 'import' syntax if package.json has type: module, or .mjs extension.
// I'll make this .mjs to match project style if needed, or just standard .js with require if possible.
// Project has `lib/helius.js` as ES Module (from warnings). So I must use ESM.

const WALLET = 'E1ED87qzdUPfK2zTLgYGatEnuo1pLHfukTLUjxxG7j7y';

async function debugLosses() {
    console.log("Fetching history for", WALLET);
    try {
        const trades = await getWalletHistory(WALLET, 2000);
        console.log(`Fetched ${trades.length} trades.`);

        const summary = {};

        trades.forEach(t => {
            if (!summary[t.mint]) summary[t.mint] = {
                mint: t.mint,
                buySol: 0,
                sellSol: 0,
                buyCount: 0,
                sellCount: 0,
                firstBuy: null,
                lastSell: null,
                txs: []
            };

            const s = summary[t.mint];
            if (t.type === 'BUY') {
                s.buySol += t.solAmount;
                s.buyCount++;
                if (!s.firstBuy || t.timestamp < s.firstBuy) s.firstBuy = t.timestamp;
            } else {
                s.sellSol += t.solAmount;
                s.sellCount++;
                if (!s.lastSell || t.timestamp > s.lastSell) s.lastSell = t.timestamp;
            }
            s.txs.push(t);
        });

        // Check Targets
        const targets = ['BATHROOM', 'SHANNON', 'BWT', 'PENGUIN', 'CLAWD', 'AMELIAJAK'];

        console.log("\n--- PROBLEM TOKENS ---");

        // We need Symbol to match targets... Helius trades might not have Symbol inline unless I fetch metadata.
        // But previously I had a map.
        // I'll just dump tokens with large Losses (SellSol - BuySol < -20)

        Object.values(summary).forEach(s => {
            const pnl = s.sellSol - s.buySol;
            if (pnl < -20) {
                console.log(`[POSSIBLE LOSS] ${s.mint}`);
                console.log(`  PnL: ${pnl.toFixed(2)} SOL`);
                console.log(`  Buys: ${s.buyCount} (${s.buySol.toFixed(2)} SOL)`);
                console.log(`  Sells: ${s.sellCount} (${s.sellSol.toFixed(2)} SOL)`);
                console.log(`  First Buy: ${new Date(s.firstBuy * 1000).toISOString()}`);
            }
        });

    } catch (e) {
        console.error(e);
    }
}

debugLosses();

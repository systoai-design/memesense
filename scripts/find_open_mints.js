import 'dotenv/config';
import { getWalletHistory } from '../lib/helius.js';

const WALLET = 'E1ED87qzdUPfK2zTLgYGatEnuo1pLHfukTLUjxxG7j7y';

async function findOpenMints() {
    console.log("Fetching trades to find BATHROOM (57.59) and BWT (73.93)...");
    const trades = await getWalletHistory(WALLET, 2000);

    const summary = {};

    trades.forEach(t => {
        if (!summary[t.mint]) summary[t.mint] = {
            mint: t.mint,
            buySol: 0,
            sellSol: 0
        };
        const s = summary[t.mint];
        if (t.type === 'BUY') s.buySol += t.solAmount;
    });

    // Scan for matches
    Object.values(summary).forEach(s => {
        if (Math.abs(s.buySol - 57.588) < 1.0) {
            console.log(`[MATCH BATHROOM?] ${s.mint} | BuySol: ${s.buySol.toFixed(3)}`);
        }
        if (Math.abs(s.buySol - 73.933) < 1.0) {
            console.log(`[MATCH BWT?] ${s.mint} | BuySol: ${s.buySol.toFixed(3)}`);
        }
    });
}

findOpenMints();

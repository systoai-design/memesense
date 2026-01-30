import 'dotenv/config';
import { getWalletHistory } from '../lib/helius.js';

const WALLET = 'E1ED87qzdUPfK2zTLgYGatEnuo1pLHfukTLUjxxG7j7y';
const MINT = 'ErbrU2TM7WXDwKevgTaJRLngVEoW9grVwrP7P7pYbonk'; // BATHROOM

async function inspect() {
    console.log(`Inspecting BATHROOM (${MINT})...`);
    const trades = await getWalletHistory(WALLET, 2000);
    const tokenTrades = trades.filter(t => t.mint === MINT);

    let bought = 0;
    let sold = 0;
    tokenTrades.forEach(t => {
        if (t.type === 'BUY') bought += t.tokenAmount;
        else sold += t.tokenAmount;
    });

    console.log(`Bought: ${bought}`);
    console.log(`Sold:   ${sold}`);
    const remaining = bought - sold;
    console.log(`Rem:    ${remaining} (${(remaining / bought * 100).toFixed(2)}%)`);
    console.log(`Status: ${remaining / bought < 0.02 ? 'CLOSED' : 'OPEN'}`);
}
inspect();

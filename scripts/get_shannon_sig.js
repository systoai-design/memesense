import 'dotenv/config';
import { getWalletHistory } from '../lib/helius.js';

const WALLET = 'E1ED87qzdUPfK2zTLgYGatEnuo1pLHfukTLUjxxG7j7y';
const MINT = 'GDYKiEguadwhmcexFzK9ADHjegJgHeFPZDo831p2p637'; // SHANNON

async function findSig() {
    console.log("Fetching trades...");
    const trades = await getWalletHistory(WALLET, 2000);
    const tokenTrades = trades.filter(t => t.mint === MINT && t.type === 'BUY');

    if (tokenTrades.length > 0) {
        console.log(`Found ${tokenTrades.length} Buys.`);
        const t = tokenTrades[0];
        console.log(`Sample Buy:`);
        console.log(`  Sig: ${t.signature}`);
        console.log(`  SolAmount (Parsed): ${t.solAmount}`);
        console.log(`  Time: ${new Date(t.timestamp * 1000).toISOString()}`);
    } else {
        console.log("No buys found.");
    }
}
findSig();

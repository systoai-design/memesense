import 'dotenv/config';
import { getWalletHistory } from '../lib/helius.js';

const WALLET = 'E1ED87qzdUPfK2zTLgYGatEnuo1pLHfukTLUjxxG7j7y';
const MINTS = {
    'SHANNON': 'GDYKiEguadwhmcexFzK9ADHjegJgHeFPZDo831p2p637',
    'PENGUIN': '9xK2Cj2tKq1jzyjr6BtdqHxe2niTtshxF4Y7PTHMpump',
    'CLAWD': 'DzrScTJ32QqLWNQz6UEwRe5QaTw9SJbAepAuh95wBAGS'
};

async function inspect() {
    console.log("Fetching trades...");
    const trades = await getWalletHistory(WALLET, 2000);

    Object.keys(MINTS).forEach(name => {
        const mint = MINTS[name];
        console.log(`\n--- INSPECTING ${name} (${mint}) ---`);

        const tokenTrades = trades.filter(t => t.mint === mint);

        let buyTokens = 0;
        let sellTokens = 0;
        let buySol = 0;
        let sellSol = 0;

        tokenTrades.forEach(t => {
            console.log(`[${t.type}] ${t.tokenAmount} Tokens | ${t.solAmount} SOL | ${new Date(t.timestamp * 1000).toISOString()}`);
            if (t.type === 'BUY') {
                buyTokens += t.tokenAmount;
                buySol += t.solAmount;
            } else {
                sellTokens += t.tokenAmount;
                sellSol += t.solAmount;
            }
        });

        console.log(`TOTAL: Bought ${buyTokens} / Sold ${sellTokens}`);
        console.log(`SOL:   Spent ${buySol.toFixed(2)} / Recvd ${sellSol.toFixed(2)}`);

        const remaining = buyTokens - sellTokens;
        const ratio = remaining / buyTokens;
        console.log(`REMAINING: ${remaining} (${(ratio * 100).toFixed(2)}%) -> Status should be: ${ratio < 0.02 ? 'CLOSED' : 'OPEN'}`);
    });
}
inspect();

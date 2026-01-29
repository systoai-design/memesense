import 'dotenv/config';
import { getWalletHistory } from '../lib/helius.js';

const WALLET = 'v2yNhm4KkC87MdBkvvYiMVP7UdSyNYLrfXrFte8A5a7';
const MINT = '7MDApufGNAKDDTcM3hrUpUfZ8jcaXdaoSZy1sQdRpump';

async function inspect() {
    console.log(`Inspecting ${MINT} for ${WALLET}...`);
    const trades = await getWalletHistory(WALLET, 3000);
    const tokenTrades = trades.filter(t => t.mint === MINT);

    let bought = 0;
    let sold = 0;
    let cost = 0;
    let rev = 0;

    tokenTrades.forEach(t => {
        console.log(`[${t.type}] ${t.tokenAmount.toFixed(2)} Tokens | ${t.solAmount.toFixed(4)} SOL | ${new Date(t.timestamp).toISOString()}`);
        if (t.type === 'BUY') {
            bought += t.tokenAmount;
            cost += t.solAmount;
        } else {
            sold += t.tokenAmount;
            rev += t.solAmount;
        }
    });

    console.log(`\nTOTALS:`);
    console.log(`Bought: ${bought.toFixed(2)} for ${cost.toFixed(4)} SOL`);
    console.log(`Sold:   ${sold.toFixed(2)} for ${rev.toFixed(4)} SOL`);
    console.log(`Net:    ${(rev - cost).toFixed(4)} SOL`);
}
inspect();

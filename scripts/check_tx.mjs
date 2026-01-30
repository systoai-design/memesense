
import { getEnhancedTransactions } from '../lib/helius.js';

const WALLET = '8chkaxQNZ4TZqpWzvb8p5opxwmTHJkrK69GBMUp4BqJf';

async function run() {
    console.log('Fetching history to find target TX...');
    const txs = await getEnhancedTransactions(WALLET, { limit: 100 });

    // Look for sig starting with 2ofbGPtW
    const target = txs.find(t => t.signature.startsWith('2ofbGPtW'));

    if (!target) {
        console.log('Target TX not found in recent history.');
        return;
    }

    console.log(`Analyzing Seg: ${target.signature}`);
    console.log('Timestamp:', new Date(target.timestamp * 1000).toISOString());

    const userAccount = target.accountData.find(a => a.account === WALLET);
    console.log('Native Balance Change:', userAccount?.nativeBalanceChange);

    console.log('Token Transfers (User):');
    if (target.tokenTransfers) {
        target.tokenTransfers.filter(t => t.toUserAccount === WALLET || t.fromUserAccount === WALLET).forEach(t => {
            console.log(`- Mint: ${t.mint.slice(0, 8)}... Amt: ${t.fromUserAccount === WALLET ? '-' : '+'}${t.tokenAmount}`);
        });
    }

    console.log('Summary Logic Calculation:');
    let netSol = 0;
    if (userAccount && userAccount.nativeBalanceChange !== undefined) {
        netSol += userAccount.nativeBalanceChange / 1e9;
    }
    console.log(`Native Net: ${netSol}`);

    let wsolNet = 0;
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    if (target.tokenTransfers) {
        target.tokenTransfers.filter(t => t.toUserAccount === WALLET || t.fromUserAccount === WALLET).forEach(t => {
            if (t.mint === SOL_MINT) {
                if (t.toUserAccount === WALLET) wsolNet += t.tokenAmount;
                else wsolNet -= t.tokenAmount;
            }
        });
    }
    console.log(`wSOL Net: ${wsolNet}`);
    console.log(`TOTAL NET (Native + wSOL): ${netSol + wsolNet}`);

}

run();

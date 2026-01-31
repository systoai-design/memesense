import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getEnhancedTransactions } from '../lib/helius.js';

const WALLET = '8YWZkrj6p3HC4rbtWMc5No8A523mDcmcKxGhWmSfbCVa';

async function run() {
    console.log("Fetching raw transactions...");
    const txs = await getEnhancedTransactions(WALLET, { limit: 5 });

    if (txs && txs.length > 0) {
        // Find one with token transfers
        const tx = txs.find(t => t.tokenTransfers && t.tokenTransfers.length > 0);
        if (tx) {
            console.log(`\n--- Transaction: ${tx.signature} ---`);
            console.log("Keys:", Object.keys(tx));
            // Helius Enhanced usually puts balance changes in accountData?
            if (tx.accountData) {
                console.log("Account Data Entries:", tx.accountData.length);
                tx.accountData.forEach((ad, i) => {
                    console.log(`[${i}] Account: ${ad.account} | NativeChange: ${ad.nativeBalanceChange}`);
                    if (ad.tokenBalanceChanges) {
                        ad.tokenBalanceChanges.forEach(tbc => {
                            console.log(`    TokenChange: Mint: ${tbc.mint} | Amount: ${tbc.rawTokenAmount.tokenAmount}`);
                        });
                    }
                });
            }

            console.log("\nNative Transfers:");
            tx.nativeTransfers.forEach(t => {
                console.log(`  From: ${t.fromUserAccount} -> To: ${t.toUserAccount} | Amount: ${t.amount} lamports`);
            });

            console.log("\nToken Transfers:");
            tx.tokenTransfers.forEach(t => {
                console.log(`  Mint: ${t.mint} | Amt: ${t.tokenAmount} | From: ${t.fromUserAccount} -> To: ${t.toUserAccount}`);
            });

            // Check for potential Tip
            const tip = tx.nativeTransfers.find(t => t.fromUserAccount === WALLET && t.toUserAccount !== WALLET);
            if (tip) {
                console.log(`\n[POTENTIAL TIP] Found native transfer from wallet: ${tip.amount / 1e9} SOL`);
            }
        }
    }
}

run();

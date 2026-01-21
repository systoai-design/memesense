
const { Connection, PublicKey } = require('@solana/web3.js');

// Constants
const ADMIN_WALLET = process.env.PAYMENT_WALLET_ADDRESS || process.env.ADMIN_WALLET;
// We read price from env but parsed as float
const PREMIUM_PRICE_SOL = parseFloat(process.env.PREMIUM_PRICE_SOL || '0.5');

// Initialize connection
// We use the Helius RPC URL from env
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(RPC_URL, 'confirmed');

/**
 * Verify a transaction on-chain
 * @param {string} signature - The transaction signature to verify
 * @param {string} senderAddress - The expected sender wallet address
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function verifyPayment(signature, senderAddress) {
    if (!signature || !senderAddress) {
        return { success: false, error: 'Missing signature or sender' };
    }

    try {
        console.log(`Verifying payment tx: ${signature} from ${senderAddress}`);

        // 1. Fetch transaction
        const tx = await connection.getParsedTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
        });

        if (!tx) {
            return { success: false, error: 'Transaction not found or not confirmed' };
        }

        if (tx.meta?.err) {
            return { success: false, error: 'Transaction failed on-chain' };
        }

        // 2. Check basics
        // const blockTime = tx.blockTime;
        // if (blockTime && (Date.now() / 1000) - blockTime > 3600) {
        //     return { success: false, error: 'Transaction is too old' };
        // }

        // 3. Verify transfer amount and recipient
        const instructions = tx.transaction.message.instructions;
        let amountVerified = false;
        let recipientVerified = false;

        // Flatten inner instructions if any (unlikely for simple transfer but possible with wallets)
        // For simple SOL transfer, we look for SystemProgram.transfer

        // We can also check account keys balance changes (meta.postTokenBalances / postBalances)
        // meta.preBalances vs meta.postBalances is more reliable for exact SOL change

        const accountKeys = tx.transaction.message.accountKeys.map(k => k.pubkey.toString());
        const adminIndex = accountKeys.findIndex(k => k === ADMIN_WALLET);

        if (adminIndex === -1) {
            return { success: false, error: 'Admin wallet not found in transaction' };
        }

        const preBalance = tx.meta.preBalances[adminIndex];
        const postBalance = tx.meta.postBalances[adminIndex];
        const receivedLamports = postBalance - preBalance;
        const receivedSol = receivedLamports / 1000000000;

        console.log(`Admin received: ${receivedSol} SOL`);

        // Allow a small margin of error for floating point, though lamports are integer. 
        // We expect exact amount or more.
        if (receivedSol >= PREMIUM_PRICE_SOL - 0.005) { // 0.005 tolerance
            return { success: true };
        } else {
            return {
                success: false,
                error: `Insufficient amount received: ${receivedSol} SOL (Expected ${PREMIUM_PRICE_SOL} SOL)`
            };
        }

    } catch (error) {
        console.error('Payment verification error:', error);
        return { success: false, error: error.message };
    }
}

module.exports = { verifyPayment, PREMIUM_PRICE_SOL, ADMIN_WALLET };

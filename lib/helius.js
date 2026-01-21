import { normalize } from 'path';

/**
 * Extract Helius API Key from RPC URL
 */
function getHeliusKey() {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const match = rpcUrl.match(/api-key=([a-f0-9-]+)/i);
    return match ? match[1] : null;
}

/**
 * Fetch Wallet Transaction History from Helius
 * @param {string} walletAddress 
 * @returns {Promise<Array>} Parsed trades
 */
export async function getWalletHistory(walletAddress) {
    const apiKey = getHeliusKey();
    if (!apiKey) {
        console.warn('No Helius API Key found');
        return [];
    }

    try {
        // Fetch up to 3000 transactions (SWAP type only to filter noise) using pagination
        let allTransactions = [];
        let beforeSignature = null;
        // OPTIMIZATION: Reduced from 3000 to 1000 to speed up analysis. 
        // 1000 txs is enough for most "Recent Profitability" checks.
        const TARGET_LIMIT = 1000;

        while (allTransactions.length < TARGET_LIMIT) {
            // Fetch all transaction types (essential for bot wallets that use TRANSFER/UNKNOWN)
            let url = `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${apiKey}&limit=100`;
            if (beforeSignature) {
                url += `&before=${beforeSignature}`;
            }

            const response = await fetch(url);

            if (!response.ok) {
                // If specific error, log it but maybe return what we have? 
                // For now, throw to trigger fallback or error page
                throw new Error(`Helius API Error: ${response.status}`);
            }

            const chunk = await response.json();

            if (!Array.isArray(chunk) || chunk.length === 0) {
                break; // No more data
            }

            allTransactions = allTransactions.concat(chunk);
            beforeSignature = chunk[chunk.length - 1].signature;

            // Safety break if chunk < 100 (end of history)
            if (chunk.length < 100) break;
        }

        const data = allTransactions;

        // Parse into standardized Trade format using Balance Deltas (Flux)
        // This handles standard Swaps AND complex Bot behavior (Transfers)
        const trades = data.map(tx => {
            // 1. Calculate Net SOL Change for this wallet
            let solChange = -(tx.fee || 5000) / 1e9; // Start with fee cost
            if (tx.nativeTransfers) {
                tx.nativeTransfers.forEach(nt => {
                    if (nt.fromUserAccount === walletAddress) solChange -= (nt.amount / 1e9);
                    if (nt.toUserAccount === walletAddress) solChange += (nt.amount / 1e9);
                });
            }

            // 2. Calculate Net Token Change for this wallet
            // We need to identify the PRIMARY token involved (largest value or only one)
            // A trade usually involves one major token change.
            const tokenChanges = {};
            if (tx.tokenTransfers) {
                tx.tokenTransfers.forEach(tt => {
                    if (tt.fromUserAccount === walletAddress) {
                        tokenChanges[tt.mint] = (tokenChanges[tt.mint] || 0) - tt.tokenAmount;
                    }
                    if (tt.toUserAccount === walletAddress) {
                        tokenChanges[tt.mint] = (tokenChanges[tt.mint] || 0) + tt.tokenAmount;
                    }
                });
            }

            // Find the most significant token change
            // Ignore wSOL (So11111111111111111111111111111111111111112) as it's just wrapped SOL
            const wSOL = 'So11111111111111111111111111111111111111112';
            let targetMint = null;
            let targetAmount = 0;

            for (const [mint, amount] of Object.entries(tokenChanges)) {
                if (mint === wSOL) continue;
                // We pick the one with non-zero change
                if (Math.abs(amount) > 0) {
                    // Start with first valid one found, or maybe largest? 
                    // Usually sniper swaps are single token.
                    targetMint = mint;
                    targetAmount = amount;
                    break;
                }
            }

            if (!targetMint) return null; // No token movement for user

            // 3. Determine Type
            // BUY: SOL Down, Token Up
            // SELL: SOL Up, Token Down
            let type = null;
            let isTrade = false;

            // Thresholds to filter small dust/rent adjustments
            if (solChange < -0.0001 && targetAmount > 0) {
                type = 'BUY';
                isTrade = true;
            } else if (solChange > 0.0001 && targetAmount < 0) {
                type = 'SELL';
                isTrade = true;
            }

            if (!isTrade) return null;

            return {
                type, // 'BUY' or 'SELL'
                mint: targetMint,
                solAmount: Math.abs(solChange), // The cost or the revenue
                tokenAmount: Math.abs(targetAmount),
                timestamp: tx.timestamp * 1000,
                signature: tx.signature
            };
        }).filter(t => t !== null);

        return trades;

    } catch (e) {
        console.error('Info: Helius History Fetch failed', e.message);
        return [];
    }
}

/**
 * Fetch Metadata for a batch of tokens using Helius DAS API
 * @param {Array<string>} mints 
 * @returns {Promise<Object>} Map of mint -> { symbol, name, image }
 */
export async function getBatchTokenMetadata(mints) {
    const apiKey = getHeliusKey();
    if (!apiKey || !mints || mints.length === 0) return {};

    try {
        const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';
        const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'my-id',
                method: 'getAssetBatch',
                params: {
                    ids: mints.slice(0, 1000) // Max 1000 per batch
                }
            })
        });

        const { result } = await response.json();

        if (!result) return {};

        const metadataMap = {};
        result.forEach(item => {
            if (item && item.content) {
                const metadata = item.content.metadata;
                const files = item.content.files;
                const image = (files && files.length > 0) ? files[0].uri : item.content.json_uri; // Fallback logic

                metadataMap[item.id] = {
                    symbol: metadata.symbol || 'UNKNOWN',
                    name: metadata.name || 'Unknown Token',
                    image: item.content.links?.image || image || '', // Try links.image first as it's often more direct
                };
            }
        });

        return metadataMap;

    } catch (e) {
        console.error('Info: Helius Metadata Fetch failed', e.message);
        return {};
    }
}

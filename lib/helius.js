
const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;

/**
 * Extract API Key from the configured RPC URL
 */
function getApiKey() {
    if (!HELIUS_RPC_URL) return null;
    const match = HELIUS_RPC_URL.match(/api-key=([a-f0-9-]+)/i);
    return match ? match[1] : null;
}

/**
 * Helius Digital Asset Standard (DAS) API
 * fast "getAsset" to fetch metadata, authorities, and token info in one call.
 * Reference: https://docs.helius.dev/compression-and-das/getasset
 */
export async function getAsset(assetId) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('No Helius API Key found');

    const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'memesense-das',
            method: 'getAsset',
            params: {
                id: assetId,
                displayOptions: {
                    showFungible: true // Get token supply/details
                }
            }
        })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result;
}

/**
 * Helius Enhanced Transactions API
 * Used for high-performance sniper detection (finding early buyers)
 * Reference: https://docs.helius.dev/enhanced-transactions-api/parse-transaction-history
 */
export async function getEnhancedTransactions(address, options = {}) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('No Helius API Key found');

    const { limit = 100, before = '', type } = options;

    let url = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${apiKey}`;
    if (limit) url += `&limit=${limit}`;
    if (before) url += `&before=${before}`;
    if (type) url += `&type=${type}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Helius Enhanced API Error: ${response.status}`);
    }

    return await response.json();
}

/**
 * Get Token Authorities via DAS (Instant)
 * Replaces manual account parsing.
 */
export async function getHeliusTokenAuthorities(tokenAddress) {
    try {
        const asset = await getAsset(tokenAddress);

        // DAS returns specific "authorities" array often empty for fungible tokens,
        // but "token_info" contains the freeze/mint authority.
        const tokenInfo = asset.token_info;

        if (!tokenInfo) {
            return { isEstimated: true, reason: 'No token_info in DAS response' };
        }

        const mintAuthority = tokenInfo.mint_authority;
        const freezeAuthority = tokenInfo.freeze_authority;
        const supply = tokenInfo.supply;
        const decimals = tokenInfo.decimals;

        // Burn calculation (Simplified for DAS)
        // If mint is null and freeze is null, it's very safe (likely burned LP if Raydium)
        let burnPercent = 0;
        if (!mintAuthority && !freezeAuthority) {
            burnPercent = 100;
        } else if (!mintAuthority) {
            burnPercent = 50;
        }

        return {
            burnPercent,
            isRenounced: !mintAuthority,
            isFreezeRevoked: !freezeAuthority,
            mintAuthority,
            freezeAuthority,
            supply: supply / Math.pow(10, decimals),
            decimals,
            isEstimated: false, // REAL ON-CHAIN DATA
            metadata: {
                name: asset.content?.metadata?.name,
                symbol: asset.content?.metadata?.symbol,
                uri: asset.content?.json_uri
            }
        };

    } catch (error) {
        console.error('Helius DAS Authorities Failed:', error);
        return { isEstimated: true, error: error.message };
    }
}

/**
 * Get Batch Token Metadata via DAS
 * @param {Array<string>} mints - List of mint addresses
 */
export async function getBatchTokenMetadata(mints) {
    const apiKey = getApiKey();
    if (!apiKey || mints.length === 0) return {};

    // Chunk into 100s (Helius limit)
    const chunks = [];
    for (let i = 0; i < mints.length; i += 100) {
        chunks.push(mints.slice(i, i + 100));
    }

    const metadataMap = {};

    for (const chunk of chunks) {
        try {
            const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'memesense-batch',
                    method: 'getAssetBatch',
                    params: {
                        ids: chunk,
                        displayOptions: {
                            showFungible: true
                        }
                    }
                })
            });

            const data = await response.json();
            if (data.result) {
                data.result.forEach(asset => {
                    if (asset) {
                        metadataMap[asset.id] = {
                            name: asset.content?.metadata?.name || 'Unknown',
                            symbol: asset.content?.metadata?.symbol || 'UNK',
                            image: asset.content?.links?.image || asset.content?.json_uri || '',
                            uri: asset.content?.json_uri
                        };
                    }
                });
            }
        } catch (e) {
            console.error('[Helius] Batch Metadata Failed:', e);
        }
    }

    return metadataMap;
}

/**
 * Get Wallet Transaction History & Parse for Analysis
 * @param {string} walletAddress 
 */
export async function getWalletHistory(walletAddress) {
    try {
        console.log(`[Helius] Fetching history for ${walletAddress}...`);

        // Fetch last 100 SWAP transactions for efficiency
        // We might need more for deep history, but start with 100
        const txs = await getEnhancedTransactions(walletAddress, {
            limit: 100,
            type: 'SWAP'
        });

        if (!txs || txs.length === 0) return [];

        const trades = [];
        const SOL_MINT = 'So11111111111111111111111111111111111111112';

        for (const tx of txs) {
            if (!tx.tokenTransfers) continue;

            const timestamp = tx.timestamp * 1000; // Convert to ms

            // Identify if this wallet is the Source (Seller) or Destination (Buyer) relative to the Token
            // A Swap generally involves 1 Token Transfer IN and 1 Token/SOL Transfer OUT (or vice versa)

            // Filter transfers involving this wallet
            const incoming = tx.tokenTransfers.filter(t => t.toUserAccount === walletAddress);
            const outgoing = tx.tokenTransfers.filter(t => t.fromUserAccount === walletAddress);

            // Also check Native Transfers (SOL)
            const nativeIncoming = (tx.nativeTransfers || []).filter(t => t.toUserAccount === walletAddress);
            const nativeOutgoing = (tx.nativeTransfers || []).filter(t => t.fromUserAccount === walletAddress);

            // BUY DETECTION:
            // Wallet receives TOKEN (Mint != SOL) AND sends SOL/WSOL
            incoming.forEach(inTransfer => {
                const mint = inTransfer.mint;
                if (mint === SOL_MINT) return; // Ignore WSOL incoming for now (unless it's a sell of token)

                // Must have paid SOL/WSOL
                let solAmount = 0;

                // Check native spent
                nativeOutgoing.forEach(born => {
                    solAmount += born.amount / 1e9; // Native is lamports
                });

                // Check WSOL spent
                outgoing.forEach(out => {
                    if (out.mint === SOL_MINT) {
                        solAmount += out.tokenAmount;
                    }
                });

                // If found valid buy structure
                if (solAmount > 0) {
                    trades.push({
                        type: 'BUY',
                        mint: mint,
                        tokenAmount: inTransfer.tokenAmount,
                        solAmount: solAmount,
                        timestamp: timestamp,
                        signature: tx.signature
                    });
                }
            });

            // SELL DETECTION:
            // Wallet sends TOKEN (Mint != SOL) AND receives SOL/WSOL
            outgoing.forEach(outTransfer => {
                const mint = outTransfer.mint;
                if (mint === SOL_MINT) return;

                // Must have received SOL/WSOL
                let solAmount = 0;

                // Check native received
                nativeIncoming.forEach(born => {
                    solAmount += born.amount / 1e9;
                });

                // Check WSOL received
                incoming.forEach(inc => {
                    if (inc.mint === SOL_MINT) {
                        solAmount += inc.tokenAmount;
                    }
                });

                if (solAmount > 0) {
                    trades.push({
                        type: 'SELL',
                        mint: mint,
                        tokenAmount: outTransfer.tokenAmount,
                        solAmount: solAmount,
                        timestamp: timestamp,
                        signature: tx.signature
                    });
                }
            });
        }

        console.log(`[Helius] Parsed ${trades.length} trades.`);
        return trades;

    } catch (e) {
        console.error('[Helius] History Fetch Failed:', e);
        return [];
    }
}

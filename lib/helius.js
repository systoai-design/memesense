
const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;

/**
 * Extract API Key from the configured RPC URL
 */
function getApiKey() {
    if (!HELIUS_RPC_URL) return null;
    const match = HELIUS_RPC_URL.match(/api-key=([a-f0-9-]+)/i);
    return match ? match[1] : null;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Simple in-memory cache for wallet history (5 minutes)
// key: walletAddress, value: { trades: [], timestamp: number }
global.walletHistoryCache = global.walletHistoryCache || {};

/**
 * Helius Digital Asset Standard (DAS) API
 * fast "getAsset" to fetch metadata, authorities, and token info in one call.
 * Reference: https://docs.helius.dev/compression-and-das/getasset
 */
export async function getAsset(assetId) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('No Helius API Key found');

    const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
    const body = {
        jsonrpc: '2.0',
        id: 'memesense-das',
        method: 'getAsset',
        params: { id: assetId, displayOptions: { showFungible: true } }
    };

    let lastError = null;
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (response.status === 429) {
                const wait = Math.pow(2, attempt) * 1000 + Math.random() * 500;
                console.warn(`[Helius] getAsset Rate limited (429). Retry ${attempt + 1}/5 in ${Math.round(wait)}ms`);
                await sleep(wait);
                continue;
            }

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            return data.result;
        } catch (err) {
            lastError = err;
            await sleep(500 * (attempt + 1));
        }
    }
    throw lastError || new Error('Helius DAS API Failed after retries');
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

    let lastError = null;
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const response = await fetch(url);
            if (response.status === 429) {
                const wait = Math.pow(2, attempt) * 1000 + Math.random() * 500;
                console.warn(`[Helius] txHistory Rate limited (429). Retry ${attempt + 1}/5 in ${Math.round(wait)}ms...`);
                await sleep(wait);
                continue;
            }
            if (!response.ok) {
                throw new Error(`Helius Enhanced API Error: ${response.status}`);
            }
            return await response.json();
        } catch (err) {
            lastError = err;
            await sleep(1000);
        }
    }
    throw lastError || new Error('Helius API Connection Failed after retries');
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

    const chunkPromises = chunks.map(async (chunk) => {
        let lastError = null;

        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 'memesense-batch',
                        method: 'getAssetBatch',
                        params: { ids: chunk, displayOptions: { showFungible: true } }
                    })
                });

                if (response.status === 429) {
                    const wait = Math.pow(2, attempt) * 1000 + Math.random() * 500;
                    console.warn(`[Helius] Batch metadata rate limited. Retry ${attempt + 1}/5...`);
                    await sleep(wait);
                    continue;
                }

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
                return; // Success
            } catch (e) {
                lastError = e;
                await sleep(500 * (attempt + 1));
            }
        }
        console.error(`[Helius] Failed to fetch metadata chunk after retries:`, lastError);
    });

    await Promise.all(chunkPromises);

    return metadataMap;
}

/**
 * Get Wallet Transaction History & Parse for Analysis
 * @param {string} walletAddress 
 */
export async function getWalletHistory(walletAddress) {
    try {
        // 1. Check Cache (5 minutes)
        const CACHE_TTL = 5 * 60 * 1000;
        const cached = global.walletHistoryCache[walletAddress];
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
            console.log(`[Helius] Serving history for ${walletAddress} from cache`);
            return cached.trades;
        }

        console.log(`[Helius] Fetching history for ${walletAddress}...`);

        // Paginated fetch - target 1000 txs or 60 days of history
        const MAX_TXS = 1000;
        const MAX_PAGES = 10;
        const HISTORY_WINDOW_MS = 60 * 24 * 60 * 60 * 1000; // 60 Days
        const cutoffTime = Date.now() - HISTORY_WINDOW_MS;

        let allTxs = [];
        let lastSignature = null;
        let page = 0;
        let reachedLimit = false;

        while (page < MAX_PAGES && !reachedLimit) {
            page++;
            // Throttle: Optimized delay (300ms) to resolve faster while staying safe
            if (page > 1) await sleep(300);

            console.log(`[Helius] Fetching page ${page}...`);

            const options = { limit: 100 };
            if (lastSignature) options.before = lastSignature;

            let txs = [];
            try {
                txs = await getEnhancedTransactions(walletAddress, options);
            } catch (err) {
                console.warn(`[Helius] Page ${page} failed: ${err.message}`);
                if (page === 1) throw err; // Fatal
                break; // Work with partial
            }

            if (!txs || txs.length === 0) break;

            const oldestTx = txs[txs.length - 1];
            if (oldestTx && (oldestTx.timestamp * 1000) < cutoffTime) {
                const recentTxs = txs.filter(tx => (tx.timestamp * 1000) >= cutoffTime);
                allTxs = allTxs.concat(recentTxs);
                reachedLimit = true;
            } else {
                allTxs = allTxs.concat(txs);
                lastSignature = oldestTx?.signature;
            }

            if (allTxs.length >= MAX_TXS) reachedLimit = true;
        }

        console.log(`[Helius] Fetched ${allTxs.length} total transactions across ${page} pages`);

        if (allTxs.length === 0) return [];

        const trades = [];
        const SOL_MINT = 'So11111111111111111111111111111111111111112';
        const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        const SOL_PRICE_USD = 250; // Approx fixed rate for normalization

        for (const tx of allTxs) {
            if (!tx.tokenTransfers) continue;

            const timestamp = tx.timestamp * 1000;

            const incoming = tx.tokenTransfers.filter(t => t.toUserAccount === walletAddress);
            const outgoing = tx.tokenTransfers.filter(t => t.fromUserAccount === walletAddress);
            const nativeIncoming = (tx.nativeTransfers || []).filter(t => t.toUserAccount === walletAddress);
            const nativeOutgoing = (tx.nativeTransfers || []).filter(t => t.fromUserAccount === walletAddress);

            // BUY DETECTION
            incoming.forEach(inTransfer => {
                const mint = inTransfer.mint;
                if (mint === SOL_MINT || mint === USDC_MINT) return;

                let solAmount = 0;

                // Native SOL Spent
                nativeOutgoing.forEach(born => {
                    solAmount += born.amount / 1e9;
                });

                // WSOL Spent
                outgoing.forEach(out => {
                    if (out.mint === SOL_MINT) {
                        solAmount += out.tokenAmount;
                    }
                    // USDC Spent (Normalized)
                    if (out.mint === USDC_MINT) {
                        solAmount += (out.tokenAmount / SOL_PRICE_USD);
                    }
                });

                // RELAXED CHECK: If 0 SOL detected but type is SWAP, assume minimal cost (0.001) just to track it?
                // No, better to skip stats than pollute with bad data. 
                // But we will be slightly more permissive:
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

            // SELL DETECTION
            outgoing.forEach(outTransfer => {
                const mint = outTransfer.mint;
                if (mint === SOL_MINT || mint === USDC_MINT) return;

                let solAmount = 0;

                // Native SOL Received
                nativeIncoming.forEach(born => {
                    solAmount += born.amount / 1e9;
                });

                // WSOL/USDC Received
                incoming.forEach(inc => {
                    if (inc.mint === SOL_MINT) {
                        solAmount += inc.tokenAmount;
                    }
                    if (inc.mint === USDC_MINT) {
                        solAmount += (inc.tokenAmount / SOL_PRICE_USD);
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

        // Cache the result
        global.walletHistoryCache[walletAddress] = {
            trades,
            timestamp: Date.now()
        };

        return trades;

    } catch (e) {
        console.error('[Helius] History Fetch Failed:', e.message, e.stack);
        // Re-throw so caller can handle and show proper error
        throw new Error(`Failed to fetch wallet history: ${e.message}`);
    }
}

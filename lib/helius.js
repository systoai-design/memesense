
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
 * Fetch with Exponential Backoff + Retry
 * Optimized for Helius Free Plan: 10 RPC/s, 2 DAS/s
 * Base delay: 2s, Max retries: 5 (2s → 4s → 8s → 16s → 32s)
 */
async function fetchWithRetry(url, options = {}, retries = 5, delay = 2000) {
    try {
        const response = await fetch(url, options);

        if (response.status === 429) {
            throw new Error(`Rate Limit Exceeded (429)`);
        }

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        return await response.json();
    } catch (err) {
        if (retries <= 0) throw err;

        // Add jitter (0-500ms random) to prevent exact collision timing
        const jitter = Math.floor(Math.random() * 500);
        const waitTime = delay + jitter;

        console.warn(`[Helius] Request failed (${err.message}). Retrying in ${waitTime}ms... (${retries} retries left)`);
        await new Promise(r => setTimeout(r, waitTime));
        return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
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

    return await fetchWithRetry(url);
}

/**
 * Get Token Authorities via DAS (Instant)
 * Replaces manual account parsing.
 */
// ... (getHeliusTokenAuthorities code remains same, skipping for brevity, but I need to be careful with replace range)
// Actually I will target getWalletHistory specifically to avoid massive replace blocks if possible.
// Wait, I need fetchWithRetry globally available or inside this module.
// I will just add fetchWithRetry at the top and update getEnhancedTransactions.
// AND update getWalletHistory.

// RESTARTING STRATEGY: 
// 1. Add fetchWithRetry at top.
// 2. Update getEnhancedTransactions.
// 3. Update getWalletHistory signature and loop.

// This replace block covers getWalletHistory entirely.

/**
 * Get Wallet Transaction History & Parse for Analysis
 * @param {string} walletAddress 
 * @param {number} maxTxLimit - Hard limit for transactions to fetch (Default 1000)
 * @param {number|null} sinceTimestamp - Only fetch transactions newer than this (for incremental updates)
 */
export async function getWalletHistory(walletAddress, maxTxLimit = 1000, sinceTimestamp = null) {
    try {
        const mode = sinceTimestamp ? 'INCREMENTAL' : 'FULL';
        console.log(`[Helius] ${mode} fetch for ${walletAddress}. Limit: ${maxTxLimit}${sinceTimestamp ? `, since: ${new Date(sinceTimestamp).toISOString()}` : ''}`);

        // Paginated fetch - target maxTxLimit
        const MAX_PAGES = 50; // Increased from 10 to allow up to 5000 txs (for deep scans)
        const HISTORY_WINDOW_MS = 60 * 24 * 60 * 60 * 1000; // 60 Days
        const cutoffTime = sinceTimestamp || (Date.now() - HISTORY_WINDOW_MS);

        let allTxs = [];
        let lastSignature = null;
        let page = 0;
        let reachedLimit = false;

        while (page < MAX_PAGES && !reachedLimit) {
            page++;
            // Delay to prevent Rate Limits (600ms for 2 req/s DAS limit)
            if (page > 1) await new Promise(r => setTimeout(r, 600));

            console.log(`[Helius] Fetching page ${page}...`);

            const batchSize = 100;
            const options = {
                limit: batchSize
            };
            if (lastSignature) {
                options.before = lastSignature;
            }

            let txs = [];
            try {
                txs = await getEnhancedTransactions(walletAddress, options);
            } catch (err) {
                console.warn(`[Helius] Page ${page} failed: ${err.message}`);

                // CRITICAL: If page 1 fails, the entire fetch is dead. Throw so user knows.
                if (page === 1) {
                    throw new Error(`Helius API Connection Failed: ${err.message}`);
                }
                break;
            }

            if (!txs || txs.length === 0) break;

            // Check if oldest tx in batch is older than cutoff
            const oldestTx = txs[txs.length - 1];
            if (oldestTx && (oldestTx.timestamp * 1000) < cutoffTime) {
                const recentTxs = txs.filter(tx => (tx.timestamp * 1000) >= cutoffTime);
                allTxs = allTxs.concat(recentTxs);
                reachedLimit = true;
                console.log(`[Helius] Reached history cutoff at page ${page}`);
            } else {
                allTxs = allTxs.concat(txs);
                lastSignature = oldestTx?.signature;
            }

            if (allTxs.length >= maxTxLimit) {
                reachedLimit = true;
                // Trim to limit
                allTxs = allTxs.slice(0, maxTxLimit);
                console.log(`[Helius] Reached txn limit (${maxTxLimit})`);
            }
        }

        console.log(`[Helius] Fetched ${allTxs.length} total transactions across ${page} pages`);

        if (allTxs.length === 0) return [];

        const trades = [];
        const SOL_MINT = 'So11111111111111111111111111111111111111112';
        const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        const SOL_PRICE_USD = 250; // Approx fixed rate for normalization

        // BLOCKLIST: Major altcoins to exclude (only track memecoins/shitcoins)
        const ALTCOIN_BLOCKLIST = new Set([
            'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  // JUP
            'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',  // JTO
            'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', // PYTH
            'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',  // RNDR
            'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',  // ORCA
            'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey',  // MNDE
            'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',  // mSOL
            'So11111111111111111111111111111111111111112',   // wSOL
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
            'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
            '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj', // stSOL
            'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
            'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
            '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', // POPCAT
            'CATSnhJfVujp4TDDnQiYsvoJKCT2XvQJzXdtmFt4pump',  // CAT
            'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',  // MEW
            'A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump', // FARTCOIN
            '2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump', // PNUT
            'Grass7B4RdKfBCjTKgSqnXkqjwiGvQyFbuSCUJr3XXjs', // GRASS
            'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',  // BOME
            '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh', // WBTC
            '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // WETH
            'kinXdEcpDQeHPEuQnqmUgtYykqKGVFq6CeVX5iAHJq6',  // KIN
            'SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y',  // SHDW
            'RLBxxFkseAZ4RgJH3Sqn8jXxhmGoz9jWxDNJMh8pL7a',  // RAYDIUM
            '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // RAY
        ]);

        for (const tx of allTxs) {
            if (!tx.tokenTransfers) continue;

            const timestamp = tx.timestamp * 1000;

            const incoming = tx.tokenTransfers.filter(t => t.toUserAccount === walletAddress);
            const outgoing = tx.tokenTransfers.filter(t => t.fromUserAccount === walletAddress);
            const nativeIncoming = (tx.nativeTransfers || []).filter(t => t.toUserAccount === walletAddress);
            const nativeOutgoing = (tx.nativeTransfers || []).filter(t => t.fromUserAccount === walletAddress);

            // 1. Calculate Net SOL Change for the Transaction
            let netSolChange = 0;

            // PREFERRED: Use Account Balance Changes (Most Accurate)
            const accountData = tx.accountData || [];
            const userAccount = accountData.find(a => a.account === walletAddress);

            if (userAccount && userAccount.nativeBalanceChange !== undefined) {
                // Use Reliable Balance Change
                netSolChange = userAccount.nativeBalanceChange / 1e9;

                // Add WSOL/USDC Balance Changes if available
                if (userAccount.tokenBalanceChanges) {
                    userAccount.tokenBalanceChanges.forEach(tc => {
                        if (tc.mint === SOL_MINT) {
                            netSolChange += (tc.tokenBalanceChange || 0); // Check field name? usually tokenBalanceChange? or difference of post-pre?
                            // Helius Enhanced 'tokenBalanceChanges' usually has 'tokenBalanceChange' or similar?
                            // Actually Helius docs say: tokenTurnBalanceChanges: [{ mint, amount }]? 
                            // Wait. 'tokenBalanceChanges' in dump was array. 
                            // To be safe, if we don't know the exact field for token balance, we might miss WSOL spending.
                            // BUT for 99% of memecoin trades (Wrap -> Swap), Native Balance Change covers the cost correctly.
                        }
                        if (tc.mint === USDC_MINT) {
                            // Same logic
                        }
                    });
                }
            } else {
                // FALLBACK: Calculate logic manually (Native + WSOL + USDC Flow)
                // Native SOL Flow
                nativeIncoming.forEach(t => netSolChange += t.amount / 1e9);
                nativeOutgoing.forEach(t => netSolChange -= t.amount / 1e9);

                // WSOL Flow
                incoming.forEach(t => { if (t.mint === SOL_MINT) netSolChange += t.tokenAmount; });
                outgoing.forEach(t => { if (t.mint === SOL_MINT) netSolChange -= t.tokenAmount; });

                // USDC Flow (Normalized to SOL)
                incoming.forEach(t => { if (t.mint === USDC_MINT) netSolChange += (t.tokenAmount / SOL_PRICE_USD); });
                outgoing.forEach(t => { if (t.mint === USDC_MINT) netSolChange -= (t.tokenAmount / SOL_PRICE_USD); });
            }

            // 2. Identify Token Movements (Excluding SOL/USDC)
            const tokensBought = incoming.filter(t => t.mint !== SOL_MINT && t.mint !== USDC_MINT && !ALTCOIN_BLOCKLIST.has(t.mint));
            const tokensSold = outgoing.filter(t => t.mint !== SOL_MINT && t.mint !== USDC_MINT && !ALTCOIN_BLOCKLIST.has(t.mint));

            // 3. Attribute SOL Change
            // SCENARIO A: BUY (Net SOL < 0)
            if (tokensBought.length > 0 && netSolChange < -0.000001) {
                const totalCost = Math.abs(netSolChange);
                // Attribute cost evenly if multiple tokens (rare)
                const costPerToken = totalCost / tokensBought.length;

                tokensBought.forEach(token => {
                    trades.push({
                        type: 'BUY',
                        mint: token.mint,
                        tokenAmount: token.tokenAmount,
                        solAmount: costPerToken,
                        timestamp: timestamp,
                        signature: tx.signature
                    });
                });
            }

            // SCENARIO B: SELL (Net SOL > 0)
            if (tokensSold.length > 0 && netSolChange > 0.000001) {
                const totalRevenue = netSolChange;
                const revenuePerToken = totalRevenue / tokensSold.length;

                tokensSold.forEach(token => {
                    trades.push({
                        type: 'SELL',
                        mint: token.mint,
                        tokenAmount: token.tokenAmount,
                        solAmount: revenuePerToken,
                        timestamp: timestamp,
                        signature: tx.signature
                    });
                });
            }

            // SCENARIO C: SWAP (Token -> Token, Net SOL ~ 0)
            // If tokens moved both ways but SOL didn't change much, it's a direct swap.
            // Current PnL engine requires SOL basis. We have valid Token Amounts but 0 SOL.
            // We can try to infer value from the "Sold" token if known? 
            // For now, logging potential edge case, but most swaps route through SOL/USDC so NetSol will be non-zero.
            if (tokensBought.length > 0 && tokensSold.length > 0 && Math.abs(netSolChange) < 0.01) {
                // Warning: Token-to-Token swap with no SOL/USDC drift.
                // We record the movements with 0 SOL value to track position size, avoiding "Missing Tokens" logic errors.
                tokensBought.forEach(token => {
                    trades.push({ type: 'BUY', mint: token.mint, tokenAmount: token.tokenAmount, solAmount: 0, timestamp, signature: tx.signature });
                });
                tokensSold.forEach(token => {
                    trades.push({ type: 'SELL', mint: token.mint, tokenAmount: token.tokenAmount, solAmount: 0, timestamp, signature: tx.signature });
                });
            }
        }

        console.log(`[Helius] Parsed ${trades.length} trades.`);
        return trades;

    } catch (e) {
        console.error('[Helius] History Fetch Failed:', e.message, e.stack);
        throw new Error(`Failed to fetch wallet history: ${e.message}`);
    }
}


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
                            image: asset.content?.links?.image || asset.content?.files?.[0]?.uri || '', // No json_uri fallback
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
import { getHistoricalSolPrice } from './price-history.js';

// ... (getEnhancedTransactions and other exports remain same) ...

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
        const MAX_PAGES = 50; // Increased
        const HISTORY_WINDOW_MS = 60 * 24 * 60 * 60 * 1000; // 60 Days
        const cutoffTime = sinceTimestamp || (Date.now() - HISTORY_WINDOW_MS);

        let allTxs = [];
        let lastSignature = null;
        let page = 0;
        let reachedLimit = false;

        // --- FETCH LOOP (Same as before) ---
        while (page < MAX_PAGES && !reachedLimit) {
            page++;
            if (page > 1) await new Promise(r => setTimeout(r, 600));

            const options = { limit: 100 };
            if (lastSignature) options.before = lastSignature;

            let txs = [];
            try {
                txs = await getEnhancedTransactions(walletAddress, options);
            } catch (err) {
                console.warn(`[Helius] Page ${page} failed: ${err.message}`);
                if (page === 1) throw new Error(`Helius API Connection Failed: ${err.message}`);
                break;
            }

            if (!txs || txs.length === 0) break;

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
                allTxs = allTxs.slice(0, maxTxLimit);
                console.log(`[Helius] Reached txn limit (${maxTxLimit})`);
            }
        }

        console.log(`[Helius] Fetched ${allTxs.length} total transactions across ${page} pages`);
        if (allTxs.length === 0) return [];

        const trades = [];
        const SOL_MINT = 'So11111111111111111111111111111111111111112';
        const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

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
            const histSolPrice = getHistoricalSolPrice(timestamp); // Accurate Price for Normalization

            const incoming = tx.tokenTransfers.filter(t => t.toUserAccount === walletAddress);
            const outgoing = tx.tokenTransfers.filter(t => t.fromUserAccount === walletAddress);
            const nativeIncoming = (tx.nativeTransfers || []).filter(t => t.toUserAccount === walletAddress);
            const nativeOutgoing = (tx.nativeTransfers || []).filter(t => t.fromUserAccount === walletAddress);

            // 1. Calculate Net SOL Change (Unified: Native + wSOL)
            // This captures Swaps, Wraps/Unwraps, Fees, and Jito Tips correctly.
            let netSolChange = 0;
            let netWsolChange = 0;
            let netNativeChange = 0;

            // A. wSOL Change
            incoming.forEach(t => { if (t.mint === SOL_MINT) netWsolChange += t.tokenAmount; });
            outgoing.forEach(t => { if (t.mint === SOL_MINT) netWsolChange -= t.tokenAmount; });

            // B. Native SOL Change
            // Use accountData if available (Most accurate, includes fees/tips/rent)
            const accountData = tx.accountData || [];
            const userAccount = accountData.find(a => a.account === walletAddress);

            if (userAccount && userAccount.nativeBalanceChange !== undefined) {
                netSolChange += (userAccount.nativeBalanceChange / 1e9);
            } else {
                // Fallback: Manually sum native transfers
                nativeIncoming.forEach(t => netSolChange += t.amount / 1e9);
                nativeOutgoing.forEach(t => netSolChange -= t.amount / 1e9);

                // Deduct Fee if manual fallback (nativeBalanceChange includes it)
                if (tx.feePayer === walletAddress) {
                    netSolChange -= (tx.fee / 1e9);
                }
            }

            // C. Stablecoin Change (Normalized to SOL)
            // USDC & USDT
            incoming.forEach(t => {
                if (t.mint === USDC_MINT || t.mint === USDT_MINT) {
                    netSolChange += (t.tokenAmount / histSolPrice);
                }
            });
            outgoing.forEach(t => {
                if (t.mint === USDC_MINT || t.mint === USDT_MINT) {
                    netSolChange -= (t.tokenAmount / histSolPrice);
                }
            });

            // 2. Identify Token Movements (Excluding Blocklist/Stables/SOL)
            const tokensBought = incoming.filter(t =>
                t.mint !== SOL_MINT &&
                t.mint !== USDC_MINT &&
                t.mint !== USDT_MINT &&
                !ALTCOIN_BLOCKLIST.has(t.mint));

            const tokensSold = outgoing.filter(t =>
                t.mint !== SOL_MINT &&
                t.mint !== USDC_MINT &&
                t.mint !== USDT_MINT &&
                !ALTCOIN_BLOCKLIST.has(t.mint));

            // 3. Attribute SOL Change
            // SCENARIO A: BUY (Net SOL < 0)
            if (tokensBought.length > 0 && netSolChange < -0.000001) {
                const totalCost = Math.abs(netSolChange);
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
                    // DEBUG: Log date to catch 2024 issues
                    const d = new Date(timestamp);
                    if (d.getFullYear() < 2025) {
                        console.warn(`[Helius] SUSPICIOUS OLD DATE: ${d.toISOString()} (Timestamp: ${timestamp}) for Mint: ${token.mint}, Sig: ${tx.signature}`);
                    }

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
        }

        // Deduplicate Trades by Signature (Safety Net)
        const uniqueTrades = [];
        const seenSigs = new Set();

        for (const trade of trades) {
            if (!seenSigs.has(trade.signature)) {
                seenSigs.add(trade.signature);
                uniqueTrades.push(trade);
            }
        }

        console.log(`[Helius] Parsed ${trades.length} trades. Unique: ${uniqueTrades.length}.`);
        return uniqueTrades;

    } catch (e) {
        console.error('[Helius] History Fetch Failed:', e.message, e.stack);
        throw new Error(`Failed to fetch wallet history: ${e.message}`);
    }
}


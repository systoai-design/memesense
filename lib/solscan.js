/**
 * Solscan Pro API Integration
 * Uses V2 API for pre-parsed DEX swap data
 * Docs: https://pro-api.solscan.io/pro-api-docs/v2.0
 */

const SOLSCAN_API_BASE = 'https://pro-api.solscan.io/v2.0';

/**
 * Get API Key from environment
 */
function getApiKey() {
    return process.env.SOLSCAN_API_KEY;
}

/**
 * Make authenticated request to Solscan API
 */
async function solscanFetch(endpoint, params = {}) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('SOLSCAN_API_KEY not configured');
    }

    const url = new URL(`${SOLSCAN_API_BASE}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            if (Array.isArray(value)) {
                value.forEach(v => url.searchParams.append(key, v));
            } else {
                url.searchParams.set(key, value);
            }
        }
    });

    console.log(`[Solscan] Fetching: ${endpoint}`);

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            'token': apiKey,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Solscan] API Error ${response.status}:`, errorText);
        throw new Error(`Solscan API Error: ${response.status}`);
    }

    const json = await response.json();

    if (!json.success) {
        throw new Error(`Solscan API returned error: ${JSON.stringify(json.errors)}`);
    }

    return json.data;
}

/**
 * Get wallet DEX swap history
 * Returns pre-parsed swaps with token pairs, amounts, platforms
 * 
 * @param {string} walletAddress - Wallet to analyze
 * @param {object} options - Query options
 * @returns {Array} Array of trade objects in standard format
 */
export async function getWalletSwaps(walletAddress, options = {}) {
    const {
        pageSize = 100,
        maxPages = 50,  // Increased for full wallet lifecycle
        fromTime = null,
        toTime = null
    } = options;

    console.log(`[Solscan] Fetching swap history for ${walletAddress}`);

    let allActivities = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
        try {
            const params = {
                address: walletAddress,
                activity_type: ['ACTIVITY_TOKEN_SWAP', 'ACTIVITY_AGG_TOKEN_SWAP'],
                page: page,
                page_size: pageSize,
                sort_by: 'block_time',
                sort_order: 'desc'
            };

            if (fromTime) params.from_time = Math.floor(fromTime / 1000);
            if (toTime) params.to_time = Math.floor(toTime / 1000);

            const activities = await solscanFetch('/account/defi/activities', params);

            if (!activities || activities.length === 0) {
                hasMore = false;
            } else {
                allActivities = allActivities.concat(activities);
                page++;

                // If we got less than page_size, no more pages
                if (activities.length < pageSize) {
                    hasMore = false;
                }
            }

            // Rate limit protection: 100ms delay between pages
            if (hasMore) {
                await new Promise(r => setTimeout(r, 100));
            }
        } catch (err) {
            console.error(`[Solscan] Page ${page} failed:`, err.message);
            if (page === 1) throw err; // First page failure is critical
            hasMore = false;
        }
    }

    console.log(`[Solscan] Fetched ${allActivities.length} swap activities across ${page - 1} pages`);

    // Convert Solscan format to our standard trade format
    return parseSwapsToTrades(allActivities, walletAddress);
}

/**
 * Parse Solscan swap activities into standard trade format
 */
function parseSwapsToTrades(activities, walletAddress) {
    const trades = [];

    // Known stablecoins and base tokens to identify buy/sell direction
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const STABLECOINS = new Set([
        'So11111111111111111111111111111111111111112',   // wSOL
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
    ]);

    // COMPREHENSIVE ALTCOIN BLOCKLIST - Only track memecoins/shitcoins
    const ALTCOIN_BLOCKLIST = new Set([
        // Infrastructure / DeFi
        'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  // JUP
        'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',  // JTO
        'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', // PYTH
        'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',  // RNDR
        'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',  // ORCA
        'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey',  // MNDE
        '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // RAY
        'RLBxxFkseAZ4RgJH3Sqn8jXxhmGoz9jWxDNJMh8pL7a',  // RAYDIUM
        'kinXdEcpDQeHPEuQnqmUgtYykqKGVFq6CeVX5iAHJq6',  // KIN
        'SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y',  // SHDW
        'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC', // HELIUM
        'TNSRxcUxoT9xBG3de7PiJyTDYu7kskLqcpddxnEJAS6', // TENSOR

        // Stablecoins
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
        '2wMe8KCqVN326qQ1thSqHvVCE3j8TrbtGt1nKnC6mpdb', // USD1
        'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX',  // USDH
        'UXPhBoR3qG4UCiGNJfV7MqhHyFqKN68g45GoYvAeL2M',  // UXD

        // Liquid Staking
        'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',  // mSOL
        '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj', // stSOL
        'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1',  // bSOL
        'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', // jitoSOL

        // Wrapped Assets
        'So11111111111111111111111111111111111111112',   // wSOL
        '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh', // WBTC
        '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // WETH

        // Established Memecoins (too big, not shitcoins)
        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
        'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
        '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', // POPCAT
        'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',  // MEW
        'Grass7B4RdKfBCjTKgSqnXkqjwiGvQyFbuSCUJr3XXjs', // GRASS
        'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',  // BOME
        'CATSnhJfVujp4TDDnQiYsvoJKCT2XvQJzXdtmFt4pump',  // CAT
    ]);

    for (const activity of activities) {
        try {
            const timestamp = activity.block_time * 1000;
            const signature = activity.trans_id;

            // Get the main router (swap path)
            const routers = activity.routers || [];
            if (routers.length === 0) continue;

            // For aggregated swaps, get the first and last token in path
            const firstRouter = routers[0];
            const lastRouter = routers[routers.length - 1];

            const tokenIn = firstRouter.token1;
            const tokenOut = lastRouter.token2;
            const amountIn = parseFloat(firstRouter.amount1) / Math.pow(10, firstRouter.token1_decimals || 9);
            const amountOut = parseFloat(lastRouter.amount2) / Math.pow(10, lastRouter.token2_decimals || 9);

            // Skip if both tokens are stablecoins/SOL
            if (STABLECOINS.has(tokenIn) && STABLECOINS.has(tokenOut)) continue;

            // Determine trade direction
            let type, mint, tokenAmount, solAmount;

            if (STABLECOINS.has(tokenIn)) {
                // Spent SOL/stable → BUY memecoin
                type = 'BUY';
                mint = tokenOut;
                tokenAmount = amountOut;
                solAmount = tokenIn === SOL_MINT ? amountIn : amountIn / 250; // Normalize USDC to SOL
            } else if (STABLECOINS.has(tokenOut)) {
                // Received SOL/stable → SELL memecoin
                type = 'SELL';
                mint = tokenIn;
                tokenAmount = amountIn;
                solAmount = tokenOut === SOL_MINT ? amountOut : amountOut / 250;
            } else {
                // Token-to-token swap - skip for now (complex)
                continue;
            }

            // Skip altcoins
            if (ALTCOIN_BLOCKLIST.has(mint)) continue;

            trades.push({
                type,
                mint,
                tokenAmount,
                solAmount,
                timestamp,
                signature,
                platform: activity.platform || 'unknown',
                source: 'solscan'
            });
        } catch (err) {
            console.warn('[Solscan] Failed to parse activity:', err.message);
        }
    }

    console.log(`[Solscan] Parsed ${trades.length} trades from ${activities.length} activities`);
    return trades;
}

/**
 * Get token holders from Solscan
 * @param {string} tokenAddress - Token mint address
 * @param {number} limit - Number of holders to return
 */
export async function getTokenHolders(tokenAddress, limit = 20) {
    try {
        const data = await solscanFetch('/token/holders', {
            address: tokenAddress,
            page: 1,
            page_size: limit
        });
        return data || [];
    } catch (err) {
        console.error('[Solscan] getTokenHolders failed:', err.message);
        return [];
    }
}

/**
 * Get token metadata from Solscan
 * @param {string} tokenAddress - Token mint address
 */
export async function getTokenMeta(tokenAddress) {
    try {
        const data = await solscanFetch('/token/meta', {
            address: tokenAddress
        });
        return data;
    } catch (err) {
        console.error('[Solscan] getTokenMeta failed:', err.message);
        return null;
    }
}

/**
 * Get token price from Solscan
 * @param {string} tokenAddress - Token mint address
 */
export async function getTokenPrice(tokenAddress) {
    try {
        const data = await solscanFetch('/token/price', {
            address: tokenAddress
        });
        return data?.price || null;
    } catch (err) {
        console.error('[Solscan] getTokenPrice failed:', err.message);
        return null;
    }
}

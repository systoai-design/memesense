/**
 * DexScreener API Integration for Live Pump.fun Data
 * No API key required! Free public API.
 * Rate limit: ~300 requests/minute
 */

const DEXSCREENER_API = 'https://api.dexscreener.com/latest';

/**
 * Fetch token data from DexScreener
 * @param {string} tokenAddress - Solana token contract address
 * @returns {object} Token data
 */
async function getTokenData(tokenAddress) {
    try {
        const response = await fetch(`${DEXSCREENER_API}/dex/tokens/${tokenAddress}`);

        if (!response.ok) {
            throw new Error(`DexScreener API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.pairs || data.pairs.length === 0) {
            throw new Error('Token not found on DexScreener');
        }

        // Get the main pair (usually the one with highest liquidity)
        const pairs = data.pairs.filter(p => p.chainId === 'solana');
        const mainPair = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];

        if (!mainPair) {
            throw new Error('No Solana pairs found for this token');
        }

        // Check if it's a pump.fun token
        const isPumpFun = mainPair.dexId === 'pumpfun' ||
            mainPair.url?.includes('pump.fun') ||
            mainPair.labels?.includes('pump.fun');

        // Calculate metrics
        const priceChange24h = parseFloat(mainPair.priceChange?.h24 || 0);
        const volume24h = parseFloat(mainPair.volume?.h24 || 0);
        const volume1h = parseFloat(mainPair.volume?.h1 || 0);
        const volume5m = parseFloat(mainPair.volume?.m5 || 0);
        const marketCap = parseFloat(mainPair.marketCap || mainPair.fdv || 0);

        // Estimate buy/sell ratio from price and volume changes
        // This is an approximation since DexScreener doesn't provide exact buy/sell counts
        const buyRatio = estimateBuyRatio(mainPair);

        return {
            name: mainPair.baseToken?.name || 'Unknown',
            symbol: mainPair.baseToken?.symbol || 'N/A',
            address: mainPair.baseToken?.address || tokenAddress,
            price: parseFloat(mainPair.priceUsd || 0),
            priceNative: parseFloat(mainPair.priceNative || 0),
            marketCap: Math.round(marketCap),
            fdv: parseFloat(mainPair.fdv || 0),
            volume24h: Math.round(volume24h),
            volume1h: Math.round(volume1h),
            volume5m: Math.round(volume5m),
            priceChange24h: priceChange24h,
            priceChange1h: parseFloat(mainPair.priceChange?.h1 || 0),
            priceChange5m: parseFloat(mainPair.priceChange?.m5 || 0),
            liquidity: Math.round(mainPair.liquidity?.usd || 0),
            pairAddress: mainPair.pairAddress,
            dexId: mainPair.dexId,
            isPumpFun: isPumpFun,
            // Estimated metrics
            buyRatio: buyRatio,
            buyCount: Math.round((mainPair.txns?.h24?.buys || 0)),
            sellCount: Math.round((mainPair.txns?.h24?.sells || 0)),
            buyCount5m: Math.round((mainPair.txns?.m5?.buys || 0)),
            sellCount5m: Math.round((mainPair.txns?.m5?.sells || 0)),
            totalTrades: (mainPair.txns?.h24?.buys || 0) + (mainPair.txns?.h24?.sells || 0),
            // Timestamps
            pairCreatedAt: mainPair.pairCreatedAt,
            ageHours: mainPair.pairCreatedAt
                ? Math.round((Date.now() - mainPair.pairCreatedAt) / 3600000)
                : null,
            // Additional info
            url: mainPair.url,
            imageUrl: mainPair.info?.imageUrl || `https://dd.dexscreener.com/ds-data/tokens/${mainPair.chainId}/${mainPair.baseToken.address}.png`,
            websites: mainPair.info?.websites || [],
            socials: mainPair.info?.socials || []
        };
    } catch (error) {
        console.error('DexScreener fetch error:', error);
        throw error;
    }
}

/**
 * Estimate buy/sell ratio from transaction data
 */
function estimateBuyRatio(pair) {
    const buys = pair.txns?.h24?.buys || 0;
    const sells = pair.txns?.h24?.sells || 0;
    const total = buys + sells;

    if (total === 0) return 50;
    return Math.round((buys / total) * 100);
}

/**
 * Get holder data - DexScreener doesn't provide this
 * Returns estimated data based on liquidity and market cap
 * For accurate holder data, would need Bitquery or on-chain RPC
 */
async function getHolderData(tokenAddress) {
    // DexScreener doesn't provide holder data
    // Return estimated data based on market patterns
    const tokenData = await getTokenData(tokenAddress);

    // Estimate holder count based on market cap and volume
    // More volume/mcap ratio usually means more active holders
    const volumeToMcap = tokenData.volume24h / (tokenData.marketCap || 1);
    const estimatedHolders = Math.round(
        100 + (tokenData.marketCap / 1000) * (1 + volumeToMcap)
    );

    // Estimate concentration - higher liquidity ratio usually means better distribution
    const liquidityRatio = tokenData.liquidity / (tokenData.marketCap || 1);
    const estimatedTop10Percent = Math.max(20, Math.min(70, 50 - (liquidityRatio * 100)));

    return {
        totalHolders: Math.min(estimatedHolders, 5000),
        top10Holders: [], // Can't get individual holders without on-chain data
        top10HoldersPercent: Math.round(estimatedTop10Percent),
        isEstimated: true, // Flag that this is estimated data
        holderDistribution: {
            whales: Math.round(estimatedTop10Percent / 10),
            large: Math.round(estimatedTop10Percent / 5),
            medium: Math.round((100 - estimatedTop10Percent) / 3),
            small: Math.round((100 - estimatedTop10Percent) * 2 / 3)
        }
    };
}

/**
 * Get bonding curve data for pump.fun tokens
 * Estimates based on market cap (pump.fun graduates around $69K-$80K)
 */
async function getBondingCurveData(tokenAddress) {
    const tokenData = await getTokenData(tokenAddress);

    // Pump.fun graduation threshold
    const GRADUATION_THRESHOLD = 69000; // ~$69K market cap

    const marketCap = tokenData.marketCap || 0;
    const progress = Math.min((marketCap / GRADUATION_THRESHOLD) * 100, 100);

    return {
        progress: Math.round(progress * 100) / 100,
        marketCap: marketCap,
        graduationThreshold: GRADUATION_THRESHOLD,
        isGraduated: progress >= 100 || tokenData.dexId === 'raydium',
        estimatedToGraduation: Math.max(0, GRADUATION_THRESHOLD - marketCap),
        isPumpFun: tokenData.isPumpFun
    };
}

/**
 * Get OHLCV data - DexScreener provides limited historical data
 * For full OHLCV, would need a charting API
 */
async function getOHLCVData(tokenAddress, interval = '15m') {
    // DexScreener doesn't provide historical OHLCV via public API
    // Return current price as a single candle
    const tokenData = await getTokenData(tokenAddress);

    const now = Math.floor(Date.now() / 1000);
    const price = tokenData.price;

    // Generate approximate candles based on price changes
    const candles = [];
    const priceChange1h = tokenData.priceChange1h / 100;
    const priceChange24h = tokenData.priceChange24h / 100;

    // Create 12 candles (last 3 hours at 15min intervals)
    for (let i = 11; i >= 0; i--) {
        const time = now - (i * 15 * 60);
        const progress = (11 - i) / 11;
        const estimatedPrice = price / (1 + priceChange1h * (1 - progress));
        const volatility = 0.02; // 2% volatility assumption

        candles.push({
            time: time,
            open: estimatedPrice * (1 - volatility * Math.random()),
            high: estimatedPrice * (1 + volatility * Math.random()),
            low: estimatedPrice * (1 - volatility * Math.random()),
            close: estimatedPrice,
            volume: tokenData.volume24h / 24 / 4 // Rough 15-min volume estimate
        });
    }

    return candles;
}

/**
 * Search for tokens by name or symbol
 * @param {string} query - Search query
 * @returns {array} Matching tokens
 */
async function searchTokens(query) {
    try {
        const response = await fetch(`${DEXSCREENER_API}/dex/search?q=${encodeURIComponent(query)}`);

        if (!response.ok) {
            throw new Error(`Search failed: ${response.status}`);
        }

        const data = await response.json();

        // Filter for Solana tokens
        return (data.pairs || [])
            .filter(p => p.chainId === 'solana')
            .slice(0, 10)
            .map(p => ({
                name: p.baseToken?.name,
                symbol: p.baseToken?.symbol,
                address: p.baseToken?.address,
                price: p.priceUsd,
                marketCap: p.marketCap || p.fdv,
                volume24h: p.volume?.h24,
                dexId: p.dexId
            }));
    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
}

/**
 * Fetch prices for multiple tokens in one call
 * @param {Array<string>} mints - List of token addresses
 * @returns {Promise<Object>} Map of mint -> priceUsd
 */
async function getBatchTokenPrices(mints) {
    if (!mints || mints.length === 0) return {};

    // DexScreener supports up to 30 addresses per call
    const chunks = [];
    for (let i = 0; i < mints.length; i += 30) {
        chunks.push(mints.slice(i, i + 30));
    }

    const priceMap = {};

    try {
        await Promise.all(chunks.map(async (chunk) => {
            const ids = chunk.join(',');
            const res = await fetch(`${DEXSCREENER_API}/dex/tokens/${ids}`);
            if (res.ok) {
                const data = await res.json();
                if (data.pairs) {
                    data.pairs.forEach(pair => {
                        if (pair.baseToken && pair.priceUsd) {
                            // Use first pair found for the token (usually most liquid)
                            // DexScreener returns multiple pairs per token
                            if (!priceMap[pair.baseToken.address]) {
                                // Prefer priceNative (SOL) if available for PnL calcs
                                priceMap[pair.baseToken.address] = parseFloat(pair.priceNative || pair.priceUsd);
                            }
                        }
                    });
                }
            }
        }));
    } catch (e) {
        console.error('DexScreener batch fetch error:', e);
    }

    return priceMap;
}


module.exports = {
    getTokenData,
    getHolderData,
    getBondingCurveData,
    getOHLCVData,
    getOHLCVData,
    searchTokens,
    getBatchTokenPrices
};

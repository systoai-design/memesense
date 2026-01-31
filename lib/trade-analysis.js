import { getHistoricalSolPrice } from './price-history.js';

/**
 * Calculate Wallet Metrics from raw trade history
 * @param {Array} trades - List of trades [{ type: 'BUY'|'SELL', mint, solAmount, tokenAmount, timestamp }]
 * @param {Object} priceMap - Current prices for open positions
 * @param {Number} solPrice - Current SOL price
 * @param {Number} minTimestamp - Output filtering timestamp (default 0 for all-time)
 */
export function calculateWalletMetrics(trades, priceMap = {}, solPrice = 150, minTimestamp = 0) {
    if (!trades || trades.length === 0) {
        return {
            totalRealizedPnL: 0,
            totalRealizedPnLUSD: 0,
            winRate: 0,
            winLossRatio: 0,
            profitFactor: 0,
            avgHoldTime: 0,
            totalTrades: 0
        };
    }

    const tokenStats = {};

    // 1. Group by Token & Accumulate USD
    const IGNORED_MINTS = [
        'So11111111111111111111111111111111111111112', // WSOL
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
        'USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB', // USD1 (World Liberty Financial)
        'CAMC1a96eF1d6kZ5A7zZ5dDd1a3c5a6d5c6d5c6d5c6', // Typical Scam/Spam tokens (example)
    ];

    for (const trade of trades) {
        if (IGNORED_MINTS.includes(trade.mint)) continue;

        if (!tokenStats[trade.mint]) {
            tokenStats[trade.mint] = {
                mint: trade.mint,
                totalBuySol: 0,
                totalSellSol: 0,
                totalBuyUsd: 0,
                totalSellUsd: 0,
                totalBuyTokens: 0,
                totalSellTokens: 0,
                firstBuyTime: null,
                lastSellTime: null,
                lastActiveTime: 0, // NEW: For filtering "active in window"
                trades: []
            };
        }

        const stats = tokenStats[trade.mint];
        stats.trades.push(trade);

        // Update Last Active
        if (trade.timestamp > stats.lastActiveTime) {
            stats.lastActiveTime = trade.timestamp;
        }

        // Get Historical Price
        let histPrice = getHistoricalSolPrice(trade.timestamp);
        if (!histPrice) histPrice = solPrice;

        if (trade.type === 'BUY') {
            stats.totalBuySol += trade.solAmount;
            stats.totalBuyUsd += (trade.solAmount * histPrice);
            stats.totalBuyTokens += trade.tokenAmount;
            if (!stats.firstBuyTime || trade.timestamp < stats.firstBuyTime) {
                stats.firstBuyTime = trade.timestamp;
            }
        } else if (trade.type === 'SELL') {
            stats.totalSellSol += trade.solAmount;
            stats.totalSellUsd += (trade.solAmount * histPrice);
            stats.totalSellTokens += trade.tokenAmount;
            if (!stats.lastSellTime || trade.timestamp > stats.lastSellTime) {
                stats.lastSellTime = trade.timestamp;
            }
        }
    }

    // 2. Analyze All Positions (Calculate foundational PnL/Status for EVERYTHING)
    // We need this even for old trades to establish properly which tokens are filtered later

    const allPositions = [];

    Object.values(tokenStats).forEach(stats => {
        const bought = stats.totalBuyTokens;
        const sold = stats.totalSellTokens;
        const remaining = bought - sold;

        // Lookup Price Early for Status Check
        let tokenPrice = 0;
        let pairCreated = null;
        if (priceMap[stats.mint]) {
            const pm = priceMap[stats.mint];
            if (typeof pm === 'object') {
                pairCreated = pm.pairCreatedAt;
                tokenPrice = (pm.currency === 'USD' && solPrice > 0) ? pm.price / solPrice : pm.price;
            } else {
                tokenPrice = pm; // Assumed SOL price if number
            }
        }

        // Determine Status (Strict Dust Check)
        let status = 'OPEN';
        let isClosed = false;
        let isOrphan = false;

        const remainingValueUSD = remaining * tokenPrice * solPrice;
        const DUST_THRESHOLD_USD = 1.00; // Treat < $1 as closed

        if (bought === 0 && sold > 0) {
            status = 'ORPHAN';
            isClosed = false;
            isOrphan = true;
        } else if (remaining <= 0.000001 || (remainingValueUSD < DUST_THRESHOLD_USD && (remaining / bought) < 0.05)) {
            // Closed if effectively 0 OR value is dust (<$1) AND <5% of position left
            status = 'CLOSED';
            isClosed = true;
        }

        // Cashflow PnL
        const cashflowPnL = stats.totalSellSol - stats.totalBuySol;
        const cashflowPnLUSD = stats.totalSellUsd - stats.totalBuyUsd;

        // Duration
        let duration = 0;
        if (stats.firstBuyTime && stats.lastSellTime) {
            duration = stats.lastSellTime - stats.firstBuyTime;
        }

        const buyCount = stats.trades.filter(t => t.type === 'BUY').length;
        const sellCount = stats.trades.filter(t => t.type === 'SELL').length;
        const avgBuySize = buyCount > 0 ? stats.totalBuySol / buyCount : 0;

        // --- PnL Calculation for List Display ---
        // Realized Portion
        let realizedPnL = 0;
        let realizedPnLUSD = 0;

        if (sold > 0) {
            const avgBuyPrice = bought > 0 ? stats.totalBuySol / bought : 0;
            const avgBuyPriceUSD = bought > 0 ? stats.totalBuyUsd / bought : 0;

            realizedPnL = stats.totalSellSol - (avgBuyPrice * sold);
            realizedPnLUSD = stats.totalSellUsd - (avgBuyPriceUSD * sold);
        }

        // Unrealized Portion
        let unrealizedPnL = 0;
        let unrealizedPnLUSD = 0;
        let currentValue = 0;

        if (remaining > 0 && !isClosed) {
            // Only calc unrealized if NOT closed (dust is ignored for PnL)
            currentValue = remaining * tokenPrice;
            const avgCost = bought > 0 ? stats.totalBuySol / bought : 0;
            const avgCostUsd = bought > 0 ? stats.totalBuyUsd / bought : 0;

            unrealizedPnL = currentValue - (avgCost * remaining);
            unrealizedPnLUSD = (currentValue * solPrice) - (avgCostUsd * remaining);
        }

        // Sniper Check
        let isSniperTrade = false;
        if (pairCreated && stats.firstBuyTime) {
            const timeDiff = stats.firstBuyTime - pairCreated;
            if (timeDiff < 900000) isSniperTrade = true;
        }

        const displayPnL = isOrphan ? 0 : (isClosed ? cashflowPnL : (unrealizedPnL !== 0 ? unrealizedPnL : cashflowPnL));
        const displayPnLUSD = isOrphan ? 0 : (isClosed ? cashflowPnLUSD : (unrealizedPnLUSD !== 0 ? unrealizedPnLUSD : cashflowPnLUSD));

        allPositions.push({
            mint: stats.mint,
            status,
            isOrphan,
            pnl: displayPnL,
            pnlUsd: displayPnLUSD,
            realizedPnL,
            realizedPnLUSD,
            unrealizedPnL: isClosed ? 0 : unrealizedPnL,
            unrealizedPnLUSD: isClosed ? 0 : unrealizedPnLUSD,
            roi: stats.totalBuySol > 0 ? (displayPnL / stats.totalBuySol) * 100 : 0,
            duration,
            buySol: stats.totalBuySol,
            sellSol: stats.totalSellSol,
            buyCount,
            sellCount,
            buyUsd: stats.totalBuyUsd,
            sellUsd: stats.totalSellUsd,
            avgBuySize,
            txCount: stats.trades.length,
            remainingTokens: remaining,
            isSniper: isSniperTrade,
            lastActive: stats.lastActiveTime // Important for filtering
        });
    });

    // Sort by PnL desc
    allPositions.sort((a, b) => b.pnl - a.pnl);

    // --- 3. FILTER & AGGREGATE FOR WINDOW ---
    // If minTimestamp > 0, we only sum up activity that happened in this window.

    // A. Daily Stats (PnL & Volume) - Iterate properly over window
    const dailyStats = {};
    const filteredTrades = trades.filter(t => t.timestamp >= minTimestamp);

    // Prepare Cost Basis Map for Realized PnL calc
    const avgCostMap = {};
    Object.values(tokenStats).forEach(s => {
        avgCostMap[s.mint] = {
            avgBuyPrice: s.totalBuyTokens > 0 ? s.totalBuySol / s.totalBuyTokens : 0,
            avgBuyPriceUSD: s.totalBuyTokens > 0 ? s.totalBuyUsd / s.totalBuyTokens : 0
        };
    });

    // Aggregate Filtered Trades
    let windowRealizedPnL = 0;
    let windowRealizedPnLUSD = 0;

    // Position-Based Stats (for Win Rate parity with GMGN)
    // Map: Mint -> Net Realized PnL in Window
    const tokenWindowStats = {};

    // ... (rest of vars)
    let windowGrossProfit = 0;
    let windowGrossProfitUSD = 0; // RESTORED
    let windowGrossLoss = 0;
    let windowGrossLossUSD = 0; // RESTORED
    let windowWinCount = 0; // Keeping for Trade Stats if needed, but primary is Position
    let windowLossCount = 0;
    let windowTotalVolume = 0;
    let windowTotalVolumeUSD = 0;
    let windowBuyVolUSD = 0;
    let windowSellVolUSD = 0;

    filteredTrades.forEach(t => {
        const date = new Date(t.timestamp).toISOString().split('T')[0];
        if (!dailyStats[date]) dailyStats[date] = { pnl: 0, pnlUSD: 0, wins: 0, losses: 0, trades: 0, volume: 0 };

        // Initialize Token Stat
        if (!tokenWindowStats[t.mint]) tokenWindowStats[t.mint] = 0;

        let histPrice = getHistoricalSolPrice(t.timestamp);
        if (!histPrice) histPrice = solPrice; // Fallback to Live Price

        const tradeValUSD = t.solAmount * histPrice;

        dailyStats[date].trades += 1;
        dailyStats[date].volume += t.solAmount;
        windowTotalVolume += t.solAmount;
        windowTotalVolumeUSD += tradeValUSD;

        if (t.type === 'BUY') {
            windowBuyVolUSD += tradeValUSD;
        } else if (t.type === 'SELL') {
            windowSellVolUSD += tradeValUSD;

            // CHECK FOR ORPHAN (No Buy History OR No Cost Basis)
            const s = tokenStats[t.mint];
            if (!s || s.totalBuyTokens === 0 || s.totalBuySol === 0) {
                // Orphan Sell - Skip PnL aggregation to prevent inflated "Cost Basis 0" profit
                // But still count as volume
                return;
            }

            // Calculate Realized PnL for this specific trade
            const cost = avgCostMap[t.mint] || { avgBuyPrice: 0, avgBuyPriceUSD: 0 };
            const tradePnL = t.solAmount - (cost.avgBuyPrice * t.tokenAmount);
            const tradePnLUSD = tradeValUSD - (cost.avgBuyPriceUSD * t.tokenAmount);

            dailyStats[date].pnl += tradePnL;
            dailyStats[date].pnlUSD += tradePnLUSD;

            // Accumulate for Position WinRate
            tokenWindowStats[t.mint] += tradePnL;

            windowRealizedPnL += tradePnL;
            windowRealizedPnLUSD += tradePnLUSD;

            if (tradePnL > 0) {
                dailyStats[date].wins++;
                windowWinCount++;
                windowGrossProfit += tradePnL; // Approx summation
                windowGrossProfitUSD += tradePnLUSD;
            } else {
                dailyStats[date].losses++;
                windowLossCount++;
                windowGrossLoss += Math.abs(tradePnL);
                windowGrossLossUSD += Math.abs(tradePnLUSD);
            }
        }
    });

    // B. Filtered Details List
    const filteredDetails = minTimestamp === 0
        ? allPositions
        : allPositions.filter(p => p.lastActive >= minTimestamp);

    const totalPositions = filteredDetails.length;

    // Calculate Position-Based Win Rate
    let posWins = 0;
    let posLosses = 0;
    Object.values(tokenWindowStats).forEach(pnl => {
        if (pnl > 0) posWins++;
        else if (pnl < 0) posLosses++;
    });

    // Avg Metrics
    const avgRealizedProfit = windowWinCount > 0 ? (windowGrossProfit / windowWinCount) : 0;
    const avgWinSizeUSD = windowWinCount > 0 ? windowGrossProfitUSD / windowWinCount : 0;

    return {
        // SOL
        totalRealizedPnL: windowRealizedPnL,
        totalUnrealizedPnL: filteredDetails.reduce((acc, p) => acc + p.unrealizedPnL, 0),
        grossProfit: windowGrossProfit,
        grossLoss: windowGrossLoss,

        // USD
        totalRealizedPnLUSD: windowRealizedPnLUSD,
        totalUnrealizedPnLUSD: filteredDetails.reduce((acc, p) => acc + p.unrealizedPnLUSD, 0),

        // Stats: USE POSITION BASED WIN RATE
        winRate: (posWins + posLosses) > 0 ? (posWins / (posWins + posLosses) * 100) : 0,
        totalTrades: filteredTrades.length,
        totalVolume: windowTotalVolume,
        totalVolumeUSD: windowTotalVolumeUSD,

        // Averages
        avgBuySizeUSD: totalPositions > 0 ? windowBuyVolUSD / totalPositions : 0,
        avgSellSizeUSD: totalPositions > 0 ? windowSellVolUSD / totalPositions : 0,
        avgWinSizeUSD,

        avgHoldTime: 0,

        // List
        details: filteredDetails,
        calendar: dailyStats,

        // MC Distribution (Implied 1B Supply) - Filtered to window buys
        mcDistribution: (() => {
            const dist = { '0-100k': 0, '100k-500k': 0, '>500k': 0 };
            Object.values(tokenStats).forEach(s => {
                const boughtInWindow = s.trades.some(t => t.type === 'BUY' && t.timestamp >= minTimestamp);
                if (boughtInWindow && s.totalBuyTokens > 0) {
                    const avgPrice = s.totalBuyUsd / s.totalBuyTokens;
                    const implMC = avgPrice * 1_000_000_000;
                    if (implMC < 100000) dist['0-100k']++;
                    else if (implMC < 500000) dist['100k-500k']++;
                    else dist['>500k']++;
                }
            });
            return dist;
        })(),

        phishing: { blacklist: 'Clean', soldMoreThanBought: 0, fastTransactions: 0 }
    };
}

export function analyzeTimeWindows(trades, priceMap = {}, solPrice = 150) {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const sevenDays = 7 * oneDay;
    const fourteenDays = 14 * oneDay;
    const thirtyDays = 30 * oneDay;

    // Pass minTimestamp to filter properly while preserving cost basis
    return {
        '1d': calculateWalletMetrics(trades, priceMap, solPrice, now - oneDay),
        '7d': calculateWalletMetrics(trades, priceMap, solPrice, now - sevenDays),
        '14d': calculateWalletMetrics(trades, priceMap, solPrice, now - fourteenDays),
        '30d': calculateWalletMetrics(trades, priceMap, solPrice, now - thirtyDays),
        'all': calculateWalletMetrics(trades, priceMap, solPrice, 0)
    };
}

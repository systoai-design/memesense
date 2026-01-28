import { getHistoricalSolPrice } from './price-history';

/**
 * Calculate Wallet Metrics from raw trade history
 * @param {Array} trades - List of trades [{ type: 'BUY'|'SELL', mint, solAmount, tokenAmount, timestamp }]
 */
export function calculateWalletMetrics(trades, priceMap = {}, solPrice = 150) {
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
    for (const trade of trades) {
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
                trades: []
            };
        }

        const stats = tokenStats[trade.mint];
        stats.trades.push(trade);

        // Get Historical Price
        const histPrice = getHistoricalSolPrice(trade.timestamp);

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

    // 2. Analyze All Positions
    let totalRealizedPnL = 0;
    let totalRealizedPnLUSD = 0;
    let grossProfit = 0;
    let grossProfitUSD = 0;
    let grossLoss = 0;
    let grossLossUSD = 0;

    let winCount = 0;
    let lossCount = 0;

    let totalDuration = 0;
    let validClosedCount = 0;

    const allPositions = [];

    Object.values(tokenStats).forEach(stats => {
        const bought = stats.totalBuyTokens;
        const sold = stats.totalSellTokens;
        const remaining = bought - sold;

        // Determine Status
        let status = 'OPEN';
        let isClosed = false;
        let isOrphan = false;

        // Simple closure check: < 2% remaining or sold more than bought
        if (bought > 0 && (remaining / bought) < 0.02) {
            status = 'CLOSED';
            isClosed = true;
        } else if (bought === 0 && sold > 0) {
            status = 'ORPHAN';
            isClosed = false;
            isOrphan = true;
        }

        // Cashflow PnL (SOL)
        const cashflowPnL = stats.totalSellSol - stats.totalBuySol;
        // Realized PnL (USD)
        const cashflowPnLUSD = stats.totalSellUsd - stats.totalBuyUsd;

        // Duration
        let duration = 0;
        if (stats.firstBuyTime && stats.lastSellTime) {
            duration = stats.lastSellTime - stats.firstBuyTime;
        }

        const buyCount = stats.trades.filter(t => t.type === 'BUY').length;
        const sellCount = stats.trades.filter(t => t.type === 'SELL').length;
        const avgBuySize = buyCount > 0 ? stats.totalBuySol / buyCount : 0;

        // --- Metrics Logic ---

        // 1. Unrealized PnL
        let unrealizedPnL = 0;
        let unrealizedPnLUSD = 0;
        let currentValue = 0;
        let currentValueUSD = 0;

        // Handle Price Map
        let tokenPrice = 0;
        let pairCreated = null;

        if (priceMap[stats.mint]) {
            const pm = priceMap[stats.mint];
            if (typeof pm === 'object') {
                pairCreated = pm.pairCreatedAt;
                if (pm.currency === 'USD' && solPrice > 0) {
                    tokenPrice = pm.price / solPrice;
                } else {
                    tokenPrice = pm.price;
                }
            } else {
                tokenPrice = pm;
            }
        }

        if (tokenPrice > 0 && remaining > 0) {
            currentValue = remaining * tokenPrice;
            currentValueUSD = currentValue * solPrice; // Current Value is always Current Price

            const avgCost = bought > 0 ? stats.totalBuySol / bought : 0;
            const costBasisRemaining = avgCost * remaining;

            // USD Cost Basis (Historical Avg)
            const avgCostUsd = bought > 0 ? stats.totalBuyUsd / bought : 0;
            const costBasisRemainingUsd = avgCostUsd * remaining;

            unrealizedPnL = currentValue - costBasisRemaining;
            unrealizedPnLUSD = currentValueUSD - costBasisRemainingUsd;
        }

        // Sniper Check
        let isSniperTrade = false;
        if (pairCreated && stats.firstBuyTime) {
            const timeDiff = stats.firstBuyTime - pairCreated;
            if (timeDiff < 900000) isSniperTrade = true;
        }

        // 2. Aggregate Stats
        if (isClosed) {
            totalRealizedPnL += cashflowPnL;
            totalRealizedPnLUSD += cashflowPnLUSD;

            if (cashflowPnL > 0) {
                winCount++;
                grossProfit += cashflowPnL;
                grossProfitUSD += cashflowPnLUSD;
            } else {
                lossCount++;
                grossLoss += Math.abs(cashflowPnL);
                grossLossUSD += Math.abs(cashflowPnLUSD);
            }

            if (duration > 0) {
                totalDuration += duration;
                validClosedCount++;
            }
        }

        // Push Detail (Unified)
        const displayPnL = isOrphan ? 0 : (isClosed ? cashflowPnL : (unrealizedPnL !== 0 ? unrealizedPnL : cashflowPnL));
        const displayPnLUSD = isOrphan ? 0 : (isClosed ? cashflowPnLUSD : (unrealizedPnLUSD !== 0 ? unrealizedPnLUSD : cashflowPnLUSD));

        allPositions.push({
            mint: stats.mint,
            status,
            isOrphan,
            pnl: displayPnL,
            pnlUsd: displayPnLUSD,
            realizedPnL: isClosed && !isOrphan ? cashflowPnL : 0,
            unrealizedPnL: isClosed ? 0 : unrealizedPnL,
            roi: stats.totalBuySol > 0 ? (cashflowPnL / stats.totalBuySol) * 100 : (isOrphan ? null : 0),
            duration,
            buySol: stats.totalBuySol,
            sellSol: stats.totalSellSol,
            buyCount,
            sellCount,
            avgBuySize,
            txCount: stats.trades.length,
            remainingTokens: remaining,
            isSniper: isSniperTrade
        });
    });

    // Sort by PnL desc
    allPositions.sort((a, b) => b.pnl - a.pnl);

    // --- 3. Final Metrics Calculation ---

    // A. Time & Duration Metrics
    const closedWithDuration = allPositions.filter(p => p.status === 'CLOSED' && p.duration > 0);
    const avgHoldTime = closedWithDuration.length > 0
        ? closedWithDuration.reduce((acc, p) => acc + p.duration, 0) / closedWithDuration.length
        : 0;
    const validDurations = closedWithDuration.map(p => p.duration);
    const fastestFlip = validDurations.length > 0 ? Math.min(...validDurations) : 0;
    const longestHold = validDurations.length > 0 ? Math.max(...validDurations) : 0;


    // B. Gains & Profitability
    const allWins = allPositions.filter(p => p.pnl > 0);
    const allLosses = allPositions.filter(p => p.pnl <= 0);

    const winCountNew = allWins.length;
    const lossCountNew = allLosses.length;
    const totalPositions = allPositions.length;

    const winRate = totalPositions > 0 ? (winCountNew / totalPositions) * 100 : 0;
    const lossRate = totalPositions > 0 ? (lossCountNew / totalPositions) * 100 : 0;

    const avgWinPercent = allWins.length > 0
        ? allWins.reduce((acc, p) => acc + p.roi, 0) / allWins.length
        : 0;

    const avgLossPercent = allLosses.length > 0
        ? allLosses.reduce((acc, p) => acc + p.roi, 0) / allLosses.length
        : 0;

    const bestTradeRoi = allWins.length > 0 ? Math.max(...allWins.map(p => p.roi)) : 0;
    const smallestWinRoi = allWins.length > 0 ? Math.min(...allWins.map(p => p.roi)) : 0;

    let safeCopyMargin = 0;
    if (allWins.length > 0) {
        const sortedRois = allWins.map(p => p.roi).sort((a, b) => a - b);
        const mid = Math.floor(sortedRois.length / 2);
        safeCopyMargin = sortedRois.length % 2 !== 0
            ? sortedRois[mid]
            : (sortedRois[mid - 1] + sortedRois[mid]) / 2;
    }

    // Avg PnL per Trade
    const totalUnrealizedPnL = allPositions.reduce((acc, p) => acc + (p.unrealizedPnL || 0), 0);
    const totalUnrealizedPnLUSD = allPositions.reduce((acc, p) => acc + (p.unrealizedPnLUSD || 0), 0);

    const totalNetPnL = totalRealizedPnL + totalUnrealizedPnL;
    const totalNetPnLUSD = totalRealizedPnLUSD + totalUnrealizedPnLUSD;

    const avgPnL = totalPositions > 0 ? totalNetPnL / totalPositions : 0;
    const avgPnLUSD = totalPositions > 0 ? totalNetPnLUSD / totalPositions : 0;


    // C. Volume & Activity Metrics
    const totalVolume = Object.values(tokenStats).reduce((acc, s) => acc + s.totalBuySol + s.totalSellSol, 0);
    const tokensTraded = Object.keys(tokenStats).length;

    const winLossRatio = lossCountNew > 0 ? winCountNew / lossCountNew : (winCountNew > 0 ? 999 : 0);
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0);

    const positionsWithBuys = allPositions.filter(p => p.buySol > 0);
    const avgSingleBuy = positionsWithBuys.length > 0
        ? positionsWithBuys.reduce((acc, p) => acc + p.avgBuySize, 0) / positionsWithBuys.length
        : 0;

    // Copy Trading Metrics
    let consistencyRating = 0;
    if (trades.length > 10) consistencyRating = winRate;
    else if (trades.length > 0) consistencyRating = winRate * 0.5;

    let diamondHandRating = 0;
    const holdMins = avgHoldTime / 60000;
    if (holdMins > 1440) diamondHandRating = 100;
    else if (holdMins > 60) diamondHandRating = 75 + ((holdMins - 60) / 1380) * 25;
    else diamondHandRating = (holdMins / 60) * 75;

    let sniperEfficiency = null;
    const sniperCount = allPositions.filter(p => p.isSniper).length;
    if (totalPositions > 0) {
        sniperEfficiency = Math.round((sniperCount / totalPositions) * 100);
    }

    return {
        // SOL Metrics
        totalRealizedPnL,
        grossProfit,
        grossLoss,
        avgPnL,

        // USD Metrics
        totalRealizedPnLUSD,
        grossProfitUSD,
        grossLossUSD,
        avgPnLUSD,

        // Common
        winRate,
        winLossRatio,
        profitFactor,
        avgHoldTime,
        avgSingleBuy,
        totalTrades: trades.length,
        closedPositionsCount: validClosedCount,
        openPositionsCount: allPositions.length - validClosedCount,
        details: allPositions,

        fastestFlip,
        longestHold,
        avgWinPercent,
        avgLossPercent,
        bestTradeRoi,
        smallestWinRoi,
        safeCopyMargin,
        totalVolume,
        tokensTraded,
        winCount: winCountNew,
        lossCount: lossCountNew,
        lossRate,
        consistencyRating,
        diamondHandRating,
        sniperEfficiency
    };
}

/**
 * Analyze trades across multiple time windows
 * @param {Array} trades 
 */
export function analyzeTimeWindows(trades, priceMap = {}, solPrice = 150) {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const sevenDays = 7 * oneDay;
    const fourteenDays = 14 * oneDay;
    const thirtyDays = 30 * oneDay; // Approximate

    const trades1d = trades.filter(t => t.timestamp > (now - oneDay));
    const trades7d = trades.filter(t => t.timestamp > (now - sevenDays));
    const trades14d = trades.filter(t => t.timestamp > (now - fourteenDays));
    const trades30d = trades.filter(t => t.timestamp > (now - thirtyDays));

    return {
        '1d': calculateWalletMetrics(trades1d, priceMap, solPrice),
        '7d': calculateWalletMetrics(trades7d, priceMap, solPrice),
        '14d': calculateWalletMetrics(trades14d, priceMap, solPrice),
        '30d': calculateWalletMetrics(trades30d, priceMap, solPrice),
        'all': calculateWalletMetrics(trades, priceMap, solPrice)
    };
}

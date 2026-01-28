/**
 * Calculate Wallet Metrics from raw trade history
 * @param {Array} trades - List of trades [{ type: 'BUY'|'SELL', mint, solAmount, tokenAmount, timestamp }]
 */
export function calculateWalletMetrics(trades, priceMap = {}, solPrice = 150) {
    if (!trades || trades.length === 0) {
        return {
            totalRealizedPnL: 0,
            winRate: 0,
            winLossRatio: 0,
            profitFactor: 0,
            avgHoldTime: 0,
            totalTrades: 0
        };
    }

    const tokenStats = {};

    // 1. Group by Token
    for (const trade of trades) {
        if (!tokenStats[trade.mint]) {
            tokenStats[trade.mint] = {
                mint: trade.mint,
                totalBuySol: 0,
                totalSellSol: 0,
                totalBuyTokens: 0,
                totalSellTokens: 0,
                firstBuyTime: null,
                lastSellTime: null,
                trades: []
            };
        }

        const stats = tokenStats[trade.mint];
        stats.trades.push(trade);

        if (trade.type === 'BUY') {
            stats.totalBuySol += trade.solAmount;
            stats.totalBuyTokens += trade.tokenAmount;
            if (!stats.firstBuyTime || trade.timestamp < stats.firstBuyTime) {
                stats.firstBuyTime = trade.timestamp;
            }
        } else if (trade.type === 'SELL') {
            stats.totalSellSol += trade.solAmount;
            stats.totalSellTokens += trade.tokenAmount;
            if (!stats.lastSellTime || trade.timestamp > stats.lastSellTime) {
                stats.lastSellTime = trade.timestamp;
            }
        }
    }

    // 2. Analyze All Positions
    let totalRealizedPnL = 0;
    let grossProfit = 0;
    let grossLoss = 0;

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

        // Simple closure check: < 2% remaining or sold more than bought (data error or very old buy)
        if (bought > 0 && (remaining / bought) < 0.02) {
            status = 'CLOSED';
            isClosed = true;
        } else if (bought === 0 && sold > 0) {
            // ORPHAN TRADE: Sold something we never saw a buy for (history cutoff or transfer in)
            // DO NOT count this in realized PnL - it would create phantom profits
            status = 'ORPHAN';
            isClosed = false; // Don't count in win/loss stats
            isOrphan = true;
        }

        // Cashflow PnL (Net SOL Change)
        // For CLOSED trades, this IS the Realized PnL.
        // For OPEN trades, this is negative (cost), but not a "Loss".
        const cashflowPnL = stats.totalSellSol - stats.totalBuySol;

        // Duration
        let duration = 0;
        if (stats.firstBuyTime && stats.lastSellTime) {
            duration = stats.lastSellTime - stats.firstBuyTime;
        }

        const buyCount = stats.trades.filter(t => t.type === 'BUY').length;
        const sellCount = stats.trades.filter(t => t.type === 'SELL').length;
        const avgBuySize = buyCount > 0 ? stats.totalBuySol / buyCount : 0;

        // --- Metrics Logic ---

        // 1. Unrealized PnL (if price available)
        let unrealizedPnL = 0;
        let currentValue = 0;

        // Handle Price Map (now supports Object { price, currency, pairCreatedAt })
        let tokenPrice = 0;
        let pairCreated = null;

        if (priceMap[stats.mint]) {
            const pm = priceMap[stats.mint];
            if (typeof pm === 'object') {
                pairCreated = pm.pairCreatedAt;
                // CONVERT USD TO SOL IF NEEDED
                if (pm.currency === 'USD' && solPrice > 0) {
                    tokenPrice = pm.price / solPrice;
                } else {
                    tokenPrice = pm.price;
                }
            } else {
                // Legacy fallback (assume SOL)
                tokenPrice = pm;
            }
        }

        if (tokenPrice > 0 && remaining > 0) {
            currentValue = remaining * tokenPrice;
            // Est cost basis for remaining? 
            // Simple: Unrealized = CurrentVal - (AvgCost * Remaining)
            // AvgCost = TotalBuySol / TotalBuyTokens
            const avgCost = bought > 0 ? stats.totalBuySol / bought : 0;
            const costBasisRemaining = avgCost * remaining;
            unrealizedPnL = currentValue - costBasisRemaining;
        }

        // Check for Sniper Entry (Bought within 15 mins of Pair Creation)
        let isSniperTrade = false;
        if (pairCreated && stats.firstBuyTime) {
            const timeDiff = stats.firstBuyTime - pairCreated;
            // Allow 15 minutes window (15 * 60 * 1000 = 900000)
            // But also sanity check: can't buy BEFORE creation (timeDiff < 0 usually means presale or clock skew, count as sniper)
            if (timeDiff < 900000) {
                isSniperTrade = true;
            }
        }

        // 2. Aggregate Stats
        if (isClosed) {
            totalRealizedPnL += cashflowPnL;

            if (cashflowPnL > 0) {
                winCount++;
                grossProfit += cashflowPnL;
            } else {
                lossCount++;
                grossLoss += Math.abs(cashflowPnL);
            }

            if (duration > 0) {
                totalDuration += duration;
                validClosedCount++;
            }
        }

        // Push Detail (Unified)
        // For orphans, set PnL to 0 since we don't know the cost basis
        const displayPnL = isOrphan ? 0 : (isClosed ? cashflowPnL : (unrealizedPnL !== 0 ? unrealizedPnL : cashflowPnL));

        allPositions.push({
            mint: stats.mint,
            status,
            isOrphan,
            pnl: displayPnL,
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
            isSniper: isSniperTrade // Add flag to details
        });
    });

    // Sort by PnL desc
    allPositions.sort((a, b) => b.pnl - a.pnl);

    // --- 3. Final Metrics Calculation ---

    // A. Time & Duration Metrics
    // User Request: "Fastest Flip formula is that the shortest time the trader has held the coin"
    // We use ALL closed trades with valid duration, removing the > 0.05 SOL filter to capture everything.
    const closedWithDuration = allPositions.filter(p => p.status === 'CLOSED' && p.duration > 0);

    // Avg Hold Time (ms)
    const avgHoldTime = closedWithDuration.length > 0
        ? closedWithDuration.reduce((acc, p) => acc + p.duration, 0) / closedWithDuration.length
        : 0;

    // Fastest Flip (ms)
    const validDurations = closedWithDuration.map(p => p.duration);
    const fastestFlip = validDurations.length > 0 ? Math.min(...validDurations) : 0;

    // Longest Hold (ms)
    const longestHold = validDurations.length > 0 ? Math.max(...validDurations) : 0;


    // B. Gains & Profitability
    // User Request: "wins / losses should be Positive PNLs vs Negative PNLs (realized and unrealized)"
    // So we use 'allPositions' (which has PnL = Realized or Unrealized/Cashflow)

    const allWins = allPositions.filter(p => p.pnl > 0);
    const allLosses = allPositions.filter(p => p.pnl <= 0); // Zero is usually neutral but treated as non-win

    const winCountNew = allWins.length; // Renamed to avoid conflict with loop-based winCount
    const lossCountNew = allLosses.length; // Renamed to avoid conflict with loop-based lossCount
    const totalPositions = allPositions.length; // Distinct tokens traded

    // Win Rate (Inclusive)
    const winRate = totalPositions > 0 ? (winCountNew / totalPositions) * 100 : 0;
    const lossRate = totalPositions > 0 ? (lossCountNew / totalPositions) * 100 : 0;

    // Avg Win % (ROI) - Only positives
    const avgWinPercent = allWins.length > 0
        ? allWins.reduce((acc, p) => acc + p.roi, 0) / allWins.length
        : 0;

    // Avg Loss % (ROI) - Only negatives
    const avgLossPercent = allLosses.length > 0
        ? allLosses.reduce((acc, p) => acc + p.roi, 0) / allLosses.length
        : 0;

    // Best Trade (Max ROI)
    const bestTradeRoi = allWins.length > 0
        ? Math.max(...allWins.map(p => p.roi))
        : 0;

    // Smallest Win (Min positive ROI)
    const smallestWinRoi = allWins.length > 0
        ? Math.min(...allWins.map(p => p.roi))
        : 0;

    // Safe Copy Margin (Median Win %)
    let safeCopyMargin = 0;
    if (allWins.length > 0) {
        // Sort ROIs ascending
        const sortedRois = allWins.map(p => p.roi).sort((a, b) => a - b);
        const mid = Math.floor(sortedRois.length / 2);

        safeCopyMargin = sortedRois.length % 2 !== 0
            ? sortedRois[mid] // Odd, middle element
            : (sortedRois[mid - 1] + sortedRois[mid]) / 2; // Even, avg of two middle
    }

    // Avg PnL per Trade (SOL)
    // Formula: (Total Realized + Total Unrealized) / Total Unique Positions
    // Note: totalRealizedPnL is strictly Closed. We need Total Net PnL (Realized + Unrealized).
    const totalUnrealizedPnL = allPositions.reduce((acc, p) => acc + (p.unrealizedPnL || 0), 0);
    const totalNetPnL = totalRealizedPnL + totalUnrealizedPnL;
    const avgPnL = totalPositions > 0 ? totalNetPnL / totalPositions : 0;


    // C. Volume & Activity Metrics
    // User Request: "Total Volume is computed as the total volume of buys and sells."
    // We sum stats for all tokens.
    const totalVolume = Object.values(tokenStats).reduce((acc, s) => acc + s.totalBuySol + s.totalSellSol, 0);

    // Tokens Traded (Total Buy) - Unique tokens
    const tokensTraded = Object.keys(tokenStats).length;

    // Win/Loss Ratio
    const winLossRatio = lossCountNew > 0 ? winCountNew / lossCountNew : (winCountNew > 0 ? 999 : 0);

    // Profit Factor (Inclusive of Unrealized? Usually realized only, but let's stick to standard or adjust if asked.
    // User didn't specify Profit Factor formula change, but standard is Realized. Let's keep it Realized for now unless requested.)
    // Update: User said "wins / losses should be Positive PNLs vs Negative PNLs (realized and unrealized)". 
    // This implies Profit Factor might also want inclusive? Let's stick to Standard (Gross Profit/Loss Realized) for P.F. to avoid confusion unless explicitly told.
    // Re-calculating Profit Factor based on Realized Only (safe bet).
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0);

    // Avg Buy Size (using all positions with buys)
    const positionsWithBuys = allPositions.filter(p => p.buySol > 0);
    const avgSingleBuy = positionsWithBuys.length > 0
        ? positionsWithBuys.reduce((acc, p) => acc + p.avgBuySize, 0) / positionsWithBuys.length
        : 0;

    // New Metrics for Copy Trading
    let consistencyRating = 0;
    if (trades.length > 10) consistencyRating = winRate;
    else if (trades.length > 0) consistencyRating = winRate * 0.5;

    let diamondHandRating = 0;
    const holdMins = avgHoldTime / 60000;
    if (holdMins > 1440) diamondHandRating = 100; // > 24h
    else if (holdMins > 60) diamondHandRating = 75 + ((holdMins - 60) / 1380) * 25; // 1h-24h
    else diamondHandRating = (holdMins / 60) * 75; // < 1h

    // Sniper Efficiency Calculation
    // % of Total Positions that were "Sniper Entries"
    let sniperEfficiency = null;
    const sniperCount = allPositions.filter(p => p.isSniper).length;

    // Only calculate if we have positions and reasonable data
    if (totalPositions > 0) {
        sniperEfficiency = Math.round((sniperCount / totalPositions) * 100);
    }

    return {
        // existing standard
        totalRealizedPnL,
        grossProfit,
        grossLoss,
        // updated inclusive metrics
        winRate,
        winLossRatio,
        profitFactor,
        avgHoldTime,
        avgSingleBuy,
        totalTrades: trades.length, // Raw transaction count
        closedPositionsCount: validClosedCount,
        openPositionsCount: allPositions.length - validClosedCount,
        details: allPositions,

        // new/refined metrics
        fastestFlip,
        longestHold,
        avgWinPercent,
        avgLossPercent,
        bestTradeRoi,
        smallestWinRoi,
        safeCopyMargin,
        avgPnL, // Now inclusive of Unrealized / Total Positions
        totalVolume,
        tokensTraded, // Unique tokens
        winCount: winCountNew, // Use the new inclusive win count
        lossCount: lossCountNew, // Use the new inclusive loss count
        lossRate,

        // Copy Trading Metrics
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

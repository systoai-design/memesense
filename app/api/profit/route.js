import { NextResponse } from 'next/server';
import { getOrCreateUser, canUseAnalysis, recordUsage, recordScan, getWalletLabel, getStoredTrades, getLatestTradeTimestamp, storeWalletTrades } from '@/lib/db';
import { getWalletHistory, getBatchTokenMetadata } from '@/lib/helius';
import { calculateWalletMetrics, analyzeTimeWindows } from '@/lib/trade-analysis';
import { getBatchTokenPrices, getTokenData } from '@/lib/dexscreener';

export async function POST(request) {
    try {
        const body = await request.json();
        const { walletToAnalyze, deviceId, userWallet } = body;

        console.log(`[ProfitAPI] Request: wallet=${walletToAnalyze}, user=${userWallet}`);

        // 1. Auth & Premium Check
        const user = await getOrCreateUser({ deviceId, walletAddress: userWallet });

        // Admin Bypass
        const ADMIN_WALLET = process.env.ADMIN_WALLET || '2unNnTnv5DcmtdQYAJuLzg4azHu67obGL9dX8PYwxUDQ';
        const isAdmin = userWallet === ADMIN_WALLET;

        // Check Usage Limits (always deep scan now)
        const usageCheck = await canUseAnalysis(user.id, 'deep');

        // Strict Block
        if (!isAdmin && deviceId !== 'demo-landing' && !usageCheck.allowed) {
            return NextResponse.json({
                success: false,
                error: usageCheck.reason,
                isPremiumLocked: true,
                debugInfo: { userId: user.id, tier: user.tier }
            }, { status: 403 });
        }

        if (!walletToAnalyze) {
            return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
        }

        // 2. PERMANENT STORAGE: Check DB first, then fetch only new trades
        console.log(`[ProfitAPI] Analyzing wallet: ${walletToAnalyze}`);
        let trades = [];
        let fetchedNewTrades = false;

        try {
            // Get stored trades from Turso
            const storedTrades = await getStoredTrades(walletToAnalyze);
            const latestTimestamp = await getLatestTradeTimestamp(walletToAnalyze);

            if (storedTrades.length > 0) {
                console.log(`[ProfitAPI] DB HIT: ${storedTrades.length} trades stored. Latest: ${new Date(latestTimestamp).toISOString()}`);
                trades = storedTrades;

                // Fetch only NEW trades since last stored
                try {
                    const newTrades = await getWalletHistory(walletToAnalyze, 1000, latestTimestamp);
                    if (newTrades && newTrades.length > 0) {
                        console.log(`[ProfitAPI] Found ${newTrades.length} new trades`);
                        // Store new trades
                        await storeWalletTrades(walletToAnalyze, newTrades);
                        // Combine: new trades first (most recent), then stored
                        trades = [...newTrades, ...storedTrades];
                        fetchedNewTrades = true;
                    }
                } catch (incrementalError) {
                    console.warn('[ProfitAPI] Incremental fetch failed, using stored data:', incrementalError.message);
                    // Continue with stored trades only
                }
            } else {
                // No stored trades - full fetch
                console.log(`[ProfitAPI] DB MISS: Fetching full history...`);
                const freshTrades = await getWalletHistory(walletToAnalyze, 1000);

                if (freshTrades && freshTrades.length > 0) {
                    trades = freshTrades;
                    // Store permanently
                    storeWalletTrades(walletToAnalyze, freshTrades).catch(e =>
                        console.warn('[ProfitAPI] Failed to store trades:', e.message)
                    );
                    fetchedNewTrades = true;
                }
            }
        } catch (fetchError) {
            console.error('[ProfitAPI] Trade fetch error:', fetchError.message);

            // SOFT ERROR FOR 429 - Tell user to wait
            if (fetchError.message.includes('429') || fetchError.message.includes('Rate Limit')) {
                return NextResponse.json({
                    success: false,
                    isLoading: true,
                    error: 'Analysis is still loading. Please wait a moment and try again.',
                    retryAfter: 5
                }, { status: 202 });
            }

            return NextResponse.json({
                success: false,
                error: `Helius API Error: ${fetchError.message}`,
                data: null
            }, { status: 500 });
        }

        // Record usage if we seemingly got data (or just record attempt?)
        // Usually record usage only if we return value.
        // We'll record at the end.

        // Fetch user's custom label for this wallet
        const userLabel = await getWalletLabel(user.id, walletToAnalyze).catch(() => null);

        // Fetch Balance (SOL)
        let balance = 0;
        try {
            // Extract Helius key or from env
            const apiKey = process.env.NEXT_PUBLIC_RPC_URL?.match(/api-key=([a-f0-9-]+)/i)?.[1];
            if (apiKey) {
                const balRes = await fetch(`https://api.helius.xyz/v0/addresses/${walletToAnalyze}/balances?api-key=${apiKey}`);
                const balJson = await balRes.json();
                if (balJson && balJson.nativeBalance) {
                    balance = balJson.nativeBalance / 1e9;
                }
            }
        } catch (e) {
            console.error('Info: Balance fetch failed', e.message);
        }

        if (trades.length === 0) {
            // CHECK IF IT'S A TOKEN (User scanned a mint address)
            try {
                const tokenData = await getTokenData(walletToAnalyze);
                if (tokenData && tokenData.price) {
                    return NextResponse.json({
                        success: false,
                        isToken: true,
                        redirect: `/analyze/${walletToAnalyze}`,
                        message: 'This is a token address. Redirecting to analysis...'
                    });
                }
            } catch (ignore) {
                // Not a token either
            }

            return NextResponse.json({
                success: true,
                data: null,
                message: 'No trading history found for this wallet.'
            });
        }

        // 3. Parallelize Data Fetching
        // Start Metadata Fetch (Async)
        const uniqueMints = [...new Set(trades.filter(t => t.mint).map(t => t.mint))];
        const metadataPromise = getBatchTokenMetadata(uniqueMints);

        // Start SOL Price Fetch (Async)
        const solPricePromise = (async () => {
            try {
                const wSOL = 'So11111111111111111111111111111111111111112';
                const data = await getTokenData(wSOL);
                return data.price || 0;
            } catch (e) { return 0; }
        })();

        // 3. Preliminary Analysis (Identifies Open Positions)
        const initialAnalysis = analyzeTimeWindows(trades);

        // 4. Fetch Prices for Open Positions
        // Extract all mints that have "OPEN" status in 'all' timeframe
        const openMints = initialAnalysis.all.details
            .filter(p => p.status === 'OPEN' && p.remainingTokens > 0)
            .map(p => p.mint);

        // Start Price Fetch (Async)
        const uniqueOpenMints = [...new Set(openMints)];
        const priceMapPromise = (async () => {
            if (uniqueOpenMints.length > 0) {
                return await getBatchTokenPrices(uniqueOpenMints.slice(0, 90));
            }
            return {};
        })();


        // 5. Await Critical Data for Final Analysis
        const [priceMap, solPrice] = await Promise.all([
            priceMapPromise,
            solPricePromise
        ]);

        // 5b. Re-Analyze with Prices
        const analysis = analyzeTimeWindows(trades, priceMap); // Make sure analyzeTimeWindows passes priceMap 

        // 7. Await Metadata (Non-blocking for analysis, but needed for response)
        const tokenMetadata = await metadataPromise;

        // 7. Inject USD Values & AI Verdict
        // tokenMetadata and userLabel already fetched above or managed sequentially

        const summary = analysis; // It's an object with keys 1d, 7d, etc.

        // GLOBAL AI VERDICT (Based on 'all' timeframe)
        const globalMetrics = summary['all'];
        let aiStatus = 'UNPROFITABLE';
        let aiScore = 50;

        if (globalMetrics.profitFactor >= 1.5 && globalMetrics.winRate > 40) {
            aiStatus = 'PROFITABLE';
            aiScore = 85 + Math.min(globalMetrics.profitFactor, 5); // Cap bonus
        } else if (globalMetrics.profitFactor >= 1.0) {
            aiStatus = 'PROFITABLE'; // Marginally
            aiScore = 65;
        } else {
            // Unprofitable
            // Check if "High Risk" (high volume/activity but losing)
            if (globalMetrics.totalTrades > 50) aiStatus = 'HIGH RISK';
            aiScore = 30;
        }

        // Generate AI Text Summary
        // REMOVED at user request to improve speed and avoid rate limits
        const aiSummary = null;

        const aiVerdict = {
            status: aiStatus,
            score: Math.min(Math.round(aiScore), 100),
            summary: aiSummary
        };

        // Add USD equivalents to each timeframe
        Object.keys(summary).forEach(key => {
            const metrics = summary[key];
            metrics.totalRealizedPnLUSD = metrics.totalRealizedPnL * solPrice;
            metrics.grossProfitUSD = metrics.grossProfit * solPrice;
            metrics.grossLossUSD = metrics.grossLoss * solPrice;
            metrics.avgPnLUSD = metrics.avgPnL * solPrice;
            metrics.totalVolumeUSD = metrics.totalVolume * solPrice;

            // Total Unrealized Sum
            const totalUnrealizedPnL = metrics.details.reduce((acc, p) => acc + (p.unrealizedPnL || 0), 0);
            metrics.totalUnrealizedPnL = totalUnrealizedPnL;
            metrics.totalUnrealizedPnLUSD = totalUnrealizedPnL * solPrice;
        });

        // Record Scan History
        if (!isAdmin && deviceId !== 'demo-landing') {
            const action = 'deep_analysis';
            // We await these to ensure consistency but run them in parallel
            await Promise.all([
                recordUsage(user.id, walletToAnalyze, action),
                recordScan(user.id, {
                    address: walletToAnalyze,
                    name: 'Wallet', // Default name, user can label it later
                    symbol: 'SOL',
                    imageUrl: null
                }, 'wallet')
            ]);
        }

        return NextResponse.json({
            success: true,
            data: {
                summary,
                tokenInfo: tokenMetadata,
                balance,
                solPrice,
                userLabel, // Custom label if exists
                aiVerdict,
                usage: {
                    remaining: usageCheck.remainingToday,
                    type: 'deep'
                }
            }
        });

    } catch (e) {
        console.error('Profit API Error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

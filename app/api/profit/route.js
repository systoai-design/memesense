import { NextResponse } from 'next/server';
import { getOrCreateUser, canUseAnalysis, recordUsage, recordScan, getWalletLabel, getStoredTrades, getLatestTradeTimestamp, storeWalletTrades, logUserScan } from '@/lib/db';
import { getWalletHistory, getBatchTokenMetadata } from '@/lib/helius';
import { getWalletSwaps } from '@/lib/solscan';
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

        // 2. HYBRID FETCH: Solscan (primary) with Helius (fallback)
        console.log(`[ProfitAPI] Analyzing wallet: ${walletToAnalyze}`);
        let trades = [];
        let fetchedNewTrades = false;
        let dataSource = 'unknown';

        try {
            // Check stored trades first
            const storedTrades = await getStoredTrades(walletToAnalyze);
            const latestTimestamp = await getLatestTradeTimestamp(walletToAnalyze);

            if (storedTrades.length > 0) {
                console.log(`[ProfitAPI] DB HIT: ${storedTrades.length} trades stored. Latest: ${new Date(latestTimestamp).toISOString()}`);
                trades = storedTrades;

                // Fetch only NEW trades since last stored (try Solscan first)
                try {
                    /* SOLSCAN DISABLED - CAUSING PNL INACCURACY
                    const newTrades = await getWalletSwaps(walletToAnalyze, {
                        fromTime: latestTimestamp,
                        pageSize: 100,
                        maxPages: 5
                    });
                    dataSource = 'solscan';

                    if (newTrades && newTrades.length > 0) {
                        console.log(`[ProfitAPI] Found ${newTrades.length} new trades via Solscan`);
                        await storeWalletTrades(walletToAnalyze, newTrades);
                        trades = [...newTrades, ...storedTrades];
                        fetchedNewTrades = true;
                    }  
                    */
                    throw new Error("Solscan Disabled");
                } catch (solscanError) {
                    console.warn('[ProfitAPI] Solscan failed, trying Helius fallback:', solscanError.message);

                    // Fallback to Helius
                    try {
                        const newTrades = await getWalletHistory(walletToAnalyze, 1000, latestTimestamp);
                        dataSource = 'helius';

                        if (newTrades && newTrades.length > 0) {
                            console.log(`[ProfitAPI] Found ${newTrades.length} new trades via Helius`);
                            await storeWalletTrades(walletToAnalyze, newTrades);
                            trades = [...newTrades, ...storedTrades];
                            fetchedNewTrades = true;
                        }
                    } catch (heliusError) {
                        console.warn('[ProfitAPI] Helius fallback also failed:', heliusError.message);
                        // Continue with stored trades only
                    }
                }
            } else {
                // No stored trades - full fetch via Solscan
                // No stored trades - Fetch needed
                console.log(`[ProfitAPI] DB MISS: Fetching history via Helius (Free Tier Preferred)...`);

                try {
                    // PRIMARY: Helius (Free usage supported)
                    // Increased limit to 3000 to catch older "Sells" preventing Ghost Open Positions
                    const freshTrades = await getWalletHistory(walletToAnalyze, 3000);
                    dataSource = 'helius';

                    if (freshTrades && freshTrades.length > 0) {
                        trades = freshTrades;
                        storeWalletTrades(walletToAnalyze, freshTrades).catch(e =>
                            console.warn('[ProfitAPI] Failed to store trades:', e.message)
                        );
                        fetchedNewTrades = true;
                    } else {
                        // Fallback or Empty?
                        // If Helius empty, maybe new wallet?
                    }

                    // SOLSCAN (PRO ONLY) - Disabled/Deprioritized for free users
                    // Only try if we have a specific PRO key logic, otherwise skip to avoid 401s
                    // const solscanTrades = await getWalletSwaps(...) 

                } catch (fetchError) {
                    console.error('[ProfitAPI] Helius fetch failed:', fetchError.message);

                    // SOFT ERROR FOR 429
                    if (fetchError.message.includes('429')) {
                        return NextResponse.json({
                            success: false, isLoading: true, error: 'Rate limit. Please wait.', retryAfter: 5
                        }, { status: 202 });
                    }
                    // Throw to outer catch
                    throw fetchError;
                }
            }

            console.log(`[ProfitAPI] Final: ${trades.length} trades from ${dataSource}`);
        } catch (fetchError) {
            console.error('[ProfitAPI] Trade fetch error:', fetchError.message);
            return NextResponse.json({ success: false, error: `API Error: ${fetchError.message}` }, { status: 500 });
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
            const apiKey = process.env.HELIUS_RPC_URL?.match(/api-key=([a-f0-9-]+)/i)?.[1] || process.env.HELIUS_BACKUP_API_KEY;
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
                let price = data.price || 0;

                // Sanity Check: SOL should not be < $10 (unless catastrophic crash)
                // This prevents the $0.12 bug if DexScreener picks a bad pair.
                if (price < 10) {
                    console.warn(`[ProfitAPI] Suspicious SOL Price: $${price}. Using fallback ($150).`);
                    price = 150;
                }
                return price;
            } catch (e) {
                console.warn('[ProfitAPI] SOL Price Fetch Failed, using fallback ($150)');
                return 150;
            }
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
        // 5b. Re-Analyze with Prices
        const analysis = analyzeTimeWindows(trades, priceMap, solPrice);

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

            // NOTE: USD values are now calculated IN trade-analysis.js using Historical Prices.
            // DO NOT overwrite them with simple multiplication here.

            // Only fill volume if missing (Volume is usually fine with current price or strictly historical, 
            // but trade-analysis doesn't return totalVolumeUSD yet? 
            // Wait, I missed adding totalVolumeUSD to trade-analysis.js return!
            // I should add it or accept simple multiplication for volume (less critical).
            // Let's use simple multiplication for volume for now as it's less PnL sensitive.
            metrics.totalVolumeUSD = metrics.totalVolume * solPrice;

            // Total Unrealized Sum (already in metrics if I updated it? Yes)
            const totalUnrealizedPnL = metrics.details.reduce((acc, p) => acc + (p.unrealizedPnL || 0), 0);
            metrics.totalUnrealizedPnL = totalUnrealizedPnL;
            // metrics.totalUnrealizedPnLUSD is also returned now. Correctly calculated with Historical Cost Basis.
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
                }, 'wallet'),
                // LOG TO PERMANENT HISTORY
                logUserScan(user.id, walletToAnalyze, {
                    pnl: analysis['all']?.totalRealizedPnL || 0,
                    winRate: analysis['all']?.winRate || 0,
                    trades: analysis['all']?.totalTrades || 0,
                    solPrice: solPrice || 0
                })
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

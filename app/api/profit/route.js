import { NextResponse } from 'next/server';
import { getOrCreateUser, canUseAnalysis, recordUsage, recordScan } from '@/lib/db';
import { getWalletHistory, getBatchTokenMetadata } from '@/lib/helius';
import { calculateWalletMetrics, analyzeTimeWindows } from '@/lib/trade-analysis';
import { getBatchTokenPrices, getTokenData } from '@/lib/dexscreener';

export async function POST(request) {
    try {
        const body = await request.json();
        const { walletToAnalyze, deviceId, userWallet } = body;

        console.log(`[ProfitAPI] Request: walletToAnalyze=${walletToAnalyze}, deviceId=${deviceId}, userWallet=${userWallet}`);

        // 1. Auth & Premium Check
        const user = await getOrCreateUser({ deviceId, walletAddress: userWallet });
        console.log(`[ProfitAPI] User Resolved: ID=${user.id}, Tier=${user.tier}, Wallet=${user.wallet_address}`);

        // Admin Bypass
        const ADMIN_WALLET = process.env.ADMIN_WALLET || '2unNnTnv5DcmtdQYAJuLzg4azHu67obGL9dX8PYwxUDQ';
        const isAdmin = userWallet === ADMIN_WALLET;

        // Check Usage Limits (for Free users)
        // We allow FREE, PREMIUM, TRIAL. But FREE is limited.
        const usageCheck = await canUseAnalysis(user.id);

        // Strict Block only if NOT allowed AND NOT Admin AND NOT Demo Landing
        if (!isAdmin && deviceId !== 'demo-landing' && !usageCheck.allowed) {
            return NextResponse.json({
                success: false,
                error: usageCheck.reason,
                isPremiumLocked: true,
                debugInfo: {
                    userId: user.id,
                    tier: user.tier,
                    receivedWallet: userWallet,
                    subscriptionExpiry: user.subscription_expiry
                }
            }, { status: 403 });
        }

        if (!walletToAnalyze) {
            return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
        }

        // 2. Fetch Data
        console.log(`[ProfitAPI] Analyzing wallet: ${walletToAnalyze}`);
        let trades = [];
        try {
            trades = await getWalletHistory(walletToAnalyze);
        } catch (fetchError) {
            console.error('[ProfitAPI] Wallet history fetch error:', fetchError.message);
            return NextResponse.json({
                success: false,
                error: `Helius API Error: ${fetchError.message}`,
                data: null
            }, { status: 500 });
        }

        // Record usage if we seemingly got data (or just record attempt?)
        // Usually record usage only if we return value.
        // We'll record at the end.

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
            return NextResponse.json({
                success: true,
                data: null,
                message: 'No trading history found for this wallet.'
            });
        }

        // Record usage now that we found valid history (deduct credit/limit)
        if (!isAdmin && deviceId !== 'demo-landing') {
            await recordUsage(user.id, walletToAnalyze);
        }

        // 3. Preliminary Analysis (Identifies Open Positions)
        const initialAnalysis = analyzeTimeWindows(trades);

        // 4. Fetch Prices for Open Positions
        // Extract all mints that have "OPEN" status in 'all' timeframe
        const openMints = initialAnalysis.all.details
            .filter(p => p.status === 'OPEN' && p.remainingTokens > 0)
            .map(p => p.mint);

        // Also fetch prices for top closed positions just in case (optional, but let's stick to open)
        // Combine unique mints
        const uniqueMintsToFetch = [...new Set(openMints)];
        let priceMap = {};

        if (uniqueMintsToFetch.length > 0) {
            priceMap = await getBatchTokenPrices(uniqueMintsToFetch.slice(0, 90)); // Limit to 90 to be safe
        }


        // 5a. Fetch SOL Price (wSOL)
        let solPrice = 0;
        try {
            const wSOL = 'So11111111111111111111111111111111111111112';
            const wSolData = await getTokenData(wSOL);
            solPrice = wSolData.price;
        } catch (e) {
            console.error('Info: Failed to fetch SOL price', e);
        }

        // 5b. Re-Analyze with Prices
        const analysis = analyzeTimeWindows(trades, priceMap); // Make sure analyzeTimeWindows passes priceMap 

        // 6. Metadata Optimization
        // Get unique mints from ALL time trades
        const allDetails = analysis.all.details;
        const uniqueMints = [...new Set(allDetails.map(d => d.mint))];
        const tokenMetadata = await getBatchTokenMetadata(uniqueMints);

        // 7. Inject USD Values & AI Verdict
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
            await recordScan(user.id, {
                address: walletToAnalyze,
                name: 'Wallet', // Default name, user can label it later
                symbol: 'SOL',
                imageUrl: null
            }, 'wallet');
        }

        return NextResponse.json({
            success: true,
            data: {
                summary,
                tokenInfo: tokenMetadata, // Map of mint -> { symbol, image, name }
                balance,
                solPrice,
                aiVerdict
            }
        });

    } catch (e) {
        console.error('Profit API Error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

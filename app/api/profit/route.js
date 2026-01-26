export const maxDuration = 60; // Allow 60 seconds for profit analysis

import { NextResponse } from 'next/server';
import { getOrCreateUser, canUseAnalysis, recordUsage, recordScan } from '@/lib/db';
import { getWalletHistory, getBatchTokenMetadata } from '@/lib/helius';
import { calculateWalletMetrics, analyzeTimeWindows } from '@/lib/trade-analysis';
import { getBatchTokenPrices, getTokenData } from '@/lib/dexscreener';

export async function POST(request) {
    try {
        const body = await request.json();
        const { walletToAnalyze, deviceId, userWallet, scanType = 'quick' } = body;

        console.log(`[ProfitAPI] Request: wallet=${walletToAnalyze}, type=${scanType}, deviceId=${deviceId}`);

        // 1. Auth & Premium Check
        const user = await getOrCreateUser({ deviceId, walletAddress: userWallet });
        console.log(`[ProfitAPI] User Resolved: ID=${user.id}, Tier=${user.tier}, Wallet=${user.wallet_address}`);

        // Admin Bypass
        const ADMIN_WALLET = process.env.ADMIN_WALLET || '2unNnTnv5DcmtdQYAJuLzg4azHu67obGL9dX8PYwxUDQ';
        const isAdmin = userWallet === ADMIN_WALLET;
        const isRefresh = body.isRefresh || false;

        // Check Usage Limits (for Free users)
        const usageCheck = await canUseAnalysis(user.id);

        if (!isAdmin && deviceId !== 'demo-landing' && !usageCheck.allowed) {
            return NextResponse.json({
                success: false,
                error: usageCheck.reason,
                isPremiumLocked: true,
                debugInfo: {
                    userId: user.id,
                    tier: user.tier,
                }
            }, { status: 403 });
        }

        if (!walletToAnalyze) {
            return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
        }

        // Limit Logic: Quick (100) vs Deep (1000)
        let txLimit = 100; // Default Quick Scan
        const isPremiumUser = user.tier === 'PREMIUM' || user.tier === 'TRIAL' || user.tier === 'Premium' || user.tier === 'Premium Trial';

        if (scanType === 'deep') {
            if (isPremiumUser || isAdmin) {
                txLimit = 1000;
                console.log('[ProfitAPI] Deep Scan authorized for Premium/Admin user.');
            } else {
                console.log('[ProfitAPI] Deep Scan denied for Free user. Falling back to Quick Scan.');
                // We could throw error, but better to just do quick scan and maybe add a warning flag?
                // For now, let's just silently fallback or we can return a flag.
            }
        }

        // 2. Fetch Data (Parallelize History and Balance)
        console.log(`[ProfitAPI] Analyzing wallet: ${walletToAnalyze} (Limit: ${txLimit})`);
        let trades = [];
        let balance = 0;

        try {
            const [historyRes, balanceRes] = await Promise.allSettled([
                getWalletHistory(walletToAnalyze, { limit: txLimit }),
                (async () => {
                    const apiKey = process.env.NEXT_PUBLIC_RPC_URL?.match(/api-key=([a-f0-9-]+)/i)?.[1];
                    if (!apiKey) return 0;
                    const res = await fetch(`https://api.helius.xyz/v0/addresses/${walletToAnalyze}/balances?api-key=${apiKey}`);
                    const json = await res.json();
                    return (json?.nativeBalance || 0) / 1e9;
                })()
            ]);

            if (historyRes.status === 'fulfilled') {
                trades = historyRes.value;
            } else {
                throw historyRes.reason;
            }

            if (balanceRes.status === 'fulfilled') {
                balance = balanceRes.value;
            }
        } catch (fetchError) {
            console.error('[ProfitAPI] Wallet history fetch error:', fetchError.message);
            return NextResponse.json({
                success: false,
                error: `Helius API Error: ${fetchError.message}`,
                data: null
            }, { status: 500 });
        }

        if (trades.length === 0) {
            return NextResponse.json({
                success: true,
                data: null,
                message: 'No trading history found for this wallet.'
            });
        }

        // Manual scans always count as 1 credit
        const skipUsageRecord = isAdmin || isRefresh || deviceId === 'demo-landing';
        if (!skipUsageRecord) {
            await recordUsage(user.id, walletToAnalyze);
        }

        // 3. Preliminary Analysis (Identifies Open Positions)
        const initialAnalysis = analyzeTimeWindows(trades);

        // 4. Fetch Prices and Metadata in Parallel
        const allDetailsForMetadata = initialAnalysis.all.details;
        const uniqueMintsForMetadata = [...new Set(allDetailsForMetadata.map(d => d.mint))];
        const openMints = allDetailsForMetadata
            .filter(p => p.status === 'OPEN' && p.remainingTokens > 0)
            .map(p => p.mint);
        const uniqueMintsToPrice = [...new Set(openMints)];

        let priceMap = {};
        let solPrice = 100; // Fallback
        let tokenMetadata = {};

        try {
            const [pricesRes, solPriceRes, metadataRes] = await Promise.allSettled([
                uniqueMintsToPrice.length > 0 ? getBatchTokenPrices(uniqueMintsToPrice.slice(0, 90)) : Promise.resolve({}),
                getTokenData('So11111111111111111111111111111111111111112'),
                getBatchTokenMetadata(uniqueMintsForMetadata)
            ]);

            if (pricesRes.status === 'fulfilled') priceMap = pricesRes.value;
            if (solPriceRes.status === 'fulfilled') solPrice = solPriceRes.value.price;
            if (metadataRes.status === 'fulfilled') tokenMetadata = metadataRes.value;
        } catch (e) {
            console.error('Info: Parallel data fetch partial failure', e);
        }

        const analysis = analyzeTimeWindows(trades, priceMap);

        const summary = analysis;
        const globalMetrics = summary['all'];
        let aiStatus = 'UNPROFITABLE';
        let aiScore = 50;

        if (globalMetrics.profitFactor >= 1.5 && globalMetrics.winRate > 40) {
            aiStatus = 'PROFITABLE';
            aiScore = 85 + Math.min(globalMetrics.profitFactor, 5);
        } else if (globalMetrics.profitFactor >= 1.0) {
            aiStatus = 'PROFITABLE';
            aiScore = 65;
        } else {
            if (globalMetrics.totalTrades > 50) aiStatus = 'HIGH RISK';
            aiScore = 30;
        }

        const aiVerdict = {
            status: aiStatus,
            score: Math.min(Math.round(aiScore), 100),
            summary: null
        };

        Object.keys(summary).forEach(key => {
            const metrics = summary[key];
            metrics.totalRealizedPnLUSD = metrics.totalRealizedPnL * solPrice;
            metrics.grossProfitUSD = metrics.grossProfit * solPrice;
            metrics.grossLossUSD = metrics.grossLoss * solPrice;
            metrics.avgPnLUSD = metrics.avgPnL * solPrice;
            metrics.totalVolumeUSD = metrics.totalVolume * solPrice;

            const totalUnrealizedPnL = metrics.details.reduce((acc, p) => acc + (p.unrealizedPnL || 0), 0);
            metrics.totalUnrealizedPnL = totalUnrealizedPnL;
            metrics.totalUnrealizedPnLUSD = totalUnrealizedPnL * solPrice;
        });

        if (!skipUsageRecord) {
            await recordScan(user.id, {
                address: walletToAnalyze,
                name: 'Wallet',
                symbol: 'SOL',
                imageUrl: null
            }, 'wallet');
        }

        return NextResponse.json({
            success: true,
            data: {
                summary,
                tokenInfo: tokenMetadata,
                balance,
                solPrice,
                aiVerdict,
                scanType: txLimit === 1000 ? 'deep' : 'quick'
            },
            user: {
                tier: user.tier,
                remainingToday: skipUsageRecord ? usageCheck.remainingToday : Math.max(0, usageCheck.remainingToday - 1),
                usedToday: skipUsageRecord ? usageCheck.usedToday : (usageCheck.usedToday + 1),
                dailyLimit: usageCheck.dailyLimit,
                credits: user.credits
            }
        });

    } catch (e) {
        console.error('Profit API Error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

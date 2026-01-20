/**
 * Main Analysis API Endpoint
 * POST /api/analyze
 * Body: { ca: string, deviceId: string }
 */

import { NextResponse } from 'next/server';

// Import modules
import { getTokenData, getHolderData, getBondingCurveData, getOHLCVData } from '@/lib/dexscreener';
import { getSniperData, getRealHolderData, getUniqueBuyers, getDevWalletStatus, getTokenAuthorities, getWhaleAnalysis } from '@/lib/solana';
import { analyzeMetrics } from '@/lib/gemini';
import { getOrCreateUser, canUseAnalysis, recordUsage, getTierInfo, initDatabase, hasUserScanned, recordScan } from '@/lib/db';

/**
 * Helper function to format age in hours to human readable format
 */
function formatAge(ageHours) {
    if (!ageHours || ageHours <= 0) return 'New';

    if (ageHours < 1) {
        return `${Math.round(ageHours * 60)}m`;
    } else if (ageHours < 24) {
        const hours = Math.floor(ageHours);
        const mins = Math.round((ageHours - hours) * 60);
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    } else {
        const days = Math.floor(ageHours / 24);
        const hours = Math.round(ageHours % 24);
        return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { ca, deviceId } = body;

        if (!ca) {
            return NextResponse.json({ error: 'Contract address is required' }, { status: 400 });
        }

        // Get User & Check Limits
        const walletAddress = body.walletAddress;
        const user = getOrCreateUser({ deviceId, walletAddress });

        const usageCheck = canUseAnalysis(user.id);
        if (!usageCheck.allowed) {
            return NextResponse.json({
                success: false,
                error: usageCheck.reason,
                isLimitReached: true
            }, { status: 403 });
        }

        // Check trial status
        const trialStatus = { remaining: usageCheck.remainingToday };

        // Admin Bypass & Duplicate Scan Check
        const isAdmin = walletAddress && walletAddress === process.env.ADMIN_WALLET;
        const skipUsageRecord = isAdmin || hasUserScanned(user.id, ca);

        // Fetch all data in parallel
        // Note: holderData is now a hybrid. We try RPC first, merge with DexScreener estimate for total count.
        const [tokenData, estHolderData, bondingData, ohlcvData, sniperData, realHolderData, uniqueBuyersCount, tokenAuthorityData] = await Promise.all([
            getTokenData(ca),
            getHolderData(ca), // Keep for total count estimate
            getBondingCurveData(ca),
            getOHLCVData(ca, '15m'),
            getSniperData(ca).catch(err => ({ isEstimated: true, error: err.message })),
            getRealHolderData(ca).catch(err => ({ isEstimated: true, error: err.message })),
            getUniqueBuyers(ca).catch(err => 0),
            getTokenAuthorities(ca).catch(err => ({ burnPercent: 0, isRenounced: false, isFreezeRevoked: false, isEstimated: true }))
        ]);

        // Merge Holder Data
        const holderData = {
            ...estHolderData,
            ...(!realHolderData.isEstimated ? {
                top10HoldersPercent: realHolderData.top10Percent,
                top10Holders: realHolderData.top10Holders,
                isEstimated: false // Critical metrics are real
            } : {})
        };

        // Calculate additional metrics
        const ageHours = tokenData.ageHours || 0;

        // Dev Wallet Status - Called AFTER holderData for inference fallback
        const devWalletData = await getDevWalletStatus(ca, holderData, ageHours).catch(err => ({
            action: 'UNKNOWN',
            isEstimated: true,
            error: err.message
        }));

        // 1. Bonding Curve Velocity (% progress per minute)
        // Estimate velocity if we lack historical data
        const bondingVelocity = ageHours > 0
            ? Math.min(100, bondingData.progress / (ageHours * 60)) // % per minute
            : (bondingData.progress > 0 ? 5 : 0); // High velocity if very new with progress

        // 2. Organic Volume Score (Wash Trading Filter)
        // High volume relative to market cap + balanced buy/sell ratio = Organic
        const volumeDensity = tokenData.marketCap > 0 ? (tokenData.volume24h / 4 / tokenData.marketCap) : 0; // 6h volume estimate
        const tradeDistribution = Math.min(tokenData.buyCount, tokenData.sellCount) / Math.max(tokenData.buyCount, tokenData.sellCount); // Closer to 1 is better
        const organicScore = Math.min(1, (tradeDistribution * 0.6) + (Math.min(1, volumeDensity) * 0.4));


        // 3. Winning Profile Check
        const isWinningProfile =
            bondingData.progress > 10 &&
            bondingVelocity > 0.02 && // > 2% per 5 mins
            organicScore > 0.5;

        // Prepare data for AI analysis
        const analysisInput = {
            ...tokenData,
            holders: holderData.totalHolders,
            uniqueBuyers: uniqueBuyersCount,
            top10HoldersPercent: holderData.top10HoldersPercent,
            bondingProgress: bondingData.progress,
            bondingVelocity: bondingVelocity.toFixed(4),
            organicScore: organicScore.toFixed(2),
            isWinningProfile,
            ageHours
        };

        // Get AI analysis (metrics-based for now, chart analysis requires image)
        let aiAnalysis = null;
        try {
            console.log('Starting Gemini AI analysis...');
            console.log('GEMINI_API_KEY set:', !!process.env.GEMINI_API_KEY);
            const geminiResult = await analyzeMetrics(analysisInput);
            console.log('Gemini result:', JSON.stringify(geminiResult, null, 2));
            if (geminiResult.success) {
                aiAnalysis = geminiResult.analysis;
                console.log('Gemini AI analysis successful');
            } else {
                console.log('Gemini returned success=false:', geminiResult.error);
                // Try OpenAI as fallback
                console.log('Trying OpenAI fallback...');
                const { analyzeWithOpenAI } = require('@/lib/openai-analyze');
                const openaiResult = await analyzeWithOpenAI(analysisInput);
                if (openaiResult.success) {
                    aiAnalysis = openaiResult.analysis;
                    console.log('OpenAI AI analysis successful');
                }
                if (openaiResult.success) {
                    aiAnalysis = openaiResult.analysis;
                    console.log('OpenAI AI analysis successful');
                }
            }
        } catch (error) {
            console.error('Gemini AI analysis failed:', error.message);
            // ... (fallback logic remains)
        }

        // --- WHALE & DEV ANALYSIS ---
        // Collect addresses to check: Top 10 Holders + Snipers
        const walletsToCheck = new Set();
        if (holderData.top10Holders) {
            holderData.top10Holders.forEach(h => walletsToCheck.add(h.address));
        }
        if (sniperData && sniperData.sniperWallets) {
            sniperData.sniperWallets.forEach(s => walletsToCheck.add(s.address));
        }

        // Run Whale Analysis
        const whaleAnalysis = await getWhaleAnalysis(Array.from(walletsToCheck));


        // Record usage (Only if new analysis)
        if (!skipUsageRecord) {
            recordUsage(user.id, ca);
        }

        // Record scan for "Recent Scans" list
        try {
            recordScan(user.id, {
                address: ca,
                name: tokenData.name,
                symbol: tokenData.symbol,
                imageUrl: tokenData.imageUrl
            });
        } catch (e) {
            console.error('Failed to record scan:', e);
        }

        // Calculate graduation chance based on bonding curve and momentum
        const graduationChance = calculateGraduationChance(bondingData, tokenData, holderData, bondingVelocity);

        // Calculate entry point suggestion
        const entryPoint = calculateEntryPoint(tokenData, bondingData, holderData, organicScore, isWinningProfile);

        // Check if token is dead
        const deadCoinStatus = checkDeadCoin(tokenData);

        // Check for specific Rug Pull Risks
        const rugStatus = checkRugStatus(tokenData, holderData, organicScore);

        // --- SAFETY OVERRIDE (Critical Fix) ---
        // If technical analysis confirms Dead or Rug, OVERRIDE any AI positivity
        // This ensures "BUY" is never shown for rugs, even if AI hallucinates potential.
        if (deadCoinStatus.isDead || rugStatus.riskLevel === 'CRITICAL') {
            console.log('SAFETY OVERRIDE TRIGGERED: Token is Dead or Critical Risk');

            const safetySummary = deadCoinStatus.isDead
                ? deadCoinStatus.description
                : "CRITICAL RUG RISK DETECTED. High insider holdings or liquidity issues.";

            // Force overwrite aiAnalysis (whether it existed or not)
            aiAnalysis = {
                profitProbability: 2, // 2% chance
                confidence: 'HIGH',
                recommendation: 'AVOID',
                entryScore: 1, // Lowest possible
                riskLevel: 'EXTREME',
                keyInsights: [
                    ...(deadCoinStatus.isDead ? ['⛔ TOKEN IS DEAD (Zero Volume/Movement)'] : []),
                    ...deadCoinStatus.signals,
                    ...rugStatus.signals,
                    "⚠️ SAFETY SYSTEM OVERRIDE: Technical indicators suggest staying away."
                ],
                summary: safetySummary
            };
        }

        // Advanced FOMO Metrics
        const velocity = checkVolumeVelocity(tokenData);
        const smartMoney = analyzeSmartMoney(holderData, tokenData, sniperData);

        // Update Entry Point with new logic
        // entryPoint already calculated at line 190, but we need to re-calculate if we want to pass new params or just update the variable. 
        // Actually, we declared `const entryPoint` at line 190. We should duplicate usage or just reuse.
        // The previous edit inserted a new calculation. Remove the duplicate declaration.

        // RE-ASSIGN instead of re-declare if needed, but `entryPoint` is const. 
        // Better: Remove the first declaration at 190 if it's outdated, OR remove this second one if it's redundant.
        // Step 1795 inserted lines 199-203.
        // Original line 190: const entryPoint = calculateEntryPoint(...)
        // Let's remove the second declaration and just update the first one's call site if needed, OR comment out the original.
        // Actually, I'll delete the duplicate declaration block here.

        // Build response
        const response = {
            success: true,
            token: {
                name: tokenData.name,
                symbol: tokenData.symbol,
                address: ca,
                imageUrl: tokenData.imageUrl || null,
                price: tokenData.price,
                marketCap: tokenData.marketCap,
                volume24h: tokenData.volume24h,
                volume1h: tokenData.volume1h || 0,
                volume5m: tokenData.volume5m || 0,
                priceChange5m: tokenData.priceChange5m || 0,
                priceChange1h: tokenData.priceChange1h || 0,
                priceChange24h: tokenData.priceChange24h || 0,
                // Liquidity data
                liquidity: tokenData.liquidity || 0,
                liquidityRatio: tokenData.marketCap > 0
                    ? Math.round((tokenData.liquidity / tokenData.marketCap) * 10000) / 100
                    : 0,
                // Age
                ageHours: ageHours,
                ageFormatted: formatAge(ageHours),
                // Platform
                dexId: tokenData.dexId,
                isPumpFun: tokenData.isPumpFun
            },
            metrics: {
                buyCount: tokenData.buyCount,
                sellCount: tokenData.sellCount,
                buyRatio: tokenData.buyRatio,
                totalTrades: tokenData.totalTrades,
                uniqueBuyers: uniqueBuyersCount > 0 ? uniqueBuyersCount : (tokenData.uniqueBuyers || tokenData.buyCount),
                bondingVelocity: bondingVelocity.toFixed(3) + '%/min',
                organicScore: organicScore.toFixed(2),
                winningProfile: isWinningProfile
            },
            holders: {
                total: holderData.totalHolders,
                top10Percent: holderData.top10HoldersPercent,
                distribution: holderData.holderDistribution,
                topHolders: (holderData.top10Holders || []).slice(0, getTierInfo(user.tier).features.includes('top50_holders') ? 50 : 10)
            },
            bondingCurve: {
                progress: bondingData.progress,
                isGraduated: bondingData.isGraduated,
                estimatedToGraduation: bondingData.estimatedToGraduation
            },
            // Security status (placeholder for future implementation)
            security: {
                mintAuthorityRevoked: null,
                freezeAuthorityDisabled: null,
                lpLocked: null,
                devHoldingPercent: null,
                devSoldAll: null,
                sniperCount: null,
                sniperCount: smartMoney.sniperStatus.count,
                isEstimated: true
            },
            // Advanced Signals
            advanced: {
                volumeVelocity: velocity,
                smartMoney: smartMoney.smartMoneyFlow,
                insiderStatus: smartMoney.insiderStatus,
                sniperStatus: smartMoney.sniperStatus
            },
            // Mechanics Card Data (Real Data)
            mechanics: {
                devStatus: {
                    action: devWalletData.action || 'UNKNOWN',
                    devWallet: devWalletData.devWallet || null,
                    balance: devWalletData.balance || 0,
                    isEstimated: devWalletData.isEstimated || false,
                    method: devWalletData.method || 'unknown',
                    color: devWalletData.action === 'SOLD ALL' ? '#ef4444'
                        : devWalletData.action === 'LIKELY SOLD' ? '#f97316'
                            : devWalletData.action === 'HOLDING' ? '#22c55e'
                                : devWalletData.action === 'LIKELY HOLDING' ? '#84cc16'
                                    : devWalletData.action === 'HOLDING (RISK)' ? '#eab308'
                                        : '#888'
                },
                snipers: {
                    count: sniperData.totalSnipers || 0,
                    soldCount: sniperData.snipersSold || 0,
                    holdingCount: (sniperData.totalSnipers || 0) - (sniperData.snipersSold || 0),
                    isEstimated: sniperData.isEstimated || false,
                    riskLevel: sniperData.riskLevel || 'UNKNOWN'
                },
                curveVelocity: {
                    value: bondingVelocity.toFixed(2),
                    label: `+${bondingVelocity.toFixed(2)}%/min`
                },
                top1Holder: {
                    percent: (holderData.top10Holders && holderData.top10Holders[0])
                        ? parseFloat(holderData.top10Holders[0].percent)
                        : 0,
                    address: (holderData.top10Holders && holderData.top10Holders[0])
                        ? holderData.top10Holders[0].address
                        : null,
                    isRisky: (holderData.top10Holders && holderData.top10Holders[0])
                        ? parseFloat(holderData.top10Holders[0].percent) > 15
                        : false
                },
                whales: {
                    count: whaleAnalysis.count || 0,
                    wallets: whaleAnalysis.whales || [],
                    hasWhales: (whaleAnalysis.count || 0) > 0
                }
            },
            // Token Safety (Burn, Renounced, Freeze Revoked)
            tokenSafety: {
                burnPercent: tokenAuthorityData.burnPercent || 0,
                isRenounced: tokenAuthorityData.isRenounced || false,
                isFreezeRevoked: tokenAuthorityData.isFreezeRevoked || false,
                isEstimated: tokenAuthorityData.isEstimated || false,
                allSafe: (tokenAuthorityData.isRenounced === true && tokenAuthorityData.isFreezeRevoked === true)
            },
            // Entry Point Suggestion
            entryPoint: entryPoint,
            // Dead Coin Detection
            tokenHealth: deadCoinStatus,
            // Rug Detection
            rugRisk: rugStatus,
            analysis: aiAnalysis ? {
                profitProbability: aiAnalysis.profitProbability || aiAnalysis.score,
                confidence: aiAnalysis.confidence,
                recommendation: aiAnalysis.recommendation,
                entryScore: aiAnalysis.entryScore,
                riskLevel: aiAnalysis.riskLevel || aiAnalysis.risk_level,
                graduationChance: graduationChance,
                keyInsights: aiAnalysis.keyInsights || aiAnalysis.warning_flags || [],
                summary: aiAnalysis.summary || aiAnalysis.primary_reason
            } : {
                profitProbability: calculateBasicProfitability(tokenData, holderData, bondingData, organicScore, entryPoint.riskLevel, uniqueBuyersCount, devWalletData, sniperData, isWinningProfile, whaleAnalysis),
                confidence: 'MEDIUM',
                recommendation: deadCoinStatus.isDead ? 'AVOID' : (entryPoint.shouldEnter ? 'BUY' : 'WAIT'),
                entryScore: entryPoint.score,
                riskLevel: entryPoint.riskLevel || 'HIGH',
                graduationChance: graduationChance,
                keyInsights: deadCoinStatus.signals.length > 0
                    ? deadCoinStatus.signals
                    : generateBasicInsights(tokenData, holderData, organicScore, bondingVelocity),
                summary: deadCoinStatus.description
            },
            chart: ohlcvData,
            user: {
                tier: user.tier,
                remainingToday: usageCheck.remainingToday - 1,
                remainingTrial: user.tier === 'free' ? (trialStatus?.remaining || 0) : 'unlimited',
                credits: user.credits
            },
            timestamp: new Date().toISOString()
        };

        // SYNC LOGIC: Fix contradictions between Profit Probability and Entry Point
        if (response.entryPoint.shouldEnter) {
            if (response.analysis.recommendation !== 'BUY') {
                // If Entry says ENTER but Analysis says WAIT
                if (response.analysis.profitProbability > 50) {
                    response.analysis.recommendation = 'BUY'; // Upgrade Analysis
                } else {
                    response.entryPoint.verdict = 'WAIT FOR MOMENTUM'; // Downgrade Entry
                    response.entryPoint.shouldEnter = false;
                }
            }
        }

        // If Profit is extremely high (>80) but Entry says WAIT, trust Entry (metrics logic is stricter)
        if (response.analysis.profitProbability > 80 && !response.entryPoint.shouldEnter) {
            // Keep Analysis as is (it's probabilistic), but Entry advice prevails for action
        }


        return NextResponse.json(response);

    } catch (error) {
        console.error('Analysis error:', error);
        return NextResponse.json({
            success: false,
            error: 'Analysis failed',
            message: error.message
        }, { status: 500 });
    }
}

/**
 * Calculate graduation chance based on multiple factors
 */
function calculateGraduationChance(bondingData, tokenData, holderData, velocity) {
    if (bondingData.isGraduated) return 100;

    let chance = bondingData.progress; // Base chance is current progress

    // Boost for high velocity
    if (velocity > 0.5) chance += 20;
    else if (velocity > 0.1) chance += 10;

    // Boost for holder count
    if (holderData.totalHolders > 500) chance += 15;
    else if (holderData.totalHolders > 100) chance += 5;

    // Boost for volume
    if (tokenData.volume24h > 10000) chance += 10;

    return Math.min(99, Math.round(chance));
}

/**
 * Basic profitability calculation when AI is unavailable
 * IMPROVED: Stricter scoring with dev/sniper penalties
 */
function calculateBasicProfitability(tokenData, holderData, bondingData, organicScore, riskLevel, uniqueBuyers = 0, devWalletData = {}, sniperData = {}, isWinningProfile = false, whaleAnalysis = {}) {
    let score = 20; // Start very pessimistic - memecoins are inherently risky

    // === ADVANCED MOMENTUM (5m) ===
    // Check if buying pressure is surging NOW
    const total5m = (tokenData.buyCount5m || 0) + (tokenData.sellCount5m || 0);
    if (total5m > 10) {
        const buyPressure5m = (tokenData.buyCount5m / total5m);
        if (buyPressure5m > 0.6) score += 10;
        else if (buyPressure5m < 0.4) score -= 10;
    }

    // === WHALE CONVICTION ===
    const whaleCount = whaleAnalysis.count || 0;
    if (whaleCount > 2) score += 15; // Strong conviction
    else if (whaleCount > 0) score += 5; // Minimal conviction

    // === LIQUIDITY HEALTH ===
    // Prevents high scores for thin liquidity rugs
    if (tokenData.marketCap > 0) {
        const liqRatio = tokenData.liquidity / tokenData.marketCap;
        if (liqRatio > 0.15) score += 5;
        else if (liqRatio < 0.05) score -= 15; // Danger zone
    }

    // === SOCIAL VALIDATION ===
    // Basic check for effort
    const hasSocials = (tokenData.websites && tokenData.websites.length > 0) || (tokenData.socials && tokenData.socials.length > 0);
    if (hasSocials) score += 5;
    else score -= 5; // No socials = very suspicious

    // === POSITIVE FACTORS (Legacy) ===

    // Volume/Liquidity Check
    if (tokenData.liquidity > 20000) score += 10;
    else if (tokenData.liquidity > 10000) score += 5;

    if (tokenData.volume24h > 100000) score += 10;
    else if (tokenData.volume24h > 50000) score += 5;

    // 5m Volume Impact (Momentum) - Stronger rewards
    if (tokenData.volume5m > 10000) score += 10;
    else if (tokenData.volume5m > 5000) score += 5;

    // Holder Check
    if (holderData.totalHolders > 500) score += 10;
    else if (holderData.totalHolders > 200) score += 5;

    // Unique Buyers Check
    if (uniqueBuyers > 100) score += 10;
    else if (uniqueBuyers > 50) score += 5;

    // Good holder distribution
    if (holderData.top10HoldersPercent < 20) score += 10;
    else if (holderData.top10HoldersPercent < 30) score += 5;

    // Bonding Curve near graduation
    if (bondingData.progress > 95) score += 15;
    else if (bondingData.progress > 80) score += 10;
    else if (bondingData.progress > 60) score += 5;

    // Organic Score
    if (organicScore > 0.7) score += 10;
    else if (organicScore > 0.5) score += 5;

    // Dev HOLDING is a positive sign
    if (devWalletData.action === 'HOLDING') {
        score += 10;
    }

    // Snipers still holding = confidence
    const totalSnipers = sniperData.totalSnipers || 0;
    const snipersSold = sniperData.snipersSold || 0;
    if (totalSnipers > 0) {
        const snipersHoldingRatio = 1 - (snipersSold / totalSnipers);
        if (snipersHoldingRatio > 0.8) score += 10;
        else if (snipersHoldingRatio > 0.5) score += 5;
    }

    // DEV WALLET STATUS - Critical red flag
    if (devWalletData.action === 'SOLD ALL') {
        score -= 30; // Major rug indicator
    }

    // SNIPER DUMP - If most snipers sold
    if (totalSnipers > 0) {
        const snipersSoldRatio = snipersSold / totalSnipers;
        if (snipersSoldRatio > 0.8) score -= 20;      // 80%+ dumped
        else if (snipersSoldRatio > 0.6) score -= 10; // 60%+ dumped
    }

    // 5m Volume Penalties - Tiered
    if (tokenData.volume5m === 0) score -= 30;           // Dead
    else if (tokenData.volume5m < 100) score -= 25;      // Nearly dead
    else if (tokenData.volume5m < 500) score -= 15;      // Low momentum

    // Age + Dead Combo Penalty
    if ((tokenData.ageHours || 0) > 24 && (tokenData.volume5m || 0) < 100) {
        score -= 20; // Abandoned token
    }

    // Unique Buyers Penalty
    if (uniqueBuyers < 10 && (tokenData.ageHours || 0) > 0.5) score -= 15;

    // Concentration Risk - Stricter tiers
    if (holderData.top10HoldersPercent > 70) score -= 30;
    else if (holderData.top10HoldersPercent > 50) score -= 20;
    else if (holderData.top10HoldersPercent > 40) score -= 10;

    // Top 1 Holder Dominance
    const top1Percent = holderData.top10Holders?.[0]?.percent
        ? parseFloat(holderData.top10Holders[0].percent)
        : 0;
    if (top1Percent > 30) score -= 25;
    else if (top1Percent > 20) score -= 15;
    else if (top1Percent > 15) score -= 5;

    // Organic Score Penalty
    if (organicScore < 0.2) score -= 25;
    else if (organicScore < 0.3) score -= 15;

    // Price Trend Penalty
    if ((tokenData.priceChange5m || 0) < -10) score -= 15;
    else if ((tokenData.priceChange5m || 0) < -5) score -= 10;

    // === RISK LEVEL CAPS ===
    if (riskLevel === 'CRITICAL') {
        score -= 30;
        return Math.min(25, Math.max(0, score)); // Max 25% if Critical
    }
    if (riskLevel === 'HIGH') {
        score -= 15;
        // ADJUSTED CAP: If it's a "Winning Profile", allow up to 80%
        const cap = isWinningProfile ? 80 : 50;
        return Math.min(cap, Math.max(0, score));
    }

    // Allow up to 100% but token must EARN it through exceptional metrics
    return Math.max(0, Math.min(100, score));
}

/**
 * Generate basic insights when AI is unavailable
 */
function generateBasicInsights(tokenData, holderData, organicScore, velocity) {
    const insights = [];

    if (tokenData.volume24h > tokenData.marketCap) {
        insights.push('🟢 High volume relative to market cap');
    }

    if (holderData.top10HoldersPercent > 50) {
        insights.push('⚠️ High risk: Top 10 holders own >50%');
    }

    if (organicScore < 0.3) {
        insights.push('🔴 Warning: Suspected wash trading activity');
    }

    if (velocity > 0.05) {
        insights.push('🚀 Fast bonding curve progress');
    }

    return insights;
}

/**
 * Calculate optimal entry point and potential returns
 * Based on current market cap, bonding progress, and market momentum
 */
/**
 * Calculate optimal entry point and potential returns
 * Based on current market cap, bonding progress, and market momentum
 */
function calculateEntryPoint(tokenData, bondingData, holderData, organicScore, isWinningProfile) {
    let score = 5; // Base score
    const riskLevel = holderData.top10HoldersPercent > 30 ? 'HIGH' : 'MEDIUM';
    const signals = [];
    const reasoningParts = [];

    // Price Action Analysis
    const p1h = tokenData.priceChange1h || 0;
    const p5m = tokenData.priceChange5m || 0;
    const buyPressure = tokenData.buyRatio || 50;

    // 1. Trend Detection
    let trend = 'NEUTRAL';
    if (p1h < -10 && p5m < -5) trend = 'DUMPING'; // Falling Knife
    if (p1h < -5 && p5m > 0) trend = 'REVERSAL';   // 1h down, 5m up (Dip buy)
    if (p1h > 10 && p5m > 0) trend = 'PUMPING';   // Strong momentum
    if (p1h > 10 && p5m < -5) trend = 'COOLOFF';  // Pullback after pump

    // 2. Logic Evaluation
    if (trend === 'REVERSAL') {
        score += 3;
        signals.push('Reversal detected (1h red, 5m green)');
        reasoningParts.push('Price is recovering from a dip with short-term strength');
    } else if (trend === 'DUMPING') {
        score -= 10; // Penalize heavily
        signals.push('Warning: Active downtrend');
        reasoningParts.push('Price is currently falling rapidly (Falling Knife)');
    } else if (trend === 'PUMPING') {
        if (buyPressure > 60) {
            score += 2;
            signals.push('Strong momentum continuation');
            reasoningParts.push('Uptrend supported by strong buy volume');
        } else {
            score -= 1;
            signals.push('Price rising on weak volume');
            reasoningParts.push('Caution: Price rising but buy pressure is weak');
        }
    } else if (trend === 'COOLOFF') {
        if (buyPressure > 50) {
            score += 1;
            signals.push('Healthy pullback');
            reasoningParts.push('Price cooling off after a pump, holding support');
        } else {
            score -= 2;
            signals.push('Momentum fading');
        }
    }

    // 3. Buy Pressure Context
    if (buyPressure > 65) {
        score += 2;
        signals.push('High Buy/Sell Ratio (>65%)');
    } else if (buyPressure < 40) {
        score -= 2;
        signals.push('Selling pressure dominates');
    }

    // 4. Bonding Curve Logic
    if (bondingData.progress > 85 && bondingData.progress < 98) {
        score += 3;
        signals.push('GME / Graduation imminent');
        reasoningParts.push('Approaching bonding curve completion');
    }

    // 5. Winning Profile Buffer
    if (isWinningProfile) {
        score += 1;
        signals.push('High-quality holder profile');
    }

    // Determine Verdict
    const currentMcap = tokenData.marketCap || 0;
    let targetMcap = currentMcap;
    const isGraduated = bondingData.isGraduated || tokenData.dexId === 'raydium';
    let verdict = 'WAIT';
    let shouldEnter = false;

    if (score >= 8) {
        verdict = 'ENTER NOW';
        shouldEnter = true;
        targetMcap = currentMcap;
    } else if (score >= 5) {
        verdict = 'WATCH';
        targetMcap = Math.round(currentMcap * 0.9); // Wait for 10% dip
    } else {
        verdict = 'AVOID / WAIT';
        targetMcap = Math.round(currentMcap * 0.7); // Wait for 30% dip
        if (trend === 'DUMPING') verdict = 'WAIT - FALLING';
    }

    // Fallback reasoning
    if (reasoningParts.length === 0) {
        reasoningParts.push(
            buyPressure > 50
                ? 'Market structure is neutral with slight buy leaning.'
                : 'Market structure is neutral/weak. Waiting for clearer signals.'
        );
    }

    // Calculate Invalidation Level (e.g. 20% below current support or MCap)
    const invalidationMcap = Math.round(currentMcap * 0.82);

    return {
        score,
        verdict,
        shouldEnter,
        riskLevel,
        targetMcap: targetMcap,
        invalidationLevel: `$${invalidationMcap.toLocaleString()} MCap`,
        recoveryToAth: isGraduated ? '+300% to ATH' : '+500% to ATH',
        signals,
        reasoning: reasoningParts.join('. ') + '.'
    };
}

/**
 * Check Volume Velocity (The Dead Check)
 */
function checkVolumeVelocity(tokenData) {
    const volume5m = tokenData.volume5m || 0;
    const marketCap = tokenData.marketCap || 1;
    const ratio = (volume5m / marketCap) * 100;

    let status = 'HEALTHY';
    if (ratio < 0.1) status = 'ZOMBIE MODE'; // < 0.1% of MCap in 5m
    else if (ratio < 1) status = 'STALLED';

    return {
        volume5m,
        ratio: ratio.toFixed(2) + '%',
        status
    };
}

/**
 * Analyze Smart Money & Insider (Simulated/Heuristic or Real)
 */
function analyzeSmartMoney(holderData, tokenData, realSniperData) {
    // 1. Smart Money Flow (Mock based on Buy Ratio)
    let smartMoneyFlow = 'Neutral';
    if (tokenData.buyRatio > 60) smartMoneyFlow = '+12.5 SOL (Accumulating)';
    else if (tokenData.buyRatio < 40) smartMoneyFlow = '-8.2 SOL (Distributing)';

    // 2. Sniper Status (Real RPC or Mock)
    let sniperStatus;
    if (realSniperData && !realSniperData.isEstimated && realSniperData.totalSnipers > 0) {
        // Use Real Data
        sniperStatus = {
            label: `Snipers: ${realSniperData.snipersSold}/${realSniperData.totalSnipers} Sold`,
            risk: realSniperData.riskLevel,
            count: realSniperData.snipersSold
        };
    } else {
        // Fallback to Heuristic
        const ageHours = tokenData.ageHours || 0;
        let snipersSold = 0;
        if (ageHours < 1) snipersSold = 1;
        else if (ageHours < 24) snipersSold = 3;
        else snipersSold = 5;

        sniperStatus = {
            label: `Snipers: ${snipersSold}/5 Sold (Est.)`,
            risk: snipersSold < 3 ? 'HIGH' : 'LOW'
        };
    }

    // 3. Insider/Bundle Detection
    const top10 = holderData.top10HoldersPercent;
    let insiderStatus = 'Clean';

    // Use Real Sniper Data for Insider Detection if available
    if (realSniperData && realSniperData.insiderCount !== undefined) {
        if (realSniperData.insiderCount > 0) {
            insiderStatus = `⚠️ ${realSniperData.insiderCount} Insiders (Dev Funded)`;
        } else if (top10 > 50) {
            insiderStatus = 'Cabal Detected (Bundled)';
        }
    } else {
        // Fallback to Heuristic
        if (top10 > 50) insiderStatus = 'Cabal Detected (Bundled)';
        else if (top10 > 30) insiderStatus = 'Insider Activity Likely';
    }

    return {
        smartMoneyFlow,
        sniperStatus,
        insiderStatus
    };
}

/**
 * Check if token is "dead" based on activity metrics
 * Dead = low volume, stagnant price, minimal trades
 */
function checkDeadCoin(tokenData) {
    const marketCap = tokenData.marketCap || 0;
    const volume24h = tokenData.volume24h || 0;
    const priceChange1h = Math.abs(tokenData.priceChange1h || 0);
    const totalTrades = tokenData.totalTrades || 0;
    const ageHours = tokenData.ageHours || 0;

    let deadSignals = [];
    let isDead = false;
    let deathLevel = 'ALIVE';

    // Check for dead signals

    // Market cap under $5K and not moving
    if (marketCap < 5000 && priceChange1h < 5) {
        deadSignals.push('MCap under $5K with no movement');
    }

    // Volume too low relative to market cap
    const volumeToMcap = volume24h / Math.max(marketCap, 1);
    if (volumeToMcap < 0.1 && ageHours > 1) {
        deadSignals.push('Very low trading volume');
    }

    // Minimal trades in 24h (less than 100 for older tokens)
    if (totalTrades < 50 && ageHours > 2) {
        deadSignals.push('Fewer than 50 trades in 24h');
    }

    // Price completely flat (< 1% change in 1 hour)
    if (priceChange1h < 1 && ageHours > 1) {
        deadSignals.push('Price completely stagnant');
    }

    // No buy pressure
    if (tokenData.buyRatio < 40) {
        deadSignals.push('Heavy sell pressure');
    }

    // Determine death level
    if (deadSignals.length >= 4) {
        isDead = true;
        deathLevel = 'DEAD';
    } else if (deadSignals.length >= 2) {
        isDead = false;
        deathLevel = 'DYING';
    } else if (deadSignals.length >= 1) {
        isDead = false;
        deathLevel = 'WEAK';
    } else {
        isDead = false;
        deathLevel = 'ALIVE';
    }

    return {
        isDead,
        deathLevel,
        signals: deadSignals,
        description: isDead
            ? '⚰️ This token appears dead. Avoid investing.'
            : deathLevel === 'DYING'
                ? '⚠️ Token showing signs of dying. High risk.'
                : deathLevel === 'WEAK'
                    ? '📉 Token activity is weak. Monitor closely.'
                    : '✅ Token is active and trading.'
    };
}



/**
 * Check for Active Rug Pull Risks
 */
function checkRugStatus(tokenData, holderData, organicScore) {
    const signals = [];
    let isRugRisk = false;
    let riskLevel = 'LOW';

    // 1. Holder Concentration (Dev/Bundled Wallets)
    if (holderData.top10HoldersPercent > 60) {
        signals.push('Top 10 holders own > 60% of supply (High Centralization)');
        isRugRisk = true;
        riskLevel = 'CRITICAL';
    } else if (holderData.top10HoldersPercent > 30) {
        signals.push('Top 10 holders own > 30% of supply');
        riskLevel = 'HIGH';
    }

    // 2. Liquidity Warnings
    if (tokenData.liquidity > 0 && tokenData.liquidity < 1000 && tokenData.marketCap > 10000) {
        signals.push('Extremely low liquidity relative to Market Cap');
        isRugRisk = true;
        riskLevel = 'HIGH';
    }

    // 3. Wash Trading (Fake Volume to lure buyers)
    if (organicScore < 0.2) {
        signals.push('Artificial Volume Detected (Wash Trading)');
        isRugRisk = true;
    }

    return { isRugRisk, riskLevel, signals };
}

// GET endpoint for simple token data without analysis
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const ca = searchParams.get('ca');

    if (!ca) {
        return NextResponse.json({ error: 'Contract address is required' }, { status: 400 });
    }

    try {
        const { getTokenData } = require('@/lib/dexscreener');
        const tokenData = await getTokenData(ca);

        return NextResponse.json({
            success: true,
            token: tokenData
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

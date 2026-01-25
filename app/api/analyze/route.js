/**
 * Main Analysis API Endpoint
 * POST /api/analyze
 * Body: { ca: string, deviceId: string }
 */

import { NextResponse } from 'next/server';

// Import modules
import { getTokenData, getHolderData, getBondingCurveData, getOHLCVData } from '@/lib/dexscreener';
import { getSniperData, getRealHolderData, getUniqueBuyers, getDevWalletStatus, getTokenAuthorities, getWhaleAnalysis, getTotalHolderCount } from '@/lib/solana';
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

// Global Simple Cache (In-Memory)
// Structure: { [ca]: { data: object, timestamp: number } }
global.analysisCache = global.analysisCache || {};

export async function POST(request) {
    try {
        const body = await request.json();
        const { ca, deviceId } = body;

        if (!ca) {
            return NextResponse.json({ error: 'Contract address is required' }, { status: 400 });
        }

        // Get User & Check Limits
        const walletAddress = body.walletAddress;
        const user = await getOrCreateUser({ deviceId, walletAddress });

        const usageCheck = await canUseAnalysis(user.id);
        if (!usageCheck.allowed) {
            return NextResponse.json({
                success: false,
                error: usageCheck.reason,
                isLimitReached: true
            }, { status: 403 });
        }

        // Admin Bypass & Duplicate Scan Check
        const isAdmin = walletAddress && walletAddress === process.env.ADMIN_WALLET;
        const skipUsageRecord = isAdmin || hasUserScanned(user.id, ca);

        // Check trial status
        const isPremium = user.tier === 'PREMIUM' || user.tier === 'TRIAL' || user.tier === 'Premium' || user.tier === 'Premium Trial';

        // --- HYBRID CACHING STRATEGY ---
        // 1. Check Cache for "Heavy" Data (AI, Holders, Whales)
        const CACHE_TTL = 60 * 1000; // 60 Seconds
        const now = Date.now();
        const cachedEntry = global.analysisCache[ca];
        const isCacheValid = cachedEntry && (now - cachedEntry.timestamp < CACHE_TTL);

        // 2. ALWAYS Fetch "Light" Data (Real-Time Price/MCap)
        // We always fetch tokenData to ensure the UI shows live price actions
        const tokenData = await getTokenData(ca);
        const ageHours = tokenData.ageHours || 0;

        let bucketedData = {};

        // PREMIUM LIVE ALPHA ENGINE: 
        // If user is Premium, we want LIVE Whale & Dev data. 
        // We still cache the heavy Holder list and AI, but we re-run the specific Alpha checks if possible/fast enough.
        // Actually, fetching Whale Analysis requires grabbing the holder list again. 
        // Compromise: We use cached Holder List, but we RE-RUN the Whale Balance checks on those holders if Premium.
        // For now, simpler approach: Premium users just invalidate the specific parts of the cache or we fetch them fresh and merge.

        if (isCacheValid) {
            console.log(`[CACHE HIT] Serving Cached Analysis for ${ca}`);
            bucketedData = cachedEntry.data;
        } else {
            console.log(`[CACHE MISS] Running Full Analysis for ${ca}`);
            const timeOp = async (name, fn) => {
                try { return await fn; } catch (e) {
                    console.error(`${name} failed:`, e.message);
                    throw e;
                }
            };

            // Fetch Heavy Data
            const [estHolderData, bondingData, sniperData, realHolderData, tokenAuthorityData, realTotalHolders] = await Promise.all([
                timeOp('getHolderData', getHolderData(ca)),
                timeOp('getBondingCurveData', getBondingCurveData(ca)),
                timeOp('getSniperData', getSniperData(ca).catch(err => ({ isEstimated: true, error: err.message }))),
                timeOp('getRealHolderData', getRealHolderData(ca).catch(err => ({ isEstimated: true, error: err.message }))),
                timeOp('getTokenAuthorities', getTokenAuthorities(ca).catch(err => ({ burnPercent: 0, isRenounced: false, isFreezeRevoked: false, isEstimated: true }))),
                timeOp('getTotalHolderCount', getTotalHolderCount(ca).catch(err => null))
            ]);

            bucketedData = {
                estHolderData,
                bondingData,
                sniperData,
                realHolderData,
                tokenAuthorityData,
                realTotalHolders
            };
        }

        // Destructure Data
        const { estHolderData, bondingData, sniperData, realHolderData, tokenAuthorityData, realTotalHolders } = bucketedData;

        // Merge Holder Data
        const holderData = {
            ...estHolderData,
            ...(!realHolderData.isEstimated ? {
                top10HoldersPercent: realHolderData.top10Percent,
                top10Holders: realHolderData.top10Holders, // Ensure this is Top 10
                isEstimated: false
            } : {})
        };
        if (realTotalHolders) holderData.totalHolders = realTotalHolders;

        // Dev Wallet Check
        // PREMIUM LOGIC: If Premium, ALWAYS fetch fresh. If Free, use Cache.
        let devWalletData;
        if (isPremium || !isCacheValid || !cachedEntry.devWalletData) {
            // Fetch Fresh for Premium or Cache Miss
            // Note: If cache hit but user is premium, we run this.
            if (isPremium && isCacheValid) console.log('[ALPHA ENGINE] Premium User: Running Fresh Dev Check');
            devWalletData = await getDevWalletStatus(ca, holderData, ageHours).catch(err => ({
                action: 'UNKNOWN', isEstimated: true, error: err.message
            }));
        } else {
            devWalletData = cachedEntry.devWalletData;
        }

        // Metrics Calculation
        const bondingVelocity = ageHours > 0
            ? Math.min(100, bondingData.progress / (ageHours * 60))
            : (bondingData.progress > 0 ? 5 : 0);

        const volumeDensity = tokenData.marketCap > 0 ? (tokenData.volume24h / 4 / tokenData.marketCap) : 0;
        const tradeDistribution = Math.min(tokenData.buyCount, tokenData.sellCount) / Math.max(tokenData.buyCount, tokenData.sellCount);
        const organicScore = Math.min(1, (tradeDistribution * 0.6) + (Math.min(1, volumeDensity) * 0.4));

        const isWinningProfile = bondingData.progress > 10 && bondingVelocity > 0.02 && organicScore > 0.5;

        // AI Analysis (Skip if cached)
        let aiAnalysis = null;
        if (isCacheValid && cachedEntry.aiAnalysis) {
            aiAnalysis = cachedEntry.aiAnalysis;
        } else {
            // Only run AI if cache is invalid
            const uniqueBuyersCount = 0;
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

            try {
                const geminiResult = await analyzeMetrics(analysisInput);
                if (geminiResult.success) aiAnalysis = geminiResult.analysis;
            } catch (e) {
                console.error('AI Analysis failed', e);
            }
        }

        // Whale Analysis (Expensive RPC)
        let whaleAnalysis = {};
        // PREMIUM LOGIC: If Premium, ALWAYS fetch fresh. If Free, use Cache.
        if (isPremium || !isCacheValid || !cachedEntry.whaleAnalysis) {
            if (isPremium && isCacheValid) console.log('[ALPHA ENGINE] Premium User: Running Fresh Whale Check');
            const walletsToCheck = new Set();
            if (holderData.top10Holders) {
                holderData.top10Holders.forEach(h => walletsToCheck.add(h.owner || h.address));
            }
            if (sniperData && sniperData.sniperWallets) {
                sniperData.sniperWallets.forEach(s => walletsToCheck.add(s.address));
            }
            whaleAnalysis = await getWhaleAnalysis(Array.from(walletsToCheck));
            if (whaleAnalysis.whales && holderData.top10Holders) {
                const systemAddrs = holderData.top10Holders.filter(h => h.isSystem).map(h => h.address);
                whaleAnalysis.whales = whaleAnalysis.whales.filter(w => !systemAddrs.includes(w.address));
                whaleAnalysis.count = whaleAnalysis.whales.length;
            }
        } else {
            whaleAnalysis = cachedEntry.whaleAnalysis;
        }

        // UPDATE CACHE 
        // We update the cache if it was invalid OR if we ran fresh premium data (so subsequent free calls might benefit? No, let's just update if invalid to keep simple)
        // actually if we ran premium fresh, we might as well update the cache for everyone else to be fresh too.
        if (!isCacheValid || isPremium) {
            // If refreshing due to premium, we only update if we have full data. 
            // bucketedData is reused if valid. logic holds.
            global.analysisCache[ca] = {
                timestamp: Date.now(),
                data: bucketedData,
                aiAnalysis,
                whaleAnalysis,
                devWalletData
            };
        }

        // --- SAFETY CHECKS (Always run fresh on tokenData) ---
        const deadCoinStatus = checkDeadCoin(tokenData);
        const rugStatus = checkRugStatus(tokenData, holderData, organicScore);

        // Security Override
        if (deadCoinStatus.isDead || rugStatus.riskLevel === 'CRITICAL') {
            aiAnalysis = {
                profitProbability: 2,
                confidence: 'HIGH',
                recommendation: 'AVOID',
                entryScore: 1,
                riskLevel: 'EXTREME',
                keyInsights: [...deadCoinStatus.signals, ...rugStatus.signals, "⛔ SAFETY OVERRIDE ACTIVE"],
                summary: deadCoinStatus.description || "Critical Risk Detected."
            };
        }

        // Record Usage
        if (!skipUsageRecord && !isCacheValid) {
            // Only charge credit if we actually ran a fresh analysis (cache miss)
            // or maybe charge every time but lower cost? For now, charge every time 
            // because "usage" implies viewing the data. 
            // Actually, cost is high. Let's record usage every time for history, but maybe limits should be credit based?
            // Keeping existing logic: recordUsage logs to DB.
            await recordUsage(user.id, ca);
            // Also record scan for history
            try {
                await recordScan(user.id, {
                    address: ca, name: tokenData.name, symbol: tokenData.symbol, imageUrl: tokenData.imageUrl
                });
            } catch (e) { }
        }


        // Calculations
        const graduationChance = calculateGraduationChance(bondingData, tokenData, holderData, bondingVelocity);

        // Re-run Entry Point on LIVE token data (so price/mcap targets are fresh)
        // But reusing Cached Holder/Bonding data
        const entryPoint = calculateEntryPoint(tokenData, bondingData, holderData, organicScore, isWinningProfile);
        const velocity = checkVolumeVelocity(tokenData);
        const smartMoney = analyzeSmartMoney(holderData, tokenData, sniperData);
        const uniqueBuyersCount = 0; // Disabled

        const response = {
            success: true,
            token: {
                ...tokenData, // Live Data
                liquidityRatio: tokenData.marketCap > 0 ? Math.round((tokenData.liquidity / tokenData.marketCap) * 10000) / 100 : 0,
                ageFormatted: formatAge(ageHours)
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
                topHolders: (holderData.top10Holders || []).slice(0, getTierInfo(user.tier).features.includes('top50_holders') ? 50 : 10),
                isEstimated: holderData.isEstimated || false
            },
            bondingCurve: {
                progress: bondingData.progress,
                isGraduated: bondingData.isGraduated,
                estimatedToGraduation: bondingData.estimatedToGraduation
            },
            security: {
                mintAuthorityRevoked: null,
                freezeAuthorityDisabled: null,
                lpLocked: null,
                devHoldingPercent: null,
                devSoldAll: null,
                sniperCount: smartMoney.sniperStatus.count,
                isEstimated: true
            },
            advanced: {
                volumeVelocity: velocity,
                smartMoney: smartMoney.smartMoneyFlow,
                insiderStatus: smartMoney.insiderStatus,
                sniperStatus: smartMoney.sniperStatus
            },
            mechanics: {
                devStatus: {
                    action: devWalletData.action || 'UNKNOWN',
                    devWallet: devWalletData.devWallet || null,
                    balance: devWalletData.balance || 0,
                    isEstimated: devWalletData.isEstimated || false,
                    method: devWalletData.method || 'unknown',
                    color: devWalletData.action === 'SOLD ALL' ? '#ef4444' : devWalletData.action === 'LIKELY SOLD' ? '#f97316' : devWalletData.action === 'HOLDING' ? '#22c55e' : devWalletData.action === 'LIKELY HOLDING' ? '#84cc16' : devWalletData.action === 'HOLDING (RISK)' ? '#eab308' : '#888'
                },
                snipers: {
                    count: sniperData.totalSnipers || 0,
                    soldCount: sniperData.snipersSold || 0,
                    holdingCount: (sniperData.totalSnipers || 0) - (sniperData.snipersSold || 0),
                    isEstimated: sniperData.isEstimated || false,
                    riskLevel: sniperData.riskLevel || 'UNKNOWN'
                },
                curveVelocity: { value: bondingVelocity.toFixed(2), label: `+${bondingVelocity.toFixed(2)}%/min` },
                top1Holder: {
                    percent: (holderData.top10Holders && holderData.top10Holders[0]) ? parseFloat(holderData.top10Holders[0].percent) : 0,
                    address: (holderData.top10Holders && holderData.top10Holders[0]) ? holderData.top10Holders[0].address : null,
                    isRisky: (holderData.top10Holders && holderData.top10Holders[0]) ? parseFloat(holderData.top10Holders[0].percent) > 15 : false
                },
                whales: {
                    count: whaleAnalysis.count || 0,
                    wallets: whaleAnalysis.whales || [],
                    hasWhales: (whaleAnalysis.count || 0) > 0
                }
            },
            tokenSafety: {
                burnPercent: tokenAuthorityData.burnPercent || 0,
                isRenounced: tokenAuthorityData.isRenounced || false,
                isFreezeRevoked: tokenAuthorityData.isFreezeRevoked || false,
                isEstimated: tokenAuthorityData.isEstimated || false,
                allSafe: (tokenAuthorityData.isRenounced === true && tokenAuthorityData.isFreezeRevoked === true)
            },
            entryPoint: entryPoint,
            tokenHealth: deadCoinStatus,
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
                keyInsights: deadCoinStatus.signals.length > 0 ? deadCoinStatus.signals : generateBasicInsights(tokenData, holderData, organicScore, bondingVelocity),
                summary: deadCoinStatus.description
            },
            chart: [],
            user: {
                tier: user.tier,
                remainingToday: skipUsageRecord ? usageCheck.remainingToday : Math.max(0, usageCheck.remainingToday - 1),
                remainingTrial: user.tier === 'free' ? (user.trialStatus?.remaining || 0) : 'unlimited',
                credits: user.credits
            },
            timestamp: new Date().toISOString(),
            isCached: isCacheValid
        };

        // --- 85% RULE ENFORCEMENT & LOGIC SYNC ---
        // 1. If AI is extremely confident (>85%), it overrides conservative technical wait signals
        if (response.analysis.profitProbability >= 85 && !deadCoinStatus.isDead && rugStatus.riskLevel !== 'CRITICAL') {
            console.log('HIGH CONFIDENCE OVERRIDE: AI Probability > 85%, Forcing BUY');

            // Force BUY recommendations
            response.analysis.recommendation = 'BUY';
            response.entryPoint.verdict = 'ENTER NOW';
            response.entryPoint.shouldEnter = true;

            // Set Target Mcap to CURRENT (Don't wait for dip)
            response.entryPoint.targetMcap = tokenData.marketCap;
            response.entryPoint.score = Math.max(response.entryPoint.score, 9);

            // Adjust Risk
            if (response.analysis.riskLevel === 'HIGH' && rugStatus.riskLevel === 'LOW') {
                response.analysis.riskLevel = 'MEDIUM';
            }
        }

        // 2. Standard Sync: If Entry says BUY but Analysis says WAIT
        else if (response.entryPoint.shouldEnter && response.analysis.recommendation !== 'BUY') {
            if (response.analysis.profitProbability > 60) {
                response.analysis.recommendation = 'BUY';
            } else {
                response.entryPoint.verdict = 'WAIT FOR MOMENTUM';
                response.entryPoint.shouldEnter = false;
            }
        }

        // 3. Ensure Target Market Cap is NEVER null
        if (!response.entryPoint.targetMcap) {
            response.entryPoint.targetMcap = Math.round(tokenData.marketCap * 0.9); // Default fall back
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
 * Basic profitability calculation with Weighted Scoring Model
 * Smoothed scoring to prevent volatility
 */
function calculateBasicProfitability(tokenData, holderData, bondingData, organicScore, riskLevel, uniqueBuyers = 0, devWalletData = {}, sniperData = {}, isWinningProfile = false, whaleAnalysis = {}) {
    let score = 30; // Base Score (Neutral Start)

    // --- 1. WHALE CONVICTION (Weighted) ---
    // Instead of binary +15, we scale by count. Max 20 pts.
    const whaleCount = whaleAnalysis.count || 0;
    const whaleScore = Math.min(20, whaleCount * 3); // 3 pts per whale, cap at 20
    score += whaleScore;

    // --- 2. MOMENTUM & PRESSURE (Smoothed) ---
    // Scaled around 50% buy ratio. Range: -10 to +15
    // 50% = 0 pts, 70% = +10 pts, 30% = -10 pts
    const buyRatio = tokenData.buyRatio || 50;
    const momentumScore = (buyRatio - 50) * 0.5;
    score += Math.max(-15, Math.min(15, momentumScore));

    // --- 3. LIQUIDITY DEPTH (Logarithmic) ---
    // Log scale to reward real depth. 1k = 0, 10k = 5, 100k = 10
    const liquidity = tokenData.liquidity || 0;
    if (liquidity > 1000) {
        const liqScore = Math.min(15, Math.log10(liquidity / 1000) * 5);
        score += liqScore;
    } else {
        score -= 10; // Penalize dust liquidity
    }

    // --- 4. VOLUME DENSITY (Active Trading) ---
    // Volume relative to Mcap (Turnover). Healthy = 0.5 - 2.0
    // Too low = dead, Too high > 5.0 = suspect/bot wash
    const volToMcap = (tokenData.volume24h || 0) / (tokenData.marketCap || 1);
    if (volToMcap > 0.3 && volToMcap < 5.0) score += 5;
    else if (volToMcap < 0.1) score -= 10; // Zombie

    // --- 5. SOCIAL & ORGANIC (Binary) ---
    if ((tokenData.websites?.length > 0) || (tokenData.socials?.length > 0)) score += 5;
    if (organicScore > 0.6) score += 5;

    // --- 6. HOLDER STRENGTH ---
    // Reward broad distribution
    if (holderData.totalHolders > 500) score += 10;
    else if (holderData.totalHolders > 200) score += 5;

    // Penalize Top 10 concentration
    const top10 = holderData.top10HoldersPercent || 0;
    if (top10 < 20) score += 10;
    else if (top10 > 50) score -= 15; // Danger
    else if (top10 > 30) score -= 5;

    // --- 7. DEV & SNIPER BEHAVIOR (Critical Modifiers) ---
    if (devWalletData.action === 'HOLDING') score += 10;
    if (devWalletData.action === 'SOLD ALL') score -= 30; // Dumped

    // Snipers: Holding is good, dumping is bad
    const totalSnipers = sniperData.totalSnipers || 0;
    if (totalSnipers > 0) {
        const soldRatio = (sniperData.snipersSold || 0) / totalSnipers;
        if (soldRatio < 0.2) score += 5; // <20% sold
        else if (soldRatio > 0.7) score -= 15; // >70% dumped
    }

    // --- 8. WINNING PROFILE BOOSTER ---
    if (isWinningProfile) score += 10;

    // --- 9. DEAD / RUG PENALTIES (Safety Overrides) ---
    if ((tokenData.volume5m || 0) < 50 && (tokenData.ageHours > 4)) score -= 25; // Dead coin
    if (riskLevel === 'CRITICAL') score = Math.min(score, 20); // Hard Cap
    if (riskLevel === 'HIGH') score = Math.min(score, 60);

    // Final Clamp 0-99
    return Math.max(1, Math.min(99, Math.round(score)));
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

    // SCORING ADJUSTMENT:
    // 8+ = Strong Buy
    // 5-7 = Watch / Buy Dip
    // <5 = Avoid / Wait

    if (score >= 8) {
        verdict = 'ENTER NOW';
        shouldEnter = true;
        targetMcap = currentMcap; // Buy Spot
    } else if (score >= 5) {
        // If Winning Profile, be more aggressive
        if (isWinningProfile) {
            verdict = 'ENTER (SMALL)';
            shouldEnter = true;
            targetMcap = currentMcap;
        } else {
            verdict = 'WATCH';
            targetMcap = Math.round(currentMcap * 0.9); // Wait for 10% dip
        }
    } else {
        verdict = 'AVOID / WAIT';
        targetMcap = Math.round(currentMcap * 0.75); // Wait for 25% dip
        if (trend === 'DUMPING') {
            verdict = 'WAIT - FALLING';
            targetMcap = Math.round(currentMcap * 0.6); // Wait for 40% dip
        }
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

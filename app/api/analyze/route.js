/**
 * Main Analysis API Endpoint
 * POST /api/analyze
 * Body: { ca: string, deviceId: string }
 */

import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { ca, deviceId } = body;

        if (!ca) {
            return NextResponse.json({ error: 'Contract address is required' }, { status: 400 });
        }

        // Import modules dynamically for server-side only
        // Using DexScreener for live data (no API key required!)
        const { getTokenData, getHolderData, getBondingCurveData, getOHLCVData } = require('@/lib/dexscreener');
        const { analyzeMetrics } = require('@/lib/gemini');
        const { getOrCreateUser, canUseAnalysis, recordUsage, getTierInfo } = require('@/lib/db');

        // Get or create user
        const user = getOrCreateUser({ deviceId });

        // Check usage limits
        const usageCheck = canUseAnalysis(user.id);
        if (!usageCheck.allowed) {
            return NextResponse.json({
                error: 'Usage limit reached',
                message: usageCheck.reason,
                remainingToday: usageCheck.remainingToday,
                tier: user.tier
            }, { status: 429 });
        }

        // Fetch all data in parallel
        const [tokenData, holderData, bondingData, ohlcvData] = await Promise.all([
            getTokenData(ca),
            getHolderData(ca),
            getBondingCurveData(ca),
            getOHLCVData(ca, '15m')
        ]);

        // Calculate additional metrics
        const ageHours = tokenData.ageHours || 0;

        // Prepare data for AI analysis
        const analysisInput = {
            ...tokenData,
            holders: holderData.totalHolders,
            top10HoldersPercent: holderData.top10HoldersPercent,
            bondingProgress: bondingData.progress,
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
                console.log('AI analysis successful');
            } else {
                console.log('Gemini returned success=false:', geminiResult.error);
            }
        } catch (error) {
            console.error('AI analysis failed:', error.message, error.stack);
            // Continue without AI analysis
        }

        // Record usage
        recordUsage(user.id, ca);

        // Calculate graduation chance based on bonding curve and momentum
        const graduationChance = calculateGraduationChance(bondingData, tokenData, holderData);

        // Build response
        const response = {
            success: true,
            token: {
                name: tokenData.name,
                symbol: tokenData.symbol,
                address: ca,
                price: tokenData.price,
                marketCap: tokenData.marketCap,
                volume24h: tokenData.volume24h,
                priceChange24h: tokenData.priceChange24h || 0
            },
            metrics: {
                buyCount: tokenData.buyCount,
                sellCount: tokenData.sellCount,
                buyRatio: tokenData.buyRatio,
                totalTrades: tokenData.totalTrades
            },
            holders: {
                total: holderData.totalHolders,
                top10Percent: holderData.top10HoldersPercent,
                distribution: holderData.holderDistribution,
                topHolders: holderData.top10Holders.slice(0, getTierInfo(user.tier).features.includes('top50_holders') ? 50 : 5)
            },
            bondingCurve: {
                progress: bondingData.progress,
                isGraduated: bondingData.isGraduated,
                estimatedToGraduation: bondingData.estimatedToGraduation
            },
            analysis: aiAnalysis ? {
                profitProbability: aiAnalysis.profitProbability,
                confidence: aiAnalysis.confidence,
                recommendation: aiAnalysis.recommendation,
                entryScore: aiAnalysis.entryScore,
                riskLevel: aiAnalysis.riskLevel,
                graduationChance: graduationChance,
                keyInsights: aiAnalysis.keyInsights || [],
                summary: aiAnalysis.summary
            } : {
                profitProbability: calculateBasicProfitability(tokenData, holderData, bondingData),
                confidence: 'MEDIUM',
                recommendation: 'WAIT',
                entryScore: 5,
                riskLevel: 'HIGH',
                graduationChance: graduationChance,
                keyInsights: ['AI analysis unavailable - showing basic metrics'],
                summary: 'Basic analysis based on on-chain metrics.'
            },
            chart: ohlcvData,
            user: {
                tier: user.tier,
                remainingToday: usageCheck.remainingToday - 1,
                credits: user.credits
            },
            timestamp: new Date().toISOString()
        };

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
function calculateGraduationChance(bondingData, tokenData, holderData) {
    let score = 0;

    // Bonding progress (40% weight)
    score += (bondingData.progress / 100) * 40;

    // Holder count momentum (20% weight)
    if (holderData.totalHolders > 500) score += 20;
    else if (holderData.totalHolders > 200) score += 15;
    else if (holderData.totalHolders > 100) score += 10;
    else score += 5;

    // Buy ratio (20% weight)
    if (tokenData.buyRatio > 60) score += 20;
    else if (tokenData.buyRatio > 50) score += 15;
    else score += 5;

    // Holder distribution (20% weight) - lower top10 is better
    if (holderData.top10HoldersPercent < 30) score += 20;
    else if (holderData.top10HoldersPercent < 50) score += 15;
    else score += 5;

    return Math.min(Math.round(score), 100);
}

/**
 * Basic profitability calculation when AI is unavailable
 */
function calculateBasicProfitability(tokenData, holderData, bondingData) {
    let score = 50; // Start neutral

    // Buy ratio influence
    score += (tokenData.buyRatio - 50) * 0.3;

    // Holder distribution (too concentrated is bad)
    if (holderData.top10HoldersPercent > 60) score -= 15;
    else if (holderData.top10HoldersPercent < 30) score += 10;

    // Bonding progress (higher is generally positive)
    score += (bondingData.progress / 100) * 10;

    // Volume matters
    if (tokenData.volume24h > 100000) score += 10;
    else if (tokenData.volume24h > 50000) score += 5;

    return Math.min(Math.max(Math.round(score), 10), 90);
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

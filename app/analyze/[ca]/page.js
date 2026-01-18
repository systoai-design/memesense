'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import styles from './page.module.css';
import ProfitabilityGauge from '@/components/ProfitabilityGauge';
import MetricsCard from '@/components/MetricsCard';

export default function AnalyzePage() {
    const { ca } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Fetch analysis data
    const fetchAnalysis = useCallback(async (isRefresh = false) => {
        try {
            if (!isRefresh) {
                setLoading(true);
            } else {
                setIsRefreshing(true);
            }
            setError(null);

            // Get device ID for tracking
            let deviceId = localStorage.getItem('memesense_device_id');
            if (!deviceId) {
                deviceId = crypto.randomUUID();
                localStorage.setItem('memesense_device_id', deviceId);
            }

            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ca, deviceId })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || result.error || 'Analysis failed');
            }

            setData(result);
            setLastUpdated(new Date());
        } catch (err) {
            if (!isRefresh) {
                setError(err.message);
            }
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [ca]);

    // Initial fetch
    useEffect(() => {
        if (ca) {
            fetchAnalysis(false);
        }
    }, [ca, fetchAnalysis]);

    // Auto-refresh every 10 seconds
    useEffect(() => {
        if (!ca || loading) return;

        const interval = setInterval(() => {
            fetchAnalysis(true);
        }, 10000); // Refresh every 10 seconds

        return () => clearInterval(interval);
    }, [ca, loading, fetchAnalysis]);

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingState}>
                    <div className={styles.loadingContent}>
                        <div className="spinner" style={{ width: 60, height: 60 }}></div>
                        <h2>Analyzing Token...</h2>
                        <p>Fetching on-chain data and running AI analysis</p>
                        <div className={styles.loadingSteps}>
                            <div className={styles.step}>
                                <span className={styles.stepIcon}>📊</span>
                                <span>Fetching market data...</span>
                            </div>
                            <div className={styles.step}>
                                <span className={styles.stepIcon}>👥</span>
                                <span>Analyzing holder distribution...</span>
                            </div>
                            <div className={styles.step}>
                                <span className={styles.stepIcon}>🤖</span>
                                <span>Running AI prediction model...</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.errorState}>
                    <div className={styles.errorContent}>
                        <span className={styles.errorIcon}>⚠️</span>
                        <h2>Analysis Failed</h2>
                        <p>{error}</p>
                        <a href="/" className="btn btn-primary">
                            Try Another Token
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const { token, metrics, holders, bondingCurve, analysis, user } = data;

    // Determine recommendation color
    const getRecommendationClass = (rec) => {
        switch (rec) {
            case 'BUY': return styles.recBuy;
            case 'AVOID': return styles.recAvoid;
            default: return styles.recWait;
        }
    };

    const getRiskClass = (risk) => {
        switch (risk) {
            case 'LOW': return styles.riskLow;
            case 'MEDIUM': return styles.riskMedium;
            case 'HIGH': return styles.riskHigh;
            default: return styles.riskExtreme;
        }
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <a href="/" className={styles.backLink}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back
                </a>
                <div className={styles.liveIndicator}>
                    {isRefreshing ? (
                        <span className={styles.refreshing}>
                            <span className={styles.refreshDot}></span>
                            Updating...
                        </span>
                    ) : (
                        <span className={styles.live}>
                            <span className={styles.liveDot}></span>
                            LIVE
                        </span>
                    )}
                    {lastUpdated && (
                        <span className={styles.lastUpdated}>
                            Updated {lastUpdated.toLocaleTimeString()}
                        </span>
                    )}
                </div>
                <div className={styles.userBadge}>
                    <span className={`badge ${user.tier === 'PREMIUM' ? 'badge-premium' : 'badge-info'}`}>
                        {user.tier}
                    </span>
                    {user.remainingToday >= 0 && (
                        <span className={styles.remaining}>
                            {user.remainingToday} analyses left today
                        </span>
                    )}
                </div>
            </header>

            {/* Token Info */}
            <section className={styles.tokenHeader}>
                <div className={styles.tokenInfo}>
                    <h1 className={styles.tokenName}>
                        {token.name}
                        <span className={styles.tokenSymbol}>${token.symbol}</span>
                    </h1>
                    <div className={styles.tokenAddress}>
                        <code>{ca.slice(0, 8)}...{ca.slice(-6)}</code>
                        <button
                            className={styles.copyBtn}
                            onClick={() => navigator.clipboard.writeText(ca)}
                            title="Copy address"
                        >
                            📋
                        </button>
                    </div>
                </div>
                <div className={styles.priceInfo}>
                    <div className={styles.price}>
                        ${token.marketCap?.toLocaleString() || '0'}
                        <span className={styles.priceLabel}>Market Cap</span>
                    </div>
                    <div className={`${styles.priceChange} ${token.priceChange24h >= 0 ? styles.positive : styles.negative}`}>
                        {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h?.toFixed(2) || 0}%
                    </div>
                </div>
            </section>

            {/* Main Analysis Grid */}
            <div className={styles.analysisGrid}>
                {/* Left Column - Profitability */}
                <section className={`card ${styles.profitCard}`}>
                    <h2>Profit Probability</h2>
                    <ProfitabilityGauge
                        value={analysis.profitProbability}
                        recommendation={analysis.recommendation}
                    />
                    <div className={styles.verdict}>
                        <div className={`${styles.recommendation} ${getRecommendationClass(analysis.recommendation)}`}>
                            {analysis.recommendation}
                        </div>
                        <div className={styles.confidence}>
                            Confidence: <strong>{analysis.confidence}</strong>
                        </div>
                    </div>
                    <div className={`${styles.riskBadge} ${getRiskClass(analysis.riskLevel)}`}>
                        Risk Level: {analysis.riskLevel}
                    </div>
                </section>

                {/* Center Column - Metrics */}
                <section className={styles.metricsSection}>
                    <h2>Key Metrics</h2>
                    <div className={styles.metricsGrid}>
                        <MetricsCard
                            label="Holders"
                            value={holders.total?.toLocaleString() || '0'}
                            icon="👥"
                            trend={holders.total > 200 ? 'up' : null}
                        />
                        <MetricsCard
                            label="Buy Ratio"
                            value={`${metrics.buyRatio}%`}
                            icon="📈"
                            trend={metrics.buyRatio > 55 ? 'up' : metrics.buyRatio < 45 ? 'down' : null}
                            color={metrics.buyRatio > 55 ? 'green' : metrics.buyRatio < 45 ? 'red' : null}
                        />
                        <MetricsCard
                            label="24h Volume"
                            value={`$${(token.volume24h / 1000).toFixed(1)}K`}
                            icon="💰"
                        />
                        <MetricsCard
                            label="Entry Score"
                            value={`${analysis.entryScore}/10`}
                            icon="🎯"
                            color={analysis.entryScore >= 7 ? 'green' : analysis.entryScore < 4 ? 'red' : null}
                        />
                    </div>

                    {/* Buy/Sell Bar */}
                    <div className={styles.buySellBar}>
                        <div className={styles.barLabel}>
                            <span className={styles.buyLabel}>Buys ({metrics.buyCount})</span>
                            <span className={styles.sellLabel}>Sells ({metrics.sellCount})</span>
                        </div>
                        <div className={styles.bar}>
                            <div
                                className={styles.buyFill}
                                style={{ width: `${metrics.buyRatio}%` }}
                            ></div>
                        </div>
                    </div>
                </section>

                {/* Right Column - Bonding & Holders */}
                <section className={`card ${styles.bondingCard}`}>
                    <h2>Bonding Curve</h2>
                    <div className={styles.bondingProgress}>
                        <div className={styles.progressCircle}>
                            <svg viewBox="0 0 100 100">
                                <circle
                                    className={styles.progressBg}
                                    cx="50" cy="50" r="45"
                                    fill="none"
                                    strokeWidth="8"
                                />
                                <circle
                                    className={styles.progressFill}
                                    cx="50" cy="50" r="45"
                                    fill="none"
                                    strokeWidth="8"
                                    strokeDasharray={`${bondingCurve.progress * 2.83} 283`}
                                    transform="rotate(-90 50 50)"
                                />
                            </svg>
                            <div className={styles.progressValue}>
                                {bondingCurve.progress.toFixed(1)}%
                            </div>
                        </div>
                        <div className={styles.bondingInfo}>
                            {bondingCurve.isGraduated ? (
                                <span className="badge badge-success">🎓 GRADUATED</span>
                            ) : (
                                <>
                                    <p className={styles.toGraduation}>
                                        ${(bondingCurve.estimatedToGraduation / 1000).toFixed(1)}K to graduation
                                    </p>
                                    <p className={styles.graduationChance}>
                                        Graduation Chance: <strong>{analysis.graduationChance}%</strong>
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    <div className={styles.holderDist}>
                        <h3>Top 10 Holders</h3>
                        <div className={styles.holderBar}>
                            <div className={styles.holderFill} style={{ width: `${holders.top10Percent}%` }}></div>
                        </div>
                        <p className={styles.holderPercent}>
                            {holders.top10Percent.toFixed(1)}% of supply
                            {holders.top10Percent > 50 && (
                                <span className={styles.warning}>⚠️ High concentration</span>
                            )}
                        </p>
                    </div>
                </section>
            </div>

            {/* AI Insights */}
            <section className={`card ${styles.insightsCard}`}>
                <h2>🤖 AI Analysis</h2>
                <p className={styles.summary}>{analysis.summary}</p>
                <div className={styles.insights}>
                    <h3>Key Signals</h3>
                    <ul>
                        {analysis.keyInsights?.map((insight, i) => (
                            <li key={i}>
                                <span className={styles.insightBullet}>→</span>
                                {insight}
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* Footer */}
            <footer className={styles.footer}>
                <p>
                    Analysis generated at {new Date(data.timestamp).toLocaleTimeString()}
                    <span className={styles.disclaimer}>
                        · Not financial advice. Trade at your own risk.
                    </span>
                </p>
            </footer>
        </div>
    );
}

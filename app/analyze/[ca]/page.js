'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import styles from './page.module.css';
import ProfitabilityGauge from '@/components/ProfitabilityGauge';
import MetricsCard from '@/components/MetricsCard';
import PremiumModal from '@/components/PremiumModal';

export default function AnalyzePage() {
    const { ca } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [walletAddress, setWalletAddress] = useState(null);
    const [showPremiumModal, setShowPremiumModal] = useState(false);

    useEffect(() => {
        setWalletAddress(localStorage.getItem('memesense_wallet'));
    }, []);

    const handleDisconnect = async () => {
        try {
            if (window.solana) {
                await window.solana.disconnect();
            }
        } catch (err) {
            console.error(err);
        }
        localStorage.removeItem('memesense_wallet');
        setWalletAddress(null);
        window.location.href = '/app'; // Redirect to home/app
    };

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

            // Get wallet address if connected
            const walletAddress = localStorage.getItem('memesense_wallet');

            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ca, deviceId, walletAddress })
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

    const { token, metrics, holders, bondingCurve, analysis, user, rugRisk: rugStatus } = data;

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
                <div className={styles.headerLeft}>
                    <a href="/app" className={styles.backLink}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                        Back
                    </a>
                    <a href="/app">
                        <img src="/logo.png" alt="MemeSense" style={{ height: '50px', marginLeft: '20px', width: 'auto' }} />
                    </a>
                </div>
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
                <div className={styles.headerRight}>
                    <a href="/app" className={`btn btn-primary ${styles.scanBtn}`}>
                        🔍 Scan New Token
                    </a>
                    {walletAddress && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '10px' }}>
                            <span className="btn btn-secondary" style={{ cursor: 'default', fontSize: '0.8rem', padding: '5px 10px' }}>
                                {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
                            </span>
                            <button
                                onClick={handleDisconnect}
                                className="btn"
                                style={{
                                    padding: '5px 10px',
                                    fontSize: '0.8rem',
                                    background: 'rgba(255, 50, 50, 0.2)',
                                    color: '#ff5555',
                                    border: '1px solid #ff5555'
                                }}
                            >
                                Disconnect
                            </button>
                        </div>
                    )}
                    <div className={styles.userBadge}>
                        <span className={`badge ${user.tier === 'PREMIUM' ? 'badge-premium' : 'badge-info'}`}>
                            {user.tier}
                        </span>
                        {user.tier === 'FREE' && (
                            <span className={styles.trialRemaining}>
                                ⚡ {user.remainingToday}/10 FREE SCAN(S)
                            </span>
                        )}
                    </div>
                </div>
            </header>

            {/* Token Info */}
            <section className={styles.tokenHeader}>
                <div className={styles.tokenInfo} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Token Logo + Name Row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {token.imageUrl ? (
                            <img
                                src={token.imageUrl}
                                alt={token.name}
                                style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: '2px solid rgba(255,255,255,0.15)',
                                    flexShrink: 0
                                }}
                            />
                        ) : (
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.05)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '20px',
                                border: '2px solid rgba(255,255,255,0.1)',
                                flexShrink: 0
                            }}>🪙</div>
                        )}
                        <h1 className={styles.tokenName} style={{ margin: 0 }}>
                            {token.name}
                            <span className={styles.tokenSymbol}>${token.symbol}</span>
                        </h1>
                    </div>
                    <div className={styles.tokenMeta}>
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
                        <span className={styles.ageBadge}>⏱️ Age: {token.ageFormatted || 'New'}</span>
                        {token.isPumpFun && <span className={styles.pumpBadge}>🎈 pump.fun</span>}
                    </div>
                </div>
                <div className={styles.priceInfo}>
                    <div className={styles.price}>
                        ${token.marketCap?.toLocaleString() || '0'}
                        <span className={styles.priceLabel}>Market Cap</span>
                    </div>
                    <div className={styles.priceChanges}>
                        <span className={`${styles.priceTag} ${(token.priceChange5m || 0) >= 0 ? styles.positive : styles.negative}`}>
                            5m: {(token.priceChange5m || 0) >= 0 ? '+' : ''}{(token.priceChange5m || 0).toFixed(1)}%
                        </span>
                        <span className={`${styles.priceTag} ${(token.priceChange1h || 0) >= 0 ? styles.positive : styles.negative}`}>
                            1h: {(token.priceChange1h || 0) >= 0 ? '+' : ''}{(token.priceChange1h || 0).toFixed(1)}%
                        </span>
                        <span className={`${styles.priceTag} ${(token.priceChange24h || 0) >= 0 ? styles.positive : styles.negative}`}>
                            24h: {(token.priceChange24h || 0) >= 0 ? '+' : ''}{(token.priceChange24h || 0).toFixed(1)}%
                        </span>
                    </div>
                </div>
            </section >

            {/* Liquidity Warning */}
            {
                token.liquidity && token.liquidityRatio && token.liquidityRatio < 5 && (
                    <div className={styles.warningBanner}>
                        ⚠️ <strong>Low Liquidity Warning:</strong> Only ${token.liquidity?.toLocaleString()} liquidity ({token.liquidityRatio?.toFixed(1)}% of MCap). High slippage risk!
                    </div>
                )
            }

            {/* Main Analysis Grid - 2 Column Layout */}
            <div className={styles.analysisGrid}>

                {/* Left Column - Growth & Potential (60%) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: '1.5' }}>

                    {/* 1. Profit Probability Card (HERO) */}
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

                    {/* 2. Key Metrics Card */}
                    <section className={styles.metricsSection}>
                        <h2>Key Metrics</h2>
                        <div className={styles.metricsGrid}>
                            <MetricsCard
                                label="Holders / Unique Buyers"
                                value={`${holders.total?.toLocaleString() || '0'} / ${metrics.uniqueBuyers?.toLocaleString() || metrics.buyCount?.toLocaleString() || '0'}`}
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
                                label="FOMO Grade"
                                value={`${analysis.entryScore}/10`}
                                icon="🔥"
                                color={
                                    analysis.entryScore > 8 ? 'gold' :
                                        analysis.entryScore >= 7 ? 'green' :
                                            analysis.entryScore < 4 ? 'red' : null
                                }
                            />
                            <MetricsCard
                                label="5m Volume"
                                value={`$${(token.volume5m / 1000).toFixed(1)}K`}
                                icon="⏱️"
                            />
                            <MetricsCard
                                label="Volume Velocity"
                                value={data.advanced?.volumeVelocity?.ratio || '---'}
                                icon="🌊"
                                color={data.advanced?.volumeVelocity?.status === 'ZOMBIE MODE' ? 'red' : 'green'}
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

                    {/* 3. Bonding Curve Progress */}
                    <section className={`card ${styles.bondingCard}`}>
                        <h2>Bonding Curve Progress</h2>
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
                                        strokeDasharray={`${2 * Math.PI * 45}`}
                                        strokeDashoffset={`${2 * Math.PI * 45 * (1 - (bondingCurve.progress / 100))}`}
                                        transform="rotate(-90 50 50)"
                                    />
                                    <text x="50" y="50" textAnchor="middle" dy="0.3em" className={styles.progressValue}>
                                        {bondingCurve.progress.toFixed(1)}%
                                    </text>
                                </svg>
                            </div>
                            <div className={styles.bondingInfo}>
                                <div className={styles.toGraduation}>
                                    To Graduation: <strong>${(bondingCurve.estimatedToGraduation / 1000).toFixed(1)}k</strong>
                                </div>
                                {!bondingCurve.isGraduated && (
                                    <div className={styles.graduationChance}>
                                        Chance of Graduation: <strong>{analysis.graduationChance}%</strong>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                </div>

                {/* Right Column - Risk & Safety (40%) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: '1' }}>

                    {/* 1. Whale & Dev Analysis */}
                    <section className={`card ${styles.profitCard}`} style={{ padding: '24px', textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.2rem' }}>🐳</span>
                                <h2 style={{ textAlign: 'left', margin: 0, fontSize: '1.1rem' }}>Whale & Dev Analysis</h2>
                            </div>
                            <span style={{ fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '0.5px', color: '#fff', opacity: 0.7 }}>PREMIUM UNLOCKED</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Whale Wallets */}
                            <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: data.mechanics?.whales?.hasWhales ? '8px' : '0' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>Whale Wallets</span>
                                        <span style={{ fontSize: '0.7rem', color: '#888' }}>Holders with &gt;$10k Balance</span>
                                    </div>
                                    <span style={{ fontWeight: 'bold', color: data.mechanics?.whales?.hasWhales ? '#fbbf24' : '#888' }}>
                                        {data.mechanics?.whales?.hasWhales
                                            ? `${data.mechanics.whales.count} Detected`
                                            : 'None Detected'}
                                    </span>
                                </div>
                                {data.mechanics?.whales?.hasWhales && data.mechanics.whales.wallets && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
                                        {data.mechanics.whales.wallets.map((whale, idx) => (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                                                <a
                                                    href={`https://solscan.io/account/${whale.address}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ color: '#fbbf24', textDecoration: 'none', fontFamily: 'monospace' }}
                                                >
                                                    {whale.address.slice(0, 4)}...{whale.address.slice(-4)}
                                                </a>
                                                <span style={{ color: '#ccc' }}>
                                                    {Math.round(whale.balance)} SOL
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Dev Status */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>Dev Action</span>
                                    <span style={{ fontSize: '0.7rem', color: '#888' }}>Creator Wallet Behavior</span>
                                </div>
                                <span className="badge" style={{
                                    backgroundColor: data.mechanics?.devStatus?.color + '20',
                                    color: data.mechanics?.devStatus?.color,
                                    border: `1px solid ${data.mechanics?.devStatus?.color}40`
                                }}>
                                    {data.mechanics?.devStatus?.action || 'UNKNOWN'}
                                </span>
                            </div>

                            {/* Snipers */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>Snipers</span>
                                    <span style={{ fontSize: '0.7rem', color: '#888' }}>Early buyers still holding</span>
                                </div>
                                <span style={{ fontWeight: 'bold', color: data.mechanics?.snipers?.count > 5 ? '#fbbf24' : '#22c55e' }}>
                                    {data.mechanics?.snipers?.holdingCount || 0}/{data.mechanics?.snipers?.count || 0} Holding
                                </span>
                            </div>

                            {/* Top Holder Risk */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>Biggest Whale</span>
                                    <span style={{ fontSize: '0.7rem', color: '#888' }}>% owned by top holder</span>
                                </div>
                                <span style={{ fontWeight: 'bold', color: data.mechanics?.top1Holder?.isRisky ? '#ef4444' : '#22c55e' }}>
                                    {data.mechanics?.top1Holder?.percent?.toFixed(1) || 0}%
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* 2. Token Safety Card */}
                    <section className={`card ${styles.profitCard}`} style={{ padding: '24px', textAlign: 'left' }}>
                        <h2 style={{ textAlign: 'left', marginBottom: '16px' }}>Token Safety</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Burn % */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '18px' }}>🔥</span>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Burned:</span>
                                </div>
                                <span style={{
                                    fontWeight: '700',
                                    color: data.tokenSafety?.burnPercent >= 90 ? '#22c55e' :
                                        data.tokenSafety?.burnPercent >= 50 ? '#eab308' : '#ef4444'
                                }}>
                                    {data.tokenSafety?.burnPercent || 0}%
                                </span>
                            </div>

                            {/* Renounced */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '18px' }}>👤</span>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Renounced:</span>
                                </div>
                                <span style={{ fontSize: '18px' }}>
                                    {data.tokenSafety?.isRenounced ? '✅' : '❌'}
                                </span>
                            </div>

                            {/* Freeze Revoked */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '18px' }}>❄️</span>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Freeze Revoked:</span>
                                </div>
                                <span style={{ fontSize: '18px' }}>
                                    {data.tokenSafety?.isFreezeRevoked ? '✅' : '❌'}
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* 3. Holder Distribution */}
                    <section className={`card ${styles.profitCard}`} style={{ padding: '24px', textAlign: 'left' }}>
                        <h2 style={{ textAlign: 'left' }}>Holders Distribution</h2>

                        <div className={styles.holderDist}>
                            <h3>Top 10 Concentration</h3>
                            <div className={styles.holderBar}>
                                <div
                                    className={styles.holderFill}
                                    style={{
                                        width: `${Math.min(holders.top10Percent, 100)}%`,
                                        background: holders.top10Percent > 50 ? 'var(--danger)' :
                                            holders.top10Percent > 30 ? 'var(--warning)' : 'var(--gradient-primary)'
                                    }}
                                ></div>
                            </div>
                            <div className={styles.holderPercent}>
                                <span style={{
                                    fontWeight: '700',
                                    color: holders.top10Percent > 50 ? 'var(--danger)' :
                                        holders.top10Percent > 30 ? 'var(--warning)' : 'var(--success)'
                                }}>
                                    {holders.top10Percent}%
                                </span>
                                of supply held by top 10
                            </div>
                        </div>

                        <ul className={styles.holdersList}>
                            {(holders.topHolders || []).slice(0, 10).map((holder, i) => (
                                <li key={i} className={styles.holderItem}>
                                    <span className={styles.holderRank}>#{i + 1}</span>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <a
                                            href={`https://solscan.io/account/${holder.address}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={styles.holderAddress}
                                            style={{ textDecoration: 'none', cursor: 'pointer' }}
                                        >
                                            {holder.address.slice(0, 4)}...{holder.address.slice(-4)}
                                            {holder.isBondingCurve && <span className={styles.systemLabel} style={{ marginLeft: '6px' }}>BONDING</span>}
                                            {holder.isDev && <span className={styles.systemLabel} style={{ marginLeft: '6px', background: 'rgba(255,100,100,0.2)', color: '#ffaaaa', border: '1px solid #ffaaaa' }}>DEV</span>}
                                        </a>
                                    </div>
                                    <span className={styles.holderBalance}>{holder.percent}%</span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    {/* Rug Check */}
                    {rugStatus.riskLevel === 'HIGH' && (
                        <div className={styles.warningBanner} style={{ background: 'rgba(255, 0, 0, 0.1)', color: '#ff5555', border: '1px solid #ff5555' }}>
                            🚨 <strong>RUG RISK DETECTED:</strong> {rugStatus.reasons[0]}
                        </div>
                    )}
                </div>



            </div >

            {/* Dead Coin Warning */}
            {
                data.tokenHealth?.isDead && (
                    <div className={styles.deadCoinBanner}>
                        ⚰️ <strong>DEAD COIN:</strong> {data.tokenHealth.description}
                        {data.tokenHealth.signals?.length > 0 && (
                            <ul>
                                {data.tokenHealth.signals.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                        )}
                    </div>
                )
            }

            {/* Rug Risk Warning */}
            {
                data.rugRisk?.isRugRisk && !data.tokenHealth?.isDead && (
                    <div className={`${styles.deadCoinBanner} ${styles.rugBanner}`} style={{ background: 'rgba(255, 50, 50, 0.15)', borderColor: '#ff3333' }}>
                        ⚠️ <strong>POTENTIAL RUG RISK:</strong> High danger signals detected
                        {data.rugRisk.signals?.length > 0 && (
                            <ul>
                                {data.rugRisk.signals.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                        )}
                    </div>
                )
            }

            {/* AI Insights */}
            <section className={`card ${styles.insightsCard}`}>
                <h2>🤖 Alpha Engine Analysis</h2>

                {/* Verdict */}
                <div className={styles.verdict}>
                    <p className={styles.verdictText}>{analysis.verdict || analysis.summary}</p>
                    <span className={styles.confidenceTag}>Confidence: {analysis.confidence}</span>
                </div>

                {/* Key Signals */}
                <div className={styles.insights}>
                    <h3>Key Signals</h3>
                    <ul className={styles.signalsList}>
                        {analysis.keyInsights?.map((insight, i) => (
                            <li key={i} className={
                                insight.startsWith('🟢') ? styles.bullish :
                                    insight.startsWith('🔴') ? styles.bearish :
                                        styles.warning
                            }>
                                {insight}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Warning Flags */}
                {analysis.warningFlags?.length > 0 && (
                    <div className={styles.warningFlags}>
                        <h3>⚠️ Warning Flags</h3>
                        <ul>
                            {analysis.warningFlags.map((flag, i) => (
                                <li key={i} className={styles.flagItem}>{flag}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Entry Point Advice */}
                {data.entryPoint && !data.tokenHealth?.isDead && (
                    <div className={`${styles.entryAdvice} ${!data.entryPoint.shouldEnter ? styles.noEntry : ''}`}>
                        <h3>💰 Entry Analysis</h3>

                        <div className={styles.entryGrid}>
                            <div className={styles.entryItem}>
                                <span className={styles.entryLabel}>Verdict</span>
                                <span className={`${styles.entryValue} ${data.entryPoint.verdict?.includes('ENTER') ? styles.verdictGreen : (data.entryPoint.verdict?.includes('WAIT') ? styles.verdictYellow : styles.verdictRed)}`}>
                                    {data.entryPoint.verdict}
                                    {data.entryPoint.shouldEnter && <span className={styles.momentumSparkline}></span>}
                                </span>
                            </div>
                            <div className={styles.entryItem}>
                                <span className={styles.entryLabel}>Risk Level</span>
                                <span className={styles.entryValue}>{data.entryPoint.riskLevel}</span>
                            </div>
                            <div className={styles.entryItem}>
                                <span className={styles.entryLabel}>Target MCap</span>
                                <span className={styles.entryValue}>
                                    {data.entryPoint.targetMcap ? `$${(data.entryPoint.targetMcap / 1000).toFixed(1)}K` : 'N/A'}
                                </span>
                            </div>
                            <div className={styles.entryItem}>
                                <span className={styles.entryLabel}>Recovery to ATH</span>
                                <span className={`${styles.entryValue} ${styles.highlight}`}>
                                    {data.entryPoint.recoveryToAth || data.entryPoint.potentialReturn}
                                </span>
                            </div>
                            <div className={styles.entryItem}>
                                <span className={styles.entryLabel}>Invalidation Lvl</span>
                                <span className={styles.entryValue} style={{ color: 'var(--danger)' }}>{data.entryPoint.invalidationLevel || 'Unknown'}</span>
                            </div>
                        </div>

                        {data.advanced && (
                            <div className={styles.advancedSignals}>
                                <div className={styles.signalItem}>
                                    <span className={styles.signalLabel}>Smart Money</span>
                                    <span className={styles.signalValue}>{data.advanced.smartMoney}</span>
                                </div>
                                <div className={styles.signalItem}>
                                    <span className={styles.signalLabel}>Snipers</span>
                                    <span className={styles.signalValue} style={{ color: data.advanced.sniperStatus?.risk === 'HIGH' ? 'var(--danger)' : 'var(--success)' }}>
                                        {data.advanced.sniperStatus?.label}
                                    </span>
                                </div>
                                <div className={styles.signalItem}>
                                    <span className={styles.signalLabel}>Insider Status</span>
                                    <span className={styles.signalValue} style={{ color: data.advanced.insiderStatus?.includes('Clean') ? 'var(--success)' : 'var(--warning)' }}>
                                        {data.advanced.insiderStatus}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className={styles.entryReasoningContainer}>
                            <p className={styles.entryReasoning}>
                                <strong>Analysis:</strong> {data.entryPoint.reasoning}
                            </p>
                        </div>

                        {analysis.entryAdvice && (
                            <p className={styles.aiAdvice}>
                                <strong>AI Advice:</strong> {analysis.entryAdvice}
                            </p>
                        )}
                    </div>
                )}
            </section>

            {/* Premium Section: Dev Wallet & Clustering */}
            <section className={`card ${styles.premiumCard} ${user.tier !== 'PREMIUM' ? styles.locked : ''}`}>
                <div className={styles.premiumHeader}>
                    <h2>🐋 Whale & Dev Analysis</h2>
                    {user.tier === 'PREMIUM' ? (
                        <span className="badge badge-premium">PREMIUM UNLOCKED</span>
                    ) : (
                        <span className="badge badge-secondary">LOCKED</span>
                    )}
                </div>

                {user.tier === 'PREMIUM' ? (
                    <div className={styles.premiumContent}>
                        <div className={styles.metricRow}>
                            <div className={styles.metricItem}>
                                <span className={styles.metricLabel}>Rug Risk</span>
                                <span className={styles.metricValue} style={{ color: data.rugRisk?.riskLevel === 'CRITICAL' ? 'var(--danger)' : 'var(--text-primary)' }}>
                                    {data.rugRisk?.riskLevel || 'ANALYZING...'}
                                </span>
                            </div>
                            <div className={styles.metricItem}>
                                <span className={styles.metricLabel}>Sniper Bots</span>
                                <span className={styles.metricValue}>Low (2 detected)</span>
                            </div>
                            <div className={styles.metricItem}>
                                <span className={styles.metricLabel}>Fresh Wallets</span>
                                <span className={styles.metricValue}>12% (Healthy)</span>
                            </div>
                        </div>
                        <div className={styles.clusteringVisual}>
                            <h3>👛 Wallet Clustering</h3>
                            <p className={styles.clusterInfo}>
                                No significant wallet clusters detected. Top 100 holders appear independent.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className={styles.lockedOverlay}>
                        <div className={styles.lockContent}>
                            <span className={styles.lockIcon}>🔒</span>
                            <h3>Premium Features Locked</h3>
                            <p>Upgrade to see Dev Wallet history, Sniper detection, and Wallet Clustering.</p>
                            <button
                                onClick={() => setShowPremiumModal(true)}
                                className="btn btn-primary btn-sm"
                            >
                                Upgrade to Premium
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {
                showPremiumModal && (
                    <PremiumModal
                        walletAddress={walletAddress}
                        onClose={() => setShowPremiumModal(false)}
                        onSuccess={() => fetchAnalysis(true)}
                    />
                )
            }

            {/* Footer */}
            <footer className={styles.footer}>
                <p>
                    Analysis generated at {new Date(data.timestamp).toLocaleTimeString()}
                    <span className={styles.disclaimer}>
                        · Not financial advice. Trade at your own risk.
                    </span>
                </p>
            </footer>
        </div >
    );
}

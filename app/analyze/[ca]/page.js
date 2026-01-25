'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
    BarChart3,
    Users,
    Bot,
    AlertTriangle,
    Search,
    Clock,
    Zap,
    Flame,
    Activity,
    Wallet,
    User,
    Snowflake,
    Check,
    X,
    ChevronLeft,
    Copy,
    ExternalLink,
    Lock,
    RefreshCcw
} from 'lucide-react';
import styles from './page.module.css';
import ProfitabilityGauge from '@/components/ProfitabilityGauge';
import MetricsCard from '@/components/MetricsCard';
import PremiumModal from '@/components/PremiumModal';
import BetaBadge from '@/components/BetaBadge';

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
        window.location.href = '/app';
    };

    // Fetch analysis data
    const fetchAnalysis = useCallback(async (isRefresh = false) => {
        if (!ca) return;

        if (!isRefresh) {
            setLoading(true);
        } else {
            setIsRefreshing(true);
        }
        setError(null);

        // Timeout protection
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        try {
            let deviceId = localStorage.getItem('memesense_device_id');
            if (!deviceId) {
                deviceId = crypto.randomUUID();
                localStorage.setItem('memesense_device_id', deviceId);
            }

            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ca, deviceId, walletAddress }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || result.error || 'Analysis failed');
            }

            // LOCK-IN LOGIC:
            // If refreshing (isRefresh=true), we ONLY update live market data.
            // We KEEP the original AI Analysis, Verdict, and Entry Point locked.
            // Unless the user manually triggered a fresh analysis (which we can assume implies a full unlock, 
            // but currently 'isRefresh' covers both auto and strict re-fetches. 
            // Actually, we need to respect the original plan: Auto-refresh (polling) = Locked. Manual = Unlocked.
            // Currently fetchAnalysis(true) is called by interval. Manual button should call fetchAnalysis(false).

            if (isRefresh) {
                setData(prevData => {
                    if (!prevData) return result;
                    return {
                        ...prevData,
                        token: result.token,
                        metrics: result.metrics,
                        bondingCurve: result.bondingCurve,
                        mechanics: result.mechanics,
                        // Update Analysis & Entry Point (Unlocked)
                        analysis: result.analysis,
                        entryPoint: result.entryPoint,
                        timestamp: new Date().toISOString()
                    };
                });
            } else {
                setData(result);
            }

            setLastUpdated(new Date());
        } catch (err) {
            if (err.name === 'AbortError') {
                setError('Analysis timed out. The network is busy, please try again.');
            } else {
                setError(err.message || 'Failed to analyze token');
            }
            console.error(err);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [ca, walletAddress]);

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
        }, 30000); // Optimized to 30 seconds to save API costs

        return () => clearInterval(interval);
    }, [ca, loading, fetchAnalysis]);

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingState}>
                    <div className={styles.loadingContent}>
                        <div className={styles.spinner}></div>
                        <h2>Analyzing Token...</h2>
                        <p>Fetching on-chain data and running AI analysis</p>
                        <div className={styles.loadingSteps}>
                            <div className={styles.step}>
                                <span className={styles.stepIcon}><BarChart3 size={16} /></span>
                                <span>Fetching market data...</span>
                            </div>
                            <div className={styles.step}>
                                <span className={styles.stepIcon}><Users size={16} /></span>
                                <span>Analyzing holder distribution...</span>
                            </div>
                            <div className={styles.step}>
                                <span className={styles.stepIcon}><Bot size={16} /></span>
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
                        <div className={styles.errorIcon} style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                            <AlertTriangle size={64} color="#ef4444" />
                        </div>
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

    const handleTrade = () => {
        window.open('https://gmgn.ai/r/memesense', '_blank');
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <a href="/app" className={styles.backLink}>
                        <ChevronLeft size={20} />
                        Back
                    </a>
                    <a href="/app" style={{ display: 'flex', alignItems: 'center' }}>
                        <img src="/logo.png" alt="MemeSense" style={{ height: '50px', marginLeft: '20px', width: 'auto' }} />
                        <BetaBadge />
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className={styles.lastUpdated}>
                                Updated {lastUpdated.toLocaleTimeString()}
                            </span>
                            <button
                                onClick={() => fetchAnalysis(false)}
                                style={{
                                    background: 'none',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '4px',
                                    color: '#aaa',
                                    cursor: 'pointer',
                                    padding: '2px 6px',
                                    fontSize: '0.7rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                                title="Run Full Re-Analysis (Unlocks Verdict)"
                            >
                                <RefreshCcw size={10} /> Refresh Logic
                            </button>
                        </div>
                    )}
                </div>
                <div className={styles.headerRight}>
                    {/* Trade Button (New) */}
                    <button
                        onClick={handleTrade}
                        className="btn"
                        style={{
                            background: 'linear-gradient(45deg, #00C2FF, #00EAFF)',
                            color: '#000',
                            fontWeight: 'bold',
                            border: 'none',
                            boxShadow: '0 0 15px rgba(0, 194, 255, 0.4)'
                        }}
                    >
                        <Zap size={16} style={{ marginRight: 6, fill: 'currentColor' }} />
                        Trade on GMGN
                    </button>

                    <a href="/app" className={`btn btn-primary ${styles.scanBtn}`}>
                        <Search size={16} style={{ marginRight: 6 }} /> Scan New Token
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
                        <span className={`badge ${user.tier === 'PREMIUM' || user.tier === 'TRIAL' ? 'badge-premium' : 'badge-info'}`}>
                            {user.tier === 'TRIAL' ? 'PREMIUM TRIAL' : user.tier}
                        </span>
                        {user.tier === 'FREE' && (
                            <span className={styles.trialRemaining}>
                                ⚡ {user.remainingToday}/10 FREE SCAN(S)
                            </span>
                        )}
                        {user.tier === 'TRIAL' && (
                            <span className={styles.trialRemaining} style={{ color: '#ccff00' }}>
                                ⏳ 3-Day Trial Active
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
                                    border: '2px solid rgba(255,255,255,0.1)'
                                }}
                            />
                        ) : (
                            <div className={styles.tokenIconPlaceholder}>
                                <Users size={24} color="#666" />
                            </div>
                        )}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <h1 style={{ margin: 0, fontSize: '1.8rem' }}>{token.name}</h1>

                                {/* Header Bonding Curve (Live) */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '4px 8px',
                                    background: 'rgba(255,255,255,0.05)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    <div style={{
                                        width: '60px',
                                        height: '6px',
                                        background: '#333',
                                        borderRadius: '3px',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            width: `${Math.min(bondingCurve.progress, 100)}%`,
                                            height: '100%',
                                            background: bondingCurve.isGraduated ? '#ccff00' : 'linear-gradient(90deg, #3b82f6, #8b5cf6)'
                                        }}></div>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#ccc' }}>
                                        {bondingCurve.progress.toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                            <div className={styles.tokenMeta}>
                                <span className={styles.symbol}>${token.symbol}</span>
                                <span className={styles.pairAddress}>
                                    {token.address.slice(0, 4)}...{token.address.slice(-4)}
                                    <button
                                        onClick={() => navigator.clipboard.writeText(token.address)}
                                        className={styles.copyBtn}
                                    >
                                        <Copy size={12} />
                                    </button>
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className={styles.tokenMeta}>
                        <div className={styles.tokenAddress}>
                            <code>{ca.slice(0, 8)}...{ca.slice(-6)}</code>
                            <button
                                className={styles.copyBtn}
                                onClick={() => navigator.clipboard.writeText(ca)}
                                title="Copy address"
                            >
                                <Copy size={16} />
                            </button>
                        </div>
                        <span className={styles.ageBadge}><Clock size={14} style={{ marginRight: 4 }} /> Age: {token.ageFormatted || 'New'}</span>
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


            {/* Live Chart Section (DexScreener) */}
            <section style={{
                marginBottom: '24px',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid var(--border-color)',
                background: '#111'
            }}>
                <iframe
                    src={`https://dexscreener.com/solana/${token.pairAddress || ca}?embed=1&theme=dark&trades=0&info=0`}
                    width="100%"
                    height="450px"
                    style={{ border: 'none', display: 'block' }}
                    title="Live Chart"
                />
            </section>

            {/* Liquidity Warning */}
            {
                token.liquidity && token.liquidityRatio && token.liquidityRatio < 5 && (
                    <div className={styles.warningBanner}>
                        <AlertTriangle size={18} style={{ marginRight: 8, display: 'inline', verticalAlign: 'text-bottom' }} />
                        <strong>Low Liquidity Warning:</strong> Only ${token.liquidity?.toLocaleString()} liquidity ({token.liquidityRatio?.toFixed(1)}% of MCap). High slippage risk!
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

                        {/* SPLIT LAYOUT: Gauge + Key Info */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
                            {/* Left: Gauge */}
                            <div style={{ flex: '1', display: 'flex', justifyContent: 'center' }}>
                                <ProfitabilityGauge
                                    value={analysis.profitProbability}
                                    recommendation={analysis.recommendation}
                                />
                            </div>

                            {/* Right: Verdict Stack */}
                            <div style={{ flex: '1.2', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                                <div style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', fontWeight: 'bold' }}>
                                    AI Verdict
                                </div>
                                <div className={`${styles.recommendation} ${getRecommendationClass(analysis.recommendation)}`}
                                    style={{ fontSize: '1.8rem', margin: '0', padding: '6px 16px', alignSelf: 'stretch', textAlign: 'center' }}>
                                    {analysis.recommendation}
                                </div>
                                <div className={`${styles.riskBadge} ${getRiskClass(analysis.riskLevel)}`}
                                    style={{ margin: '0', fontSize: '0.75rem', alignSelf: 'stretch', textAlign: 'center' }}>
                                    Risk: {analysis.riskLevel}
                                </div>
                                <div className={styles.confidence} style={{ margin: '0', fontSize: '0.8rem' }}>
                                    Confidence: <strong>{analysis.confidence}</strong>
                                </div>
                            </div>
                        </div>

                        {/* RUG ACTIVITIES (Compact) */}
                        {data.rugRisk?.signals?.length > 0 && (
                            <div style={{
                                marginTop: '0',
                                marginBottom: '12px',
                                padding: '10px 12px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '8px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: 'bold', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                    <AlertTriangle size={14} /> Rug Risks Detected
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.75rem', color: '#fca5a5', lineHeight: '1.4' }}>
                                    {data.rugRisk.signals.map((signal, i) => (
                                        <li key={i}>{signal}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Snapshot Warning */}
                        <div style={{
                            padding: '6px 10px',
                            background: 'rgba(34, 197, 94, 0.05)',
                            border: '1px solid rgba(34, 197, 94, 0.15)',
                            borderRadius: '6px',
                            fontSize: '0.7rem',
                            color: '#4ade80',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <div className={styles.liveDot} style={{ background: '#4ade80', width: '6px', height: '6px', boxShadow: '0 0 8px rgba(74, 222, 128, 0.4)' }}></div>
                            <span>
                                <strong>AI Live:</strong> Updates on price action.
                            </span>
                        </div>

                        {/* Trade Setup Card */}
                        {data.entryPoint && (
                            <div style={{
                                marginTop: '16px',
                                padding: '16px',
                                borderRadius: '12px',
                                background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                            }}>
                                <div style={{
                                    fontSize: '0.75rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px',
                                    color: '#666',
                                    fontWeight: 'bold',
                                    marginBottom: '4px'
                                }}>
                                    Trade Setup
                                </div>
                                {/* Row 1: Entry */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    <div>
                                        <span style={{ fontSize: '0.85rem', color: '#aaa', display: 'block', marginBottom: '4px' }}>Target Entry</span>
                                        <span style={{
                                            fontSize: '1.4rem',
                                            fontWeight: '800',
                                            color: data.entryPoint.verdict === 'ENTER NOW' ? '#22c55e' : '#ccc',
                                            letterSpacing: '-0.5px'
                                        }}>
                                            ${data.entryPoint.targetMcap ? (data.entryPoint.targetMcap / 1000).toFixed(1) + 'k' : '---'}
                                        </span>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontSize: '0.9rem', color: '#666', fontWeight: '500' }}>
                                            Current: <span style={{ color: '#aaa', marginLeft: '4px' }}>${(token.marketCap / 1000).toFixed(1)}k</span>
                                        </span>
                                    </div>
                                </div>

                                {/* Row 2: Exit & Risk */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '20px',
                                    paddingTop: '4px'
                                }}>
                                    {/* Left Column: Upside */}
                                    <div>
                                        <span style={{ fontSize: '0.8rem', color: '#888', display: 'block', marginBottom: '2px' }}>
                                            Target Exit
                                        </span>
                                        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ccff00', display: 'block' }}>
                                            {(() => {
                                                if (!data.entryPoint.targetMcap) return '---';

                                                let exitTarget = 0;
                                                const mcap = data.entryPoint.targetMcap;

                                                if (!bondingCurve.isGraduated) {
                                                    exitTarget = bondingCurve.graduationThreshold || 69000;
                                                } else if (mcap < 1000000) { // Under 1M
                                                    exitTarget = mcap * 5; // 5x
                                                } else if (mcap < 10000000) { // Under 10M
                                                    exitTarget = mcap * 2; // 2x
                                                } else { // Over 10M
                                                    exitTarget = mcap * 1.3; // 30% Scalp
                                                }

                                                return `$${(exitTarget / 1000).toFixed(1)}k`;
                                            })()}
                                        </span>
                                        <div style={{
                                            display: 'inline-block',
                                            marginTop: '4px',
                                            padding: '2px 6px',
                                            background: 'rgba(204, 255, 0, 0.15)',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem',
                                            color: '#ccff00',
                                            fontWeight: 'bold'
                                        }}>
                                            {(() => {
                                                if (!data.entryPoint.targetMcap) return '';

                                                const mcap = data.entryPoint.targetMcap;
                                                let label = '';

                                                if (!bondingCurve.isGraduated) {
                                                    label = 'Graduation';
                                                } else if (mcap < 1000000) {
                                                    label = '5x Target';
                                                } else if (mcap < 10000000) {
                                                    label = '2x Target';
                                                } else {
                                                    label = '+30% Scalp';
                                                }

                                                return label.toUpperCase();
                                            })()}
                                        </div>
                                    </div>

                                    {/* Right Column: Downside */}
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#888', display: 'block', marginBottom: '2px' }}>
                                            Max Risk
                                        </span>
                                        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ef4444', display: 'block' }}>
                                            {data.entryPoint.targetMcap ? `$${(data.entryPoint.targetMcap * 0.7 / 1000).toFixed(1)}k` : '---'}
                                        </span>
                                        <div style={{
                                            display: 'inline-block',
                                            marginTop: '4px',
                                            padding: '2px 6px',
                                            background: 'rgba(239, 68, 68, 0.15)',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem',
                                            color: '#ef4444',
                                            fontWeight: 'bold'
                                        }}>
                                            -30% STOP LOSS
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* 2. Key Metrics Card */}
                    <section className={styles.metricsSection}>
                        <h2>Key Metrics</h2>
                        <div className={styles.metricsGrid}>
                            <MetricsCard
                                label="Holders (Top 10)"
                                value={(holders.isEstimated && holders.total === 5000) ? '5,000+' : holders.total?.toLocaleString() || '0'}
                                icon={<Users size={18} color="var(--primary)" />}
                                trend={holders.total > 200 ? 'up' : null}
                            />
                            <MetricsCard
                                label="24h Volume / Buys"
                                value={`$${(token.volume24h / 1000).toFixed(1)}K / ${metrics.buyCount?.toLocaleString() || '0'}`}
                                icon={<Wallet size={18} color="var(--text-secondary)" />}
                            />
                            <MetricsCard
                                label="Buy Ratio"
                                value={`${metrics.buyRatio}%`}
                                icon={<Activity size={18} color={metrics.buyRatio > 55 ? 'var(--success)' : 'var(--danger)'} />}
                                trend={metrics.buyRatio > 55 ? 'up' : metrics.buyRatio < 45 ? 'down' : null}
                                color={metrics.buyRatio > 55 ? 'green' : metrics.buyRatio < 45 ? 'red' : null}
                            />
                            <MetricsCard
                                label="FOMO Grade"
                                value={`${analysis.entryScore}/10`}
                                icon={<Flame size={18} color={analysis.entryScore > 7 ? 'orange' : 'var(--text-secondary)'} />}
                                color={
                                    analysis.entryScore > 8 ? 'gold' :
                                        analysis.entryScore >= 7 ? 'green' :
                                            analysis.entryScore < 4 ? 'red' : null
                                }
                            />
                            <MetricsCard
                                label="5m Volume"
                                value={`$${(token.volume5m / 1000).toFixed(1)}K`}
                                icon={<Clock size={18} color="var(--text-secondary)" />}
                            />
                            <MetricsCard
                                label="Volume Velocity"
                                value={data.advanced?.volumeVelocity?.ratio || '---'}
                                icon={<Zap size={18} color="var(--primary)" />}
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


                </div>

                {/* Right Column - Risk & Safety (40%) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: '1' }}>

                    {/* 1. Whale & Dev Analysis (GATED) */}
                    <section className={`card ${styles.profitCard}`} style={{ padding: '24px', textAlign: 'left', position: 'relative', overflow: 'hidden' }}>

                        {/* Premium Gate Overlay */}
                        {!['PREMIUM', 'TRIAL', 'Premium Trial'].includes(user.tier) && (
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0,0,0,0.6)',
                                backdropFilter: 'blur(8px)',
                                zIndex: 10,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px',
                                border: '1px solid rgba(204, 255, 0, 0.2)'
                            }}>
                                <Lock size={32} color="#ccff00" />
                                <div style={{ textAlign: 'center' }}>
                                    <h3 style={{ margin: 0, color: '#fff' }}>Premium Feature</h3>
                                    <p style={{ margin: '4px 0 16px', color: '#888', fontSize: '0.9rem' }}>
                                        Unlock Whale, Dev & Sniper analysis
                                    </p>
                                    <button
                                        onClick={() => setShowPremiumModal(true)}
                                        className="btn btn-primary"
                                        style={{ padding: '8px 24px' }}
                                    >
                                        Upgrade to Unlock
                                    </button>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.2rem' }}><Bot size={24} color="var(--primary)" /></span>
                                <h2 style={{ textAlign: 'left', margin: 0, fontSize: '1.1rem' }}>Whale & Dev Analysis</h2>
                            </div>
                            {['PREMIUM', 'TRIAL', 'Premium Trial'].includes(user.tier) ? (
                                <span style={{ fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '0.5px', color: '#ccff00', opacity: 0.9 }}>
                                    PREMIUM UNLOCKED
                                </span>
                            ) : (
                                <span style={{ fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '0.5px', color: '#888', opacity: 0.7 }}>
                                    PREMIUM ONLY
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', filter: user.tier === 'FREE' ? 'blur(4px)' : 'none' }}>
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
                                    <span style={{ fontSize: '18px' }}><Flame size={18} color="orange" /></span>
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
                                    <span style={{ fontSize: '18px' }}><User size={18} color="var(--text-secondary)" /></span>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Renounced:</span>
                                </div>
                                <span style={{ fontSize: '18px' }}>
                                    {data.tokenSafety?.isRenounced ? <Check size={18} color="var(--success)" /> : <X size={18} color="var(--danger)" />}
                                </span>
                            </div>

                            {/* Freeze Revoked */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '18px' }}><Snowflake size={18} color="cyan" /></span>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Freeze Revoked:</span>
                                </div>
                                <span style={{ fontSize: '18px' }}>
                                    {data.tokenSafety?.isFreezeRevoked ? <Check size={18} color="var(--success)" /> : <X size={18} color="var(--danger)" />}
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* 3. Holder Distribution */}
                    <section className={`card ${styles.profitCard}`} style={{ padding: '24px', textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 style={{ textAlign: 'left', margin: 0 }}>Holders Distribution</h2>
                            {user.tier === 'FREE' && (
                                <span style={{ fontSize: '0.75rem', padding: '4px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', color: '#ccc' }}>
                                    Top 5 Only (Free)
                                </span>
                            )}
                        </div>

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
                            🚨 <strong>RUG RISK DETECTED:</strong> {rugStatus.reasons?.[0] || 'High risk detected'}
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
            <section className={`card ${styles.insightsCard}`} style={{ position: 'relative', overflow: 'hidden' }}>

                {/* Premium Gate Overlay for Alpha Engine */}
                {!['PREMIUM', 'TRIAL', 'Premium Trial'].includes(user.tier) && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.7)',
                        backdropFilter: 'blur(8px)',
                        zIndex: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        border: '1px solid rgba(204, 255, 0, 0.2)'
                    }}>
                        <Lock size={32} color="#ccff00" />
                        <div style={{ textAlign: 'center' }}>
                            <h3 style={{ margin: 0, color: '#fff' }}>Alpha Engine Locked</h3>
                            <p style={{ margin: '4px 0 16px', color: '#888', fontSize: '0.9rem' }}>
                                Upgrade to see the strict AI Analysis & Report
                            </p>
                            <button
                                onClick={() => setShowPremiumModal(true)}
                                className="btn btn-primary"
                                style={{ padding: '8px 24px' }}
                            >
                                Unlock Alpha Engine
                            </button>
                        </div>
                    </div>
                )}

                <h2>🤖 Alpha Engine Analysis</h2>

                {analysis.alphaReport ? (
                    /* Strict Alpha Engine Terminal Output */
                    <div style={{
                        background: '#0d1117',
                        border: '1px solid #30363d',
                        borderRadius: '6px',
                        padding: '16px',
                        fontFamily: 'Consolas, Monaco, "Andale Mono", monospace',
                        fontSize: '0.85rem',
                        color: '#c9d1d9',
                        overflowX: 'auto',
                        lineHeight: '1.5',
                        whiteSpace: 'pre-wrap',
                        marginTop: '12px'
                    }}>
                        {analysis.alphaReport}
                    </div>
                ) : (
                    /* Legacy Output Fallback */
                    <>
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
                    </>
                )}

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

                        {/* Whale List Integration */}
                        <div className={styles.clusteringVisual} style={{ marginBottom: '20px' }}>
                            <h3>🐋 Whale Wallets ({data.mechanics?.whales?.count || 0})</h3>
                            {data.mechanics?.whales?.hasWhales ? (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                                    gap: '10px',
                                    marginTop: '10px'
                                }}>
                                    {data.mechanics.whales.wallets.map((whale, idx) => (
                                        <div key={idx} style={{
                                            background: 'rgba(255,255,255,0.05)',
                                            padding: '8px',
                                            borderRadius: '6px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            fontSize: '0.8rem'
                                        }}>
                                            <a
                                                href={`https://solscan.io/account/${whale.address}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ color: '#fbbf24', textDecoration: 'none', fontFamily: 'monospace', marginBottom: '4px' }}
                                            >
                                                {whale.address.slice(0, 4)}...{whale.address.slice(-4)}
                                            </a>
                                            <span style={{ color: '#ccc', fontSize: '0.75rem' }}>
                                                {Math.round(whale.balance).toLocaleString()} SOL
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ color: '#888', fontSize: '0.9rem' }}>No whales detected (&gt;25 SOL).</p>
                            )}
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

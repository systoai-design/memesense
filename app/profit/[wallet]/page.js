'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Lock, TrendingUp, Clock, DollarSign, Activity,
    Wallet, ChevronLeft, ChevronRight, Copy, Search, BarChart3, LineChart, Brain, Check, Zap
} from 'lucide-react';
import LoadingScan from '../../../components/LoadingScan';
import styles from './page.module.css';
import BetaBadge from '@/components/BetaBadge';

export default function ProfitPage() {
    const { wallet: walletParam } = useParams();
    const router = useRouter();

    // Wallet Connection State
    const [connectedWallet, setConnectedWallet] = useState(null);
    const [isWalletConnected, setIsWalletConnected] = useState(false);
    const [isWalletChecking, setIsWalletChecking] = useState(true); // New state to pause analysis until check done

    const getProvider = () => {
        if ('phantom' in window) {
            const provider = window.phantom?.solana;
            if (provider?.isPhantom) {
                return provider;
            }
        }
        return null;
    };

    useEffect(() => {
        const provider = getProvider();
        if (provider) {
            provider.connect({ onlyIfTrusted: true })
                .then((resp) => {
                    setConnectedWallet(resp.publicKey.toString());
                    setIsWalletConnected(true);
                })
                .catch(() => {
                    // Not connected
                })
                .finally(() => {
                    setIsWalletChecking(false); // Check complete
                });

            provider.on("connect", (publicKey) => {
                setConnectedWallet(publicKey.toString());
                setIsWalletConnected(true);
            });

            provider.on("disconnect", () => {
                setConnectedWallet(null);
                setIsWalletConnected(false);
            });
        } else {
            setIsWalletChecking(false); // No provider, check done
        }
    }, []);

    const connectWallet = async () => {
        const provider = getProvider();
        if (provider) {
            try {
                const resp = await provider.connect();
                setConnectedWallet(resp.publicKey.toString());
                setIsWalletConnected(true);
            } catch (err) {
                console.error("User rejected connection", err);
            }
        } else {
            // DEEP LINKING LOGIC
            // If on mobile and no provider (standard browser), deep link to Phantom App
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

            if (isMobile) {
                const currentUrl = window.location.href;
                const ref = window.location.origin;
                const deepLink = `https://phantom.app/ul/browse/${encodeURIComponent(currentUrl)}?ref=${encodeURIComponent(ref)}`;
                window.open(deepLink, '_blank');
            } else {
                window.open('https://phantom.app/', '_blank');
            }
        }
    };
    const [searchInput, setSearchInput] = useState('');
    const [copied, setCopied] = useState(false);

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchInput.trim()) {
            router.push(`/profit/${searchInput.trim()}`);
            setSearchInput('');
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(walletToAnalyze);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Decode wallet address if it's encoded or just use parameter
    const walletToAnalyze = decodeURIComponent(walletParam);

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isPremium, setIsPremium] = useState(true);
    const [debugInfo, setDebugInfo] = useState(null);
    const [timeWindow, setTimeWindow] = useState('7d');
    const [historyFilter, setHistoryFilter] = useState('ALL');
    const [sortField, setSortField] = useState('date');
    const [sortDirection, setSortDirection] = useState('desc');
    const [scanDepth, setScanDepth] = useState('normal'); // 'normal' | 'deep'
    const [usageInfo, setUsageInfo] = useState(null);

    useEffect(() => {
        if (walletToAnalyze && !isWalletChecking) {
            analyzeWallet(walletToAnalyze, 'normal');
        }
    }, [walletToAnalyze, connectedWallet, isWalletChecking]);

    async function analyzeWallet(address, depth = 'normal') {
        setLoading(true);
        setError(null);
        setScanDepth(depth);

        try {
            const deviceId = localStorage.getItem('memesense_device_id') || 'unknown';
            const userWallet = connectedWallet;

            const res = await fetch('/api/profit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletToAnalyze: address,
                    deviceId,
                    userWallet,
                    depth
                })
            });

            const json = await res.json();

            if (!res.ok) {
                if (json.isPremiumLocked) {
                    setIsPremium(false);
                } else {
                    setError(json.error || 'Analysis failed');
                }
            } else {
                if (json.isToken) {
                    setError('Detected Token Address. Redirecting...');
                    router.push(json.redirect);
                    return;
                }

                if (json.data === null) {
                    setError(json.message || 'No trading history found (or API limit reached). Try again later.');
                } else {
                    setData(json.data);
                    if (json.data.usage) {
                        setUsageInfo(json.data.usage);
                    }
                }
            }

            // Debug Info for Lock Screen
            if (json.debugInfo) {
                setDebugInfo(json.debugInfo);
            }

        } catch (e) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    }

    // Loading State
    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingState}>
                    <div className={styles.loadingContent}>
                        <div className={styles.spinner}></div>
                        <h2>{scanDepth === 'deep' ? 'Running Deep Analysis...' : 'Analyzing Wallet History...'}</h2>
                        <p>Fetching on-chain data and checking profitability</p>
                        <div className={styles.loadingSteps}>
                            <div className={styles.step}>
                                <span className={styles.stepIcon}><Wallet size={16} /></span>
                                <span>Fetching {scanDepth === 'deep' ? '1,000' : 'recent'} transactions...</span>
                            </div>
                            <div className={styles.step}>
                                <span className={styles.stepIcon}><Search size={16} /></span>
                                <span>Identifying open positions...</span>
                            </div>
                            <div className={styles.step}>
                                <span className={styles.stepIcon}><DollarSign size={16} /></span>
                                <span>Calculating global PnL & Win Rate...</span>
                            </div>
                            <div className={styles.step}>
                                <span className={styles.stepIcon}><LineChart size={16} /></span>
                                <span>Generating profit report...</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Premium Lock State
    if (!isPremium) {
        return (
            <div className={styles.container}>
                {/* Reusing container for background */}
                <div className={styles.lockOverlay}>
                    <div className={styles.lockContent}>
                        <Lock className={styles.lockIcon} size={64} />
                        <h2>Premium Feature</h2>

                        {!isWalletConnected ? (
                            <>
                                <p>Unlock the Wallet Profitability Tracker by connecting your Premium wallet.</p>
                                <button className={styles.upgradeBtn} onClick={connectWallet} style={{ background: '#00d47e', color: '#000' }}>
                                    <Wallet size={18} /> Connect Wallet to Unlock
                                </button>
                                <div style={{ marginTop: 16, fontSize: 13, opacity: 0.7 }}>
                                    Don't have access? <span onClick={() => router.push('/upgrade')} style={{ textDecoration: 'underline', cursor: 'pointer' }}>Upgrade Now</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <p>Your connected wallet does not have Premium access.</p>
                                <button className={styles.upgradeBtn} onClick={() => router.push('/upgrade')}>
                                    Upgrade Now
                                </button>
                                <button onClick={() => { localStorage.removeItem('memesense_device_id'); window.location.reload(); }} style={{ marginTop: 12, background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 13 }}>
                                    Switch Wallet / Reset
                                </button>
                                {debugInfo && (
                                    <div style={{ marginTop: 16, padding: 12, background: 'rgba(255,0,0,0.1)', borderRadius: 8, fontSize: 11, textAlign: 'left', color: '#ff6b6b' }}>
                                        <strong>Debug Info:</strong><br />
                                        Wallet: {debugInfo.receivedWallet?.slice(0, 6)}...<br />
                                        Tier: {debugInfo.tier}<br />
                                        User ID: {debugInfo.userId?.slice(0, 8)}...
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <button onClick={() => router.push('/app')} className={styles.backButton}>
                        <ChevronLeft /> Back
                    </button>
                </div>
                <div className={styles.errorContent}>
                    <p>⚠️ {error}</p>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.container}>
            {/* Header matching Analysis Page */}
            {/* Header Redesigned */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <button onClick={() => router.push('/app')} className={styles.backIconButton} title="Back to Search">
                        <ChevronLeft size={20} />
                    </button>
                    <div className={styles.brand} onClick={() => router.push('/app')} style={{ display: 'flex', alignItems: 'center' }}>
                        <img src="/logo.png" alt="MemeSense" className={styles.logo} />
                        <BetaBadge />
                    </div>
                </div>

                <div className={styles.headerRight}>
                    {!isWalletConnected && (
                        <button
                            onClick={connectWallet}
                            className={styles.scanBtn}
                            style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                marginRight: 12
                            }}
                        >
                            <Wallet size={16} /> Connect
                        </button>
                    )}

                    <form onSubmit={handleSearch} className={styles.searchForm}>
                        <div className={styles.inputWrapper}>
                            <Search className={styles.inputIcon} size={16} />
                            <input
                                type="text"
                                placeholder="Sense wallet address..."
                                className={styles.searchInput}
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                            />
                        </div>
                        <button type="submit" className={styles.scanBtn}>
                            Sense <Activity size={16} />
                        </button>
                    </form>
                </div>
            </div>

            <div className={styles.content}>

                <div className={styles.glassCard} style={{ marginBottom: 24, padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
                        {/* Left: Wallet Info + Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
                            <div className={styles.walletIcon}>
                                <Wallet size={32} color="#ccff00" />
                            </div>
                            <div>
                                <div className={styles.label} style={{ marginBottom: 4 }}>Wallet Address</div>
                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                                    <div className={styles.value} style={{ fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {walletToAnalyze.slice(0, 8)}...{walletToAnalyze.slice(-8)}
                                        <div onClick={handleCopy} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: copied ? 1 : 0.7, transition: 'opacity 0.2s' }}>
                                            {copied ? (
                                                <>
                                                    <Check size={16} color="#00d47e" />
                                                    <span style={{ fontSize: 12, color: '#00d47e', fontWeight: 700 }}>Copied</span>
                                                </>
                                            ) : (
                                                <Copy size={16} />
                                            )}
                                        </div>
                                    </div>

                                    {/* STATUS BADGE - Integrated */}
                                    {data?.aiVerdict && (
                                        <div className={`${styles.verdictBadge} ${data.aiVerdict.status === 'PROFITABLE' ? styles.verdictProfitable :
                                            data.aiVerdict.status === 'HIGH RISK' ? styles.verdictRisk :
                                                styles.verdictUnprofitable
                                            }`} style={{
                                                fontSize: '13px',
                                                padding: '6px 12px',
                                                borderRadius: '20px',
                                                borderWidth: '1px',
                                                fontWeight: 800,
                                                letterSpacing: '0.5px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                background: data.aiVerdict.status === 'PROFITABLE' ? 'rgba(0, 212, 126, 0.15)' :
                                                    data.aiVerdict.status === 'HIGH RISK' ? 'rgba(255, 171, 0, 0.15)' : 'rgba(255, 77, 77, 0.15)',
                                                borderColor: data.aiVerdict.status === 'PROFITABLE' ? '#00d47e' :
                                                    data.aiVerdict.status === 'HIGH RISK' ? '#ffab00' : '#ff4d4d',
                                                color: data.aiVerdict.status === 'PROFITABLE' ? '#00d47e' :
                                                    data.aiVerdict.status === 'HIGH RISK' ? '#ffab00' : '#ff4d4d',
                                                boxShadow: data.aiVerdict.status === 'PROFITABLE' ? '0 0 15px rgba(0, 212, 126, 0.2)' : 'none'
                                            }}>
                                            {data.aiVerdict.status === 'PROFITABLE' ? <TrendingUp size={14} strokeWidth={2.5} /> : <Activity size={14} strokeWidth={2.5} />}
                                            {data.aiVerdict.status === 'PROFITABLE' ? 'PROFITABLE' : data.aiVerdict.status}
                                            <span style={{ opacity: 0.6, fontSize: '11px', marginLeft: 2 }}>
                                                {data.aiVerdict.score}/100
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right: Balance & Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                            {/* Copytrade Button */}
                            <a
                                href="https://t.me/maestro?start=r-yourjesustrader"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn"
                                style={{
                                    background: 'linear-gradient(45deg, #00C2FF, #00EAFF)',
                                    color: '#000',
                                    fontWeight: 'bold',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    textDecoration: 'none',
                                    fontSize: '13px',
                                    boxShadow: '0 0 15px rgba(0, 194, 255, 0.3)'
                                }}
                            >
                                <Zap size={16} style={{ fill: 'currentColor' }} />
                                Copytrade This Wallet
                            </a>

                            {data?.balance !== undefined && (
                                <div style={{ textAlign: 'right' }}>
                                    <div className={styles.label}>Balance</div>
                                    <div className={styles.value} style={{ fontSize: 28, color: '#ccff00', fontWeight: 700, letterSpacing: '-0.5px' }}>
                                        {data.balance.toFixed(2)} <span style={{ fontSize: 16, opacity: 0.8 }}>SOL</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quota & Deep Scan Banner */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, marginBottom: 24 }}>
                    {/* Quota Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            padding: '8px 12px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.1)',
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                        }}>
                            <Activity size={14} color="#888" />
                            <span style={{ color: '#aaa' }}>Daily Scans:</span>
                            <strong style={{ color: usageInfo?.remaining > 0 ? '#fff' : '#ff4d4d' }}>
                                {usageInfo ? `${usageInfo.remaining} Remaining` : 'Calculating...'}
                            </strong>
                        </div>
                    </div>

                    {/* Deep Scan CTA */}
                    {scanDepth === 'normal' && (
                        <button
                            onClick={() => {
                                if (isPremium) {
                                    analyzeWallet(walletToAnalyze, 'deep');
                                } else {
                                    router.push('/upgrade');
                                }
                            }}
                            className="btn"
                            style={{
                                background: isPremium ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.05)',
                                border: `1px solid ${isPremium ? '#8b5cf6' : 'rgba(255,255,255,0.1)'}`,
                                color: isPremium ? '#c4b5fd' : '#aaa',
                                padding: '8px 16px',
                                fontSize: 13,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                cursor: 'pointer'
                            }}
                        >
                            {isPremium ? <Zap size={14} /> : <Lock size={14} />}
                            {isPremium ? 'Run Deep Scan (1000 txs)' : 'Unlock Deep Scan (Premium)'}
                        </button>
                    )}
                </div>

                {/* Time Window Tabs */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                    {['1d', '7d', '14d', '30d', 'all'].map(t => (
                        <button
                            key={t}
                            onClick={() => setTimeWindow(t)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: 8,
                                background: timeWindow === t ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                color: timeWindow === t ? 'black' : 'white',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                fontSize: 13
                            }}
                        >
                            {t === 'all' ? 'All Time' : `Last ${t}`}
                        </button>
                    ))}
                </div>

                {/* --- DASHBOARD METRICS GRID --- */}
                {data?.summary?.[timeWindow] && (
                    <div className={styles.metricsGrid}>

                        {/* 1. TIME & DURATION */}
                        <div className={styles.metricCard}>
                            <div className={styles.cardTitle}>
                                <Clock size={18} /> Time Strategy
                            </div>
                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Avg Hold Time</span>
                                <span className={styles.statValue}>
                                    {Math.round((data.summary[timeWindow].avgHoldTime || 0) / 60000)} mins
                                </span>
                            </div>
                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Fastest Flip</span>
                                <span className={styles.statValue}>
                                    {Math.round((data.summary[timeWindow].fastestFlip || 0) / 1000)}s
                                </span>
                            </div>
                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Longest Hold</span>
                                <span className={styles.statValue}>
                                    {Math.round((data.summary[timeWindow].longestHold || 0) / 3600000)}h
                                </span>
                            </div>
                        </div>

                        {/* 2. GAINS & PROFITABILITY */}
                        <div className={styles.metricCard}>
                            <div className={styles.cardTitle}>
                                <DollarSign size={18} /> Profitability
                            </div>
                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Net Profit (Realized)</span>
                                <span className={`${styles.statValue} ${data.summary[timeWindow].totalRealizedPnL >= 0 ? styles.positive : styles.negative}`}>
                                    ${data.summary[timeWindow].totalRealizedPnLUSD?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                </span>
                            </div>
                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Net Profit (Unrealized)</span>
                                <span className={`${styles.statValue} ${data.summary[timeWindow].totalUnrealizedPnL >= 0 ? styles.positive : styles.negative}`}>
                                    ${data.summary[timeWindow].totalUnrealizedPnLUSD?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                </span>
                            </div>
                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Win Rate</span>
                                <span className={styles.statValue} style={{ color: data.summary[timeWindow].winRate > 50 ? '#00d47e' : 'white' }}>
                                    {data.summary[timeWindow].winRate?.toFixed(1) || '0.0'}%
                                </span>
                            </div>
                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Profit Factor</span>
                                <span className={styles.statValue} style={{ color: data.summary[timeWindow].profitFactor > 1.5 ? 'gold' : 'white' }}>
                                    {data.summary[timeWindow].profitFactor?.toFixed(2) || '0.00'}x
                                </span>
                            </div>
                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Avg Trade PnL</span>
                                <span className={styles.statValue}>
                                    ${data.summary[timeWindow].avgPnLUSD?.toFixed(2) || '0.00'}
                                </span>
                            </div>
                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Safe Copy Margin</span>
                                <span className={styles.statValue}>
                                    {data.summary[timeWindow].safeCopyMargin?.toFixed(1) || '0.0'}%
                                </span>
                            </div>
                        </div>

                        {/* 3. VOLUME & ACTIVITY */}
                        <div className={styles.metricCard}>
                            <div className={styles.cardTitle}>
                                <BarChart3 size={18} /> Volume & Activity
                            </div>
                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Total Volume</span>
                                <span className={styles.statValue}>
                                    ${data.summary[timeWindow].totalVolumeUSD?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}
                                </span>
                            </div>
                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Tokens Traded</span>
                                <span className={styles.statValue}>
                                    {data.summary[timeWindow].tokensTraded || 0}
                                </span>
                            </div>
                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Total Trades</span>
                                <span className={styles.statValue}>
                                    {data.summary[timeWindow].totalTrades || 0}
                                </span>
                            </div>
                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Wins / Losses</span>
                                <span className={styles.statValue}>
                                    <span className={styles.positive}>{data.summary[timeWindow].winCount || 0}</span> / <span className={styles.negative}>{data.summary[timeWindow].lossCount || 0}</span>
                                </span>
                            </div>
                        </div>

                        {/* 4. COPY STRATEGY */}
                        <div className={styles.metricCard}>
                            <div className={styles.cardTitle}>
                                <Brain size={18} /> Copy Strategy
                            </div>
                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Consistency Rating</span>
                                <span className={styles.statValue} style={{ color: (data.summary[timeWindow].consistencyRating || 0) > 70 ? '#00d47e' : (data.summary[timeWindow].consistencyRating || 0) > 40 ? 'gold' : '#ff4d4d' }}>
                                    {(data.summary[timeWindow].consistencyRating || 0).toFixed(0)}/100
                                </span>
                            </div>
                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Diamond Hands</span>
                                <span className={styles.statValue} style={{ color: '#a366ff' }}>
                                    {(data.summary[timeWindow].diamondHandRating || 0).toFixed(0)}/100
                                </span>
                            </div>
                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Sniper Score</span>
                                <span className={styles.statValue} style={{ opacity: 0.5 }}>
                                    {data.summary[timeWindow].sniperEfficiency !== null ? data.summary[timeWindow].sniperEfficiency + '%' : 'N/A'}
                                </span>
                            </div>
                        </div>

                    </div>
                )}

                {/* Trades Table */}
                <div className={styles.tableCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3>Position History</h3>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {['ALL', 'WINS', 'LOSSES', 'OPEN'].map(f => (
                                <button
                                    key={f}
                                    onClick={() => setHistoryFilter(f)}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        border: 'none',
                                        background: historyFilter === f ? (f === 'WINS' ? '#00d47e' : f === 'LOSSES' ? '#ff4d4d' : '#ccff00') : 'rgba(255,255,255,0.05)',
                                        color: historyFilter === f ? '#000' : '#888',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={styles.tableHeader}>
                        <span onClick={() => { setSortField('status'); setSortDirection(sortField === 'status' && sortDirection === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>
                            Status {sortField === 'status' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </span>
                        <span>Token</span>
                        <span onClick={() => { setSortField('pnl'); setSortDirection(sortField === 'pnl' && sortDirection === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>
                            PnL (ROI) {sortField === 'pnl' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </span>
                        <span>Held</span>
                        <span>Trades (B/S)</span>
                        <span onClick={() => { setSortField('date'); setSortDirection(sortField === 'date' && sortDirection === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>
                            Hold Time {sortField === 'date' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </span>
                    </div>

                    <div className={styles.tableBody}>
                        {data?.summary?.[timeWindow]?.details
                            ?.filter(trade => {
                                if (historyFilter === 'ALL') return true;
                                if (historyFilter === 'WINS') return trade.pnl > 0;
                                if (historyFilter === 'LOSSES') return trade.pnl < 0;
                                if (historyFilter === 'OPEN') return trade.status === 'OPEN';
                                return true;
                            })
                            .sort((a, b) => {
                                let valA = a[sortField];
                                let valB = b[sortField];

                                // Special handling for dates/duration
                                if (sortField === 'date') {
                                    // Use lastSellTime (most recent activity) or firstBuyTime
                                    valA = a.lastSellTime || a.firstBuyTime || 0;
                                    valB = b.lastSellTime || b.firstBuyTime || 0;
                                }

                                if (sortField === 'status') {
                                    // Custom order: OPEN > CLOSED > PARTIAL
                                    const statusOrder = { 'OPEN': 3, 'CLOSED': 1, 'PARTIAL_HISTORY': 0 };
                                    valA = statusOrder[a.status] || 0;
                                    valB = statusOrder[b.status] || 0;
                                }

                                if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
                                if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
                                return 0;
                            })
                            .map((trade, i) => {
                                const meta = data.tokenInfo?.[trade.mint] || {};
                                const symbol = meta.symbol || 'UNKNOWN';
                                const name = meta.name || trade.mint.slice(0, 8);
                                const image = meta.image || '';

                                return (
                                    <div key={i} className={styles.tableRow}>
                                        <div>
                                            <span className={`${styles.statusBadge} ${trade.status === 'CLOSED' ? styles.statusClosed :
                                                trade.status === 'OPEN' ? styles.statusOpen :
                                                    styles.statusPartial
                                                }`}>
                                                {trade.status === 'PARTIAL_HISTORY' ? 'PARTIAL' : trade.status}
                                            </span>
                                        </div>
                                        <div className={styles.tokenCell}>
                                            <Link href={`/analyze/${trade.mint}`} className={styles.tokenLink}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    {image ? (
                                                        <img src={image} alt={symbol} style={{ width: 32, height: 32, borderRadius: '50%' }} />
                                                    ) : (
                                                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <DollarSign size={14} color="#888" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div style={{ fontWeight: 700, color: 'white' }}>{symbol}</div>
                                                        <div className={styles.tokenMint}>{name}</div>
                                                    </div>
                                                </div>
                                            </Link>
                                        </div>
                                        <div className={styles.pnlCell}>
                                            <span className={trade.pnl >= 0 ? styles.positive : styles.negative} style={{ fontWeight: 700 }}>
                                                {Number(trade.pnl).toFixed(3)} SOL
                                            </span>
                                            <span className={trade.roi >= 0 ? styles.positive : styles.negative} style={{ fontSize: 12 }}>
                                                ({Number(trade.roi).toFixed(1)}%)
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 13, color: '#ccc' }}>
                                            {trade.status === 'OPEN' ? 'Holding' : '-'}
                                        </div>
                                        <span style={{ color: '#ccc' }}>
                                            {trade.buyCount} / {trade.sellCount}
                                        </span>
                                        <span>
                                            {trade.holdTime ? (trade.holdTime / 60000 < 60 ? Math.round(trade.holdTime / 60000) + 'm' : Math.round(trade.holdTime / 3600000) + 'h') : '-'}
                                        </span>
                                    </div>
                                );
                            })}
                    </div>
                    {(!data?.summary?.[timeWindow]?.details || data.summary[timeWindow].details.length === 0) && (
                        <div className={styles.emptyState}>No positions found in recent history.</div>
                    )}
                </div>
            </div >
        </div >
    );
}

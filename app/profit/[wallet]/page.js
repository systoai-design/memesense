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
            window.open('https://phantom.app/', '_blank');
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
    const [timeWindow, setTimeWindow] = useState('7d'); // Default to 7d

    useEffect(() => {
        if (walletToAnalyze && !isWalletChecking) {
            analyzeWallet(walletToAnalyze);
        }
    }, [walletToAnalyze, connectedWallet, isWalletChecking]); // Re-run if connected wallet changes (might unlock premium)

    async function analyzeWallet(address) {
        setLoading(true);
        setError(null);

        try {
            const deviceId = localStorage.getItem('memesense_device_id') || 'unknown';
            const userWallet = connectedWallet;

            const res = await fetch('/api/profit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletToAnalyze: address,
                    deviceId,
                    userWallet
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
                if (json.data === null) {
                    setError(json.message || 'No trading history found (or API limit reached). Try again later.');
                } else {
                    setData(json.data);
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
                        <h2>Analyzing Wallet History...</h2>
                        <p>Fetching on-chain data and checking profitability</p>
                        <div className={styles.loadingSteps}>
                            <div className={styles.step}>
                                <span className={styles.stepIcon}><Wallet size={16} /></span>
                                <span>Fetching 10,000 transactions...</span>
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
                    {!isWalletConnected ? (
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
                    ) : (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginRight: 12,
                            background: 'rgba(0, 212, 126, 0.1)',
                            border: '1px solid #00d47e',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: 13,
                            color: '#00d47e',
                            fontWeight: 700
                        }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00d47e' }} />
                            {connectedWallet?.slice(0, 4)}...{connectedWallet?.slice(-4)}
                        </div>
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

                    </div>
                )}

                {/* Trades Table */}
                <div className={styles.tableCard}>
                    <h3>Position History</h3>
                    <div className={styles.tableHeader}>
                        <span>Status</span>
                        <span>Token</span>
                        <span>PnL (ROI)</span>
                        <span>Held</span>
                        <span>Trades (B/S)</span>
                        <span>Hold Time</span>
                    </div>

                    <div className={styles.tableBody}>
                        {data?.summary?.[timeWindow]?.details?.map((trade, i) => {
                            const meta = data.tokenInfo?.[trade.mint] || {};
                            // Use metadata if available, otherwise fallback to trade properties (though they are raw now)
                            const symbol = meta.symbol || 'UNKNOWN';
                            const name = meta.name || trade.mint.slice(0, 8);
                            const image = meta.image || '';

                            // Calculate simplified Held Amount (approx)
                            const held = trade.buySol > 0 ? ((trade.buySol - trade.sellSol) / trade.buySol * 100) : 0;
                            // Wait, trade object has raw `buySol` and `sellSol`. It doesn't have token amounts easily without re-calc.
                            // But `trade-analysis` did calculate `totalBuyTokens` inside loop but didn't export it in `details` array?
                            // Let's check `lib/trade-analysis.js`. 
                            // Ah, I need to check if `details` has token amounts.
                            // Looking at `trade-analysis.js` -> `details` pushes buySol, sellSol. 
                            // It does NOT push `tokenAmount`.
                            // I should just show "Open" or "Closed" or PnL. "Values" column usually means USD value.
                            // Without prices, "Held" is hard.
                            // But I can show "Cost Basis" or "Remaining %".
                            // Let's just show "Held" as "Open" badge or empty.
                            // Actually, I'll stick to PnL and just add the `tokenInfo` lookup logic for now. 
                            // AND fix the data source to `summary[timeWindow]`.

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
                                        {Math.round(trade.duration / 60000)}m
                                    </span>
                                </div>
                            );
                        })}
                        {(!data?.summary?.[timeWindow]?.details || data.summary[timeWindow].details.length === 0) && (
                            <div className={styles.emptyState}>No positions found in recent history.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

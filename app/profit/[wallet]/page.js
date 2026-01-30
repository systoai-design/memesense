'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Lock, TrendingUp, Clock, DollarSign, Activity,
    Wallet, ChevronLeft, ChevronRight, Copy, Search, BarChart3, LineChart, Brain, Check, Zap, Edit2, X, Save
} from 'lucide-react';
import LoadingScan from '../../../components/LoadingScan';
import styles from './page.module.css';
import BetaBadge from '@/components/BetaBadge';
import Tooltip from '@/components/Tooltip';
import { HelpCircle } from 'lucide-react';
import ProfitabilityCard from '../../../components/ProfitabilityCard';
import CompactTradeTable from '../../../components/CompactTradeTable';
import PnLCalendar from '../../../components/PnLCalendar';

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
    const [errorReason, setErrorReason] = useState(null);

    // Restored State Variables
    const [isPremium, setIsPremium] = useState(true);
    const [debugInfo, setDebugInfo] = useState(null);
    const [timeWindow, setTimeWindow] = useState('7d');
    const [historyFilter, setHistoryFilter] = useState('ALL');
    const [sortField, setSortField] = useState('date');
    const [sortDirection, setSortDirection] = useState('desc');
    const [scanDepth, setScanDepth] = useState('normal'); // 'normal' | 'deep'
    const [usageInfo, setUsageInfo] = useState(null);

    // Label Editing State
    const [isEditingLabel, setIsEditingLabel] = useState(false);
    const [labelInput, setLabelInput] = useState('');
    const [savingLabel, setSavingLabel] = useState(false);

    useEffect(() => {
        if (walletToAnalyze && !isWalletChecking) {
            analyzeWallet(walletToAnalyze, 'normal');
        }
    }, [walletToAnalyze, connectedWallet, isWalletChecking]);

    async function analyzeWallet(address, depth = 'normal', retryCount = 0) {
        const MAX_RETRIES = 5;
        const RETRY_DELAY = 4000; // 4 seconds

        setLoading(true);
        setError(null);
        setScanDepth(depth);
        setErrorReason(null); // Clear previous errors

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

            // HANDLE LOADING/RATE-LIMITED RESPONSE (Auto-Retry)
            if (json.isLoading && retryCount < MAX_RETRIES) {
                console.log(`[Wallet] Analysis loading, retry ${retryCount + 1}/${MAX_RETRIES}...`);
                // Keep loading state true, maybe show partial progress if supported later
                await new Promise(r => setTimeout(r, RETRY_DELAY));
                return analyzeWallet(address, depth, retryCount + 1);
            }

            if (!res.ok) {
                if (json.isPremiumLocked) {
                    setIsPremium(false);
                    if (json.error) setErrorReason(json.error);
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
                    // Initialize label
                    if (json.data.userLabel) {
                        setLabelInput(json.data.userLabel);
                    }
                }
            }

            // Debug Info for Lock Screen
            if (json.debugInfo) {
                // Debug logic handled in render
            }

        } catch (e) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    }

    const handleSaveLabel = async () => {
        setSavingLabel(true);
        try {
            const deviceId = localStorage.getItem('memesense_device_id') || 'unknown';
            const userWallet = connectedWallet;

            const res = await fetch('/api/user/label', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletToLabel: walletToAnalyze,
                    label: labelInput,
                    deviceId,
                    userWallet
                })
            });

            const json = await res.json();
            if (json.success) {
                // Optimistic update
                setData(prev => ({ ...prev, userLabel: json.label }));
                setIsEditingLabel(false);
            } else {
                alert('Failed to save label: ' + json.error);
            }
        } catch (e) {
            console.error(e);
            alert('Error saving label');
        } finally {
            setSavingLabel(false);
        }
    };

    // Skeleton Component Helper
    const SkeletonPulse = ({ width, height, style }) => (
        <div style={{
            width, height, background: 'rgba(255,255,255,0.05)', borderRadius: 6,
            animation: 'pulse 1.5s infinite ease-in-out', ...style
        }}></div>
    );

    // ... (inside Render Lock Screen) ...
    // Premium Lock State
    if (!isPremium) {
        return (
            <div className={styles.container}>
                {/* Reusing container for background */}
                <div className={styles.lockOverlay}>
                    <div className={styles.lockContent}>
                        <Lock className={styles.lockIcon} size={64} />
                        <h2>{errorReason ? 'Limit Reached' : 'Premium Feature'}</h2>

                        {!isWalletConnected ? (
                            <>
                                <p>{errorReason || 'Unlock the Wallet Profitability Tracker by connecting your Premium wallet.'}</p>
                                <button className={styles.upgradeBtn} onClick={connectWallet} style={{ background: '#00d47e', color: '#000' }}>
                                    <Wallet size={18} /> Connect Wallet to Unlock
                                </button>
                                <div style={{ marginTop: 16, fontSize: 13, opacity: 0.7 }}>
                                    Don't have access? <span onClick={() => router.push('/upgrade')} style={{ textDecoration: 'underline', cursor: 'pointer' }}>Upgrade Now</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <p>{errorReason || 'Your connected wallet does not have Premium access.'}</p>
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

            {/* --- DASHBOARD CONTENT --- */}
            <div className={styles.content}>

                {/* Loading Skeleton State */}
                {loading && !data && (
                    <>
                        {/* Header/Summary Skeleton */}
                        <div className={styles.glassCard} style={{ marginBottom: 24, padding: '24px' }}>
                            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                                <SkeletonPulse width={60} height={60} style={{ borderRadius: '50%' }} />
                                <div style={{ flex: 1 }}>
                                    <SkeletonPulse width={150} height={24} style={{ marginBottom: 12 }} />
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <SkeletonPulse width={100} height={32} style={{ borderRadius: 20 }} />
                                        <SkeletonPulse width={100} height={32} style={{ borderRadius: 20 }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Profit Card Skeleton */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 24 }}>
                            <SkeletonPulse width="100%" height={280} />
                            <SkeletonPulse width="100%" height={280} />
                            <SkeletonPulse width="100%" height={280} />
                        </div>

                        {/* Table Skeleton */}
                        <div className={styles.tableCard}>
                            <SkeletonPulse width={200} height={32} style={{ marginBottom: 20 }} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <SkeletonPulse key={i} width="100%" height={50} />
                                ))}
                            </div>
                        </div>

                        {/* Add Pulse Animation Style globally if needed, or inline */}
                        <style jsx global>{`
                            @keyframes pulse {
                                0% { opacity: 0.6; }
                                50% { opacity: 0.3; }
                                100% { opacity: 0.6; }
                            }
                        `}</style>
                    </>
                )}

                {/* Real Data Render */}
                {!loading && data && (
                    <>
                        <div className={styles.glassCard} style={{ marginBottom: 24, padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
                                {/* Left: Wallet Info + Badge */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
                                    <div className={styles.walletIcon}>
                                        <Wallet size={32} color="#ccff00" />
                                    </div>
                                    <div>
                                        <div className={styles.label} style={{ marginBottom: 4 }}>
                                            {data?.userLabel ? 'Wallet Label' : 'Wallet Address'}
                                        </div>

                                        {isEditingLabel ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={labelInput}
                                                    onChange={(e) => setLabelInput(e.target.value)}
                                                    placeholder="Enter label..."
                                                    style={{
                                                        background: 'rgba(0,0,0,0.3)',
                                                        border: '1px solid #444',
                                                        borderRadius: 4,
                                                        padding: '4px 8px',
                                                        color: 'white',
                                                        fontSize: 16,
                                                        outline: 'none'
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSaveLabel();
                                                        if (e.key === 'Escape') setIsEditingLabel(false);
                                                    }}
                                                />
                                                <button onClick={handleSaveLabel} disabled={savingLabel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#00d47e' }}>
                                                    <Save size={18} />
                                                </button>
                                                <button onClick={() => setIsEditingLabel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff4d4d' }}>
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                                                <div className={styles.value} style={{ fontSize: 'clamp(14px, 4vw, 20px)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    {data?.userLabel ? (
                                                        <span style={{ color: '#fff', fontWeight: 800 }}>{data.userLabel}</span>
                                                    ) : (
                                                        <span>{walletToAnalyze.slice(0, 8)}...{walletToAnalyze.slice(-8)}</span>
                                                    )}

                                                    <div onClick={handleCopy} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: copied ? 1 : 0.7, transition: 'opacity 0.2s' }}>
                                                        {copied ? (
                                                            <Check size={16} color="#00d47e" />
                                                        ) : (
                                                            <Copy size={16} />
                                                        )}
                                                    </div>

                                                    <div onClick={() => {
                                                        if (isPremium) {
                                                            setIsEditingLabel(true);
                                                            setLabelInput(data?.userLabel || '');
                                                        } else {
                                                            router.push('/upgrade');
                                                        }
                                                    }} style={{ cursor: 'pointer', opacity: 0.5, marginLeft: 4, transition: 'opacity 0.2s' }} title="Edit Label">
                                                        <Edit2 size={14} />
                                                    </div>
                                                </div>

                                                {/* Show address small if labeled */}
                                                {data?.userLabel && (
                                                    <div style={{ fontSize: 12, opacity: 0.5, fontFamily: 'monospace' }}>
                                                        {walletToAnalyze}
                                                    </div>
                                                )}

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
                                        )}
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

                        {/* Quota Badge (Hidden for Premium) */}
                        {!isPremium && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
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
                        )}

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
                            <ProfitabilityCard data={data} timeWindow={timeWindow} />
                        )}

                        {/* Trades Table */}
                        <div className={styles.tableCard}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3>Position History</h3>

                            </div>

                            <CompactTradeTable
                                trades={data?.summary?.[timeWindow]?.details?.map(trade => ({
                                    ...trade,
                                    metadata: data?.tokenInfo?.[trade.mint] || {}
                                })) || []}
                            />
                        </div>

                        {(!data?.summary?.[timeWindow]?.details || data.summary[timeWindow].details.length === 0) && (
                            <div className={styles.emptyState}>No positions found in recent history.</div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

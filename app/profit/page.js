'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, History, ArrowRight, Wallet, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import styles from './dashboard.module.css';

export default function ProfitDashboard() {
    const router = useRouter();
    const [input, setInput] = useState('');
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userWallet, setUserWallet] = useState(null);

    useEffect(() => {
        // 1. Get Device ID / Auth
        const deviceId = localStorage.getItem('meme_device_id');
        // Check phantom connection if any
        let wallet = null;
        if (window.phantom?.solana?.isConnected) {
            wallet = window.phantom.solana.publicKey.toString();
            setUserWallet(wallet);
        }

        if (deviceId || wallet) {
            fetchHistory(deviceId, wallet);
        } else {
            setLoading(false);
        }
    }, []);

    const fetchHistory = async (deviceId, wallet) => {
        try {
            let url = `/api/user/history?`;
            if (deviceId) url += `deviceId=${deviceId}&`;
            if (wallet) url += `userWallet=${wallet}`;

            const res = await fetch(url);
            const json = await res.json();

            if (json.success) {
                setHistory(json.data);
            }
        } catch (e) {
            console.error("Failed to fetch history", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if (input.trim()) {
            router.push(`/profit/${input.trim()}`);
        }
    };

    const formatCurrency = (val) => {
        if (!val && val !== 0) return '$-.--';
        return val.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    };

    const formatTimeAgo = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffSeconds = Math.floor((now - date) / 1000);

        if (diffSeconds < 60) return 'Just now';
        if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
        if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
        return `${Math.floor(diffSeconds / 86400)}d ago`;
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <Link href="/" className={styles.title}>
                    MemeSense Profit Tracker
                </Link>
                {/* Simplified Nav */}
                <Link href="/" style={{ color: '#888', textDecoration: 'none', fontSize: 14 }}>
                    Back to Home
                </Link>
            </header>

            <div className={styles.container}>
                {/* SEARCH SECTION */}
                <section className={styles.searchSection}>
                    <h1 className={styles.searchTitle}>Track Master Traders</h1>
                    <p className={styles.searchSubtitle}>
                        Analyze 1000+ historical trades to find true profitability.<br />
                        Now with full history tracking.
                    </p>

                    <form onSubmit={handleSearch} className={styles.searchBox}>
                        <Search className={styles.searchIcon} size={20} />
                        <input
                            type="text"
                            className={styles.searchInput}
                            placeholder="Enter Wallet Address (SOL)..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                        />
                    </form>
                </section>

                {/* HISTORY SECTION */}
                <section>
                    <div className={styles.sectionTitle}>
                        <History size={18} color="#CCFF00" />
                        My Recent Scans
                    </div>

                    {loading ? (
                        <div className={styles.emptyState}>Loading history...</div>
                    ) : history.length === 0 ? (
                        <div className={styles.emptyState}>
                            No scans yet. Enter a wallet above to start tracking.
                        </div>
                    ) : (
                        <div className={styles.historyGrid}>
                            {history.map((scan) => {
                                const pnl = scan.summary?.pnl || 0;
                                const solPrice = scan.summary?.solPrice || 150;
                                const pnlUSD = pnl * solPrice;
                                const winRate = scan.summary?.winRate || 0;

                                return (
                                    <Link key={scan.id} href={`/profit/${scan.wallet_address}`} className={styles.historyCard}>
                                        <div className={styles.cardHeader}>
                                            <span className={styles.walletAddress}>
                                                {scan.wallet_label || `${scan.wallet_address.substring(0, 4)}...${scan.wallet_address.substring(scan.wallet_address.length - 4)}`}
                                            </span>
                                            <span className={styles.timeAgo}>
                                                {formatTimeAgo(scan.scanned_at)}
                                            </span>
                                        </div>

                                        <div className={styles.cardStats}>
                                            <div className={styles.stat}>
                                                <span className={styles.statLabel}>Realized PnL</span>
                                                <span className={`${styles.statValue} ${pnlUSD >= 0 ? styles.positive : styles.negative}`}>
                                                    {pnlUSD >= 0 ? '+' : ''}{formatCurrency(pnlUSD)}
                                                </span>
                                            </div>
                                            <div className={styles.stat}>
                                                <span className={styles.statLabel}>Win Rate</span>
                                                <span className={styles.statValue}>
                                                    {winRate.toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className={styles.stat}>
                                                <span className={styles.statLabel}>Trades</span>
                                                <span className={styles.statValue}>
                                                    {scan.summary?.trades || 0}
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}

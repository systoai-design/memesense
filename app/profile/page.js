'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadProfile = async () => {
            const walletAddress = localStorage.getItem('memesense_wallet');

            if (!walletAddress) {
                router.push('/app'); // Redirect if not logged in
                return;
            }

            try {
                // 1. Fetch User Data
                const userRes = await fetch('/api/user/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ walletAddress })
                });
                const userData = await userRes.json();

                if (userData.success) {
                    setUser(userData.user);

                    // 2. Fetch History (Limit 100)
                    const historyRes = await fetch('/api/scans/recent', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            walletAddress,
                            limit: 50
                        })
                    });
                    const historyData = await historyRes.json();
                    if (historyData.success) {
                        setHistory(historyData.scans);
                    }
                }
            } catch (error) {
                console.error('Failed to load profile:', error);
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [router]);

    if (loading) {
        return (
            <div className={styles.container} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <a href="/app" className={styles.backBtn}>
                    ← Back to Scanner
                </a>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <span className="btn btn-secondary" style={{ cursor: 'default' }}>
                        {user.walletAddress.slice(0, 4)}...{user.walletAddress.slice(-4)}
                    </span>
                </div>
            </div>

            <h1 className={styles.title} style={{ marginBottom: '32px' }}>Wallet Profile</h1>

            {/* Stats Grid */}
            <div className={styles.statsGrid}>
                {/* Tier Card */}
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ color: '#ffd700', background: 'rgba(255, 215, 0, 0.1)' }}>
                        👑
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Current Plan</span>
                        <div className={styles.statValue}>
                            {user.tier}
                            {user.tier === 'PREMIUM' && <span className={styles.premiumBadge}>PRO</span>}
                        </div>
                    </div>
                </div>

                {/* Credits Card */}
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ color: '#00d47e', background: 'rgba(0, 212, 126, 0.1)' }}>
                        ⚡
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Available Credits</span>
                        <div className={styles.statValue}>
                            {user.credits > 10000 ? 'Unlimited' : user.credits}
                        </div>
                    </div>
                </div>

                {/* Scans Card */}
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ color: '#00b4d8', background: 'rgba(0, 180, 216, 0.1)' }}>
                        🔍
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Total Scans</span>
                        <div className={styles.statValue}>
                            {history.length}
                        </div>
                    </div>
                </div>
            </div>

            {/* History List */}
            <div className={styles.historySection}>
                <div className={styles.historyHeader}>
                    <h2 className={styles.historyTitle}>Scan History</h2>
                    <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                        Last 50 Scans
                    </span>
                </div>

                <div className={styles.historyGrid}>
                    {history.length === 0 ? (
                        <div className={styles.emptyState}>
                            No scans yet. Go analyze some tokens!
                        </div>
                    ) : (
                        history.map((scan, i) => (
                            <a
                                key={i}
                                href={`/analyze/${scan.token_address}`}
                                className={styles.historyCard}
                            >
                                <div className={styles.tokenIcon}>
                                    {scan.image_url ? (
                                        <img src={scan.image_url} alt="" style={{ width: '100%', height: '100%' }} />
                                    ) : '🪙'}
                                </div>
                                <div className={styles.tokenInfo}>
                                    <span className={styles.tokenSymbol}>{scan.symbol || 'Unknown'}</span>
                                    <span className={styles.tokenName}>{scan.name}</span>
                                </div>
                                <div className={styles.scanTime}>
                                    {new Date(scan.created_at.replace(' ', 'T') + 'Z').toLocaleString()}
                                </div>
                                <div className={styles.actionArrow}>→</div>
                            </a>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

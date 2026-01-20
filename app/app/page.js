'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import PremiumModal from '@/components/PremiumModal';

// Components
// import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';

export default function AppHome() {
    const router = useRouter();
    const [contractAddress, setContractAddress] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [walletAddress, setWalletAddress] = useState(null);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [showConnectModal, setShowConnectModal] = useState(true);
    const [recentScans, setRecentScans] = useState([]);
    const [showPremiumModal, setShowPremiumModal] = useState(false);

    // Fetch recent scans
    useEffect(() => {
        const fetchRecent = async () => {
            try {
                let deviceId = localStorage.getItem('memesense_device_id');
                if (!deviceId) {
                    deviceId = crypto.randomUUID();
                    localStorage.setItem('memesense_device_id', deviceId);
                }

                const res = await fetch('/api/scans/recent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deviceId, walletAddress })
                });
                const data = await res.json();
                if (data.success) {
                    setRecentScans(data.scans);
                }
            } catch (e) {
                console.error('Failed to fetch recent scans:', e);
            }
        };
        fetchRecent();
    }, [walletAddress]);

    // Initial Auth Check
    useEffect(() => {
        const checkWallet = async () => {
            if (window.solana && window.solana.isPhantom) {
                try {
                    // Check if already connected
                    const resp = await window.solana.connect({ onlyIfTrusted: true });
                    handleLogin(resp.publicKey.toString());
                } catch (err) {
                    // Not connected, show modal
                    setIsLoadingAuth(false);
                    setShowConnectModal(true);
                }
            } else {
                setIsLoadingAuth(false);
                setShowConnectModal(true);
            }
        };

        // Delay slightly to prevent flash
        setTimeout(checkWallet, 500);
    }, []);

    const handleConnect = async () => {
        if (window.solana && window.solana.isPhantom) {
            try {
                const resp = await window.solana.connect();
                handleLogin(resp.publicKey.toString());
            } catch (err) {
                console.error("User rejected connection", err);
            }
        } else {
            window.open('https://phantom.app/', '_blank');
        }
    };

    const handleDisconnect = async () => {
        try {
            if (window.solana) {
                await window.solana.disconnect();
            }
        } catch (err) {
            console.error("Disconnect error:", err);
        }
        setWalletAddress(null);
        localStorage.removeItem('memesense_wallet');
        setShowConnectModal(true);
    };

    const handleLogin = async (address) => {
        setWalletAddress(address);
        localStorage.setItem('memesense_wallet', address);
        setIsLoadingAuth(true);
        setShowConnectModal(false);

        try {
            const res = await fetch('/api/user/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: address })
            });
            const data = await res.json();

            if (data.success) {
                if (!data.user.isOnboarded) {
                    router.push('/onboarding');
                } else {
                    // User is authenticated and onboarded
                    setIsLoadingAuth(false);
                }
            }
        } catch (err) {
            console.error("Login failed", err);
            setIsLoadingAuth(false); // Make sure to unblock if API fails
        }
    };

    const handleAnalyze = (e) => {
        e.preventDefault();
        if (!contractAddress) return;

        setIsAnalyzing(true);
        router.push(`/analyze/${contractAddress}`);
    };

    if (isLoadingAuth) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
                <style jsx>{`
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                `}</style>
            </div>
        );
    }

    return (
        <div className={styles.container}>

            {/* AUTH MODAL OVERLAY */}
            {showConnectModal && !walletAddress && (
                <div className={styles.authModalOverlay}>
                    <div className={`${styles.authModalCard} glass-card`}>
                        <div className={styles.authModalIcon}>🔒</div>
                        <h2 className={styles.authModalTitle}>Connect to Access</h2>
                        <p className={styles.authModalSubtitle}>
                            Identify yourself with your Solana wallet to access the MemeSense dashboard.
                        </p>
                        <button
                            onClick={handleConnect}
                            className={`${styles.connectButton} btn btn-primary`}
                        >
                            <img src="https://cryptologos.cc/logos/solana-sol-logo.png" className={styles.connectButtonIcon} />
                            Connect Wallet
                        </button>
                        <div className={styles.authModalTerms}>
                            By connecting, you agree to our Terms of Service.
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className={styles.header}>
                <div className={styles.navGroup}>
                    <a href="/app">
                        <img src="/logo.png" alt="MemeSense" className={styles.logoImage} style={{ height: '60px', width: 'auto' }} />
                    </a>
                </div>
                <div className={styles.navGroup}>
                    <div className={styles.badge} onClick={() => setShowPremiumModal(true)} style={{ cursor: 'pointer' }}>
                        🎁 Premium Trial (Upgrade)
                    </div>
                    {walletAddress ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                onClick={() => router.push('/profile')}
                                className={`${styles.walletButton} btn btn-secondary`}
                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                👤 {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
                            </button>
                            <button
                                onClick={handleDisconnect}
                                className="btn"
                                style={{
                                    padding: '5px 10px',
                                    fontSize: '0.8rem',
                                    background: 'rgba(255, 50, 50, 0.2)',
                                    color: '#ff5555',
                                    border: '1px solid #ff5555',
                                    height: '36px'
                                }}
                            >
                                Disconnect
                            </button>
                        </div>
                    ) : (
                        <button className={`${styles.walletButton} btn btn-secondary`}>
                            Not Connected
                        </button>
                    )}
                </div>
            </header>

            <main className={styles.main}>

                <div className={styles.hero}>
                    <h1 className={styles.heroTitle}>
                        Analyze Any Token
                    </h1>
                    <p className={styles.heroSubtitle}>
                        Enter a Solana token address to get instant AI-powered analysis
                    </p>

                    <form onSubmit={handleAnalyze} className={styles.searchForm}>
                        <div className={styles.inputWrapper}>
                            <input
                                type="text"
                                className={styles.caInput}
                                placeholder="Paste token address (e.g., pump...)"
                                value={contractAddress}
                                onChange={(e) => setContractAddress(e.target.value)}
                            />
                            <button type="submit" className={styles.searchBtn}>
                                {isAnalyzing ? 'Searching...' : '🔍 Sense'}
                            </button>
                        </div>
                    </form>

                    <div className={styles.examples}>
                        <span>Try an example:</span>
                        <button className={styles.exampleBtn} onClick={() => setContractAddress('pump_fun_token_address')}>
                            pump.fun Token
                        </button>
                        <button className={styles.exampleBtn} onClick={() => setContractAddress('graduated_token_address')}>
                            Graduated Token
                        </button>
                    </div>
                </div>

                {/* Recent Scans */}
                <div className={styles.recentSection}>
                    <h3 className={styles.sectionTitle}>Recent Scans</h3>
                    <div className={styles.recentGrid}>
                        {recentScans.length === 0 ? (
                            <div style={{ color: '#888', gridColumn: '1/-1', textAlign: 'center', padding: '20px' }}>
                                No recent activity yet. Be the first!
                            </div>
                        ) : (
                            recentScans.map((scan, i) => (
                                <div
                                    key={i}
                                    className={`${styles.scanCard} glass-card`}
                                    onClick={() => router.push(`/analyze/${scan.token_address}`)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className={styles.tokenInfo}>
                                        <div className={styles.tokenIconPlaceholder}>
                                            {scan.image_url ? (
                                                <img src={scan.image_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                                            ) : '🪙'}
                                        </div>
                                        <div>
                                            <div className={styles.tokenName}>{scan.symbol || scan.name || 'Unknown'}</div>
                                            <div className={styles.tokenDate}>
                                                {new Date(scan.created_at.replace(' ', 'T') + 'Z').toLocaleDateString()} • {Math.max(0, Math.round((Date.now() - new Date(scan.created_at.replace(' ', 'T') + 'Z')) / 60000))}m ago
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.arrowIcon}>→</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Features Grid */}
                <div className={styles.featuresGrid}>
                    {[
                        { icon: '⚡', title: 'Real-Time Data', desc: 'Live price, volume, and holder updates straight from the chain.' },
                        { icon: '🤖', title: 'AI Analysis', desc: 'Our Alpha Engine analyzes distributions to detect risks instantly.' },
                        { icon: '💰', title: 'Entry Signals', desc: 'Get precise buy/sell signals based on momentum and whale movement.' },
                    ].map((feature, i) => (
                        <div key={i} className={`${styles.featureCard} glass-card`}>
                            <div className={styles.featureIcon}>{feature.icon}</div>
                            <h3 className={styles.featureTitle}>{feature.title}</h3>
                            <p className={styles.featureDesc}>{feature.desc}</p>
                        </div>
                    ))}
                </div>

                {showPremiumModal && (
                    <PremiumModal
                        walletAddress={walletAddress}
                        onClose={() => setShowPremiumModal(false)}
                        onSuccess={() => window.location.reload()}
                    />
                )}
            </main>
        </div>
    );
}

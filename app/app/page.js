'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import PremiumModal from '@/components/PremiumModal';
import BetaBadge from '@/components/BetaBadge';

// Components
// import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';

export default function AppHome() {
    const router = useRouter();
    const [contractAddress, setContractAddress] = useState('');
    const [mode, setMode] = useState('token'); // 'token' | 'wallet'
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [walletAddress, setWalletAddress] = useState(null);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [showConnectModal, setShowConnectModal] = useState(true);
    const [recentScans, setRecentScans] = useState([]);
    const [showPremiumModal, setShowPremiumModal] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false); // Guard against double clicks

    const [userTier, setUserTier] = useState('FREE');

    const getProvider = () => {
        if ('phantom' in window) {
            const provider = window.phantom?.solana;
            if (provider?.isPhantom) {
                return provider;
            }
        }
        // Fallback to window.solana if generic
        if ('solana' in window && window.solana.isPhantom) {
            return window.solana;
        }
        return null;
    };

    const handleLogin = useCallback(async (address) => {
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
                    setUserTier(data.user.tier); // Update tier state
                }
            }
        } catch (err) {
            console.error("Login failed", err);
            setIsLoadingAuth(false); // Make sure to unblock if API fails
        }
    }, [router]);

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
                    body: JSON.stringify({
                        deviceId,
                        walletAddress,
                        type: mode // 'token' or 'wallet'
                    })
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
    }, [walletAddress, mode]);

    // Initial Auth Check
    useEffect(() => {
        const checkWallet = async () => {
            const provider = getProvider();

            if (provider) {
                try {
                    // Check if already connected
                    const resp = await provider.connect({ onlyIfTrusted: true });
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
    }, [handleLogin]);

    const handleConnect = async () => {
        if (isConnecting) return;

        const provider = getProvider();

        if (provider) {
            setIsConnecting(true);
            try {
                // Force a small delay to clear any pending extension states
                await new Promise(r => setTimeout(r, 100));

                const resp = await provider.connect();
                handleLogin(resp.publicKey.toString());
            } catch (err) {
                console.error("Connection failed", err);

                // "User rejected" is common, don't alert for that
                if (err.message?.includes('User rejected')) return;

                // Try to get a meaningful error message
                let msg = err.message || 'Unknown error';
                if (err.code) msg += ` (Code: ${err.code})`;

                if (msg === 'Unexpected error') {
                    msg += ' - Try refreshing the page or unlocking your wallet.';
                }

                alert(`Wallet Error: ${msg}`);
            } finally {
                setIsConnecting(false);
            }
        } else {
            window.open('https://phantom.app/', '_blank');
        }
    };

    const handleDisconnect = async () => {
        try {
            const provider = getProvider();
            if (provider) {
                await provider.disconnect();
            }
        } catch (err) {
            console.error("Disconnect error:", err);
        }
        setWalletAddress(null);
        localStorage.removeItem('memesense_wallet');
        setShowConnectModal(true);
    };

    // Moved to top for hoisting


    const handleAnalyze = (e) => {
        e.preventDefault();
        if (!contractAddress) return;

        setIsAnalyzing(true);
        if (mode === 'wallet') {
            router.push(`/profit/${contractAddress}`);
        } else {
            router.push(`/analyze/${contractAddress}`);
        }
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

    const handleRename = async (e, scan, newName) => {
        e.stopPropagation(); // Prevent navigation
        // Optimistic update
        const oldName = scan.user_label || scan.name;
        const updatedScans = recentScans.map(s =>
            s.token_address === scan.token_address ? { ...s, user_label: newName } : s
        );
        setRecentScans(updatedScans);

        try {
            const deviceId = localStorage.getItem('memesense_device_id');
            await fetch('/api/user/label', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId,
                    walletAddress,
                    targetWallet: scan.token_address,
                    label: newName
                })
            });
        } catch (err) {
            console.error("Failed to rename", err);
            // Revert on error could go here
        }
    };

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
                    <a href="/app" className={styles.logoContainer}>
                        <img src="/logo.png" alt="MemeSense" className={styles.logoDesktop} />
                        <img src="/icon.png" alt="MemeSense" className={styles.logoMobile} />
                        <div className={styles.betaWrapper}>
                            <BetaBadge />
                        </div>
                    </a>
                </div>
                <div className={styles.navGroup}>
                    {/* User Tier Status Badge */}
                    {walletAddress && (
                        <div
                            className={styles.badge}
                            onClick={() => setShowPremiumModal(true)}
                            style={{
                                cursor: 'pointer',
                                background: userTier === 'PREMIUM' ? 'rgba(255, 215, 0, 0.2)' :
                                    userTier === 'TRIAL' ? 'rgba(204, 255, 0, 0.2)' :
                                        'rgba(255, 255, 255, 0.1)',
                                color: userTier === 'PREMIUM' ? '#ffd700' :
                                    userTier === 'TRIAL' ? '#ccff00' :
                                        '#fff'
                            }}
                        >
                            {userTier === 'PREMIUM' ? '👑 Premium Active' :
                                userTier === 'TRIAL' ? '⏳ Trial Active (Upgrade)' :
                                    '🎁 Premium Trial (Upgrade)'}
                        </div>
                    )}
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
                        {mode === 'token' ? 'Analyze Any Token' : 'Track Profitability'}
                    </h1>
                    <p className={styles.heroSubtitle}>
                        {mode === 'token'
                            ? 'Enter a Solana token address to get instant AI-powered analysis'
                            : 'Enter a wallet address to spy on trades and performance'}
                    </p>

                    {/* Tab Switcher */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 24, marginTop: 24 }}>
                        <button
                            onClick={() => { setMode('token'); setContractAddress(''); }}
                            style={{
                                background: mode === 'token' ? 'rgba(204, 255, 0, 0.1)' : 'transparent',
                                color: mode === 'token' ? '#ccff00' : '#888',
                                border: mode === 'token' ? '1px solid #ccff00' : '1px solid transparent',
                                padding: '8px 24px',
                                borderRadius: '100px',
                                cursor: 'pointer',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                                fontSize: '14px'
                            }}
                        >
                            Token Analysis
                        </button>
                        <button
                            onClick={() => { setMode('wallet'); setContractAddress(''); }}
                            style={{
                                background: mode === 'wallet' ? 'rgba(204, 255, 0, 0.1)' : 'transparent',
                                color: mode === 'wallet' ? '#ccff00' : '#888',
                                border: mode === 'wallet' ? '1px solid #ccff00' : '1px solid transparent',
                                padding: '8px 24px',
                                borderRadius: '100px',
                                cursor: 'pointer',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                                fontSize: '14px'
                            }}
                        >
                            Profit Tracker
                        </button>
                    </div>

                    <form onSubmit={handleAnalyze} className={styles.searchForm}>
                        <div className={styles.inputWrapper}>
                            <input
                                type="text"
                                className={styles.caInput}
                                placeholder={mode === 'token' ? "Paste token address (e.g., pump...)" : "Paste wallet address..."}
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
                                {mode === 'token' ? 'No recent tokens scanned.' : 'No profit tracks yet.'}
                            </div>
                        ) : (
                            recentScans.map((scan, i) => (
                                <div
                                    key={i}
                                    className={`${styles.scanCard} glass-card`}
                                    onClick={() => router.push(mode === 'token'
                                        ? `/analyze/${scan.token_address}`
                                        : `/profit/${scan.token_address}`
                                    )}
                                    style={{ cursor: 'pointer', position: 'relative' }}
                                >
                                    <div className={styles.tokenInfo}>
                                        <div className={styles.tokenIconPlaceholder}>
                                            {scan.image_url ? (
                                                <img src={scan.image_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                                            ) : (
                                                mode === 'token' ? '🪙' : '👤'
                                            )}
                                        </div>
                                        <div>
                                            <div className={styles.tokenName} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {scan.user_label || scan.name || (mode === 'token' ? 'Unknown' : 'Wallet')}
                                                {mode === 'wallet' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const currentName = scan.user_label || scan.name || '';
                                                            const newName = prompt('Name this wallet:', currentName);
                                                            if (newName) handleRename(e, scan, newName);
                                                        }}
                                                        className={styles.editBtn}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            padding: 2,
                                                            opacity: 0.6
                                                        }}
                                                        title="Rename Wallet"
                                                    >
                                                        <Pencil size={12} color="#fff" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className={styles.tokenDate}>
                                                {mode === 'wallet'
                                                    ? `${scan.token_address.slice(0, 4)}...${scan.token_address.slice(-4)}`
                                                    : (scan.symbol || 'SOL')
                                                }
                                                <span style={{ margin: '0 6px', opacity: 0.5 }}>•</span>
                                                {Math.max(0, Math.round((Date.now() - new Date(scan.created_at.replace(' ', 'T') + 'Z')) / 60000))}m ago
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


            </main>

            {/* Premium Modal - Moved outside main to avoid z-index/stacking context issues */}
            {showPremiumModal && (
                <PremiumModal
                    walletAddress={walletAddress}
                    onClose={() => setShowPremiumModal(false)}
                    onSuccess={() => window.location.reload()}
                />
            )}
        </div>
    );
}

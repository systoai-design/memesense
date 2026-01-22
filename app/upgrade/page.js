'use client';

import { useState, useEffect } from 'react';
import { Check, Shield, Zap, TrendingUp, Lock, Loader2, PlayCircle } from 'lucide-react';
import styles from './page.module.css';
import { useRouter } from 'next/navigation';
import { Connection, Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

export default function UpgradePage() {
    const router = useRouter();
    const [billingCycle, setBillingCycle] = useState('monthly');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState('');
    const [userTier, setUserTier] = useState('FREE'); // Track tier

    // Config
    const [config, setConfig] = useState(null);

    // Initial Config Load
    useEffect(() => {
        fetch('/api/config/payment')
            .then(res => res.json())
            .then(data => setConfig(data))
            .catch(err => console.error('Failed to load config', err));
    }, []);

    const getProvider = () => {
        if ('phantom' in window) {
            const provider = window.phantom?.solana;
            if (provider?.isPhantom) {
                return provider;
            }
        }
        return null;
    };

    // Check User Status (Already Premium?)
    useEffect(() => {
        const checkStatus = async () => {
            const provider = getProvider();
            if (provider && provider.isConnected) {
                try {
                    const pubKey = provider.publicKey.toString();
                    const res = await fetch('/api/user/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ walletAddress: pubKey })
                    });
                    const data = await res.json();
                    if (data.success) {
                        setUserTier(data.user.tier);
                        if (data.user.tier === 'PREMIUM') {
                            setStatus('active');
                        }
                    }
                } catch (e) {
                    console.error("Failed to check status", e);
                }
            }
        };

        // Check initially and on interval if wallet connects
        checkStatus();

        // Also listen for phantom connect events if possible, but interval is easier for this standalone page
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const handlePayment = async () => {
        setLoading(true);
        setStatus('Initializing...');
        setError('');

        try {
            if (!config || !config.adminWallet) {
                throw new Error('System configuration missing. Please refresh.');
            }

            const provider = getProvider();
            if (!provider) {
                window.open('https://phantom.app/', '_blank');
                throw new Error('Phantom Wallet not found! Please install it.');
            }

            // 1. Connect
            setStatus('Please approve connection...');
            let userPubKey;
            try {
                const resp = await provider.connect();
                userPubKey = resp.publicKey;
            } catch (connErr) {
                throw new Error('Wallet connection denied.');
            }

            if (!userPubKey) throw new Error('Wallet connection failed');

            // 2. Create Transaction using Proxy RPC
            setStatus('Initializing connection...');

            // Use local proxy with absolute URL to avoid CORS/403 on client
            const protocol = window.location.protocol;
            const host = window.location.host;
            const proxyUrl = `${protocol}//${host}/api/rpc`;

            console.log('[Payment] Using Proxy RPC:', proxyUrl);
            const connection = new Connection(proxyUrl, 'confirmed');

            // Get Blockhash
            const { blockhash } = await connection.getLatestBlockhash();

            // Determine price
            const isDev = ['HsmYvnrqiqSMdinKAddYJk3N61vRmhpXq2Sgw3uukV11', 'W6Qe25zGpwRpt7k8Hrg2RANF7N88XP7JU5BEeKaTrJ2'].includes(userPubKey.toString());
            let finalPrice = billingCycle === 'monthly' ? 0.5 : 5.0;
            if (isDev) finalPrice = 0.0001;

            const transaction = new Transaction({
                feePayer: userPubKey,
                recentBlockhash: blockhash,
            }).add(
                SystemProgram.transfer({
                    fromPubkey: userPubKey,
                    toPubkey: new PublicKey(config.adminWallet),
                    lamports: finalPrice * LAMPORTS_PER_SOL,
                })
            );

            // 3. Sign & Send
            setStatus('Please sign transaction...');
            const { signature } = await provider.signAndSendTransaction(transaction);

            setStatus('Verifying payment (do not close)...');
            console.log('Tx sent:', signature);

            // 4. Poll for Confirmation (Robust Method)
            let confirmed = false;
            let retries = 0;
            const maxRetries = 30; // 60 seconds

            while (!confirmed && retries < maxRetries) {
                retries++;
                const { value } = await connection.getSignatureStatus(signature);

                if (value && (value.confirmationStatus === 'confirmed' || value.confirmationStatus === 'finalized')) {
                    confirmed = true;
                    console.log('Transaction confirmed:', value.confirmationStatus);
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            if (!confirmed) {
                console.warn('Local confirmation timed out, checking with backend anyway...');
            }

            // 5. Verify on Backend
            const verifyRes = await fetch('/api/payment/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    signature,
                    walletAddress: userPubKey.toString(),
                    deviceId: localStorage.getItem('memesense_device_id'),
                    plan: billingCycle
                })
            });

            const verifyJson = await verifyRes.json();

            if (!verifyJson.success) {
                throw new Error(verifyJson.error || 'Payment verification failed server-side');
            }

            setStatus('Success! Upgrading...');
            setTimeout(() => {
                router.push('/app'); // Redirect to app
            }, 1000);

        } catch (err) {
            console.error('[Payment Error]', err);
            setError(`${err.message}`);
            setLoading(false);
        }
    };

    const handleTrial = async () => {
        setLoading(true);
        setStatus('Activating trial...');
        setError('');

        try {
            const deviceId = localStorage.getItem('memesense_device_id');
            const userWallet = localStorage.getItem('memesense_wallet'); // Might be null if not connected in app yet

            const res = await fetch('/api/user/trial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId, walletAddress: userWallet })
            });

            const json = await res.json();
            if (!json.success) {
                throw new Error(json.error || 'Trial activation failed');
            }

            setStatus('Trial Activated!');
            setTimeout(() => {
                router.push('/app');
            }, 1000);

        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div onClick={() => router.push('/')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img src="/logo.png" alt="MemeSense" style={{ height: 40 }} />
                </div>
            </header>

            <main className={styles.main}>
                <div className={styles.badge}>
                    ✨ UNLOCK FULL POWER
                </div>

                <h1 className={styles.title}>
                    Stop Guessing. <br />
                    <span className={styles.gradientText}>Start Knowing.</span>
                </h1>

                {error && (
                    <div style={{ backgroundColor: 'rgba(255,0,0,0.2)', color: '#ff4d4d', padding: '10px 20px', borderRadius: 8, margin: '20px 0', border: '1px solid #ff4d4d' }}>
                        ⚠️ {error}
                    </div>
                )}

                {loading && (
                    <div style={{ margin: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <Loader2 className={styles.spin} size={32} color="#ccff00" />
                        <span style={{ color: '#ccff00' }}>{status}</span>
                    </div>
                )}

                {/* Pricing Switcher */}
                <div className={styles.switcherContainer}>
                    <button
                        className={`${styles.switchBtn} ${billingCycle === 'monthly' ? styles.active : ''}`}
                        onClick={() => setBillingCycle('monthly')}
                    >
                        Monthly
                    </button>
                    <button
                        className={`${styles.switchBtn} ${billingCycle === 'lifetime' ? styles.active : ''}`}
                        onClick={() => setBillingCycle('lifetime')}
                    >
                        Lifetime <span className={styles.saveBadge}>SAVE 40%</span>
                    </button>
                </div>

                <div className={styles.pricingGrid}>
                    {/* Free Plan */}
                    <div className={styles.planCard}>
                        <div className={styles.planHeader}>
                            <h3>Free</h3>
                            <div className={styles.price}>
                                $0
                                <span className={styles.period}>/mo</span>
                            </div>
                        </div>
                        <ul className={styles.featureList}>
                            <li><Check size={16} /> 10 Token Scans / Day</li>
                            <li><Check size={16} /> Basic Risk Level</li>
                            <li><Check size={16} /> Top 5 Holders</li>
                            <li className={styles.disabled}><Lock size={14} /> Whale Tracking</li>
                            <li className={styles.disabled}><Lock size={14} /> Profit Tracker</li>
                        </ul>

                        {/* Trial button moved to Pro card */}
                        <button
                            className={styles.currentBtn}
                            onClick={() => router.push('/app')}
                            style={{
                                marginTop: 'auto',
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.2)',
                                color: '#fff',
                                cursor: 'pointer'
                            }}
                        >
                            Start Free
                        </button>
                    </div>

                    {/* Pro Plan */}
                    <div className={`${styles.planCard} ${styles.highlighted}`}>
                        <div className={styles.popularBadge}>MOST POPULAR</div>
                        <div className={styles.planHeader}>
                            <h3>Pro Access</h3>
                            <div className={styles.price}>
                                {billingCycle === 'monthly' ? '0.5 SOL' : '5 SOL'}
                                <span className={styles.period}>/{billingCycle === 'monthly' ? 'mo' : 'once'}</span>
                            </div>
                        </div>
                        <ul className={styles.featureList}>
                            <li><Zap size={16} color="#ccff00" /> Unlimited Token Scans</li>
                            <li><Shield size={16} color="#ccff00" /> Advanced Anti-Rug AI</li>
                            <li><TrendingUp size={16} color="#ccff00" /> Wallet Profitability Tracker</li>
                            <li><Check size={16} color="#ccff00" /> Top 50 Holders Analysis</li>
                            <li><Check size={16} color="#ccff00" /> Dev Wallet tracking</li>
                            <li><Check size={16} color="#ccff00" /> Priority Support</li>
                        </ul>
                        {userTier === 'PREMIUM' || status === 'active' ? (
                            <button
                                className={styles.upgradeBtn}
                                onClick={() => router.push('/app')}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    border: '1px solid #ccff00',
                                    color: '#ccff00'
                                }}
                            >
                                ✨ Premium Active - Go to App
                            </button>
                        ) : (
                            <button
                                className={styles.upgradeBtn}
                                onClick={handlePayment}
                                disabled={loading}
                            >
                                {loading ? 'Processing...' : 'Upgrade with SOL 🚀'}
                            </button>
                        )}

                        {/* TRIAL BUTTON MOVED HERE */}
                        <button
                            onClick={handleTrial}
                            disabled={loading}
                            style={{
                                marginTop: 15,
                                background: 'transparent',
                                color: '#888',
                                border: 'none',
                                fontSize: '13px',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                width: '100%'
                            }}
                        >
                            Or start a 3-day free trial
                        </button>
                    </div>
                </div>

                <div className={styles.guarantee} style={{ marginTop: 40, opacity: 0.6 }}>
                    <Shield size={20} />
                    <span>Secure On-Chain Payment via Solana</span>
                </div>
            </main>
        </div>
    );
}

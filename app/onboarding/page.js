'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function Onboarding() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [walletAddress, setWalletAddress] = useState(null);

    useEffect(() => {
        const checkWallet = async () => {
            if (window.solana && window.solana.isPhantom) {
                try {
                    // Try to connect silently first
                    const resp = await window.solana.connect({ onlyIfTrusted: true });
                    setWalletAddress(resp.publicKey.toString());
                } catch (err) {
                    console.warn("Silent connect failed", err);
                }
            }
        };
        checkWallet();
    }, []);

    const ensureWalletConnected = async () => {
        let currentWallet = walletAddress;
        if (!currentWallet) {
            if (window.solana && window.solana.isPhantom) {
                try {
                    const resp = await window.solana.connect();
                    currentWallet = resp.publicKey.toString();
                    setWalletAddress(currentWallet);
                    return currentWallet;
                } catch (err) {
                    alert("Please connect your wallet to continue.");
                    return null;
                }
            } else {
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                if (isMobile) {
                    const currentUrl = window.location.href;
                    const ref = window.location.origin;
                    const deepLink = `https://phantom.app/ul/browse/${encodeURIComponent(currentUrl)}?ref=${encodeURIComponent(ref)}`;
                    window.open(deepLink, '_blank');
                    return null;
                }
                alert("Phantom wallet not found. Please install the Phantom wallet extension.");
                return null;
            }
        }
        return currentWallet;
    };

    const handleFreeTier = async () => {
        const wallet = await ensureWalletConnected();
        if (!wallet) return;

        setLoading(true);
        try {
            // Standard onboarding (defaults to FREE)
            await fetch('/api/user/onboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: wallet })
            });
            router.push('/app');
        } catch (error) {
            console.error("Free Tier Error:", error);
            setLoading(false);
        }
    };

    const handleTrialTier = async () => {
        const wallet = await ensureWalletConnected();
        if (!wallet) return;

        setLoading(true);
        try {
            const deviceId = localStorage.getItem('memesense_device_id');
            const res = await fetch('/api/user/trial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: wallet, deviceId })
            });

            const data = await res.json();
            if (data.success) {
                router.push('/app');
            } else {
                throw new Error(data.error || 'Trial activation failed');
            }
        } catch (error) {
            console.error("Trial Error:", error);
            alert(error.message);
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.wizard}>
                <div className={styles.progress}>
                    <div className={`${styles.dot} ${step === 1 ? styles.dotActive : ''}`}></div>
                    <div className={`${styles.dot} ${step === 2 ? styles.dotActive : ''}`}></div>
                    <div className={`${styles.dot} ${step === 3 ? styles.dotActive : ''}`}></div>
                </div>

                {step === 1 && (
                    <>
                        <span className={styles.stepIcon}>👋</span>
                        <h1 className={styles.title}>Welcome to MemeSense</h1>
                        <p className={styles.description}>
                            You're about to access the most powerful memecoin analysis engine on Solana.
                            Let's get you set up.
                        </p>
                        <button className={styles.button} onClick={() => setStep(2)}>
                            Let's Go
                        </button>
                    </>
                )}

                {step === 2 && (
                    <>
                        <span className={styles.stepIcon}>🔔</span>
                        <h1 className={styles.title}>Stay Updated</h1>
                        <p className={styles.description}>
                            Connect your Telegram to receive instant alerts when your tracked tokens hit buy or sell signals.
                        </p>
                        <button className={styles.button} onClick={() => {
                            window.open('https://t.me/meme_sense', '_blank');
                            setStep(3);
                        }}>
                            Connect Telegram
                        </button>
                        <button className={`${styles.button} ${styles.buttonSecondary}`} onClick={() => setStep(3)}>
                            Skip for now
                        </button>
                    </>
                )}

                {step === 3 && (
                    <>
                        <span className={styles.stepIcon}>💎</span>
                        <h1 className={styles.title}>Choose Your Path</h1>
                        <p className={styles.description} style={{ marginBottom: '20px' }}>
                            Select how you want to start your journey.
                        </p>

                        {/* Trial Option (Featured) */}
                        <div style={{
                            background: 'rgba(204, 255, 0, 0.1)',
                            border: '1px solid #CCFF00',
                            borderRadius: '16px',
                            padding: '20px',
                            marginBottom: '16px',
                            textAlign: 'left'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <h3 style={{ color: '#fff', margin: 0, fontSize: '18px' }}>Pro Trial</h3>
                                <span style={{ background: '#CCFF00', color: '#000', fontSize: '12px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '100px' }}>POPULAR</span>
                            </div>
                            <ul style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', paddingLeft: '20px', margin: '0 0 16px 0' }}>
                                <li>Unlimited Scans & Analyses</li>
                                <li>Copy Trading Strategy Card</li>
                                <li>Deep Whale & Sniper Tracking</li>
                                <li>3 Days Free Access</li>
                            </ul>
                            <button className={styles.button} onClick={handleTrialTier} disabled={loading}>
                                {loading ? <span className={styles.loader}></span> : 'Start Free 3-Day Trial'}
                            </button>
                            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', margin: 0 }}>No credit card required</p>
                        </div>

                        {/* Free Option */}
                        <div style={{
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '16px',
                            padding: '16px',
                            textAlign: 'left'
                        }}>
                            <h3 style={{ color: '#fff', margin: '0 0 8px 0', fontSize: '18px' }}>Standard</h3>
                            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '0 0 16px 0' }}>
                                Basic access with 10 scans per day. Good for casual checking.
                            </p>
                            <button className={`${styles.button} ${styles.buttonSecondary}`} onClick={handleFreeTier} disabled={loading}>
                                Continue as Free User
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

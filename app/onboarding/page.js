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

    const handleComplete = async () => {
        let currentWallet = walletAddress;

        // Double check wallet connection if missing
        if (!currentWallet) {
            if (window.solana && window.solana.isPhantom) {
                try {
                    const resp = await window.solana.connect();
                    currentWallet = resp.publicKey.toString();
                    setWalletAddress(currentWallet);
                } catch (err) {
                    alert("Please connect your wallet to continue.");
                    return;
                }
            } else {
                alert("Phantom wallet not found.");
                return;
            }
        }

        setLoading(true);
        try {
            console.log("Sending onboarding request for:", currentWallet);
            const res = await fetch('/api/user/onboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: currentWallet })
            });

            console.log("Onboarding response status:", res.status);

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                console.error("Onboarding failed details:", errData);
                throw new Error(errData.error || 'Onboarding failed');
            }

            // Success - Redirect
            console.log("Onboarding success, redirecting...");
            router.push('/app');
        } catch (error) {
            console.error("Onboarding Exception:", error);
            alert(`Something went wrong: ${error.message}`);
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
                        <span className={styles.stepIcon}>🚀</span>
                        <h1 className={styles.title}>Ready for Liftoff</h1>
                        <p className={styles.description}>
                            Your dashboard is ready. Analyze any pump.fun token instantly.
                        </p>
                        <button className={styles.button} onClick={handleComplete} disabled={loading}>
                            {loading ? <span className={styles.loader}></span> : 'Enter Dashboard'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

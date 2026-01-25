
'use client';

import { useState, useEffect } from 'react';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import styles from '@/app/app/page.module.css';

const ADMIN_WALLET = '2unNnTnv5DcmtdQYAJuLzg4azHu67obGL9dX8PYwxUDQ';
const PRICE_SOL = 5;
const DEV_WALLETS = [
    'HsmYvnrqiqSMdinKAddYJk3N61vRmhpXq2Sgw3uukV11',
    'W6Qe25zGpwRpt7k8Hrg2RANF7N88XP7JU5BEeKaTrJ2',
    'BUbC5ugi4tnscNowHrNfvNsU5SZfMfcnBv7NotvdWyq8'
];

export default function PremiumModal({ onClose, onSuccess, walletAddress }) {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('idle');
    const [errorMessage, setErrorMessage] = useState(null);
    const [plan, setPlan] = useState('lifetime');
    const [userTier, setUserTier] = useState('FREE');

    const PRICES = {
        monthly: 0.5,
        lifetime: 5
    };

    useEffect(() => {
        const checkStatus = async () => {
            if (!walletAddress) return;
            try {
                const res = await fetch('/api/user/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ walletAddress })
                });
                const data = await res.json();
                if (data.success) {
                    setUserTier(data.user.tier);
                    if (data.user.tier === 'PREMIUM' || data.user.tier === 'TRIAL') {
                        setStatus('active');
                    }
                }
            } catch (e) {
                console.error("Failed to check status", e);
            }
        };
        checkStatus();
    }, [walletAddress]);

    const isDev = DEV_WALLETS.includes(walletAddress);
    const finalPrice = isDev ? 0.0001 : PRICES[plan];

    const handlePayment = async () => {
        if (!window.solana || !window.solana.isPhantom) {
            alert('Phantom wallet is required!');
            return;
        }

        setLoading(true);
        setStatus('signing');
        setErrorMessage(null);

        try {
            // 1. Establish Connection
            const protocol = window.location.protocol;
            const host = window.location.host;
            const proxyUrl = `${protocol}//${host}/api/rpc`;
            const connection = new Connection(proxyUrl, 'confirmed');
            const fromPubkey = new PublicKey(walletAddress);
            const toPubkey = new PublicKey(ADMIN_WALLET);

            // 2. Create Transaction
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey,
                    toPubkey,
                    lamports: finalPrice * LAMPORTS_PER_SOL,
                })
            );

            // Get recent blockhash
            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = fromPubkey;

            // 3. Request Signature
            const { signature } = await window.solana.signAndSendTransaction(transaction);
            console.log('Transaction sent:', signature);

            setStatus('verifying');

            // 4. Poll for Confirmation
            let confirmed = false;
            let retries = 0;
            const maxRetries = 30;

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

            // 5. Send to Backend for Verification
            const res = await fetch('/api/user/upgrade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress,
                    signature,
                    plan
                })
            });

            const data = await res.json();

            if (data.success) {
                setStatus('success');
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 2000);
            } else {
                throw new Error(data.error || 'Verification failed');
            }

        } catch (error) {
            console.error('Payment failed:', error);
            setStatus('error');
            setErrorMessage(error.message || 'Transaction failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.authModalOverlay} style={{ padding: '20px', alignItems: 'center' }}>
            <div
                className={`${styles.authModalCard} glass-card`}
                style={{
                    maxWidth: '500px',
                    width: '100%',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    position: 'relative',
                    margin: 'auto'
                }}
            >
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '15px',
                        right: '15px',
                        background: 'none',
                        border: 'none',
                        fontSize: '24px',
                        color: '#666',
                        cursor: 'pointer'
                    }}
                >
                    &times;
                </button>

                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '10px' }}>💎</div>
                    <h2 className={styles.authModalTitle} style={{ color: '#fbbf24' }}>Upgrade to Premium</h2>
                    <p className={styles.authModalSubtitle}>
                        Unlock professional-grade tools and gain the unfair advantage.
                    </p>
                </div>

                {/* Plan Toggles */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', background: 'rgba(255,255,255,0.05)', padding: '5px', borderRadius: '100px' }}>
                    <button
                        onClick={() => setPlan('monthly')}
                        children="Monthly (0.5 SOL)"
                        style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '100px',
                            border: 'none',
                            background: plan === 'monthly' ? '#fbbf24' : 'transparent',
                            color: plan === 'monthly' ? '#000' : '#888',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    />
                    <button
                        onClick={() => setPlan('lifetime')}
                        children="Lifetime (5 SOL)"
                        style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '100px',
                            border: 'none',
                            background: plan === 'lifetime' ? '#fbbf24' : 'transparent',
                            color: plan === 'lifetime' ? '#000' : '#888',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    />
                </div>

                <div className="features-list" style={{ textAlign: 'left', marginBottom: '30px', background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ marginRight: '10px' }}>🐋</span>
                        <span><strong>Whale Analysis:</strong> Track smart money & fresh wallets</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ marginRight: '10px' }}>🔫</span>
                        <span><strong>Sniper Detection:</strong> See exactly who sniped the launch</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ marginRight: '10px' }}>👛</span>
                        <span><strong>Wallet Clustering:</strong> Detect dev bundles & cabals</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ marginRight: '10px' }}>⚡</span>
                        <span><strong>Unlimited Scans:</strong> No daily limits</span>
                    </div>
                </div>

                {status === 'error' && (
                    <div style={{ color: '#ef4444', marginBottom: '15px', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>
                        Error: {errorMessage}
                    </div>
                )}

                {status === 'active' ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '10px' }}>👑</div>
                        <h3 style={{ color: '#fbbf24', fontSize: '1.5rem', marginBottom: '10px' }}>Premium Active</h3>
                        <p style={{ color: '#ccc', marginBottom: '20px' }}>
                            You already have a Premium subscription active on this wallet.
                        </p>
                        <button
                            onClick={onClose}
                            className="btn"
                            style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                color: '#fff',
                                padding: '10px 20px',
                                width: '100%',
                                cursor: 'pointer'
                            }}
                        >
                            Close
                        </button>
                    </div>
                ) : status === 'success' ? (
                    <div style={{ color: '#22c55e', fontSize: '1.2rem', fontWeight: 'bold' }}>
                        🎉 Upgrade Successful! Refreshing...
                    </div>
                ) : (
                    <button
                        onClick={handlePayment}
                        disabled={loading}
                        className="btn btn-primary"
                        style={{
                            width: '100%',
                            padding: '16px',
                            fontSize: '1.1rem',
                            background: 'linear-gradient(45deg, #fbbf24, #d97706)',
                            border: 'none',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? (
                            status === 'signing' ? 'Wait for Wallet...' : 'Verifying Payment...'
                        ) : (
                            `Pay ${finalPrice} SOL ${plan === 'lifetime' ? 'Lifetime' : 'Monthly'}`
                        )}
                    </button>
                )}

                <p style={{ marginTop: '15px', fontSize: '0.8rem', color: '#666' }}>
                    One-time payment. Lifetime access. v2.0
                </p>

                {/* Trial Activation Option */}
                {userTier === 'FREE' && (
                    <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <p style={{ fontSize: '0.9rem', marginBottom: '12px', color: '#ccff00' }}>Not ready to commit?</p>
                        <button
                            onClick={async () => {
                                if (loading) return;
                                setLoading(true);
                                setErrorMessage(null);
                                try {
                                    const deviceId = localStorage.getItem('memesense_device_id');
                                    const res = await fetch('/api/user/trial', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ walletAddress, deviceId })
                                    });
                                    const data = await res.json();
                                    if (data.success) {
                                        setStatus('success');
                                        setTimeout(() => {
                                            onSuccess();
                                            onClose();
                                        }, 1500);
                                    } else {
                                        throw new Error(data.error || 'Trial activation failed');
                                    }
                                } catch (e) {
                                    setErrorMessage(e.message);
                                    setStatus('error');
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            className="btn"
                            disabled={loading}
                            style={{
                                background: 'rgba(204, 255, 0, 0.1)',
                                border: '1px solid #ccff00',
                                color: '#ccff00',
                                padding: '10px 20px',
                                width: '100%',
                                cursor: 'pointer'
                            }}
                        >
                            Start 3-Day Free Trial
                        </button>
                        <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '8px' }}>
                            No credit card required. One-time use only.
                        </p>
                    </div>
                )}

                {userTier === 'TRIAL' && (
                    <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                        <p style={{ color: '#ccff00', fontWeight: 'bold' }}>🎁 3-Day Trial Active</p>
                    </div>
                )}
            </div>
        </div>
    );
}

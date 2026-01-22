
'use client';

import { useState } from 'react';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import styles from '@/app/app/page.module.css'; // Reuse existing styles or inline

const ADMIN_WALLET = '2unNnTnv5DcmtdQYAJuLzg4azHu67obGL9dX8PYwxUDQ'; // Hardcoded fallback or passed as prop
const PRICE_SOL = 5;
const DEV_WALLETS = [
    'HsmYvnrqiqSMdinKAddYJk3N61vRmhpXq2Sgw3uukV11',
    'W6Qe25zGpwRpt7k8Hrg2RANF7N88XP7JU5BEeKaTrJ2'
];

export default function PremiumModal({ onClose, onSuccess, walletAddress }) {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('idle'); // idle, signing, verifying, success, error
    const [errorMessage, setErrorMessage] = useState(null);

    // Dynamic Price Logic
    const finalPrice = DEV_WALLETS.includes(walletAddress) ? 0.0001 : PRICE_SOL;

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
            // Use local proxy with absolute URL
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

            // 4. Send to Backend for Verification
            // We wait a few seconds for propagation if purely relying on backend
            // But let's call immediately, backend will poll/wait or we utilize 'confirmed' status locally first?
            // Backend `verifyPayment` uses `getParsedTransaction`, so it needs to be confirmed.
            // We should wait for confirmation locally for better UX before calling backend.

            await connection.confirmTransaction(signature, 'confirmed');

            const res = await fetch('/api/user/upgrade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress,
                    signature
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

                {status === 'success' ? (
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
                            `Pay ${finalPrice} SOL Lifetime`
                        )}
                    </button>
                )}

                <p style={{ marginTop: '15px', fontSize: '0.8rem', color: '#666' }}>
                    One-time payment. Lifetime access. v2.0
                </p>

                {/* Trial Activation Option */}
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
            </div>
        </div>
    );
}

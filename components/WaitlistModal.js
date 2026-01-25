'use client';

import { useState } from 'react';
import { X, Check, Rocket, Loader2 } from 'lucide-react';

export default function WaitlistModal({ onClose }) {
    const [step, setStep] = useState('input'); // 'input' | 'success'
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({ name: '', email: '' });

    const handleSubmit = (e) => {
        e.preventDefault();
        setLoading(true);

        // Simulate API call
        setTimeout(() => {
            setLoading(false);
            setStep('success');
            // Optional: Save to localStorage for persistence/demo
            localStorage.setItem('memesense_waitlist_email', formData.email);
        }, 1500);
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20
        }}>
            <div style={{
                background: 'rgba(20, 20, 25, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '24px',
                padding: '32px',
                maxWidth: '420px',
                width: '100%',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Close Button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: 20,
                        right: 20,
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255,255,255,0.4)',
                        cursor: 'pointer'
                    }}
                >
                    <X size={20} />
                </button>

                {step === 'input' ? (
                    <>
                        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                            <div style={{
                                width: 48, height: 48, background: 'rgba(204, 255, 0, 0.1)',
                                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 16px', color: '#ccff00'
                            }}>
                                <Rocket size={24} />
                            </div>
                            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
                                Join the Beta
                            </h2>
                            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.5 }}>
                                Get early access to the mobile app and start hunting whales before anyone else.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 6, fontWeight: 600 }}>NAME</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Satoshi"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        color: '#fff',
                                        fontSize: 16,
                                        outline: 'none'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 6, fontWeight: 600 }}>EMAIL</label>
                                <input
                                    type="email"
                                    required
                                    placeholder="satoshi@solana.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        color: '#fff',
                                        fontSize: 16,
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    marginTop: 8,
                                    padding: '14px',
                                    background: '#ccff00',
                                    color: '#000',
                                    fontWeight: 700,
                                    fontSize: 16,
                                    borderRadius: '12px',
                                    border: 'none',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    opacity: loading ? 0.7 : 1
                                }}
                            >
                                {loading && <Loader2 size={18} className="spin-anim" />}
                                {loading ? 'Joining...' : 'Join Waitlist'}
                            </button>
                            <style jsx>{`
                                .spin-anim { animation: spin 1s linear infinite; }
                                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                            `}</style>
                        </form>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{
                            width: 64, height: 64, background: 'rgba(204, 255, 0, 0.1)',
                            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 24px', color: '#ccff00'
                        }}>
                            <Check size={32} />
                        </div>
                        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 16 }}>
                            You're on the list!
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
                            Thank you for joining the beta users.<br />We'll notify <strong>{formData.email}</strong> as soon as your spot opens up.
                        </p>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '12px 32px',
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: '#fff',
                                fontWeight: 600,
                                fontSize: 15,
                                borderRadius: '100px',
                                cursor: 'pointer'
                            }}
                        >
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import styles from '../page.module.css';

export default function TermsPage() {
    return (
        <div className={styles.page} style={{ minHeight: '100vh', paddingBottom: '80px' }}>
            <header className={styles.header} style={{ position: 'relative', top: 0, width: '100%', marginBottom: '40px' }}>
                <Link href="/" className={styles.logoContainer} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
                    <ArrowLeft size={20} />
                    <span>Back to Home</span>
                </Link>
            </header>

            <main className={styles.main}>
                <div style={{
                    background: 'rgba(20, 20, 20, 0.6)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '24px',
                    padding: '40px',
                    maxWidth: '800px',
                    margin: '0 auto',
                    textAlign: 'left'
                }}>
                    <h1 style={{ fontSize: '32px', marginBottom: '24px', color: 'var(--primary)' }}>Terms of Service</h1>
                    <p style={{ color: '#ccc', marginBottom: '32px' }}>Last Updated: January 2026</p>

                    <section style={{ marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '20px', marginBottom: '16px', color: 'white' }}>1. Not Financial Advice</h2>
                        <div style={{ padding: '16px', background: 'rgba(255, 165, 0, 0.1)', border: '1px solid rgba(255, 165, 0, 0.3)', borderRadius: '8px', color: '#ffcc00' }}>
                            <strong>DISCLAIMER:</strong> MemeSense is a data analysis tool. Nothing on this website constitutes financial, investment, legal, or tax advice. Cryptocurrency trading involves substantial risk of loss and is not suitable for every investor. You are solely responsible for your investment decisions.
                        </div>
                    </section>

                    <section style={{ marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '20px', marginBottom: '16px', color: 'white' }}>2. Acceptance of Terms</h2>
                        <p style={{ color: '#aaa', lineHeight: '1.6' }}>
                            By accessing or using MemeSense, you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the Service.
                        </p>
                    </section>

                    <section style={{ marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '20px', marginBottom: '16px', color: 'white' }}>3. Use License</h2>
                        <p style={{ color: '#aaa', lineHeight: '1.6' }}>
                            Permission is granted to temporarily use MemeSense for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
                        </p>
                        <ul style={{ color: '#aaa', lineHeight: '1.6', marginLeft: '20px', marginTop: '10px' }}>
                            <li>Modify or copy the materials;</li>
                            <li>Use the materials for any commercial purpose, or for any public display;</li>
                            <li>Attempt to decompile or reverse engineer any software contained on MemeSense's website;</li>
                        </ul>
                    </section>

                    <section style={{ marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '20px', marginBottom: '16px', color: 'white' }}>4. Disclaimer of Warranties</h2>
                        <p style={{ color: '#aaa', lineHeight: '1.6' }}>
                            The materials on MemeSense are provided on an 'as is' basis. MemeSense makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
                        </p>
                    </section>

                    <section style={{ marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '20px', marginBottom: '16px', color: 'white' }}>5. Limitation of Liability</h2>
                        <p style={{ color: '#aaa', lineHeight: '1.6' }}>
                            In no event shall MemeSense or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use MemeSense, even if MemeSense has been notified orally or in writing of the possibility of such damage.
                        </p>
                    </section>
                </div>
            </main>
        </div>
    );
}

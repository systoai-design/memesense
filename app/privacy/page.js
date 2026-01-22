'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import styles from '../page.module.css'; // Reusing main styles for consistency

export default function PrivacyPage() {
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
                    <h1 style={{ fontSize: '32px', marginBottom: '24px', color: 'var(--primary)' }}>Privacy Policy</h1>
                    <p style={{ color: '#ccc', marginBottom: '32px' }}>Last Updated: January 2026</p>

                    <section style={{ marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '20px', marginBottom: '16px', color: 'white' }}>1. Introduction</h2>
                        <p style={{ color: '#aaa', lineHeight: '1.6' }}>
                            MemeSense ("we", "us", or "our") respects your privacy. This Privacy Policy explains how we collect, use, and protect your information when you use our website and services. By using MemeSense, you agree to the collection and use of information in accordance with this policy.
                        </p>
                    </section>

                    <section style={{ marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '20px', marginBottom: '16px', color: 'white' }}>2. Data Collection</h2>
                        <p style={{ color: '#aaa', lineHeight: '1.6' }}>
                            We collect minimal data necessary to provide our services:
                        </p>
                        <ul style={{ color: '#aaa', lineHeight: '1.6', marginLeft: '20px', marginTop: '10px' }}>
                            <li><strong>Public Blockchain Data:</strong> We analyze public wallet addresses and transaction history available on the Solana blockchain.</li>
                            <li><strong>Usage Data:</strong> We may collect anonymous analytics data (page views, interactions) to improve our app performance.</li>
                            <li><strong>Local Storage:</strong> We use your browser's local storage to save your preferences and recent searches locally on your device.</li>
                        </ul>
                    </section>

                    <section style={{ marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '20px', marginBottom: '16px', color: 'white' }}>3. How We Use Data</h2>
                        <p style={{ color: '#aaa', lineHeight: '1.6' }}>
                            We use the collected data for the following purposes:
                        </p>
                        <ul style={{ color: '#aaa', lineHeight: '1.6', marginLeft: '20px', marginTop: '10px' }}>
                            <li>To provide and maintain our Service.</li>
                            <li>To monitor the usage of our Service.</li>
                            <li>To detect, prevent, and address technical issues.</li>
                        </ul>
                    </section>

                    <section style={{ marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '20px', marginBottom: '16px', color: 'white' }}>4. Cookies</h2>
                        <p style={{ color: '#aaa', lineHeight: '1.6' }}>
                            We use standard cookies and similar tracking technologies to track the activity on our Service and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
                        </p>
                    </section>

                    <section style={{ marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '20px', marginBottom: '16px', color: 'white' }}>5. Third-Party Services</h2>
                        <p style={{ color: '#aaa', lineHeight: '1.6' }}>
                            We may employ third-party companies and individuals to facilitate our Service (e.g., RPC providers, Analytics). These third parties have access to your data only to perform these tasks on our behalf and are obligated not to disclose or use it for any other purpose.
                        </p>
                    </section>

                    <section style={{ marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '20px', marginBottom: '16px', color: 'white' }}>6. Security</h2>
                        <p style={{ color: '#aaa', lineHeight: '1.6' }}>
                            The security of your data is important to us, but remember that no method of transmission over the Internet is 100% secure. While we strive to use commercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security.
                        </p>
                    </section>
                </div>
            </main>
        </div>
    );
}

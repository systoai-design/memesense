'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function Home() {
  const [ca, setCA] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleAnalyze = async (e) => {
    e.preventDefault();

    // Validate CA format (Solana addresses are 32-44 chars, base58)
    const caRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!caRegex.test(ca.trim())) {
      setError('Please enter a valid Solana contract address');
      return;
    }

    setError('');
    setLoading(true);

    // Navigate to analysis page
    router.push(`/analyze/${ca.trim()}`);
  };

  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🧠</span>
          <span className={styles.logoText}>MemeSense</span>
          <span className={styles.badge}>BETA</span>
        </div>
        <nav className={styles.nav}>
          <a href="/dashboard" className={styles.navLink}>Dashboard</a>
          <button className="btn btn-secondary">Connect Wallet</button>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroGlow}></div>
          <h1 className={styles.title}>
            AI-Powered <span className={styles.gradient}>Memecoin</span> Analysis
          </h1>
          <p className={styles.subtitle}>
            Analyze any pump.fun token instantly. Get profitability predictions,
            holder insights, and graduation probability powered by Gemini AI.
          </p>

          {/* CA Input Form */}
          <form onSubmit={handleAnalyze} className={styles.searchForm}>
            <div className={styles.inputWrapper}>
              <input
                type="text"
                className={`input ${styles.caInput}`}
                placeholder="Enter contract address (CA)..."
                value={ca}
                onChange={(e) => setCA(e.target.value)}
                disabled={loading}
              />
              <button
                type="submit"
                className={`btn btn-primary ${styles.analyzeBtn}`}
                disabled={loading || !ca.trim()}
              >
                {loading ? (
                  <>
                    <span className="spinner" style={{ width: 20, height: 20 }}></span>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                    Analyze Token
                  </>
                )}
              </button>
            </div>
            {error && <p className={styles.error}>{error}</p>}
          </form>

          {/* Quick Stats */}
          <div className={styles.quickStats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>50K+</span>
              <span className={styles.statLabel}>Tokens Analyzed</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>89%</span>
              <span className={styles.statLabel}>Prediction Accuracy</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>Real-time</span>
              <span className={styles.statLabel}>Data Updates</span>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className={styles.features}>
          <h2 className={styles.sectionTitle}>What You Get</h2>
          <div className={styles.featuresGrid}>
            <div className={`card ${styles.featureCard}`}>
              <div className={styles.featureIcon}>📊</div>
              <h3>Profitability Score</h3>
              <p>AI analyzes chart patterns, volume, and momentum to predict profit probability.</p>
            </div>
            <div className={`card ${styles.featureCard}`}>
              <div className={styles.featureIcon}>👥</div>
              <h3>Holder Analysis</h3>
              <p>See holder distribution, whale wallets, and top holder behavior.</p>
            </div>
            <div className={`card ${styles.featureCard}`}>
              <div className={styles.featureIcon}>📈</div>
              <h3>Buy/Sell Ratio</h3>
              <p>Real-time tracking of buy vs sell pressure and volume trends.</p>
            </div>
            <div className={`card ${styles.featureCard}`}>
              <div className={styles.featureIcon}>🎓</div>
              <h3>Graduation Chance</h3>
              <p>Bonding curve progress and probability of reaching Raydium.</p>
            </div>
            <div className={`card ${styles.featureCard}`}>
              <div className={styles.featureIcon}>🤖</div>
              <h3>AI Chart Reading</h3>
              <p>Gemini Vision analyzes candlestick patterns like a pro trader.</p>
            </div>
            <div className={`card ${styles.featureCard}`}>
              <div className={styles.featureIcon}>⚡</div>
              <h3>Instant Analysis</h3>
              <p>Get comprehensive insights in seconds, not hours.</p>
            </div>
          </div>
        </section>

        {/* Tier Section */}
        <section className={styles.tiers}>
          <h2 className={styles.sectionTitle}>Choose Your Plan</h2>
          <div className={styles.tierCards}>
            <div className={`card ${styles.tierCard}`}>
              <div className={styles.tierHeader}>
                <h3>Free</h3>
                <div className={styles.tierPrice}>$0</div>
              </div>
              <ul className={styles.tierFeatures}>
                <li>✓ 5 analyses per day</li>
                <li>✓ Basic AI insights</li>
                <li>✓ Last 24h data</li>
                <li>✓ Top 5 holders</li>
                <li className={styles.disabled}>✗ Export reports</li>
                <li className={styles.disabled}>✗ Real-time updates</li>
              </ul>
              <button className="btn btn-secondary" style={{ width: '100%' }}>
                Current Plan
              </button>
            </div>
            <div className={`card ${styles.tierCard} ${styles.tierPremium}`}>
              <div className={styles.premiumBadge}>POPULAR</div>
              <div className={styles.tierHeader}>
                <h3>Premium</h3>
                <div className={styles.tierPrice}>∞ Credits</div>
              </div>
              <ul className={styles.tierFeatures}>
                <li>✓ Unlimited analyses</li>
                <li>✓ Advanced AI signals</li>
                <li>✓ 7-day historical data</li>
                <li>✓ Top 50 holders + whales</li>
                <li>✓ Export PDF/CSV</li>
                <li>✓ Real-time updates</li>
              </ul>
              <button className="btn btn-primary" style={{ width: '100%' }}>
                Top Up Credits
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>MemeSense © 2026 | Not financial advice. Trade responsibly.</p>
      </footer>
    </div>
  );
}

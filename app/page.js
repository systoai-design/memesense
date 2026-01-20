'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';
// Branding Updated: Powered by Grok

// ===== SCROLL REVEAL HOOK =====
const useScrollReveal = (threshold = 0.1) => {
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                }
            },
            { threshold }
        );

        const current = ref.current;
        if (current) observer.observe(current);

        return () => {
            if (current) observer.unobserve(current);
        };
    }, [threshold]);

    return [ref, isVisible];
};

// ===== REVEAL WRAPPER COMPONENT =====
const Reveal = ({ children, delay = 0, className = '' }) => {
    const [ref, isVisible] = useScrollReveal();
    return (
        <div
            ref={ref}
            className={`${styles.reveal} ${isVisible ? styles.revealed : ''} ${className}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
};

// ===== CODED PHONE MOCKUP COMPONENT =====
const PhoneMockup = () => {
    return (
        <div className={styles.phoneMockupWrapper}>
            <div className={styles.phoneDevice}>
                {/* Phone Frame */}
                <div className={styles.phoneFrame}>
                    {/* Notch */}
                    <div className={styles.phoneNotch}>
                        <div className={styles.phoneSpeaker}></div>
                        <div className={styles.phoneCamera}></div>
                    </div>

                    {/* Screen Content */}
                    <div className={styles.phoneScreen}>
                        {/* Status Bar */}
                        <div className={styles.phoneStatusBar}>
                            <span>9:41</span>
                            <div className={styles.phoneStatusIcons}>
                                <span>5G</span>
                                <span>100%</span>
                            </div>
                        </div>

                        {/* App Header */}
                        <div className={styles.phoneAppHeader}>
                            <div className={styles.phoneAppLogo}>MS</div>
                            <span className={styles.phoneAppTitle}>MemeSense</span>
                        </div>

                        {/* Token Card */}
                        <div className={styles.phoneTokenCard}>
                            <div className={styles.phoneTokenHeader}>
                                <span className={styles.phoneTokenName}>$PEPE</span>
                                <span className={styles.phoneTokenChange}>+420%</span>
                            </div>
                            <div className={styles.phoneChart}>
                                <svg viewBox="0 0 100 40" className={styles.phoneChartSvg}>
                                    <defs>
                                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
                                            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    <path
                                        d="M0,35 Q15,30 25,28 T45,20 T65,12 T85,8 T100,5"
                                        fill="none"
                                        stroke="var(--primary)"
                                        strokeWidth="2"
                                    />
                                    <path
                                        d="M0,35 Q15,30 25,28 T45,20 T65,12 T85,8 T100,5 V40 H0 Z"
                                        fill="url(#chartGrad)"
                                    />
                                </svg>
                            </div>
                        </div>

                        {/* Signal Badge */}
                        <div className={styles.phoneSignal}>
                            <span className={styles.phoneSignalDot}></span>
                            78% - BUY
                        </div>

                        {/* Notification */}
                        <div className={styles.phoneNotification}>
                            <span className={styles.phoneNotifIcon}>🐋</span>
                            <div className={styles.phoneNotifText}>
                                <strong>Whale Alert</strong>
                                <span>50 SOL buy detected</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Side Buttons */}
                <div className={styles.phoneSideButtons}>
                    <div className={styles.phoneVolumeUp}></div>
                    <div className={styles.phoneVolumeDown}></div>
                </div>
                <div className={styles.phonePowerButton}></div>
            </div>
        </div>
    );
};

// ===== INTERACTIVE DEMO COMPONENT =====
const DemoSection = () => {
    const [ca, setCa] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const analyzeToken = async (e) => {
        e.preventDefault();
        if (!ca.trim()) return;

        setLoading(true);
        setError('');
        setResult(null);

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ca: ca.trim(), deviceId: 'demo-landing' })
            });

            const data = await response.json();

            if (data.success) {
                // Determine verdict
                let verdict = 'WAIT';
                let verdictEmoji = '⏳';
                let verdictColor = '#FFB800';

                if (data.analysis?.recommendation === 'BUY' || data.analysis?.profitProbability > 60) {
                    verdict = 'BUY';
                    verdictEmoji = '🟢';
                    verdictColor = '#CCFF00';
                } else if (data.analysis?.recommendation === 'AVOID' || data.analysis?.profitProbability < 30) {
                    verdict = 'RUN';
                    verdictEmoji = '🔴';
                    verdictColor = '#FF4444';
                }

                setResult({
                    token: data.token,
                    verdict,
                    verdictEmoji,
                    verdictColor,
                    probability: data.analysis?.profitProbability || 50,
                    riskLevel: data.analysis?.riskLevel || 'MEDIUM',
                    holders: data.holders?.total || 0,
                    imageUrl: data.token?.imageUrl // Add image URL from API
                });
            } else {
                setError(data.error || 'Analysis failed');
            }
        } catch (err) {
            setError('Failed to connect. Try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <section id="demo" className={styles.section}>
            <Reveal className={styles.sectionHeader}>
                <span className={styles.sectionBadge}>🧪 TRY IT NOW</span>
                <h2 className={styles.sectionTitle}>
                    Free <span className={styles.heroTitleGradient}>Instant Demo</span>
                </h2>
                <p className={styles.sectionSubtitle}>
                    Paste any pump.fun token address and get an instant verdict
                </p>
            </Reveal>

            <Reveal delay={100}>
                <div className={styles.demoContainer}>
                    <form onSubmit={analyzeToken} className={styles.demoForm}>
                        <div className={styles.demoInputWrapper}>
                            <input
                                type="text"
                                value={ca}
                                onChange={(e) => setCa(e.target.value)}
                                placeholder="Paste token contract address..."
                                className={styles.demoInput}
                                disabled={loading}
                            />
                            <button
                                type="submit"
                                className={styles.demoButton}
                                disabled={loading || !ca.trim()}
                            >
                                {loading ? (
                                    <span className={styles.demoSpinner}></span>
                                ) : (
                                    'Analyze'
                                )}
                            </button>
                        </div>
                    </form>

                    {error && (
                        <div className={styles.demoError}>
                            ⚠️ {error}
                        </div>
                    )}

                    {result && (
                        <div className={styles.demoResult}>
                            <div className={styles.demoVerdict} style={{ borderColor: result.verdictColor }}>
                                <span className={styles.demoVerdictEmoji}>{result.verdictEmoji}</span>
                                <span className={styles.demoVerdictText} style={{ color: result.verdictColor }}>
                                    {result.verdict}
                                </span>
                            </div>

                            <div className={styles.demoMetrics}>
                                <div className={styles.demoMetric}>
                                    <span className={styles.demoMetricLabel}>Token</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {result.imageUrl ? (
                                            <img
                                                src={result.imageUrl}
                                                alt={result.token?.symbol}
                                                style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                                                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                            />
                                        ) : (
                                            <div style={{
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '50%',
                                                background: 'linear-gradient(135deg, #666, #333)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '10px',
                                                fontWeight: 'bold',
                                                color: '#fff',
                                                border: '1px solid rgba(255,255,255,0.2)'
                                            }}>
                                                {result.token?.symbol?.[0] || '?'}
                                            </div>
                                        )}
                                        {/* Fallback hidden by default, shown on error */}
                                        <div className="fallback-icon" style={{
                                            display: 'none',
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            background: 'linear-gradient(135deg, #666, #333)',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '10px',
                                            fontWeight: 'bold',
                                            color: '#fff',
                                            border: '1px solid rgba(255,255,255,0.2)'
                                        }}>
                                            {result.token?.symbol?.[0] || '?'}
                                        </div>

                                        <span className={styles.demoMetricValue}>${result.token?.symbol || 'Unknown'}</span>
                                    </div>
                                </div>
                                <div className={styles.demoMetric}>
                                    <span className={styles.demoMetricLabel}>Profit Prob.</span>
                                    <span className={styles.demoMetricValue}>{result.probability}%</span>
                                </div>
                                <div className={styles.demoMetric}>
                                    <span className={styles.demoMetricLabel}>Risk</span>
                                    <span className={styles.demoMetricValue}>{result.riskLevel}</span>
                                </div>
                                <div className={styles.demoMetric}>
                                    <span className={styles.demoMetricLabel}>Holders</span>
                                    <span className={styles.demoMetricValue}>{result.holders.toLocaleString()}</span>
                                </div>
                            </div>

                            <a href={`/analyze/${ca}`} className={styles.demoCta}>
                                ✨ I Want Full Analysis
                            </a>
                        </div>
                    )}
                </div>
            </Reveal>
        </section>
    );
};

export default function Home() {
    // Live stats counter
    const [stats, setStats] = useState({ analyzed: 12847, rugs: 1423 });

    useEffect(() => {
        const interval = setInterval(() => {
            setStats(prev => ({
                analyzed: prev.analyzed + Math.floor(Math.random() * 3),
                rugs: prev.rugs + (Math.random() > 0.8 ? 1 : 0)
            }));
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className={styles.page}>
            {/* ===== HEADER ===== */}
            <header className={styles.header}>
                <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                    <img src="/logo.png" alt="MemeSense" className={styles.logo} style={{ height: '60px', width: 'auto' }} />
                </a>
                <nav className={styles.nav}>
                    <a href="#features" className={styles.navLink}>Features</a>
                    <a href="#how-it-works" className={styles.navLink}>How It Works</a>
                    <a href="#pricing" className={styles.navLink}>Pricing</a>
                </nav>
                <a href="/app" target="_blank" className={styles.headerCta}>🚀 Launch App</a>
            </header>

            {/* ===== HERO SECTION ===== */}
            <section className={styles.hero}>
                <div className={styles.heroBg}>
                    <img src="/hero_glow.png" alt="" className={styles.heroBgImage} />
                </div>

                <Reveal className={styles.heroContent}>
                    <span className={styles.heroBadge}>✨ POWERED BY GROK • PREMIUM MEMECOIN TOOLS</span>
                    <h1 className={styles.heroTitle}>
                        The Leading Platform for<br />
                        <span className={styles.heroTitleGradient}>Memecoin Analysis</span>
                    </h1>
                    <p className={styles.heroSubtitle}>
                        Sense danger before it even happens.
                    </p>
                    <div className={styles.heroCtas}>
                        <a href="/app" target="_blank" className={styles.ctaPrimary}>
                            Launch App <span>🚀</span>
                        </a>
                        <a href="#how-it-works" className={styles.ctaSecondary}>
                            View Demo
                        </a>
                    </div>
                    <div className={styles.statsTicker}>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}>Analyzed</span>
                            <span className={styles.statValue}>{stats.analyzed.toLocaleString()}</span>
                        </div>
                        <div className={styles.statDivider}></div>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}>Rugs Detected</span>
                            <span className={styles.statValue}>{stats.rugs.toLocaleString()}</span>
                        </div>
                        <div className={styles.statDivider}></div>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}>Accuracy</span>
                            <span className={styles.statValue} style={{ color: 'var(--primary)' }}>94.8%</span>
                        </div>
                    </div>
                </Reveal>

                <Reveal className={styles.heroVisual} delay={200}>
                    <div className={styles.heroCardsContainer}>
                        {/* Left Card - Entry Point */}
                        <div className={`${styles.sideCard} ${styles.leftCard}`}>
                            <div className={styles.cardHeader}>
                                <span className={styles.cardDot}></span>
                                <span className={styles.cardTitle}>Entry Point</span>
                            </div>
                            <div className={styles.sideCardContent}>
                                <div className={styles.entryMetric}>
                                    <span className={styles.entryLabel}>Target MCap</span>
                                    <span className={styles.entryValue}>$69K</span>
                                </div>
                                <div className={styles.entryMetric}>
                                    <span className={styles.entryLabel}>Potential</span>
                                    <span className={styles.entryValueHighlight}>+12x</span>
                                </div>
                                <div className={styles.entryVerdict}>
                                    <span className={styles.verdictIcon}>🎯</span>
                                    ENTER NOW
                                </div>
                            </div>
                        </div>

                        {/* Center Card - Main Gauge */}
                        <div className={styles.dashboardCard}>
                            <div className={styles.cardHeader}>
                                <span className={styles.cardDot}></span>
                                <span className={styles.cardTitle}>Profit Probability</span>
                            </div>
                            <div className={styles.gaugeContainer}>
                                <div className={styles.gauge}>
                                    <svg className={styles.gaugeSvg} viewBox="0 0 160 160">
                                        <circle cx="80" cy="80" r="70" className={styles.gaugeTrack} />
                                        <circle cx="80" cy="80" r="70" className={styles.gaugeProgress} />
                                    </svg>
                                    <span className={styles.gaugeValue}>78<span className={styles.gaugeUnit}>%</span></span>
                                </div>
                                <div className={styles.signal}>
                                    <span className={styles.signalDot}></span>
                                    BUY SIGNAL
                                </div>
                            </div>
                        </div>

                        {/* Right Card - Key Signals */}
                        <div className={`${styles.sideCard} ${styles.rightCard}`}>
                            <div className={styles.cardHeader}>
                                <span className={styles.cardDot}></span>
                                <span className={styles.cardTitle}>Key Signals</span>
                            </div>
                            <div className={styles.sideCardContent}>
                                <div className={styles.signalItem}>
                                    <span className={styles.signalBullish}>🟢</span>
                                    Smart money accumulating
                                </div>
                                <div className={styles.signalItem}>
                                    <span className={styles.signalWarning}>⚠️</span>
                                    Top 10 hold 42%
                                </div>
                                <div className={styles.signalItem}>
                                    <span className={styles.signalBullish}>🟢</span>
                                    Dev wallet clean
                                </div>
                            </div>
                        </div>
                    </div>
                </Reveal>
            </section>

            {/* ===== FEATURES SECTION ===== */}
            <section id="features" className={styles.section}>
                <Reveal className={styles.sectionHeader}>
                    <span className={styles.sectionBadge}>🔍 DEEP ANALYSIS</span>
                    <h2 className={styles.sectionTitle}>
                        Everything You Need to <span className={styles.heroTitleGradient}>Avoid Rugs</span>
                    </h2>
                    <p className={styles.sectionSubtitle}>
                        We analyze 15+ on-chain signals in real-time to help you make smarter decisions
                    </p>
                </Reveal>

                <div className={styles.featuresGrid}>
                    {[
                        { icon: '👤', title: 'Dev Wallet Tracking', items: ['Dev wallet holdings %', 'Has dev sold? How much?', 'Dev transaction history', 'Previous rugs by same dev'] },
                        { icon: '👥', title: 'Holder Distribution', items: ['Top 10/20/50 holder %', 'Wallet clustering detection', 'Bundled wallet warnings', 'Fresh wallet % (sybils)'] },
                        { icon: '⚠️', title: 'Risk Signals', items: ['Sniper bot detection', 'Unusual price patterns', 'Liquidity concentration', 'Sell pressure alerts'] },
                        { icon: '📊', title: 'Market Intelligence', items: ['Real-time buy/sell ratio', 'Volume momentum', 'Graduation probability', 'Raydium migration ETA'] },
                    ].map((feature, i) => (
                        <Reveal key={i} delay={i * 100}>
                            <div className={styles.featureCard}>
                                <div className={styles.featureIcon}>{feature.icon}</div>
                                <h3 className={styles.featureTitle}>{feature.title}</h3>
                                <ul className={styles.featureList}>
                                    {feature.items.map((item, j) => (
                                        <li key={j}><span className={styles.checkmark}>✓</span> {item}</li>
                                    ))}
                                </ul>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* ===== INTERACTIVE DEMO SECTION ===== */}
            <DemoSection />

            {/* ===== HOW IT WORKS ===== */}
            <section id="how-it-works" className={styles.section}>
                <Reveal className={styles.sectionHeader}>
                    <span className={styles.sectionBadge}>⚡ FAST & EASY</span>
                    <h2 className={styles.sectionTitle}>
                        Analyze Any Token in <span className={styles.heroTitleGradient}>3 Seconds</span>
                    </h2>
                </Reveal>

                <div className={styles.stepsGrid}>
                    <Reveal delay={0}>
                        <div className={styles.step}>
                            <div className={styles.stepNumber}>1</div>
                            <h3 className={styles.stepTitle}>Paste Address</h3>
                            <p className={styles.stepDesc}>Copy the token contract address from pump.fun</p>
                        </div>
                    </Reveal>
                    <span className={styles.stepArrow}>→</span>
                    <Reveal delay={150}>
                        <div className={styles.step}>
                            <div className={styles.stepNumber}>2</div>
                            <h3 className={styles.stepTitle}>AI Analyzes</h3>
                            <p className={styles.stepDesc}>Grok AI scans 15+ on-chain & market signals</p>
                        </div>
                    </Reveal>
                    <span className={styles.stepArrow}>→</span>
                    <Reveal delay={300}>
                        <div className={styles.step}>
                            <div className={styles.stepNumber}>3</div>
                            <h3 className={styles.stepTitle}>Get Verdict</h3>
                            <p className={styles.stepDesc}>Receive BUY, WAIT, or AVOID recommendation</p>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ===== SPEED TRADER FEATURES ===== */}
            <section className={styles.section}>
                <Reveal className={styles.sectionHeader}>
                    <span className={styles.sectionBadge}>🚀 FEATURES</span>
                    <h2 className={styles.sectionTitle}>
                        Built for <span className={styles.heroTitleGradient}>Speed Traders</span>
                    </h2>
                    <p className={styles.sectionSubtitle}>
                        Everything updates in real-time. No refreshing needed.
                    </p>
                </Reveal>

                <div className={styles.speedGrid}>
                    {[
                        { icon: '⚡', title: 'Live Updates', desc: 'Data refreshes every 10 seconds automatically' },
                        { icon: '🤖', title: 'AI Insights', desc: 'Grok-powered analysis explains WHY to buy or avoid' },
                        { icon: '👤', title: 'Dev Tracking', desc: 'Know if dev has sold and how much they hold' },
                        { icon: '🕵️', title: 'Cluster Detection', desc: 'Identifies bundled wallets and coordinated buying' },
                        { icon: '📈', title: 'Graduation Tracker', desc: 'Track bonding curve and Raydium migration progress' },
                        { icon: '🚨', title: 'Risk Alerts', desc: 'Instant warnings for rug pull patterns' },
                    ].map((item, i) => (
                        <Reveal key={i} delay={i * 80}>
                            <div className={styles.speedCard}>
                                <div className={styles.speedIcon}>{item.icon}</div>
                                <h3 className={styles.speedTitle}>{item.title}</h3>
                                <p className={styles.speedDesc}>{item.desc}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* ===== MOBILE SHOWCASE ===== */}
            <section className={styles.section}>
                <div className={styles.mobileSection}>
                    <Reveal className={styles.mobileContent}>
                        <span className={styles.sectionBadge}>📱 COMING SOON</span>
                        <h2 className={styles.mobileTitle}>
                            Analysis on the Go.<br />
                            <span className={styles.heroTitleGradient}>Pocket Terminals.</span>
                        </h2>
                        <p className={styles.mobileDesc}>
                            The full power of MemeSense, optimized for your phone.
                            Get push notifications for whale movements and rug alerts instantly.
                        </p>
                        <ul className={styles.mobileFeatures}>
                            <li><span className={styles.checkmark}>✓</span> Instant Push Notifications</li>
                            <li><span className={styles.checkmark}>✓</span> Biometric Login</li>
                            <li><span className={styles.checkmark}>✓</span> One-tap Quick Scan</li>
                        </ul>
                        <div className={styles.waitlistForm}>
                            <input type="email" placeholder="Enter your email" className={styles.waitlistInput} />
                            <button className={styles.ctaPrimary}>Join Waitlist</button>
                        </div>
                    </Reveal>

                    <Reveal className={styles.mobileVisual} delay={200}>
                        <PhoneMockup />
                    </Reveal>
                </div>
            </section>

            {/* ===== PRICING ===== */}
            <section id="pricing" className={styles.section}>
                <Reveal className={styles.sectionHeader}>
                    <span className={styles.sectionBadge}>💎 PRICING</span>
                    <h2 className={styles.sectionTitle}>
                        Start Free, <span className={styles.heroTitleGradient}>Scale When Ready</span>
                    </h2>
                </Reveal>

                <div className={styles.pricingGrid}>
                    <Reveal delay={0}>
                        <div className={styles.pricingCard}>
                            <div className={styles.pricingHeader}>
                                <div className={styles.pricingTier}>Free</div>
                                <div className={styles.pricingAmount}>
                                    <span className={styles.pricingCurrency}>$</span>
                                    <span className={styles.pricingValue}>0</span>
                                </div>
                                <div className={styles.pricingPeriod}>Forever free</div>
                            </div>
                            <ul className={styles.pricingFeatures}>
                                <li>✓ <strong>10</strong> analyses / day</li>
                                <li>✓ Real-time market data</li>
                                <li>✓ Basic AI insights</li>
                                <li>✓ Top 10 holder view</li>
                                <li style={{ color: 'var(--text-muted)' }}>✕ No Whale Tracking</li>
                            </ul>
                            <a href="/app" target="_blank" className={`${styles.pricingCta} ${styles.pricingCtaFree}`}>
                                Get Started Free
                            </a>
                        </div>
                    </Reveal>

                    <Reveal delay={150}>
                        <div className={`${styles.pricingCard} ${styles.pricingCardPremium}`}>
                            <span className={styles.premiumBadge}>MOST POPULAR</span>
                            <div className={styles.pricingHeader}>
                                <div className={styles.pricingTier}>Premium</div>
                                <div className={styles.pricingAmount}>
                                    <span className={styles.pricingValue}>0.5</span>
                                    <span className={styles.pricingCurrency}> SOL</span>
                                </div>
                                <div className={styles.pricingPeriod}>One-time payment</div>
                            </div>
                            <ul className={styles.pricingFeatures}>
                                <li>✓ <strong>UNLIMITED</strong> Analyses</li>
                                <li>✓ Dev wallet tracking & History</li>
                                <li>✓ Wallet clustering alerts</li>
                                <li>✓ Top 100 holder details</li>
                                <li>✓ Sniper bot detection</li>
                                <li>✓ AI Chart Analysis</li>
                            </ul>
                            <a href="/app" target="_blank" className={`${styles.pricingCta} ${styles.pricingCtaPremium}`}>
                                🚀 Get Premium (0.5 SOL)
                            </a>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ===== CTA SECTION ===== */}
            <section className={styles.ctaSection}>
                <Reveal>
                    <div className={styles.ctaCard}>
                        <h2 className={styles.ctaTitle}>Ready to Trade Smarter?</h2>
                        <p className={styles.ctaDesc}>Analyze any pump.fun token in seconds. Free forever.</p>
                        <a href="/app" target="_blank" className={styles.ctaPrimary}>
                            🚀 Launch App Now
                        </a>
                    </div>
                </Reveal>
            </section>

            {/* ===== FOOTER ===== */}
            <footer className={styles.footer}>
                <div className={styles.footerContent}>
                    <img src="/logo.png" alt="MemeSense" className={styles.footerLogo} />
                    <p className={styles.footerText}>
                        AI-powered memecoin analysis. Powered by Grok. Not financial advice. Trade responsibly.
                    </p>
                    <div className={styles.footerLinks}>
                        <a href="#">Twitter</a>
                        <a href="#">Discord</a>
                        <a href="#">GitHub</a>
                    </div>
                </div>
                <div className={styles.footerCopyright}>
                    © 2026 MemeSense. All rights reserved.
                </div>
            </footer>
        </div>
    );
}

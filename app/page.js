'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Rocket,
    Sparkles,
    ShieldAlert,
    Search,
    Zap,
    BarChart3,
    Lock,
    Smartphone,
    Check,
    ChevronRight,
    TrendingUp,
    AlertTriangle,
    X,
    Twitter,
    BookOpen
} from 'lucide-react';
import styles from './page.module.css';
import BetaBadge from '@/components/BetaBadge';
import WaitlistModal from '@/components/WaitlistModal';
import NotificationToast from '@/components/NotificationToast';

// ... (Rest of imports and hooks remain same until Home component)

export default function Home() {
    // Live stats counter
    const [stats, setStats] = useState({ analyzed: 12847, rugs: 1423 });
    const [showWaitlist, setShowWaitlist] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    const handleJoinBeta = (e) => {
        e.preventDefault();
        setShowWaitlist(true);
    };

    const handleAddToChrome = (e) => {
        e.preventDefault();
        setToastMessage('Upcoming feature');
        setShowToast(true);
    };

    useEffect(() => {
        const interval = setInterval(() => {
            setStats(prev => ({
                analyzed: prev.analyzed + Math.floor(Math.random() * 3),
                rugs: prev.rugs + (Math.random() > 0.8 ? 1 : 0)
            }));
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    // Scroll listener for dynamic header
    const [isScrolled, setIsScrolled] = useState(false);
    // ... existing useEffect ...

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 20) {
                setIsScrolled(true);
            } else {
                setIsScrolled(false);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);



    return (
        <div className={styles.page}>
            {/* Interactive Components */}
            {showWaitlist && <WaitlistModal onClose={() => setShowWaitlist(false)} />}
            {showToast && <NotificationToast message={toastMessage} onClose={() => setShowToast(false)} />}

            {/* ===== HEADER ===== */}
            <header className={`${styles.header} ${isScrolled ? styles.headerScrolled : ''}`}>
                <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={styles.logoContainer}>
                    {/* Desktop Logo */}
                    <img src="/logo.png" alt="MemeSense" className={styles.logoDesktop} />
                    {/* Mobile Icon (Favicon style) */}
                    <img src="/icon.png" alt="MemeSense" className={styles.logoMobile} />
                    <div className={styles.betaWrapper}>
                        <BetaBadge />
                    </div>
                </a>
                <nav className={styles.nav}>
                    <a href="#features" className={styles.navLink}>Features</a>
                    <a href="#how-it-works" className={styles.navLink}>How It Works</a>
                    <a href="#pricing" className={styles.navLink}>Pricing</a>
                </nav>
                <div className={styles.headerRight}>
                    <div className={styles.socialGroup}>
                        <a href="https://x.com/memesenseonsol" target="_blank" rel="noopener noreferrer" className={styles.socialIcon} title="Twitter">
                            <img src="/x-icon.png" alt="X (Twitter)" style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', padding: 2 }} />
                        </a>
                        <a href="https://meme-sense.gitbook.io/docs/" target="_blank" rel="noopener noreferrer" className={styles.socialIcon} title="Documentation">
                            <BookOpen size={18} />
                        </a>
                        <a href="https://pump.fun/" target="_blank" rel="noopener noreferrer" className={styles.socialIcon} title="Pump.fun">
                            <img src="/pump.png" alt="Pump.fun" style={{ width: 18, height: 18, borderRadius: '50%' }} />
                        </a>
                    </div>
                    <a href="/app" target="_blank" className={styles.headerCta}>
                        {isScrolled ? 'Launch' : 'Launch App'}
                    </a>
                </div>
            </header>

            {/* ===== HERO SECTION ===== */}
            <section className={styles.hero}>
                <div className={styles.heroBg}>
                    <img src="/hero_glow.png" alt="" className={styles.heroBgImage} />
                </div>

                <Reveal className={styles.heroContent}>
                    <div className={styles.heroBadge}>
                        <Sparkles size={14} style={{ display: 'inline', marginRight: 6 }} />
                        AI-Powered by Grok
                    </div>
                    <h1 className={styles.heroTitle}>
                        Stop Guessing. <br />
                        <span className={styles.heroTitleGradient}>Start Winning on Solana.</span>
                    </h1>
                    <p className={styles.heroSubtitle}>
                        Rank #1 in profits with MemeSense. The ultimate AI tool to track wallets, analyze token risks, and spot 100x gems on Solana before they moon.
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
                                    <span className={styles.verdictIcon}><Rocket size={14} /></span>
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
                                    <span className={styles.signalBullish}><TrendingUp size={14} color="#CCFF00" /></span>
                                    Smart money accumulating
                                </div>
                                <div className={styles.signalItem}>
                                    <span className={styles.signalWarning}><AlertTriangle size={14} color="#FFD600" /></span>
                                    Top 10 hold 42%
                                </div>
                                <div className={styles.signalItem}>
                                    <span className={styles.signalBullish}><Check size={14} color="#CCFF00" /></span>
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
                        { icon: <Lock size={32} color="#CCFF00" />, title: 'Dev Wallet Tracking', items: ['Dev wallet holdings %', 'Has dev sold? How much?', 'Dev transaction history', 'Previous rugs by same dev'] },
                        { icon: <BarChart3 size={32} color="#00E5FF" />, title: 'Holder Distribution', items: ['Top 10/20/50 holder %', 'Wallet clustering detection', 'Bundled wallet warnings', 'Fresh wallet % (sybils)'] },
                        { icon: <ShieldAlert size={32} color="#FF3333" />, title: 'Risk Signals', items: ['Sniper bot detection', 'Unusual price patterns', 'Liquidity concentration', 'Sell pressure alerts'] },
                        { icon: <TrendingUp size={32} color="#FFD600" />, title: 'Market Intelligence', items: ['Real-time buy/sell ratio', 'Volume momentum', 'Graduation probability', 'Raydium migration ETA'] },
                    ].map((feature, i) => (
                        <Reveal key={i} delay={i * 100}>
                            <div className={styles.glassCard}>
                                <div className={styles.featureIcon}>{feature.icon}</div>
                                <h3 className={styles.featureTitle}>{feature.title}</h3>
                                <ul className={styles.featureList}>
                                    {feature.items.map((item, j) => (
                                        <li key={j}><Check size={14} className={styles.checkmark} /> {item}</li>
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
                            <p className={styles.stepDesc}>Copy the token contract address from Pump.fun or Bonk.fun</p>
                        </div>
                    </Reveal>
                    <span className={styles.stepArrow}>→</span>
                    <Reveal delay={150}>
                        <div className={styles.step}>
                            <div className={styles.stepNumber}>2</div>
                            <h3 className={styles.stepTitle}>AI Analyzes</h3>
                            <p className={styles.stepDesc}>Grok AI senses 15+ on-chain & market signals</p>
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

            {/* ===== WALLET HOW IT WORKS ===== */}
            <section className={styles.section}>
                <Reveal className={styles.sectionHeader}>
                    <span className={styles.sectionBadge}>🕵️‍♂️ PROFIT TRACKER</span>
                    <h2 className={styles.sectionTitle}>
                        Track Master Traders in <span className={styles.heroTitleGradient}>Real-Time</span>
                    </h2>
                </Reveal>

                <div className={styles.stepsGrid}>
                    <Reveal delay={0}>
                        <div className={styles.step}>
                            <div className={styles.stepNumber}>1</div>
                            <h3 className={styles.stepTitle}>Enter Wallet</h3>
                            <p className={styles.stepDesc}>Paste any Solana wallet address to track</p>
                        </div>
                    </Reveal>
                    <span className={styles.stepArrow}>→</span>
                    <Reveal delay={150}>
                        <div className={styles.step}>
                            <div className={styles.stepNumber}>2</div>
                            <h3 className={styles.stepTitle}>Deep Sense</h3>
                            <p className={styles.stepDesc}>AI analyzes 1000+ historical trades & PnL</p>
                        </div>
                    </Reveal>
                    <span className={styles.stepArrow}>→</span>
                    <Reveal delay={300}>
                        <div className={styles.step}>
                            <div className={styles.stepNumber}>3</div>
                            <h3 className={styles.stepTitle}>See Profitability</h3>
                            <p className={styles.stepDesc}>Get Win Rate, Total Gains & Trader Score</p>
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
                        { icon: <Zap size={28} color="#CCFF00" />, title: 'Live Updates', desc: 'Data refreshes every 10 seconds automatically' },
                        { icon: <Sparkles size={28} color="#00E5FF" />, title: 'AI Insights', desc: 'Grok-powered analysis explains WHY to buy or avoid' },
                        { icon: <Lock size={28} color="#FF3333" />, title: 'Dev Tracking', desc: 'Know if dev has sold and how much they hold' },
                        { icon: <Search size={28} color="#FFD600" />, title: 'Cluster Detection', desc: 'Identifies bundled wallets and coordinated buying' },
                        { icon: <TrendingUp size={28} color="#CCFF00" />, title: 'Graduation Tracker', desc: 'Track bonding curve and Raydium migration progress' },
                        { icon: <AlertTriangle size={28} color="#FF3333" />, title: 'Risk Alerts', desc: 'Instant warnings for rug pull patterns' },
                    ].map((item, i) => (
                        <Reveal key={i} delay={i * 80}>
                            <div className={styles.glassCard}>
                                <div className={styles.speedIcon}>{item.icon}</div>
                                <h3 className={styles.speedTitle}>{item.title}</h3>
                                <p className={styles.speedDesc}>{item.desc}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* ===== MOBILE SHOWCASE ===== */}
            {/* ===== MOBILE APP SHOWCASE ===== */}
            <section className={styles.showcaseSection}>
                <div className={`${styles.showcaseGlow} ${styles.glowLeft}`}></div>
                <div className={styles.showcaseContainer}>
                    {/* Visual Left */}
                    <Reveal className={styles.showcaseVisual} delay={0}>
                        <PhoneMockup />
                    </Reveal>

                    {/* Content Right */}
                    <Reveal className={styles.showcaseContent} delay={200}>
                        <div className={styles.showcaseBadge}>
                            <Smartphone size={14} style={{ marginRight: 6 }} />
                            Mobile App
                        </div>
                        <h2 className={styles.showcaseTitle}>
                            Your Pocket <br />
                            <span className={styles.heroTitleGradient}>War Room</span>
                        </h2>
                        <p className={styles.showcaseDesc}>
                            Never miss a pump again. MemeSense Mobile keeps you connected to the pulse of Solana with instant push alerts for whale movements, rug pulls, and trending tokens.
                        </p>
                        <div className={styles.showcaseList}>
                            <div className={styles.showcaseListItem}>
                                <div style={{ minWidth: 24, height: 24, borderRadius: '50%', background: 'rgba(204,255,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccff00' }}>
                                    <Zap size={14} />
                                </div>
                                Instant Whale Push Alerts
                            </div>
                            <div className={styles.showcaseListItem}>
                                <div style={{ minWidth: 24, height: 24, borderRadius: '50%', background: 'rgba(204,255,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccff00' }}>
                                    <Lock size={14} />
                                </div>
                                Biometric Security (FaceID)
                            </div>
                            <div className={styles.showcaseListItem}>
                                <div style={{ minWidth: 24, height: 24, borderRadius: '50%', background: 'rgba(204,255,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccff00' }}>
                                    <Rocket size={14} />
                                </div>
                                One-Tap Quick Sense
                            </div>
                        </div>
                        <button onClick={handleJoinBeta} className={styles.showcaseCta} style={{ cursor: 'pointer', border: '1px solid var(--border)' }}>
                            Join Beta Waitlist
                        </button>
                    </Reveal>
                </div>
            </section>

            {/* ===== LIVE SENSE EXTENSION SHOWCASE ===== */}
            <section className={styles.showcaseSection} style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className={`${styles.showcaseGlow} ${styles.glowRight}`}></div>
                <div className={`${styles.showcaseContainer} ${styles.reverse}`}>
                    {/* Visual Right (in DOM order, but reversed via CSS) */}
                    <Reveal className={styles.showcaseVisual} delay={200}>
                        <BrowserMockup />
                    </Reveal>

                    {/* Content Left */}
                    <Reveal className={styles.showcaseContent} delay={0}>
                        <div className={styles.showcaseBadge}>
                            <Sparkles size={14} style={{ marginRight: 6 }} />
                            Chrome Extension
                        </div>
                        <h2 className={styles.showcaseTitle}>
                            God Mode for <br />
                            <span className={styles.heroTitleGradient}>Pump.fun</span>
                        </h2>
                        <p className={styles.showcaseDesc}>
                            Stop alt-tabbing to check safety. The Live Sense Extension overlays real-time safety scores, developer history, and social sentiment directly on the Pump.fun interface.
                        </p>
                        <div className={styles.showcaseList}>
                            <div className={styles.showcaseListItem}>
                                <Check size={20} color="#CCFF00" />
                                Real-time Overlay HUD
                            </div>
                            <div className={styles.showcaseListItem}>
                                <Check size={20} color="#CCFF00" />
                                Auto-Rug Detection
                            </div>
                            <div className={styles.showcaseListItem}>
                                <Check size={20} color="#CCFF00" />
                                Tweet Volume Correlation
                            </div>
                        </div>
                        <button onClick={handleAddToChrome} className={styles.showcaseCta} style={{ cursor: 'pointer', border: '1px solid var(--border)' }}>
                            Add to Chrome
                        </button>
                    </Reveal>
                </div>
            </section>

            {/* ===== PRICING ===== */}
            <section id="pricing" className={styles.section}>
                <Reveal className={styles.sectionHeader}>
                    <div className={styles.sectionBadge}>
                        <Sparkles size={14} style={{ display: 'inline', marginRight: 6 }} />
                        PRICING
                    </div>
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
                                <li><Check size={14} color="#CCFF00" style={{ marginRight: 8 }} /> <strong>10</strong> analyses / day</li>
                                <li><Check size={14} color="#CCFF00" style={{ marginRight: 8 }} /> Real-time market data</li>
                                <li><Check size={14} color="#CCFF00" style={{ marginRight: 8 }} /> Basic AI insights</li>
                                <li><Check size={14} color="#CCFF00" style={{ marginRight: 8 }} /> Top 10 holder view</li>
                                <li style={{ color: 'var(--text-muted)' }}><X size={14} style={{ marginRight: 8 }} /> No Whale Tracking</li>
                            </ul>
                            <a href="/upgrade" className={`${styles.pricingCta} ${styles.pricingCtaFree}`}>
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
                                <li><Check size={14} color="#CCFF00" style={{ marginRight: 8 }} /> <strong>UNLIMITED</strong> Analyses</li>
                                <li><Check size={14} color="#CCFF00" style={{ marginRight: 8 }} /> Wallet Profitability Tracking</li>
                                <li><Check size={14} color="#CCFF00" style={{ marginRight: 8 }} /> Dev wallet tracking & History</li>
                                <li><Check size={14} color="#CCFF00" style={{ marginRight: 8 }} /> Wallet clustering alerts</li>
                                <li><Check size={14} color="#CCFF00" style={{ marginRight: 8 }} /> Top 100 holder details</li>
                                <li><Check size={14} color="#CCFF00" style={{ marginRight: 8 }} /> Sniper bot detection</li>
                                <li><Check size={14} color="#CCFF00" style={{ marginRight: 8 }} /> AI Chart Analysis</li>
                            </ul>
                            <a href="/upgrade" className={`${styles.pricingCta} ${styles.pricingCtaPremium}`}>
                                <Rocket size={16} /> Get Premium (0.5 SOL)
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
                        <p className={styles.ctaDesc}>Analyze any Solana token in seconds. Free forever.</p>
                        <a href="/app" target="_blank" className={styles.ctaPrimary}>
                            <Rocket size={18} /> Launch App Now
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
                        <a href="https://x.com/memesenseonsol" target="_blank" rel="noopener noreferrer">Twitter</a>
                        <Link href="/privacy">Privacy</Link>
                        <Link href="/terms">Terms</Link>
                    </div>
                </div>
                <div className={styles.footerCopyright}>
                    © 2026 MemeSense. All rights reserved.
                </div>
            </footer>
        </div>
    );
}

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

// ===== BROWSER MOCKUP COMPONENT =====
const BrowserMockup = () => {
    return (
        <div className={styles.browserMockupWrapper}>
            <div className={styles.browserWindow}>
                {/* Browser Bar */}
                <div className={styles.browserBar}>
                    <div className={styles.browserDots}>
                        <div className={styles.browserDot} style={{ background: '#ff5f56' }}></div>
                        <div className={styles.browserDot} style={{ background: '#ffbd2e' }}></div>
                        <div className={styles.browserDot} style={{ background: '#27c93f' }}></div>
                    </div>
                    <div className={styles.browserAddress}>
                        pump.fun/coin/8xL...
                    </div>
                </div>

                {/* Content */}
                <div className={styles.browserContent}>
                    {/* Simulated Pump Grid */}
                    <div className={styles.pumpGrid}>
                        {[...Array(9)].map((_, i) => (
                            <div key={i} className={styles.pumpItem}></div>
                        ))}
                    </div>

                    {/* Overlay */}
                    <div className={styles.extensionOverlay}>
                        <div className={styles.overlayHeader}>
                            <div className={styles.overlayTitle}>
                                <Sparkles size={12} /> MemeSense Overlay
                            </div>
                        </div>
                        <div className={styles.overlayScore}>85/100</div>
                        <div className={styles.overlayLabel}>Safety Score</div>

                        <div className={styles.overlayStat}>
                            <span style={{ color: '#888' }}>Dev History</span>
                            <span style={{ color: '#ccff00' }}>CLEAN</span>
                        </div>
                        <div className={styles.overlayStat}>
                            <span style={{ color: '#888' }}>Sniper</span>
                            <span style={{ color: '#fff' }}>0%</span>
                        </div>
                        <div className={styles.overlayStat}>
                            <span style={{ color: '#888' }}>Trend</span>
                            <span style={{ color: '#ccff00' }}>Type II Buy</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ===== INTERACTIVE DEMO COMPONENT =====
const DemoSection = () => {
    const [input, setInput] = useState('');
    const [mode, setMode] = useState('token'); // 'token' | 'wallet'
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const handleAnalyze = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        setLoading(true);
        setError('');
        setResult(null);

        try {
            // WALLET MODE
            if (mode === 'wallet') {
                const response = await fetch('/api/profit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ walletToAnalyze: input.trim(), deviceId: 'demo-landing' })
                });
                const data = await response.json();

                if (data.success && data.data) {
                    const payload = data.data;
                    const metrics = payload.summary?.all || {};
                    const ai = payload.aiVerdict || {};

                    setResult({
                        type: 'wallet',
                        totalProfit: metrics.totalRealizedPnL || 0,
                        winRate: metrics.winRate || 0,
                        profitFactor: metrics.profitFactor || 0,
                        realizedPnL: metrics.totalRealizedPnL || 0,
                        trades: metrics.totalTrades || 0,
                        verdict: ai.status || (metrics.totalRealizedPnL > 0 ? 'PROFITABLE' : 'UNPROFITABLE'),
                        verdictColor: ai.score >= 50 ? '#CCFF00' : '#FF4444' // Simple logic, or extract from aiStatus
                    });
                } else {
                    setError(data.error || 'Tracker analysis failed');
                }
            }
            // TOKEN MODE
            else {
                const response = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ca: input.trim(), deviceId: 'demo-landing' })
                });

                const data = await response.json();

                if (data.success) {
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
                        type: 'token',
                        token: data.token,
                        verdict,
                        verdictEmoji,
                        verdictColor,
                        probability: data.analysis?.profitProbability || 50,
                        riskLevel: data.analysis?.riskLevel || 'MEDIUM',
                        holders: data.holders?.total || 0,
                        imageUrl: data.token?.imageUrl
                    });
                } else {
                    setError(data.error || 'Sense analysis failed');
                }
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
                    {mode === 'token'
                        ? 'Paste any Solana token address to get an instant verdict'
                        : 'Paste a wallet address to sense its historical profitability'}
                </p>
            </Reveal>

            <Reveal delay={100}>
                <div className={styles.demoContainer}>
                    {/* Tab Switcher */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
                        <button
                            onClick={() => { setMode('token'); setResult(null); setError(''); }}
                            style={{
                                background: mode === 'token' ? 'rgba(204, 255, 0, 0.1)' : 'transparent',
                                color: mode === 'token' ? '#ccff00' : '#888',
                                border: mode === 'token' ? '1px solid #ccff00' : '1px solid transparent',
                                padding: '8px 24px',
                                borderRadius: '100px',
                                cursor: 'pointer',
                                fontWeight: 600,
                                transition: 'all 0.2s'
                            }}
                        >
                            Token Sense
                        </button>
                        <button
                            onClick={() => { setMode('wallet'); setResult(null); setError(''); }}
                            style={{
                                background: mode === 'wallet' ? 'rgba(204, 255, 0, 0.1)' : 'transparent',
                                color: mode === 'wallet' ? '#ccff00' : '#888',
                                border: mode === 'wallet' ? '1px solid #ccff00' : '1px solid transparent',
                                padding: '8px 24px',
                                borderRadius: '100px',
                                cursor: 'pointer',
                                fontWeight: 600,
                                transition: 'all 0.2s'
                            }}
                        >
                            Profit Tracker
                        </button>
                    </div>

                    <form onSubmit={handleAnalyze} className={styles.demoForm}>
                        <div className={styles.demoInputWrapper}>
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={mode === 'token' ? "Paste token contract address..." : "Paste wallet address..."}
                                className={styles.demoInput}
                                disabled={loading}
                            />
                            <button
                                type="submit"
                                className={styles.demoButton}
                                disabled={loading || !input.trim()}
                            >
                                {loading ? (
                                    <span className={styles.demoSpinner}></span>
                                ) : (
                                    'Sense'
                                )}
                            </button>
                        </div>
                    </form>

                    {error && (
                        <div className={styles.demoError}>
                            ⚠️ {error}
                        </div>
                    )}

                    {/* TOKEN RESULT */}
                    {result && result.type === 'token' && (
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
                                                width: '24px', height: '24px', borderRadius: '50%',
                                                background: 'linear-gradient(135deg, #666, #333)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '10px', fontWeight: 'bold', color: '#fff',
                                                border: '1px solid rgba(255,255,255,0.2)'
                                            }}>
                                                {result.token?.symbol?.[0] || '?'}
                                            </div>
                                        )}
                                        {/* Fallback hidden by default, shown on error */}
                                        <div className="fallback-icon" style={{
                                            display: 'none', width: '24px', height: '24px', borderRadius: '50%',
                                            background: 'linear-gradient(135deg, #666, #333)',
                                            alignItems: 'center', justifyContent: 'center',
                                            fontSize: '10px', fontWeight: 'bold', color: '#fff',
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

                            <a href={`/analyze/${input}`} className={styles.demoCta}>
                                ✨ I Want Full Analysis
                            </a>
                        </div>
                    )}

                    {/* WALLET RESULT */}
                    {result && result.type === 'wallet' && (
                        <div className={styles.demoResult}>
                            <div className={styles.demoVerdict} style={{ borderColor: result.verdictColor }}>
                                <span className={styles.demoVerdictEmoji}>{result.totalProfit > 0 ? '🚀' : '📉'}</span>
                                <span className={styles.demoVerdictText} style={{ color: result.verdictColor }}>
                                    {result.verdict}
                                </span>
                            </div>

                            <div className={styles.demoMetrics}>
                                <div className={styles.demoMetric}>
                                    <span className={styles.demoMetricLabel}>Profit Factor</span>
                                    <span className={styles.demoMetricValue} style={{ color: result.profitFactor >= 2 ? '#CCFF00' : '#fff' }}>
                                        {result.profitFactor.toFixed(2)}x
                                    </span>
                                </div>
                                <div className={styles.demoMetric}>
                                    <span className={styles.demoMetricLabel}>Total Profit</span>
                                    <span className={styles.demoMetricValue} style={{ color: result.totalProfit >= 0 ? '#ccff00' : '#ff4444' }}>
                                        {result.totalProfit.toFixed(2)} SOL
                                    </span>
                                </div>
                                <div className={styles.demoMetric}>
                                    <span className={styles.demoMetricLabel}>Win Rate</span>
                                    <span className={styles.demoMetricValue}>{result.winRate}%</span>
                                </div>
                                <div className={styles.demoMetric}>
                                    <span className={styles.demoMetricLabel}>Trades</span>
                                    <span className={styles.demoMetricValue}>{result.trades}</span>
                                </div>
                            </div>

                            <a href={`/profit/${input}`} className={styles.demoCta}>
                                ✨ View Full History
                            </a>
                        </div>
                    )}
                </div>
            </Reveal>
        </section>
    );
};

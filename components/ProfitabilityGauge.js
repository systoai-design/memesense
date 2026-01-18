'use client';

import styles from './ProfitabilityGauge.module.css';

/**
 * Circular gauge component for displaying profitability percentage
 * @param {number} value - Percentage value (0-100)
 * @param {string} recommendation - BUY, WAIT, or AVOID
 */
export default function ProfitabilityGauge({ value = 50, recommendation = 'WAIT' }) {
    // Calculate stroke values for the SVG circle
    const radius = 85;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value / 100) * circumference;

    // Determine colors based on value
    const getColor = () => {
        if (value >= 65) return '#00d26a'; // Green
        if (value >= 45) return '#ff9f43'; // Orange
        return '#ff4757'; // Red
    };

    const color = getColor();

    return (
        <div className={styles.container}>
            <svg
                className={styles.gauge}
                viewBox="0 0 200 200"
            >
                {/* Background circle */}
                <circle
                    cx="100"
                    cy="100"
                    r={radius}
                    fill="none"
                    stroke="var(--bg-secondary)"
                    strokeWidth="12"
                />

                {/* Gradient definition */}
                <defs>
                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={color} stopOpacity="1" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.6" />
                    </linearGradient>

                    {/* Glow filter */}
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Progress circle */}
                <circle
                    cx="100"
                    cy="100"
                    r={radius}
                    fill="none"
                    stroke="url(#gaugeGradient)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transform="rotate(-90 100 100)"
                    filter="url(#glow)"
                    className={styles.progressRing}
                />

                {/* Tick marks for scale */}
                {[0, 25, 50, 75, 100].map((tick) => {
                    const angle = -90 + (tick / 100) * 360;
                    const rad = (angle * Math.PI) / 180;
                    const x1 = 100 + (radius - 20) * Math.cos(rad);
                    const y1 = 100 + (radius - 20) * Math.sin(rad);
                    const x2 = 100 + (radius - 8) * Math.cos(rad);
                    const y2 = 100 + (radius - 8) * Math.sin(rad);

                    return (
                        <line
                            key={tick}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="var(--border-color)"
                            strokeWidth="2"
                        />
                    );
                })}
            </svg>

            {/* Center content */}
            <div className={styles.content}>
                <div className={styles.value} style={{ color }}>
                    {value}
                    <span className={styles.percent}>%</span>
                </div>
                <div className={styles.label}>
                    {value >= 50 ? 'Profit' : 'Loss'} Probability
                </div>
                <div className={styles.lossIndicator}>
                    <span className={styles.lossValue}>{100 - value}%</span>
                    <span className={styles.lossLabel}>risk</span>
                </div>
            </div>
        </div>
    );
}

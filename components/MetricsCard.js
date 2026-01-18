'use client';

import styles from './MetricsCard.module.css';

/**
 * Card component for displaying a single metric
 * @param {string} label - Metric label
 * @param {string|number} value - Metric value
 * @param {string} icon - Emoji icon
 * @param {string} trend - 'up', 'down', or null
 * @param {string} color - 'green', 'red', or null
 */
export default function MetricsCard({ label, value, icon, trend, color }) {
    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <span className={styles.icon}>{icon}</span>
                <span className={styles.label}>{label}</span>
            </div>
            <div
                className={styles.value}
                style={{
                    color: color === 'green' ? 'var(--accent-green)' :
                        color === 'red' ? 'var(--accent-red)' :
                            'var(--text-primary)'
                }}
            >
                {value}
            </div>
            {trend && (
                <div className={`${styles.trend} ${styles[trend]}`}>
                    {trend === 'up' ? (
                        <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <path d="M18 15l-6-6-6 6" />
                            </svg>
                            Bullish
                        </>
                    ) : (
                        <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <path d="M6 9l6 6 6-6" />
                            </svg>
                            Bearish
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

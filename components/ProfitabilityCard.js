'use client';

import { DollarSign, Clock, HelpCircle, Copy, Share2, Heart, Shield, CheckCircle } from 'lucide-react';
import PnLCalendar from './PnLCalendar';

export default function ProfitabilityCard({ data, timeWindow = '7d' }) {
    if (!data || !data.summary || !data.summary[timeWindow]) return null;

    const summary = data.summary[timeWindow];
    const calendarData = summary.calendar || {};
    const phishing = summary.phishing || { blacklist: '--', soldMoreThanBought: 0 };
    const mcDist = summary.mcDistribution || { '0-100k': 0, '100k-500k': 0, '>500k': 0 };

    // Helper: Format Currency
    const fmtUSD = (val) => val === 0 ? '$0.00' : val?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtSOL = (val) => val?.toFixed(2);
    const fmtPct = (val) => (val || 0).toFixed(2) + '%';
    const fmtK = (val) => {
        if (!val) return '0';
        if (val >= 1000000) return (val / 1000000).toFixed(2) + 'M';
        if (val >= 1000) return (val / 1000).toFixed(2) + 'K';
        return val.toLocaleString();
    };

    const fmtDuration = (ms) => {
        if (!ms) return '0m';
        const mins = ms / 60000;
        if (mins < 60) return `${Math.round(mins)}m`;
        const hours = mins / 60;
        if (hours < 24) return `${Math.round(hours)}h`;
        return `${Math.round(hours / 24)}d`;
    };

    // Color Logic
    const isProfitable = summary.totalRealizedPnL > 0;
    const pnlColor = isProfitable ? '#00d47e' : (summary.totalRealizedPnL < 0 ? '#ff4d4d' : '#888');

    // --- ROI Distribution Logic ---
    const distribution = {
        '>500%': 0,
        '200% - 500%': 0,
        '0% - 200%': 0,
        '-50% - 0%': 0,
        '<-50%': 0
    };

    // Calculate Distribution
    const details = summary.details || [];
    details.forEach(p => {
        const roi = p.roi || 0;
        if (roi > 500) distribution['>500%']++;
        else if (roi > 200) distribution['200% - 500%']++;
        else if (roi >= 0) distribution['0% - 200%']++;
        else if (roi >= -50) distribution['-50% - 0%']++;
        else distribution['<-50%']++;
    });

    const totalCount = details.length || 1;

    // Stats
    const estFeesSOL = (summary.totalTrades || 0) * 0.00005;
    const estFeesUSD = estFeesSOL * (data.solPrice || 150);

    return (
        <div style={{ marginBottom: '24px' }}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', // Responsive, break to stack on mobile
                gap: '16px',
                alignItems: 'start' // Ensure columns don't stretch unnaturally
            }}>

                {/* --- COLUMN 1: PnL & Calendar --- */}
                <Card>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#e4e4e7' }}>{timeWindow === 'all' ? 'Total' : timeWindow.toUpperCase()} Realized PnL (USD)</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 13, color: '#a1a1aa' }}>Win Rate</span>
                        </div>
                    </div>

                    {/* Big Numbers */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            <span style={{ fontSize: 28, fontWeight: 800, color: pnlColor, lineHeight: 1 }}>
                                {summary.totalRealizedPnLUSD > 0 ? '+' : ''}{fmtUSD(summary.totalRealizedPnLUSD)}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: pnlColor }}>
                                {summary.totalRealizedPnL > 0 ? '+' : ''}{fmtSOL(summary.totalRealizedPnL)} SOL
                            </span>
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#e4e4e7' }}>
                            {fmtPct(summary.winRate)}
                        </div>
                    </div>

                    {/* Sub Stats */}
                    <div style={{ borderTop: '1px solid #27272a', paddingTop: 12, marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                            <span style={{ color: '#71717a' }}>Total PnL</span>
                            <span style={{ color: '#e4e4e7', fontWeight: 600 }}>
                                +${fmtK(summary.totalRealizedPnLUSD + summary.totalUnrealizedPnLUSD)}
                                <span style={{ color: summary.roi > 0 ? '#00d47e' : '#ff4d4d', marginLeft: 4 }}>({fmtPct(summary.roi || 0)})</span>
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: '#71717a' }}>Unrealized Profits</span>
                            <span style={{ color: summary.totalUnrealizedPnLUSD > 0 ? '#00d47e' : '#e4e4e7', fontWeight: 600 }}>
                                ${fmtK(summary.totalUnrealizedPnLUSD)}
                            </span>
                        </div>
                    </div>

                    {/* Calendar */}
                    <PnLCalendar data={calendarData} />
                </Card>


                {/* --- COLUMN 2: Analysis & Phishing --- */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Analysis Card */}
                    <Card>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#e4e4e7' }}>Analysis</span>
                            <span style={{ fontSize: 12, color: '#52525b' }}>{timeWindow} TXs: {summary.totalTrades}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
                            <StatRow label="Bal" value={`${(data.balance || 0).toFixed(2)} SOL`} sub={`($${fmtK((data.balance || 0) * (data.solPrice || 0))})`} />
                            <StatRow label="Avg Duration" value={`${fmtDuration(summary.avgHoldTime)}`} />
                            <StatRow label="Cost" value={`$${fmtK(summary.totalVolumeUSD / 2)}`} />
                            <StatRow label="Avg Cost / Sold" value={`$${fmtK(summary.avgBuySizeUSD)} / $${fmtK(summary.avgSellSizeUSD)}`} />
                            <StatRow label="Avg Realized Profits" value={`+${fmtUSD(summary.avgWinSizeUSD)}`} color={summary.avgWinSizeUSD > 0 ? '#00d47e' : '#ff4d4d'} />
                            <StatRow label="Fees" value={`~$${estFeesUSD.toFixed(3)}`} />
                            <StatRow label="Volume" value={`$${fmtK(summary.totalVolumeUSD)}`} />
                            <StatRow label="Tokens Traded" value={`${summary.details?.length || 0}`} />
                        </div>
                    </Card>

                    {/* Phishing Check Card */}
                    <Card>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                            <Shield size={14} color="#a1a1aa" />
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#e4e4e7' }}>Phishing check</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 12 }}>
                            <CheckItem label="Blacklist" status="clean" />
                            <CheckItem label="Didn't buy" status="clean" />
                            <CheckItem label="Sold > Bought" status={phishing.soldMoreThanBought > 0 ? 'warn' : 'clean'} count={phishing.soldMoreThanBought} />
                            <CheckItem label="Buy/Sell in 5s" status={phishing.fastTransactions > 0 ? 'warn' : 'clean'} count={phishing.fastTransactions} />
                        </div>
                    </Card>
                </div>


                {/* --- COLUMN 3: Distributions --- */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* ROI Dist */}
                    <Card>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#e4e4e7' }}>Distribution (Token {totalCount})</span>
                            <span style={{ fontSize: 12, color: '#52525b' }}>Count / %</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {Object.entries(distribution).map(([label, count]) => (
                                <DistBar key={label} label={label} count={count} total={totalCount} />
                            ))}
                        </div>
                    </Card>

                    {/* MC Dist (Avg Buy MC) */}
                    <Card>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#e4e4e7' }}>Avg Buy MC Distribution</span>
                            <span style={{ fontSize: 12, color: '#52525b' }}>Count / %</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <DistBar label="$0 - $100k" count={mcDist['0-100k'] || 0} total={totalCount} />
                            <DistBar label="$100k - $500k" count={mcDist['100k-500k'] || 0} total={totalCount} />
                            <DistBar label="> $500k" count={mcDist['>500k'] || 0} total={totalCount} />
                        </div>
                    </Card>
                </div>

            </div>
        </div>
    );
}

// --- SUB COMPONENTS ---

function Card({ children }) {
    return (
        <div style={{
            background: '#121214',
            border: '1px solid #27272a',
            borderRadius: '12px',
            padding: '16px',
            height: 'fit-content'
        }}>
            {children}
        </div>
    );
}

function StatRow({ label, value, sub, color = '#e4e4e7' }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#a1a1aa' }}>{label}</span>
            <div style={{ textAlign: 'right' }}>
                <span style={{ color: color, fontWeight: 500 }}>{value}</span>
                {sub && <span style={{ color: '#71717a', marginLeft: 4 }}>{sub}</span>}
            </div>
        </div>
    );
}

function CheckItem({ label, status, count }) {
    // status: clean (green), warn (red/yellow)
    const color = status === 'clean' ? '#00d47e' : '#ff4d4d';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            <span style={{ color: '#a1a1aa' }}>{label}:</span>
            <span style={{ color: '#e4e4e7' }}>{count || '--'}</span>
        </div>
    );
}

function DistBar({ label, count, total, colorOverride }) {
    const pct = total > 0 ? (count / total) * 100 : 0;

    let color = '#71717a';
    if (colorOverride) {
        color = colorOverride;
    } else {
        if (label.includes('>500%') || label.includes('> 500k')) color = '#00d47e';
        else if (label.includes('200%') || label.includes('100k')) color = '#34d399';
        else if (label.includes('0%') || label.includes('0 -')) color = '#10b981';
        else if (label.includes('-50%')) color = '#f87171';
        else color = '#ef4444';
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                <span style={{ color: '#a1a1aa', width: '80px' }}>{label}</span>
                {/* Bar */}
                <div style={{ flex: 1, height: 4, background: '#27272a', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color }} />
                </div>
            </div>
            <div style={{ marginLeft: 8, color: count > 0 ? '#e4e4e7' : '#52525b', minWidth: 50, textAlign: 'right' }}>
                {count} <span style={{ color: '#52525b' }}>({pct.toFixed(0)}%)</span>
            </div>
        </div>
    );
}

'use client';

import { useState } from 'react';
import { ExternalLink, Copy, Clock, TrendingUp } from 'lucide-react';

export default function CompactTradeTable({ trades }) {
    if (!trades || trades.length === 0) return <div style={{ color: '#666', padding: 20, textAlign: 'center' }}>No trading history found.</div>;

    // Sorting & Filtering State
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('ALL'); // ALL, WINS, LOSSES

    const handleSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    // Filter Logic
    const filteredTrades = trades.filter(trade => {
        // 1. Search Term (Name, Symbol, or Mint)
        const nameMatch = trade.metadata?.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const symbolMatch = trade.metadata?.symbol?.toLowerCase().includes(searchTerm.toLowerCase());
        const mintMatch = trade.mint.toLowerCase().includes(searchTerm.toLowerCase());
        const searchPass = !searchTerm || nameMatch || symbolMatch || mintMatch;

        // 2. Type Filter
        let typePass = true;
        if (filterType === 'WINS') typePass = trade.pnl > 0;
        if (filterType === 'LOSSES') typePass = trade.pnl < 0;

        return searchPass && typePass;
    });

    // Sort Logic
    const sortedTrades = [...filteredTrades].sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        // Specific Value Accessors
        if (sortConfig.key === 'date') {
            aVal = a.lastSellTime || a.firstBuyTime || 0;
            bVal = b.lastSellTime || b.firstBuyTime || 0;
        } else if (sortConfig.key === 'pnl') {
            aVal = a.pnlUsd || 0;
            bVal = b.pnlUsd || 0;
        } else if (sortConfig.key === 'roi') {
            aVal = a.roi || 0;
            bVal = b.roi || 0;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Helper: Time Ago
    const timeAgo = (timestamp) => {
        if (!timestamp) return '-';
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h`;
        return `${Math.floor(hours / 24)}d`;
    };

    // Helper: Duration
    const formatDuration = (ms) => {
        if (!ms) return '-';
        const minutes = Math.floor(ms / 60000);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m`;
    };

    return (
        <div style={{ background: '#09090b', borderRadius: '12px', border: '1px solid #27272a', overflow: 'hidden' }}>
            {/* Header / Filters */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>

                {/* Search */}
                <div style={{ position: 'relative', width: '200px' }}>
                    {/* Search Icon */}
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#71717a' }}>🔍</span>
                    <input
                        type="text"
                        placeholder="Search Token..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            background: '#18181b',
                            border: '1px solid #3f3f46',
                            borderRadius: '6px',
                            color: '#e4e4e7',
                            padding: '6px 10px 6px 32px',
                            fontSize: '13px',
                            outline: 'none'
                        }}
                    />
                </div>

                {/* Filter Tabs */}
                <div style={{ display: 'flex', gap: 4, background: '#18181b', padding: 4, borderRadius: 6 }}>
                    {['ALL', 'WINS', 'LOSSES'].map(type => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            style={{
                                background: filterType === type ? '#3f3f46' : 'transparent',
                                color: filterType === type ? '#fff' : '#a1a1aa',
                                border: 'none',
                                borderRadius: 4,
                                padding: '4px 12px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                fontWeight: 500,
                                transition: 'all 0.2s'
                            }}
                        >
                            {type}
                        </button>
                    ))}
                </div>

            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', whiteSpace: 'nowrap' }}>
                    <thead>
                        <tr style={{ background: '#18181b', color: '#a1a1aa', textAlign: 'left' }}>
                            <th style={{ padding: '12px 16px', fontWeight: 600 }}>Token</th>
                            <th
                                style={{ padding: '12px 16px', cursor: 'pointer', textAlign: 'right' }}
                                onClick={() => handleSort('pnl')}
                            >
                                PnL ($) {sortConfig.key === 'pnl' ? (sortConfig.direction === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th
                                style={{ padding: '12px 16px', cursor: 'pointer', textAlign: 'right' }}
                                onClick={() => handleSort('roi')}
                            >
                                ROI {sortConfig.key === 'roi' ? (sortConfig.direction === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th style={{ padding: '12px 16px', textAlign: 'center' }}>Buy/Sell</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Held</th>
                            <th
                                style={{ padding: '12px 16px', cursor: 'pointer', textAlign: 'right' }}
                                onClick={() => handleSort('date')}
                            >
                                Last Activity {sortConfig.key === 'date' ? (sortConfig.direction === 'desc' ? '▼' : '▲') : ''}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedTrades.map((trade, idx) => {
                            const isWin = trade.pnl > 0;
                            const isLoss = trade.pnl < 0; // Strict loss
                            const isOpen = trade.status === 'OPEN';
                            const pnlColor = isWin ? '#00d47e' : (isLoss ? '#ff4d4d' : '#71717a');

                            return (
                                <tr
                                    key={trade.mint + idx}
                                    style={{
                                        borderBottom: '1px solid #27272a',
                                        transition: 'background 0.2s',
                                        background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#27272a'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                                >
                                    {/* Token Column */}
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            {/* Token Image */}
                                            <div style={{
                                                width: 28, height: 28, // Sized up slightly
                                                borderRadius: '50%',
                                                background: '#27272a',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                overflow: 'hidden',
                                                flexShrink: 0
                                            }}>
                                                {trade.metadata?.image ? (
                                                    <img src={trade.metadata.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <span style={{ fontSize: '10px', color: '#888' }}>{trade.mint.slice(0, 2)}</span>
                                                )}
                                            </div>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <div style={{ fontWeight: 700, color: '#e4e4e7', fontSize: '14px' }}>
                                                        {trade.metadata?.symbol || (
                                                            <span style={{ fontFamily: 'monospace', opacity: 0.8 }}>{trade.mint.slice(0, 4)}</span>
                                                        )}
                                                    </div>
                                                    <a href={`https://dexscreener.com/solana/${trade.mint}`} target="_blank" rel="noreferrer" style={{ opacity: 0.5, color: '#a1a1aa', display: 'flex' }}>
                                                        <ExternalLink size={12} />
                                                    </a>
                                                </div>
                                                <div style={{ fontSize: '11px', color: isOpen ? '#3b82f6' : '#71717a', fontWeight: isOpen ? 600 : 400, marginTop: 2 }}>
                                                    {trade.metadata?.name || trade.status}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* PnL ($) */}
                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: pnlColor }}>
                                        {trade.pnlUsd >= 0 ? '+' : ''}${Math.abs(trade.pnlUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>

                                    {/* ROI */}
                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: pnlColor }}>
                                        {trade.roi ? `${trade.roi > 0 ? '+' : ''}${trade.roi.toFixed(1)}%` : '-'}
                                    </td>

                                    {/* Buy/Sell Counts */}
                                    <td style={{ padding: '12px 16px', textAlign: 'center', color: '#a1a1aa' }}>
                                        <span style={{ color: '#00d47e' }}>{trade.buyCount}</span> / <span style={{ color: '#ff4d4d' }}>{trade.sellCount}</span>
                                    </td>

                                    {/* Duration */}
                                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#e4e4e7' }}>
                                        {formatDuration(trade.duration)}
                                    </td>

                                    {/* Time Ago */}
                                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#71717a' }}>
                                        {timeAgo(trade.lastSellTime || trade.firstBuyTime)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

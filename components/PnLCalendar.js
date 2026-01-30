'use client';

import { useState } from 'react';
import styles from './Tooltip.module.css'; // Reusing tooltip styles
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PnLCalendar({ data }) {
    // data is the map: { "YYYY-MM-DD": { pnlUSD, winRate, trades... } }
    if (!data || Object.keys(data).length === 0) return null;

    // 1. Group Data by Month
    const monthsData = {};
    Object.keys(data).forEach(dateStr => {
        const date = new Date(dateStr);
        // Fix timezone issue by treating string as local or forcing consistent parsing
        // dateStr is YYYY-MM-DD. splitting is safer.
        const [y, m, d] = dateStr.split('-');
        const monthKey = `${y}-${m}`; // "2024-01"

        if (!monthsData[monthKey]) {
            monthsData[monthKey] = {
                year: parseInt(y),
                month: parseInt(m) - 1, // 0-indexed
                days: {}
            };
        }
        monthsData[monthKey].days[parseInt(d)] = data[dateStr];
    });

    // Sort months descending (newest first)
    const sortedMonthKeys = Object.keys(monthsData).sort().reverse();

    // Helper to format currency
    const fmtUSD = (val) => val === 0 ? '$0' : (val > 0 ? `+$${val.toFixed(2)}` : `-$${Math.abs(val).toFixed(2)}`);
    const fmtK = (val) => {
        if (Math.abs(val) >= 1000) return (val / 1000).toFixed(1) + 'K';
        return val.toFixed(0); // integer for small amounts
    };

    return (
        <div style={{ marginTop: 24, width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: '#e4e4e7', fontSize: 16, fontWeight: 700 }}>
                <Calendar size={18} /> Daily PnL
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {sortedMonthKeys.map(key => {
                    const month = monthsData[key];
                    // Generate calendar grid for this month
                    const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
                    const firstDayDow = new Date(month.year, month.month, 1).getDay(); // 0 = Sun

                    // Grid Array
                    const gridCells = [];
                    // Padding
                    for (let i = 0; i < firstDayDow; i++) {
                        gridCells.push(<div key={`pad-${i}`} />);
                    }
                    // Days
                    for (let d = 1; d <= daysInMonth; d++) {
                        const dayStats = month.days[d];

                        let bg = '#18181b'; // default dark
                        let color = '#52525b'; // default gray text

                        if (dayStats) {
                            if (dayStats.pnlUSD > 0) {
                                bg = 'rgba(0, 212, 126, 0.15)'; // Green tint
                                color = '#00d47e';
                            } else if (dayStats.pnlUSD < 0) {
                                bg = 'rgba(255, 77, 77, 0.15)'; // Red tint
                                color = '#ff4d4d';
                            }
                        }

                        gridCells.push(
                            <div key={d} className="calendar-day-cell" style={{
                                aspectRatio: '1/1',
                                background: bg,
                                borderRadius: '8px', // Slightly rounded like heatmap
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: color,
                                cursor: dayStats ? 'default' : 'default',
                                position: 'relative'
                            }} title={dayStats ? `${MONTHS[month.month]} ${d}: ${fmtUSD(dayStats.pnlUSD)}` : ''}>
                                {/* Day Number (Corner) */}
                                <div style={{ position: 'absolute', top: 3, left: 4, fontSize: '9px', opacity: 0.5 }}>{d}</div>

                                {/* Content */}
                                {dayStats ? (
                                    <div style={{ textAlign: 'center' }}>
                                        <div>{dayStats.pnlUSD > 0 ? '+' : ''}${fmtK(dayStats.pnlUSD)}</div>
                                    </div>
                                ) : (
                                    <div />
                                )}
                            </div>
                        );
                    }

                    return (
                        <div key={key}>
                            <h4 style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 8, fontWeight: 600 }}>
                                {MONTHS[month.month]} {month.year}
                            </h4>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(7, 1fr)',
                                gap: '4px',
                                maxWidth: '100%' // Ensure it doesn't overflow
                            }}>
                                {/* Header Days */}
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                                    <div key={i} style={{ textAlign: 'center', fontSize: 9, color: '#52525b', paddingBottom: 2 }}>{day}</div>
                                ))}
                                {gridCells}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

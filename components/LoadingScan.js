import React from 'react';
import { BarChart2, Bot, Activity } from 'lucide-react';

export default function LoadingScan({ type = "wallet" }) {
    // Shared loading state logic can be here or props
    // We'll mimic the static sequential fade or just simpler CSS animation if possible
    // But aligning with Analyze Page: it's static steps?
    // "Analyzing Token" vs "Analyzing Wallet History"

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            textAlign: 'center',
            color: 'white'
        }}>
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-6"
                style={{
                    borderTopColor: '#d4ff00',
                    borderRightColor: 'transparent',
                    borderBottomColor: '#d4ff00',
                    borderLeftColor: 'transparent',
                    width: 48, height: 48, borderWidth: 4, borderRadius: '50%'
                }}
            ></div>

            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px', color: '#d4ff00' }}>
                {type === 'wallet' ? 'Analyzing Wallet History...' : 'Analyzing Token...'}
            </h2>
            <p style={{ color: '#888', marginBottom: '32px' }}>
                Fetching on-chain data and running AI analysis
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'flex-start' }}>
                <StepItem icon={BarChart2} text="Fetching transaction history..." active={true} />
                <StepItem icon={Activity} text="Calculating PnL & Win Rate..." active={true} delay="0.5s" />
                <StepItem icon={Bot} text="Identifying bot patterns..." active={true} delay="1s" />
            </div>
        </div>
    );
}

function StepItem({ icon: Icon, text, active, delay }) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            opacity: 0,
            animation: `fadeIn 0.5s forwards ${delay || '0s'}`
        }}>
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
             `}</style>
            <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid #333'
            }}>
                <Icon size={16} color="#d4ff00" />
            </div>
            <span style={{ fontSize: '15px', color: '#ccc' }}>{text}</span>
        </div>
    );
}

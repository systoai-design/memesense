'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

export default function NotificationToast({ message, onClose }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Trigger enter animation
        requestAnimationFrame(() => setVisible(true));

        // Auto dismiss
        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(onClose, 300); // Wait for exit animation
        }, 3000);

        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div style={{
            position: 'fixed',
            bottom: 32,
            right: 0,
            left: 0,
            display: 'flex',
            justifyContent: 'center',
            zIndex: 10000,
            pointerEvents: 'none'
        }}>
            <div style={{
                background: 'rgba(255, 255, 255, 0.95)',
                color: '#000',
                padding: '12px 24px',
                borderRadius: '100px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontWeight: 600,
                fontSize: 14,
                transform: visible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
                opacity: visible ? 1 : 0,
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}>
                <Sparkles size={16} fill="#FFD700" color="#FFD700" />
                {message}
            </div>
        </div>
    );
}

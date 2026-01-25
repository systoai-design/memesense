'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            color: '#fff',
            background: '#000',
            fontFamily: 'system-ui, sans-serif'
        }}>
            <h2>Something went wrong!</h2>
            <p style={{ color: '#888', marginBottom: '20px' }}>{error.message || 'An unexpected error occurred.'}</p>
            <button
                onClick={() => reset()}
                style={{
                    padding: '10px 20px',
                    background: '#ccff00',
                    color: '#000',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                }}
            >
                Try again
            </button>
        </div>
    );
}

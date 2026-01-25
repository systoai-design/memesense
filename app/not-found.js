import Link from 'next/link';

export default function NotFound() {
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
            <h2>Not Found</h2>
            <p style={{ color: '#888', marginBottom: '20px' }}>Could not find requested resource</p>
            <Link href="/app" style={{
                padding: '10px 20px',
                background: '#ccff00',
                color: '#000',
                border: 'none',
                borderRadius: '5px',
                textDecoration: 'none',
                fontWeight: 'bold'
            }}>
                Return Home
            </Link>
        </div>
    );
}

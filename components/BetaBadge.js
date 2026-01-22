export default function BetaBadge() {
    return (
        <span style={{
            background: 'linear-gradient(90deg, #ccff00 0%, #00ff9d 100%)',
            color: 'black',
            fontWeight: '800',
            fontSize: '10px',
            padding: '2px 8px',
            borderRadius: '100px',
            marginLeft: '8px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            boxShadow: '0 0 10px rgba(204, 255, 0, 0.4)',
            verticalAlign: 'middle',
            display: 'inline-block',
            marginTop: '-12px' // Slight adjustments to align with logo top/center
        }}>
            Beta
        </span>
    );
}

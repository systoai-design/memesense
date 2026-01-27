import styles from './Tooltip.module.css';

export default function Tooltip({ text, children }) {
    return (
        <div className={styles.tooltipContainer}>
            {children}
            <div className={styles.tooltipText}>{text}</div>
        </div>
    );
}

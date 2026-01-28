/**
 * Estimated Monthly Average SOL Price
 * Used to calculate historical USD PnL more accurately than using current price.
 * Calibrated based on user data points (Apr '25 ~$75, Aug '25 ~$60) and current ($250).
 */
const SOL_PRICE_HISTORY = {
    // 2024
    "2024-01": 100,
    "2024-02": 110,
    "2024-03": 130,
    "2024-04": 150, // Peak 2024
    "2024-05": 160,
    "2024-06": 150,
    "2024-07": 140,
    "2024-08": 140,
    "2024-09": 130,
    "2024-10": 140,
    "2024-11": 160,
    "2024-12": 150,

    // 2025 (Inferred)
    "2025-01": 130,
    "2025-02": 110,
    "2025-03": 90,
    "2025-04": 75,  // Matched Dale
    "2025-05": 70,
    "2025-06": 65,
    "2025-07": 60,
    "2025-08": 60,  // Matched Shrimp
    "2025-09": 66,  // Matched MACMINI
    "2025-10": 85,
    "2025-11": 120,
    "2025-12": 180,

    // 2026
    "2026-01": 250
};

export function getHistoricalSolPrice(timestamp) {
    if (!timestamp) return 250;
    try {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const key = `${year}-${month}`;

        return SOL_PRICE_HISTORY[key] || 250; // Default to current if out of range
    } catch (e) {
        return 250;
    }
}

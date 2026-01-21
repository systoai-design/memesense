# MemeSense Technical Documentation

## 1. Overview
MemeSense is an AI-powered analytics platform designed for **pump.fun** memecoins on the Solana blockchain. It combines real-time data integration with generative AI (Google Gemini 2.0 Flash) to provide actionable trading insights, risk assessments, and profitability predictions.

**Tech Stack:**
- **Frontend/Framework:** Next.js 16 (App Router)
- **AI Engine:** Google Gemini 2.0 Flash
- **Database:** SQLite (`better-sqlite3`) for user credits and rate limiting.
- **Data Sources:** DexScreener (Price/Volume), Helius (RPC/On-chain), Bitquery (Historical).

---

## 2. Key Features

### 🔮 AI-Powered Token Analysis
- **Gemini Integration:** Uses `lib/gemini.js` to analyze token metrics and chart images.
- **Verdict Generation:** Outputs a structured JSON verdict including:
  - **Profit Probability (0-100%)**: Weighted score based on volume, liquidity, and holder distribution.
  - **Recommendation**: BUY, WAIT, or AVOID.
  - **Risk Level**: Assessment of rug pull potential.

### 📊 Profit Tracker (Wallet Analysis)
- **Performance Metrics:** Calculates Win Rate, Profit Factor, and Realized PnL for any Solana wallet.
- **"Grandma Trade" Detection:** Identifies partial history (sells without buys) to ensure data integrity.
- **Cashflow Analysis:** Tracks net SOL flow relative to the wallet.

### 🛡️ Safety & Risk Detection
- **Sniper Detection:** Identifies wallets that bought in the same block as the token launch.
- **Rug Pull Checks:** Monitors:
  - Top 10 Holder Concentration ( > 50% is critical risk).
  - Developer Wallet Actions (Holding vs. Sold All).
  - Wash Trading (Organic Score).

### 📈 Bonding Curve Tracking
- **Graduation Probability:** Estimates chance of hitting Raydium (filling the curve).
- **Velocity Tracking:** Measures how fast the curve is filling (% per minute).

---

## 3. Architecture & Data Flow

### Analysis Pipeline (`/api/analyze`)
1.  **Request:** User submits a Contract Address (CA).
2.  **Parallel Data Fetching:**
    - `getTokenData` (DexScreener): Price, Volume, Liquidity.
    - `getHolderData` (DexScreener/RPC): Estimated holder counts.
    - `getSniperData` (Helius/RPC): Check for block-0 buyers.
    - `getBondingCurveData`: Curve progress estimation.
3.  **Metric Calculation:**
    - **Organic Score:** Checks volume density and buy/sell ratios.
    - **Winning Profile:** Validates if the token matches successful patterns.
4.  **AI Analysis:** Sits on top of raw metrics to provide qualitative insights.
5.  **Safety Override:** Hard-coded logic overrides AI if "Dead Coin" or "Critical Risk" flags are triggered (preventing hallucinations).

---

## 4. Key Functions Reference

### `lib/trade-analysis.js`
Core logic for the Profit Tracker feature.

| Function | Description |
| whose | what |
| `calculateWalletMetrics(trades)` | Processes a list of raw trades to compute PnL, Win Rate, and Avg Hold Time. Handles both 'Closed' and 'Open' positions. |
| `analyzeTimeWindows(trades)` | Breaks down performance into 1d, 7d, 14d, and All-Time windows. |

### `lib/dexscreener.js`
Primary data connector for free market data.

| Function | Description |
| whose | what |
| `getTokenData(ca)` | Fetches price, volume, and pair info. **Note:** Mocks buy/sell counts using transaction array lengths if specific fields are missing. |
| `getHolderData(ca)` | **Estimation Only**: DexScreener does not provide exact holder counts. This estimates holders based on Market Cap / Volume ratios. |

### `lib/gemini.js`
AI Interface.

| Function | Description |
| whose | what |
| `analyzeMetrics(tokenData)` | Text-only analysis when no chart image is present. Enforces conservative logic (e.g., "Don't recommend BUY if volume is < $500"). |
| `analyzeChart(base64Image)` | Vision analysis looking for patterns (Flags, Cup & Handle) on price charts. |

---

## 5. UI Components (Visual structure)

*Note: Visuals are rendered via Next.js components.*

### Analysis Page (`app/analyze/[ca]`)
- **Header:** Token Name, Ticker, Contract Address (copyable).
- **Hero Metrics:**
    - Market Cap
    - 5m Volume (Critical for liveliness)
    - Bonding Progress (Bar chart)
- **The Verdict Card:**
    - Large "BUY" / "WAIT" / "AVOID" badge.
    - Confidence Score.
    - Key Insights list.
- **Mechanics Card:**
    - Dev Status (Green = Holding, Red = Sold).
    - Snipers (Count of block-0 buyers).
    - Top 10 distribution.

### Profit Tracker (`app/profit/[wallet]`)
- **Profile Header:** Wallet Address, Tier Badge.
- **Stats Grid:** Win Rate %, Profit Factor, Net PnL (SOL).
- **Trade History Table:** Detailed list of all token flips with entry/exit prices and duration.

---

## 6. Installation

```bash
# 1. Clone
git clone https://github.com/your-repo/memesense.git

# 2. Install
npm install

# 3. Environment
cp .env.example .env.local
# Add GEMINI_API_KEY from Google AI Studio

# 4. Run
npm run dev
```

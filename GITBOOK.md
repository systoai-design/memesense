# MemeSense Platform Documentation

Welcome to the official technical documentation for **MemeSense**, the industry-leading AI trading terminal designed for the Solana ecosystem.

Powered by **Grok (xAI)**, MemeSense provides institutional-grade analytics, real-time threat detection, and predictive modeling for high-velocity assets on pump.fun and Raydium.

---

## 📚 Table of Contents

1.  [**Introduction**](#introduction)
    *   [The MemeSense Advantage](#the-memesense-advantage)
    *   [Powered by Grok](#powered-by-grok)
2.  [**Core Intelligence**](#core-intelligence)
    *   [AI Predictive Modeling](#ai-predictive-modeling)
    *   [Data Integrity & Partial History](#data-integrity--partial-history)
    *   [Real-Time Mechanics](#real-time-mechanics)
3.  [**User Guide: Interpreting Signals**](#user-guide-interpreting-signals)
    *   [The Verdict Engine](#the-verdict-engine)
    *   [Safety & Rug Protection](#safety--rug-protection)
    *   [Institutional Metrics](#institutional-metrics)
4.  [**Metric Definitions**](#metric-definitions)
    *   [Organic Score](#organic-score)
    *   [Bonding Velocity](#bonding-velocity)
    *   [Sniper Detection](#sniper-detection)
5.  [**Developer Resources**](#developer-resources)
    *   [System Requirements](#system-requirements)
    *   [Step-by-Step Installation](#step-by-step-installation)
    *   [Configuration](#configuration)
    *   [API Reference](#api-reference)

---

## Introduction

### The MemeSense Advantage
MemeSense is not just a chart; it is a **decision engine**. In the chaotic environment of memecoin trading, speed and information asymmetry are the only edges that matter. MemeSense bridges this gap by aggregating on-chain RPC data, historical wallet behavior, and market sentiment into a single, actionable interface.

Unlike traditional explorers that simply display data, MemeSense **interprets** it. By analyzing liquidity patterns, holder distribution, and developer wallet behavior, it separates legitimate projects from calculated scams with high precision.

### Powered by Grok
MemeSense leverages the **Grok-1** inference engine by xAI to process unstructured market data. This allows the platform to:
- **Understand Context:** Grok analyzes the "narrative" of a token by correlating on-chain metrics with market structures.
- **Detect Anomalies:** The AI identifies subtle manipulation patterns (such as wash trading or bundled supply) that static code analysis often misses.
- **Provide Human-Readable Insights:** Complex technical signals are synthesized into clear, plain-English trading advice.

---

## Core Intelligence

### AI Predictive Modeling
![Analysis Dashboard Screenshot](/images/dashboard-overview.png)
The **AI Analyst** is the core of the platform. Upon querying a Contract Address (CA), the system initiates a multi-stage analysis pipeline:
1.  **Data Ingestion:** Fetches real-time OHLCV (Open, High, Low, Close, Volume) data from DexScreener.
2.  **Holder Analysis:** Queries Helius RPC nodes to map the top holders and identifying "whale" clusters.
3.  **Inference:** Mirrors the data against Grok's training set of successful "100x" tokens to calculate a **Winning Profile Score**.

### Data Integrity & Partial History
![Profit Tracker UI](/images/profit-tracker.png)
Copy-trading is a powerful strategy, but it is fraught with risk due to "Ghost Trades." Use the **Profit Tracker** to audit any Solana wallet with forensic depth.

**The "Partial History" Detection**
Legitimate PnL trackers often fail when a wallet sells tokens that were transferred in (funded by a dev/insider wallet) rather than bought on the open market. This makes the wallet appear infinitely profitable.
- **Detection Algorithm:** MemeSense scans the entire transaction history. If a `SELL` event is detected without a corresponding `BUY` or `TRANSFER_IN` event that accounts for the cost basis, the trade is flagged as **PARTIAL**.
- **Impact:** These trades are isolated from the main "Win Rate" calculation to prevent skewed data, ensuring you only copy-trade mathematically proven strategies.

### Real-Time Mechanics
![Bonding Curve Visualization](/images/bonding-curve.png)
For assets on **pump.fun**, timing is everything. MemeSense visualizes the **Bonding Curve** with millisecond accuracy.
- **Progress Visualization:** A dynamic radial bar showing proximity to the Raydium migration threshold (~$69k market cap).
- **Graduation Velocity:** A derivative metric calculating the *speed* of capital inflow (`% progress / minute`). High velocity (`>0.5%/min`) is a primary signal for FOMO-driven breakouts.

---

## User Guide: Interpreting Signals

### The Verdict Engine
Every analysis concludes with a decisive Verdict Card, designed for split-second decision making.

> **RECOMMENDATION: BUY**
> *Confidence: HIGH (82%)*

- **BUY:** The token exhibits a "Winning Profile" (High organic volume, low holder concentration, rising velocity).
- **WAIT:** The token has potential but shows mixed signals (e.g., price is dumping despite good volume). Recommended action: Set a limit order at support.
- **AVOID:** Fatal flaws detected. (See *Safety & Rug Protection* below).

### Safety & Rug Protection
The **Safety Engine** runs deterministically before the AI inference to filter out malicious tokens.
- **⛔ TOKEN IS DEAD:** 5-minute volume is negligible (<$100). The project has lost momentum.
- **⚠️ CRITICAL RUG RISK:** The Top 10 holders control >50% of the total supply. This "bundled" supply allows them to crash the price to zero instantly.
- **⚠️ DEV SOLD ALL:** The creator wallet has liquidated 100% of their holdings. While not always a scam, it indicates a lack of long-term commitment.

### Institutional Metrics
For advanced traders, toggle the **"Advanced"** view to see:
- **Smart Money Flow:** Aggregated net-flow (in SOL) of known profitable wallets.
- **Insider Activity:** Detection of wallets funded by the deployer that are masking their connection.
- **Volume Density:** ratio of Volume to Market Cap. Used to distinguish "Zombie" coins from active plays.

---

## Metric Definitions

### Organic Score (0.0 - 1.0)
A proprietary score measuring the legitimacy of trading volume.
- **Inputs:** Buy/Sell Ratio, Unique Wallets count, and Average Trade Size.
- **Interpretation:**
    - `> 0.8`: **Organic.** The volume is driven by real community demand.
    - `< 0.3`: **Artificial.** Likely bot-driven "wash trading" to fake activity.

### Bonding Velocity (%/min)
The first derivative of the bonding curve progress.
- **Calculation:** `(Current Progress - Progress 5 mins ago) / 5`.
- **Signal:** A sudden spike in velocity often precedes a price candle breakout.

### Sniper Detection
Identifies "Block-0" buyers—wallets that purchased in the very first block of the token's existence.
- **Risk Assessment:**
    - **Bullish:** 5/5 Snipers have *sold* their bags. The sell pressure is gone.
    - **Bearish:** 0/5 Snipers are *still holding*. They are waiting for higher prices to dump on late buyers.

---

## Developer Resources

MemeSense is built on a modern, scalable stack designed for self-hosting.

### System Requirements
*   **OS:** Windows, macOS, or Linux (Ubuntu 20.04+ recommended)
*   **Runtime:** Node.js 18.x or higher
*   **Database:** SQLite (Embedded, no separate server required)
*   **Memory:** 4GB RAM minimum

### Step-by-Step Installation

**1. Clone the Repository**
Open your terminal and clone the source code:
```bash
git clone https://github.com/CheckPoint/memesense.git
cd memesense
```

**2. Install Dependencies**
Install the required Node.js packages. This may take a few minutes.
```bash
npm install
# OR
yarn install
```

**3. Initialize Environment**
Copy the example environment file to create your local configuration.
```bash
cp .env.example .env.local
```

### Configuration

To power the AI insights, you must configure your API keys in the `.env.local` file.

**Required Keys:**

*   **`GROK_API_KEY`**: This is essential. Obtain your API key from the **xAI Console**.
    ```env
    GROK_API_KEY=xai-YOUR_API_KEY_HERE
    ```

**Optional Keys (Enhanced Data):**

*   `HELIUS_API_KEY`: Improves RPC speed and sniper detection accuracy.
*   `BITQUERY_API_KEY`: Unlocks deep historical scanning for older tokens.

### API Reference

MemeSense offers a RESTful API for integrating analysis into other tools.

#### `POST /api/analyze`

Triggers a full analysis cycle for a specific token.

**Request Body:**
```json
{
  "ca": "Token_Contract_Address_Here",
  "deviceId": "Unique_Session_ID_For_Rate_Limiting"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "analysis": {
    "recommendation": "BUY",
    "profitProbability": 82,
    "confidence": "HIGH"
  },
  "metrics": {
    "organicScore": 0.95,
    "bondingVelocity": "0.42%/min"
  },
  "safety": {
    "isRug": false,
    "devAction": "HOLDING"
  }
}
```

---
*© 2026 MemeSense. Built with ❤️ for the Solana Community.*

# MemeSense 🧠

AI-powered pump.fun memecoin analysis platform built with Next.js.

![MemeSense Preview](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

## Features

- 🔮 **AI-Powered Analysis** - Gemini AI analyzes token metrics and provides trading insights
- 📊 **Live Data** - Real-time market cap, volume, and price changes via DexScreener API
- 📈 **Profitability Predictions** - 60/40 probability analysis with confidence scores
- 👥 **Holder Analysis** - Track holder distribution and concentration risks
- 📉 **Buy/Sell Ratio** - Monitor market sentiment with transaction counts
- 🎓 **Graduation Tracking** - Bonding curve progress and graduation probability
- ⚡ **Auto-Refresh** - Live updates every 10 seconds without page refresh

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/memesense.git
cd memesense

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### Environment Variables

Create a `.env.local` file with:

```env
# Required for AI Analysis
GROK_API_KEY=your_grok_api_key

# Optional - for enhanced data
BITQUERY_API_KEY=your_bitquery_api_key
```

Get your Gemini API key at [Google AI Studio](https://aistudio.google.com/app/apikey).

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **AI**: Google Gemini 2.0 Flash
- **Data APIs**: DexScreener (free, no API key needed)
- **Database**: SQLite (better-sqlite3)
- **Styling**: Custom CSS with dark theme

## Project Structure

```
memesense/
├── app/
│   ├── page.js              # Landing page
│   ├── analyze/[ca]/        # Analysis results page
│   └── api/analyze/         # Analysis API endpoint
├── components/              # Reusable UI components
├── lib/
│   ├── gemini.js           # Gemini AI integration
│   ├── dexscreener.js      # Live data fetching
│   └── db.js               # User & credits management
└── public/                 # Static assets
```

## Deployment

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/memesense)

1. Click the button above or run `vercel deploy`
2. Add your `GEMINI_API_KEY` in Vercel environment settings

### Other Platforms

The app can be deployed to any platform supporting Node.js:
- Railway
- Render
- Fly.io
- Self-hosted

## License

MIT License - feel free to use this project for your own purposes.

## Disclaimer

⚠️ **Not financial advice.** Memecoin trading is extremely risky. This tool is for educational and informational purposes only. Always do your own research and never invest more than you can afford to lose.

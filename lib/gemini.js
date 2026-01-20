/**
 * Gemini AI Integration for Chart Analysis
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini client
function getGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    return new GoogleGenerativeAI(apiKey);
}

/**
 * Analyze a chart image using Gemini Vision
 * @param {string} base64Image - Base64 encoded chart image
 * @param {object} tokenData - Token metadata for context
 * @returns {object} Analysis results
 */
async function analyzeChart(base64Image, tokenData = {}) {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are an expert memecoin trader with deep knowledge of pump.fun token dynamics on Solana. Analyze this price chart and provide a comprehensive trading analysis.

TOKEN CONTEXT:
- Name: ${tokenData.name || 'Unknown'}
- Symbol: ${tokenData.symbol || 'N/A'}
- Market Cap: $${tokenData.marketCap || 'N/A'}
- Bonding Progress: ${tokenData.bondingProgress || 0}%
- Holders: ${tokenData.holders || 'Unknown'}
- 24h Volume: $${tokenData.volume24h || 'N/A'}

ANALYSIS REQUIREMENTS:

1. **PATTERN IDENTIFICATION**
   - What candlestick patterns do you see? (hammer, doji, engulfing, etc.)
   - Any chart formations? (triangle, flag, wedge, etc.)

2. **TREND ANALYSIS**
   - Current trend direction (uptrend/downtrend/consolidation)
   - Trend strength (weak/moderate/strong)
   - Key support and resistance levels visible

3. **VOLUME ANALYSIS**
   - Is volume confirming the price movement?
   - Any volume divergences or anomalies?

4. **MOMENTUM ASSESSMENT**
   - Buying pressure vs selling pressure
   - Signs of accumulation or distribution

5. **RISK FACTORS**
   - Volatility assessment
   - Potential rug pull indicators
   - Liquidity concerns

FINAL VERDICT (CRITICAL - Provide exact JSON format):

Based on your analysis, provide your verdict in EXACTLY this JSON format at the end of your response, wrapped in \`\`\`json code blocks:

\`\`\`json
{
  "profitProbability": <number between 0-100>,
  "confidence": "<LOW|MEDIUM|HIGH>",
  "recommendation": "<BUY|WAIT|AVOID>",
  "entryScore": <number 1-10>,
  "riskLevel": "<LOW|MEDIUM|HIGH|EXTREME>",
  "keySignals": [
    "<signal 1>",
    "<signal 2>",
    "<signal 3>"
  ],
  "summary": "<2-3 sentence overall summary>"
}
\`\`\`

Remember: Memecoins are highly volatile. Be realistic but helpful.`;

    try {
        const imagePart = {
            inlineData: {
                data: base64Image.replace(/^data:image\/\w+;base64,/, ''),
                mimeType: 'image/png'
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        // Parse the JSON verdict from the response
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        let verdict = null;

        if (jsonMatch) {
            try {
                verdict = JSON.parse(jsonMatch[1]);
            } catch (e) {
                console.error('Failed to parse verdict JSON:', e);
            }
        }

        return {
            success: true,
            fullAnalysis: text,
            verdict: verdict || {
                profitProbability: 50,
                confidence: 'LOW',
                recommendation: 'WAIT',
                entryScore: 5,
                riskLevel: 'HIGH',
                keySignals: ['Unable to parse AI response'],
                summary: 'Analysis completed but verdict parsing failed. Please review the full analysis.'
            }
        };
    } catch (error) {
        console.error('Gemini analysis error:', error);
        return {
            success: false,
            error: error.message,
            verdict: null
        };
    }
}

/**
 * Quick text-based analysis when no chart image is available
 * @param {object} tokenData - Token metrics
 * @returns {object} Analysis results
 */
async function analyzeMetrics(tokenData) {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are an expert pump.fun memecoin analyst. Based on the following metrics, provide a quick trading assessment.

TOKEN METRICS:
- Name: ${tokenData.name}
- Symbol: ${tokenData.symbol}
- Market Cap: $${tokenData.marketCap}
- Price Change 5m: ${tokenData.priceChange5m}%
- Price Change 1h: ${tokenData.priceChange1h}%
- Price Change 24h: ${tokenData.priceChange24h}%
- Volume (5m): $${tokenData.volume5m}
- Volume (1h): $${tokenData.volume1h}
- Volume (24h): $${tokenData.volume24h}
- Holders: ${tokenData.holders}
- Unique Buyers: ${tokenData.uniqueBuyers || 'N/A'}
- Bonding Curve Progress: ${tokenData.bondingProgress}%
- Trades: ${tokenData.buyCount} Buys / ${tokenData.sellCount} Sells
- Buy/Sell Ratio: ${tokenData.buyRatio}% Buys
- Top 10 Holders %: ${tokenData.top10HoldersPercent}%
- Token Age: ${tokenData.ageHours} hours
- Organic Score: ${tokenData.organicScore} (0-1, >0.6 is good)

CRITICAL INSTRUCTIONS:
1. **Be Conservative**: If 5m Volume is low (<$500) or Price Change 5m is negative, DO NOT recommend a STRONG BUY.
2. **Wash Trade Check**: If Unique Buyers is low but Volume is high, flag it.
3. **Dead Check**: If 5m Volume is 0, verdict must be AVOID/WAIT.
4. **Profit Probability**: Be realistic. High volume + High unique buyers + Positive momentum = High probability.

Provide your assessment in JSON format:

\`\`\`json
{
  "profitProbability": <0-99 (Be realistic, penalize for low volume/momentum)>,
  "confidence": "<LOW|MEDIUM|HIGH>",
  "recommendation": "<BUY|WAIT|AVOID>",
  "entryScore": <1-10>,
  "riskLevel": "<LOW|MEDIUM|HIGH|EXTREME>",
  "graduationChance": <0-100>,
  "keyInsights": ["<insight 1>", "<insight 2>", "<insight 3>"],
  "summary": "<brief 2-3 sentence summary>"
}
\`\`\``;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        let analysis = null;

        if (jsonMatch) {
            try {
                analysis = JSON.parse(jsonMatch[1]);
            } catch (e) {
                console.error('Failed to parse metrics analysis JSON:', e);
            }
        }

        return {
            success: true,
            analysis: analysis || {
                profitProbability: 50,
                confidence: 'LOW',
                recommendation: 'WAIT',
                entryScore: 5,
                riskLevel: 'HIGH',
                graduationChance: tokenData.bondingProgress,
                keyInsights: ['Analysis parsing failed'],
                summary: 'Unable to parse AI response. Please try again.'
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            analysis: null
        };
    }
}

module.exports = { analyzeChart, analyzeMetrics };

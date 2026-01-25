/**
 * Gemini AI Integration for Chart Analysis
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini client
function getGeminiClient() {
    const apiKey = process.env.GROK_API_KEY || process.env.GEMINI_API_KEY;
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

    // Extract Strict Metrics if available
    const am = tokenData.alphaMetrics || {};

    const prompt = `You are the MemeSense ALPHA ENGINE. You operate on strict protocol.
    
    HARD DATA (PRE-CALCULATED):
    - Liquidity Ratio: ${(parseFloat(am.liqRatio) * 100).toFixed(1)}% -> STATUS: ${am.liqStatus}
    - 5m Buy Pressure: ${am.pressure5m}% -> STATUS: ${am.pressureStatus}
    - Holder Concentration (Top 10): ${am.concentration}% -> STATUS: ${am.concentrationStatus}
    - Sniper Status: ${am.snipersSold}/${am.totalSnipers} Sold -> STATUS: ${am.sniperStatus}

    TOKEN METRICS:
    - Name: ${tokenData.name}
    - Market Cap: $${tokenData.marketCap}
    - Volume 5m: $${tokenData.volume5m}
    - Bonding Curve: ${tokenData.bondingProgress}%
    - Age: ${tokenData.ageHours} hours

    DIRECTIVE: GENERATE TWO OUTPUTS IN JSON FORMAT.
    
    1. "alphaReport": A Markdown formatted report structure EXACTLY like this:
       ### 🛡️ ALPHA ENGINE OUTPUT
       
       **VERDICT:** [VERDICT_LABEL]
       **RISK:** [LOW / MED / HIGH / DEGEN]

       #### 📉 HARD DATA
       | Metric | Value | Flag |
       | :--- | :--- | :--- |
       | **Liq/MCap** | ${(parseFloat(am.liqRatio) * 100).toFixed(1)}% | ${am.liqStatus} |
       | **5m Pressure** | ${am.pressure5m}% Buys | ${am.pressureStatus} |
       | **Concentration** | ${am.concentration}% | ${am.concentrationStatus} |

       #### 🧠 INTELLIGENCE
       * **Sniper Status:** ${am.snipersSold}/${am.totalSnipers} Sold (${am.sniperStatus})
       * **Insider Check:** [Analyze if Unique Buyers is low relative to volume]
       * **Structure Analysis:** [One rigid sentence on market structure]

       #### 🎯 TRADE PARAMETERS
       * **Entry:** $[Specific Price]
       * **Invalidation:** $[Specific Price]
       * **Target:** $[Specific Price]

    2. "Standard Fields": Fill these based on your Verdict for backward compatibility.
       - profitProbability: (LONG_CONVICTION > 80, WATCH > 50, AVOID < 20)
       - confidence: (HIGH/MEDIUM/LOW)
       - recommendation: (BUY/WAIT/AVOID)
       - entryScore: (1-10)

    FINAL OUTPUT JSON FORMAT:
    \`\`\`json
    {
      "alphaReport": "<The Markdown String Here>",
      "profitProbability": <number>,
      "confidence": "<string>",
      "recommendation": "<string>",
      "entryScore": <number>,
      "riskLevel": "<string>",
      "keyInsights": ["<insight 1>", "<insight 2>"],
      "summary": "<short summary>"
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

/**
 * Analyze wallet performance for copy trading suitability
 * @param {object} metrics - Wealth of wallet metrics (Profit Factor, Win Rate, etc)
 * @returns {string} Natural language summary
 */
async function analyzeWallet(metrics) {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Format metrics for the prompt
    const prompt = `You are an elite crypto copy-trading analyst. I will provide you with the performance metrics of a Solana wallet. 
    Your job is to provide a concise, professional assessment of whether this wallet is worth copy-trading.

    METRICS:
    - Status: ${metrics.profitFactor > 1.2 ? 'PROFITABLE' : 'UNPROFITABLE'}
    - Profit Factor: ${metrics.profitFactor.toFixed(2)} ( > 1.5 is good)
    - Win Rate: ${metrics.winRate.toFixed(1)}%
    - Realized PnL: ${metrics.totalRealizedPnL.toFixed(2)} SOL
    - Avg Win ROI: ${metrics.avgWinPercent.toFixed(1)}%
    - Avg Hold Time: ${(metrics.avgHoldTime / 60000).toFixed(1)} mins
    - Total Trades: ${metrics.totalTrades}
    - Safe Copy Margin: ${metrics.safeCopyMargin.toFixed(1)}%

    INSTRUCTIONS:
    1. **Verdict**: Explain WHY it is profitable or not based on the data. 
    2. **Strategy**: Identify their style (e.g., "High frequency scalper", "Swing trader", "Degen gambler").
    3. **Risk**: Mention if they rely on a few lucky wins (if Win Rate low but PnL high) or consistent edge.
    4. **Output**: precise 2-3 sentences. No markdown. Just plain text. Be direct.

    Example Output:
    "This wallet shows consistent profitability with a strong 60% win rate, indicating a disciplined scalping strategy. However, the low profit factor suggests their losses cut deep, so use a strict stop-loss if copying."
    `;

    /**
     * Retry wrapper for AI calls
     */
    async function retryOperation(operation, maxRetries = 3, delayMs = 2000) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                if (i === maxRetries - 1) throw error; // Throw on last attempt

                // Only retry on 429 or 503
                if (error.status === 429 || error.status === 503 || error.message?.includes('429')) {
                    console.log(`AI Rate limit hit, retrying in ${delayMs / 1000}s... (Attempt ${i + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    delayMs *= 2; // Exponential backoff
                } else {
                    throw error; // Don't retry other errors
                }
            }
        }
    }

    try {
        const result = await retryOperation(async () => {
            const res = await model.generateContent(prompt);
            return res.response;
        });
        return result.text();
    } catch (error) {
        console.error('Gemini wallet analysis error:', error);

        // Fallback for strict rate limits
        if (error.status === 429 || error.message?.includes('429')) {
            return "AI Analysis is currently experiencing high demand. Please try again in a moment.";
        }
        return "Unable to generate AI analysis at this time.";
    }
}

module.exports = { analyzeChart, analyzeMetrics, analyzeWallet };

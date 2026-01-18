/**
 * Bitquery GraphQL Client for Pump.fun Data
 * Free tier: 10,000 points/month
 */

const { GraphQLClient, gql } = require('graphql-request');

const BITQUERY_ENDPOINT = 'https://streaming.bitquery.io/graphql';

function getBitqueryClient() {
    const apiKey = process.env.BITQUERY_API_KEY;
    if (!apiKey) {
        console.warn('BITQUERY_API_KEY not set, using mock data');
        return null;
    }

    return new GraphQLClient(BITQUERY_ENDPOINT, {
        headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json',
        },
    });
}

/**
 * Fetch comprehensive token data from pump.fun
 * @param {string} tokenAddress - Token contract address
 * @returns {object} Token data
 */
async function getTokenData(tokenAddress) {
    const client = getBitqueryClient();

    // If no API key, return mock data for development
    if (!client) {
        return getMockTokenData(tokenAddress);
    }

    const query = gql`
    query GetPumpFunToken($token: String!) {
      Solana {
        DEXTradeByTokens(
          where: {
            Trade: {
              Currency: {
                MintAddress: { is: $token }
              }
              Dex: {
                ProtocolName: { is: "pump" }
              }
            }
          }
          limit: { count: 100 }
          orderBy: { descending: Block_Time }
        ) {
          Trade {
            Currency {
              Name
              Symbol
              MintAddress
              Decimals
            }
            Price
            PriceInUSD
            Side {
              Type
            }
            Amount
            AmountInUSD
          }
          Block {
            Time
          }
        }
      }
    }
  `;

    try {
        const data = await client.request(query, { token: tokenAddress });
        return processTokenData(data, tokenAddress);
    } catch (error) {
        console.error('Bitquery error:', error);
        return getMockTokenData(tokenAddress);
    }
}

/**
 * Get token holder information
 * @param {string} tokenAddress - Token contract address
 * @returns {object} Holder data
 */
async function getHolderData(tokenAddress) {
    const client = getBitqueryClient();

    if (!client) {
        return getMockHolderData();
    }

    const query = gql`
    query GetTokenHolders($token: String!) {
      Solana {
        BalanceUpdates(
          where: {
            BalanceUpdate: {
              Currency: {
                MintAddress: { is: $token }
              }
            }
          }
          orderBy: { descendingByField: "balance" }
          limit: { count: 50 }
        ) {
          BalanceUpdate {
            Account {
              Address
            }
            Currency {
              Symbol
            }
          }
          balance: sum(of: BalanceUpdate_Amount)
        }
      }
    }
  `;

    try {
        const data = await client.request(query, { token: tokenAddress });
        return processHolderData(data);
    } catch (error) {
        console.error('Holder data error:', error);
        return getMockHolderData();
    }
}

/**
 * Get bonding curve progress for a pump.fun token
 * @param {string} tokenAddress - Token contract address
 * @returns {object} Bonding curve data
 */
async function getBondingCurveData(tokenAddress) {
    // Pump.fun bonding curve typically graduates at ~$69k-$80k market cap
    // This is a simplified calculation
    const client = getBitqueryClient();

    if (!client) {
        return getMockBondingData();
    }

    try {
        // Get current market cap from recent trades
        const tokenData = await getTokenData(tokenAddress);
        const marketCap = tokenData.marketCap || 0;

        // Graduation threshold is approximately $69,000 to $80,000
        const graduationThreshold = 69000;
        const progress = Math.min((marketCap / graduationThreshold) * 100, 100);

        return {
            progress: Math.round(progress * 100) / 100,
            marketCap: marketCap,
            graduationThreshold: graduationThreshold,
            isGraduated: progress >= 100,
            estimatedToGraduation: graduationThreshold - marketCap
        };
    } catch (error) {
        console.error('Bonding curve error:', error);
        return getMockBondingData();
    }
}

/**
 * Get OHLCV data for charting
 * @param {string} tokenAddress - Token contract address
 * @param {string} interval - Time interval (1m, 5m, 15m, 1h)
 * @returns {array} OHLCV candles
 */
async function getOHLCVData(tokenAddress, interval = '15m') {
    const client = getBitqueryClient();

    if (!client) {
        return getMockOHLCVData();
    }

    const query = gql`
    query GetOHLCV($token: String!) {
      Solana {
        DEXTradeByTokens(
          where: {
            Trade: {
              Currency: {
                MintAddress: { is: $token }
              }
              Dex: {
                ProtocolName: { is: "pump" }
              }
            }
          }
          orderBy: { ascending: Block_Time }
        ) {
          Block {
            Time(interval: { count: 15, in: minutes })
          }
          open: minimum(of: Trade_Price, selectWhere: { lt: "0" })
          high: maximum(of: Trade_Price)
          low: minimum(of: Trade_Price)
          close: maximum(of: Trade_Price, selectWhere: { lt: "0" })
          volume: sum(of: Trade_AmountInUSD)
        }
      }
    }
  `;

    try {
        const data = await client.request(query, { token: tokenAddress });
        return processOHLCVData(data);
    } catch (error) {
        console.error('OHLCV error:', error);
        return getMockOHLCVData();
    }
}

// === Data Processing Functions ===

function processTokenData(data, tokenAddress) {
    const trades = data?.Solana?.DEXTradeByTokens || [];

    if (trades.length === 0) {
        return getMockTokenData(tokenAddress);
    }

    const firstTrade = trades[trades.length - 1];
    const latestTrade = trades[0];

    // Calculate metrics
    const currency = latestTrade.Trade.Currency;
    const currentPrice = latestTrade.Trade.PriceInUSD;
    const buys = trades.filter(t => t.Trade.Side.Type === 'buy');
    const sells = trades.filter(t => t.Trade.Side.Type === 'sell');

    const totalVolume = trades.reduce((sum, t) => sum + (t.Trade.AmountInUSD || 0), 0);

    // Estimate market cap (simplified)
    const estimatedSupply = 1_000_000_000; // Pump.fun tokens typically have 1B supply
    const marketCap = currentPrice * estimatedSupply;

    return {
        name: currency.Name,
        symbol: currency.Symbol,
        address: currency.MintAddress,
        decimals: currency.Decimals,
        price: currentPrice,
        marketCap: Math.round(marketCap),
        volume24h: Math.round(totalVolume),
        buyCount: buys.length,
        sellCount: sells.length,
        buyRatio: Math.round((buys.length / trades.length) * 100),
        totalTrades: trades.length,
        firstTradeTime: firstTrade.Block.Time,
        lastTradeTime: latestTrade.Block.Time
    };
}

function processHolderData(data) {
    const balances = data?.Solana?.BalanceUpdates || [];

    const holders = balances
        .filter(b => b.balance > 0)
        .map(b => ({
            address: b.BalanceUpdate.Account.Address,
            balance: b.balance,
            percentage: 0 // Will be calculated
        }));

    const totalSupply = holders.reduce((sum, h) => sum + h.balance, 0);
    holders.forEach(h => {
        h.percentage = (h.balance / totalSupply) * 100;
    });

    const top10 = holders.slice(0, 10);
    const top10Percent = top10.reduce((sum, h) => sum + h.percentage, 0);

    return {
        totalHolders: holders.length,
        top10Holders: top10,
        top10HoldersPercent: Math.round(top10Percent * 100) / 100,
        holderDistribution: {
            whales: holders.filter(h => h.percentage > 5).length,
            large: holders.filter(h => h.percentage > 1 && h.percentage <= 5).length,
            medium: holders.filter(h => h.percentage > 0.1 && h.percentage <= 1).length,
            small: holders.filter(h => h.percentage <= 0.1).length
        }
    };
}

function processOHLCVData(data) {
    const candles = data?.Solana?.DEXTradeByTokens || [];

    return candles.map(c => ({
        time: new Date(c.Block.Time).getTime() / 1000,
        open: parseFloat(c.open) || 0,
        high: parseFloat(c.high) || 0,
        low: parseFloat(c.low) || 0,
        close: parseFloat(c.close) || 0,
        volume: parseFloat(c.volume) || 0
    }));
}

// === Mock Data for Development ===

function getMockTokenData(address) {
    const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    return {
        name: 'MOCK TOKEN',
        symbol: 'MOCK',
        address: address,
        decimals: 9,
        price: random(1, 100) / 10000,
        marketCap: random(10000, 800000),
        volume24h: random(5000, 200000),
        buyCount: random(100, 500),
        sellCount: random(50, 300),
        buyRatio: random(45, 75),
        totalTrades: random(200, 800),
        priceChange24h: random(-50, 100),
        firstTradeTime: new Date(Date.now() - random(1, 72) * 3600000).toISOString(),
        lastTradeTime: new Date().toISOString()
    };
}

function getMockHolderData() {
    return {
        totalHolders: Math.floor(Math.random() * 1000) + 100,
        top10Holders: Array(10).fill(null).map((_, i) => ({
            address: `Holder${i + 1}...${Math.random().toString(36).slice(2, 6)}`,
            balance: Math.floor(Math.random() * 10000000),
            percentage: Math.random() * (i === 0 ? 15 : 5)
        })),
        top10HoldersPercent: Math.floor(Math.random() * 30) + 20,
        holderDistribution: {
            whales: Math.floor(Math.random() * 5),
            large: Math.floor(Math.random() * 20),
            medium: Math.floor(Math.random() * 100),
            small: Math.floor(Math.random() * 500)
        }
    };
}

function getMockBondingData() {
    const progress = Math.floor(Math.random() * 100);
    return {
        progress: progress,
        marketCap: Math.floor(progress * 690),
        graduationThreshold: 69000,
        isGraduated: progress >= 100,
        estimatedToGraduation: Math.max(0, 69000 - (progress * 690))
    };
}

function getMockOHLCVData() {
    const candles = [];
    let price = 0.00001 + Math.random() * 0.0001;
    const now = Math.floor(Date.now() / 1000);

    for (let i = 48; i >= 0; i--) {
        const volatility = 0.1;
        const change = (Math.random() - 0.5) * 2 * volatility;
        const open = price;
        price = price * (1 + change);
        const high = Math.max(open, price) * (1 + Math.random() * 0.05);
        const low = Math.min(open, price) * (1 - Math.random() * 0.05);

        candles.push({
            time: now - (i * 15 * 60),
            open: open,
            high: high,
            low: low,
            close: price,
            volume: Math.random() * 50000
        });
    }

    return candles;
}

module.exports = {
    getTokenData,
    getHolderData,
    getBondingCurveData,
    getOHLCVData
};

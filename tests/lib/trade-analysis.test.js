import assert from 'assert';
import { calculateWalletMetrics } from '../../lib/trade-analysis.js';

console.log('Running calculateWalletMetrics tests...');

try {
    // TestCase 1: Basic Buy and Sell with Profit
    // Bought 1 SOL worth (100 tokens), Sold 1.5 SOL worth (100 tokens) -> 0.5 Profit
    const mockTrades1 = [
        { type: 'BUY', mint: 'TokenA', solAmount: 1.0, tokenAmount: 100, timestamp: 1000 },
        { type: 'SELL', mint: 'TokenA', solAmount: 1.5, tokenAmount: 100, timestamp: 2000 }
    ];

    const result1 = calculateWalletMetrics(mockTrades1);

    assert.strictEqual(result1.totalRealizedPnL, 0.5, 'Total PnL should be 0.5');
    assert.strictEqual(result1.winRate, 100, 'Win Rate should be 100%');
    assert.strictEqual(result1.avgHoldTime, 1000, 'Avg Hold Time should be 1000ms');

    // TestCase 2: Loss
    // Bought 1 SOL, Sold 0.5 SOL -> -0.5 Profit
    const mockTrades2 = [
        { type: 'BUY', mint: 'TokenB', solAmount: 1.0, tokenAmount: 100, timestamp: 1000 },
        { type: 'SELL', mint: 'TokenB', solAmount: 0.5, tokenAmount: 100, timestamp: 2000 }
    ];

    const result2 = calculateWalletMetrics(mockTrades2);
    assert.strictEqual(result2.totalRealizedPnL, -0.5, 'Total PnL should be -0.5');
    assert.strictEqual(result2.winRate, 0, 'Win Rate should be 0%');

    console.log('✅ ALL TESTS PASSED');

} catch (e) {
    console.error('❌ TEST FAILED:', e.message);
    process.exit(1);
}

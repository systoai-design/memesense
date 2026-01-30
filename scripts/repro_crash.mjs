
import { calculateWalletMetrics } from '../lib/trade-analysis.js';

// Mock empty price map
const priceMap = {};
const solPrice = 150;

console.log('Test 1: Normal Trades');
const trades1 = [
    { type: 'BUY', mint: 'MINT1', solAmount: 1, tokenAmount: 100, timestamp: Date.now() - 100000 },
    { type: 'SELL', mint: 'MINT1', solAmount: 1.2, tokenAmount: 100, timestamp: Date.now() }
];
try {
    const res1 = calculateWalletMetrics(trades1, priceMap, solPrice, 0);
    console.log('Result 1:', res1.winRate);
} catch (e) {
    console.error('Crash 1:', e);
}

console.log('Test 2: Trade with Missing Mint (Should be ignored safely?)');
const trades2 = [
    { type: 'BUY', solAmount: 1, tokenAmount: 100, timestamp: Date.now() } // No Mint
];
try {
    const res2 = calculateWalletMetrics(trades2, priceMap, solPrice, 0);
    console.log('Result 2:', res2.winRate);
} catch (e) {
    console.error('Crash 2:', e);
}

console.log('Test 3: Trade with Undefined tokenAmount (NaN check)');
const trades3 = [
    { type: 'BUY', mint: 'MINT2', solAmount: 1, tokenAmount: undefined, timestamp: Date.now() }
];
try {
    const res3 = calculateWalletMetrics(trades3, priceMap, solPrice, 0);
    console.log('Result 3:', res3.winRate);
} catch (e) {
    console.error('Crash 3:', e);
}

const { SniperDetector } = require('../lib/SniperDetector');

async function testSniperDetector(mintAddress) {
    console.log(`Testing Sniper Detection for: ${mintAddress}`);
    const detector = new SniperDetector();

    const startTime = Date.now();
    const result = await detector.detectSnipers(mintAddress);
    const duration = Date.now() - startTime;

    console.log(`\n--- ANALYSIS COMPLETE (${duration}ms) ---`);
    console.log(`Total Snipers: ${result.totalSnipers}`);
    console.log(`Insider Count: ${result.insiderCount}`);
    console.log(`Risk Level:    ${result.riskLevel}`);
    console.log('\n--- SNIPER LIST ---');

    result.snipers.forEach(s => {
        console.log(`[${s.tag}] ${s.address.slice(0, 4)}...${s.address.slice(-4)} | Bought: ${s.amountBought.toFixed(0)} | Holding: ${s.isHolding ? 'YES' : 'NO'}`);
    });
}

// Example Token (Change as needed) or take from args
const target = process.argv[2] || 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pKdZ2a'; // BONK (or any active token)
testSniperDetector(target);

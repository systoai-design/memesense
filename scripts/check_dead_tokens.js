const fetch = require('node-fetch');

async function check() {
    // Check BWT Candidate
    const mintBWT = 'Dnb9dLSXxAarXVexehzeH8W8nFmLMNJSuGoaddZSwtog';
    try {
        const url = `https://api.dexscreener.com/latest/dex/tokens/${mintBWT}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data.pairs || data.pairs.length === 0) {
            console.log(`[BWT?] ${mintBWT}: No Pairs.`);
        } else {
            console.log(`[BWT?] ${mintBWT}: Found ${data.pairs.length} pairs.`);
            const best = data.pairs[0];
            console.log(`  Symbol: ${best.baseToken.symbol}`);
            console.log(`  Liq: $${best.liquidity?.usd}`);
        }
    } catch (e) { console.log(e); }

    // Search BATHROOM
    try {
        const url2 = `https://api.dexscreener.com/latest/dex/search?q=BATHROOM`;
        const res2 = await fetch(url2);
        const data2 = await res2.json();
        const solPairs = (data2.pairs || []).filter(p => p.chainId === 'solana');
        console.log(`\nFound ${solPairs.length} BATHROOM pairs on Solana:`);
        solPairs.slice(0, 3).forEach(p => {
            console.log(`  [${p.baseToken.symbol}] ${p.baseToken.address} Liq: $${p.liquidity?.usd}`);
        });
    } catch (e) { console.log(e); }
}

check();

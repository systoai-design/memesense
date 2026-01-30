const fetch = require('node-fetch');

async function search() {
    const q = 'Barron Meme';
    const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        const solPairs = (data.pairs || []).filter(p => p.chainId === 'solana');

        console.log(`Found ${solPairs.length} pairs for '${q}'`);
        solPairs.forEach(p => {
            console.log(`[${p.baseToken.symbol}] ${p.baseToken.address} Liq: $${p.liquidity?.usd}`);
        });
    } catch (e) { console.log(e); }
}
search();

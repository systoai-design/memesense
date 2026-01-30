const fetch = require('node-fetch');

const MINTS = [
    '4gfNpwo8LQtcgGrNmgWhuwfFhttgZ8Qb6QXN4Yz8BAGS',
    'Dnb9dLSXxAarXVexehzeH8W8nFmLMNJSuGoaddZSwtog',
    'DzrScTJ32QqLWNQz6UEwRe5QaTw9SJbAepAuh95wBAGS', // CLAWD (Closed Check)
    'GDYKiEguadwhmcexFzK9ADHjegJgHeFPZDo831p2p637'  // SHANNON (Closed Check)
];

async function checkPrices() {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${MINTS.join(',')}`;
    console.log(`Fetching prices from ${url}`);

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (!data.pairs) {
            console.log("No pairs found.");
            return;
        }

        MINTS.forEach(mint => {
            const pairs = data.pairs.filter(p => p.baseToken.address === mint);
            if (pairs.length === 0) {
                console.log(`[${mint}] NO PAIRS FOUND on DexScreener.`);
            } else {
                const best = pairs.sort((a, b) => b.liquidity.usd - a.liquidity.usd)[0];
                console.log(`[${mint}] ${best.baseToken.symbol}`);
                console.log(`  Price: $${best.priceUsd}`);
                console.log(`  Liq: $${best.liquidity.usd}`);
                console.log(`  URL: ${best.url}`);
            }
        });

    } catch (e) { console.error(e); }
}

checkPrices();

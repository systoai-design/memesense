const fetch = require('node-fetch'); // Ensure node-fetch is available or use native fetch in newer node

async function check() {
    const ca = "3ppvBuw4QwjaBsBZfj8XDAQCVAWqgXy8cWccE5TQpu";
    const url = `https://api.dexscreener.com/latest/dex/tokens/${ca}`;
    console.log("Fetching:", url);
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.pairs && data.pairs.length > 0) {
            const p = data.pairs[0];
            console.log("Has pairs:", data.pairs.length);
            console.log("Pair 0 info:", JSON.stringify(p.info, null, 2));
            console.log("Pair 0 baseToken:", JSON.stringify(p.baseToken, null, 2));
            console.log("Pair 0 imageUrl (direct):", p.imageUrl); // Check if it's top level? Unlikely.
        } else {
            console.log("No pairs found");
        }
    } catch (e) {
        console.error(e);
    }
}

check();

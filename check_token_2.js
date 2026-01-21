const fetch = require('node-fetch');

async function check() {
    const ca = "3ppvBuw4QwjaBsBZfj8XDAQCVAWqgXy8cWccE5TQpu";

    // Test 1: Direct
    console.log("--- TEST 1: Direct ---");
    const url1 = `https://api.dexscreener.com/latest/dex/tokens/${ca}`;
    try {
        const res = await fetch(url1);
        const text = await res.text();
        console.log("Direct Response:", text.substring(0, 500));
    } catch (e) { console.error(e); }

    // Test 2: Search
    console.log("\n--- TEST 2: Search ---");
    const url2 = `https://api.dexscreener.com/latest/dex/search?q=${ca}`;
    try {
        const res = await fetch(url2);
        const data = await res.json();
        if (data.pairs && data.pairs.length > 0) {
            console.log("Search found pairs:", data.pairs.length);
            // Log the imageUrl of the first pair
            console.log("First pair info:", data.pairs[0].info);
            console.log("First pair baseToken:", data.pairs[0].baseToken);
        } else {
            console.log("Search: No pairs found");
        }
    } catch (e) { console.error(e); }
}

check();

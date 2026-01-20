const fetch = require('node-fetch');

async function checkCDN() {
    const ca = "3ppvBuw4QwjaBsBZFj8XDAQCVAWqgXy8cWccE5TQpump";
    const url = `https://dd.dexscreener.com/ds-data/tokens/solana/${ca}.png`;
    console.log("Checking CDN:", url);
    try {
        const res = await fetch(url);
        console.log("Status:", res.status);
        if (res.ok) {
            console.log("Image found!");
        } else {
            console.log("Image not found on CDN.");
        }
    } catch (e) { console.error(e); }
}

checkCDN();

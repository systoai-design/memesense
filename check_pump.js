const fetch = require('node-fetch');

async function checkPump() {
    const ca = "3ppvBuw4QwjaBsBZFj8XDAQCVAWqgXy8cWccE5TQpump";
    const url = `https://frontend-api.pump.fun/coins/${ca}`;
    console.log("Fetching Pump.fun data:", url);
    try {
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            console.log("Image URI:", data.image_uri);
        } else {
            console.log("Pump API failed:", res.status);
        }
    } catch (e) { console.error(e); }
}

checkPump();

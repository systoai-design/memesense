require('dotenv').config({ path: '.env.local' });

const SOLSCAN_API_BASE = 'https://pro-api.solscan.io/v2.0';
const WALLET = 'E1ED87qzdUPfK2zTLgYGatEnuo1pLHfukTLUjxxG7j7y';

async function main() {
    const apiKey = process.env.SOLSCAN_API_KEY;
    if (!apiKey) {
        console.error('No API Key');
        return;
    }

    console.log(`Fetching swaps for ${WALLET}...`);

    // Fetch first page
    const url = `${SOLSCAN_API_BASE}/account/defi/activities?address=${WALLET}&activity_type=ACTIVITY_TOKEN_SWAP&page=1&page_size=50&sort_by=block_time&sort_order=desc`;

    try {
        const resp = await fetch(url, {
            headers: { 'token': apiKey }
        });

        const json = await resp.json();
        if (!json.success) {
            console.error('API Error:', json);
            return;
        }

        const activities = json.data;
        console.log(`Fetched ${activities.length} activities.`);

        // Dump details for first few items or outliers
        activities.slice(0, 10).forEach((act, i) => {
            console.log(`\n--- Activity ${i} [${act.trans_id}] ---`);
            if (act.routers) {
                act.routers.forEach((r, ri) => {
                    console.log(`  Router ${ri}:`);
                    console.log(`    In: ${r.token1} (Amt: ${r.amount1}, Dec: ${r.token1_decimals})`);
                    console.log(`    Out: ${r.token2} (Amt: ${r.amount2}, Dec: ${r.token2_decimals})`);
                });
            } else {
                console.log('  No routers data');
            }
        });

    } catch (e) {
        console.error('Req failed:', e);
    }
}

main();

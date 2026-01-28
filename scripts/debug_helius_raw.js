require('dotenv').config({ path: '.env.local' });

// Get API Key
const RPC = process.env.HELIUS_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
const match = RPC?.match(/api-key=([a-f0-9-]+)/i);
const API_KEY = match ? match[1] : null;
const WALLET = 'E1ED87qzdUPfK2zTLgYGatEnuo1pLHfukTLUjxxG7j7y';

async function main() {
    if (!API_KEY) {
        console.error('No Helius API Key found in .env.local');
        return;
    }

    console.log(`Fetching Helius txs for ${WALLET}...`);
    const url = `https://api.helius.xyz/v0/addresses/${WALLET}/transactions?api-key=${API_KEY}&limit=20`;

    try {
        const resp = await fetch(url);
        if (!resp.ok) {
            console.error('Helius Error:', resp.status, resp.statusText);
            const text = await resp.text();
            console.error('Body:', text);
            return;
        }

        const txs = await resp.json();
        console.log(`Fetched ${txs.length} txs.`);

        txs.forEach((tx, i) => {
            if (!tx.tokenTransfers || tx.tokenTransfers.length === 0) return;

            console.log(`\n--- TX ${i} [${tx.signature.substring(0, 8)}...] ---`);
            tx.tokenTransfers.forEach((tt, ti) => {
                const isIncoming = tt.toUserAccount === WALLET;
                const dir = isIncoming ? 'IN' : 'OUT';
                console.log(`  ${dir} Mint: ${tt.mint}`);
                console.log(`    Keys: ${Object.keys(tt).join(', ')}`);
                console.log(`    Amt: ${tt.tokenAmount}`);
                console.log(`    Raw: ${tt.rawTokenAmount}`);
                console.log(`    Dec: ${tt.decimals}`);
            });
        });

        // Check Metadata for Dale
        const DALE = 'CZSE6FyovrMTANcyuRVxCJDKtr6V9yHvAypyJWY7pump';
        console.log(`\nFetching Metadata for ${DALE}...`);
        const assetResp = await fetch(`https://mainnet.helius-rpc.com/?api-key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'debug-das',
                method: 'getAsset',
                params: { id: DALE, displayOptions: { showFungible: true } }
            })
        });
        const asset = await assetResp.json();
        console.log('Asset:', JSON.stringify(asset.result?.token_info, null, 2));

    } catch (e) {
        console.error('Script failed:', e);
    }
}

main();

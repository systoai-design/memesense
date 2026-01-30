import 'dotenv/config';
import fetch from 'node-fetch';

const SIG = '4eG5v1sSYQt6NVZGF8CxoQPJonZAUKonwXfekeMQyX6iRujzyKvsy5vs57hfe4q4SEebKCDF4WebRKEhBE1uFDji';
const API_KEY = '4bd4311b-8cf4-4f9e-9aac-e46f2375008d';

async function dump() {
    console.log("Fetching TX:", SIG);
    const url = `https://api.helius.xyz/v0/transactions/?api-key=${API_KEY}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: [SIG] })
    });

    const data = await res.json();
    if (data && data.length > 0) {
        const tx = data[0];
        console.log("Keys:", Object.keys(tx));
        console.log("Type:", tx.type);
        console.log("Source:", tx.source);

        console.log("\n--- NATIVE TRANSFERS ---");
        (tx.nativeTransfers || []).forEach(t => {
            console.log(`From: ${t.fromUserAccount.slice(0, 8)}... -> To: ${t.toUserAccount.slice(0, 8)}... | ${t.amount / 1e9} SOL`);
        });

        console.log("\n--- ACCOUNT DATA ---");
        (tx.accountData || []).forEach(a => {
            if (a.account === 'E1ED87qzdUPfK2zTLgYGatEnuo1pLHfukTLUjxxG7j7y') {
                console.log("User Account Data:", a);
            }
        });

    } else {
        console.log("No data found.");
    }
}
dump();

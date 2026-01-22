import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        const body = await req.json();

        // Primary: Helius (or configured PRIVATE RPC)
        const PRIMARY_RPC = process.env.HELIUS_RPC_URL;
        // Fallback: Public Solana RPC
        const FALLBACK_RPC = 'https://api.mainnet-beta.solana.com';

        let rpcUrl = PRIMARY_RPC || FALLBACK_RPC;
        let usedFallback = false;

        // Helper to perform request
        const performRpcCall = async (url) => {
            return await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        };

        let response = await performRpcCall(rpcUrl);

        // If Primary failed with Auth error (403/401) or Rate Limit (429), try fallback
        if (!response.ok && (response.status === 403 || response.status === 401 || response.status === 429) && !usedFallback && PRIMARY_RPC) {
            console.warn(`Primary RPC (${rpcUrl}) failed with ${response.status}. Switching to Public Fallback.`);
            rpcUrl = FALLBACK_RPC;
            usedFallback = true;
            response = await performRpcCall(rpcUrl);
        }

        if (!response.ok) {
            return NextResponse.json({
                error: `RPC Error: ${response.status}`,
                details: await response.text().catch(() => 'No details')
            }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('RPC Proxy Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

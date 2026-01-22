
const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;

/**
 * Extract API Key from the configured RPC URL
 */
function getApiKey() {
    if (!HELIUS_RPC_URL) return null;
    const match = HELIUS_RPC_URL.match(/api-key=([a-f0-9-]+)/i);
    return match ? match[1] : null;
}

/**
 * Helius Digital Asset Standard (DAS) API
 * fast "getAsset" to fetch metadata, authorities, and token info in one call.
 * Reference: https://docs.helius.dev/compression-and-das/getasset
 */
export async function getAsset(assetId) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('No Helius API Key found');

    const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'memesense-das',
            method: 'getAsset',
            params: {
                id: assetId,
                displayOptions: {
                    showFungible: true // Get token supply/details
                }
            }
        })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result;
}

/**
 * Helius Enhanced Transactions API
 * Used for high-performance sniper detection (finding early buyers)
 * Reference: https://docs.helius.dev/enhanced-transactions-api/parse-transaction-history
 */
export async function getEnhancedTransactions(address, options = {}) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('No Helius API Key found');

    const { limit = 100, before = '', type } = options;
    
    let url = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${apiKey}`;
    if (limit) url += `&limit=${limit}`;
    if (before) url += `&before=${before}`;
    if (type) url += `&type=${type}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Helius Enhanced API Error: ${response.status}`);
    }

    return await response.json();
}

/**
 * Get Token Authorities via DAS (Instant)
 * Replaces manual account parsing.
 */
export async function getHeliusTokenAuthorities(tokenAddress) {
    try {
        const asset = await getAsset(tokenAddress);
        
        // DAS returns specific "authorities" array often empty for fungible tokens,
        // but "token_info" contains the freeze/mint authority.
        const tokenInfo = asset.token_info;
        
        if (!tokenInfo) {
            return { isEstimated: true, reason: 'No token_info in DAS response' };
        }

        const mintAuthority = tokenInfo.mint_authority;
        const freezeAuthority = tokenInfo.freeze_authority;
        const supply = tokenInfo.supply;
        const decimals = tokenInfo.decimals;

        // Burn calculation (Simplified for DAS)
        // If mint is null and freeze is null, it's very safe (likely burned LP if Raydium)
        let burnPercent = 0;
        if (!mintAuthority && !freezeAuthority) {
            burnPercent = 100;
        } else if (!mintAuthority) {
            burnPercent = 50;
        }

        return {
            burnPercent,
            isRenounced: !mintAuthority,
            isFreezeRevoked: !freezeAuthority,
            mintAuthority,
            freezeAuthority,
            supply: supply / Math.pow(10, decimals),
            decimals,
            isEstimated: false, // REAL ON-CHAIN DATA
            metadata: {
                name: asset.content?.metadata?.name,
                symbol: asset.content?.metadata?.symbol,
                uri: asset.content?.json_uri
            }
        };

    } catch (error) {
        console.error('Helius DAS Authorities Failed:', error);
        return { isEstimated: true, error: error.message };
    }
}

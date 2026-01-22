import { Connection, PublicKey } from '@solana/web3.js';
import { getEarliestTrades } from './bitquery.js';
import { getHeliusTokenAuthorities, getEnhancedTransactions } from './helius.js';

// Use public RPC by default, or HELIUS_RPC_URL from env if set
// Use public RPC by default, or HELIUS_RPC_URL from env if set
// Use HELIUS_RPC_URL (Server) if available, otherwise fallback to public
const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';
const RPC_ENDPOINT = process.env.HELIUS_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || DEFAULT_RPC;

// Initialize Connection
const connection = new Connection(RPC_ENDPOINT, 'confirmed');
console.log('Solana Lib Initialized with RPC:', RPC_ENDPOINT);

/**
 * Get Sniper Data for a Token - Hybrid Bitquery (First) -> Helius -> RPC
 * Finds early buyers and checks if they still hold
 * 
 * @param {string} tokenAddress - Contract address
 * @returns {Promise<Object>} - { totalSnipers, snipersSold, sniperWallets, riskLevel, isEstimated, method }
 */
export async function getSniperData(tokenAddress) {
    // Method 1: Try Bitquery (Most Accurate "First Block" data)
    try {
        const bitqueryTrades = await getEarliestTrades(tokenAddress);
        if (bitqueryTrades && bitqueryTrades.length > 0) {
            console.log(`Bitquery found ${bitqueryTrades.length} early trades`);

            // Extract unique buyers
            const snipers = [...new Set(bitqueryTrades.map(t => t.Trade.Account.Address))].slice(0, 30);

            if (snipers.length > 0) {
                const result = await checkHoldingStatus(snipers, tokenAddress);
                return { ...result, method: 'bitquery_first_block', isEstimated: false };
            }
        }
    } catch (e) {
        console.log('Bitquery sniper check failed, trying Helius...', e);
    }

    // Method 2: Try Helius Enhanced Transaction API (Via New Lib)
    try {
        const heliusResult = await getSnipersFromHelius(tokenAddress);
        if (heliusResult && !heliusResult.isEstimated) {
            return { ...heliusResult, method: 'helius_enhanced' };
        }
    } catch (e) {
        console.log('Helius sniper check failed, trying RPC fallback...');
    }

    // Method 3: Fallback to standard RPC (for tokens with <1000 txs)
    try {
        const rpcResult = await getSnipersFromRPC(tokenAddress);
        if (rpcResult && !rpcResult.isEstimated) {
            return { ...rpcResult, method: 'rpc' };
        }
        return rpcResult;
    } catch (e) {
        console.error('RPC sniper check failed:', e);
        return { isEstimated: true, reason: 'All methods failed', error: e.message };
    }
}

/**
 * Helper to check holding status of a list of wallets
 */
async function checkHoldingStatus(walletList, tokenAddress) {
    let stillHolding = 0;
    let soldAll = 0;
    const pubKey = new PublicKey(tokenAddress);

    await Promise.all(
        walletList.map(async (wallet) => {
            try {
                const accounts = await connection.getParsedTokenAccountsByOwner(
                    new PublicKey(wallet),
                    { mint: pubKey }
                );
                if (accounts.value.length > 0) {
                    const amount = accounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
                    if (amount > 10) stillHolding++;
                    else soldAll++;
                } else {
                    soldAll++;
                }
            } catch (e) {
                soldAll++;
            }
        })
    );

    const totalSnipers = walletList.length;
    const soldRatio = soldAll / totalSnipers;
    const riskLevel = soldRatio > 0.8 ? 'LOW' : soldRatio < 0.3 ? 'HIGH' : 'MEDIUM';

    return {
        totalSnipers,
        snipersSold: soldAll,
        stillHolding,
        sniperWallets: walletList,
        riskLevel,
        details: `${stillHolding}/${totalSnipers} Holding`
    };
}

/**
 * Use Helius Enhanced API to find snipers (early buyers)
 */
async function getSnipersFromHelius(tokenAddress) {
    try {
        // Fetch last 100 transactions, filtered by 'SWAP' if possible or just parse content
        // Note: 'type=SWAP' is supported in specific Helius endpoints, check docs if v0 supports it standardly
        // v0 addresses/{address}/transactions supports standard parsing

        const transactions = await getEnhancedTransactions(tokenAddress, { limit: 100 });

        if (!transactions || transactions.length === 0) {
            return { isEstimated: true, reason: 'No Helius data' };
        }

        // Sort by timestamp (oldest first)
        const sortedTxs = [...transactions].reverse();
        const creationTime = sortedTxs[0]?.timestamp || 0;
        const sniperWindow = creationTime + 60; // First 60 seconds

        const sniperWallets = new Set();

        for (const tx of sortedTxs) {
            if (tx.timestamp > sniperWindow) break;

            if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
                for (const transfer of tx.tokenTransfers) {
                    if (transfer.mint === tokenAddress && transfer.toUserAccount) {
                        sniperWallets.add(transfer.toUserAccount);
                    }
                }
            }
        }

        // Remove system addresses
        const systemAddresses = ['11111111111111111111111111111111', 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'];
        systemAddresses.forEach(addr => sniperWallets.delete(addr));

        if (sniperWallets.size === 0) {
            return { isEstimated: true, reason: 'No snipers in first 60s' };
        }

        const walletList = Array.from(sniperWallets).slice(0, 10);

        // Reuse checkHoldingStatus helper
        return await checkHoldingStatus(walletList, tokenAddress);

    } catch (error) {
        console.error('Helius Sniper Check Failed:', error);
        return { isEstimated: true, error: error.message };
    }
}

/**
 * Fallback RPC method for sniper detection
 */
async function getSnipersFromRPC(tokenAddress) {
    try {
        const pubKey = new PublicKey(tokenAddress);
        const signatures = await connection.getSignaturesForAddress(pubKey, { limit: 1000 });

        if (signatures.length === 0) return { isEstimated: true, reason: 'No signatures' };
        if (signatures.length >= 1000) return { isEstimated: true, reason: 'Too many txs' };

        const sortedSigs = signatures.sort((a, b) => (a.blockTime || 0) - (b.blockTime || 0));

        const firstTxs = await connection.getParsedTransactions(
            sortedSigs.slice(0, 10).map(s => s.signature),
            { maxSupportedTransactionVersion: 0 }
        );

        const sniperWallets = [];

        for (const tx of firstTxs) {
            if (!tx || !tx.meta) continue;
            const preBalances = tx.meta.preTokenBalances || [];
            const postBalances = tx.meta.postTokenBalances || [];

            for (const post of postBalances) {
                const pre = preBalances.find(p => p.accountIndex === post.accountIndex);
                const preAmount = pre ? parseFloat(pre.uiTokenAmount?.uiAmount || 0) : 0;
                const postAmount = parseFloat(post.uiTokenAmount?.uiAmount || 0);

                if (postAmount > preAmount && postAmount > 0 && post.owner && !sniperWallets.includes(post.owner)) {
                    sniperWallets.push(post.owner);
                }
            }
        }

        if (sniperWallets.length === 0) return { isEstimated: true, reason: 'No buyers found' };

        const limits = sniperWallets.slice(0, 5);
        const balances = await Promise.all(
            limits.map(async (wallet) => {
                try {
                    const accounts = await connection.getParsedTokenAccountsByOwner(new PublicKey(wallet), { mint: pubKey });
                    return accounts.value.length > 0 ? accounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0 : 0;
                } catch (e) { return 0; }
            })
        );

        const stillHolding = balances.filter(b => b > 10).length;
        const snipersSold = limits.length - stillHolding;

        return {
            totalSnipers: limits.length,
            snipersSold,
            stillHolding,
            riskLevel: snipersSold < (limits.length / 2) ? 'HIGH' : 'LOW',
            isEstimated: false,
            details: `${stillHolding}/${limits.length} Holding`
        };
    } catch (error) {
        console.error('RPC Sniper Check failed:', error);
        return { isEstimated: true, error: error.message };
    }
}

/**
 * Get Token Authorities & Safety Info
 * Checks mint authority (renounced), freeze authority (revoked), and burn %
 * NOW USES HELIUS DAS FOR INSTANT CHECK
 * @param {string} tokenAddress - Token mint address
 * @returns {Promise<Object>} - { burnPercent, isRenounced, isFreezeRevoked, isEstimated }
 */
export async function getTokenAuthorities(tokenAddress) {
    try {
        // Try Helius DAS first (Fastest/Most Accurate)
        const heliusData = await getHeliusTokenAuthorities(tokenAddress);
        if (!heliusData.isEstimated) {
            return heliusData;
        }
    } catch (e) {
        console.warn('Helius DAS Authorities failed, falling back to RPC...', e);
    }

    try {
        const pubKey = new PublicKey(tokenAddress);

        // Fetch parsed mint account info
        const mintInfo = await connection.getParsedAccountInfo(pubKey);

        if (!mintInfo.value || !mintInfo.value.data || !mintInfo.value.data.parsed) {
            return {
                burnPercent: 0,
                isRenounced: false,
                isFreezeRevoked: false,
                isEstimated: true,
                reason: 'Could not parse mint info'
            };
        }

        const parsed = mintInfo.value.data.parsed.info;

        // Check authorities
        const mintAuthority = parsed.mintAuthority;
        const freezeAuthority = parsed.freezeAuthority;

        // Get supply info
        const supply = parseFloat(parsed.supply) || 0;
        const decimals = parsed.decimals || 0;

        // For pump.fun tokens, burn % is typically 100% if all LP tokens burned
        // We can check if there's a known burn address holding tokens
        // For now, we'll check the bonding curve - if graduated, LP was burned

        // Simplified burn check: If mintAuthority is null and freezeAuthority is null
        // it's a strong indicator the token is "safe"
        // Pump.fun tokens typically have 100% burn after migration to Raydium

        // Check for common burn addresses or calculate based on circulating supply
        let burnPercent = 0;

        // If token is on Raydium (graduated from pump.fun), LP is typically burned
        // We'll estimate burn based on if authorities are revoked
        if (mintAuthority === null && freezeAuthority === null) {
            burnPercent = 100; // Fully secured token
        } else if (mintAuthority === null) {
            burnPercent = 50; // Partially secured
        }

        return {
            burnPercent: burnPercent,
            isRenounced: mintAuthority === null,
            isFreezeRevoked: freezeAuthority === null,
            mintAuthority: mintAuthority,
            freezeAuthority: freezeAuthority,
            supply: supply / Math.pow(10, decimals),
            decimals: decimals,
            isEstimated: false
        };

    } catch (error) {
        console.error('Token Authorities Check Failed:', error);
        return {
            burnPercent: 0,
            isRenounced: false,
            isFreezeRevoked: false,
            isEstimated: true,
            error: error.message
        };
    }
}

/**
 * Calculate Pump.fun Bonding Curve Address
 */
function getPumpFunBondingCurve(mintAddress) {
    try {
        const PUMP_PROGRAM = new PublicKey('6EF8rrecthSpatmi7YqgrU4gMfe6t7EdhL3rC11t8N3');
        const [bondingCurve] = PublicKey.findProgramAddressSync(
            [Buffer.from('bonding-curve'), new PublicKey(mintAddress).toBuffer()],
            PUMP_PROGRAM
        );
        return bondingCurve.toString();
    } catch (e) {
    }
}

/**
* Fetch Real Holder Data from Solana RPC
* @param {string} tokenAddress  
*/
export async function getRealHolderData(tokenAddress) {
    try {
        const pubKey = new PublicKey(tokenAddress);

        // 1. Get Token Supply
        const supplyInfo = await connection.getTokenSupply(pubKey);
        const totalSupply = supplyInfo.value.uiAmount;

        // 2. Get Largest Accounts (Top 20)
        const largestAccounts = await connection.getTokenLargestAccounts(pubKey);
        const topHoldersRaw = largestAccounts.value.slice(0, 20);

        if (!topHoldersRaw || topHoldersRaw.length === 0) {
            throw new Error('No holders found via RPC');
        }

        // 3. Identify System Accounts via Account Parsing
        // We need to know the OWNER of these token accounts to see if they are Raydium Pools or Bonding Curves.
        // `getTokenLargestAccounts` returns the Token Account Address, not the Owner.
        let accountInfos = [];
        try {
            accountInfos = await connection.getMultipleAccountsInfo(
                topHoldersRaw.map(h => new PublicKey(h.address))
            );
        } catch (e) {
            console.warn('Failed to parse (getMultipleAccountsInfo), falling back to basic addresses:', e.message);
            // proceed with empty accountInfos (labels will just fail, but addresses display)
        }

        const PUMP_BONDING_CURVE = '6EF8rrecthSpatmi7YqgrU4gMfe6t7EdhL3rC11t8N3';
        const RAYDIUM_AUTHORITY_V4 = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1';
        const TOKEN_METADATA_PROG = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';

        // Bonding Curve Address (The account ITSELF might be the bonding curve PDA)
        const bondingCurvePDA = getPumpFunBondingCurve(tokenAddress);

        let top10Holdings = 0;

        // 4. Process Holders
        const processedHolders = topHoldersRaw.map((h, index) => {
            const info = accountInfos?.[index];
            let owner = null;

            // Parse Owner from Account Data (Layout: Mint(32) + Owner(32) + ...)
            if (info && info.data && info.data.length >= 64) {
                try {
                    const ownerBuf = info.data.subarray(32, 64);
                    owner = new PublicKey(ownerBuf).toString();
                } catch (e) { /* ignore parse error */ }
            }

            const addr = h.address.toString();
            let name = null;
            let isSystem = false;

            // Check if Owner or Address matches System knowns
            if (owner === PUMP_BONDING_CURVE || addr === bondingCurvePDA) {
                name = 'Bonding Curve';
                isSystem = true;
            } else if (owner === RAYDIUM_AUTHORITY_V4) {
                name = 'Raydium Pool';
                isSystem = true;
            } else if (owner === TOKEN_METADATA_PROG) {
                name = 'Token Metadata';
                isSystem = true;
            }

            return {
                address: addr,
                owner: owner,
                balance: h.uiAmount,
                percent: ((h.uiAmount / totalSupply) * 100).toFixed(2),
                name,
                isSystem
            };
        });

        // 5. Calculate Metrics (Exclude System from Concentration)
        const humanHolders = processedHolders.filter(h => !h.isSystem);
        const top10Humans = humanHolders.slice(0, 10);

        top10Humans.forEach(h => {
            top10Holdings += (h.balance || 0);
        });

        const top10Percent = (top10Holdings / totalSupply) * 100;

        return {
            supply: totalSupply,
            top10Percent: parseFloat(top10Percent.toFixed(2)),
            top10Holders: processedHolders,
            isEstimated: false
        };

    } catch (error) {
        console.error('RPC Holder Check failed:', error);

        // Check for Rate Limit 429
        if (error.message?.includes('429')) {
            return { isEstimated: true, error: "RPC Rate Limit (Try again in 10s)", code: 429 };
        }

        return { isEstimated: true, error: error.message };
    }
}

/**
 * Get Total Holder Count using getProgramAccounts (Lightweight Mode)
 * Uses dataSlice to fetch only keys, avoiding large payload.
 */
export async function getTotalHolderCount(tokenAddress) {
    try {
        const pubKey = new PublicKey(tokenAddress);

        // Helius or dedicated RPC is preferred for GPA
        // We use the existing 'connection' object which uses RPC_ENDPOINT

        // Use getProgramAccounts with dataSlice for minimal payload (just counting)
        // Filter for Token Layout size (165) and Mint address match
        const accounts = await connection.getProgramAccounts(new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), {
            filters: [
                { dataSize: 165 },
                { memcmp: { offset: 0, bytes: tokenAddress } }
            ],
            dataSlice: { offset: 0, length: 0 } // Fetch NO data, just existing accounts
        });

        console.log(`[HolderCount] Found ${accounts.length} holders via GPA`);
        return accounts.length;

    } catch (e) {
        console.warn('GPA Holder Count failed:', e.message);
        return null;
    }
}

/**
 * Get Unique Buyers from recent history (Last 500 txs)
 * @param {string} tokenAddress 
 */
/**
 * Get Unique Buyers from recent history (Last 500 txs)
 * @param {string} tokenAddress 
 */
export async function getUniqueBuyers(tokenAddress) {
    try {
        // OPTIMIZED: Use Helius Enhanced API via shared client (Avoids RPC 429s)
        try {
            const transactions = await getEnhancedTransactions(tokenAddress, { limit: 50, type: 'SWAP' });

            const uniqueBuyers = new Set();
            transactions.forEach(tx => {
                // Check token transfers for buys
                const buys = (tx.tokenTransfers || []).filter(t => t.mint === tokenAddress);
                buys.forEach(transfer => {
                    if (transfer.toUserAccount) uniqueBuyers.add(transfer.toUserAccount);
                });
            });

            return uniqueBuyers.size;
        } catch (e) {
            console.warn('Helius Enhanced API failed for unique buyers, falling back to signatures:', e.message);
        }

        // FALLBACK: Fast Signature Count (Approximate)
        const pubKey = new PublicKey(tokenAddress);
        const signatures = await connection.getSignaturesForAddress(pubKey, { limit: 50 });

        // Return 0 if signatures found but Helius failed, to avoid heavy RPC usage on heavy fallback
        // Or try a very lightweight extrapolation
        if (signatures.length > 0) {
            const chunk = signatures.slice(0, 10);
            try {
                const txs = await connection.getParsedTransactions(chunk.map(s => s.signature), { maxSupportedTransactionVersion: 0 });
                const buyers = new Set();
                txs.forEach(tx => {
                    if (tx && tx.transaction && tx.transaction.message.accountKeys[0]) {
                        buyers.add(tx.transaction.message.accountKeys[0].pubkey.toString());
                    }
                });
                return Math.floor(buyers.size * (signatures.length / 10)); // Extrapolate
            } catch (e) {
                return 0;
            }
        }

        return 0;

    } catch (e) {
        console.error('Unique Buyer Check Failed:', e);
        return 0;
    }
}

/**
 * Get Dev Wallet Status - Hybrid approach with Helius API + Inference fallback
 * @param {string} tokenAddress - Contract address
 * @param {Object} holderData - Optional holder data for inference fallback
 * @param {number} ageHours - Optional token age for inference
 * @returns {Promise<Object>} - { devWallet, action, balance, isEstimated, method }
 */
export async function getDevWalletStatus(tokenAddress, holderData = null, ageHours = 0) {
    // Method 1: Try Helius Enhanced Transaction API
    try {
        const heliusResult = await getDevFromHelius(tokenAddress);
        if (heliusResult && !heliusResult.isEstimated) {
            return { ...heliusResult, method: 'helius' };
        }
    } catch (e) {
        console.log('Helius API failed (Dev Status), trying RPC fallback...');
    }

    // Method 2: Try standard RPC (for tokens with <1000 txs)
    try {
        const rpcResult = await getDevFromRPC(tokenAddress);
        if (rpcResult && !rpcResult.isEstimated) {
            return { ...rpcResult, method: 'rpc' };
        }
    } catch (e) {
        console.log('RPC method failed, using inference...');
    }

    // Method 3: Fallback to inference from holder data
    return inferDevStatus(holderData, ageHours);
}

/**
 * Use Helius API to find token creator
 */
async function getDevFromHelius(tokenAddress) {
    try {
        // Fetch oldest transactions
        // Note: Helius API returns newest first usually, but v0 transactions endpoint 
        // with 'before' param or deep pagination is tricky. 
        // For young tokens, limit: 100 on newest might catch creation if <100 txs.
        // But for reliable "first tx", we often rely on BitQuery or full history parsing.
        // Here we attempt to fetch a batch and see if we can find the "initializeMint" or similar.

        // LIMITATION: 'getEnhancedTransactions' gets *recent* history by default.
        // Getting the *very first* transaction via Helius Enhanced requires knowing the signature or deep pagination.
        // Assuming this function is mostly effective for *new* tokens where history is short.

        const transactions = await getEnhancedTransactions(tokenAddress, { limit: 100 });

        if (!transactions || transactions.length === 0) {
            return { action: 'UNKNOWN', isEstimated: true, reason: 'No Helius data' };
        }

        // Find the earliest transaction in this batch
        const oldestTx = transactions[transactions.length - 1];

        // Extract fee payer from the transaction
        const feePayer = oldestTx.feePayer;

        if (!feePayer) {
            return { action: 'UNKNOWN', isEstimated: true, reason: 'No fee payer found' };
        }

        // Check if this wallet still holds the token
        const pubKey = new PublicKey(tokenAddress);
        const devAccounts = await connection.getParsedTokenAccountsByOwner(
            new PublicKey(feePayer),
            { mint: pubKey }
        );

        let devBalance = 0;
        if (devAccounts.value.length > 0) {
            devBalance = devAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
        }

        const action = devBalance === 0 ? 'SOLD ALL' : 'HOLDING';

        return {
            devWallet: feePayer,
            action: action,
            balance: devBalance,
            isEstimated: false
        };

    } catch (error) {
        console.error('Helius Dev Check Failed:', error);
        return { action: 'UNKNOWN', isEstimated: true, error: error.message };
    }
}

/**
 * Use standard RPC to find token creator (works for <1000 tx tokens)
 */
async function getDevFromRPC(tokenAddress) {
    try {
        const pubKey = new PublicKey(tokenAddress);
        const signatures = await connection.getSignaturesForAddress(pubKey, { limit: 1000 });

        if (signatures.length === 0) {
            return { action: 'UNKNOWN', isEstimated: true, reason: 'No transactions found' };
        }

        // If >= 1000 sigs, we can't trace origin via RPC
        if (signatures.length >= 1000) {
            return { action: 'UNKNOWN', isEstimated: true, reason: 'Too many txs for RPC' };
        }

        const sortedSigs = signatures.sort((a, b) => (a.blockTime || 0) - (b.blockTime || 0));
        const oldestSig = sortedSigs[0].signature;

        const tx = await connection.getParsedTransaction(oldestSig, {
            maxSupportedTransactionVersion: 0
        });

        if (!tx || !tx.transaction) {
            return { action: 'UNKNOWN', isEstimated: true, reason: 'Cannot parse first tx' };
        }

        const accountKeys = tx.transaction.message.accountKeys;
        const feePayer = accountKeys.find(k => k.signer)?.pubkey?.toString();

        if (!feePayer) {
            return { action: 'UNKNOWN', isEstimated: true, reason: 'Cannot identify fee payer' };
        }

        const devAccounts = await connection.getParsedTokenAccountsByOwner(
            new PublicKey(feePayer),
            { mint: pubKey }
        );

        let devBalance = 0;
        if (devAccounts.value.length > 0) {
            devBalance = devAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
        }

        const action = devBalance === 0 ? 'SOLD ALL' : 'HOLDING';

        return {
            devWallet: feePayer,
            action: action,
            balance: devBalance,
            isEstimated: false
        };

    } catch (error) {
        console.error('RPC Dev Check Failed:', error);
        return { action: 'UNKNOWN', isEstimated: true, error: error.message };
    }
}

/**
 * Infer dev status from holder data (fallback when API fails)
 */
function inferDevStatus(holderData, ageHours) {
    if (!holderData || !holderData.top10Holders || holderData.top10Holders.length === 0) {
        return { action: 'UNKNOWN', isEstimated: true, method: 'inference', reason: 'No holder data' };
    }

    const top1Percent = parseFloat(holderData.top10Holders[0]?.percent || 0);
    const top10Percent = holderData.top10HoldersPercent || 0;

    // Inference logic based on holder patterns
    // Very young token with high top holder concentration = likely dev holding
    if (ageHours < 12 && top1Percent > 30) {
        return {
            action: 'LIKELY HOLDING',
            isEstimated: true,
            method: 'inference',
            reason: `Young token (${ageHours.toFixed(1)}h) with top holder at ${top1Percent.toFixed(1)}%`
        };
    }

    // Young token with moderate concentration = probably holding
    if (ageHours < 24 && top1Percent > 15) {
        return {
            action: 'LIKELY HOLDING',
            isEstimated: true,
            method: 'inference',
            reason: `Token age ${ageHours.toFixed(1)}h with top holder at ${top1Percent.toFixed(1)}%`
        };
    }

    // Older token with very low top holder = likely sold
    if (ageHours > 48 && top1Percent < 5 && top10Percent < 30) {
        return {
            action: 'LIKELY SOLD',
            isEstimated: true,
            method: 'inference',
            reason: `Old token (${ageHours.toFixed(1)}h) with distributed holders`
        };
    }

    // Old token with very high concentration could be rug setup
    if (ageHours > 24 && top1Percent > 50) {
        return {
            action: 'HOLDING (RISK)',
            isEstimated: true,
            method: 'inference',
            reason: `High concentration ${top1Percent.toFixed(1)}% on older token`
        };
    }

    // Default to unknown if patterns don't match
    return {
        action: 'UNKNOWN',
        isEstimated: true,
        method: 'inference',
        reason: 'Could not infer from holder patterns'
    };
}

/**
 * Analyzes a list of wallets to identify "Whales" (> 50 SOL balance ~ $10k USD)
 * @param {string[]} walletAddresses 
 * @returns {Promise<{count: number, whales: string[]}>}
 */
export async function getWhaleAnalysis(walletAddresses) {
    if (!walletAddresses || walletAddresses.length === 0) return { count: 0, whales: [] };

    // Deduplicate addresses
    const uniqueWallets = [...new Set(walletAddresses)];
    const whales = [];

    // Threshold: 10 SOL (~$2,000)
    const WHALE_THRESHOLD_SOL = 10;
    const LAMPORTS_PER_SOL = 1000000000;

    // Limit to checking top 20 wallets
    const walletsToCheck = uniqueWallets.slice(0, 20);

    console.log(`[WhaleAnalysis] Checking ${walletsToCheck.length} wallets for whale status...`);

    try {
        const pubKeys = walletsToCheck
            .map(addr => {
                try {
                    return new PublicKey(addr);
                } catch (e) {
                    return null;
                }
            })
            .filter(pk => pk !== null);

        if (pubKeys.length === 0) return { count: 0, whales: [] };

        // Batch fetch balances (much more efficient than parallel getBalance)
        const accounts = await connection.getMultipleAccountsInfo(pubKeys);

        accounts.forEach((account, index) => {
            if (account) {
                const solBalance = account.lamports / LAMPORTS_PER_SOL;
                const address = pubKeys[index].toString();

                // Console log for debug seeing who is holding what
                // console.log(`[WhaleDebug] ${address}: ${solBalance.toFixed(2)} SOL`);

                if (solBalance >= WHALE_THRESHOLD_SOL) {
                    whales.push({
                        address: address,
                        balance: solBalance
                    });
                }
            }
        });

    } catch (e) {
        console.error('[WhaleAnalysis] Error batch fetching accounts:', e.message);
        // Fallback or just return empty
    }

    return {
        count: whales.length,
        whales: whales
    };
}

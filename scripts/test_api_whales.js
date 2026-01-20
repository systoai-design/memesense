const { getWhaleAnalysis } = require('../lib/solana');

// Mock data to simulate API logic
async function testWhaleApiLogic(walletList) {
    console.log(`Testing Whale API Logic with ${walletList.length} wallets...`);
    const whaleAnalysis = await getWhaleAnalysis(walletList);

    const response = {
        mechanics: {
            whales: {
                count: whaleAnalysis.count || 0,
                wallets: whaleAnalysis.whales || [],
                hasWhales: (whaleAnalysis.count || 0) > 0
            }
        }
    };

    console.log('--- API RESPONSE PREVIEW ---');
    console.log(JSON.stringify(response.mechanics.whales, null, 2));
}

// Known whale wallet (Binance Hot Wallet for test) + randoms
// CP3... is a known large holder on some tokens, or just use a known whale
const testWallets = [
    '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1', // Raydium Authority (High Balance)
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pKdZ2a', // Bonk Mint
    '9AhKqLR67hkapbfP39FKfCiVdts79aM8n7C83Y25Z3s6',
    '3u2dn889XQCaEAAX9qH392x7dCjY6rUu4NnJq9G3pump'
];

testWhaleApiLogic(testWallets);

import { config } from 'dotenv';
config({ path: '.env.local' });
// ...

// Mock Helius imports if it uses ES modules and I'm running in CommonJS context?
// Next.js uses ES modules for server files usually, but Node script might fail.
// I will try to use dynamic import() or just assume standard require works if transpiled?
// Actually the project is using `import/export`. Node.js might fail with `require` on .js files with `export`.
// I should use `import()` in a generated `.mjs` file or just read the file content and simulate?
// Better: Create `scripts/debug_app_logic.mjs`

async function main() {
    const WALLET = 'E1ED87qzdUPfK2zTLgYGatEnuo1pLHfukTLUjxxG7j7y';
    console.log(`Analyzing ${WALLET}...`);

    try {
        // Dynamic import of the library
        // Note: This relies on correct path resolution
        const helius = await import('../lib/helius.js');

        const trades = await helius.getWalletHistory(WALLET, 50); // Limit 50 txs
        console.log(`Parsed ${trades.length} trades.`);

        // Filter for Dale/CZSE
        const daleTrades = trades.filter(t => t.mint === 'CZSE6FyovrMTANcyuRVxCJDKtr6V9yHvAypyJWY7pump');
        console.log(`Found ${daleTrades.length} Dale trades.`);

        daleTrades.forEach((t, i) => {
            console.log(`\nDale Trade ${i}:`);
            console.log(`  Type: ${t.type}`);
            console.log(`  Token Amt: ${t.tokenAmount}`);
            console.log(`  SOL Amt: ${t.solAmount}`);
            console.log(`  Price Implied: ${t.solAmount / t.tokenAmount} SOL`);
        });

        // Also check for any 'huge' amounts in general
        const outliers = trades.filter(t => t.tokenAmount > 1000000000); // > 1 Billion
        if (outliers.length > 0) {
            console.log(`\nFound ${outliers.length} HUGE outlier trades:`);
            outliers.forEach(t => console.log(`  ${t.mint}: ${t.tokenAmount}`));
        }

    } catch (e) {
        console.error('Execution failed:', e);
    }
}

main();

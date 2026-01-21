
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Dynamic import to ensure env is loaded first
const { getTotalHolderCount, getRealHolderData } = await import('./lib/solana.js');

const CA = 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzTFbKnV67foE9';

async function run() {
    console.log(`Testing Holder Count for ${CA}...`);
    try {
        const start = Date.now();
        console.log("Calling getTotalHolderCount...");
        const count = await getTotalHolderCount(CA);
        console.log('Result:', count);
        console.log(`Duration: ${(Date.now() - start) / 1000}s`);

    } catch (e) {
        console.error('Script Error:', e);
    }
    process.exit(0);
}

run();

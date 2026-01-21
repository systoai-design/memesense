
import dotenv from 'dotenv';
import { getTokenAuthorities } from './lib/solana.js';

dotenv.config({ path: '.env.local' });

const CA = 'ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY'; // MOODENG

async function run() {
    console.log(`Testing getTokenAuthorities for ${CA}...`);
    try {
        const start = Date.now();
        const result = await getTokenAuthorities(CA);
        const duration = (Date.now() - start) / 1000;

        console.log('Result:', JSON.stringify(result, null, 2));
        console.log(`Duration: ${duration}s`);
    } catch (e) {
        console.error('Error:', e);
    }
    process.exit(0);
}

run();

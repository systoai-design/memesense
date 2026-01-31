import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getBatchTokenMetadata } from '../lib/helius.js';

const BAD_TOKENS = [
    '8YWZkrj6p3HC4rbtWMc5No8A523mDcmcKxGhWmSfbCVa', // Wallet
    '7GCihgDB8fe6KNjn2MYtkzZcRXTQy3DbSnAPX68DwPMr'  // Token
];

async function testMetadata() {
    console.log("Fetching Metadata in Batch...");

    // Test a known token that might have had issues
    // Let's use the ones from the report or generic ones
    const TOKENS = [
        'So11111111111111111111111111111111111111112', // WSOL
        '7ZMcy7PLduheLVkSupbG5UGmhyDt6UR5vMUYG2uJpump' // The open position from investigation
    ];

    const metadata = await getBatchTokenMetadata(TOKENS);
    console.log(JSON.stringify(metadata, null, 2));

    let passed = true;
    for (const [mint, meta] of Object.entries(metadata)) {
        if (meta.image && meta.image.endsWith('.json')) {
            console.error(`❌ FAILED: ${mint} has JSON image: ${meta.image}`);
            passed = false;
        } else {
            console.log(`✅ ${mint} image: ${meta.image}`);
        }
    }

    if (passed) console.log("ALL TESTS PASSED");
}

testMetadata();

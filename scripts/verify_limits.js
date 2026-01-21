const { initDatabase, getOrCreateUser, canUseAnalysis, recordUsage, TIERS } = require('../lib/db');
const { v4: uuidv4 } = require('uuid');

function testLimits() {
    console.log('--- Testing Account Restrictions ---');
    console.log('Current FREE Tier Config:', TIERS.FREE);

    // 1. Create a dummy user
    const deviceId = uuidv4();
    const user = getOrCreateUser({ deviceId });
    console.log(`Created test user: ${user.id} (Tier: ${user.tier})`);

    // 2. Check initial access
    let check = canUseAnalysis(user.id);
    console.log('Initial check:', check.allowed ? 'ALLOWED' : 'BLOCKED', `(Remaining: ${check.remainingToday})`);

    // 3. Simulate usage
    const limitToTest = TIERS.FREE.dailyLimit === -1 ? 10 : TIERS.FREE.dailyLimit;
    console.log(`Simulating ${limitToTest} scans...`);

    for (let i = 0; i < limitToTest; i++) {
        recordUsage(user.id, `token_${i}`);
    }

    // 4. Check after usage
    check = canUseAnalysis(user.id);
    console.log(`Check after ${limitToTest} scans:`, check.allowed ? 'ALLOWED' : 'BLOCKED', `(Remaining: ${check.remainingToday})`);

    // 5. Simulate one more
    if (check.allowed && TIERS.FREE.dailyLimit !== -1) {
        recordUsage(user.id, 'token_overflow');
        check = canUseAnalysis(user.id);
        console.log('Check after +1 scan:', check.allowed ? 'ALLOWED' : 'BLOCKED', `(Remaining: ${check.remainingToday})`);
    } else if (TIERS.FREE.dailyLimit === -1) {
        console.log('Limit is UNLIMITED, so user is still allowed.');
    }
}

testLimits();

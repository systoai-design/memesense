
import fetch from 'node-fetch';

async function testAnalyze() {
    console.log('Testing /api/analyze...');
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const res = await fetch('http://localhost:3000/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ca: 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzTFbKnV67foE9',
                deviceId: 'debug_test'
            }),
            signal: controller.signal
        });

        clearTimeout(timeout);
        const data = await res.json();
        console.log('Status:', res.status);
        console.log('Success:', data.success);
        if (!data.success) console.log('Error:', data.error);

    } catch (e) {
        console.error('Fetch failed:', e.message);
    }
}

testAnalyze();

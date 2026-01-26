
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'netlify.toml');

try {
    if (!fs.existsSync(filePath)) {
        console.log('File not found');
        process.exit(1);
    }

    const content = fs.readFileSync(filePath);
    console.log('--- raw content start ---');
    console.log(content.toString('utf8'));
    console.log('--- raw content end ---');

    console.log('--- byte inspection ---');
    for (let i = 0; i < content.length; i++) {
        const byte = content[i];
        if (byte === 13) {
            console.log(`FOUND CR (\\r) at index ${i}`);
        }
        if (byte < 32 && byte !== 10 && byte !== 13) {
            console.log(`Hidden char at index ${i}: ${byte} (0x${byte.toString(16)})`);
        }
    }
    console.log('Inspection complete.');

    // Check for "trailing comma" mentioned by User Diagnosis
    const text = content.toString('utf8');
    if (text.includes('command = "npm run build",')) {
        console.log('FOUND TRAILING COMMA!');
    }

} catch (e) {
    console.error(e);
}


const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'netlify.toml');

try {
    if (!fs.existsSync(filePath)) {
        console.log('File not found');
        process.exit(1);
    }

    const content = fs.readFileSync(filePath);
    console.log(`File size: ${content.length} bytes`);

    // Check BOM
    if (content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
        console.log('🔴 FOUND UTF-8 BOM!');
    } else {
        console.log('✅ No BOM detected.');
    }

    let foundNonAscii = false;
    for (let i = 0; i < content.length; i++) {
        const byte = content[i];
        if (byte > 127) {
            console.log(`Hidden char at index ${i}: ${byte} (0x${byte.toString(16)})`);
            foundNonAscii = true;
        }
    }

    if (!foundNonAscii) console.log('✅ All characters are ASCII.');

} catch (e) {
    console.error(e);
}

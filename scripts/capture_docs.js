// Safely require puppeteer (it's a devDependency, not present in Prod)
let puppeteer;
try {
    puppeteer = require('puppeteer');
} catch (e) {
    console.log('Puppeteer not found (safely ignored for production build)');
}
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const CA = '3ppvBuw4QwjaBsBZFj8XDAQCVAWqgXy8cWccE5TQpump';
const WALLET = 'BtevQT53ypC5Nz6yRwGm3GV4RYmQMjNJsLEP5Y3XspuR';

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

(async () => {
    console.log('Launching browser...');
    // Launch args for typical CI/Cloud envs just in case, though locall runs fine usually
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1440, height: 1000 }
    });

    const page = await browser.newPage();

    // Helper to accept cookie banners or modals if any (none known)

    try {
        // --- 1. DASHBOARD OVERVIEW ---
        console.log(`Navigating to Analysis: ${CA}`);
        await page.goto(`${BASE_URL}/analyze/${CA}`, { waitUntil: 'networkidle0', timeout: 60000 });

        // Wait specific loaders to disappear
        // The app has a loading spinner. We wait for the main container to not have 'loading'
        // Actually best to wait for a known element "Market Cap" or similar
        try {
            await page.waitForSelector('h1', { timeout: 10000 }); // Token Name
            await new Promise(r => setTimeout(r, 4000)); // Extra buffer for charts/AI text
        } catch (e) {
            console.log('Timeout waiting for h1, proceeding anyway...');
        }

        await page.screenshot({ path: path.join(OUTPUT_DIR, 'dashboard-overview.png') });
        console.log('Saved dashboard-overview.png');


        // Debug: Log page title and text
        const title = await page.title();
        console.log(`Page Title: ${title}`);

        // --- 2. BONDING CURVE ---
        try {
            // Find all h2s and check text content
            const headings = await page.$$('h2');
            let bondingSection = null;

            for (const h of headings) {
                const text = await page.evaluate(el => el.textContent, h);
                if (text.includes('Bonding Curve')) {
                    // Get parent section
                    bondingSection = await page.evaluateHandle(el => el.closest('section'), h);
                    break;
                }
            }

            if (bondingSection) {
                await bondingSection.screenshot({ path: path.join(OUTPUT_DIR, 'bonding-curve.png') });
                console.log('Saved bonding-curve.png');
            } else {
                console.log('Bonding Curve H2 not found');
            }
        } catch (e) {
            console.error('Error capturing bonding curve:', e.message);
        }


        // --- 3. PROFIT TRACKER ---
        console.log(`Navigating to Profit Tracker: ${WALLET}`);
        await page.goto(`${BASE_URL}/profit/${WALLET}`, { waitUntil: 'networkidle0', timeout: 60000 });

        // Wait for table rows or win rate
        await new Promise(r => setTimeout(r, 3000));

        await page.screenshot({ path: path.join(OUTPUT_DIR, 'profit-tracker.png') });
        console.log('Saved profit-tracker.png');

    } catch (error) {
        console.error('Workflow failed:', error);
    } finally {
        await browser.close();
    }
})();

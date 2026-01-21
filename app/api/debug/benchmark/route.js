
import { NextResponse } from 'next/server';
import { getSniperData, getRealHolderData, getUniqueBuyers, getTokenAuthorities, getTotalHolderCount } from '@/lib/solana';
import { getTokenData } from '@/lib/dexscreener';
import fs from 'fs';
import path from 'path';

export async function GET() {
    const CA = '7GCihgDB8fe6KNjn2MYtkzZcRXTQy3DbSnAPX68DwPMr';
    const logPath = path.join(process.cwd(), 'benchmark_progress.txt');

    // Clear log
    fs.writeFileSync(logPath, `Starting Benchmark for ${CA}\n`);

    const log = (msg) => {
        fs.appendFileSync(logPath, `${msg}\n`);
    };

    const results = {};
    const time = async (label, fn) => {
        const start = Date.now();
        log(`Create Promise: ${label}...`);
        try {
            log(`awaiting ${label}...`);
            await fn();
            const duration = (Date.now() - start) / 1000;
            results[label] = `${duration}s`;
            log(`FINISHED ${label}: ${duration}s`);
        } catch (e) {
            results[label] = `FAILED: ${e.message}`;
            log(`FAILED ${label}: ${e.message}`);
        }
    };

    // Run sequentially to isolate the hang
    await time('getTokenData', () => getTokenData(CA));
    await time('getRealHolderData', () => getRealHolderData(CA));
    await time('getTokenAuthorities', () => getTokenAuthorities(CA));
    await time('getUniqueBuyers', () => getUniqueBuyers(CA));
    await time('getSniperData', () => getSniperData(CA));
    await time('getTotalHolderCount', () => getTotalHolderCount(CA));

    return NextResponse.json(results);
}

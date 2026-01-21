import { NextResponse } from 'next/server';
import { initDatabase, getOrCreateUser } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const body = await request.json();
        const { deviceId, walletAddress } = body;

        if (!deviceId && !walletAddress) {
            return NextResponse.json({ success: false, error: 'Missing deviceId or walletAddress' }, { status: 400 });
        }

        const db = initDatabase();

        // Find user
        let user = getOrCreateUser({ deviceId, walletAddress });

        if (!user) {
            return NextResponse.json({ success: false, error: 'Could not find or create user' }, { status: 500 });
        }

        // Check if already used trial or is premium
        if (user.tier === 'PREMIUM') {
            return NextResponse.json({ success: false, error: 'Already Premium' }, { status: 400 });
        }

        if (user.trial_start) {
            return NextResponse.json({ success: false, error: 'Trial already activated previously' }, { status: 400 });
        }

        const now = new Date().toISOString();

        // ACTIVATION: Update tier to TRIAL and set trial_start
        const stmt = db.prepare("UPDATE users SET tier = 'TRIAL', trial_start = ? WHERE id = ?");
        stmt.run(now, user.id);

        return NextResponse.json({ success: true, message: 'Trial activated', trialStart: now });

    } catch (error) {
        console.error('Trial activation error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}

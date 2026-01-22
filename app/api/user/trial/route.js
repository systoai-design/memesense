import { NextResponse } from 'next/server';
import { activateTrial, getOrCreateUser } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const body = await request.json();
        const { deviceId, walletAddress } = body;

        if (!deviceId && !walletAddress) {
            return NextResponse.json({ success: false, error: 'Missing deviceId or walletAddress' }, { status: 400 });
        }

        // Find user (Await is important!)
        let user = await getOrCreateUser({ deviceId, walletAddress });

        if (!user) {
            return NextResponse.json({ success: false, error: 'Could not find or create user' }, { status: 500 });
        }

        // Check if already used trial or is premium
        if (user.tier === 'PREMIUM') {
            return NextResponse.json({ success: false, error: 'Already Premium' }, { status: 400 });
        }

        // Double check trial start in case DB has it
        if (user.trial_start) {
            return NextResponse.json({ success: false, error: 'Trial already activated previously' }, { status: 400 });
        }

        // Activate Trial via DB helper
        const result = await activateTrial(user.id);

        if (result) {
            return NextResponse.json({ success: true, message: 'Trial activated' });
        } else {
            return NextResponse.json({ success: false, error: 'Failed to activate trial' }, { status: 500 });
        }

    } catch (error) {
        console.error('Trial activation error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { verifyPayment } from '../../../../lib/payment';
import { getOrCreateUser, upgradeUser } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const body = await request.json();
        const { signature, walletAddress, deviceId, plan = 'lifetime' } = body;

        console.log(`[Payment] Verifying signature: ${signature} for ${walletAddress} (Plan: ${plan})`);

        if (!signature || !walletAddress) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Verify on-chain logic
        const verification = await verifyPayment(signature, walletAddress, plan);

        if (!verification.success) {
            console.error('[Payment] Verification failed:', verification.error);
            return NextResponse.json({ success: false, error: verification.error }, { status: 400 });
        }

        // 2. Ensure User Exists & Upgrade
        // We use getOrCreateUser to ensure the user record is present
        await getOrCreateUser({ walletAddress, deviceId });

        // 3. Upgrade User
        const success = await upgradeUser(walletAddress, plan);

        if (success) {
            return NextResponse.json({ success: true, message: 'Upgraded successfully' });
        } else {
            return NextResponse.json({ success: false, error: 'Database update failed' }, { status: 500 });
        }

    } catch (error) {
        console.error('[Payment] Server error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}


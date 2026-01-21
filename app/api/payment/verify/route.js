import { NextResponse } from 'next/server';
import { verifyPayment, PREMIUM_PRICE_SOL } from '../../../../lib/payment';
import { addCredits, initDatabase } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const body = await request.json();
        const { signature, walletAddress, deviceId } = body;

        console.log(`[Payment] Verifying signature: ${signature} for ${walletAddress}`);

        if (!signature || !walletAddress) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Verify on-chain logic
        const verification = await verifyPayment(signature, walletAddress);

        if (!verification.success) {
            console.error('[Payment] Verification failed:', verification.error);
            return NextResponse.json({ success: false, error: verification.error }, { status: 400 });
        }

        // 2. Add Credits & Upgrade User
        // We add enough credits to trigger PREMIMUM (1 = 1 analysis? No, db has logic "credits > 0 -> PREMIUM")
        // But for "Lifetime" or "Monthly" we treat it as 1 big credit bump or just force tier.
        // `addCredits` function updates tier to PREMIUM if credits > 0.
        // Let's add 999999 for "Lifetime" / "Paid" logic for now, or just enough.
        // We will assume "Paid" means "Permanent Premium" for this mvp.

        let user = null;
        try {
            // Find user by wallet or device
            const db = initDatabase();
            const existingUser = db.prepare('SELECT * FROM users WHERE wallet_address = ?').get(walletAddress);
            let userId = existingUser?.id;

            if (!userId && deviceId) {
                const deviceUser = db.prepare('SELECT * FROM users WHERE device_id = ?').get(deviceId);
                userId = deviceUser?.id;
            }

            if (userId) {
                // Determine user ID and add credits
                // Record the transaction internally
                addCredits(userId, 1000, { // 1000 credits just as a placeholder for "Paid"
                    signature,
                    amount: PREMIUM_PRICE_SOL,
                    currency: 'SOL'
                });

                // Ensure tier is set to PREMIUM explicitly just in case
                db.prepare("UPDATE users SET tier = 'PREMIUM' WHERE id = ?").run(userId);

                user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
            } else {
                return NextResponse.json({ success: false, error: 'User not found in DB to upgrade.' }, { status: 404 });
            }

        } catch (dbError) {
            console.error('DB Update failed:', dbError);
            return NextResponse.json({ success: false, error: 'Database update failed' }, { status: 500 });
        }

        return NextResponse.json({ success: true, user });

    } catch (error) {
        console.error('[Payment] Server error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}

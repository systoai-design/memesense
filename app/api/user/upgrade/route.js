
import { NextResponse } from 'next/server';
import { verifyPayment } from '@/lib/payment';
import { initDatabase } from '@/lib/db';

export async function POST(req) {
    try {
        const body = await req.json();
        const { walletAddress, signature } = body;

        if (!walletAddress || !signature) {
            return NextResponse.json(
                { success: false, error: 'Missing wallet (sender) or signature' },
                { status: 400 }
            );
        }

        // 1. Verify Payment on-chain
        const verification = await verifyPayment(signature, walletAddress);

        if (!verification.success) {
            return NextResponse.json(
                { success: false, error: verification.error || 'Payment verification failed' },
                { status: 400 }
            );
        }

        // 2. Upgrade User in DB
        const db = initDatabase();

        // Find user by wallet address check
        const user = db.prepare('SELECT * FROM users WHERE wallet_address = ?').get(walletAddress);

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'User account not found via wallet' },
                { status: 404 }
            );
        }

        // Update tier
        const update = db.prepare('UPDATE users SET tier = ? WHERE id = ?').run('PREMIUM', user.id);

        if (update.changes > 0) {
            return NextResponse.json({
                success: true,
                message: 'Account upgraded to Premium',
                tier: 'PREMIUM'
            });
        } else {
            return NextResponse.json(
                { success: false, error: 'Database update failed' },
                { status: 500 }
            );
        }

    } catch (error) {
        console.error('Upgrade API error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

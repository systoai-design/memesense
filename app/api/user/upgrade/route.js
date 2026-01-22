import { NextResponse } from 'next/server';
import { verifyPayment } from '@/lib/payment';
import { upgradeUser } from '@/lib/db';

export async function POST(req) {
    try {
        const body = await req.json();
        const { walletAddress, signature, plan = 'lifetime' } = body; // Default to lifetime if not provided

        if (!walletAddress || !signature) {
            return NextResponse.json(
                { success: false, error: 'Missing wallet (sender) or signature' },
                { status: 400 }
            );
        }

        // 1. Verify Payment on-chain
        const verification = await verifyPayment(signature, walletAddress, plan);

        if (!verification.success) {
            return NextResponse.json(
                { success: false, error: verification.error || 'Payment verification failed' },
                { status: 400 }
            );
        }

        // 2. Upgrade User in DB
        const success = await upgradeUser(walletAddress, plan);

        if (success) {
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

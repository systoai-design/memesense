import { NextResponse } from 'next/server';
import { getOrCreateUser } from '@/lib/db';

export async function POST(request) {
    try {
        const { walletAddress } = await request.json();

        if (!walletAddress) {
            return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
        }

        const user = getOrCreateUser({ walletAddress });

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                walletAddress: user.wallet_address,
                isOnboarded: user.is_onboarded === 1,
                tier: user.tier,
                credits: user.credits
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

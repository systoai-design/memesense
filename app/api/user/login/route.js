import { NextResponse } from 'next/server';
import { getOrCreateUser, canUseAnalysis } from '@/lib/db';

export async function POST(request) {
    try {
        const { walletAddress } = await request.json();

        if (!walletAddress) {
            return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
        }

        const user = await getOrCreateUser({ walletAddress });
        const usage = await canUseAnalysis(user.id);

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                walletAddress: user.wallet_address,
                isOnboarded: user.is_onboarded === 1,
                tier: user.tier,
                credits: user.credits,
                usedToday: usage.usedToday,
                dailyLimit: usage.dailyLimit
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

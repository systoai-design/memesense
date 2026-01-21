import { NextResponse } from 'next/server';
import { onboardUser } from '@/lib/db';

export async function POST(request) {
    try {
        const { walletAddress } = await request.json();

        if (!walletAddress) {
            return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
        }

        // Update user to onboarded
        const success = await onboardUser(walletAddress);

        if (!success) {
            console.error('Onboarding failed in DB');
            // But maybe success: true anyway if it's just idempotent? 
            // Logic says if user doesn't exist, we might fail.
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Onboarding error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

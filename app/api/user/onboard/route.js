import { NextResponse } from 'next/server';
import { initDatabase } from '@/lib/db';

export async function POST(request) {
    try {
        const { walletAddress } = await request.json();

        if (!walletAddress) {
            return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
        }

        const db = initDatabase();

        // Update user to onboarded
        db.prepare('UPDATE users SET is_onboarded = 1 WHERE wallet_address = ?').run(walletAddress);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Onboarding error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

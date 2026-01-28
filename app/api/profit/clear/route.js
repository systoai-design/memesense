import { NextResponse } from 'next/server';
import { clearWalletTrades } from '@/lib/db';

export async function POST(request) {
    try {
        const { walletAddress } = await request.json();

        if (!walletAddress) {
            return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
        }

        console.log(`[ClearTrades] Clearing cached trades for ${walletAddress}`);

        const success = await clearWalletTrades(walletAddress);

        if (success) {
            return NextResponse.json({
                success: true,
                message: 'Cached trades cleared. Re-scan will fetch fresh data.'
            });
        } else {
            return NextResponse.json({
                success: false,
                error: 'Failed to clear trades'
            }, { status: 500 });
        }
    } catch (error) {
        console.error('[ClearTrades] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

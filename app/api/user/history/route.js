import { NextResponse } from 'next/server';
import { getOrCreateUser, getUserScanHistory } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const deviceId = searchParams.get('deviceId');
        const userWallet = searchParams.get('userWallet'); // Optional if connected

        if (!deviceId && !userWallet) {
            return NextResponse.json({ error: 'Device ID or Wallet required' }, { status: 400 });
        }

        // Authenticate / Get User ID
        const user = await getOrCreateUser({ deviceId, walletAddress: userWallet });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Fetch History
        const history = await getUserScanHistory(user.id);

        return NextResponse.json({
            success: true,
            data: history
        });

    } catch (error) {
        console.error('[HistoryAPI] Error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch history'
        }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { getOrCreateUser, setWalletLabel } from '@/lib/db';

export async function POST(req) {
    try {
        const body = await req.json();
        const { deviceId, walletAddress: authWallet, targetWallet, label } = body;

        // Auth
        const user = await getOrCreateUser({ deviceId, walletAddress: authWallet });
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const success = await setWalletLabel(user.id, targetWallet, label);

        return NextResponse.json({ success });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { getOrCreateUser, setWalletLabel } from '@/lib/db';

export async function POST(request) {
    try {
        const body = await request.json();
        const { label, walletToLabel, deviceId, userWallet } = body;

        // 1. Auth Check
        const user = await getOrCreateUser({ deviceId, walletAddress: userWallet });

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!walletToLabel || !label) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 2. Set Label
        const success = await setWalletLabel(user.id, walletToLabel, label.trim());

        if (success) {
            return NextResponse.json({ success: true, label: label.trim() });
        } else {
            return NextResponse.json({ error: 'Failed to save label' }, { status: 500 });
        }

    } catch (e) {
        console.error('Label API Error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

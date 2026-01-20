import { NextResponse } from 'next/server';
import { getRecentScans, getOrCreateUser } from '@/lib/db';

export async function POST(req) {
    try {
        const body = await req.json();
        const { deviceId, walletAddress, limit = 10 } = body;

        const user = getOrCreateUser({ deviceId, walletAddress });

        const scans = getRecentScans(user.id, limit);
        return NextResponse.json({ success: true, scans });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message });
    }
}

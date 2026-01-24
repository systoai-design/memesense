import { NextResponse } from 'next/server';
import { getRecentScans, getOrCreateUser } from '@/lib/db';

export async function POST(req) {
    try {
        const body = await req.json();
        const { deviceId, walletAddress, limit = 10, type = 'token' } = body;

        const user = await getOrCreateUser({ deviceId, walletAddress });

        const scans = await getRecentScans(user.id, limit, type);
        return NextResponse.json({ success: true, scans });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message });
    }
}

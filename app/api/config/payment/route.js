import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    // Return safe public config
    return NextResponse.json({
        adminWallet: process.env.PAYMENT_WALLET_ADDRESS || process.env.ADMIN_WALLET,
        priceSol: parseFloat(process.env.PREMIUM_PRICE_SOL || '0.5'),
    });
}

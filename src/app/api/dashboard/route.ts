import { NextResponse } from 'next/server';
import { getDashboardStats } from '@/lib/services';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stats = await getDashboardStats();
    return NextResponse.json(stats);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getDashboardStats } from '@/lib/services';
import { handleApiError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stats = await getDashboardStats();
    return NextResponse.json(stats);
  } catch (e) {
    return handleApiError(e, 'GET /api/dashboard');
  }
}

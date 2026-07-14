import { NextResponse } from 'next/server';
import { getDbHealth } from '@/lib/db/client';
import { handleApiError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const health = await getDbHealth();
    const status = health.connected ? 200 : health.mode === 'unconfigured' ? 503 : 500;
    return NextResponse.json(health, { status });
  } catch (e) {
    return handleApiError(e, 'GET /api/health');
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { dbAll, dbGet, dbRun, dbBool, rowToMonitorSite } from '@/lib/db';
import { handleApiError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await dbAll('SELECT * FROM monitor_sites ORDER BY name');
    return NextResponse.json(rows.map((r) => rowToMonitorSite(r)));
  } catch (e) {
    return handleApiError(e, 'GET /api/monitors');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await dbRun(
      `INSERT INTO monitor_sites (name, url, source_type, frequency_minutes, enabled, region, memo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        body.name,
        body.url || null,
        body.source_type ?? 'official',
        body.frequency_minutes ?? 60,
        dbBool(body.enabled !== false),
        body.region ?? 'nationwide',
        body.memo ?? '',
      ]
    );
    const row = await dbGet('SELECT * FROM monitor_sites WHERE id = ?', [result.lastInsertRowid]);
    return NextResponse.json(rowToMonitorSite(row!), { status: 201 });
  } catch (e) {
    return handleApiError(e, 'POST /api/monitors');
  }
}

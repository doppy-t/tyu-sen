import { NextRequest, NextResponse } from 'next/server';
import { getDb, rowToMonitorSite } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = getDb().prepare('SELECT * FROM monitor_sites ORDER BY name').all();
    return NextResponse.json(rows.map((r) => rowToMonitorSite(r as Record<string, unknown>)));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = getDb().prepare(`
      INSERT INTO monitor_sites (name, url, source_type, frequency_minutes, enabled, region, memo)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      body.name,
      body.url || null,
      body.source_type ?? 'official',
      body.frequency_minutes ?? 60,
      body.enabled !== false ? 1 : 0,
      body.region ?? 'nationwide',
      body.memo ?? ''
    );
    const row = getDb().prepare('SELECT * FROM monitor_sites WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(rowToMonitorSite(row as Record<string, unknown>), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getDb, rowToMonitorSite } from '@/lib/db';
import { crawlMonitorSite } from '@/lib/crawler';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const row = getDb().prepare('SELECT * FROM monitor_sites WHERE id = ?').get(params.id);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const site = rowToMonitorSite(row as Record<string, unknown>);
    const result = await crawlMonitorSite(site);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

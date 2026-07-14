import { NextRequest, NextResponse } from 'next/server';
import { dbGet, rowToMonitorSite } from '@/lib/db';
import { crawlMonitorSite } from '@/lib/crawler';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const row = await dbGet('SELECT * FROM monitor_sites WHERE id = ?', [params.id]);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const site = rowToMonitorSite(row);
    const result = await crawlMonitorSite(site);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

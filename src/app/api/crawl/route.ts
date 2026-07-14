import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { crawlAllEnabled } from '@/lib/crawler';
import { checkDeadlineNotifications } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  try {
    const result = await crawlAllEnabled();
    checkDeadlineNotifications();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const siteId = url.searchParams.get('site_id');
    const db = getDb();

    let logs;
    if (siteId) {
      logs = db.prepare(`
        SELECT * FROM crawl_logs WHERE monitor_site_id = ? ORDER BY id DESC LIMIT 50
      `).all(siteId);
    } else {
      logs = db.prepare('SELECT * FROM crawl_logs ORDER BY id DESC LIMIT 100').all();
    }

    return NextResponse.json(logs);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { dbAll } from '@/lib/db';
import { crawlAllEnabled } from '@/lib/crawler';
import { checkDeadlineNotifications } from '@/lib/notifications';
import { handleApiError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  try {
    const result = await crawlAllEnabled();
    await checkDeadlineNotifications();
    return NextResponse.json(result);
  } catch (e) {
    return handleApiError(e, 'POST /api/crawl');
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const siteId = url.searchParams.get('site_id');

    const logs = siteId
      ? await dbAll('SELECT * FROM crawl_logs WHERE monitor_site_id = ? ORDER BY id DESC LIMIT 50', [siteId])
      : await dbAll('SELECT * FROM crawl_logs ORDER BY id DESC LIMIT 100');

    return NextResponse.json(logs);
  } catch (e) {
    return handleApiError(e, 'GET /api/crawl');
  }
}

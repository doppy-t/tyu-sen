import { NextRequest, NextResponse } from 'next/server';
import { parseUrlForManualEntry } from '@/lib/crawler';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.url) return NextResponse.json({ error: 'URL is required' }, { status: 400 });

    const parsed = await parseUrlForManualEntry(body.url, body.store_name, body.source_type);
    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

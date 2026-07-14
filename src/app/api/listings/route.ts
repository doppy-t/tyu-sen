import { NextRequest, NextResponse } from 'next/server';
import { getDb, rowToListing } from '@/lib/db';
import { getListings, type ListingFilters } from '@/lib/services';
import { findSimilarListings } from '@/lib/deduplicator';
import type { ListingStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const filters: ListingFilters = {};

    if (sp.get('unconfirmed_only') === 'true') filters.unconfirmed_only = true;
    if (sp.get('applicable_only') === 'true') filters.applicable_only = true;
    if (sp.get('applied_only') === 'true') filters.applied_only = true;
    if (sp.get('deadline_24h') === 'true') filters.deadline_24h = true;
    if (sp.get('deadline_3d') === 'true') filters.deadline_3d = true;
    if (sp.get('region')) filters.region = sp.get('region')!;
    if (sp.get('channel')) filters.channel = sp.get('channel')!;
    if (sp.get('source_type')) filters.source_type = sp.get('source_type')!;
    if (sp.get('store')) filters.store = sp.get('store')!;
    if (sp.get('product')) filters.product = sp.get('product')!;
    if (sp.get('include_low_confidence') === 'true') filters.include_low_confidence = true;
    if (sp.get('include_excluded') === 'true') filters.include_excluded = true;
    if (sp.get('min_confidence')) filters.min_confidence = parseInt(sp.get('min_confidence')!, 10);
    if (sp.get('similar_group_id')) filters.similar_group_id = sp.get('similar_group_id')!;
    if (sp.get('status')) filters.status = sp.get('status') as ListingStatus;

    const rows = getListings(filters);
    const listings = rows.map((r) => rowToListing(r as Record<string, unknown>));
    return NextResponse.json(listings);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getDb();
    const now = new Date().toISOString();

    const result = db.prepare(`
      INSERT INTO listings (
        store_name, product_name, title, application_start, application_deadline,
        lottery_result_date, purchase_period, conditions, region, channel, source_url,
        source_type, confidence, excerpt, status, is_manual, is_excluded
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      body.store_name ?? '手動登録',
      body.product_name ?? '不明',
      body.title ?? '不明',
      body.application_start ?? null,
      body.application_deadline ?? null,
      body.lottery_result_date ?? null,
      body.purchase_period ?? '不明',
      body.conditions ?? '不明',
      body.region ?? 'nationwide',
      body.channel ?? 'unknown',
      body.source_url ?? '',
      body.source_type ?? 'other',
      body.confidence ?? 50,
      body.excerpt ?? '',
      body.status ?? 'unconfirmed',
      body.is_excluded ? 1 : 0
    );

    return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

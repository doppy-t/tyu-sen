import { NextRequest, NextResponse } from 'next/server';
import { getDb, rowToListing } from '@/lib/db';
import { findSimilarListings } from '@/lib/deduplicator';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM listings WHERE id = ?').get(params.id);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const listing = rowToListing(row as Record<string, unknown>);
    const all = db.prepare('SELECT * FROM listings').all().map((r) => rowToListing(r as Record<string, unknown>));
    const similar = findSimilarListings(listing, all);

    return NextResponse.json({ listing, similar });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const db = getDb();
    const allowed = [
      'status', 'product_name', 'title', 'application_start', 'application_deadline',
      'lottery_result_date', 'purchase_period', 'conditions', 'region', 'channel',
      'store_name', 'excerpt', 'confidence', 'is_excluded',
    ];

    const sets: string[] = [];
    const values: unknown[] = [];
    for (const key of allowed) {
      if (key in body) {
        sets.push(`${key} = ?`);
        values.push(body[key]);
      }
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    sets.push("updated_at = datetime('now')");
    values.push(params.id);

    db.prepare(`UPDATE listings SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    const row = db.prepare('SELECT * FROM listings WHERE id = ?').get(params.id);
    return NextResponse.json(rowToListing(row as Record<string, unknown>));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    getDb().prepare('DELETE FROM listings WHERE id = ?').run(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

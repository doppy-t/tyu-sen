import { NextRequest, NextResponse } from 'next/server';
import { dbAll, dbGet, dbRun, rowToListing } from '@/lib/db';
import { findSimilarListings } from '@/lib/deduplicator';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const row = await dbGet('SELECT * FROM listings WHERE id = ?', [params.id]);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const listing = rowToListing(row);
    const all = (await dbAll('SELECT * FROM listings')).map((r) => rowToListing(r));
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

    await dbRun(`UPDATE listings SET ${sets.join(', ')} WHERE id = ?`, values);
    const row = await dbGet('SELECT * FROM listings WHERE id = ?', [params.id]);
    return NextResponse.json(rowToListing(row!));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbRun('DELETE FROM listings WHERE id = ?', [params.id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

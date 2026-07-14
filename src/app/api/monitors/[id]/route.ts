import { NextRequest, NextResponse } from 'next/server';
import { getDb, rowToMonitorSite } from '@/lib/db';
import { crawlMonitorSite } from '@/lib/crawler';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const row = getDb().prepare('SELECT * FROM monitor_sites WHERE id = ?').get(params.id);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(rowToMonitorSite(row as Record<string, unknown>));
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
    const allowed = ['name', 'url', 'source_type', 'frequency_minutes', 'enabled', 'region', 'memo'];
    const sets: string[] = [];
    const values: unknown[] = [];

    for (const key of allowed) {
      if (key in body) {
        sets.push(`${key} = ?`);
        values.push(key === 'enabled' ? (body[key] ? 1 : 0) : body[key]);
      }
    }

    if (sets.length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 });
    sets.push("updated_at = datetime('now')");
    values.push(params.id);

    db.prepare(`UPDATE monitor_sites SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    const row = db.prepare('SELECT * FROM monitor_sites WHERE id = ?').get(params.id);
    return NextResponse.json(rowToMonitorSite(row as Record<string, unknown>));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    getDb().prepare('DELETE FROM monitor_sites WHERE id = ?').run(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

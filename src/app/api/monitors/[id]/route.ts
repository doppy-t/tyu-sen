import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbRun, rowToMonitorSite } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const row = await dbGet('SELECT * FROM monitor_sites WHERE id = ?', [params.id]);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(rowToMonitorSite(row));
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

    await dbRun(`UPDATE monitor_sites SET ${sets.join(', ')} WHERE id = ?`, values);
    const row = await dbGet('SELECT * FROM monitor_sites WHERE id = ?', [params.id]);
    return NextResponse.json(rowToMonitorSite(row!));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbRun('DELETE FROM monitor_sites WHERE id = ?', [params.id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

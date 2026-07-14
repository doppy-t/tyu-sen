import { NextRequest, NextResponse } from 'next/server';
import { dbAll, dbRun, getSettings, isPostgresMode, saveSettings } from '@/lib/db';
import type { AppSettings } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getSettings();
    const excludeKeywords = await dbAll('SELECT * FROM exclude_keywords ORDER BY keyword');
    return NextResponse.json({ settings, excludeKeywords });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.settings) {
      await saveSettings(body.settings as AppSettings);
    }
    if (body.excludeKeywords) {
      for (const kw of body.excludeKeywords as { id?: number; keyword: string; enabled: boolean }[]) {
        if (kw.id) {
          await dbRun('UPDATE exclude_keywords SET keyword = ?, enabled = ? WHERE id = ?',
            [kw.keyword, kw.enabled ? 1 : 0, kw.id]);
        } else if (isPostgresMode()) {
          await dbRun(
            'INSERT INTO exclude_keywords (keyword, enabled) VALUES (?, ?) ON CONFLICT (keyword) DO NOTHING',
            [kw.keyword, kw.enabled]
          );
        } else {
          await dbRun('INSERT OR IGNORE INTO exclude_keywords (keyword, enabled) VALUES (?, ?)',
            [kw.keyword, kw.enabled ? 1 : 0]);
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

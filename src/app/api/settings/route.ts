import { NextRequest, NextResponse } from 'next/server';
import { getSettings, saveSettings, getDb } from '@/lib/db';
import type { AppSettings } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = getSettings();
    const excludeKeywords = getDb().prepare('SELECT * FROM exclude_keywords ORDER BY keyword').all();
    return NextResponse.json({ settings, excludeKeywords });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.settings) {
      saveSettings(body.settings as AppSettings);
    }
    if (body.excludeKeywords) {
      const db = getDb();
      for (const kw of body.excludeKeywords as { id?: number; keyword: string; enabled: boolean }[]) {
        if (kw.id) {
          db.prepare('UPDATE exclude_keywords SET keyword = ?, enabled = ? WHERE id = ?')
            .run(kw.keyword, kw.enabled ? 1 : 0, kw.id);
        } else {
          db.prepare('INSERT OR IGNORE INTO exclude_keywords (keyword, enabled) VALUES (?, ?)')
            .run(kw.keyword, kw.enabled ? 1 : 0);
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

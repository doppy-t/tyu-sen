import { NextResponse } from 'next/server';
import { DbConfigError, DbConnectionError } from '@/lib/db/errors';

const DB_SETUP_HINT =
  'Vercel Dashboard → Project → Settings → Environment Variables で DATABASE_URL、POSTGRES_URL、または STORAGE_URL のいずれかを設定し、再デプロイしてください。Neon連携時は STORAGE_URL または DATABASE_URL が自動設定されます。';

export function handleApiError(e: unknown, context: string): NextResponse {
  const err = e instanceof Error ? e : new Error(String(e));

  console.error(`[API] ${context} failed:`, err.message);
  if (err.stack) {
    console.error(err.stack);
  }
  if (err instanceof DbConnectionError && err.cause) {
    console.error('[API] DB connection cause:', err.cause);
  }

  if (err instanceof DbConfigError) {
    return NextResponse.json(
      {
        error: err.message,
        code: err.code,
        hint: DB_SETUP_HINT,
      },
      { status: err.status }
    );
  }

  if (err instanceof DbConnectionError) {
    return NextResponse.json(
      {
        error: err.message,
        code: err.code,
        hint: '接続文字列・SSL設定・データベースの稼働状態を確認してください。',
      },
      { status: err.status }
    );
  }

  return NextResponse.json(
    {
      error: err.message,
      code: 'INTERNAL_ERROR',
    },
    { status: 500 }
  );
}

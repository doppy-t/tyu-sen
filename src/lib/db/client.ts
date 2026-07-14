import type Database from 'better-sqlite3';

let sqliteDb: Database.Database | null = null;
let pgSql: import('postgres').Sql | null = null;
let initialized = false;
let postgresMode = false;

const POSTGRES_SCHEMA = `
CREATE TABLE IF NOT EXISTS monitor_sites (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT,
  source_type TEXT NOT NULL DEFAULT 'official',
  frequency_minutes INTEGER NOT NULL DEFAULT 60,
  enabled BOOLEAN NOT NULL DEFAULT true,
  region TEXT NOT NULL DEFAULT 'nationwide',
  memo TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS listings (
  id SERIAL PRIMARY KEY,
  monitor_site_id INTEGER REFERENCES monitor_sites(id) ON DELETE SET NULL,
  store_name TEXT NOT NULL,
  product_name TEXT NOT NULL DEFAULT '不明',
  title TEXT NOT NULL,
  application_start TEXT,
  application_deadline TEXT,
  lottery_result_date TEXT,
  purchase_period TEXT,
  conditions TEXT,
  region TEXT NOT NULL DEFAULT 'nationwide',
  channel TEXT NOT NULL DEFAULT 'unknown',
  source_url TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_type TEXT NOT NULL DEFAULT 'other',
  confidence INTEGER NOT NULL DEFAULT 0,
  excerpt TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unconfirmed',
  is_excluded BOOLEAN NOT NULL DEFAULT false,
  similar_group_id TEXT,
  has_similar BOOLEAN NOT NULL DEFAULT false,
  is_manual BOOLEAN NOT NULL DEFAULT false,
  is_sample BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS crawl_logs (
  id SERIAL PRIMARY KEY,
  monitor_site_id INTEGER REFERENCES monitor_sites(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  url TEXT NOT NULL,
  http_status INTEGER,
  detected_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  last_success_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  "read" BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS exclude_keywords (
  id SERIAL PRIMARY KEY,
  keyword TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_deadline ON listings(application_deadline);
CREATE INDEX IF NOT EXISTS idx_listings_detected ON listings(detected_at);
CREATE INDEX IF NOT EXISTS idx_crawl_logs_site ON crawl_logs(monitor_site_id);
`;

const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS monitor_sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT,
  source_type TEXT NOT NULL DEFAULT 'official',
  frequency_minutes INTEGER NOT NULL DEFAULT 60,
  enabled INTEGER NOT NULL DEFAULT 1,
  region TEXT NOT NULL DEFAULT 'nationwide',
  memo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  monitor_site_id INTEGER,
  store_name TEXT NOT NULL,
  product_name TEXT NOT NULL DEFAULT '不明',
  title TEXT NOT NULL,
  application_start TEXT,
  application_deadline TEXT,
  lottery_result_date TEXT,
  purchase_period TEXT,
  conditions TEXT,
  region TEXT NOT NULL DEFAULT 'nationwide',
  channel TEXT NOT NULL DEFAULT 'unknown',
  source_url TEXT NOT NULL,
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_checked_at TEXT NOT NULL DEFAULT (datetime('now')),
  source_type TEXT NOT NULL DEFAULT 'other',
  confidence INTEGER NOT NULL DEFAULT 0,
  excerpt TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unconfirmed',
  is_excluded INTEGER NOT NULL DEFAULT 0,
  similar_group_id TEXT,
  has_similar INTEGER NOT NULL DEFAULT 0,
  is_manual INTEGER NOT NULL DEFAULT 0,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (monitor_site_id) REFERENCES monitor_sites(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS crawl_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  monitor_site_id INTEGER,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  url TEXT NOT NULL,
  http_status INTEGER,
  detected_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  last_success_at TEXT,
  FOREIGN KEY (monitor_site_id) REFERENCES monitor_sites(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  listing_id INTEGER,
  message TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS exclude_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_deadline ON listings(application_deadline);
CREATE INDEX IF NOT EXISTS idx_listings_detected ON listings(detected_at);
CREATE INDEX IF NOT EXISTS idx_crawl_logs_site ON crawl_logs(monitor_site_id);
`;

export function getDatabaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING
  );
}

export function isPostgresMode(): boolean {
  return postgresMode;
}

function adaptSqlForPg(sql: string): string {
  return sql
    .replace(/datetime\('now', '-1 day'\)/gi, "(NOW() - INTERVAL '1 day')")
    .replace(/datetime\('now', '\+1 day'\)/gi, "(NOW() + INTERVAL '1 day')")
    .replace(/datetime\('now', '\+3 days'\)/gi, "(NOW() + INTERVAL '3 days')")
    .replace(/datetime\('now', '-7 days'\)/gi, "(NOW() - INTERVAL '7 days')")
    .replace(/datetime\('now', '-3 hours'\)/gi, "(NOW() - INTERVAL '3 hours')")
    .replace(/datetime\('now'\)/gi, 'NOW()')
    .replace(/\bis_excluded = 0\b/g, 'is_excluded = false')
    .replace(/\bis_sample = 0\b/g, 'is_sample = false')
    .replace(/\bis_manual = 0\b/g, 'is_manual = false')
    .replace(/\bhas_similar = 0\b/g, 'has_similar = false')
    .replace(/\bhas_similar = 1\b/g, 'has_similar = true')
    .replace(/\bis_excluded = 1\b/g, 'is_excluded = true')
    .replace(/\bis_sample = 1\b/g, 'is_sample = true')
    .replace(/\benabled = 1\b/g, 'enabled = true')
    .replace(/\benabled = 0\b/g, 'enabled = false')
    .replace(/\bread = 0\b/g, '"read" = false')
    .replace(/\bread = 1\b/g, '"read" = true')
    .replace(/INSERT OR IGNORE/gi, 'INSERT')
    .replace(/ON CONFLICT\(key\) DO UPDATE SET value = excluded\.value/gi,
      'ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value');
}

function toPgParams(sql: string, params: unknown[]): { sql: string; params: unknown[] } {
  let i = 0;
  const pgSql = adaptSqlForPg(sql).replace(/\?/g, () => `$${++i}`);
  return { sql: pgSql, params };
}

async function getPg(): Promise<import('postgres').Sql> {
  if (!pgSql) {
    const url = getDatabaseUrl();
    if (!url) {
      throw new Error(
        'DATABASE_URL (または POSTGRES_URL) が未設定です。Vercelでは Neon / Vercel Postgres / Supabase の接続文字列を設定してください。'
      );
    }
    const postgres = (await import('postgres')).default;
    pgSql = postgres(url, { ssl: 'require', max: 1 });
  }
  return pgSql;
}

async function getSqlite(): Promise<Database.Database> {
  if (!sqliteDb) {
    const fs = await import('fs');
    const path = await import('path');
    const Database = (await import('better-sqlite3')).default;
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'tyu-sen.db');
    sqliteDb = new Database(dbPath);
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('foreign_keys = ON');
  }
  return sqliteDb;
}

export async function dbAll(sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  await ensureDb();
  if (postgresMode) {
    const pg = await getPg();
    const { sql: q, params: p } = toPgParams(sql, params);
    return (await pg.unsafe(q, p as never[])) as Record<string, unknown>[];
  }
  const db = await getSqlite();
  return db.prepare(sql).all(...params) as Record<string, unknown>[];
}

export async function dbGet(sql: string, params: unknown[] = []): Promise<Record<string, unknown> | undefined> {
  const rows = await dbAll(sql, params);
  return rows[0];
}

export async function dbRun(sql: string, params: unknown[] = []): Promise<{ lastInsertRowid: number }> {
  await ensureDb();
  if (postgresMode) {
    const pg = await getPg();
    let q = adaptSqlForPg(sql).trim();
    if (/^INSERT/i.test(q) && !/RETURNING/i.test(q)) {
      q = q.replace(/;?\s*$/, ' RETURNING id');
    }
    const { sql: pgSqlText, params: p } = toPgParams(q, params);
    const rows = (await pg.unsafe(pgSqlText, p as never[])) as { id: number }[];
    return { lastInsertRowid: Number(rows[0]?.id ?? 0) };
  }
  const db = await getSqlite();
  const result = db.prepare(sql).run(...params);
  return { lastInsertRowid: Number(result.lastInsertRowid) };
}

export async function ensureDb(): Promise<void> {
  if (initialized) return;

  const url = getDatabaseUrl();
  if (url || process.env.VERCEL === '1') {
    postgresMode = true;
    if (!url) {
      throw new Error(
        'Vercel環境では DATABASE_URL または POSTGRES_URL の設定が必須です。SQLiteファイルはサーバーレス環境で永続化できません。'
      );
    }
    const pg = await getPg();
    const statements = POSTGRES_SCHEMA.split(';').map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await pg.unsafe(stmt);
    }
    initialized = true;
    await seedIfEmpty();
  } else {
    postgresMode = false;
    const db = await getSqlite();
    db.exec(SQLITE_SCHEMA);
    initialized = true;
    await seedIfEmpty();
  }
}

async function seedIfEmpty() {
  const { DEFAULT_DETECT_KEYWORDS, DEFAULT_EXCLUDE_KEYWORDS, SAMPLE_STORES } = await import('../types');

  const count = await dbGet('SELECT COUNT(*) as c FROM monitor_sites');
  if (Number(count?.c) === 0) {
    for (const store of SAMPLE_STORES) {
      await dbRun(
        `INSERT INTO monitor_sites (name, url, source_type, frequency_minutes, enabled, region, memo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [store.name, store.url, store.source_type, store.frequency_minutes, store.enabled ? 1 : 0, store.region, store.memo]
      );
    }
  }

  const settingsCount = await dbGet('SELECT COUNT(*) as c FROM settings');
  if (Number(settingsCount?.c) === 0) {
    const defaultSettings = {
      detect_keywords: DEFAULT_DETECT_KEYWORDS,
      exclude_keywords: DEFAULT_EXCLUDE_KEYWORDS,
      min_confidence: 0,
      retention_days: 90,
      default_region: 'nationwide',
      crawl_interval_minutes: 30,
      notifications_enabled: true,
      show_excluded: false,
    };
    await dbRun('INSERT INTO settings (key, value) VALUES (?, ?)', ['app_settings', JSON.stringify(defaultSettings)]);
  }

  const excludeCount = await dbGet('SELECT COUNT(*) as c FROM exclude_keywords');
  if (Number(excludeCount?.c) === 0) {
    for (const kw of DEFAULT_EXCLUDE_KEYWORDS) {
      if (postgresMode) {
        await dbRun(
          'INSERT INTO exclude_keywords (keyword, enabled) VALUES (?, true) ON CONFLICT (keyword) DO NOTHING',
          [kw]
        );
      } else {
        await dbRun('INSERT OR IGNORE INTO exclude_keywords (keyword, enabled) VALUES (?, 1)', [kw]);
      }
    }
  }

  const sampleCount = await dbGet('SELECT COUNT(*) as c FROM listings WHERE is_sample = 1');
  if (Number(sampleCount?.c) === 0) {
    await dbRun(
      `INSERT INTO listings (
        store_name, product_name, title, application_start, application_deadline,
        lottery_result_date, purchase_period, conditions, region, channel, source_url,
        source_type, confidence, excerpt, status, is_sample
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'サンプル店舗', 'サンプル商品（拡張パック）', '【サンプル】ポケモンカード 抽選販売のお知らせ',
        null, null, null, '不明', '不明', 'nationwide', 'online', 'https://example.com/sample',
        'official', 75,
        'これはサンプルデータです。実際の抽選情報ではありません。ポケモンカードの抽選販売に関する情報がここに表示されます。',
        'unconfirmed', 1,
      ]
    );
  }
}

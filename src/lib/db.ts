import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import {
  DEFAULT_DETECT_KEYWORDS,
  DEFAULT_EXCLUDE_KEYWORDS,
  SAMPLE_STORES,
  type AppSettings,
  type Listing,
  type MonitorSite,
} from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, 'tyu-sen.db');

let db: Database.Database | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getDb(): Database.Database {
  if (!db) {
    ensureDataDir();
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(database: Database.Database) {
  database.exec(`
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
  `);

  seedIfEmpty(database);
}

function seedIfEmpty(database: Database.Database) {
  const count = database.prepare('SELECT COUNT(*) as c FROM monitor_sites').get() as { c: number };
  if (count.c === 0) {
    const insert = database.prepare(`
      INSERT INTO monitor_sites (name, url, source_type, frequency_minutes, enabled, region, memo)
      VALUES (@name, @url, @source_type, @frequency_minutes, @enabled, @region, @memo)
    `);
    for (const store of SAMPLE_STORES) {
      insert.run({ ...store, enabled: store.enabled ? 1 : 0 });
    }
  }

  const settingsCount = database.prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number };
  if (settingsCount.c === 0) {
    const defaultSettings: AppSettings = {
      detect_keywords: DEFAULT_DETECT_KEYWORDS,
      exclude_keywords: DEFAULT_EXCLUDE_KEYWORDS,
      min_confidence: 0,
      retention_days: 90,
      default_region: 'nationwide',
      crawl_interval_minutes: 30,
      notifications_enabled: true,
      show_excluded: false,
    };
    database.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(
      'app_settings',
      JSON.stringify(defaultSettings)
    );
  }

  const excludeCount = database.prepare('SELECT COUNT(*) as c FROM exclude_keywords').get() as { c: number };
  if (excludeCount.c === 0) {
    const insert = database.prepare('INSERT INTO exclude_keywords (keyword, enabled) VALUES (?, 1)');
    for (const kw of DEFAULT_EXCLUDE_KEYWORDS) {
      insert.run(kw);
    }
  }

  const sampleCount = database.prepare('SELECT COUNT(*) as c FROM listings WHERE is_sample = 1').get() as { c: number };
  if (sampleCount.c === 0) {
    database.prepare(`
      INSERT INTO listings (
        store_name, product_name, title, application_start, application_deadline,
        lottery_result_date, purchase_period, conditions, region, channel, source_url,
        source_type, confidence, excerpt, status, is_sample
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      'サンプル店舗',
      'サンプル商品（拡張パック）',
      '【サンプル】ポケモンカード 抽選販売のお知らせ',
      null,
      null,
      null,
      '不明',
      '不明',
      'nationwide',
      'online',
      'https://example.com/sample',
      'official',
      75,
      'これはサンプルデータです。実際の抽選情報ではありません。ポケモンカードの抽選販売に関する情報がここに表示されます。',
      'unconfirmed'
    );
  }
}

export function getSettings(): AppSettings {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get('app_settings') as { value: string } | undefined;
  if (!row) {
    return {
      detect_keywords: DEFAULT_DETECT_KEYWORDS,
      exclude_keywords: DEFAULT_EXCLUDE_KEYWORDS,
      min_confidence: 0,
      retention_days: 90,
      default_region: 'nationwide',
      crawl_interval_minutes: 30,
      notifications_enabled: true,
      show_excluded: false,
    };
  }
  return JSON.parse(row.value) as AppSettings;
}

export function saveSettings(settings: AppSettings) {
  getDb().prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run('app_settings', JSON.stringify(settings));
}

export function rowToMonitorSite(row: Record<string, unknown>): MonitorSite {
  return {
    id: row.id as number,
    name: row.name as string,
    url: row.url as string | null,
    source_type: row.source_type as MonitorSite['source_type'],
    frequency_minutes: row.frequency_minutes as number,
    enabled: Boolean(row.enabled),
    region: row.region as MonitorSite['region'],
    memo: row.memo as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function rowToListing(row: Record<string, unknown>): Listing {
  return {
    id: row.id as number,
    monitor_site_id: row.monitor_site_id as number | null,
    store_name: row.store_name as string,
    product_name: (row.product_name as string) || '不明',
    title: row.title as string,
    application_start: row.application_start as string | null,
    application_deadline: row.application_deadline as string | null,
    lottery_result_date: row.lottery_result_date as string | null,
    purchase_period: row.purchase_period as string | null,
    conditions: row.conditions as string | null,
    region: row.region as Listing['region'],
    channel: row.channel as Listing['channel'],
    source_url: row.source_url as string,
    detected_at: row.detected_at as string,
    last_checked_at: row.last_checked_at as string,
    source_type: row.source_type as Listing['source_type'],
    confidence: row.confidence as number,
    excerpt: row.excerpt as string,
    status: row.status as Listing['status'],
    is_excluded: Boolean(row.is_excluded),
    similar_group_id: row.similar_group_id as string | null,
    has_similar: Boolean(row.has_similar),
    is_manual: Boolean(row.is_manual),
    is_sample: Boolean(row.is_sample),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

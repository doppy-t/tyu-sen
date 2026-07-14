import {
  DEFAULT_DETECT_KEYWORDS,
  DEFAULT_EXCLUDE_KEYWORDS,
  SAMPLE_STORES,
  type AppSettings,
  type Listing,
  type MonitorSite,
} from './types';
import {
  dbAll,
  dbGet,
  dbRun,
  ensureDb,
  isPostgresMode,
} from './db/client';

export {
  ensureDb,
  dbAll,
  dbGet,
  dbRun,
  isPostgresMode,
  getDatabaseUrl,
  dbBool,
  getDbMode,
  getDbHealth,
  DATABASE_ENV_VAR_NAMES,
  getDatabaseEnvVarStatus,
  getActiveDatabaseEnvVar,
} from './db/client';

export async function getSettings(): Promise<AppSettings> {
  await ensureDb();
  const row = await dbGet('SELECT value FROM settings WHERE key = ?', ['app_settings']);
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
  return JSON.parse(row.value as string) as AppSettings;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await ensureDb();
  if (isPostgresMode()) {
    await dbRun(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value`,
      ['app_settings', JSON.stringify(settings)]
    );
  } else {
    await dbRun(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ['app_settings', JSON.stringify(settings)]
    );
  }
}

export function rowToMonitorSite(row: Record<string, unknown>): MonitorSite {
  return {
    id: Number(row.id),
    name: row.name as string,
    url: row.url as string | null,
    source_type: row.source_type as MonitorSite['source_type'],
    frequency_minutes: Number(row.frequency_minutes),
    enabled: Boolean(row.enabled),
    region: row.region as MonitorSite['region'],
    memo: row.memo as string,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function rowToListing(row: Record<string, unknown>): Listing {
  return {
    id: Number(row.id),
    monitor_site_id: row.monitor_site_id != null ? Number(row.monitor_site_id) : null,
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
    application_url: (row.application_url as string | null) ?? null,
    detected_at: String(row.detected_at),
    last_checked_at: String(row.last_checked_at),
    source_type: row.source_type as Listing['source_type'],
    confidence: Number(row.confidence),
    excerpt: row.excerpt as string,
    status: row.status as Listing['status'],
    is_excluded: Boolean(row.is_excluded),
    similar_group_id: row.similar_group_id as string | null,
    has_similar: Boolean(row.has_similar),
    is_manual: Boolean(row.is_manual),
    is_sample: Boolean(row.is_sample),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

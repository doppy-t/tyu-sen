import { getDb } from './db';
import type { ListingStatus } from './types';
import type { DashboardStats } from './types-dashboard';

export type { DashboardStats };

export function getDashboardStats(): DashboardStats {
  const db = getDb();
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const newCount = (db.prepare(`
    SELECT COUNT(*) as c FROM listings
    WHERE detected_at > datetime('now', '-1 day') AND is_sample = 0
  `).get() as { c: number }).c;

  const unconfirmedCount = (db.prepare(`
    SELECT COUNT(*) as c FROM listings WHERE status = 'unconfirmed' AND is_sample = 0
  `).get() as { c: number }).c;

  const appliedCount = (db.prepare(`
    SELECT COUNT(*) as c FROM listings WHERE status = 'applied'
  `).get() as { c: number }).c;

  const monitorCount = (db.prepare('SELECT COUNT(*) as c FROM monitor_sites').get() as { c: number }).c;

  const allListings = db.prepare(`
    SELECT application_deadline FROM listings
    WHERE application_deadline IS NOT NULL AND status NOT IN ('excluded', 'expired', 'applied')
    AND is_sample = 0
  `).all() as { application_deadline: string }[];

  let todayDeadline = 0;
  let threeDayDeadline = 0;
  for (const l of allListings) {
    try {
      const d = new Date(l.application_deadline);
      if (isNaN(d.getTime())) continue;
      if (d >= now && d <= todayEnd) todayDeadline++;
      if (d >= now && d <= threeDaysLater) threeDayDeadline++;
    } catch { /* skip */ }
  }

  const lastCrawl = db.prepare(`
    SELECT ended_at FROM crawl_logs ORDER BY id DESC LIMIT 1
  `).get() as { ended_at: string } | undefined;

  const crawlErrors = (db.prepare(`
    SELECT COUNT(*) as c FROM crawl_logs
    WHERE error_message IS NOT NULL AND started_at > datetime('now', '-7 days')
  `).get() as { c: number }).c;

  return {
    new_count: newCount,
    unconfirmed_count: unconfirmedCount,
    today_deadline_count: todayDeadline,
    three_day_deadline_count: threeDayDeadline,
    applied_count: appliedCount,
    monitor_count: monitorCount,
    last_crawl_at: lastCrawl?.ended_at ?? null,
    crawl_error_count: crawlErrors,
  };
}

export interface ListingFilters {
  status?: ListingStatus | ListingStatus[];
  unconfirmed_only?: boolean;
  applicable_only?: boolean;
  applied_only?: boolean;
  deadline_24h?: boolean;
  deadline_3d?: boolean;
  region?: string;
  channel?: string;
  source_type?: string;
  store?: string;
  product?: string;
  include_low_confidence?: boolean;
  include_excluded?: boolean;
  min_confidence?: number;
  similar_group_id?: string;
}

export function getListings(filters: ListingFilters = {}) {
  const db = getDb();
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];

  if (!filters.include_excluded) {
    conditions.push('is_excluded = 0');
  }

  if (filters.unconfirmed_only) {
    conditions.push("status = 'unconfirmed'");
  }

  if (filters.applied_only) {
    conditions.push("status = 'applied'");
  }

  if (filters.applicable_only) {
    conditions.push("status IN ('unconfirmed', 'needs_review', 'planned')");
    conditions.push("(application_deadline IS NULL OR application_deadline > datetime('now'))");
  }

  if (filters.deadline_24h) {
    conditions.push("application_deadline IS NOT NULL");
    conditions.push("application_deadline <= datetime('now', '+1 day')");
    conditions.push("application_deadline > datetime('now')");
  }

  if (filters.deadline_3d) {
    conditions.push("application_deadline IS NOT NULL");
    conditions.push("application_deadline <= datetime('now', '+3 days')");
    conditions.push("application_deadline > datetime('now')");
  }

  if (filters.region) {
    conditions.push('region = ?');
    params.push(filters.region);
  }

  if (filters.channel) {
    conditions.push('channel = ?');
    params.push(filters.channel);
  }

  if (filters.source_type) {
    conditions.push('source_type = ?');
    params.push(filters.source_type);
  }

  if (filters.store) {
    conditions.push('store_name LIKE ?');
    params.push(`%${filters.store}%`);
  }

  if (filters.product) {
    conditions.push('product_name LIKE ?');
    params.push(`%${filters.product}%`);
  }

  if (filters.min_confidence !== undefined && !filters.include_low_confidence) {
    conditions.push('confidence >= ?');
    params.push(filters.min_confidence);
  }

  if (filters.similar_group_id) {
    conditions.push('similar_group_id = ?');
    params.push(filters.similar_group_id);
  }

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    conditions.push(`status IN (${statuses.map(() => '?').join(',')})`);
    params.push(...statuses);
  }

  const sql = `
    SELECT * FROM listings
    WHERE ${conditions.join(' AND ')}
    ORDER BY
      CASE WHEN status = 'unconfirmed' THEN 0 ELSE 1 END,
      CASE WHEN application_deadline IS NULL THEN 1 ELSE 0 END,
      application_deadline ASC,
      detected_at DESC
  `;

  return db.prepare(sql).all(...params);
}

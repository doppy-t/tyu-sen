import * as cheerio from 'cheerio';
import { detectLotteryInfo, calculateConfidence } from './detector';
import { extractDates, extractProductName, extractConditions, detectChannel } from './date-parser';
import { checkDuplicate } from './deduplicator';
import { getDb, getSettings, rowToListing, rowToMonitorSite } from './db';
import type { MonitorSite, SourceType } from './types';
import { createNotification } from './notifications';

const FETCH_TIMEOUT = 15000;
const USER_AGENT = 'TyuSenBot/0.1 (+local monitoring; contact: user-local)';

export interface FetchResult {
  title: string;
  body: string;
  headings: string[];
  linkTexts: string[];
  links: { href: string; text: string }[];
  httpStatus: number;
}

export async function fetchPage(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      signal: controller.signal,
      redirect: 'follow',
    });

    const html = await res.text();
    const $ = cheerio.load(html);

    $('script, style, noscript').remove();

    const headings: string[] = [];
    $('h1, h2, h3, h4').each((_, el) => {
      const t = $(el).text().trim();
      if (t) headings.push(t);
    });

    const linkTexts: string[] = [];
    const links: { href: string; text: string }[] = [];
    $('a').each((_, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr('href') ?? '';
      if (text) linkTexts.push(text);
      if (href) links.push({ href, text });
    });

    const title = $('title').text().trim() || headings[0] || '';
    const body = $('body').text().replace(/\s+/g, ' ').trim();

    return { title, body, headings, linkTexts, links, httpStatus: res.status };
  } finally {
    clearTimeout(timeout);
  }
}

export interface CrawlResult {
  detectedCount: number;
  error: string | null;
  httpStatus: number | null;
}

export async function crawlMonitorSite(site: MonitorSite): Promise<CrawlResult> {
  const db = getDb();
  const startedAt = new Date().toISOString();
  let httpStatus: number | null = null;
  let detectedCount = 0;
  let error: string | null = null;

  if (!site.url) {
    error = '監視URLが未設定です';
    db.prepare(`
      INSERT INTO crawl_logs (monitor_site_id, started_at, ended_at, url, http_status, detected_count, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(site.id, startedAt, new Date().toISOString(), '(未設定)', null, 0, error);
    return { detectedCount: 0, error, httpStatus: null };
  }

  try {
    const page = await fetchPage(site.url);
    httpStatus = page.httpStatus;

    if (httpStatus >= 400) {
      error = `HTTP ${httpStatus}`;
      db.prepare(`
        INSERT INTO crawl_logs (monitor_site_id, started_at, ended_at, url, http_status, detected_count, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(site.id, startedAt, new Date().toISOString(), site.url, httpStatus, 0, error);
    } else {
      const settings = getSettings();
      const excludeKeywords = [
        ...settings.exclude_keywords,
        ...db.prepare('SELECT keyword FROM exclude_keywords WHERE enabled = 1').all().map((r) => (r as { keyword: string }).keyword),
      ];

      const candidates = extractCandidates(page, site.url);

      for (const candidate of candidates) {
        const detection = detectLotteryInfo({
          title: candidate.title,
          body: candidate.body,
          headings: candidate.headings,
          linkTexts: candidate.linkTexts,
          detectKeywords: settings.detect_keywords,
          excludeKeywords,
        });

        if (!detection.detected) continue;

        const dates = extractDates(candidate.body);
        const productName = extractProductName(candidate.body, candidate.title);
        const conditions = extractConditions(candidate.body);
        const channel = detectChannel(candidate.body);

        const confidence = calculateConfidence({
          matchedProductKeywords: detection.matchedProductKeywords,
          matchedSaleKeywords: detection.matchedSaleKeywords,
          hasApplicationForm: detection.hasApplicationForm,
          applicationDeadline: dates.application_deadline,
          productName,
          sourceType: site.source_type,
          lotteryResultDate: dates.lottery_result_date,
          purchasePeriod: dates.purchase_period,
        });

        const status = confidence < 40 ? 'needs_review' : 'unconfirmed';

        const existingRows = db.prepare('SELECT * FROM listings WHERE is_sample = 0').all();
        const existing = existingRows.map((r) => rowToListing(r as Record<string, unknown>));

        const dup = checkDuplicate(
          {
            store_name: site.name,
            product_name: productName,
            application_deadline: dates.application_deadline,
            title: candidate.title,
            source_url: candidate.url,
            excerpt: detection.excerpt,
          },
          existing
        );

        if (dup.isDuplicate) {
          db.prepare(`UPDATE listings SET last_checked_at = datetime('now') WHERE id = ?`).run(dup.matchedListingId);
          continue;
        }

        const now = new Date().toISOString();
        const result = db.prepare(`
          INSERT INTO listings (
            monitor_site_id, store_name, product_name, title,
            application_start, application_deadline, lottery_result_date, purchase_period, conditions,
            region, channel, source_url, detected_at, last_checked_at, source_type,
            confidence, excerpt, status, is_excluded, similar_group_id, has_similar
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          site.id, site.name, productName, candidate.title,
          dates.application_start, dates.application_deadline, dates.lottery_result_date,
          dates.purchase_period ?? '不明', conditions ?? '不明',
          site.region, channel, candidate.url, now, now, site.source_type,
          confidence, detection.excerpt, status,
          detection.isExcluded ? 1 : 0,
          dup.similarGroupId, dup.isSimilar ? 1 : 0
        );

        if (dup.isSimilar && dup.matchedListingId) {
          db.prepare('UPDATE listings SET has_similar = 1, similar_group_id = ? WHERE id = ?')
            .run(dup.similarGroupId, dup.matchedListingId);
        }

        detectedCount++;
        createNotification('new_listing', result.lastInsertRowid as number, `新しい抽選情報: ${candidate.title}（${site.name}）`);
      }

      db.prepare(`
        INSERT INTO crawl_logs (monitor_site_id, started_at, ended_at, url, http_status, detected_count, error_message, last_success_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(site.id, startedAt, new Date().toISOString(), site.url, httpStatus, detectedCount, null, new Date().toISOString());
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    db.prepare(`
      INSERT INTO crawl_logs (monitor_site_id, started_at, ended_at, url, http_status, detected_count, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(site.id, startedAt, new Date().toISOString(), site.url ?? '(不明)', httpStatus, detectedCount, error);
  }

  return { detectedCount, error, httpStatus };
}

interface PageCandidate {
  title: string;
  body: string;
  headings: string[];
  linkTexts: string[];
  url: string;
}

function extractCandidates(page: FetchResult, baseUrl: string): PageCandidate[] {
  const candidates: PageCandidate[] = [{
    title: page.title,
    body: page.body,
    headings: page.headings,
    linkTexts: page.linkTexts,
    url: baseUrl,
  }];

  const saleLinks = page.links.filter((l) =>
    /抽選|応募|販売|予約|入荷|ポケモン|ポケカ|新商品/i.test(l.text + l.href)
  ).slice(0, 10);

  return candidates;
}

export async function parseUrlForManualEntry(url: string, storeName?: string, sourceType?: SourceType) {
  const page = await fetchPage(url);
  const settings = getSettings();

  const detection = detectLotteryInfo({
    title: page.title,
    body: page.body,
    headings: page.headings,
    linkTexts: page.linkTexts,
    detectKeywords: settings.detect_keywords,
    excludeKeywords: settings.exclude_keywords,
  });

  const dates = extractDates(page.body);
  const productName = extractProductName(page.body, page.title);
  const conditions = extractConditions(page.body);
  const channel = detectChannel(page.body);

  const confidence = calculateConfidence({
    matchedProductKeywords: detection.matchedProductKeywords,
    matchedSaleKeywords: detection.matchedSaleKeywords,
    hasApplicationForm: detection.hasApplicationForm,
    applicationDeadline: dates.application_deadline,
    productName,
    sourceType: sourceType ?? 'other',
    lotteryResultDate: dates.lottery_result_date,
    purchasePeriod: dates.purchase_period,
  });

  return {
    store_name: storeName ?? '手動登録',
    product_name: productName,
    title: page.title || '不明',
    application_start: dates.application_start,
    application_deadline: dates.application_deadline,
    lottery_result_date: dates.lottery_result_date,
    purchase_period: dates.purchase_period ?? '不明',
    conditions: conditions ?? '不明',
    channel,
    source_url: url,
    source_type: sourceType ?? 'other',
    confidence,
    excerpt: detection.excerpt,
    status: detection.detected ? (confidence < 40 ? 'needs_review' : 'unconfirmed') : 'needs_review',
    is_excluded: detection.isExcluded,
    detected: detection.detected,
    httpStatus: page.httpStatus,
  };
}

export async function crawlAllEnabled(): Promise<{ total: number; errors: number }> {
  const db = getDb();
  const sites = db.prepare('SELECT * FROM monitor_sites WHERE enabled = 1 AND url IS NOT NULL AND url != \'\'').all();
  let errors = 0;

  for (const row of sites) {
    const site = rowToMonitorSite(row as Record<string, unknown>);
    const result = await crawlMonitorSite(site);
    if (result.error) errors++;
  }

  return { total: sites.length, errors };
}

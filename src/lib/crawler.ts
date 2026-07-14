import * as cheerio from 'cheerio';
import {
  extractPageCandidates,
  defaultLotteryDetector,
  defaultLotteryExtractor,
  type PageContent,
} from './lottery';
import { checkDuplicate } from './deduplicator';
import { dbAll, dbRun, getSettings, rowToListing, rowToMonitorSite, dbBool } from './db';
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
  candidateCount: number;
  savedCount: number;
  duplicateSkippedCount: number;
  processingTimeMs: number;
  error: string | null;
  httpStatus: number | null;
}

async function insertCrawlLog(params: {
  siteId: number;
  startedAt: string;
  url: string;
  httpStatus: number | null;
  candidateCount: number;
  savedCount: number;
  duplicateSkippedCount: number;
  processingTimeMs: number;
  error: string | null;
  lastSuccessAt?: string | null;
}) {
  await dbRun(
    `INSERT INTO crawl_logs (
      monitor_site_id, started_at, ended_at, url, http_status,
      detected_count, candidate_count, saved_count, duplicate_skipped_count,
      processing_time_ms, error_message, last_success_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.siteId,
      params.startedAt,
      new Date().toISOString(),
      params.url,
      params.httpStatus,
      params.savedCount,
      params.candidateCount,
      params.savedCount,
      params.duplicateSkippedCount,
      params.processingTimeMs,
      params.error,
      params.lastSuccessAt ?? null,
    ]
  );
}

export async function crawlMonitorSite(site: MonitorSite): Promise<CrawlResult> {
  const startedAt = new Date().toISOString();
  const crawlStarted = Date.now();
  let httpStatus: number | null = null;
  let candidateCount = 0;
  let savedCount = 0;
  let duplicateSkippedCount = 0;
  let error: string | null = null;

  const emptyResult = (): CrawlResult => ({
    detectedCount: savedCount,
    candidateCount,
    savedCount,
    duplicateSkippedCount,
    processingTimeMs: Date.now() - crawlStarted,
    error,
    httpStatus,
  });

  if (!site.url) {
    error = '監視URLが未設定です';
    await insertCrawlLog({
      siteId: site.id,
      startedAt,
      url: '(未設定)',
      httpStatus: null,
      candidateCount: 0,
      savedCount: 0,
      duplicateSkippedCount: 0,
      processingTimeMs: Date.now() - crawlStarted,
      error,
    });
    return emptyResult();
  }

  try {
    const page = await fetchPage(site.url);
    httpStatus = page.httpStatus;

    if (httpStatus >= 400) {
      error = `HTTP ${httpStatus}`;
      await insertCrawlLog({
        siteId: site.id,
        startedAt,
        url: site.url,
        httpStatus,
        candidateCount: 0,
        savedCount: 0,
        duplicateSkippedCount: 0,
        processingTimeMs: Date.now() - crawlStarted,
        error,
      });
      return emptyResult();
    }

    const settings = await getSettings();
    const excludeRows = await dbAll('SELECT keyword FROM exclude_keywords WHERE enabled = 1');
    const excludeKeywords = [
      ...settings.exclude_keywords,
      ...excludeRows.map((r) => (r as { keyword: string }).keyword),
    ];

    const pageCandidates = extractPageCandidates(page, site.url);
    const existingRows = await dbAll('SELECT * FROM listings WHERE is_sample = 0');
    const existing = existingRows.map((r) => rowToListing(r));

    for (const candidate of pageCandidates) {
      const pageContent: PageContent = {
        title: candidate.title,
        body: candidate.body,
        headings: candidate.headings,
        linkTexts: candidate.linkTexts,
        links: candidate.links,
        sourceUrl: candidate.sourceUrl,
      };

      const detection = defaultLotteryDetector.detect(pageContent, {
        detectKeywords: settings.detect_keywords,
        excludeKeywords,
      });

      if (!detection.isCandidate) continue;
      candidateCount++;

      const extracted = defaultLotteryExtractor.extract(pageContent, detection, {
        storeName: site.name,
        sourceType: site.source_type,
        region: site.region,
      });

      const dup = checkDuplicate(
        {
          store_name: extracted.storeName,
          product_name: extracted.productName,
          application_deadline: extracted.applicationDeadline,
          title: extracted.title,
          source_url: extracted.sourceUrl,
          excerpt: extracted.excerpt,
        },
        existing
      );

      if (dup.isDuplicate) {
        duplicateSkippedCount++;
        await dbRun(`UPDATE listings SET last_checked_at = datetime('now') WHERE id = ?`, [dup.matchedListingId]);
        continue;
      }

      const now = new Date().toISOString();
      const result = await dbRun(
        `INSERT INTO listings (
          monitor_site_id, store_name, product_name, title,
          application_start, application_deadline, lottery_result_date, purchase_period, conditions,
          region, channel, source_url, application_url, detected_at, last_checked_at, source_type,
          confidence, excerpt, status, is_excluded, similar_group_id, has_similar
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          site.id,
          extracted.storeName,
          extracted.productName,
          extracted.title,
          extracted.applicationStart,
          extracted.applicationDeadline,
          extracted.lotteryResultDate,
          extracted.purchasePeriod,
          extracted.conditions,
          extracted.region,
          extracted.channel,
          extracted.sourceUrl,
          extracted.applicationUrl,
          now,
          now,
          site.source_type,
          extracted.confidence,
          extracted.excerpt,
          extracted.status,
          dbBool(extracted.isExcluded),
          dup.similarGroupId,
          dbBool(dup.isSimilar),
        ]
      );

      if (dup.isSimilar && dup.matchedListingId) {
        await dbRun('UPDATE listings SET has_similar = 1, similar_group_id = ? WHERE id = ?',
          [dup.similarGroupId, dup.matchedListingId]);
      }

      savedCount++;
      await createNotification(
        'new_listing',
        result.lastInsertRowid,
        `新しい抽選情報: ${extracted.title}（${site.name}）スコア${extracted.confidence}点`
      );

      existing.push({
        id: result.lastInsertRowid,
        monitor_site_id: site.id,
        store_name: extracted.storeName,
        product_name: extracted.productName,
        title: extracted.title,
        application_start: extracted.applicationStart,
        application_deadline: extracted.applicationDeadline,
        lottery_result_date: extracted.lotteryResultDate,
        purchase_period: extracted.purchasePeriod,
        conditions: extracted.conditions,
        region: extracted.region,
        channel: extracted.channel,
        source_url: extracted.sourceUrl,
        application_url: extracted.applicationUrl,
        detected_at: now,
        last_checked_at: now,
        source_type: site.source_type,
        confidence: extracted.confidence,
        excerpt: extracted.excerpt,
        status: extracted.status,
        is_excluded: extracted.isExcluded,
        similar_group_id: dup.similarGroupId,
        has_similar: dup.isSimilar,
        is_manual: false,
        is_sample: false,
        created_at: now,
        updated_at: now,
      });
    }

    await insertCrawlLog({
      siteId: site.id,
      startedAt,
      url: site.url,
      httpStatus,
      candidateCount,
      savedCount,
      duplicateSkippedCount,
      processingTimeMs: Date.now() - crawlStarted,
      error: null,
      lastSuccessAt: new Date().toISOString(),
    });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    console.error('[Crawl] Error:', error);
    await insertCrawlLog({
      siteId: site.id,
      startedAt,
      url: site.url ?? '(不明)',
      httpStatus,
      candidateCount,
      savedCount,
      duplicateSkippedCount,
      processingTimeMs: Date.now() - crawlStarted,
      error,
    });
  }

  return {
    detectedCount: savedCount,
    candidateCount,
    savedCount,
    duplicateSkippedCount,
    processingTimeMs: Date.now() - crawlStarted,
    error,
    httpStatus,
  };
}

export async function parseUrlForManualEntry(url: string, storeName?: string, sourceType?: SourceType) {
  const page = await fetchPage(url);
  const settings = await getSettings();

  const pageContent: PageContent = {
    title: page.title,
    body: page.body,
    headings: page.headings,
    linkTexts: page.linkTexts,
    links: page.links,
    sourceUrl: url,
  };

  const detection = defaultLotteryDetector.detect(pageContent, {
    detectKeywords: settings.detect_keywords,
    excludeKeywords: settings.exclude_keywords,
  });

  const extracted = defaultLotteryExtractor.extract(pageContent, detection, {
    storeName: storeName ?? '手動登録',
    sourceType: sourceType ?? 'other',
    region: 'nationwide',
  });

  return {
    store_name: extracted.storeName,
    product_name: extracted.productName,
    title: extracted.title,
    application_start: extracted.applicationStart,
    application_deadline: extracted.applicationDeadline,
    lottery_result_date: extracted.lotteryResultDate,
    purchase_period: extracted.purchasePeriod,
    conditions: extracted.conditions,
    channel: extracted.channel,
    source_url: extracted.sourceUrl,
    application_url: extracted.applicationUrl,
    source_type: sourceType ?? 'other',
    confidence: extracted.confidence,
    excerpt: extracted.excerpt,
    status: detection.isCandidate ? extracted.status : 'needs_review',
    is_excluded: extracted.isExcluded,
    detected: detection.isCandidate,
    classification: detection.classification,
    httpStatus: page.httpStatus,
  };
}

export async function crawlAllEnabled(): Promise<{ total: number; errors: number }> {
  const sites = await dbAll(
    `SELECT * FROM monitor_sites WHERE enabled = 1 AND url IS NOT NULL AND url != ''`
  );
  let errors = 0;

  for (const row of sites) {
    const site = rowToMonitorSite(row);
    const result = await crawlMonitorSite(site);
    if (result.error) errors++;
  }

  return { total: sites.length, errors };
}

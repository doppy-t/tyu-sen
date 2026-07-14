import {
  extractDates,
  extractProductName,
  extractConditions,
  detectChannel,
  extractApplicationUrl,
  extractPurchasePeriod,
} from '../date-parser';
import type {
  ExtractedListingFields,
  ExtractorContext,
  LotteryDetection,
  LotteryExtractor,
  PageContent,
} from './types';
import { scoreToStatus } from './scorer';

function orUnknown(value: string | null | undefined): string {
  if (!value || !value.trim()) return '不明';
  return value.trim();
}

export class RegexLotteryExtractor implements LotteryExtractor {
  extract(page: PageContent, detection: LotteryDetection, context: ExtractorContext): ExtractedListingFields {
    const text = [page.title, ...page.headings, page.body].join('\n');
    const dates = extractDates(text);
    const productName = extractProductName(text, page.title);
    const conditions = extractConditions(text);
    const channel = detectChannel(text);
    const applicationUrl = extractApplicationUrl(page.links, page.sourceUrl);
    const purchasePeriod = extractPurchasePeriod(text) ?? dates.purchase_period;

    const isExcluded = detection.isExcludedByKeyword || detection.classification === 'excluded_candidate';

    return {
      storeName: context.storeName,
      productName: orUnknown(productName === '不明' ? null : productName),
      title: page.title || '不明',
      applicationStart: dates.application_start,
      applicationDeadline: dates.application_deadline,
      lotteryResultDate: dates.lottery_result_date,
      purchasePeriod: orUnknown(purchasePeriod),
      conditions: orUnknown(conditions),
      region: context.region,
      channel,
      sourceUrl: page.sourceUrl,
      applicationUrl,
      excerpt: detection.excerpt || page.body.slice(0, 300),
      confidence: detection.confidence,
      status: scoreToStatus(detection.classification),
      isExcluded,
      classification: detection.classification,
    };
  }
}

export const defaultLotteryExtractor: LotteryExtractor = new RegexLotteryExtractor();

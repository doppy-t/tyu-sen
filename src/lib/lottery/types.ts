import type { SourceType, Region, ChannelType, ListingStatus } from '../types';

export interface PageContent {
  title: string;
  body: string;
  headings: string[];
  linkTexts: string[];
  links: { href: string; text: string }[];
  sourceUrl: string;
}

export interface FetchedPage {
  title: string;
  body: string;
  headings: string[];
  linkTexts: string[];
  links: { href: string; text: string }[];
}

export interface PageCandidate extends FetchedPage {
  sourceUrl: string;
}

export type LotteryClassification = 'high' | 'review' | 'excluded_candidate';

export interface LotteryDetection {
  isCandidate: boolean;
  confidence: number;
  classification: LotteryClassification;
  positiveMatches: string[];
  negativeMatches: string[];
  excerpt: string;
  isExcludedByKeyword: boolean;
  excludeReason: string | null;
  hasApplicationForm: boolean;
}

export interface ExtractedListingFields {
  storeName: string;
  productName: string;
  title: string;
  applicationStart: string | null;
  applicationDeadline: string | null;
  lotteryResultDate: string | null;
  purchasePeriod: string;
  conditions: string;
  region: Region;
  channel: ChannelType;
  sourceUrl: string;
  applicationUrl: string | null;
  excerpt: string;
  confidence: number;
  status: ListingStatus;
  isExcluded: boolean;
  classification: LotteryClassification;
}

export interface LotteryDetector {
  detect(page: PageContent, options?: DetectorOptions): LotteryDetection;
}

export interface LotteryExtractor {
  extract(page: PageContent, detection: LotteryDetection, context: ExtractorContext): ExtractedListingFields;
}

export interface DetectorOptions {
  detectKeywords?: string[];
  excludeKeywords?: string[];
}

export interface ExtractorContext {
  storeName: string;
  sourceType: SourceType;
  region: Region;
}

export interface ProcessCandidateResult {
  saved: boolean;
  duplicate: boolean;
  similar: boolean;
  listingId?: number;
}

export interface CrawlStats {
  candidateCount: number;
  savedCount: number;
  duplicateSkippedCount: number;
  processingTimeMs: number;
}

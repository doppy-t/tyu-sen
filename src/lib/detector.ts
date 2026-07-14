import type { SourceType } from './types';

const PRODUCT_KEYWORDS = [
  'ポケモンカード', 'ポケカ', 'Pokémon Card', 'Pokemon Card', 'Pokémon',
  '新弾', '拡張パック', '強化拡張パック', 'BOX', 'ボックス', 'パック',
  'スターターセット', 'デッキ', 'スペシャルセット', 'ハイクラスパック',
];

const SALE_KEYWORDS = [
  '抽選', '抽選販売', '事前抽選', '応募', '応募受付', '予約', '予約受付',
  '購入権', '当選', '販売方法', '販売について', '入荷', '再入荷',
  '店頭販売', 'オンライン販売', '購入希望者', '新商品', '販売案内',
];

export interface DetectionInput {
  title: string;
  body: string;
  headings: string[];
  linkTexts: string[];
  detectKeywords?: string[];
  excludeKeywords?: string[];
}

export interface DetectionResult {
  detected: boolean;
  confidence: number;
  excerpt: string;
  matchedProductKeywords: string[];
  matchedSaleKeywords: string[];
  isExcluded: boolean;
  excludeReason: string | null;
  hasApplicationForm: boolean;
}

export function detectLotteryInfo(input: DetectionInput): DetectionResult {
  const detectKw = input.detectKeywords ?? [...PRODUCT_KEYWORDS, ...SALE_KEYWORDS];
  const excludeKw = input.excludeKeywords ?? [];

  const fullText = [
    input.title,
    ...input.headings,
    input.body,
    ...input.linkTexts,
  ].join('\n');

  const matchedProduct = PRODUCT_KEYWORDS.filter((k) => fullText.includes(k));
  const matchedSale = SALE_KEYWORDS.filter((k) => fullText.includes(k));
  const matchedCustom = detectKw.filter((k) => fullText.includes(k));

  const excludeMatch = excludeKw.find((k) => fullText.includes(k));
  const isExcluded = Boolean(excludeMatch);

  const hasProduct = matchedProduct.length > 0 || /ポケモン|Pokemon|Pokémon/i.test(fullText);
  const hasSale = matchedSale.length > 0;
  const hasStrongSale = /抽選|応募|購入権|当選|予約受付|販売方法/.test(fullText);
  const hasWeakSale = /新商品|販売案内|購入希望者|入荷|再入荷/.test(fullText);

  const hasApplicationForm = /応募(?:フォーム|はこちら|する)|申込|エントリー|応募ページ/i.test(fullText)
    || input.linkTexts.some((t) => /応募|申込|エントリー/i.test(t));

  let detected = false;
  if (hasProduct && (hasSale || hasWeakSale)) detected = true;
  if (hasStrongSale && matchedCustom.length >= 2) detected = true;
  if (hasProduct && hasStrongSale) detected = true;
  if (/ポケモンカード|ポケカ/i.test(fullText) && /販売|予約|抽選|応募/.test(fullText)) detected = true;

  const excerpt = buildExcerpt(fullText, matchedProduct, matchedSale);

  return {
    detected,
    confidence: 0,
    excerpt,
    matchedProductKeywords: matchedProduct,
    matchedSaleKeywords: matchedSale,
    isExcluded,
    excludeReason: excludeMatch ?? null,
    hasApplicationForm,
  };
}

function buildExcerpt(text: string, productKw: string[], saleKw: string[]): string {
  const keywords = [...productKw, ...saleKw];
  const lines = text.split(/\n+/).filter((l) => l.trim().length > 10);
  for (const line of lines) {
    if (keywords.some((k) => line.includes(k))) {
      return line.trim().slice(0, 300);
    }
  }
  return text.replace(/\s+/g, ' ').trim().slice(0, 300);
}

export function calculateConfidence(params: {
  matchedProductKeywords: string[];
  matchedSaleKeywords: string[];
  hasApplicationForm: boolean;
  applicationDeadline: string | null;
  productName: string;
  sourceType: SourceType;
  lotteryResultDate: string | null;
  purchasePeriod: string | null;
}): number {
  let score = 0;

  if (params.matchedProductKeywords.length > 0) score += 20;
  if (params.matchedSaleKeywords.some((k) => /抽選|応募/.test(k))) score += 25;
  else if (params.matchedSaleKeywords.length > 0) score += 15;
  if (params.applicationDeadline) score += 15;
  if (params.productName && params.productName !== '不明') score += 10;
  if (params.sourceType === 'official') score += 10;
  if (params.hasApplicationForm) score += 10;
  if (params.lotteryResultDate) score += 5;
  if (params.purchasePeriod) score += 5;

  return Math.min(100, score);
}

export { PRODUCT_KEYWORDS, SALE_KEYWORDS };

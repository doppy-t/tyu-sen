/** @deprecated Use src/lib/lottery instead */
export {
  detectLotteryInfo,
  defaultLotteryDetector,
  KeywordLotteryDetector,
  POSITIVE_KEYWORD_SCORES,
  NEGATIVE_KEYWORD_SCORES,
  classifyScore,
  scoreLotteryContent,
} from './lottery';

import { scoreLotteryContent } from './lottery/scorer';
import type { SourceType } from './types';

/** @deprecated Use KeywordLotteryDetector scoring instead */
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
  const text = [
    ...params.matchedProductKeywords,
    ...params.matchedSaleKeywords,
    params.productName,
    params.applicationDeadline ?? '',
    params.purchasePeriod ?? '',
  ].join(' ');
  const { score } = scoreLotteryContent({
    title: text,
    headings: [],
    linkTexts: [],
    body: text,
  });
  let result = score;
  if (params.hasApplicationForm) result += 5;
  if (params.sourceType === 'official') result += 5;
  return Math.min(100, result);
}

export const PRODUCT_KEYWORDS = [
  'ポケモンカード', 'ポケカ', '拡張パック', '強化拡張パック', 'ハイクラスパック',
  'スペシャルセット', 'スターターセット', 'BOX', 'ボックス',
];

export const SALE_KEYWORDS = [
  '抽選', '抽選販売', '応募', '応募期間', '当選発表', '購入期間',
  '予約', '販売方法', '新商品', '入荷', '再入荷',
];

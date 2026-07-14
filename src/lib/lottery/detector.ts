import type { DetectorOptions, LotteryDetection, LotteryDetector, PageContent } from './types';
import { classifyScore, scoreLotteryContent } from './scorer';

function buildExcerpt(
  text: string,
  positiveMatches: string[],
  title: string
): string {
  const keywords = positiveMatches;
  const lines = text.split(/\n+/).filter((l) => l.trim().length > 8);
  for (const line of lines) {
    if (keywords.some((k) => line.includes(k))) {
      return line.trim().slice(0, 300);
    }
  }
  const combined = `${title} ${text}`.replace(/\s+/g, ' ').trim();
  return combined.slice(0, 300);
}

export class KeywordLotteryDetector implements LotteryDetector {
  detect(page: PageContent, options?: DetectorOptions): LotteryDetection {
    const excludeKeywords = options?.excludeKeywords ?? [];
    const fullText = [page.title, ...page.headings, page.body, ...page.linkTexts].join('\n');

    const excludeMatch = excludeKeywords.find((k) => fullText.includes(k));
    const isExcludedByKeyword = Boolean(excludeMatch);

    const { score, positiveMatches, negativeMatches } = scoreLotteryContent({
      title: page.title,
      headings: page.headings,
      linkTexts: page.linkTexts,
      body: page.body,
    });

    const hasProduct = /ポケモンカード|ポケカ|pokemon|pokémon/i.test(fullText)
      || positiveMatches.some((k) => ['ポケモンカード', 'ポケカ'].includes(k));
    const titleHeadingText = [page.title, ...page.headings].join('\n');
    const hasStrongInTitleArea = /抽選|応募|予約|当選|購入権|応募期間|抽選販売/.test(titleHeadingText);
    const hasProductInTitleArea = /ポケモンカード|ポケカ/i.test(titleHeadingText);

    const hasSale = positiveMatches.some((k) =>
      ['抽選', '抽選販売', '応募', '応募期間', '予約', '販売方法', '入荷', '再入荷', '新商品'].includes(k)
    );
    const hasStrongSale = positiveMatches.some((k) =>
      ['抽選', '抽選販売', '応募', '応募期間', '予約', '当選発表'].includes(k)
    ) || hasStrongInTitleArea;

    const hasApplicationForm = /応募(?:フォーム|はこちら|する)|申込|エントリー|応募ページ/i.test(fullText)
      || page.linkTexts.some((t) => /応募|申込|エントリー/i.test(t));

    const isCandidate =
      (score >= 40 && (hasStrongInTitleArea || hasProductInTitleArea))
      || (score >= 55)
      || (hasProduct && hasStrongSale && hasStrongInTitleArea)
      || (hasProduct && hasApplicationForm && hasStrongInTitleArea);

    const classification = classifyScore(score);
    let confidence = score;
    if (hasApplicationForm) confidence = Math.min(100, confidence + 5);
    if (negativeMatches.length > 0) confidence = Math.max(0, confidence - negativeMatches.length * 3);

    const isExcluded = isExcludedByKeyword || classification === 'excluded_candidate';

    return {
      isCandidate,
      confidence,
      classification,
      positiveMatches,
      negativeMatches,
      excerpt: buildExcerpt(fullText, positiveMatches, page.title),
      isExcludedByKeyword,
      excludeReason: excludeMatch ?? (classification === 'excluded_candidate' ? '低スコア（対象外候補）' : null),
      hasApplicationForm,
    };
  }
}

export const defaultLotteryDetector: LotteryDetector = new KeywordLotteryDetector();

/** @deprecated Use KeywordLotteryDetector via defaultLotteryDetector */
export function detectLotteryInfo(page: PageContent, options?: DetectorOptions): LotteryDetection {
  return defaultLotteryDetector.detect(page, options);
}

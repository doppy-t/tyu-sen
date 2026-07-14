/** 加点キーワード（長い語句を先にマッチさせるため降順で走査） */
export const POSITIVE_KEYWORD_SCORES: [string, number][] = [
  ['抽選販売', 25],
  ['応募期間', 22],
  ['当選発表', 18],
  ['購入期間', 15],
  ['販売方法', 14],
  ['ポケモンカード', 15],
  ['ポケカ', 12],
  ['抽選', 20],
  ['応募', 18],
  ['予約', 15],
  ['新商品', 10],
  ['再入荷', 12],
  ['入荷', 10],
];

/** 減点キーワード */
export const NEGATIVE_KEYWORD_SCORES: [string, number][] = [
  ['買取価格', -20],
  ['デッキレシピ', -20],
  ['シングルカード', -15],
  ['大会', -15],
  ['オリパ', -25],
  ['買取', -15],
  ['相場', -18],
  ['開封', -12],
];

const LOCATION_WEIGHTS = {
  title: 1.5,
  headings: 1.3,
  linkTexts: 1.2,
  body: 1.0,
} as const;

export interface ScoreResult {
  score: number;
  positiveMatches: string[];
  negativeMatches: string[];
}

function countKeywordMatches(text: string, keywords: [string, number][]): { score: number; matched: string[] } {
  let score = 0;
  const matched: string[] = [];
  const lower = text.toLowerCase();

  for (const [keyword, points] of keywords) {
    if (text.includes(keyword) || lower.includes(keyword.toLowerCase())) {
      score += points;
      matched.push(keyword);
    }
  }

  return { score, matched };
}

export function scoreLotteryContent(sections: {
  title: string;
  headings: string[];
  linkTexts: string[];
  body: string;
}): ScoreResult {
  let totalScore = 0;
  const positiveMatches = new Set<string>();
  const negativeMatches = new Set<string>();

  const titleResult = countKeywordMatches(sections.title, POSITIVE_KEYWORD_SCORES);
  totalScore += titleResult.score * LOCATION_WEIGHTS.title;
  titleResult.matched.forEach((m) => positiveMatches.add(m));

  for (const heading of sections.headings) {
    const r = countKeywordMatches(heading, POSITIVE_KEYWORD_SCORES);
    totalScore += r.score * LOCATION_WEIGHTS.headings;
    r.matched.forEach((m) => positiveMatches.add(m));
  }

  for (const linkText of sections.linkTexts) {
    const r = countKeywordMatches(linkText, POSITIVE_KEYWORD_SCORES);
    totalScore += r.score * LOCATION_WEIGHTS.linkTexts;
    r.matched.forEach((m) => positiveMatches.add(m));
  }

  const bodyResult = countKeywordMatches(sections.body.slice(0, 8000), POSITIVE_KEYWORD_SCORES);
  totalScore += bodyResult.score * LOCATION_WEIGHTS.body;
  bodyResult.matched.forEach((m) => positiveMatches.add(m));

  const allText = [sections.title, ...sections.headings, sections.body, ...sections.linkTexts].join('\n');
  const negResult = countKeywordMatches(allText, NEGATIVE_KEYWORD_SCORES);
  totalScore += negResult.score;
  negResult.matched.forEach((m) => negativeMatches.add(m));

  if (/ポケモン|pokemon|pokémon/i.test(allText) && positiveMatches.size > 0) {
    totalScore += 5;
  }

  if (/応募(?:フォーム|はこちら|する)|申込|エントリー/i.test(allText)) {
    totalScore += 8;
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(totalScore))),
    positiveMatches: Array.from(positiveMatches),
    negativeMatches: Array.from(negativeMatches),
  };
}

export function classifyScore(score: number): 'high' | 'review' | 'excluded_candidate' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'review';
  return 'excluded_candidate';
}

export function scoreToStatus(classification: 'high' | 'review' | 'excluded_candidate'): 'unconfirmed' | 'needs_review' {
  return classification === 'high' ? 'unconfirmed' : 'needs_review';
}

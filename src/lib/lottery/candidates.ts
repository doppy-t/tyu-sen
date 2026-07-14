import type { FetchedPage, PageCandidate } from './types';

export type { FetchedPage, PageCandidate };

const LOTTERY_LINK_PATTERN = /抽選|応募|予約|当選|購入権|応募期間|抽選販売/i;
const LOTTERY_HEADING_PATTERN = /抽選|応募|予約|当選|購入権|応募期間|抽選販売|ポケカ|ポケモンカード.*(?:抽選|応募|販売)/i;

function resolveUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return baseUrl;
  }
}

function extractContextSnippet(body: string, keyword: string, radius = 200): string {
  const idx = body.indexOf(keyword);
  if (idx < 0) return body.slice(0, 500);
  const start = Math.max(0, idx - radius);
  const end = Math.min(body.length, idx + keyword.length + radius);
  return body.slice(start, end);
}

function dedupeCandidates(candidates: PageCandidate[]): PageCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = `${c.sourceUrl}::${c.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function extractPageCandidates(page: FetchedPage, baseUrl: string): PageCandidate[] {
  const candidates: PageCandidate[] = [{
    title: page.title,
    body: page.body,
    headings: page.headings,
    linkTexts: page.linkTexts,
    links: page.links,
    sourceUrl: baseUrl,
  }];

  for (const heading of page.headings) {
    if (LOTTERY_HEADING_PATTERN.test(heading)) {
      candidates.push({
        title: heading,
        body: extractContextSnippet(page.body, heading),
        headings: [heading],
        linkTexts: page.linkTexts,
        links: page.links,
        sourceUrl: baseUrl,
      });
    }
  }

  for (const link of page.links) {
    if (!link.text || link.text.length < 4) continue;
    if (!LOTTERY_LINK_PATTERN.test(link.text)) continue;
    const url = resolveUrl(link.href, baseUrl);
    if (url === baseUrl && candidates.some((c) => c.title === link.text)) continue;

    candidates.push({
      title: link.text,
      body: extractContextSnippet(page.body, link.text) || page.body.slice(0, 1500),
      headings: page.headings,
      linkTexts: page.linkTexts,
      links: page.links,
      sourceUrl: url,
    });
  }

  return dedupeCandidates(candidates).slice(0, 20);
}

/**
 * 抽選判定パイプラインのローカルテスト（DB不要）
 * 実行: npx tsx scripts/test-lottery-pipeline.ts [url]
 */
import { fetchPage } from '../src/lib/crawler';
import { extractPageCandidates, defaultLotteryDetector, defaultLotteryExtractor } from '../src/lib/lottery';

const testUrl = process.argv[2] || 'https://www.pokemon.co.jp/ex/article/';

async function main() {
  console.log('Fetching:', testUrl);
  const page = await fetchPage(testUrl);
  console.log('HTTP:', page.httpStatus, 'Title:', page.title.slice(0, 80));

  const candidates = extractPageCandidates(page, testUrl);
  console.log('Candidates:', candidates.length);

  for (const candidate of candidates.slice(0, 5)) {
    const pageContent = {
      title: candidate.title,
      body: candidate.body,
      headings: candidate.headings,
      linkTexts: candidate.linkTexts,
      links: candidate.links,
      sourceUrl: candidate.sourceUrl,
    };

    const detection = defaultLotteryDetector.detect(pageContent);
    if (!detection.isCandidate) continue;

    const extracted = defaultLotteryExtractor.extract(pageContent, detection, {
      storeName: 'テスト店舗',
      sourceType: 'official',
      region: 'nationwide',
    });

    console.log('\n--- Match ---');
    console.log('Title:', extracted.title);
    console.log('Score:', extracted.confidence, 'Class:', detection.classification);
    console.log('Product:', extracted.productName);
    console.log('Deadline:', extracted.applicationDeadline);
    console.log('Excluded:', extracted.isExcluded);
    console.log('Positive KW:', detection.positiveMatches.join(', '));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { parse, isValid } from 'date-fns';
import { ja } from 'date-fns/locale';

const DATE_PATTERNS = [
  'yyyy年M月d日 H:mm',
  'yyyy年M月d日HH:mm',
  'yyyy年M月d日',
  'yyyy/M/d H:mm',
  'yyyy/M/d',
  'yyyy-MM-dd HH:mm',
  'yyyy-MM-dd',
  'M月d日 H:mm',
  'M月d日',
];

const LABEL_PATTERNS: { label: RegExp; group: number }[] = [
  { label: /応募(?:開始|受付開始)[：:\s]*([^\n。、]+)/i, group: 1 },
  { label: /応募締切[：:\s]*([^\n。、]+)/i, group: 1 },
  { label: /締切(?:日|日時)?[：:\s]*([^\n。、]+)/i, group: 1 },
  { label: /当選(?:発表|通知)(?:日|日時)?[：:\s]*([^\n。、]+)/i, group: 1 },
  { label: /購入期間[：:\s]*([^\n。、]+)/i, group: 1 },
  { label: /販売期間[：:\s]*([^\n。、]+)/i, group: 1 },
];

function tryParseDate(text: string): string | null {
  const trimmed = text.trim().replace(/まで|から|頃/g, '').trim();
  for (const pattern of DATE_PATTERNS) {
    const parsed = parse(trimmed, pattern, new Date(), { locale: ja });
    if (isValid(parsed)) {
      return parsed.toISOString();
    }
  }
  const isoMatch = trimmed.match(/\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2})?/);
  if (isoMatch) {
    const d = new Date(isoMatch[0]);
    if (isValid(d)) return d.toISOString();
  }
  return null;
}

export interface ParsedDates {
  application_start: string | null;
  application_deadline: string | null;
  lottery_result_date: string | null;
  purchase_period: string | null;
}

export function extractDates(text: string): ParsedDates {
  const result: ParsedDates = {
    application_start: null,
    application_deadline: null,
    lottery_result_date: null,
    purchase_period: null,
  };

  const startMatch = text.match(/応募(?:開始|受付開始)[：:\s]*([^\n。]+)/i);
  if (startMatch) result.application_start = tryParseDate(startMatch[1]) ?? startMatch[1].trim();

  const deadlineMatch = text.match(/(?:応募)?締切(?:日|日時)?[：:\s]*([^\n。]+)/i);
  if (deadlineMatch) result.application_deadline = tryParseDate(deadlineMatch[1]) ?? deadlineMatch[1].trim();

  const resultMatch = text.match(/当選(?:発表|通知)(?:日|日時)?[：:\s]*([^\n。]+)/i);
  if (resultMatch) result.lottery_result_date = tryParseDate(resultMatch[1]) ?? resultMatch[1].trim();

  const purchaseMatch = text.match(/(?:購入|販売)期間[：:\s]*([^\n。]+)/i);
  if (purchaseMatch) result.purchase_period = purchaseMatch[1].trim();

  for (const { label, group } of LABEL_PATTERNS) {
    const m = text.match(label);
    if (m && m[group]) {
      const val = m[group].trim();
      if (/応募(?:開始|受付開始)/i.test(label.source)) {
        if (!result.application_start) result.application_start = tryParseDate(val) ?? val;
      } else if (/締切/i.test(label.source)) {
        if (!result.application_deadline) result.application_deadline = tryParseDate(val) ?? val;
      } else if (/当選/i.test(label.source)) {
        if (!result.lottery_result_date) result.lottery_result_date = tryParseDate(val) ?? val;
      } else if (/購入|販売/i.test(label.source)) {
        if (!result.purchase_period) result.purchase_period = val;
      }
    }
  }

  return result;
}

export function extractProductName(text: string, title: string): string {
  const patterns = [
    /(?:拡張パック|強化拡張パック|ハイクラスパック|スターターセット|スペシャルセット)[「『]?([^」』\n]+)[」』]?/,
    /ポケモンカードゲーム[^\n]*?([A-Z]+[^\n]{2,40})/i,
    /(?:商品名|対象商品)[：:\s]*([^\n。]+)/,
    /「([^」]+)」.*(?:抽選|応募|販売)/,
  ];

  for (const p of patterns) {
    const m = (title + '\n' + text).match(p);
    if (m && m[1]) return m[1].trim().slice(0, 100);
  }

  const productKw = ['拡張パック', '強化拡張パック', 'ハイクラスパック', 'スターターセット', 'スペシャルセット', 'BOX', 'ボックス'];
  for (const kw of productKw) {
    if (title.includes(kw) || text.includes(kw)) return kw;
  }

  return '不明';
}

export function extractConditions(text: string): string | null {
  const m = text.match(/(?:応募条件|参加条件|対象者)[：:\s]*([^\n]+)/);
  return m ? m[1].trim() : null;
}

export function detectChannel(text: string): 'online' | 'store' | 'unknown' {
  if (/オンライン(?:限定|販売|抽選)|EC|通販/i.test(text)) return 'online';
  if (/店頭|店舗(?:限定|販売)|実店舗/i.test(text)) return 'store';
  return 'unknown';
}

export function formatDisplayDate(value: string | null): string {
  if (!value) return '不明';
  try {
    const d = new Date(value);
    if (isValid(d) && !isNaN(d.getTime())) {
      return d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    }
  } catch {
    // not ISO
  }
  return value;
}

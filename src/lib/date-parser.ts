import { parse, isValid, setHours, setMinutes } from 'date-fns';
import { ja } from 'date-fns/locale';

const DATE_PATTERNS = [
  'yyyy年M月d日 H:mm',
  'yyyy年M月d日HH:mm',
  'yyyy年M月d日 H時mm分',
  'yyyy年M月d日',
  'yyyy/M/d H:mm',
  'yyyy/M/d',
  'yyyy-MM-dd HH:mm',
  'yyyy-MM-dd',
  'M月d日 H:mm',
  'M月d日H時',
  'M月d日 H時mm分',
  'M月d日',
];

function inferYear(month: number, day: number): number {
  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, month - 1, day);
  const diffDays = (now.getTime() - candidate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > 60) year += 1;
  return year;
}

function buildDateWithInferredYear(month: number, day: number, hour = 0, minute = 0): string | null {
  const year = inferYear(month, day);
  const d = new Date(year, month - 1, day, hour, minute);
  if (!isValid(d)) return null;
  return d.toISOString();
}

function tryParseDate(text: string): string | null {
  const trimmed = text.trim().replace(/[（）()]/g, '').replace(/まで|から|頃|迄/g, '').trim();

  if (/本日|今日/.test(text)) {
    const now = new Date();
    const timeMatch = text.match(/(\d{1,2})[:：時](\d{1,2})?/);
    if (timeMatch) {
      return setMinutes(setHours(now, parseInt(timeMatch[1], 10)), timeMatch[2] ? parseInt(timeMatch[2], 10) : 0).toISOString();
    }
    return now.toISOString();
  }

  const inlineRange = text.match(
    /(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2})[:：時](\d{1,2})?分?)?\s*から\s*(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2})[:：時](\d{1,2})?分?)?\s*まで/
  );
  if (inlineRange) {
    const endMonth = parseInt(inlineRange[5], 10);
    const endDay = parseInt(inlineRange[6], 10);
    const endHour = inlineRange[7] ? parseInt(inlineRange[7], 10) : 23;
    const endMinute = inlineRange[8] ? parseInt(inlineRange[8], 10) : 59;
    return buildDateWithInferredYear(endMonth, endDay, endHour, endMinute);
  }

  const slashRange = trimmed.match(
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s*[〜～\-－]\s*(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/
  );
  if (slashRange) {
    const end = new Date(parseInt(slashRange[4], 10), parseInt(slashRange[5], 10) - 1, parseInt(slashRange[6], 10), 23, 59);
    if (isValid(end)) return end.toISOString();
  }

  const untilOnly = text.match(/(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2})[:：時](\d{1,2})?分?)?\s*まで/);
  if (untilOnly) {
    const month = parseInt(untilOnly[1], 10);
    const day = parseInt(untilOnly[2], 10);
    const hour = untilOnly[3] ? parseInt(untilOnly[3], 10) : 23;
    const minute = untilOnly[4] ? parseInt(untilOnly[4], 10) : 59;
    return buildDateWithInferredYear(month, day, hour, minute);
  }

  for (const pattern of DATE_PATTERNS) {
    const parsed = parse(trimmed, pattern, new Date(), { locale: ja });
    if (isValid(parsed)) {
      if (!/\d{4}/.test(trimmed)) {
        return buildDateWithInferredYear(
          parsed.getMonth() + 1,
          parsed.getDate(),
          parsed.getHours(),
          parsed.getMinutes()
        );
      }
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

  const inlineRange = text.match(
    /(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2})[:：時](\d{1,2})?分?)?\s*から\s*(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2})[:：時](\d{1,2})?分?)?\s*まで/
  );
  if (inlineRange) {
    const startRaw = `${inlineRange[1]}月${inlineRange[2]}日${inlineRange[3] ? ` ${inlineRange[3]}時${inlineRange[4] || '00'}分` : ''}`;
    const endRaw = `${inlineRange[5]}月${inlineRange[6]}日${inlineRange[7] ? ` ${inlineRange[7]}時${inlineRange[8] || '59'}分` : ' 23時59分'}まで`;
    result.application_start = tryParseDate(startRaw) ?? startRaw;
    result.application_deadline = tryParseDate(endRaw) ?? endRaw;
  }

  const startMatch = text.match(/応募(?:開始|受付開始|期間)[：:\s]*([^\n。]+)/i);
  if (startMatch && !result.application_start) {
    const raw = startMatch[1].trim();
    result.application_start = tryParseDate(raw) ?? raw;
  }

  const deadlineMatch = text.match(/(?:応募)?締切(?:日|日時)?[：:\s]*([^\n。]+)/i);
  if (deadlineMatch && !result.application_deadline) {
    const raw = deadlineMatch[1].trim();
    result.application_deadline = tryParseDate(raw) ?? raw;
  }

  if (!result.application_deadline) {
    const untilMatch = text.match(/(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2})[:：時](\d{1,2})?分?)?\s*まで/);
    if (untilMatch) {
      const raw = untilMatch[0];
      result.application_deadline = tryParseDate(raw) ?? raw;
    }
  }

  if (/本日.*まで|今日.*まで/.test(text) && !result.application_deadline) {
    const todayMatch = text.match(/(本日|今日)[^\n。]*まで/);
    if (todayMatch) result.application_deadline = tryParseDate(todayMatch[0]) ?? todayMatch[0];
  }

  const resultMatch = text.match(/当選(?:発表|通知)(?:日|日時)?[：:\s]*([^\n。]+)/i);
  if (resultMatch) {
    result.lottery_result_date = tryParseDate(resultMatch[1]) ?? resultMatch[1].trim();
  }

  const purchaseMatch = text.match(/(?:購入|販売)期間[：:\s]*([^\n。]+)/i);
  if (purchaseMatch) {
    result.purchase_period = purchaseMatch[1].trim();
  }

  return result;
}

const PRODUCT_KEYWORDS = [
  '拡張パック', '強化拡張パック', 'ハイクラスパック', 'スペシャルセット',
  'スターターセット', 'BOX', 'ボックス',
];

export function extractProductName(text: string, title: string): string {
  const combined = `${title}\n${text}`;

  for (const kw of PRODUCT_KEYWORDS) {
    const named = combined.match(new RegExp(`${kw}[「『\\s]*([^」』\\n、。]{2,40})[」』]?`));
    if (named?.[1]) {
      const name = named[1].trim();
      if (!/すべて|一覧|カテゴリ|検索/.test(name)) {
        return `${name} ${kw}`.slice(0, 80);
      }
    }
    if ((title.includes(kw) || text.slice(0, 2000).includes(kw)) && !/すべて/.test(title)) return kw;
  }

  const patterns = [
    /(?:商品名|対象商品)[：:\s]*([^\n。]+)/,
    /「([^」]+)」.*(?:抽選|応募|販売)/,
  ];

  for (const p of patterns) {
    const m = combined.match(p);
    if (m?.[1]) return m[1].trim().slice(0, 100);
  }

  return '不明';
}

export function extractConditions(text: string): string | null {
  const m = text.match(/(?:応募条件|参加条件|対象者|応募資格)[：:\s]*([^\n。]+)/);
  return m ? m[1].trim() : null;
}

export function extractPurchasePeriod(text: string): string | null {
  const m = text.match(/(?:購入|販売)期間[：:\s]*([^\n。]+)/i);
  return m ? m[1].trim() : null;
}

export function extractApplicationUrl(
  links: { href: string; text: string }[],
  baseUrl: string
): string | null {
  for (const link of links) {
    if (/応募|申込|エントリー|抽選.*(?:はこちら|フォーム|ページ)/i.test(link.text)) {
      try {
        return new URL(link.href, baseUrl).href;
      } catch {
        continue;
      }
    }
  }
  return null;
}

export function detectChannel(text: string): 'online' | 'store' | 'unknown' {
  if (/オンライン(?:限定|販売|抽選)|EC|通販|ウェブ/i.test(text)) return 'online';
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

export function formatDisplayValue(value: string | null | undefined): string {
  if (!value || !value.trim()) return '不明';
  return value;
}

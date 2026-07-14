export type SourceType = 'official' | 'x' | 'lottery_site' | 'other';
export type Region = 'nationwide' | 'hokkaido' | 'online' | 'other';
export type ListingStatus =
  | 'unconfirmed'
  | 'needs_review'
  | 'planned'
  | 'applied'
  | 'won'
  | 'lost'
  | 'excluded'
  | 'expired';
export type ChannelType = 'online' | 'store' | 'unknown';
export type NotificationType =
  | 'new_listing'
  | 'deadline_24h'
  | 'deadline_3h'
  | 'planned_not_applied';

export interface MonitorSite {
  id: number;
  name: string;
  url: string | null;
  source_type: SourceType;
  frequency_minutes: number;
  enabled: boolean;
  region: Region;
  memo: string;
  created_at: string;
  updated_at: string;
}

export interface Listing {
  id: number;
  monitor_site_id: number | null;
  store_name: string;
  product_name: string;
  title: string;
  application_start: string | null;
  application_deadline: string | null;
  lottery_result_date: string | null;
  purchase_period: string | null;
  conditions: string | null;
  region: Region;
  channel: ChannelType;
  source_url: string;
  detected_at: string;
  last_checked_at: string;
  source_type: SourceType;
  confidence: number;
  excerpt: string;
  status: ListingStatus;
  is_excluded: boolean;
  similar_group_id: string | null;
  has_similar: boolean;
  is_manual: boolean;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrawlLog {
  id: number;
  monitor_site_id: number | null;
  started_at: string;
  ended_at: string | null;
  url: string;
  http_status: number | null;
  detected_count: number;
  error_message: string | null;
  last_success_at: string | null;
}

export interface Notification {
  id: number;
  type: NotificationType;
  listing_id: number | null;
  message: string;
  read: boolean;
  created_at: string;
}

export interface AppSettings {
  detect_keywords: string[];
  exclude_keywords: string[];
  min_confidence: number;
  retention_days: number;
  default_region: Region;
  crawl_interval_minutes: number;
  notifications_enabled: boolean;
  show_excluded: boolean;
}

export const DEFAULT_DETECT_KEYWORDS = [
  'ポケモンカード', 'ポケカ', 'Pokémon Card', 'Pokémon', 'Pokemon Card',
  '新弾', '拡張パック', '強化拡張パック', 'BOX', 'ボックス', 'パック',
  'スターターセット', 'デッキ', 'スペシャルセット', 'ハイクラスパック',
  '抽選', '抽選販売', '事前抽選', '応募', '応募受付', '予約', '予約受付',
  '購入権', '当選', '販売方法', '販売について', '入荷', '再入荷',
  '店頭販売', 'オンライン販売', '購入希望者', '新商品', '販売案内',
];

export const DEFAULT_EXCLUDE_KEYWORDS = [
  '買取', '買取価格', '中古', 'シングルカード', 'オリパ', 'デッキレシピ',
  '大会結果', '対戦動画', '相場', '高騰', 'PSA', '開封結果',
];

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  official: '公式サイト',
  x: 'X',
  lottery_site: '抽選情報サイト',
  other: 'その他',
};

export const REGION_LABELS: Record<Region, string> = {
  nationwide: '全国',
  hokkaido: '北海道',
  online: 'オンライン',
  other: 'その他',
};

export const STATUS_LABELS: Record<ListingStatus, string> = {
  unconfirmed: '未確認',
  needs_review: '要確認',
  planned: '応募予定',
  applied: '応募済み',
  won: '当選',
  lost: '落選',
  excluded: '対象外',
  expired: '期限切れ',
};

export const CHANNEL_LABELS: Record<ChannelType, string> = {
  online: 'オンライン',
  store: '店舗限定',
  unknown: '不明',
};

export const SAMPLE_STORES: Omit<MonitorSite, 'id' | 'created_at' | 'updated_at'>[] = [
  { name: 'ポケモンセンターオンライン', url: null, source_type: 'official', frequency_minutes: 60, enabled: false, region: 'online', memo: 'URLは設定画面から登録してください' },
  { name: 'ふるいち、古本市場', url: null, source_type: 'official', frequency_minutes: 120, enabled: false, region: 'nationwide', memo: 'URLは設定画面から登録してください' },
  { name: 'GEO', url: null, source_type: 'official', frequency_minutes: 120, enabled: false, region: 'nationwide', memo: 'URLは設定画面から登録してください' },
  { name: 'TSUTAYA', url: null, source_type: 'official', frequency_minutes: 120, enabled: false, region: 'nationwide', memo: 'URLは設定画面から登録してください' },
  { name: 'イオン', url: null, source_type: 'official', frequency_minutes: 120, enabled: false, region: 'nationwide', memo: 'URLは設定画面から登録してください' },
  { name: 'イオン北海道', url: null, source_type: 'official', frequency_minutes: 120, enabled: false, region: 'hokkaido', memo: 'URLは設定画面から登録してください' },
  { name: 'ヨドバシカメラ', url: null, source_type: 'official', frequency_minutes: 120, enabled: false, region: 'nationwide', memo: 'URLは設定画面から登録してください' },
  { name: 'ビックカメラ', url: null, source_type: 'official', frequency_minutes: 120, enabled: false, region: 'nationwide', memo: 'URLは設定画面から登録してください' },
  { name: 'Joshin', url: null, source_type: 'official', frequency_minutes: 120, enabled: false, region: 'nationwide', memo: 'URLは設定画面から登録してください' },
  { name: 'エディオン', url: null, source_type: 'official', frequency_minutes: 120, enabled: false, region: 'nationwide', memo: 'URLは設定画面から登録してください' },
  { name: 'ヤマダデンキ', url: null, source_type: 'official', frequency_minutes: 120, enabled: false, region: 'nationwide', memo: 'URLは設定画面から登録してください' },
  { name: 'トイザらス', url: null, source_type: 'official', frequency_minutes: 120, enabled: false, region: 'nationwide', memo: 'URLは設定画面から登録してください' },
  { name: 'Amazon', url: null, source_type: 'official', frequency_minutes: 180, enabled: false, region: 'online', memo: 'URLは設定画面から登録してください' },
  { name: '楽天ブックス', url: null, source_type: 'official', frequency_minutes: 180, enabled: false, region: 'online', memo: 'URLは設定画面から登録してください' },
  { name: 'セブンネット', url: null, source_type: 'official', frequency_minutes: 120, enabled: false, region: 'online', memo: 'URLは設定画面から登録してください' },
  { name: '抽選情報まとめサイト', url: null, source_type: 'lottery_site', frequency_minutes: 60, enabled: false, region: 'nationwide', memo: 'URLは設定画面から登録してください' },
];

export interface DashboardStats {
  new_count: number;
  unconfirmed_count: number;
  today_deadline_count: number;
  three_day_deadline_count: number;
  applied_count: number;
  monitor_count: number;
  last_crawl_at: string | null;
  crawl_error_count: number;
}

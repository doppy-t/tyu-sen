'use client';

import { useEffect, useState } from 'react';
import type { DashboardStats } from '@/lib/types-dashboard';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [crawling, setCrawling] = useState(false);
  const [crawlResult, setCrawlResult] = useState<string | null>(null);

  async function loadStats() {
    const res = await fetch('/api/dashboard');
    const data = await res.json();
    setStats(data);
  }

  useEffect(() => { loadStats(); }, []);

  async function handleCrawlAll() {
    setCrawling(true);
    setCrawlResult(null);
    try {
      const res = await fetch('/api/crawl', { method: 'POST' });
      const data = await res.json();
      setCrawlResult(`${data.total ?? 0}サイトを巡回、${data.errors ?? 0}件のエラー`);
      await loadStats();
    } catch (e) {
      setCrawlResult(`エラー: ${e}`);
    } finally {
      setCrawling(false);
    }
  }

  if (!stats) return <div className="page-title">読み込み中...</div>;

  const statItems = [
    { label: '新着（24時間）', value: stats.new_count },
    { label: '未確認', value: stats.unconfirmed_count },
    { label: '本日締切', value: stats.today_deadline_count },
    { label: '3日以内締切', value: stats.three_day_deadline_count },
    { label: '応募済み', value: stats.applied_count },
    { label: '監視サイト数', value: stats.monitor_count },
    { label: '巡回エラー（7日）', value: stats.crawl_error_count },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h1 className="page-title" style={{ marginBottom: 0 }}>ダッシュボード</h1>
        <button className="btn btn-primary" onClick={handleCrawlAll} disabled={crawling}>
          {crawling ? '巡回中...' : '全サイトを今すぐ巡回'}
        </button>
      </div>

      {crawlResult && <div className="alert alert-info">{crawlResult}</div>}

      <div className="alert alert-warning mb-2">
        初回利用時は「監視サイト管理」から各店舗のURLを登録し、有効化してください。URL未設定のサイトは巡回されません。
      </div>

      <div className="card-grid">
        {statItems.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="value">{s.value}</div>
            <div className="label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="mb-2">最終巡回時刻</h3>
        <p>{stats.last_crawl_at ? new Date(stats.last_crawl_at).toLocaleString('ja-JP') : 'まだ巡回されていません'}</p>
      </div>
    </div>
  );
}

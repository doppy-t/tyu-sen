'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MonitorSite, SourceType, Region } from '@/lib/types';
import { SOURCE_TYPE_LABELS, REGION_LABELS } from '@/lib/types';

interface CrawlLog {
  id: number;
  started_at: string;
  ended_at: string | null;
  url: string;
  http_status: number | null;
  detected_count: number;
  error_message: string | null;
}

export default function MonitorsPage() {
  const [sites, setSites] = useState<MonitorSite[]>([]);
  const [logs, setLogs] = useState<CrawlLog[]>([]);
  const [editing, setEditing] = useState<MonitorSite | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [crawlingId, setCrawlingId] = useState<number | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);

  const [form, setForm] = useState({
    name: '',
    url: '',
    source_type: 'official' as SourceType,
    frequency_minutes: 60,
    enabled: true,
    region: 'nationwide' as Region,
    memo: '',
  });

  const loadSites = useCallback(async () => {
    const res = await fetch('/api/monitors');
    const data = await res.json();
    setSites(Array.isArray(data) ? data : []);
  }, []);

  const loadLogs = useCallback(async (siteId?: number) => {
    const url = siteId ? `/api/crawl?site_id=${siteId}` : '/api/crawl';
    const res = await fetch(url);
    const data = await res.json();
    setLogs(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { loadSites(); loadLogs(); }, [loadSites, loadLogs]);

  function resetForm() {
    setForm({ name: '', url: '', source_type: 'official', frequency_minutes: 60, enabled: true, region: 'nationwide', memo: '' });
    setEditing(null);
    setShowForm(false);
  }

  function startEdit(site: MonitorSite) {
    setEditing(site);
    setForm({
      name: site.name,
      url: site.url ?? '',
      source_type: site.source_type,
      frequency_minutes: site.frequency_minutes,
      enabled: site.enabled,
      region: site.region,
      memo: site.memo,
    });
    setShowForm(true);
  }

  async function handleSave() {
    const payload = { ...form, url: form.url || null };
    if (editing) {
      await fetch(`/api/monitors/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch('/api/monitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    resetForm();
    await loadSites();
  }

  async function handleDelete(id: number) {
    if (!confirm('この監視サイトを削除しますか？')) return;
    await fetch(`/api/monitors/${id}`, { method: 'DELETE' });
    await loadSites();
  }

  async function handleToggle(site: MonitorSite) {
    await fetch(`/api/monitors/${site.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !site.enabled }),
    });
    await loadSites();
  }

  async function handleCrawl(id: number) {
    setCrawlingId(id);
    try {
      const res = await fetch(`/api/monitors/${id}/crawl`, { method: 'POST' });
      const data = await res.json();
      alert(data.error ? `エラー: ${data.error}` : `${data.detectedCount}件を検出`);
      await loadLogs(id);
    } finally {
      setCrawlingId(null);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h1 className="page-title" style={{ marginBottom: 0 }}>監視サイト管理</h1>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>新規追加</button>
      </div>

      {showForm && (
        <div className="card mb-2">
          <h3 className="mb-2">{editing ? '監視サイトを編集' : '監視サイトを追加'}</h3>
          <div className="form-group">
            <label>店舗名・サービス名</label>
            <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>監視対象URL（未設定の場合は空欄）</label>
            <input className="form-control" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
          </div>
          <div className="form-group">
            <label>情報源の種類</label>
            <select className="form-control" value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value as SourceType })}>
              {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>監視頻度（分）</label>
            <input className="form-control" type="number" value={form.frequency_minutes} onChange={(e) => setForm({ ...form, frequency_minutes: parseInt(e.target.value) || 60 })} />
          </div>
          <div className="form-group">
            <label>対象地域</label>
            <select className="form-control" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value as Region })}>
              {Object.entries(REGION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>メモ</label>
            <textarea className="form-control" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
          </div>
          <label className="flex items-center gap-1 mb-2">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> 有効
          </label>
          <div className="flex gap-1">
            <button className="btn btn-primary" onClick={handleSave} disabled={!form.name}>保存</button>
            <button className="btn btn-secondary" onClick={resetForm}>キャンセル</button>
          </div>
        </div>
      )}

      <div className="table-wrap mb-2">
        <table>
          <thead>
            <tr>
              <th>店舗名</th>
              <th>URL</th>
              <th>種類</th>
              <th>頻度</th>
              <th>地域</th>
              <th>状態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td className="text-sm">{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.url.slice(0, 40)}...</a> : <span className="text-muted">未設定</span>}</td>
                <td>{SOURCE_TYPE_LABELS[s.source_type]}</td>
                <td>{s.frequency_minutes}分</td>
                <td>{REGION_LABELS[s.region]}</td>
                <td>{s.enabled ? <span className="badge badge-planned">有効</span> : <span className="badge badge-excluded">無効</span>}</td>
                <td>
                  <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => startEdit(s)}>編集</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleToggle(s)}>{s.enabled ? '無効化' : '有効化'}</button>
                    <button className="btn btn-sm btn-primary" onClick={() => handleCrawl(s.id)} disabled={crawlingId === s.id || !s.url}>
                      {crawlingId === s.id ? '巡回中' : '今すぐ巡回'}
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={() => { setSelectedSiteId(s.id); loadLogs(s.id); }}>履歴</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id)}>削除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 className="mb-2">巡回履歴 {selectedSiteId ? `（サイトID: ${selectedSiteId}）` : '（全体）'}</h3>
        {logs.length === 0 ? (
          <p className="text-muted">巡回履歴はありません</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>開始</th>
                  <th>終了</th>
                  <th>URL</th>
                  <th>HTTP</th>
                  <th>検出</th>
                  <th>エラー</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="text-sm">{new Date(l.started_at).toLocaleString('ja-JP')}</td>
                    <td className="text-sm">{l.ended_at ? new Date(l.ended_at).toLocaleString('ja-JP') : '-'}</td>
                    <td className="text-sm">{l.url.slice(0, 50)}</td>
                    <td>{l.http_status ?? '-'}</td>
                    <td>{l.detected_count}</td>
                    <td className="text-sm" style={{ color: l.error_message ? 'var(--danger)' : 'inherit' }}>{l.error_message ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

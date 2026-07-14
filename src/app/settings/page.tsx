'use client';

import { useEffect, useState } from 'react';
import type { AppSettings } from '@/lib/types';
import { DEFAULT_DETECT_KEYWORDS } from '@/lib/types';

interface ExcludeKeyword {
  id: number;
  keyword: string;
  enabled: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [excludeKeywords, setExcludeKeywords] = useState<ExcludeKeyword[]>([]);
  const [detectText, setDetectText] = useState('');
  const [newExclude, setNewExclude] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        setSettings(data.settings);
        setDetectText((data.settings?.detect_keywords ?? DEFAULT_DETECT_KEYWORDS).join('\n'));
        setExcludeKeywords(data.excludeKeywords ?? []);
      });
  }, []);

  async function handleSave() {
    if (!settings) return;
    const updatedSettings: AppSettings = {
      ...settings,
      detect_keywords: detectText.split('\n').map((s) => s.trim()).filter(Boolean),
    };
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: updatedSettings,
        excludeKeywords: excludeKeywords.map((k) => ({
          id: k.id,
          keyword: k.keyword,
          enabled: Boolean(k.enabled),
        })),
      }),
    });
    setSettings(updatedSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function addExcludeKeyword() {
    if (!newExclude.trim()) return;
    setExcludeKeywords([...excludeKeywords, { id: 0, keyword: newExclude.trim(), enabled: 1 }]);
    setNewExclude('');
  }

  if (!settings) return <div className="page-title">読み込み中...</div>;

  return (
    <div>
      <h1 className="page-title">設定</h1>
      {saved && <div className="alert alert-info">保存しました</div>}

      <div className="card mb-2">
        <h3 className="mb-2">検出キーワード（1行1キーワード）</h3>
        <textarea className="form-control" rows={12} value={detectText} onChange={(e) => setDetectText(e.target.value)} />
      </div>

      <div className="card mb-2">
        <h3 className="mb-2">除外キーワード</h3>
        <p className="text-sm text-muted mb-2">除外キーワードに一致する情報は「除外候補」としてマークされます。完全には削除されず、一覧で「除外情報も表示」で確認できます。</p>
        <div className="flex gap-1 mb-2">
          <input className="form-control" value={newExclude} onChange={(e) => setNewExclude(e.target.value)} placeholder="新しい除外キーワード" />
          <button className="btn btn-secondary" onClick={addExcludeKeyword}>追加</button>
        </div>
        {excludeKeywords.map((k, i) => (
          <label key={k.id || i} className="flex items-center gap-1 mb-1">
            <input
              type="checkbox"
              checked={Boolean(k.enabled)}
              onChange={(e) => {
                const updated = [...excludeKeywords];
                updated[i] = { ...k, enabled: e.target.checked ? 1 : 0 };
                setExcludeKeywords(updated);
              }}
            />
            {k.keyword}
          </label>
        ))}
      </div>

      <div className="card mb-2">
        <h3 className="mb-2">通知設定</h3>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={settings.notifications_enabled}
            onChange={(e) => setSettings({ ...settings, notifications_enabled: e.target.checked })}
          />
          アプリ内通知を有効にする
        </label>
        <p className="text-sm text-muted mt-1">将来: Discord、LINE、メール通知は環境変数で設定可能です（.env.example参照）</p>
      </div>

      <div className="card mb-2">
        <h3 className="mb-2">巡回・表示設定</h3>
        <div className="form-group">
          <label>デフォルト巡回間隔（分）</label>
          <input
            className="form-control"
            type="number"
            value={settings.crawl_interval_minutes}
            onChange={(e) => setSettings({ ...settings, crawl_interval_minutes: parseInt(e.target.value) || 30 })}
          />
        </div>
        <div className="form-group">
          <label>信頼度の最低表示値（0-100）</label>
          <input
            className="form-control"
            type="number"
            min={0}
            max={100}
            value={settings.min_confidence}
            onChange={(e) => setSettings({ ...settings, min_confidence: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="form-group">
          <label>過去情報の保存期間（日）</label>
          <input
            className="form-control"
            type="number"
            value={settings.retention_days}
            onChange={(e) => setSettings({ ...settings, retention_days: parseInt(e.target.value) || 90 })}
          />
        </div>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={settings.show_excluded}
            onChange={(e) => setSettings({ ...settings, show_excluded: e.target.checked })}
          />
          デフォルトで除外情報も表示
        </label>
      </div>

      <button className="btn btn-primary" onClick={handleSave}>設定を保存</button>
    </div>
  );
}

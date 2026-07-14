'use client';

import { useEffect, useState } from 'react';
import type { Listing, ListingStatus } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';

interface EditModalProps {
  listing: Listing | null;
  onClose: () => void;
  onSave: (id: number, data: Partial<Listing>) => void;
}

export function EditListingModal({ listing, onClose, onSave }: EditModalProps) {
  const [form, setForm] = useState<Partial<Listing>>({});

  useEffect(() => {
    if (listing) setForm(listing);
  }, [listing]);

  if (!listing) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>情報を編集</h2>
        <div className="form-group">
          <label>タイトル</label>
          <input className="form-control" value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="form-group">
          <label>商品名</label>
          <input className="form-control" value={form.product_name ?? ''} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
        </div>
        <div className="form-group">
          <label>店舗名</label>
          <input className="form-control" value={form.store_name ?? ''} onChange={(e) => setForm({ ...form, store_name: e.target.value })} />
        </div>
        <div className="form-group">
          <label>応募締切</label>
          <input className="form-control" value={form.application_deadline ?? ''} onChange={(e) => setForm({ ...form, application_deadline: e.target.value })} />
        </div>
        <div className="form-group">
          <label>ステータス</label>
          <select className="form-control" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ListingStatus })}>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>抜粋</label>
          <textarea className="form-control" value={form.excerpt ?? ''} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>キャンセル</button>
          <button className="btn btn-primary" onClick={() => { onSave(listing.id, form); onClose(); }}>保存</button>
        </div>
      </div>
    </div>
  );
}

interface SimilarModalProps {
  listing: Listing | null;
  similar: Listing[];
  onClose: () => void;
}

export function SimilarModal({ listing, similar, onClose }: SimilarModalProps) {
  if (!listing) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>類似情報: {listing.title}</h2>
        {similar.length === 0 ? (
          <p className="text-muted">類似情報は見つかりませんでした。</p>
        ) : (
          similar.map((s) => (
            <div key={s.id} className="card mb-2">
              <strong>{s.store_name}</strong> - {s.title}
              <div className="text-sm text-muted">信頼度: {s.confidence}点 / {STATUS_LABELS[s.status]}</div>
              {s.source_url && <a href={s.source_url} target="_blank" rel="noopener noreferrer">元ページ</a>}
            </div>
          ))
        )}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
}

interface ManualAddModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export function ManualAddModal({ open, onClose, onAdded }: ManualAddModalProps) {
  const [url, setUrl] = useState('');
  const [storeName, setStoreName] = useState('');
  const [parsed, setParsed] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  async function handleParse() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/parse-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, store_name: storeName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setParsed(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!parsed) return;
    setLoading(true);
    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) throw new Error('保存に失敗しました');
      setUrl('');
      setStoreName('');
      setParsed(null);
      onAdded();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>手動で抽選情報を追加</h2>
        <div className="form-group">
          <label>URL</label>
          <input className="form-control" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
        </div>
        <div className="form-group">
          <label>店舗名（任意）</label>
          <input className="form-control" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>キャンセル</button>
          <button className="btn btn-primary" onClick={handleParse} disabled={!url || loading}>
            {loading ? '解析中...' : 'URLを解析'}
          </button>
        </div>
        {parsed && (
          <div className="mt-2">
            <h3 className="text-sm mb-2">解析結果</h3>
            <div className="card text-sm">
              <p><strong>タイトル:</strong> {String(parsed.title)}</p>
              <p><strong>商品:</strong> {String(parsed.product_name)}</p>
              <p><strong>信頼度:</strong> {String(parsed.confidence)}点</p>
              <p><strong>検出:</strong> {parsed.detected ? 'あり' : '弱い（要確認）'}</p>
              <p className="text-muted">{String(parsed.excerpt).slice(0, 200)}</p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-success" onClick={handleSave} disabled={loading}>登録する</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

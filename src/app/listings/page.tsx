'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Listing, ListingStatus } from '@/lib/types';
import { ListingCard, ListingTable } from '@/components/ListingViews';
import { EditListingModal, SimilarModal, ManualAddModal } from '@/components/Modals';
import { REGION_LABELS, SOURCE_TYPE_LABELS } from '@/lib/types';

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<Listing | null>(null);
  const [similarTarget, setSimilarTarget] = useState<Listing | null>(null);
  const [similarList, setSimilarList] = useState<Listing[]>([]);
  const [showManualAdd, setShowManualAdd] = useState(false);

  const [filters, setFilters] = useState({
    unconfirmed_only: true,
    applicable_only: false,
    applied_only: false,
    deadline_24h: false,
    deadline_3d: false,
    region: '',
    channel: '',
    source_type: '',
    store: '',
    product: '',
    include_low_confidence: true,
    include_excluded: false,
  });

  const loadListings = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (typeof v === 'boolean' && v) params.set(k, 'true');
      else if (typeof v === 'string' && v) params.set(k, v);
    }
    const res = await fetch(`/api/listings?${params}`);
    const data = await res.json();
    setListings(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [filters]);

  useEffect(() => { loadListings(); }, [loadListings]);

  async function handleStatusChange(id: number, status: ListingStatus) {
    await fetch(`/api/listings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await loadListings();
  }

  async function handleSave(id: number, data: Partial<Listing>) {
    await fetch(`/api/listings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await loadListings();
  }

  async function handleViewSimilar(listing: Listing) {
    const res = await fetch(`/api/listings/${listing.id}`);
    const data = await res.json();
    setSimilarTarget(listing);
    setSimilarList(data.similar ?? []);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h1 className="page-title" style={{ marginBottom: 0 }}>抽選情報一覧</h1>
        <div className="flex gap-1">
          <button className="btn btn-primary" onClick={() => setShowManualAdd(true)}>手動追加</button>
          <button className={`btn ${viewMode === 'card' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('card')}>カード</button>
          <button className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('table')}>テーブル</button>
        </div>
      </div>

      <div className="filters">
        <label><input type="checkbox" checked={filters.unconfirmed_only} onChange={(e) => setFilters({ ...filters, unconfirmed_only: e.target.checked, applied_only: false })} /> 未確認のみ</label>
        <label><input type="checkbox" checked={filters.applicable_only} onChange={(e) => setFilters({ ...filters, applicable_only: e.target.checked })} /> 応募可能のみ</label>
        <label><input type="checkbox" checked={filters.applied_only} onChange={(e) => setFilters({ ...filters, applied_only: e.target.checked, unconfirmed_only: false })} /> 応募済み</label>
        <label><input type="checkbox" checked={filters.deadline_24h} onChange={(e) => setFilters({ ...filters, deadline_24h: e.target.checked })} /> 締切24時間以内</label>
        <label><input type="checkbox" checked={filters.deadline_3d} onChange={(e) => setFilters({ ...filters, deadline_3d: e.target.checked })} /> 締切3日以内</label>
        <label><input type="checkbox" checked={filters.include_low_confidence} onChange={(e) => setFilters({ ...filters, include_low_confidence: e.target.checked })} /> 低信頼度も含む</label>
        <label><input type="checkbox" checked={filters.include_excluded} onChange={(e) => setFilters({ ...filters, include_excluded: e.target.checked })} /> 除外情報も表示</label>

        <select value={filters.region} onChange={(e) => setFilters({ ...filters, region: e.target.value })}>
          <option value="">全地域</option>
          {Object.entries(REGION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <select value={filters.channel} onChange={(e) => setFilters({ ...filters, channel: e.target.value })}>
          <option value="">販売形態</option>
          <option value="online">オンライン</option>
          <option value="store">店舗限定</option>
        </select>

        <select value={filters.source_type} onChange={(e) => setFilters({ ...filters, source_type: e.target.value })}>
          <option value="">情報源</option>
          {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <input type="text" placeholder="店舗名" value={filters.store} onChange={(e) => setFilters({ ...filters, store: e.target.value })} />
        <input type="text" placeholder="商品名" value={filters.product} onChange={(e) => setFilters({ ...filters, product: e.target.value })} />
      </div>

      {loading ? (
        <div className="empty-state">読み込み中...</div>
      ) : listings.length === 0 ? (
        <div className="empty-state">
          該当する情報がありません。監視サイトにURLを登録して巡回するか、手動で情報を追加してください。
        </div>
      ) : viewMode === 'card' ? (
        listings.map((l) => (
          <ListingCard
            key={l.id}
            listing={l}
            onStatusChange={handleStatusChange}
            onEdit={setEditTarget}
            onViewSimilar={handleViewSimilar}
          />
        ))
      ) : (
        <ListingTable listings={listings} onStatusChange={handleStatusChange} onEdit={setEditTarget} />
      )}

      <EditListingModal listing={editTarget} onClose={() => setEditTarget(null)} onSave={handleSave} />
      <SimilarModal listing={similarTarget} similar={similarList} onClose={() => { setSimilarTarget(null); setSimilarList([]); }} />
      <ManualAddModal open={showManualAdd} onClose={() => setShowManualAdd(false)} onAdded={loadListings} />
    </div>
  );
}

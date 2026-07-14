import {
  STATUS_LABELS,
  SOURCE_TYPE_LABELS,
  REGION_LABELS,
  CHANNEL_LABELS,
  type Listing,
  type ListingStatus,
} from '@/lib/types';
import { formatDisplayDate } from '@/lib/date-parser';

export function StatusBadge({ status }: { status: ListingStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>;
}

export function ConfidenceScore({ score }: { score: number }) {
  const cls = score >= 70 ? 'confidence-high' : score >= 40 ? 'confidence-mid' : 'confidence-low';
  return <span className={cls}>{score}点</span>;
}

interface ListingCardProps {
  listing: Listing;
  onStatusChange: (id: number, status: ListingStatus) => void;
  onEdit: (listing: Listing) => void;
  onViewSimilar: (listing: Listing) => void;
}

export function ListingCard({ listing, onStatusChange, onEdit, onViewSimilar }: ListingCardProps) {
  return (
    <div className={`listing-card ${listing.is_sample ? 'sample' : ''}`}>
      <div className="listing-card-header">
        <div>
          <div className="listing-card-title">
            {listing.is_sample && <span className="badge badge-sample">サンプル</span>}{' '}
            {listing.title}
          </div>
          <div className="text-sm text-muted mt-1">{listing.store_name}</div>
        </div>
        <div className="flex gap-1 items-center">
          <StatusBadge status={listing.status} />
          <ConfidenceScore score={listing.confidence} />
        </div>
      </div>

      <div className="listing-card-meta">
        <span>商品: {listing.product_name || '不明'}</span>
        <span>締切: {formatDisplayDate(listing.application_deadline)}</span>
        <span>地域: {REGION_LABELS[listing.region]}</span>
        <span>販売: {CHANNEL_LABELS[listing.channel]}</span>
        <span>情報源: {SOURCE_TYPE_LABELS[listing.source_type]}</span>
        {listing.has_similar && <span className="similar-tag">類似情報あり</span>}
        {listing.is_excluded && <span className="badge badge-excluded">除外候補</span>}
      </div>

      {listing.excerpt && (
        <div className="listing-card-excerpt">{listing.excerpt}</div>
      )}

      <div className="listing-card-actions">
        {listing.source_url && (
          <a href={listing.source_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
            元ページを開く
          </a>
        )}
        <button className="btn btn-warning btn-sm" onClick={() => onStatusChange(listing.id, 'planned')}>応募予定</button>
        <button className="btn btn-success btn-sm" onClick={() => onStatusChange(listing.id, 'applied')}>応募済み</button>
        <button className="btn btn-secondary btn-sm" onClick={() => onStatusChange(listing.id, 'excluded')}>対象外</button>
        <button className="btn btn-secondary btn-sm" onClick={() => onEdit(listing)}>編集</button>
        {listing.has_similar && (
          <button className="btn btn-secondary btn-sm" onClick={() => onViewSimilar(listing)}>類似情報</button>
        )}
      </div>
    </div>
  );
}

interface ListingTableProps {
  listings: Listing[];
  onStatusChange: (id: number, status: ListingStatus) => void;
  onEdit: (listing: Listing) => void;
}

export function ListingTable({ listings, onStatusChange, onEdit }: ListingTableProps) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>店舗</th>
            <th>タイトル</th>
            <th>商品</th>
            <th>締切</th>
            <th>信頼度</th>
            <th>ステータス</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((l) => (
            <tr key={l.id}>
              <td>{l.store_name}{l.is_sample ? ' [サンプル]' : ''}</td>
              <td>
                {l.title}
                {l.has_similar && <span className="similar-tag ml-1">類似</span>}
              </td>
              <td>{l.product_name || '不明'}</td>
              <td>{formatDisplayDate(l.application_deadline)}</td>
              <td><ConfidenceScore score={l.confidence} /></td>
              <td><StatusBadge status={l.status} /></td>
              <td>
                <div className="flex gap-1">
                  {l.source_url && (
                    <a href={l.source_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">開く</a>
                  )}
                  <button className="btn btn-success btn-sm" onClick={() => onStatusChange(l.id, 'applied')}>済</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => onEdit(l)}>編集</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

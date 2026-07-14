'use client';

import { useState } from 'react';

interface NotificationPanelProps {
  unreadCount: number;
  onRead: () => void;
}

export function NotificationPanel({ unreadCount, onRead }: NotificationPanelProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<{ id: number; message: string; read: number; created_at: string; type: string }[]>([]);

  async function loadNotifications() {
    const res = await fetch('/api/notifications');
    const data = await res.json();
    setNotifications(Array.isArray(data) ? data : []);
  }

  async function toggle() {
    if (!open) await loadNotifications();
    setOpen(!open);
  }

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    });
    onRead();
    await loadNotifications();
  }

  const typeLabels: Record<string, string> = {
    new_listing: '新着',
    deadline_24h: '締切24h前',
    deadline_3h: '締切3h前',
    planned_not_applied: '未応募',
  };

  return (
    <>
      <button className="btn btn-secondary notification-toggle" onClick={toggle}>
        🔔 通知 {unreadCount > 0 && <span className="badge badge-needs_review">{unreadCount}</span>}
      </button>
      <div className={`notification-bar ${open ? 'open' : ''}`}>
        <div className="flex justify-between items-center" style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
          <strong>通知</strong>
          <button className="btn btn-sm btn-secondary" onClick={markAllRead}>すべて既読</button>
        </div>
        {notifications.length === 0 ? (
          <div className="empty-state">通知はありません</div>
        ) : (
          notifications.map((n) => (
            <div key={n.id} className={`notification-item ${n.read ? '' : 'unread'}`}>
              <span className="badge badge-unconfirmed">{typeLabels[n.type] ?? n.type}</span>
              <div className="mt-1">{n.message}</div>
              <div className="text-sm text-muted">{new Date(n.created_at).toLocaleString('ja-JP')}</div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

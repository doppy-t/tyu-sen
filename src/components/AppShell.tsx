'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NotificationPanel } from '@/components/NotificationPanel';

const NAV = [
  { href: '/', label: 'ダッシュボード' },
  { href: '/listings', label: '抽選情報一覧' },
  { href: '/monitors', label: '監視サイト管理' },
  { href: '/settings', label: '設定' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    function load() {
      fetch('/api/notifications?unread=true')
        .then((r) => r.json())
        .then((data) => setUnreadCount(Array.isArray(data) ? data.length : 0))
        .catch(() => {});
    }
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="app-layout">
        <aside className="sidebar">
          <h1>🃏 抽選モニター</h1>
          <nav>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={pathname === item.href ? 'active' : ''}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="main-content">
          {children}
        </main>
      </div>
      <NotificationPanel unreadCount={unreadCount} onRead={() => setUnreadCount(0)} />
    </>
  );
}

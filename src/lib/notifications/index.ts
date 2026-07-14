import { getDb } from '../db';
import type { NotificationType } from '../types';

export interface NotificationProvider {
  send(type: NotificationType, listingId: number | null, message: string): Promise<void>;
}

class InAppNotificationProvider implements NotificationProvider {
  async send(type: NotificationType, listingId: number | null, message: string): Promise<void> {
    getDb().prepare(`
      INSERT INTO notifications (type, listing_id, message) VALUES (?, ?, ?)
    `).run(type, listingId, message);
  }
}

const providers: NotificationProvider[] = [new InAppNotificationProvider()];

export function registerNotificationProvider(provider: NotificationProvider) {
  providers.push(provider);
}

export async function createNotification(
  type: NotificationType,
  listingId: number | null,
  message: string
) {
  for (const provider of providers) {
    try {
      await provider.send(type, listingId, message);
    } catch (e) {
      console.error('Notification provider error:', e);
    }
  }
}

export function checkDeadlineNotifications() {
  const db = getDb();
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const in3h = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();

  const listings = db.prepare(`
    SELECT * FROM listings
    WHERE status IN ('unconfirmed', 'needs_review', 'planned')
    AND application_deadline IS NOT NULL
    AND is_sample = 0
  `).all() as { id: number; title: string; application_deadline: string; status: string }[];

  for (const listing of listings) {
    try {
      const deadline = new Date(listing.application_deadline);
      if (isNaN(deadline.getTime())) continue;

      const diff = deadline.getTime() - now.getTime();
      const hoursLeft = diff / (1000 * 60 * 60);

      if (hoursLeft > 0 && hoursLeft <= 24) {
        const existing = db.prepare(`
          SELECT id FROM notifications WHERE listing_id = ? AND type = 'deadline_24h'
          AND created_at > datetime('now', '-1 day')
        `).get(listing.id);
        if (!existing) {
          createNotification('deadline_24h', listing.id, `締切24時間前: ${listing.title}`);
        }
      }

      if (hoursLeft > 0 && hoursLeft <= 3) {
        const existing = db.prepare(`
          SELECT id FROM notifications WHERE listing_id = ? AND type = 'deadline_3h'
          AND created_at > datetime('now', '-3 hours')
        `).get(listing.id);
        if (!existing) {
          createNotification('deadline_3h', listing.id, `締切3時間前: ${listing.title}`);
        }
      }

      if (listing.status === 'planned' && hoursLeft > 0 && hoursLeft <= 48) {
        const existing = db.prepare(`
          SELECT id FROM notifications WHERE listing_id = ? AND type = 'planned_not_applied'
          AND created_at > datetime('now', '-1 day')
        `).get(listing.id);
        if (!existing) {
          createNotification('planned_not_applied', listing.id, `応募予定だが未応募: ${listing.title}`);
        }
      }
    } catch {
      // skip invalid dates
    }
  }
}

export function getNotifications(unreadOnly = false) {
  const db = getDb();
  const query = unreadOnly
    ? 'SELECT * FROM notifications WHERE read = 0 ORDER BY created_at DESC LIMIT 50'
    : 'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100';
  return db.prepare(query).all();
}

export function markNotificationRead(id: number) {
  getDb().prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
}

export function markAllNotificationsRead() {
  getDb().prepare('UPDATE notifications SET read = 1 WHERE read = 0').run();
}

// 将来の拡張用スタブ
export class DiscordNotificationProvider implements NotificationProvider {
  constructor(private webhookUrl: string) {}
  async send(type: NotificationType, listingId: number | null, message: string): Promise<void> {
    if (!this.webhookUrl) return;
    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `[${type}] ${message}` }),
    });
  }
}

export class LineNotificationProvider implements NotificationProvider {
  constructor(private token: string) {}
  async send(type: NotificationType, _listingId: number | null, message: string): Promise<void> {
    if (!this.token) return;
    await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ message: `[${type}] ${message}` }),
    });
  }
}

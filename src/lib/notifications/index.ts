// src/lib/db.ts は親ディレクトリに存在するため相対パスで参照
import { dbAll, dbRun } from '../db';
import type { NotificationType } from '../types';

export interface NotificationProvider {
  send(type: NotificationType, listingId: number | null, message: string): Promise<void>;
}

class InAppNotificationProvider implements NotificationProvider {
  async send(type: NotificationType, listingId: number | null, message: string): Promise<void> {
    await dbRun(
      `INSERT INTO notifications (type, listing_id, message) VALUES (?, ?, ?)`,
      [type, listingId, message]
    );
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

export async function checkDeadlineNotifications() {
  const now = new Date();

  const listings = await dbAll(`
    SELECT * FROM listings
    WHERE status IN ('unconfirmed', 'needs_review', 'planned')
    AND application_deadline IS NOT NULL
    AND is_sample = 0
  `) as { id: number; title: string; application_deadline: string; status: string }[];

  for (const listing of listings) {
    try {
      const deadline = new Date(listing.application_deadline);
      if (isNaN(deadline.getTime())) continue;

      const diff = deadline.getTime() - now.getTime();
      const hoursLeft = diff / (1000 * 60 * 60);

      if (hoursLeft > 0 && hoursLeft <= 24) {
        const existing = await dbAll(`
          SELECT id FROM notifications WHERE listing_id = ? AND type = 'deadline_24h'
          AND created_at > datetime('now', '-1 day')
        `, [listing.id]);
        if (existing.length === 0) {
          await createNotification('deadline_24h', listing.id, `締切24時間前: ${listing.title}`);
        }
      }

      if (hoursLeft > 0 && hoursLeft <= 3) {
        const existing = await dbAll(`
          SELECT id FROM notifications WHERE listing_id = ? AND type = 'deadline_3h'
          AND created_at > datetime('now', '-3 hours')
        `, [listing.id]);
        if (existing.length === 0) {
          await createNotification('deadline_3h', listing.id, `締切3時間前: ${listing.title}`);
        }
      }

      if (listing.status === 'planned' && hoursLeft > 0 && hoursLeft <= 48) {
        const existing = await dbAll(`
          SELECT id FROM notifications WHERE listing_id = ? AND type = 'planned_not_applied'
          AND created_at > datetime('now', '-1 day')
        `, [listing.id]);
        if (existing.length === 0) {
          await createNotification('planned_not_applied', listing.id, `応募予定だが未応募: ${listing.title}`);
        }
      }
    } catch {
      // skip invalid dates
    }
  }
}

export async function getNotifications(unreadOnly = false) {
  const query = unreadOnly
    ? 'SELECT * FROM notifications WHERE read = 0 ORDER BY created_at DESC LIMIT 50'
    : 'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100';
  return dbAll(query);
}

export async function markNotificationRead(id: number) {
  await dbRun('UPDATE notifications SET read = 1 WHERE id = ?', [id]);
}

export async function markAllNotificationsRead() {
  await dbRun('UPDATE notifications SET read = 1 WHERE read = 0');
}

// 将来の拡張用スタブ
export class DiscordNotificationProvider implements NotificationProvider {
  constructor(private webhookUrl: string) {}
  async send(type: NotificationType, _listingId: number | null, message: string): Promise<void> {
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

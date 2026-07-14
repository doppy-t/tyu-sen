import { NextRequest, NextResponse } from 'next/server';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/notifications';
import { handleApiError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const unreadOnly = request.nextUrl.searchParams.get('unread') === 'true';
    const notifications = await getNotifications(unreadOnly);
    return NextResponse.json(notifications);
  } catch (e) {
    return handleApiError(e, 'GET /api/notifications');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.markAllRead) {
      await markAllNotificationsRead();
    } else if (body.id) {
      await markNotificationRead(body.id);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e, 'PATCH /api/notifications');
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const unreadOnly = request.nextUrl.searchParams.get('unread') === 'true';
    const notifications = getNotifications(unreadOnly);
    return NextResponse.json(notifications);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.markAllRead) {
      markAllNotificationsRead();
    } else if (body.id) {
      markNotificationRead(body.id);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

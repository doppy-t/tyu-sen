import cron from 'node-cron';
import { crawlAllEnabled } from './crawler';
import { checkDeadlineNotifications } from './notifications';

let cronStarted = false;

export function startCronJobs() {
  if (cronStarted) return;
  if (process.env.ENABLE_CRON !== 'true' && process.env.NODE_ENV === 'production') {
    // In dev, cron is triggered manually or via API
    return;
  }

  cronStarted = true;

  // Every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      console.log('[cron] Starting scheduled crawl...');
      const result = await crawlAllEnabled();
      console.log(`[cron] Crawl complete: ${result.total} sites, ${result.errors} errors`);
      checkDeadlineNotifications();
    } catch (e) {
      console.error('[cron] Crawl failed:', e);
    }
  });

  // Check deadlines every hour
  cron.schedule('0 * * * *', () => {
    try {
      checkDeadlineNotifications();
    } catch (e) {
      console.error('[cron] Deadline check failed:', e);
    }
  });

  console.log('[cron] Scheduled jobs started');
}

export function initCronOnStartup() {
  if (typeof window === 'undefined') {
    startCronJobs();
  }
}

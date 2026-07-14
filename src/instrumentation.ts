export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.ENABLE_CRON === 'true') {
    const { startCronJobs } = await import('@/lib/cron');
    startCronJobs();
  }
}

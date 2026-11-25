import cron from 'node-cron';

export interface Job {
  name: string;
  /** A cron expression, read in Hong Kong time. */
  schedule: string;
  run: () => Promise<unknown>;
}

const jobs: Job[] = [];

export function registerJob(job: Job): void {
  if (!jobs.some((existing) => existing.name === job.name)) jobs.push(job);
}

/** Starts every registered job. A job that fails is logged and runs again next time. */
export function startScheduler(): void {
  for (const job of jobs) {
    cron.schedule(
      job.schedule,
      () => {
        job.run().catch((err: unknown) => console.error(`[jobs] ${job.name} failed`, err));
      },
      { timezone: 'Asia/Hong_Kong' },
    );
    console.log(`[jobs] ${job.name} scheduled (${job.schedule}, Hong Kong time)`);
  }
}

import { createApp } from './app.js';
import { startScheduler } from './jobs/scheduler.js';
import { ConfigError, loadConfig } from './platform/config.js';
import { connectDb } from './platform/db.js';
import { setConfig } from './platform/runtime.js';

async function start() {
  const cfg = loadConfig();
  setConfig(cfg);
  const app = createApp();
  await connectDb(cfg.mongodbUri);
  startScheduler();
  app.listen(cfg.port, () => {
    console.log(`HateBookkeeping API listening on port ${cfg.port}`);
  });
}

start().catch((err) => {
  console.error(err instanceof ConfigError ? err.message : err);
  process.exit(1);
});

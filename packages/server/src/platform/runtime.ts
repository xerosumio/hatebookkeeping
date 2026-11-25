import type { Config } from './config.js';

let current: Config | undefined;

/** Set once at boot (or by the test harness) before the app handles anything. */
export function setConfig(config: Config): void {
  current = config;
}

export function config(): Config {
  if (!current) throw new Error('Configuration has not been loaded yet.');
  return current;
}

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'hbk-theme';

export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    /* private mode */
  }
  return 'system';
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* private mode */
  }
}

export function cycleTheme(current: Theme): Theme {
  const next: Theme = current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
  applyTheme(next);
  return next;
}

export type SuiteAppId = 'ndoc' | 'ndrive' | 'kanban' | 'orbit' | 'hbk' | 'loom' | 'memory' | 'nops' | 'fastmail';

export const CURRENT_APP: SuiteAppId = 'hbk';

export interface SuiteApp {
  id: SuiteAppId;
  name: string;
  description: string;
  color: string;
  icon?: string;
}

const FASTMAIL_ICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#c0a882"/><path fill="#fff" d="M6.5 10h19A1.5 1.5 0 0 1 27 11.5v9A1.5 1.5 0 0 1 25.5 22h-19A1.5 1.5 0 0 1 5 20.5v-9A1.5 1.5 0 0 1 6.5 10Zm.8 1.6 8.7 6.1 8.7-6.1z"/></svg>',
  );

const CATALOG: SuiteApp[] = [
  { id: 'ndoc', name: 'NDoc', description: 'Wiki & docs', color: '#2383e2' },
  { id: 'ndrive', name: 'NDrive', description: 'Files', color: '#0d9488' },
  { id: 'kanban', name: 'Kanban', description: 'Boards', color: '#6366f1' },
  { id: 'orbit', name: 'Orbit', description: 'CRM', color: '#d9730d' },
  { id: 'hbk', name: 'HBK', description: 'Finance', color: '#2563eb' },
  { id: 'loom', name: 'Loom', description: 'MCP portal', color: '#7c3aed' },
  { id: 'memory', name: 'Memory', description: 'MCP memory', color: '#0ea5e9' },
  { id: 'nops', name: 'NOps', description: 'Ops control plane', color: '#d97706' },
  { id: 'fastmail', name: 'Fastmail', description: 'Mail', color: '#c0a882', icon: FASTMAIL_ICON },
];

function envUrl(id: SuiteAppId): string {
  const map: Record<SuiteAppId, string | undefined> = {
    ndoc: import.meta.env.VITE_SUITE_NDOC_URL,
    ndrive: import.meta.env.VITE_SUITE_NDRIVE_URL,
    kanban: import.meta.env.VITE_SUITE_KANBAN_URL,
    orbit: import.meta.env.VITE_SUITE_ORBIT_URL,
    hbk: import.meta.env.VITE_SUITE_HBK_URL,
    loom: import.meta.env.VITE_SUITE_LOOM_URL,
    memory: import.meta.env.VITE_SUITE_MEMORY_URL,
    nops: import.meta.env.VITE_SUITE_NOPS_URL,
    fastmail: import.meta.env.VITE_SUITE_FASTMAIL_URL || 'https://app.fastmail.com',
  };
  const raw = map[id];
  return typeof raw === 'string' ? raw.replace(/\/$/, '') : '';
}

export interface VisibleSuiteApp extends SuiteApp {
  href: string;
  current: boolean;
}

export function visibleSuiteApps(): VisibleSuiteApp[] {
  return CATALOG.flatMap((app) => {
    const current = app.id === CURRENT_APP;
    const href = current ? window.location.origin : envUrl(app.id);
    if (!current && !href) return [];
    return [{ ...app, href, current }];
  });
}

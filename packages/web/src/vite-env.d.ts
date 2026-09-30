/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SUITE_NDOC_URL?: string;
  readonly VITE_SUITE_NDRIVE_URL?: string;
  readonly VITE_SUITE_KANBAN_URL?: string;
  readonly VITE_SUITE_ORBIT_URL?: string;
  readonly VITE_SUITE_HBK_URL?: string;
  readonly VITE_SUITE_LOOM_URL?: string;
  readonly VITE_SUITE_MEMORY_URL?: string;
  readonly VITE_SUITE_NOPS_URL?: string;
  readonly VITE_SUITE_FASTMAIL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

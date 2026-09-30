import { useEffect, useRef, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { visibleSuiteApps } from '../lib/suite';

const tileClass = [
  'flex flex-col items-center rounded-sm px-1 py-2 text-center no-underline',
  'font-mono text-ink',
].join(' ');

const tileHover = 'hover:bg-raised';
const tileCurrent = 'bg-raised';

export function AppSwitcher() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const apps = visibleSuiteApps();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Switch apps"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="rounded-sm p-1 text-ink-ghost transition-colors hover:bg-raised"
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 rounded-md border border-hair bg-panel p-2 lift"
          style={{ width: 216 }}
        >
          <div className="mb-1.5 px-1 font-mono text-[8px] tracked text-ink-ghost">Naton suite</div>
          <div className="grid grid-cols-3 gap-1">
            {apps.map((app) => {
              const icon = (
                <img
                  src={app.icon ?? (app.current ? '/favicon.svg' : `${app.href}/favicon.svg`)}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-sm"
                />
              );
              const label = (
                <span className="mt-1 max-w-full truncate text-[9px] leading-tight tracked">{app.name}</span>
              );
              if (app.current) {
                return (
                  <div
                    key={app.id}
                    role="menuitem"
                    aria-current="page"
                    title={app.description}
                    className={`${tileClass} ${tileCurrent}`}
                  >
                    {icon}
                    {label}
                  </div>
                );
              }
              return (
                <a
                  key={app.id}
                  role="menuitem"
                  href={app.href}
                  title={app.description}
                  className={`${tileClass} ${tileHover}`}
                  onClick={() => setOpen(false)}
                >
                  {icon}
                  {label}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

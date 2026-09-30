import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({
  children,
  className = '',
  ...props
}: DropdownMenuPrimitive.DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={4}
        className={`z-50 min-w-[180px] overflow-hidden rounded-md p-1 ${className}`}
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-line)',
          boxShadow: 'var(--shadow)',
        }}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  children,
  className = '',
  danger,
  ...props
}: DropdownMenuPrimitive.DropdownMenuItemProps & { danger?: boolean }) {
  return (
    <DropdownMenuPrimitive.Item
      className={`relative flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-[var(--color-surface-3)] ${className}`}
      style={{ color: danger ? 'var(--color-danger)' : 'var(--color-ink)' }}
      {...props}
    >
      {children}
    </DropdownMenuPrimitive.Item>
  );
}

export const DropdownMenuSeparator = () => (
  <DropdownMenuPrimitive.Separator className="my-1 h-px bg-[var(--color-line)]" />
);

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FileText, Paperclip, Upload } from 'lucide-react';
import type { FileDto } from '@hbk/shared';
import { failureOf, fetchBlob } from '../api/client';
import { openProtected, uploadFile } from '../api/files';
import { Button } from './ui';

export function OpenButton({ path, children, icon, variant = 'secondary', size = 'md' }: { path: string; children: ReactNode; icon?: ReactNode; variant?: 'secondary' | 'ghost'; size?: 'sm' | 'md' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        variant={variant}
        size={size}
        busy={busy}
        icon={icon ?? <FileText className="h-3.5 w-3.5" />}
        onClick={async () => {
          setBusy(true);
          setError(await openProtected(path));
          setBusy(false);
        }}
      >
        {children}
      </Button>
      {error ? <span className="text-xs text-breach">{error}</span> : null}
    </span>
  );
}

export function FileLink({ fileId, label = 'View file' }: { fileId: string; label?: string }) {
  return (
    <OpenButton path={`/files/${fileId}`} variant="ghost" size="sm" icon={<Paperclip className="h-3.5 w-3.5" />}>
      {label}
    </OpenButton>
  );
}

/** Shows a protected image (logo, chop, signature). */
export function ProtectedImage({ fileId, alt, className }: { fileId: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    fetchBlob(`/files/${fileId}`)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => setSrc(null));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fileId]);
  return src ? <img src={src} alt={alt} className={className} /> : null;
}

export function UploadButton({
  purpose,
  onUploaded,
  label = 'Upload',
  accept = 'image/png,image/jpeg,image/gif,image/webp,application/pdf',
}: {
  purpose: 'branding' | 'receipt';
  onUploaded: (file: FileDto) => void;
  label?: string;
  accept?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          setBusy(true);
          setError(null);
          try {
            onUploaded(await uploadFile(file, purpose));
          } catch (err) {
            setError(failureOf(err).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button size="sm" busy={busy} icon={<Upload className="h-3.5 w-3.5" />} onClick={() => input.current?.click()}>
        {label}
      </Button>
      {error ? <span className="text-xs text-breach">{error}</span> : null}
    </span>
  );
}

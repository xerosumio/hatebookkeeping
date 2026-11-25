import type { FileDto } from '@hbk/shared';
import { api, failureOf, fetchBlob } from './client';

/**
 * Opens a protected file or PDF in a new tab. The tab is opened straight away,
 * while the click is still being handled, so the browser does not block it.
 * Returns the reason when it could not be opened.
 */
export async function openProtected(path: string): Promise<string | null> {
  const tab = window.open('', '_blank');
  try {
    const blob = await fetchBlob(path);
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return null;
  } catch (error) {
    tab?.close();
    return failureOf(error).message;
  }
}

export async function uploadFile(file: File, purpose: 'branding' | 'receipt'): Promise<FileDto> {
  const form = new FormData();
  form.append('file', file);
  form.append('purpose', purpose);
  return (await api.post<FileDto>('/files', form)).data;
}

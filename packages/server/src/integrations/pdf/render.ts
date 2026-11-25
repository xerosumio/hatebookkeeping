import type { Response } from 'express';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import type { ReactElement } from 'react';

export async function renderPdf(document: ReactElement): Promise<Buffer> {
  return renderToBuffer(document as ReactElement<DocumentProps>);
}

/** Sends a PDF for viewing in the browser, with a sensible name if it is saved. */
export function sendPdf(res: Response, filename: string, pdf: Buffer): void {
  const safe = filename.replace(/[^A-Za-z0-9._-]+/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${safe}"`);
  res.setHeader('Content-Length', String(pdf.length));
  res.send(pdf);
}

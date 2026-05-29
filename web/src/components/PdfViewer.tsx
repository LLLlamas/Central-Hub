import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';

export interface PdfRef {
  /** Path to the PDF — either a public URL served from `web/public/` or a
   *  runtime Blob URL (e.g. the active rider's `pdfObjectUrl`). */
  url: string;
  /** Optional page to deep-link to (uses the browser PDF `#page=` anchor). */
  page?: number;
  /** Modal title — usually the document or section name. */
  title?: string;
}

interface PdfViewerCtx {
  openPdf: (ref: PdfRef) => void;
}

const Ctx = createContext<PdfViewerCtx | null>(null);

/**
 * App-wide PDF viewer. Any component under the provider can call
 * `usePdfViewer().openPdf(...)` to show a PDF in a popup modal instead of
 * spawning a new browser tab. One modal, mounted once at the root.
 */
export function PdfViewerProvider({ children }: { children: ReactNode }) {
  const [pdf, setPdf] = useState<PdfRef | null>(null);
  const openPdf = useCallback((ref: PdfRef) => setPdf(ref), []);
  return (
    <Ctx.Provider value={{ openPdf }}>
      {children}
      <PdfViewerModal pdf={pdf} onClose={() => setPdf(null)} />
    </Ctx.Provider>
  );
}

export function usePdfViewer(): PdfViewerCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePdfViewer must be used inside PdfViewerProvider');
  return v;
}

function PdfViewerModal({ pdf, onClose }: { pdf: PdfRef | null; onClose: () => void }) {
  if (!pdf) return null;
  return (
    <Modal open onClose={onClose} size="xl" eyebrow="Source document" title={pdf.title ?? 'PDF document'}>
      <PdfViewerInline url={pdf.url} page={pdf.page} title={pdf.title} height="78vh" />
    </Modal>
  );
}

/**
 * Embedded PDF iframe — same renderer the modal uses, but lives inline so a
 * surface like the rider review can show the source next to its extracted
 * text. Uses the browser's native PDF viewer (#page=N anchor) and exposes an
 * "open in new tab" affordance as the bigger-view fallback.
 */
export function PdfViewerInline({
  url,
  page,
  title,
  height = '70vh',
  className = '',
}: {
  url: string;
  page?: number;
  title?: string;
  /** Any CSS height — string ('70vh') or number (px). Defaults to 70vh. */
  height?: string | number;
  className?: string;
}) {
  const base = url.split('#')[0];
  const src = page ? `${base}#page=${page}` : base;
  const heightCss = typeof height === 'number' ? `${height}px` : height;
  return (
    <div className={`space-y-2 ${className}`}>
      <iframe
        key={src}
        src={src}
        title={title ?? 'PDF document'}
        className="w-full rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-paper-2)]"
        style={{ height: heightCss }}
      />
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="font-mono uppercase tracking-[0.10em] text-[var(--color-ink-4)]">
          {page ? `Opened at page ${page}` : 'Full document'}
        </span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-[var(--color-ocean)] hover:underline"
        >
          Open in new tab <Icon.Arrow size={11} />
        </a>
      </div>
    </div>
  );
}

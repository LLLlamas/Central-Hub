import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';

export interface PdfRef {
  /** Path to the PDF, served from `web/public/` (e.g. RIDER_PDF_PATH). */
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
  const base = pdf.url.split('#')[0];
  const src = pdf.page ? `${base}#page=${pdf.page}` : base;
  return (
    <Modal open onClose={onClose} size="xl" eyebrow="Source document" title={pdf.title ?? 'PDF document'}>
      <div className="space-y-2">
        <iframe
          key={src}
          src={src}
          title={pdf.title ?? 'PDF document'}
          className="w-full h-[78vh] rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-paper-2)]"
        />
        <div className="flex items-center justify-between gap-3 text-[11px]">
          <span className="font-mono uppercase tracking-[0.10em] text-[var(--color-ink-4)]">
            {pdf.page ? `Opened at page ${pdf.page}` : 'Full document'}
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
    </Modal>
  );
}

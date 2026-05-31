// The `local` backend — wraps today's storage modules verbatim. On the default
// `VITE_BACKEND=local`, behavior is byte-for-byte identical to pre-seam: the
// same localStorage keys, the same IndexedDB stores. DO NOT change behavior
// here; this is the safety net the whole migration rests on.

import type { ID, Tour } from '@/types';
import type { Backend, PdfScope, Unsub } from './types';
import { loadScratchTour, saveScratchTour, clearScratchTour } from '@/lib/scratchStorage';
import {
  loadOverlays as loadOverlaysRaw,
  saveOverlays as saveOverlaysRaw,
  clearOverlays,
  type OverlayBundle,
} from '@/lib/overlayStorage';
import {
  loadRiderPdf,
  saveRiderPdf,
  deleteRiderPdf,
  clearAllRiderPdfs,
} from '@/lib/riderPdfStore';
import {
  loadDocument,
  saveDocument,
  deleteDocument,
  clearAllDocuments,
} from '@/lib/documentStore';

export const localBackend: Backend = {
  kind: 'local',

  // Local is single-tab: there is no live source to subscribe to. We read once
  // synchronously and fire the callback; subsequent updates flow through
  // AppState's own write path (saveTour), exactly as today.
  subscribeTour(_tourId: ID | null, cb: (tour: Tour | null) => void): Unsub {
    cb(loadScratchTour());
    return () => {};
  },

  async saveTour(tour: Tour): Promise<void> {
    saveScratchTour(tour);
  },

  async loadOverlays(_tourId: ID | null): Promise<OverlayBundle | null> {
    return loadOverlaysRaw();
  },

  async saveOverlays(_tourId: ID | null, bundle: OverlayBundle): Promise<void> {
    saveOverlaysRaw(bundle);
  },

  // 'rider' bytes live in the rider-pdf store; 'doc' + 'submissions' bytes both
  // live in the general documents store (keyed by id) — a submission file is
  // just another binary attachment locally.
  async loadPdf(scope: PdfScope, id: string): Promise<ArrayBuffer | null> {
    return scope === 'rider' ? loadRiderPdf(id) : loadDocument(id);
  },

  async savePdf(scope: PdfScope, id: string, bytes: ArrayBuffer): Promise<void> {
    if (scope === 'rider') await saveRiderPdf(id, bytes);
    else await saveDocument(id, bytes);
  },

  async deletePdf(scope: PdfScope, id: string): Promise<void> {
    if (scope === 'rider') await deleteRiderPdf(id);
    else await deleteDocument(id);
  },

  async clearAll(_tourId: ID | null): Promise<void> {
    clearScratchTour();
    clearOverlays();
    await clearAllRiderPdfs();
    await clearAllDocuments();
  },
};

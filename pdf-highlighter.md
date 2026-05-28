# PDF viewer & highlighting

In-app PDF viewer — PDF references open in a modal at the cited page, not a new browser tab.
The "highlighter" (auto-highlighting the referenced text on open) is **planned, not built** — see Status.

## Status

- In-app modal viewer + jump-to-page — **done**.
- Auto-highlight the referenced text — **not built** (blocked; see "Why highlighting isn't built").

## Files

- `web/src/components/PdfViewer.tsx` — `PdfViewerProvider`, the `usePdfViewer()` hook, `PdfViewerModal`. The provider is mounted in `main.tsx`, so it wraps both layouts (`/print/*` gets it too).
- `web/src/components/ui/Modal.tsx` — gained `size="xl"` for the viewer.
- `web/scripts/gen-flight-pdfs.mjs` — one-off generator for the flight PDFs; uses `pdf-lib` (a devDependency).
- PDFs in `web/public/`: the rider PDF, `AM19_Group_LAX-MEX_2025-09-22.pdf`, `VB1014_Group_MEX-MTY_2025-09-27.pdf`, `Hotel_Block_Mexico_2025-09.pdf`.

## API

```ts
usePdfViewer().openPdf({ url, page?, title? })
```

- `url` — path to a PDF under `web/public/`. Rider path constant: `RIDER_PDF_PATH` (`lib/riderSections.ts`).
- `page` — deep-links via the PDF `#page=N` anchor.

## How it works now

`PdfViewerModal` renders an `<iframe src="<url>#page=<page>">` — the browser's native PDF viewer — inside `Modal size="xl"`. It opens at the cited page; an "open in new tab" link is the fallback. No PDF library runs at runtime.

## What routes through it

- `RiderRef` (`components/RiderRef.tsx`) — §N / p.N links → rider PDF at the section's page.
- `SourceTag` (`components/provenance/SourceTag.tsx`) — the "View" artifact button → rider PDF at the cited page.
- `MockTag` (`components/provenance/MockTag.tsx`) — artifacts with `kind: 'pdf'`.
- Rider filename chip — `routes/RiderIngest.tsx`. Flight filename chips — `routes/FlightIngest.tsx`.

## Why highlighting isn't built

The goal was to highlight the *referenced* text when the PDF opens. Blocker: the rider PDF is **Spanish**, but the reference data we'd search from (`realSources` quotes, section names) is **English** — a text search matches nothing. A pdf.js viewer does not fix this; the query still isn't in the PDF.

`pdfjs-dist` (v5) is installed in anticipation but currently unused. Note v5 ships only viewer *components* (`web/pdf_viewer.mjs`), not a drop-in `viewer.html`.

## To build real highlighting

1. Add short verbatim "anchor" snippets — text that actually appears in the PDF — to the rider reference entries (`data/realSources.ts`).
2. Build a viewer component with `PDFViewer` + `PDFFindController` from `pdfjs-dist/web/pdf_viewer.mjs`; serve its worker + `standard_fonts` from `web/public/pdfjs/`.
3. Replace the `<iframe>` in `PdfViewerModal` with that component; on open, dispatch a `find` for the anchor.

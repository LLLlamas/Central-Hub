# docs/

Reference docs for Central-Hub. The working map for day-to-day development is the repo-root [CLAUDE.md](../CLAUDE.md); these files hold the deeper background it points to.

## Specs & plans

- [potential-implementation.md](potential-implementation.md) — build playbook and feature scope (the original spec).
- [backend.md](backend.md) — multi-user architecture rationale + the Supabase build sheet (auth, RLS, storage, membership). **Source of truth for backend + deployment.**
- [pdf.md](pdf.md) — the in-app PDF viewer design, the (unbuilt) text-highlighting plan, and the in-house pdfjs parser design notes. Read before touching `PdfViewer.tsx` or `lib/pdfParser.ts`.
- [redesign-plan.md](redesign-plan.md) — the clarity + mobile redesign plan (landed; kept for rationale).

## Research & source data

- [tour-management-deep-research.md](tour-management-deep-research.md) — domain research: info architecture, tour lifecycle, competitor landscape.
- [research/tour-ops-field-guide.html](research/tour-ops-field-guide.html) — "How a tour works" long-form field guide (final iteration; earlier v3/v3_1 drafts deleted, recoverable from git history).
- [handoff-post-pdf-interpret.md](handoff-post-pdf-interpret.md) — the AI analysis of the rider PDF; source of the extracted rider data and the demo conflicts. Referenced by comments in `web/src/types/index.ts` and `web/src/data/mockTour.ts`.

## Audits

- [audits/2026-07-11-demo-readiness.md](audits/2026-07-11-demo-readiness.md) — pre-client-demo audit: data-consistency, edge cases, UX.
- [audits/2026-05-31-gap-analysis.md](audits/2026-05-31-gap-analysis.md) — feature gap analysis vs the spec (snapshot at commit ed3f268; several items have since shipped).
- [audits/2026-05-31-security-audits.md](audits/2026-05-31-security-audits.md) — shared-tour privacy audit + submissions/RLS audit.

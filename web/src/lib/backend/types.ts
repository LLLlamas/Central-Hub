import type { ID, Tour, Membership, MemberRole, TourGroupSummary } from '@/types';
import type { OverlayBundle } from '@/lib/overlayStorage';

export type Unsub = () => void;
export type PdfScope = 'rider' | 'doc';

export interface Backend {
  readonly kind: 'local' | 'supabase';

  // Tour: local resolves once from storage; supabase pushes on every realtime event.
  subscribeTour(tourId: ID | null, cb: (tour: Tour | null) => void): Unsub;
  saveTour(tour: Tour): Promise<void>;

  // Overlays — locks / edits / history / gear / userKey.
  loadOverlays(tourId: ID | null): Promise<OverlayBundle | null>;
  saveOverlays(tourId: ID | null, bundle: OverlayBundle): Promise<void>;

  // PDF + document bytes (IndexedDB locally, Supabase Storage on supabase).
  loadPdf(scope: PdfScope, id: string): Promise<ArrayBuffer | null>;
  savePdf(scope: PdfScope, id: string, bytes: ArrayBuffer): Promise<void>;
  deletePdf(scope: PdfScope, id: string): Promise<void>;

  clearAll(tourId: ID | null): Promise<void>;

  // ── Membership (supabase only) ──
  // The `local` backend leaves these undefined — auth/membership logic is gated
  // behind BACKEND_KIND==='supabase' so local stays byte-identical.

  /** Link auth.uid() to the seeded row matching auth.email(); returns the row. */
  claimMembership?(): Promise<Membership | null>;
  /** The caller's own membership for the active tour (drives the role-gate). */
  getMyMembership?(): Promise<Membership | null>;
  /** Full roster (active + pending) for a tour — manager-only at the DB layer. */
  listMembers?(tourId: ID): Promise<Membership[]>;
  /** Assign role + group (+ optional tags / tourPersonId) to a member. */
  setMemberRole?(
    tourId: ID,
    email: string,
    patch: { role?: MemberRole; groupId?: ID; tagIds?: ID[]; tourPersonId?: ID; status?: 'active' | 'pending' },
  ): Promise<void>;
  /** Revoke a member's access (status → revoked). TM/PM rejected by a DB guard. */
  revokeMember?(tourId: ID, email: string): Promise<void>;
  /** Seed a new pending member by email (a manager grants access). */
  addMemberByEmail?(tourId: ID, email: string, init?: { role?: MemberRole; groupId?: ID }): Promise<void>;
  /** Pending user stores a group guess + bumps nudged_at on their own row. */
  nudge?(tourId: ID, requestedGroupId?: ID): Promise<void>;
  /** Groups of the active tour, callable by any authed (incl. pending) user. */
  listActiveTourGroups?(): Promise<TourGroupSummary[]>;
}

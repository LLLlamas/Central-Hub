// Supabase backend — shared-tour, role-gated multi-user.
//
// One SHARED tours row per tour (readable by active members, writable by
// managers), addressed by the caller's membership.tour_id — NOT owner_uid = me.
// Manager-authored overlays are shared (one row per tour); the per-user viewer
// choice (`userKey`) stays client-side. PDF bytes live in the `tour-pdfs`
// Storage bucket under a TOUR-scoped path `{tourId}/{scope}/{id}.pdf` so crew
// can open the TM's rider PDF. RLS (migrations/0002_members.sql) is the guard;
// every method no-ops / returns null when there is no session or membership, so
// an unauthenticated boot never throws.
//
// The Supabase SDK + client are imported lazily so selecting this backend with
// no config (or never reaching the supabase path) doesn't pull the SDK in.

import type { ID, Tour, Membership, MemberRole, TourGroupSummary } from '@/types';
import type { Backend, PdfScope, Unsub } from './types';
import type { OverlayBundle } from '@/lib/overlayStorage';
import { stripForPersistence } from '@/lib/scratchStorage';

const PDF_BUCKET = 'tour-pdfs';

// The active tour id, cached from subscribeTour so storage paths can be
// tour-scoped without each PDF call re-querying the membership.
let activeTourId: ID | null = null;

// A fixed sentinel user_id for the single shared overlay row per tour. The
// overlays table PK is (tour_id, user_id); managers all write the same row, so
// we pin user_id to a constant. RLS gates the write to managers regardless.
const SHARED_OVERLAY_USER_ID = '00000000-0000-0000-0000-000000000000';

async function client() {
  const { getSupabaseClient } = await import('@/lib/supabase/client');
  return getSupabaseClient();
}

async function currentUid(): Promise<string | null> {
  try {
    const sb = await client();
    const { data } = await sb.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

function pdfPath(tourId: ID, scope: PdfScope, id: string): string {
  return `${tourId}/${scope}/${id}.pdf`;
}

// Map a tour_members DB row to the app Membership shape.
type MemberRow = {
  tour_id: string;
  email: string;
  user_id: string | null;
  role: MemberRole;
  status: 'pending' | 'active' | 'revoked';
  group_id: string;
  tag_ids: string[] | null;
  tour_person_id: string | null;
  display_name: string;
  requested_group_id: string | null;
  nudged_at: string | null;
  joined_at: string;
};

function rowToMembership(r: MemberRow): Membership {
  return {
    uid: r.user_id ?? '',
    tourId: r.tour_id,
    email: r.email,
    role: r.role,
    status: r.status,
    tourPersonId: r.tour_person_id ?? '',
    displayName: r.display_name,
    groupId: r.group_id,
    tagIds: r.tag_ids ?? [],
    requestedGroupId: r.requested_group_id ?? undefined,
    nudgedAt: r.nudged_at ?? undefined,
    joinedAt: r.joined_at,
  };
}

export const supabaseBackend: Backend = {
  kind: 'supabase',

  // Loads the SHARED tour for the caller's active membership, then keeps it
  // live. The callback may fire with null first (no tour/membership yet) —
  // AppState seeds a fresh scratch tour on that for a bootstrap manager. Caches
  // the tour id for tour-scoped storage paths. Realtime is best-effort.
  subscribeTour(_tourId: ID | null, cb: (tour: Tour | null) => void): Unsub {
    let cancelled = false;
    let channel: { unsubscribe: () => void } | null = null;

    (async () => {
      const uid = await currentUid();
      if (!uid || cancelled) {
        if (!cancelled) cb(null);
        return;
      }
      const sb = await client();
      // Find the caller's active membership → its tour_id is the shared tour.
      const { data: mem } = await sb
        .from('tour_members')
        .select('tour_id')
        .eq('user_id', uid)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      const tid = (mem?.tour_id as string | undefined) ?? null;
      activeTourId = tid;
      if (!tid) {
        // No active membership yet — a bootstrap manager about to seed the tour,
        // or a pending user (the role-gate keeps them off the app).
        if (!cancelled) cb(null);
        return;
      }
      const { data } = await sb
        .from('tours')
        .select('id, data')
        .eq('id', tid)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      activeTourId = (data?.id as string | undefined) ?? tid;
      cb((data?.data as Tour | undefined) ?? null);

      try {
        channel = sb
          .channel(`tours:${tid}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'tours', filter: `id=eq.${tid}` },
            (payload: { new?: { data?: Tour } }) => {
              if (cancelled) return;
              const next = payload.new?.data;
              if (next) cb(next);
            },
          )
          .subscribe();
      } catch {
        /* realtime not enabled — reads above still work */
      }
    })().catch(() => {
      if (!cancelled) cb(null);
    });

    return () => {
      cancelled = true;
      try {
        channel?.unsubscribe();
      } catch {
        /* ignore */
      }
    };
  },

  async saveTour(tour: Tour): Promise<void> {
    const uid = await currentUid();
    if (!uid) return;
    const sb = await client();
    activeTourId = tour.id;
    await sb.from('tours').upsert({
      id: tour.id,
      owner_uid: uid,
      data: stripForPersistence(tour),
      updated_at: new Date().toISOString(),
    });
  },

  async loadOverlays(tourId: ID | null): Promise<OverlayBundle | null> {
    const uid = await currentUid();
    if (!uid || !tourId) return null;
    const sb = await client();
    // Shared overlay: a single row per tour. Read the most recent one for the
    // tour (RLS already restricts to active members).
    const { data } = await sb
      .from('overlays')
      .select('data')
      .eq('tour_id', tourId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data?.data as OverlayBundle | undefined) ?? null;
  },

  async saveOverlays(tourId: ID | null, bundle: OverlayBundle): Promise<void> {
    const uid = await currentUid();
    if (!uid || !tourId) return;
    const sb = await client();
    // Shared, manager-authored overlay. `userKey` is per-user — strip it before
    // writing so one user's viewer choice doesn't overwrite everyone's.
    const { userKey: _drop, ...shared } = bundle;
    void _drop;
    await sb.from('overlays').upsert({
      tour_id: tourId,
      user_id: SHARED_OVERLAY_USER_ID,
      data: shared,
      updated_at: new Date().toISOString(),
    });
  },

  async loadPdf(scope: PdfScope, id: string): Promise<ArrayBuffer | null> {
    if (!activeTourId) return null;
    const sb = await client();
    const { data, error } = await sb.storage
      .from(PDF_BUCKET)
      .download(pdfPath(activeTourId, scope, id));
    if (error || !data) return null;
    return data.arrayBuffer();
  },

  async savePdf(scope: PdfScope, id: string, bytes: ArrayBuffer): Promise<void> {
    if (!activeTourId) return;
    const sb = await client();
    await sb.storage
      .from(PDF_BUCKET)
      .upload(pdfPath(activeTourId, scope, id), bytes, {
        contentType: 'application/pdf',
        upsert: true,
      });
  },

  async deletePdf(scope: PdfScope, id: string): Promise<void> {
    if (!activeTourId) return;
    const sb = await client();
    await sb.storage.from(PDF_BUCKET).remove([pdfPath(activeTourId, scope, id)]);
  },

  async clearAll(tourId: ID | null): Promise<void> {
    const uid = await currentUid();
    if (!uid) return;
    const sb = await client();
    const tid = tourId ?? activeTourId;
    if (tid) {
      await sb.from('tours').delete().eq('id', tid);
      await sb.from('overlays').delete().eq('tour_id', tid);
      // Remove every PDF under the tour's folder (rider + doc scopes).
      for (const scope of ['rider', 'doc'] as PdfScope[]) {
        const { data: files } = await sb.storage.from(PDF_BUCKET).list(`${tid}/${scope}`);
        if (files && files.length) {
          await sb.storage
            .from(PDF_BUCKET)
            .remove(files.map((f: { name: string }) => `${tid}/${scope}/${f.name}`));
        }
      }
    }
  },

  // ── Membership ──

  async claimMembership(): Promise<Membership | null> {
    const uid = await currentUid();
    if (!uid) return null;
    const sb = await client();
    const { data, error } = await sb.rpc('claim_membership');
    if (error || !data) return null;
    return rowToMembership(data as MemberRow);
  },

  async getMyMembership(): Promise<Membership | null> {
    const uid = await currentUid();
    if (!uid) return null;
    const sb = await client();
    // The self-read policy lets a user read their own row(s) by uid. Prefer an
    // active row; fall back to pending (so the gate can show "waiting"); ignore
    // revoked (treated as no-access → also routes to the waiting screen).
    const { data } = await sb.from('tour_members').select('*').eq('user_id', uid);
    const rows = (data ?? []) as MemberRow[];
    if (rows.length === 0) return null;
    const active = rows.find((r) => r.status === 'active');
    const pending = rows.find((r) => r.status === 'pending');
    const pick = active ?? pending ?? rows[0];
    return rowToMembership(pick);
  },

  async listMembers(tourId: ID): Promise<Membership[]> {
    const sb = await client();
    const { data } = await sb
      .from('tour_members')
      .select('*')
      .eq('tour_id', tourId)
      .order('joined_at', { ascending: true });
    return (data ?? []).map((r) => rowToMembership(r as MemberRow));
  },

  async setMemberRole(
    tourId: ID,
    email: string,
    patch: { role?: MemberRole; groupId?: ID; tagIds?: ID[]; tourPersonId?: ID; status?: 'active' | 'pending' },
  ): Promise<void> {
    const sb = await client();
    const row: Record<string, unknown> = {};
    if (patch.role !== undefined) row.role = patch.role;
    if (patch.groupId !== undefined) row.group_id = patch.groupId;
    if (patch.tagIds !== undefined) row.tag_ids = patch.tagIds;
    if (patch.tourPersonId !== undefined) row.tour_person_id = patch.tourPersonId;
    if (patch.status !== undefined) row.status = patch.status;
    await sb.from('tour_members').update(row).eq('tour_id', tourId).eq('email', email.toLowerCase());
  },

  async revokeMember(tourId: ID, email: string): Promise<void> {
    const sb = await client();
    await sb
      .from('tour_members')
      .update({ status: 'revoked' })
      .eq('tour_id', tourId)
      .eq('email', email.toLowerCase());
  },

  async addMemberByEmail(
    tourId: ID,
    email: string,
    init?: { role?: MemberRole; groupId?: ID },
  ): Promise<void> {
    const sb = await client();
    await sb.from('tour_members').upsert(
      {
        tour_id: tourId,
        email: email.toLowerCase(),
        role: init?.role ?? 'crew',
        status: 'pending',
        group_id: init?.groupId ?? '',
      },
      { onConflict: 'tour_id,email' },
    );
  },

  async nudge(_tourId: ID, requestedGroupId?: ID): Promise<void> {
    const uid = await currentUid();
    if (!uid) return;
    const sb = await client();
    // Goes through the request_access() RPC — the ONLY self-write path. It can
    // only set the nudge/requested-group hint or insert a pending crew request;
    // it can never change role/status (no direct tour_members write for members).
    await sb.rpc('request_access', { p_requested_group_id: requestedGroupId ?? null });
  },

  async listActiveTourGroups(): Promise<TourGroupSummary[]> {
    const sb = await client();
    const { data, error } = await sb.rpc('list_active_tour_groups');
    if (error || !data) return [];
    return (data as { id: string; name: string; color: string }[]).map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color,
    }));
  },
};

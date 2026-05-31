import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/state/AppState';
import { useAuth } from '@/state/AuthProvider';
import { backend, BACKEND_KIND } from '@/lib/backend';
import { isOwnerFloorRole } from '@/lib/access';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, EmptyState } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/cn';
import { fmtFullDate } from '@/lib/format';
import type { Membership, MemberRole } from '@/types';

const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: 'owner', label: 'Owner (TM)' },
  { value: 'manager', label: 'Manager' },
  { value: 'production', label: 'Production (PM)' },
  { value: 'crew', label: 'Crew' },
  { value: 'viewer', label: 'Viewer' },
];

const inputClass =
  'w-full h-9 px-2.5 text-[13px] rounded-[3px] bg-[var(--color-paper-2)]/70 border border-transparent focus:border-[var(--color-rule)] focus:bg-[var(--color-card)] outline-none';

// Manager-only screen to manage who can use the app and in what role. Reads the
// roster from the membership backend (supabase); on `local` (no real members)
// it shows an explainer instead. Assigning a role also ensures a linked
// TourPerson exists so people↔group↔role↔visibility↔calendar stay in sync.
export function AppUserPermissions() {
  const { tour, user, addTourPerson, getGroupById } = useApp();
  const { membership } = useAuth();
  const managerView = user.groupId === 'grp_mgmt' || user.groupId === 'grp_production';
  const tourId = membership?.tourId ?? tour.id;

  const [members, setMembers] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(BACKEND_KIND === 'supabase');
  const [assigning, setAssigning] = useState<Membership | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (BACKEND_KIND !== 'supabase') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await backend.listMembers?.(tourId);
      setMembers(rows ?? []);
    } finally {
      setLoading(false);
    }
  }, [tourId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const { active, pending, revoked } = useMemo(() => {
    return {
      active: members.filter((m) => m.status === 'active'),
      pending: members.filter((m) => m.status === 'pending'),
      revoked: members.filter((m) => m.status === 'revoked'),
    };
  }, [members]);

  if (!managerView) {
    return (
      <div>
        <PageHeader eyebrow="Access" title="App user permissions" />
        <Card>
          <EmptyState title="Managers only" hint="Only the TM/PM can manage who has access." />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Access"
        title="App user permissions"
        description="Who can open the app, and in what role. New people sign in and wait here until you assign their role and group."
        actions={
          <Button variant="primary" size="md" leading={<Icon.Plus size={14} />} onClick={() => setAddOpen(true)}>
            Add by email
          </Button>
        }
      />

      {BACKEND_KIND !== 'supabase' ? (
        <Card>
          <EmptyState
            title="Sign-in required for app users"
            hint="App user accounts live on the cloud backend. Run the app with the Supabase backend to invite crew, assign roles, and manage access."
          />
        </Card>
      ) : loading ? (
        <Card>
          <div className="p-6 text-[13px] text-[var(--color-ink-3)]">Loading members…</div>
        </Card>
      ) : members.length === 0 ? (
        <Card>
          <EmptyState
            title="No members yet"
            hint="Add someone by email to grant them access. They'll claim it on their next sign-in."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <MemberTable
              title={`Waiting for access (${pending.length})`}
              members={pending}
              getGroupName={(id) => getGroupById(id)?.name}
              onAssign={setAssigning}
            />
          )}
          <MemberTable
            title={`Active (${active.length})`}
            members={active}
            getGroupName={(id) => getGroupById(id)?.name}
            onAssign={setAssigning}
            onRevoke={async (m) => {
              await backend.revokeMember?.(tourId, m.email);
              await refresh();
            }}
          />
          {revoked.length > 0 && (
            <MemberTable
              title={`Revoked (${revoked.length})`}
              members={revoked}
              getGroupName={(id) => getGroupById(id)?.name}
              onAssign={setAssigning}
            />
          )}
        </div>
      )}

      {assigning && (
        <AssignModal
          member={assigning}
          tourId={tourId}
          onClose={() => setAssigning(null)}
          onSaved={async () => {
            setAssigning(null);
            await refresh();
          }}
          ensureTourPerson={(name, role, groupId) =>
            // Create a linked TourPerson if the membership has none — the
            // people↔group↔role↔calendar join point.
            addTourPerson({ name, role, groupId })
          }
        />
      )}
      {addOpen && (
        <AddMemberModal
          tourId={tourId}
          onClose={() => setAddOpen(false)}
          onAdded={async () => {
            setAddOpen(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function MemberTable({
  title,
  members,
  getGroupName,
  onAssign,
  onRevoke,
}: {
  title: string;
  members: Membership[];
  getGroupName: (id: string) => string | undefined;
  onAssign: (m: Membership) => void;
  onRevoke?: (m: Membership) => void | Promise<void>;
}) {
  return (
    <Card padded={false}>
      <div className="px-5 py-3 border-b border-[var(--color-rule-soft)] eyebrow">{title}</div>
      <table className="w-full table-fixed text-[13px]">
        <colgroup>
          <col className="w-[38%]" />
          <col className="w-[14%]" />
          <col className="w-[16%]" />
          <col className="w-[14%]" />
          <col className="w-[18%]" />
        </colgroup>
        <thead>
          <tr className="text-left text-[10.5px] font-mono uppercase tracking-[0.14em] text-[var(--color-ink-3)] border-b border-[var(--color-rule-soft)]">
            <th className="py-2 px-5">Email</th>
            <th className="py-2 px-3">Role</th>
            <th className="py-2 px-3">Group</th>
            <th className="py-2 px-3">Status</th>
            <th className="py-2 px-5"></th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const isOwnerFloor = isOwnerFloorRole(m.role);
            const requested = m.requestedGroupId ? getGroupName(m.requestedGroupId) : undefined;
            return (
              <tr key={m.email} className="border-b border-[var(--color-rule-soft)] last:border-0">
                <td className="py-2.5 px-5">
                  <div className="font-semibold text-[var(--color-ink)]">{m.displayName || m.email}</div>
                  {m.displayName && <div className="text-[11.5px] text-[var(--color-ink-3)]">{m.email}</div>}
                  {m.nudgedAt && (
                    <div className="mt-0.5 text-[11px] text-[var(--color-accent)]">
                      Nudged {fmtFullDate(m.nudgedAt.slice(0, 10))}
                      {requested ? ` · thinks they're in ${requested}` : ''}
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-3 text-[var(--color-ink-2)]">{m.role}</td>
                <td className="py-2.5 px-3 text-[var(--color-ink-2)]">
                  {getGroupName(m.groupId) ?? <span className="text-[var(--color-ink-4)]">—</span>}
                </td>
                <td className="py-2.5 px-3">
                  <Chip size="sm" tone={m.status === 'active' ? 'success' : m.status === 'pending' ? 'critical' : 'neutral'}>
                    {m.status}
                  </Chip>
                </td>
                <td className="py-2.5 px-5 text-right whitespace-nowrap">
                  <button
                    onClick={() => onAssign(m)}
                    className="text-[11.5px] font-semibold text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
                  >
                    Assign role
                  </button>
                  {onRevoke && !isOwnerFloor && (
                    <button
                      onClick={() => void onRevoke(m)}
                      className="ml-3 text-[11.5px] font-semibold text-[var(--color-accent)] hover:underline"
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow mb-1.5">{children}</div>;
}

function AssignModal({
  member,
  tourId,
  onClose,
  onSaved,
  ensureTourPerson,
}: {
  member: Membership;
  tourId: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  ensureTourPerson: (name: string, role: string, groupId: string) => string;
}) {
  const { tour } = useApp();
  const [role, setRole] = useState<MemberRole>(member.role);
  // Pre-fill with the member's group, falling back to their requested guess.
  const [groupId, setGroupId] = useState(member.groupId || member.requestedGroupId || tour.groups[0]?.id || '');
  const [busy, setBusy] = useState(false);

  const requestedName = member.requestedGroupId
    ? tour.groups.find((g) => g.id === member.requestedGroupId)?.name
    : undefined;

  async function save() {
    setBusy(true);
    try {
      // Ensure a linked TourPerson exists so visibility + calendar resolve.
      let tourPersonId = member.tourPersonId;
      if (!tourPersonId) {
        tourPersonId = ensureTourPerson(member.displayName || member.email, role, groupId);
      }
      await backend.setMemberRole?.(tourId, member.email, {
        role,
        groupId,
        tourPersonId,
        status: 'active',
      });
      await onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} eyebrow="Assign role" title={member.displayName || member.email}>
      <div className="space-y-4">
        {requestedName && (
          <div className="rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-paper-2)]/50 px-3 py-2 text-[12px] text-[var(--color-ink-3)]">
            Suggested group from their request: <span className="font-semibold text-[var(--color-ink-2)]">{requestedName}</span>
          </div>
        )}
        <div>
          <FieldLabel>Role</FieldLabel>
          <select value={role} onChange={(e) => setRole(e.target.value as MemberRole)} className={inputClass}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Group</FieldLabel>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={inputClass}>
            {tour.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={busy}>
            {member.status === 'active' ? 'Save' : 'Grant access'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AddMemberModal({
  tourId,
  onClose,
  onAdded,
}: {
  tourId: string;
  onClose: () => void;
  onAdded: () => void | Promise<void>;
}) {
  const { tour } = useApp();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('crew');
  const [groupId, setGroupId] = useState(tour.groups[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const canSave = /\S+@\S+\.\S+/.test(email.trim());

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      await backend.addMemberByEmail?.(tourId, email.trim(), { role, groupId });
      await onAdded();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} eyebrow="Add member" title="Grant access by email">
      <div className="space-y-4">
        <div>
          <FieldLabel>Email</FieldLabel>
          <input
            autoFocus
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="crew@tour.com"
            className={inputClass}
          />
          <p className="mt-1.5 text-[11.5px] text-[var(--color-ink-3)] leading-snug">
            They claim access on their next sign-in with this email.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Role</FieldLabel>
            <select value={role} onChange={(e) => setRole(e.target.value as MemberRole)} className={inputClass}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Group</FieldLabel>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={inputClass}>
              {tour.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!canSave || busy}>
            Add member
          </Button>
        </div>
      </div>
    </Modal>
  );
}

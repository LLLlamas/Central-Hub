// Pure state transitions for the rider's internal review round-trip: the TM
// sends the current draft to the review team, the reviewer marks each
// section OK or Needs changes, and the TM resolves flags (usually by editing
// the section, then sending another round). Deliberately supports many
// rounds — inventory changes, emergencies, etc. mean this isn't a one-shot
// approval. No React, no storage I/O — mirrors lib/negotiation.ts's split.

import type { ID, RiderReviewRound, RiderSection, SectionReviewMark, SectionReviewStatus, UpdateStamp } from '@/types';

function mintId(prefix: string): ID {
  return `${prefix}_${crypto.randomUUID()}`;
}

/** Start a new round from the rider's current sections — deep-cloned so later
 *  edits to the live rider don't retroactively change what was sent. */
export function createReviewRound(
  sections: RiderSection[],
  roundNumber: number,
  stamp: UpdateStamp,
): RiderReviewRound {
  return {
    id: mintId('rev'),
    roundNumber,
    sentAt: stamp,
    sectionSnapshot: sections.map((s) => structuredClone(s)),
    marks: {},
  };
}

/** Fold in the reviewer's mark for one section. Overwrites any prior mark for
 *  the same section within this round — a reviewer can change their mind
 *  before the TM acts on it. */
export function applyReviewMark(
  round: RiderReviewRound,
  sectionKey: string,
  status: SectionReviewStatus,
  note: string | undefined,
  stamp: UpdateStamp,
): RiderReviewRound {
  const mark: SectionReviewMark = { status, note, stamp };
  return { ...round, marks: { ...round.marks, [sectionKey]: mark } };
}

/** True once every section in the snapshot has been marked, and every mark is 'ok'. */
export function isRoundFullyOk(round: RiderReviewRound): boolean {
  if (round.sectionSnapshot.length === 0) return false;
  return round.sectionSnapshot.every((s) => round.marks[s.id]?.status === 'ok');
}

/** True once the reviewer has marked every section in the snapshot (regardless of status). */
export function isRoundFullyMarked(round: RiderReviewRound): boolean {
  if (round.sectionSnapshot.length === 0) return false;
  return round.sectionSnapshot.every((s) => s.id in round.marks);
}

/** Sections flagged "needs changes" in a round — what the TM still owes a response to. */
export function getFlaggedSections(round: RiderReviewRound): Array<{ section: RiderSection; mark: SectionReviewMark }> {
  return round.sectionSnapshot
    .map((section) => ({ section, mark: round.marks[section.id] }))
    .filter((row): row is { section: RiderSection; mark: SectionReviewMark } => row.mark?.status === 'needs_changes');
}

export function latestRound(rounds: RiderReviewRound[]): RiderReviewRound | undefined {
  return rounds.length > 0 ? rounds[rounds.length - 1] : undefined;
}

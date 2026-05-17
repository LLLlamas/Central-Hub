import { useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { SourceTag } from '@/components/provenance/SourceTag';
import { getScheduleItemsForDay } from '@/data/mockTour';
import type { Day, ScheduleItemType } from '@/types';
import { cn } from '@/lib/cn';

/**
 * Back-cascade ladder.
 *
 * Production days have a natural anchor — DOORS — that everything else
 * counts back from. Soundcheck starts 6 hours after load-in (rider §10
 * minimum). Load-in is N hours before soundcheck. Bus departs ~1h before
 * load-in. Lobby call is 30min before bus.
 *
 * The ladder computes those times from doors using sensible defaults,
 * then compares them against what's actually on the schedule. A green
 * checkmark means the schedule has at least as much cushion as the rider
 * minimum; a red flag means the schedule is tighter than the rider
 * minimum and would breach it.
 */

const STEPS: {
  key: ScheduleItemType;
  label: string;
  /** Minutes back from doors. Negative = before doors. */
  offsetMin: number;
}[] = [
  { key: 'lobby_call', label: 'Lobby call', offsetMin: -660 }, // -11h
  { key: 'bus_call', label: 'Bus call', offsetMin: -630 }, // -10h30
  { key: 'load_in', label: 'Load-in', offsetMin: -570 }, // -9h30
  { key: 'soundcheck', label: 'Soundcheck', offsetMin: -210 }, // -3h30 (90min + 2h buffer)
  { key: 'doors', label: 'Doors', offsetMin: 0 },
];

function parseHHMM(s: string): number {
  const [h, m] = s.split(':').map((x) => parseInt(x, 10));
  return h * 60 + m;
}
function fmtHHMM(min: number): string {
  while (min < 0) min += 24 * 60;
  const h = Math.floor((min % (24 * 60)) / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
function fmtDiff(min: number): string {
  if (min === 0) return '0';
  const sign = min > 0 ? '+' : '−';
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}m`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h${m.toString().padStart(2, '0')}`;
}

export function LobbyCallLadder({ day }: { day: Day }) {
  const items = useMemo(
    () =>
      getScheduleItemsForDay(day.id).sort((a, b) =>
        a.startTime.localeCompare(b.startTime),
      ),
    [day.id],
  );

  const doors = items.find((i) => i.type === 'doors');

  if (day.dayType !== 'show') {
    return null;
  }

  if (!doors) {
    return (
      <Card>
        <div className="eyebrow mb-2 inline-flex items-center gap-1">
          Lobby-call ladder
          <SourceTag source="rider_soundcheck" field="Soundcheck timing rule" />
        </div>
        <p className="text-[11.5px] text-[var(--color-ink-3)] leading-relaxed">
          Add a <em>doors</em> time to the schedule to back-calculate the lobby
          call, bus call, load-in and soundcheck ladder.
        </p>
      </Card>
    );
  }

  const doorsMin = parseHHMM(doors.startTime);
  const computed = STEPS.map((s) => {
    const minutes = doorsMin + s.offsetMin;
    const scheduledItem = items.find((it) => it.type === s.key);
    const scheduledMin = scheduledItem ? parseHHMM(scheduledItem.startTime) : null;
    const diffMin = scheduledMin !== null ? scheduledMin - minutes : null;
    return {
      ...s,
      computedTime: fmtHHMM(minutes),
      scheduledTime: scheduledItem?.startTime,
      diffMin,
    };
  });

  // Detect violations: soundcheck − load_in < 6h breaches rider §10.
  const sc = items.find((i) => i.type === 'soundcheck');
  const ld = items.find((i) => i.type === 'load_in');
  const breach = sc && ld ? parseHHMM(sc.startTime) - parseHHMM(ld.startTime) < 360 : false;

  return (
    <Card>
      <div className="flex items-baseline justify-between mb-2">
        <div className="eyebrow inline-flex items-center gap-1">
          Lobby-call ladder
          <SourceTag source="rider_soundcheck" field="Soundcheck timing rule" />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--color-ink-3)]">
          ⚓ doors {doors.startTime}
        </span>
      </div>

      <p className="text-[11px] text-[var(--color-ink-3)] mb-3 leading-relaxed">
        Back-cascade from doors, honoring the rider §10 minimum of 6h from
        load-in to soundcheck.
      </p>

      <ol className="space-y-0.5 text-[11.5px]">
        {computed.map((s, idx) => {
          const isAnchor = s.key === 'doors';
          return (
            <li
              key={s.key}
              className={cn(
                'flex items-baseline gap-2 py-1',
                idx !== computed.length - 1 && 'border-b border-[var(--color-rule-soft)]',
              )}
            >
              <span className="text-[var(--color-ink-2)] flex-1 leading-tight">
                {s.label}
              </span>
              <span
                className={cn(
                  'font-mono tabular shrink-0',
                  isAnchor
                    ? 'text-[var(--color-ink)] font-bold'
                    : 'text-[var(--color-ink-2)]',
                )}
              >
                {s.computedTime}
              </span>
              <DiffPill
                scheduledTime={s.scheduledTime}
                diffMin={s.diffMin}
                isAnchor={isAnchor}
              />
            </li>
          );
        })}
      </ol>

      <div className="mt-3 pt-2 border-t border-[var(--color-rule-soft)]">
        {breach ? (
          <div className="inline-flex items-start gap-1.5 text-[11px] text-[var(--color-accent)]">
            <Icon.Alert size={11} className="mt-[2px]" />
            <span className="leading-snug">
              <strong>Rider breach:</strong> soundcheck is less than 6h after
              load-in. The rider §10 minimum will not be met.
            </span>
          </div>
        ) : (
          <div className="inline-flex items-start gap-1.5 text-[11px] text-[var(--color-ink-3)]">
            <Icon.Check size={11} className="mt-[2px] text-[var(--color-moss)]" />
            <span className="leading-snug">
              Schedule meets rider §10. Δ = scheduled vs computed minimum.
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

function DiffPill({
  scheduledTime,
  diffMin,
  isAnchor,
}: {
  scheduledTime?: string;
  diffMin: number | null;
  isAnchor: boolean;
}) {
  if (isAnchor) {
    return (
      <span className="font-mono text-[9.5px] uppercase tracking-[0.10em] text-[var(--color-ink-4)] w-14 text-right shrink-0">
        anchor
      </span>
    );
  }
  if (scheduledTime === undefined || diffMin === null) {
    return (
      <span className="font-mono text-[10px] tabular text-[var(--color-ink-4)] w-14 text-right shrink-0">
        not set
      </span>
    );
  }
  // diffMin > 0 means scheduled is LATER than computed = less cushion (potentially bad)
  // diffMin < 0 means scheduled is EARLIER than computed = more cushion (good)
  const tone =
    diffMin > 30
      ? 'text-[var(--color-accent)]'
      : diffMin >= -30
      ? 'text-[var(--color-ink-3)]'
      : 'text-[var(--color-moss)]';
  return (
    <span
      className={cn(
        'font-mono text-[10px] tabular w-14 text-right shrink-0',
        tone,
      )}
      title={`Scheduled ${scheduledTime} · Δ ${fmtDiff(diffMin)}`}
    >
      {fmtDiff(diffMin)}
    </span>
  );
}

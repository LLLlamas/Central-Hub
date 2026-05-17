import { MockTag } from './MockTag';
import { SourceTag } from './SourceTag';
import type { TourPerson } from '@/types';
import type { RealSourceKey } from '@/data/realSources';
import { cn } from '@/lib/cn';

interface PersonNameProps {
  person: TourPerson;
  className?: string;
  showRole?: boolean;
}

// Map TourPerson IDs to their real-data source keys.
// Placeholders are excluded — their MockTag handles "name pending".
const personToSource: Record<string, RealSourceKey> = {
  tp_elsa: 'rider_person_elsa',
  tp_julian: 'rider_person_julian',
  tp_juan: 'rider_person_juan',
  tp_daniel: 'rider_person_daniel',
  tp_manuel: 'rider_person_manuel',
};

/**
 * Renders a person's display name.
 *
 * - Placeholders (no real name yet) → italic + (mock) tag.
 * - Real persons → bold + (i) tag pointing to the rider page where the name
 *   appears (or "user entry" for user-provided records like Lorenzo).
 */
export function PersonName({ person, className, showRole }: PersonNameProps) {
  const isPlaceholder = !!person.isPlaceholder;
  const sourceKey = personToSource[person.id];

  return (
    <span className={cn('inline-flex items-baseline gap-1.5', className)}>
      <span
        className={cn(
          isPlaceholder ? 'italic text-[var(--color-ink-3)]' : 'text-[var(--color-ink)] font-semibold',
        )}
      >
        {person.person.name}
      </span>
      {isPlaceholder ? (
        <MockTag
          source="tour_person"
          field={`Crew name placeholder — ${person.role}`}
          note={`The rider §12 reveals this role exists on the tour but no name is given. The TM will fill this in once the crew is finalized. Currently shown as the role label.`}
        />
      ) : sourceKey ? (
        <SourceTag source={sourceKey} field={person.person.name} />
      ) : null}
      {showRole && !isPlaceholder && (
        <span className="text-[11px] text-[var(--color-ink-3)]">· {person.role}</span>
      )}
    </span>
  );
}

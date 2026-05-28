import { cn } from '@/lib/cn';

// Borderless inputs that read as plain text until hovered/focused, so a dense
// review table or schedule list stays calm but every value is one click from
// editable. Disabled renders as static, locked text. Shared by RiderIngest's
// rider-section tables and the day-sheet schedule editor.

export function EditableText({
  value,
  onChange,
  disabled,
  mono = false,
  placeholder,
  className,
  invalid = false,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  mono?: boolean;
  placeholder?: string;
  className?: string;
  invalid?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'w-full min-w-0 bg-transparent rounded-[2px] px-1 py-0.5 outline-none border border-transparent',
        disabled
          ? 'cursor-default'
          : 'hover:border-[var(--color-rule)] focus:border-[var(--color-ocean)] focus:bg-[var(--color-card)]',
        invalid && 'border-[var(--color-accent)] bg-[var(--color-accent)]/8',
        mono && 'font-mono',
        className,
      )}
    />
  );
}

export function EditableSelect({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string | undefined;
  options: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <select
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'w-full min-w-0 bg-transparent rounded-[2px] px-1 py-0.5 text-[11px] uppercase tracking-[0.04em] outline-none border border-transparent',
        disabled
          ? 'cursor-default appearance-none text-[var(--color-ink-3)]'
          : 'hover:border-[var(--color-rule)] focus:border-[var(--color-ocean)] focus:bg-[var(--color-card)] cursor-pointer',
      )}
    >
      <option value="">—</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

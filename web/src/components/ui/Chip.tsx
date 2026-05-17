import type { ReactNode, CSSProperties } from 'react';
import { cn } from '@/lib/cn';

interface ChipProps {
  children: ReactNode;
  tone?: 'neutral' | 'show' | 'travel' | 'off' | 'rehearsal' | 'promo' | 'hold' | 'critical' | 'success' | 'mock';
  variant?: 'solid' | 'soft' | 'outline';
  size?: 'sm' | 'md';
  style?: CSSProperties;
  className?: string;
  uppercase?: boolean;
}

const toneVars: Record<NonNullable<ChipProps['tone']>, { color: string; bg: string; border: string }> = {
  neutral:   { color: 'var(--color-ink-2)', bg: 'var(--color-paper-2)',           border: 'var(--color-rule)' },
  show:      { color: 'var(--color-day-show)', bg: 'rgba(184,57,43,0.10)',       border: 'rgba(184,57,43,0.30)' },
  travel:    { color: 'var(--color-day-travel)', bg: 'rgba(60,90,106,0.10)',     border: 'rgba(60,90,106,0.30)' },
  off:       { color: 'var(--color-day-off)', bg: 'rgba(138,132,120,0.12)',      border: 'rgba(138,132,120,0.32)' },
  rehearsal: { color: 'var(--color-day-rehearsal)', bg: 'rgba(160,122,46,0.12)', border: 'rgba(160,122,46,0.30)' },
  promo:     { color: 'var(--color-day-promo)', bg: 'rgba(90,102,56,0.12)',      border: 'rgba(90,102,56,0.30)' },
  hold:      { color: 'var(--color-day-hold)', bg: 'rgba(184,177,160,0.18)',     border: 'rgba(184,177,160,0.40)' },
  critical:  { color: 'var(--color-accent)', bg: 'rgba(184,57,43,0.12)',         border: 'rgba(184,57,43,0.35)' },
  success:   { color: '#3a6b3a', bg: 'rgba(58,107,58,0.12)',                     border: 'rgba(58,107,58,0.30)' },
  mock:      { color: '#7a5a8a', bg: 'rgba(122,90,138,0.10)',                    border: 'rgba(122,90,138,0.35)' },
};

export function Chip({
  children,
  tone = 'neutral',
  variant = 'soft',
  size = 'sm',
  style,
  className,
  uppercase = true,
}: ChipProps) {
  const t = toneVars[tone];
  const styles: CSSProperties =
    variant === 'solid'
      ? { color: 'var(--color-paper)', background: t.color, border: `1px solid ${t.color}` }
      : variant === 'outline'
      ? { color: t.color, background: 'transparent', border: `1px solid ${t.border}` }
      : { color: t.color, background: t.bg, border: `1px solid ${t.border}` };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[3px] font-mono font-semibold whitespace-nowrap',
        size === 'sm' ? 'text-[10px] px-1.5 py-[2px] leading-[1.4]' : 'text-[11px] px-2 py-[3px] leading-[1.4]',
        uppercase && 'tracking-[0.08em] uppercase',
        className,
      )}
      style={{ ...styles, ...style }}
    >
      {children}
    </span>
  );
}

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { cn } from '@/lib/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  eyebrow?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, onClose, title, eyebrow, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof window === 'undefined' || !document.body) return null;

  const widthClass = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl';

  // Portal to document.body so the modal escapes any parent <a>/<Link>
  // that would otherwise cause invalid HTML nesting (e.g. dashboard row Links).
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(21,19,15,0.45)] backdrop-blur-[2px]"
      />

      {/* Panel */}
      <div
        className={cn(
          'relative w-full bg-[var(--color-card)] border border-[var(--color-rule)] rounded-[6px] shadow-2xl overflow-hidden',
          widthClass,
        )}
        style={{ boxShadow: '0 24px 60px rgba(21,19,15,0.22)' }}
      >
        {(title || eyebrow) && (
          <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-[var(--color-rule-soft)]">
            <div>
              {eyebrow && (
                <div className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-[#7a5a8a] mb-1">
                  {eyebrow}
                </div>
              )}
              {title && (
                <h2 className="font-display text-[18px] font-bold tracking-tight text-[var(--color-ink)]">
                  {title}
                </h2>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-[3px] text-[var(--color-ink-3)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]"
            >
              <Icon.X size={14} />
            </button>
          </header>
        )}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

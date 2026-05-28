import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

interface FileDropZoneProps {
  /** Accept attribute for the file picker, e.g. ".pdf" or ".csv". */
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  title: string;
  hint: string;
  icon?: ReactNode;
  /** `data-tour` anchor id, so the walkthrough can spotlight this zone. */
  tourAnchor?: string;
}

/**
 * Click-or-drag file upload zone. The app's first file-upload surface.
 * It hands raw File objects to `onFiles` — matching/parsing is the caller's
 * job (see lib/fixtureMatcher.ts). No FileReader: scratch mode matches by
 * filename only.
 */
export function FileDropZone({
  accept,
  multiple = false,
  onFiles,
  title,
  hint,
  icon,
  tourAnchor,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const emit = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  };

  return (
    <div
      role="button"
      tabIndex={0}
      data-tour={tourAnchor}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        emit(e.dataTransfer.files);
      }}
      className={cn(
        'card border-dashed cursor-pointer transition-colors',
        dragging
          ? 'border-[var(--color-ink-4)] bg-[var(--color-paper-2)]/60'
          : 'bg-[var(--color-paper-2)]/20 hover:border-[var(--color-rule)]',
      )}
    >
      <div className="p-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-[3px] border-2 border-dashed border-[var(--color-rule)] flex items-center justify-center text-[var(--color-ink-3)] shrink-0">
          {icon ?? <Icon.Plus size={24} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-[var(--color-ink)]">{title}</div>
          <div className="text-[12.5px] text-[var(--color-ink-3)] mt-0.5">{hint}</div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 text-[12.5px] font-semibold rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-card)] text-[var(--color-ink)]">
          <Icon.Document size={13} /> Choose file
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          emit(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

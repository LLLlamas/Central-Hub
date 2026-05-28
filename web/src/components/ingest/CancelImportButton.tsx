import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

interface CancelImportButtonProps {
  /** What is being cancelled — surfaced in the confirm modal title. */
  label: string;
  /** Extra plain-English context shown above the reason textarea. */
  detail?: string;
  onConfirm: (reason: string) => void;
  /** Customise the trigger label — defaults to "Cancel import". */
  triggerLabel?: string;
}

export function CancelImportButton({
  label,
  detail,
  onConfirm,
  triggerLabel = 'Cancel import',
}: CancelImportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        leading={<Icon.X size={12} />}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Confirm cancel"
        title={`Cancel ${label}?`}
        size="sm"
      >
        <p className="text-[12.5px] text-[var(--color-ink-3)] leading-relaxed">
          {detail ??
            `This wipes everything ${label} laid down. You can re-upload after.`}
        </p>
        <label className="mt-3 block text-[11px] uppercase tracking-[0.08em] font-mono text-[var(--color-ink-3)]">
          Reason (optional)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="e.g. wrong file, agent sent a corrected grid"
          className="mt-1 w-full text-[12.5px] border border-[var(--color-rule)] rounded-[3px] px-2 py-1.5 bg-[var(--color-paper)] focus:outline-none focus:border-[var(--color-ink-3)]"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Keep it
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onConfirm(reason.trim());
              setOpen(false);
              setReason('');
            }}
          >
            Cancel import
          </Button>
        </div>
      </Modal>
    </>
  );
}

import { useState } from 'react';
import { useApp } from '@/state/AppState';
import { backend } from '@/lib/backend';
import { classifyMediaUrl, mediaItemSrc } from '@/lib/media';
import { FileDropZone } from '@/components/ingest/FileDropZone';
import { UploadResultNote } from '@/components/ingest/UploadResultNote';
import type { UploadNote } from '@/components/ingest/UploadResultNote';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { StageMediaItem, ID } from '@/types';

// Soft client-side cap so a huge video doesn't silently hang the upload —
// mirrors the note in AppState's `addStageMedia` (that mutator trusts the
// caller to have already checked this).
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

type StageMediaInit = Omit<StageMediaItem, 'id' | 'addedAt' | 'objectUrl'>;

interface StageMediaEditorProps {
  /** Existing items for this rider section (empty when nothing added yet). */
  items: StageMediaItem[];
  /** Add one item — caller is expected to bind the owning section id, e.g.
   *  `(init) => addStageMedia(sectionId, init)`. */
  onAdd: (init: StageMediaInit) => void;
  /** Remove one item by id — e.g. `(mediaId) => removeStageMedia(sectionId, mediaId)`. */
  onRemove: (mediaId: ID) => void;
}

/**
 * Authoring side of the stage-media gallery — paste a link (Dropbox share
 * link, YouTube/Vimeo, or any URL) or upload an image/video file directly.
 * Not a spec form and not a drag-and-drop plot canvas: just attachments with
 * an optional caption, for the reserved "Stage design" rider section.
 */
export function StageMediaEditor({ items, onAdd, onRemove }: StageMediaEditorProps) {
  const { tour } = useApp();
  const [url, setUrl] = useState('');
  const [linkCaption, setLinkCaption] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState<UploadNote | null>(null);

  const handleAddLink = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    try {
      void new URL(trimmed); // validation only — classifyMediaUrl below does this same parse
    } catch {
      setNote({
        tone: 'warning',
        title: "That doesn't look like a valid link",
        detail: 'Paste a full URL — e.g. a Dropbox share link, or a YouTube/Vimeo video link.',
      });
      return;
    }
    onAdd({
      kind: classifyMediaUrl(trimmed),
      url: trimmed,
      caption: linkCaption.trim() || undefined,
    });
    setUrl('');
    setLinkCaption('');
    setNote(null);
  };

  const handleFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    // Only the first dropped file is ever added — one attachment + caption
    // at a time. Note the rest instead of silently discarding them.
    const skipped = files.length - 1;
    setNote(null);

    if (file.size > MAX_UPLOAD_BYTES) {
      setNote({
        tone: 'warning',
        title: 'That file is too big',
        detail: `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Stage media uploads are capped at 25 MB — try a smaller file, or paste a Dropbox link instead.`,
      });
      return;
    }

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      setNote({
        tone: 'warning',
        title: "That file type isn't supported here",
        detail: `"${file.name}" doesn't look like an image or video. Try a different file, or paste a link instead.`,
      });
      return;
    }

    setUploading(true);
    try {
      const docId = `stagemedia_${crypto.randomUUID()}`;
      await backend.savePdf(tour.id, 'doc', docId, await file.arrayBuffer());
      onAdd({
        kind: isImage ? 'image' : 'video',
        docId,
        mimeType: file.type,
        caption: uploadCaption.trim() || undefined,
      });
      setUploadCaption('');
      if (skipped > 0) {
        setNote({
          tone: 'warning',
          title: `Only "${file.name}" was added`,
          detail: `Stage media uploads add one file at a time — ${skipped} other file${skipped === 1 ? '' : 's'} you dropped ${skipped === 1 ? 'was' : 'were'} skipped. Drop it again to add it separately.`,
        });
      }
    } catch (err) {
      console.error('[stage media] upload failed:', err);
      setNote({
        tone: 'warning',
        title: "That upload didn't go through",
        detail: `"${file.name}" couldn't be saved. Try again, or paste a link instead.`,
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="eyebrow">Paste a link</div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Dropbox, YouTube, or Vimeo link…"
            className="flex-1 min-w-0 rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-card)] px-3 h-9 text-[13px] outline-none focus:border-[var(--color-ocean)]"
          />
          <input
            type="text"
            value={linkCaption}
            onChange={(e) => setLinkCaption(e.target.value)}
            placeholder="Caption (optional)"
            className="sm:w-48 rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-card)] px-3 h-9 text-[13px] outline-none focus:border-[var(--color-ocean)]"
          />
          <Button
            variant="primary"
            onClick={handleAddLink}
            disabled={!url.trim()}
            leading={<Icon.Plus size={13} />}
          >
            Add link
          </Button>
        </div>
        <p className="text-[11.5px] text-[var(--color-ink-3)]">
          Works best with a Dropbox share link, or a YouTube/Vimeo video — the gallery will preview it automatically.
        </p>
      </div>

      <CollapsibleSection title="Or upload a file instead" defaultOpen={false}>
        <div className="space-y-3">
          <input
            type="text"
            value={uploadCaption}
            onChange={(e) => setUploadCaption(e.target.value)}
            placeholder="Caption (optional)"
            className="w-full rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-card)] px-3 h-9 text-[13px] outline-none focus:border-[var(--color-ocean)]"
          />
          <FileDropZone
            accept="image/*,video/*"
            onFiles={handleFiles}
            title={uploading ? 'Uploading…' : 'Drop a photo or video'}
            hint="JPG, PNG, MP4, MOV — up to 25 MB"
            icon={<Icon.Image size={22} />}
          />
        </div>
      </CollapsibleSection>

      {note && <UploadResultNote {...note} onDismiss={() => setNote(null)} />}

      {items.length > 0 && (
        <div className="space-y-1.5">
          <div className="eyebrow">Added ({items.length})</div>
          <ul className="space-y-1.5">
            {items.map((item) => {
              const thumb = mediaItemSrc(item);
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-2.5 rounded-[3px] border border-[var(--color-rule-soft)] bg-[var(--color-paper-2)]/30 px-3 py-2"
                >
                  <div className="w-9 h-9 rounded-[3px] border border-[var(--color-rule)] overflow-hidden shrink-0 flex items-center justify-center bg-[var(--color-card)] text-[var(--color-ink-3)]">
                    {item.kind === 'image' && thumb ? (
                      <img src={thumb} alt="" className="w-full h-full object-cover" />
                    ) : item.kind === 'video' ? (
                      <Icon.Video size={16} />
                    ) : (
                      <Icon.Link size={16} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-[12.5px] text-[var(--color-ink-2)] truncate">
                    {item.caption || item.url || 'Uploaded file'}
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    title="Remove"
                    className="shrink-0 text-[var(--color-ink-3)] hover:text-[var(--color-accent)]"
                  >
                    <Icon.X size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

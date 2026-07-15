import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { mediaItemSrc, hasVideoExtension, youTubeEmbedUrl, vimeoEmbedUrl } from '@/lib/media';
// Reuse the existing fullscreen image lightbox built for the rider-plots
// review surface, rather than rebuilding one — see routes/Plots.tsx for the
// same import pattern.
import { PlotImageLightbox } from '@/routes/RiderBuilder';
import type { StageMediaItem, PlotImage, RiderSection } from '@/types';

interface StageMediaGalleryProps {
  items: StageMediaItem[];
}

function isDirectVideoFile(item: StageMediaItem): boolean {
  if (item.docId) return true; // a local upload is always real video bytes
  if (!item.url) return false;
  return hasVideoExtension(item.url);
}

// A synthetic section so the reused plots lightbox has a header to render —
// this gallery isn't scoped to a rider TOC section the way the Plots tab is.
const GALLERY_SECTION: RiderSection = {
  id: 'stage-media-gallery',
  type: 'stage_plot',
  status: 'pending',
  title: 'Stage media',
};

/**
 * Read-facing stage-media gallery — any role can view it. Images open the
 * shared fullscreen lightbox; recognized YouTube/Vimeo links and direct video
 * files play inline; everything else (plain links, or a video URL with no
 * clean embed) is a clickable card that opens in a new tab.
 */
export function StageMediaGallery({ items }: StageMediaGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const imageItems = useMemo(() => items.filter((i) => i.kind === 'image'), [items]);
  const plots = useMemo<PlotImage[]>(
    () =>
      imageItems.map((item, i) => ({
        page: i + 1,
        caption: item.caption || 'Stage photo',
        dataUrl: mediaItemSrc(item),
      })),
    [imageItems],
  );

  if (items.length === 0) {
    return (
      <div className="text-center py-10 px-6 border border-dashed border-[var(--color-rule)] rounded-[4px] bg-[var(--color-paper)]/40">
        <div className="font-display text-[16px] text-[var(--color-ink-2)] font-semibold">
          No stage photos or video yet
        </div>
        <p className="mt-1.5 text-[13px] text-[var(--color-ink-3)] max-w-md mx-auto">
          Paste a Dropbox link or upload a photo of the stage setup so everyone can see what's planned.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {items.map((item) => {
        if (item.kind === 'image') {
          const src = mediaItemSrc(item);
          return (
            <Card key={item.id} padded={false} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setLightboxIndex(imageItems.indexOf(item))}
                className="block w-full bg-[var(--color-paper-2)] aspect-[4/3] overflow-hidden"
                title={item.caption || 'Open image'}
              >
                {src ? (
                  <img src={src} alt={item.caption ?? ''} className="w-full h-full object-cover" />
                ) : (
                  <div className="h-full flex items-center justify-center text-[var(--color-ink-4)]">
                    <Icon.Image size={22} />
                  </div>
                )}
              </button>
              {item.caption && (
                <div className="px-3 py-2 border-t border-[var(--color-rule-soft)] text-[11.5px] text-[var(--color-ink-2)] truncate">
                  {item.caption}
                </div>
              )}
            </Card>
          );
        }

        if (item.kind === 'video') {
          const embed = item.url ? youTubeEmbedUrl(item.url) ?? vimeoEmbedUrl(item.url) : null;
          if (embed) {
            return (
              <Card key={item.id} padded={false} className="overflow-hidden">
                <div className="w-full aspect-[4/3] bg-[var(--color-paper-2)]">
                  <iframe
                    src={embed}
                    title={item.caption || 'Stage video'}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                {item.caption && (
                  <div className="px-3 py-2 border-t border-[var(--color-rule-soft)] text-[11.5px] text-[var(--color-ink-2)] truncate">
                    {item.caption}
                  </div>
                )}
              </Card>
            );
          }
          if (isDirectVideoFile(item)) {
            const src = item.docId ? item.objectUrl : item.url;
            return (
              <Card key={item.id} padded={false} className="overflow-hidden">
                <div className="w-full aspect-[4/3] bg-[var(--color-paper-2)] flex items-center justify-center">
                  {src ? (
                    <video src={src} controls className="w-full h-full object-cover" />
                  ) : (
                    <Icon.Video size={22} className="text-[var(--color-ink-4)]" />
                  )}
                </div>
                {item.caption && (
                  <div className="px-3 py-2 border-t border-[var(--color-rule-soft)] text-[11.5px] text-[var(--color-ink-2)] truncate">
                    {item.caption}
                  </div>
                )}
              </Card>
            );
          }
          // No clean embed and not a direct video file — falls through to the
          // plain link card below.
        }

        return (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[4px] border border-[var(--color-rule)] bg-[var(--color-card)] aspect-[4/3] p-4 flex flex-col items-center justify-center gap-2 text-center hover:border-[var(--color-ink-4)] transition-colors"
          >
            <Icon.Link size={20} className="text-[var(--color-ink-3)]" />
            <span className="text-[12px] font-medium text-[var(--color-ink-2)] line-clamp-3">
              {item.caption || item.url || 'Open link'}
            </span>
          </a>
        );
      })}

      <PlotImageLightbox
        open={lightboxIndex != null}
        onClose={() => setLightboxIndex(null)}
        section={GALLERY_SECTION}
        plots={plots}
        initialIndex={lightboxIndex ?? 0}
      />
    </div>
  );
}

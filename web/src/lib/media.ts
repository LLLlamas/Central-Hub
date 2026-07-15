// Pure URL classification + Dropbox link helpers for the stage-media gallery
// (the "Stage design" rider section — see `StageMediaItem` in types/index.ts).
// No React, no storage I/O — see `docId`/`objectUrl` handling in the caller
// for the locally-uploaded-file path, which never touches this module.

import type { StageMediaItem } from '@/types';

export type MediaKind = 'image' | 'video' | 'link';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'm4v'];
const VIDEO_HOSTS = ['youtube.com', 'youtu.be', 'vimeo.com'];
const DROPBOX_HOSTS = ['dropbox.com'];

function getExtension(pathname: string): string {
  const lastSegment = pathname.split('/').pop() ?? '';
  const dotIndex = lastSegment.lastIndexOf('.');
  if (dotIndex === -1) return '';
  return lastSegment.slice(dotIndex + 1).toLowerCase();
}

/** Lowercases and strips a leading `www.` — the one normalization every
 *  hostname comparison in this module needs. */
export function normalizeHost(hostname: string): string {
  const lower = hostname.toLowerCase();
  return lower.startsWith('www.') ? lower.slice(4) : lower;
}

/** True when `url`'s path ends in a known video file extension (query/hash
 *  suffixes are ignored since they're not part of `URL.pathname`). */
export function hasVideoExtension(url: string): boolean {
  try {
    return VIDEO_EXTENSIONS.includes(getExtension(new URL(url).pathname));
  } catch {
    return false;
  }
}

/**
 * Classifies a pasted URL as image / video / link for the stage-media
 * gallery. Checks file extension first, then known video-hosting domains,
 * then falls back to a Dropbox-specific default (see module notes below),
 * and finally 'link' for anything else.
 */
export function classifyMediaUrl(url: string): MediaKind {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'link';
  }

  const extension = getExtension(parsed.pathname);
  if (IMAGE_EXTENSIONS.includes(extension)) return 'image';
  if (VIDEO_EXTENSIONS.includes(extension)) return 'video';

  const hostname = normalizeHost(parsed.hostname);
  if (VIDEO_HOSTS.includes(hostname)) return 'video';

  // Dropbox share links rarely carry a real file extension in the URL — the
  // filename lives server-side. With no other signal, default to 'image'
  // since a pasted Dropbox link is this gallery's primary expected use case.
  if (DROPBOX_HOSTS.includes(hostname)) return 'image';

  return 'link';
}

/**
 * Rewrites a Dropbox share link's dl=0 / dl=1 query parameter to raw=1, so
 * the URL serves raw file bytes directly (suitable for an img/video src)
 * instead of Dropbox's HTML preview page. Non-Dropbox URLs, or Dropbox URLs
 * without a dl parameter, are returned unchanged.
 */
export function dropboxDirectUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const hostname = normalizeHost(parsed.hostname);
  if (!DROPBOX_HOSTS.includes(hostname)) return url;

  const dl = parsed.searchParams.get('dl');
  if (dl !== '0' && dl !== '1') return url;

  parsed.searchParams.delete('dl');
  parsed.searchParams.set('raw', '1');
  return parsed.toString();
}

/** Resolves a `StageMediaItem` to a displayable image/video `src`: a local
 *  upload's object URL, or a pasted link rewritten to serve raw bytes.
 *  Undefined when neither is available (e.g. an upload whose blob URL hasn't
 *  rehydrated yet, or a plain non-Dropbox link item). */
export function mediaItemSrc(item: StageMediaItem): string | undefined {
  if (item.docId) return item.objectUrl;
  if (item.url) return dropboxDirectUrl(item.url);
  return undefined;
}

/** youtube.com / youtu.be → an embeddable player URL, or null if the link
 *  doesn't carry a recognizable video id. */
export function youTubeEmbedUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = normalizeHost(u.hostname).replace(/^m\./, '');
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1);
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (host === 'youtube.com') {
    const v = u.searchParams.get('v');
    if (v) return `https://www.youtube.com/embed/${v}`;
    const match = u.pathname.match(/\/(shorts|embed)\/([^/?]+)/);
    if (match) return `https://www.youtube.com/embed/${match[2]}`;
  }
  return null;
}

/** vimeo.com/<id> → the player embed URL, or null if no numeric id is found. */
export function vimeoEmbedUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (normalizeHost(u.hostname) !== 'vimeo.com') return null;
  const match = u.pathname.match(/(\d+)/);
  return match ? `https://player.vimeo.com/video/${match[1]}` : null;
}

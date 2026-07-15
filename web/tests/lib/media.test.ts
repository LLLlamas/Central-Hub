import { describe, it, expect } from 'vitest';
import { classifyMediaUrl, dropboxDirectUrl } from '@/lib/media';

describe('classifyMediaUrl', () => {
  it('classifies an image extension as image', () => {
    expect(classifyMediaUrl('https://example.com/photos/stage-plot.png')).toBe('image');
  });

  it('classifies an image extension with query/fragment noise as image', () => {
    expect(classifyMediaUrl('https://example.com/photos/stage.JPG?size=large#top')).toBe('image');
  });

  it('classifies a video extension as video', () => {
    expect(classifyMediaUrl('https://example.com/clips/walkthrough.mp4')).toBe('video');
  });

  it('classifies a youtube.com URL as video', () => {
    expect(classifyMediaUrl('https://www.youtube.com/watch?v=abc123')).toBe('video');
  });

  it('classifies a youtu.be URL as video', () => {
    expect(classifyMediaUrl('https://youtu.be/abc123')).toBe('video');
  });

  it('classifies a vimeo.com URL as video', () => {
    expect(classifyMediaUrl('https://vimeo.com/123456789')).toBe('video');
  });

  it('defaults a bare dropbox.com share link (no extension signal) to image', () => {
    expect(classifyMediaUrl('https://www.dropbox.com/s/abc123/stage-photo?dl=0')).toBe('image');
    expect(classifyMediaUrl('https://dropbox.com/s/abc123/some-file?dl=0')).toBe('image');
  });

  it('still honors a video extension on a dropbox.com link', () => {
    expect(classifyMediaUrl('https://www.dropbox.com/s/abc123/clip.mp4?dl=0')).toBe('video');
  });

  it('falls back to link for an unrelated generic URL', () => {
    expect(classifyMediaUrl('https://example.com/spec-sheet')).toBe('link');
  });

  it('falls back to link for an unparseable URL', () => {
    expect(classifyMediaUrl('not a url')).toBe('link');
  });
});

describe('dropboxDirectUrl', () => {
  it('converts dl=0 to raw=1 while preserving the rest of the URL', () => {
    const input = 'https://www.dropbox.com/s/abc123/stage-photo.jpg?dl=0';
    const result = dropboxDirectUrl(input);
    const parsed = new URL(result);
    expect(parsed.hostname).toBe('www.dropbox.com');
    expect(parsed.pathname).toBe('/s/abc123/stage-photo.jpg');
    expect(parsed.searchParams.get('raw')).toBe('1');
    expect(parsed.searchParams.has('dl')).toBe(false);
  });

  it('converts dl=1 to raw=1 while preserving the rest of the URL', () => {
    const input = 'https://dropbox.com/s/xyz789/clip.mp4?dl=1';
    const result = dropboxDirectUrl(input);
    const parsed = new URL(result);
    expect(parsed.searchParams.get('raw')).toBe('1');
    expect(parsed.searchParams.has('dl')).toBe(false);
  });

  it('preserves other query params regardless of ordering', () => {
    const input = 'https://www.dropbox.com/s/abc123/photo.jpg?rlkey=zzz&dl=0';
    const result = dropboxDirectUrl(input);
    const parsed = new URL(result);
    expect(parsed.searchParams.get('rlkey')).toBe('zzz');
    expect(parsed.searchParams.get('raw')).toBe('1');
  });

  it('leaves a dropbox URL with no dl parameter unchanged', () => {
    const input = 'https://www.dropbox.com/s/abc123/photo.jpg';
    expect(dropboxDirectUrl(input)).toBe(input);
  });

  it('leaves a non-dropbox URL completely unchanged', () => {
    const input = 'https://example.com/photo.jpg?dl=0';
    expect(dropboxDirectUrl(input)).toBe(input);
  });
});

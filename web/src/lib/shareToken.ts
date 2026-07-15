// Lightweight token for shareable day-sheet links.
// No server-side validation — tokens are URL-safe base64 of "share:<date>".
// When a real auth backend exists, replace this module with server-issued JWTs
// and move verification server-side.

import type { ID } from '@/types';

const PREFIX = 'share:';

export function generateShareToken(date: string): string {
  return btoa(PREFIX + date).replace(/=/g, '');
}

export function verifyShareToken(date: string, token: string): boolean {
  try {
    const padded = token + '=='.slice(0, (4 - (token.length % 4)) % 4);
    return atob(padded) === PREFIX + date;
  } catch {
    return false;
  }
}

export function buildShareUrl(tourId: ID, date: string): string {
  const token = generateShareToken(date);
  return `${window.location.origin}/t/${tourId}/print/daysheet/${date}?token=${token}`;
}

// 24h "HH:MM" helpers — shared by the lobby-call ladder and the day-sheet
// schedule editor. Minutes-since-midnight is the working unit for arithmetic.

export function parseHHMM(s: string): number {
  const [h, m] = s.split(':').map((x) => parseInt(x, 10));
  return h * 60 + m;
}

export function fmtHHMM(min: number): string {
  while (min < 0) min += 24 * 60;
  const h = Math.floor((min % (24 * 60)) / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/** True for a well-formed 24h clock string ("16:00", "09:30"). Empty is not
 *  valid — callers treat an optional endTime as "blank = clear", not "00:00". */
export function isValidHHMM(s: string): boolean {
  if (!/^\d{1,2}:\d{2}$/.test(s)) return false;
  const [h, m] = s.split(':').map((x) => parseInt(x, 10));
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

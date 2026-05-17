export const MOCK_TODAY = '2025-09-25';
export const MOCK_NOW = `${MOCK_TODAY}T09:00`;

export function getTodayIso(): string {
  return MOCK_TODAY;
}

export function getGeneratedAtLabel(): string {
  return MOCK_NOW.replace('T', ' ');
}

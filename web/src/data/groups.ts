/* ============================================================
 * GROUP TAXONOMY
 * ------------------------------------------------------------
 * The standard tour-department groups (Artist, A Party, Management,
 * Production, Audio, Lighting, Video, Staff) — a reusable template
 * every tour starts with, not tour-specific fixture data. Copied
 * verbatim onto a new tour's `Tour.groups` by `createScratchTour`
 * (`data/scratchTour.ts`) so the visibility model always has the
 * same department taxonomy to key off, no matter which tour.
 * ============================================================
 */

import type { Group } from '@/types';

export const groups: Group[] = [
  { id: 'grp_artist', name: 'Artist', color: '#b8392b', description: 'The band itself.' },
  { id: 'grp_aparty', name: 'A Party', color: '#d97a4a', description: 'Artist + close circle (MUA, personal).' },
  { id: 'grp_mgmt', name: 'Management', color: '#a07a2e', description: 'Tour manager, artist manager.' },
  { id: 'grp_production', name: 'Production', color: '#5a6638', description: 'PM, stage manager.' },
  { id: 'grp_audio', name: 'Audio', color: '#3c5a6a', description: 'Front-of-house engineer (rider §6).' },
  { id: 'grp_lighting', name: 'Lighting', color: '#7a5a8a', description: 'Lighting designer.' },
  { id: 'grp_video', name: 'Video', color: '#2e6478', description: 'VJ / playback.' },
  { id: 'grp_staff', name: 'Staff', color: '#6b665c', description: 'Touring staff (rooming list §12).' },
  { id: 'grp_venue', name: 'Venue', color: '#8a3f5c', description: 'Venue house production — responds to the rider per show.' },
  { id: 'grp_rider_review', name: 'Rider Review', color: '#3f6b52', description: 'Internal team that signs off on the rider draft before it goes to venues.' },
];

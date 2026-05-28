// TypeScript declarations for pdfCore.mjs — the shared pure-algorithmic layer.

import type { RiderSectionType, StandType, MonitorType, RoomType, TourPerson } from '@/types';

export interface PItem { text: string; x: number; y: number; w: number; h: number }
export interface PPage { num: number; items: PItem[] }
export interface ColDef { label: string; minX: number; maxX: number }

export const MONTHS: Record<string, string>;
export const SECTION_HINTS: Array<{ type: RiderSectionType; re: RegExp }>;
export const COL_ALIAS: Record<string, string>;
export const STAND_MAP: Record<string, StandType>;
export const MONITOR_TYPE_MAP: Record<string, MonitorType>;
export const ROOM_TYPE_MAP: Record<string, RoomType>;

export function groupRows(items: PItem[], yTol?: number): PItem[][];
export function rowText(row: PItem[]): string;
export function buildColMap(headerRow: PItem[]): ColDef[];
export function assignCols(row: PItem[], cols: ColDef[]): Record<string, string>;
export function multiPageItems(sPages: PPage[]): PItem[];
export function headingItems(page: PPage): PItem[];
export function pageText(page: PPage): string;
export function pagesText(pages: PPage[], nums?: number[]): string;
export function parseDateToISO(text: string): string | undefined;
export function avgHeight(row: PItem[]): number;
export function personnelNameMap(personnel: TourPerson[]): Map<string, string>;
export function colAliasLookup(t: string): string | null;

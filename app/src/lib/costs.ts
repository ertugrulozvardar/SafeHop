// Turns {city}.costs.json into per-area values and price levels for the map.
import type { CostData } from '../data/types';
import { quantile } from './stats';

export type StayKind = 'entire' | 'room';
export type RentSize = 0 | 1 | 2 | 3;
export type PriceLevel = 'cheaper' | 'mid' | 'pricier' | 'none';

export interface PriceMetric {
  value: number; // USD
  count?: number; // listings behind a nightly median
  level: PriceLevel;
}

export interface PriceMetrics {
  byKey: Map<string, PriceMetric>;
  thresholds: [number, number]; // tercile cut points in USD
  median: number;
}

export const STAY_LABEL: Record<StayKind, string> = { entire: 'Entire place', room: 'Private room' };
export const RENT_LABEL: Record<RentSize, string> = { 0: 'Studio', 1: '1 bedroom', 2: '2 bedrooms', 3: '3 bedrooms' };
export const RENT_SHORT: Record<RentSize, string> = { 0: 'Studio', 1: '1 bed', 2: '2 beds', 3: '3 beds' };

/** Like the crime colors: areas are split into thirds within the same city. */
function toMetrics(values: [string, number, number?][]): PriceMetrics | null {
  if (!values.length) return null;
  const sorted = values.map((v) => v[1]).sort((a, b) => a - b);
  const t1 = quantile(sorted, 1 / 3);
  const t2 = quantile(sorted, 2 / 3);
  const byKey = new Map<string, PriceMetric>();
  for (const [key, value, count] of values) {
    byKey.set(key, { value, count, level: value <= t1 ? 'cheaper' : value <= t2 ? 'mid' : 'pricier' });
  }
  return { byKey, thresholds: [t1, t2], median: quantile(sorted, 0.5) };
}

export function stayMetrics(costs: CostData | null, kind: StayKind): PriceMetrics | null {
  if (!costs?.stay) return null;
  const values: [string, number, number][] = [];
  for (const [key, v] of Object.entries(costs.stay.areas)) {
    const p = v[kind];
    if (p) values.push([key, p[0], p[1]]);
  }
  return toMetrics(values);
}

export function rentMetrics(costs: CostData | null, size: RentSize): PriceMetrics | null {
  if (!costs?.rent) return null;
  return toMetrics(Object.entries(costs.rent.areas).map(([key, v]) => [key, v[size]]));
}

export function formatUsd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-09-19" → "Sep 2026" */
export function formatMonth(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return y && m ? `${MONTHS[m - 1]} ${y}` : iso;
}

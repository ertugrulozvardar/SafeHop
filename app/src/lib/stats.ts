import type { AreaStats, CategoryFilter, CategoryId, CityData } from '../data/types';

export type Level = 'lower' | 'moderate' | 'higher' | 'none';

export interface AreaMetric {
  key: string;
  count: number; // incidents in the whole window for the selected filter
  perKm2Month: number; // density, normalised to 30 days
  level: Level;
  ratioToMedian: number | null; // density / city median density
  byBucket: number[]; // counts per 30-day bucket for the selected filter
}

export interface CityMetrics {
  byKey: Map<string, AreaMetric>;
  thresholds: [number, number]; // tercile cut points (per km² per month)
  medianDensity: number;
  windowMonths: number;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function bucketsFor(area: AreaStats, filter: CategoryFilter, categories: CategoryId[]): number[] {
  if (filter !== 'all') return area.counts[filter] ?? [];
  const len = Math.max(0, ...categories.map((c) => area.counts[c]?.length ?? 0));
  return Array.from({ length: len }, (_, i) => sum(categories.map((c) => area.counts[c]?.[i] ?? 0)));
}

// Linear-interpolated quantile of a sorted array.
export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Colors are relative *within one city*: areas are split into thirds by incident density
 * (incidents per km² per 30 days). This keeps big, mostly-empty areas from looking safe
 * or dangerous just because of their size, and avoids comparing cities whose police
 * departments record crime differently.
 */
export function computeMetrics(city: CityData, filter: CategoryFilter): CityMetrics {
  const windowMonths = Math.max(1, city.buckets.length); // each bucket is 30 days
  const raw = city.areas.map((a) => {
    const byBucket = bucketsFor(a, filter, city.categories);
    const count = sum(byBucket);
    const perKm2Month = a.areaKm2 > 0 ? count / a.areaKm2 / windowMonths : 0;
    return { key: a.key, count, perKm2Month, byBucket };
  });

  const densities = raw.filter((r) => r.count > 0).map((r) => r.perKm2Month).sort((x, y) => x - y);
  const t1 = quantile(densities, 1 / 3);
  const t2 = quantile(densities, 2 / 3);
  const median = quantile(densities, 0.5);

  const byKey = new Map<string, AreaMetric>();
  for (const r of raw) {
    let level: Level;
    if (r.count === 0 || densities.length === 0) level = r.count === 0 && densities.length > 0 ? 'lower' : 'none';
    else if (r.perKm2Month <= t1) level = 'lower';
    else if (r.perKm2Month <= t2) level = 'moderate';
    else level = 'higher';
    byKey.set(r.key, {
      ...r,
      level,
      ratioToMedian: median > 0 ? r.perKm2Month / median : null,
    });
  }
  return { byKey, thresholds: [t1, t2], medianDensity: median, windowMonths };
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function formatDensity(n: number): string {
  if (n === 0) return '0';
  if (n < 0.1) return '<0.1';
  if (n < 10) return n.toFixed(1);
  return Math.round(n).toLocaleString('en-US');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(iso: string, withYear = true): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return withYear ? `${MONTHS[m - 1]} ${d}, ${y}` : `${MONTHS[m - 1]} ${d}`;
}

export function formatRange(start: string, end: string): string {
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${formatDate(start, !sameYear)} – ${formatDate(end)}`;
}

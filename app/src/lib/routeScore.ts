// Scores a route by the reported-incident density of the areas it passes through.
import type { CityMetrics, Level } from './stats';
import { type AreaLocator, type LatLng, lengthByArea } from './geo';

export interface RouteAreaPart {
  key: string;
  name: string;
  km: number;
  level: Level;
  density: number; // incidents per km² per month (selected category)
}

export interface RouteScore {
  totalKm: number;
  coveredKm: number; // part of the route inside the city's areas
  /**
   * Reports "along the way": Σ (km travelled in an area × that area's incidents per km² per month).
   * Grows with both distance and how busy the areas are, so a long detour only wins if it really avoids
   * the busier areas. Used to rank routes.
   */
  exposure: number;
  /** Length-weighted incidents per km² per month along the covered part of the route. */
  avgDensity: number | null;
  /** avgDensity divided by the city's typical (median) area. */
  relative: number | null;
  /** Fraction of the route's length in each level ('outside' = beyond the city's areas). */
  share: Record<Level | 'outside', number>;
  areas: RouteAreaPart[]; // in travel order
}

export function scoreRoute(coords: LatLng[], locator: AreaLocator, metrics: CityMetrics): RouteScore {
  const { totalKm, outsideKm, spans } = lengthByArea(coords, locator);
  const share: RouteScore['share'] = { lower: 0, moderate: 0, higher: 0, none: 0, outside: 0 };
  const areas: RouteAreaPart[] = [];
  let exposure = 0;
  let covered = 0;
  for (const s of spans) {
    const m = metrics.byKey.get(s.key);
    const level: Level = m?.level ?? 'none';
    const density = m?.perKm2Month ?? 0;
    const name = locator.areas.find((a) => a.key === s.key)?.name ?? s.key;
    areas.push({ key: s.key, name, km: s.km, level, density });
    share[level] += s.km;
    exposure += density * s.km;
    covered += s.km;
  }
  share.outside = outsideKm;
  const denom = totalKm || 1;
  (Object.keys(share) as (keyof typeof share)[]).forEach((k) => (share[k] = share[k] / denom));
  const avgDensity = covered > 0 ? exposure / covered : null;
  return {
    totalKm,
    coveredKm: covered,
    exposure,
    avgDensity,
    relative: avgDensity !== null && metrics.medianDensity > 0 ? avgDensity / metrics.medianDensity : null,
    share,
    areas,
  };
}

interface Rankable {
  id: string;
  kind?: 'direct' | 'detour';
  durationMin: number;
  score: RouteScore;
}

/** A detour must have at least this much lower crime along the way than the fastest route to be offered. */
export const DETOUR_MIN_GAIN = 0.03;

export interface RouteChoice<T> {
  /** Lowest reported crime along the way (per km² per month, weighted by distance). */
  safest: T | null;
  /** Highest reported crime along the way; null if there is only one route. */
  leastSafe: T | null;
  fastest: T | null;
  /** How much lower the safest route's crime level is than the least safe one's (0.3 = 30 % lower). */
  gain: number | null;
}

/**
 * Picks the safest and the least safe route by the crime rate of the areas each route passes through.
 * Total time is shown next to each, so people can weigh a safer route against a longer trip.
 * Detours we generated are only considered if they are actually safer than the fastest route.
 */
export function chooseRoutes<T extends Rankable>(routes: T[]): RouteChoice<T> {
  const rated = routes.filter((r) => r.score.avgDensity !== null);
  const fastest = routes.length ? routes.reduce((a, b) => (b.durationMin < a.durationMin ? b : a)) : null;
  if (!rated.length) return { safest: fastest, leastSafe: null, fastest, gain: null };
  const rate = (r: T) => r.score.avgDensity as number;
  const fastestRated = rated.reduce((a, b) => (b.durationMin < a.durationMin ? b : a));
  const pool = rated.filter((r) => r.kind !== 'detour' || rate(r) < rate(fastestRated) * (1 - DETOUR_MIN_GAIN));
  const safest = pool.reduce((a, b) => (rate(b) < rate(a) || (rate(b) === rate(a) && b.durationMin < a.durationMin) ? b : a));
  const worst = pool.reduce((a, b) => (rate(b) > rate(a) || (rate(b) === rate(a) && b.durationMin > a.durationMin) ? b : a));
  const leastSafe = worst.id === safest.id ? null : worst;
  const gain = leastSafe && rate(leastSafe) > 0 ? 1 - rate(safest) / rate(leastSafe) : null;
  return { safest, leastSafe, fastest, gain };
}

/** Crime level along a route compared with the areas of the same city (same thirds as the map colors). */
export function routeLevel(score: RouteScore, thresholds: [number, number]): Level {
  if (score.avgDensity === null) return 'none';
  if (score.avgDensity <= thresholds[0]) return 'lower';
  if (score.avgDensity <= thresholds[1]) return 'moderate';
  return 'higher';
}

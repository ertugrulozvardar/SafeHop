// Route planning: asks a Valhalla-compatible routing API for a few realistic routes between two points,
// including detours through areas with fewer reports, so they can be compared by the reports along the way.
import { USER_AGENT } from '../config';
import {
  type AreaLocator,
  type LatLng,
  distanceKm,
  decodePolyline,
  lengthByArea,
  overlap,
  pathCells,
  ringCentroid,
  sideOf,
} from '../lib/geo';

export type TravelMode = 'walk' | 'drive';

export interface PlannedRoute {
  id: string;
  kind: 'direct' | 'detour';
  coords: LatLng[];
  distanceKm: number;
  durationMin: number;
  /** The routing service included a ferry (it only does that when there is no other way). */
  hasFerry: boolean;
}

export class RoutingError extends Error {}

const MODE = {
  walk: {
    costing: 'pedestrian',
    costing_options: { pedestrian: { use_ferry: 0 } },
    maxStraightDetour: 1.3, // via point may add up to 30 % to the straight-line distance
    maxDurationFactor: 1.4, // keep routes that take at most 40 % longer than the fastest
  },
  drive: {
    costing: 'auto',
    costing_options: { auto: { use_ferry: 0 } },
    maxStraightDetour: 1.4,
    maxDurationFactor: 1.5,
  },
} as const;

// The free community routing server allows at most one request per second.
const MIN_GAP_MS = 1100;
let nextSlot = 0;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AbortError());
    const t = setTimeout(done, ms);
    function done() {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }
    function onAbort() {
      clearTimeout(t);
      reject(new AbortError());
    }
    signal?.addEventListener('abort', onAbort);
  });
}

export class AbortError extends Error {
  constructor() {
    super('Aborted');
    this.name = 'AbortError';
  }
}

export const isAbort = (e: unknown) => e instanceof AbortError || (e as Error)?.name === 'AbortError';

async function throttle(signal?: AbortSignal) {
  const now = Date.now();
  const start = Math.max(now, nextSlot);
  nextSlot = start + MIN_GAP_MS;
  if (start > now) await sleep(start - now, signal);
}

interface ValhallaLocation {
  lat: number;
  lon: number;
  type?: 'break' | 'through' | 'via';
}

function friendlyError(code: number | undefined, status: number): string {
  if (code === 154 || code === 155 || code === 156 || code === 157)
    return 'This trip is too long for these directions. Try a shorter trip or switch to Drive.';
  if (code === 171) return 'Couldn’t find a street or path near one of the points. Try moving it closer to a street.';
  if (code === 170 || code === 442) return 'No route could be found between these two points.';
  if (status === 429) return 'The route service is busy. Please wait a few seconds and try again.';
  return 'The route service didn’t respond. Please try again in a moment.';
}

async function requestRoutes(
  url: string,
  locations: ValhallaLocation[],
  mode: TravelMode,
  alternates: number,
  signal: AbortSignal
): Promise<Omit<PlannedRoute, 'id' | 'kind'>[]> {
  await throttle(signal);
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal.addEventListener('abort', onAbort);
  const timer = setTimeout(() => controller.abort(), 20000);
  const { costing, costing_options } = MODE[mode];
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': USER_AGENT },
      body: JSON.stringify({
        locations,
        costing,
        costing_options,
        alternates,
        directions_type: 'maneuvers', // no text instructions; maneuver types tell us about ferries
        units: 'kilometers',
        shape_format: 'polyline6',
      }),
      signal: controller.signal,
    });
  } catch {
    if (signal.aborted) throw new AbortError();
    throw new RoutingError(friendlyError(undefined, 0));
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok || !json?.trip) throw new RoutingError(friendlyError(json?.error_code, res.status));
  const trips = [json.trip, ...((json.alternates ?? []) as any[]).map((a) => a.trip)].filter(Boolean);
  return trips.map((trip: any) => {
    const coords: LatLng[] = [];
    for (const leg of trip.legs ?? []) {
      const pts = decodePolyline(leg.shape ?? '', 6);
      coords.push(...(coords.length ? pts.slice(1) : pts));
    }
    const hasFerry = (trip.legs ?? []).some((leg: any) =>
      (leg.maneuvers ?? []).some((m: any) => m.type === 28 || m.type === 29 || m.travel_type === 'ferry')
    );
    return {
      coords,
      distanceKm: Number(trip.summary?.length) || 0,
      durationMin: (Number(trip.summary?.time) || 0) / 60,
      hasFerry,
    };
  });
}

const toLoc = (p: LatLng, type?: ValhallaLocation['type']): ValhallaLocation => ({
  lat: Number(p.latitude.toFixed(6)),
  lon: Number(p.longitude.toFixed(6)),
  ...(type ? { type } : {}),
});

/** Length-weighted density of the areas along a path (null if it's outside every area). */
function pathDensity(coords: LatLng[], locator: AreaLocator, densityOf: (key: string) => number | null): number | null {
  const { spans } = lengthByArea(coords, locator, 0.05);
  let w = 0;
  let km = 0;
  for (const s of spans) {
    const d = densityOf(s.key);
    if (d === null) continue;
    w += d * s.km;
    km += s.km;
  }
  return km > 0 ? w / km : null;
}

/**
 * Picks up to two points inside areas with clearly fewer reports than the direct route, close enough to the
 * straight line between start and end that a detour through them is realistic. Prefers one on each side.
 */
export function pickDetourPoints(
  from: LatLng,
  to: LatLng,
  mode: TravelMode,
  locator: AreaLocator,
  densityOf: (key: string) => number | null,
  baseline: number,
  usedKeys: Set<string>,
  maxDensity = Infinity
): LatLng[] {
  const D = distanceKm(from, to);
  if (D < 0.6 || baseline <= 0) return [];
  const maxDetour = MODE[mode].maxStraightDetour;
  const fromArea = locator.locate(from)?.key;
  const toArea = locator.locate(to)?.key;

  const candidates: { p: LatLng; cost: number; side: number }[] = [];
  for (const area of locator.areas) {
    if (usedKeys.has(area.key) || area.key === fromArea || area.key === toArea) continue;
    const d = densityOf(area.key);
    // Only clearly quieter areas: well below the direct route's average and not above the city's typical area.
    if (d === null || d >= baseline * 0.8 || d > maxDensity) continue;
    let best: { p: LatLng; detour: number } | null = null;
    for (const rings of area.polys) {
      const outer = rings[0];
      const [cx, cy] = ringCentroid(outer);
      const stride = Math.max(1, Math.floor(outer.length / 60));
      const pts: [number, number][] = [[cx, cy]];
      for (let i = 0; i < outer.length; i += stride) {
        const [x, y] = outer[i];
        pts.push([x + (cx - x) * 0.25, y + (cy - y) * 0.25]); // a bit inside the edge
      }
      for (const [x, y] of pts) {
        const p = { latitude: y, longitude: x };
        const detour = (distanceKm(from, p) + distanceKm(p, to)) / D;
        if (detour > maxDetour || (best && detour >= best.detour)) continue;
        if (!locator.contains(area, p)) continue;
        best = { p, detour };
      }
    }
    if (best) candidates.push({ p: best.p, cost: d / baseline + 1.5 * (best.detour - 1), side: sideOf(from, to, best.p) });
  }
  candidates.sort((a, b) => a.cost - b.cost);
  const picked: LatLng[] = [];
  const first = candidates[0];
  if (!first) return picked;
  picked.push(first.p);
  const other =
    candidates.find((c) => c.side !== 0 && c.side !== first.side) ??
    candidates.find((c) => c !== first && distanceKm(c.p, first.p) > D * 0.25);
  if (other) picked.push(other.p);
  return picked;
}

/**
 * Finds routes from → to. Calls `onUpdate` as soon as the direct routes arrive and again after each
 * detour, so the UI can show results progressively. Throws RoutingError if no route can be found.
 */
export async function planRoutes(params: {
  url: string;
  from: LatLng;
  to: LatLng;
  mode: TravelMode;
  locator: AreaLocator;
  densityOf: (key: string) => number | null;
  signal: AbortSignal;
  onUpdate?: (routes: PlannedRoute[], refining: boolean) => void;
}): Promise<PlannedRoute[]> {
  const { url, from, to, mode, locator, densityOf, signal, onUpdate } = params;
  const routes: (PlannedRoute & { cells: Set<string> })[] = [];
  let n = 0;
  const add = (r: Omit<PlannedRoute, 'id' | 'kind'>, kind: PlannedRoute['kind']) => {
    if (r.coords.length < 2) return false;
    const fastest = routes.length ? Math.min(...routes.map((x) => x.durationMin)) : r.durationMin;
    if (kind === 'detour' && r.durationMin > fastest * MODE[mode].maxDurationFactor) return false;
    const cells = pathCells(r.coords);
    const dup = routes.find((x) => overlap(x.cells, cells) > 0.85);
    if (dup) {
      if (r.durationMin < dup.durationMin) Object.assign(dup, r, { cells });
      return false;
    }
    routes.push({ ...r, id: `r${++n}`, kind, cells });
    return true;
  };
  const publish = (refining: boolean) => onUpdate?.(routes.map(({ cells, ...r }) => r), refining);

  const direct = await requestRoutes(url, [toLoc(from), toLoc(to)], mode, 2, signal);
  direct.sort((a, b) => a.durationMin - b.durationMin).forEach((r) => add(r, 'direct'));
  if (!routes.length) throw new RoutingError('No route could be found between these two points.');

  const baseline = pathDensity(routes[0].coords, locator, densityOf);
  const used = new Set<string>();
  for (const r of routes) for (const s of lengthByArea(r.coords, locator, 0.05).spans) if (s.km > 0.2) used.add(s.key);
  const all = locator.areas.map((a) => densityOf(a.key)).filter((d): d is number => d !== null && d > 0).sort((x, y) => x - y);
  const median = all.length ? all[Math.floor(all.length / 2)] : Infinity;
  const vias = baseline === null ? [] : pickDetourPoints(from, to, mode, locator, densityOf, baseline, used, median);
  publish(vias.length > 0);

  for (let i = 0; i < vias.length; i++) {
    try {
      const [r] = await requestRoutes(url, [toLoc(from), toLoc(vias[i], 'through'), toLoc(to)], mode, 0, signal);
      if (r) add(r, 'detour');
    } catch (e) {
      if (isAbort(e)) throw e;
      // A failed detour is not a problem: we still have the direct routes.
    }
    publish(i < vias.length - 1);
  }
  return routes.map(({ cells, ...r }) => r);
}

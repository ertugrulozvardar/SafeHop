// Small, dependency-free geometry helpers used by the route planner.
import type { AreaCollection, AreaFeature } from '../data/types';

export interface LatLng {
  latitude: number;
  longitude: number;
}

type Ring = [number, number][]; // [lng, lat]
type Polygon = Ring[]; // outer ring + holes

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (d: number) => (d * Math.PI) / 180;

export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function pathLengthKm(coords: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += distanceKm(coords[i - 1], coords[i]);
  return total;
}

/** Decodes an encoded polyline (Valhalla uses precision 6, Google precision 5). */
export function decodePolyline(str: string, precision = 6): LatLng[] {
  const factor = 10 ** precision;
  const out: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < str.length) {
    for (let which = 0; which < 2; which++) {
      let result = 0;
      let shift = 0;
      let b: number;
      do {
        b = str.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20 && index < str.length);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta;
      else lng += delta;
    }
    out.push({ latitude: lat / factor, longitude: lng / factor });
  }
  return out;
}

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygons(x: number, y: number, polys: Polygon[]): boolean {
  for (const rings of polys) {
    if (!inRing(x, y, rings[0])) continue;
    let inHole = false;
    for (let h = 1; h < rings.length; h++) {
      if (inRing(x, y, rings[h])) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }
  return false;
}

export interface LocatedArea {
  key: string;
  name: string;
  polys: Polygon[];
  bbox: [number, number, number, number]; // minLng, minLat, maxLng, maxLat
}

function polygonsOf(f: AreaFeature): Polygon[] {
  return f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
}

/** Finds which area (neighborhood / precinct) a point is in. */
export class AreaLocator {
  readonly areas: LocatedArea[];
  private last = -1;

  constructor(collection: AreaCollection) {
    this.areas = collection.features.map((f) => {
      const polys = polygonsOf(f);
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const rings of polys)
        for (const [x, y] of rings[0]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      return { key: f.properties.key, name: f.properties.name, polys, bbox: [minX, minY, maxX, maxY] };
    });
  }

  private hit(i: number, x: number, y: number): boolean {
    const a = this.areas[i];
    const [minX, minY, maxX, maxY] = a.bbox;
    return x >= minX && x <= maxX && y >= minY && y <= maxY && inPolygons(x, y, a.polys);
  }

  locate(p: LatLng): LocatedArea | null {
    const x = p.longitude;
    const y = p.latitude;
    if (this.last >= 0 && this.hit(this.last, x, y)) return this.areas[this.last];
    for (let i = 0; i < this.areas.length; i++) {
      if (i !== this.last && this.hit(i, x, y)) {
        this.last = i;
        return this.areas[i];
      }
    }
    return null;
  }

  contains(area: LocatedArea, p: LatLng): boolean {
    return inPolygons(p.longitude, p.latitude, area.polys);
  }

  /**
   * The area whose boundary is closest to `p`, if within `maxKm`. Boundaries are clipped at the shoreline and
   * simplified, so waterfront paths, piers and bridges can fall just outside every area.
   */
  nearest(p: LatLng, maxKm: number): LocatedArea | null {
    const kx = 111.32 * Math.cos(toRad(p.latitude)); // km per degree of longitude
    const ky = 110.57; // km per degree of latitude
    const dx = maxKm / kx;
    const dy = maxKm / ky;
    let best: LocatedArea | null = null;
    let bestD = maxKm;
    for (const a of this.areas) {
      const [minX, minY, maxX, maxY] = a.bbox;
      if (p.longitude < minX - dx || p.longitude > maxX + dx || p.latitude < minY - dy || p.latitude > maxY + dy) continue;
      for (const rings of a.polys) {
        const ring = rings[0];
        for (let i = 1; i < ring.length; i++) {
          // point-to-segment distance in a local flat projection (fine at these distances)
          const ax = (ring[i - 1][0] - p.longitude) * kx;
          const ay = (ring[i - 1][1] - p.latitude) * ky;
          const bx = (ring[i][0] - p.longitude) * kx;
          const by = (ring[i][1] - p.latitude) * ky;
          const vx = bx - ax;
          const vy = by - ay;
          const len2 = vx * vx + vy * vy;
          const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * vx + ay * vy) / len2)) : 0;
          const d = Math.hypot(ax + t * vx, ay + t * vy);
          if (d < bestD) {
            bestD = d;
            best = a;
          }
        }
      }
    }
    return best;
  }
}

/** Points this close to an area's edge (but outside every area) are counted in that area. */
export const SHORE_SNAP_KM = 0.2;

export interface AreaSpan {
  key: string;
  km: number;
}

/**
 * Splits a path into the distance travelled inside each area. The path is sampled every `stepKm`
 * (25 m by default), which is far finer than any area boundary.
 */
export function lengthByArea(
  coords: LatLng[],
  locator: AreaLocator,
  stepKm = 0.025
): { totalKm: number; outsideKm: number; spans: AreaSpan[] } {
  const byKey = new Map<string, number>();
  const order: string[] = [];
  let total = 0;
  let outside = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const seg = distanceKm(a, b);
    if (seg === 0) continue;
    total += seg;
    const n = Math.max(1, Math.ceil(seg / stepKm));
    const part = seg / n;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const p = {
        latitude: a.latitude + (b.latitude - a.latitude) * t,
        longitude: a.longitude + (b.longitude - a.longitude) * t,
      };
      const area = locator.locate(p) ?? locator.nearest(p, SHORE_SNAP_KM);
      if (!area) {
        outside += part;
        continue;
      }
      if (!byKey.has(area.key)) order.push(area.key);
      byKey.set(area.key, (byKey.get(area.key) ?? 0) + part);
    }
  }
  return { totalKm: total, outsideKm: outside, spans: order.map((key) => ({ key, km: byKey.get(key) ?? 0 })) };
}

/** Area-weighted centroid of a ring ([lng, lat]); falls back to the vertex average. */
export function ringCentroid(ring: Ring): [number, number] {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j];
    const [x1, y1] = ring[i];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-12) {
    const n = ring.length || 1;
    return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/** Which side of the line a→b point p is on (+1 left, −1 right, 0 on it). */
export function sideOf(a: LatLng, b: LatLng, p: LatLng): number {
  const v = (b.longitude - a.longitude) * (p.latitude - a.latitude) - (b.latitude - a.latitude) * (p.longitude - a.longitude);
  return Math.sign(v);
}

/** Coarse grid cells (~50 m) a path passes through; used to spot near-identical routes. */
export function pathCells(coords: LatLng[], stepKm = 0.04): Set<string> {
  const cells = new Set<string>();
  const add = (p: LatLng) => cells.add(`${Math.round(p.latitude / 0.00045)}:${Math.round(p.longitude / 0.0006)}`);
  if (coords.length) add(coords[0]);
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const n = Math.max(1, Math.ceil(distanceKm(a, b) / stepKm));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      add({ latitude: a.latitude + (b.latitude - a.latitude) * t, longitude: a.longitude + (b.longitude - a.longitude) * t });
    }
  }
  return cells;
}

/** Share of the smaller path's cells that the other path also uses (1 = same route). */
export function overlap(a: Set<string>, b: Set<string>): number {
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  if (!small.size) return 0;
  let shared = 0;
  for (const c of small) if (big.has(c)) shared++;
  return shared / small.size;
}

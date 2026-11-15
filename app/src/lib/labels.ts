// Price labels on the map: where each area's label sits, and which labels fit on screen at the current zoom.
import type { AreaCollection } from '../data/types';

export interface LatLngPoint {
  latitude: number;
  longitude: number;
}

export interface MapRegion extends LatLngPoint {
  latitudeDelta: number;
  longitudeDelta: number;
}

type Ring = [number, number][];

const ringArea = (ring: Ring, k: number) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] * k - ring[i][0] * k) * (ring[j][1] + ring[i][1]);
  return Math.abs(a / 2);
};

function inRing([x, y]: [number, number], ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function edgeDistance([x, y]: [number, number], rings: Ring[], k: number) {
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ax = ring[j][0] * k, ay = ring[j][1];
      const bx = ring[i][0] * k, by = ring[i][1];
      const px = x * k;
      const dx = bx - ax, dy = by - ay;
      const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0;
      const d = Math.hypot(px - (ax + t * dx), y - (ay + t * dy));
      if (d < best) best = d;
    }
  }
  return best;
}

/**
 * A point well inside each area (its largest part), so a label never lands outside a curved or
 * hollow neighborhood: the inside point farthest from the edges among the centroid and a 16×16 grid.
 */
export function labelPoints(areas: AreaCollection): Map<string, LatLngPoint> {
  const out = new Map<string, LatLngPoint>();
  for (const f of areas.features) {
    const polygons = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as Ring[][];
    if (!polygons.length || !polygons[0][0]?.length) continue;
    const k = Math.cos((polygons[0][0][0][1] * Math.PI) / 180); // shrink longitude so distances are roughly even
    const rings = polygons.reduce((best, p) => (ringArea(p[0], k) > ringArea(best[0], k) ? p : best), polygons[0]);
    const outer = rings[0];
    const inside = (pt: [number, number]) => inRing(pt, outer) && !rings.slice(1).some((h) => inRing(pt, h));

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let cx = 0, cy = 0, a2 = 0;
    for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
      const [x0, y0] = outer[j];
      const [x1, y1] = outer[i];
      minX = Math.min(minX, x1); maxX = Math.max(maxX, x1);
      minY = Math.min(minY, y1); maxY = Math.max(maxY, y1);
      const c = x0 * y1 - x1 * y0;
      cx += (x0 + x1) * c;
      cy += (y0 + y1) * c;
      a2 += c;
    }
    let best: [number, number] = [(minX + maxX) / 2, (minY + maxY) / 2];
    let bestD = -1;
    const consider = (pt: [number, number]) => {
      if (!inside(pt)) return;
      const d = edgeDistance(pt, rings, k);
      if (d > bestD) {
        bestD = d;
        best = pt;
      }
    };
    if (a2) consider([cx / (3 * a2), cy / (3 * a2)]);
    const n = 16;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) consider([minX + ((i + 0.5) * (maxX - minX)) / n, minY + ((j + 0.5) * (maxY - minY)) / n]);
    out.set(f.properties.key, { latitude: best[1], longitude: best[0] });
  }
  return out;
}

export interface LabelCandidate extends LatLngPoint {
  key: string;
  width: number; // px
  priority: number; // higher first
}

/**
 * Greedy placement: labels are taken in priority order and kept only if they are on screen, clear of the
 * overlays and don't overlap a label already placed. Zooming in leaves more room, so more labels appear.
 */
export function placeLabels(
  items: LabelCandidate[],
  region: MapRegion,
  size: { width: number; height: number },
  insets: { top: number; bottom: number },
  { height = 26, gap = 4, max = 40 } = {}
): Set<string> {
  const placed: [number, number, number, number][] = [];
  const keys = new Set<string>();
  if (!size.width || !size.height || !region.latitudeDelta || !region.longitudeDelta) return keys;
  const west = region.longitude - region.longitudeDelta / 2;
  const north = region.latitude + region.latitudeDelta / 2;
  for (const it of [...items].sort((a, b) => b.priority - a.priority)) {
    if (keys.size >= max) break;
    const x = ((it.longitude - west) / region.longitudeDelta) * size.width;
    const y = ((north - it.latitude) / region.latitudeDelta) * size.height;
    const box: [number, number, number, number] = [x - it.width / 2 - gap, y - height / 2 - gap, x + it.width / 2 + gap, y + height / 2 + gap];
    if (box[0] < 0 || box[2] > size.width || box[1] < insets.top || box[3] > size.height - insets.bottom) continue;
    if (placed.some((p) => box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1])) continue;
    placed.push(box);
    keys.add(it.key);
  }
  return keys;
}

/** Rough pill width for a price label (13 pt bold digits) so overlap checks need no text measuring. */
export const labelWidth = (text: string, withIcon: boolean) => Math.round(18 + text.length * 7.8 + (withIcon ? 14 : 0));

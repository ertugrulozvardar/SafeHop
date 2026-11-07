// Place search for the route planner (Photon-compatible API, OpenStreetMap data).
import { USER_AGENT } from '../config';
import type { LatLng } from '../lib/geo';

export interface Place {
  id: string;
  title: string;
  detail: string;
  coord: LatLng;
}

/** bbox = [minLng, minLat, maxLng, maxLat] of the city; results are limited to it. */
export async function searchPlaces(
  url: string,
  query: string,
  bbox: [number, number, number, number],
  signal: AbortSignal
): Promise<Place[]> {
  const [minX, minY, maxX, maxY] = bbox;
  const pad = 0.02;
  const params = [
    `q=${encodeURIComponent(query.trim())}`,
    'limit=6',
    'lang=en',
    `bbox=${[minX - pad, minY - pad, maxX + pad, maxY + pad].map((n) => n.toFixed(4)).join(',')}`,
    `lat=${((minY + maxY) / 2).toFixed(4)}`,
    `lon=${((minX + maxX) / 2).toFixed(4)}`,
  ].join('&');
  const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}${params}`, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    signal,
  });
  if (!res.ok) throw new Error(`Search failed (HTTP ${res.status})`);
  const json = (await res.json()) as { features?: any[] };
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const [i, f] of (json.features ?? []).entries()) {
    const [lng, lat] = f?.geometry?.coordinates ?? [];
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    const p = f.properties ?? {};
    const street = [p.housenumber, p.street].filter(Boolean).join(' ');
    const title: string = p.name || street || p.label || p.city || query;
    const detail = unique([p.name ? street : '', p.district || p.locality, p.city, p.state].filter(Boolean))
      .filter((s) => s !== title)
      .join(', ');
    const key = `${title}|${detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: `${p.osm_type ?? ''}${p.osm_id ?? i}`, title, detail, coord: { latitude: lat, longitude: lng } });
  }
  return out;
}

const unique = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) === i);

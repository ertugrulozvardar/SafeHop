// Hands a route over to Apple Maps or Google Maps for turn-by-turn navigation.
// Neither app accepts a full route shape, so we pass a few stops along SafeHop's route; the maps app then
// routes through them and follows (very nearly) the same path.
import { Platform } from 'react-native';
import type { TravelMode } from '../data/routing';
import { distanceKm, type LatLng, pathLengthKm } from './geo';

/** Evenly spaced points along the route (by distance), excluding the start and end. */
export function pickWaypoints(coords: LatLng[]): LatLng[] {
  if (coords.length < 3) return [];
  const totalKm = pathLengthKm(coords);
  const count = totalKm < 1.5 ? 1 : totalKm < 4 ? 2 : 3; // 3 = the most Google Maps accepts in a browser
  const targets = Array.from({ length: count }, (_, i) => ((i + 1) / (count + 1)) * totalKm);
  const out: LatLng[] = [];
  let travelled = 0;
  let t = 0;
  for (let i = 1; i < coords.length && t < targets.length; i++) {
    travelled += distanceKm(coords[i - 1], coords[i]);
    while (t < targets.length && travelled >= targets[t]) {
      out.push(coords[i]);
      t++;
    }
  }
  return out;
}

const ll = (p: LatLng) => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`;

/** Apple's unified Maps URLs (iOS 18.4+) support stops; older versions only get start and destination. */
function supportsAppleWaypoints(): boolean {
  if (Platform.OS !== 'ios') return false;
  const [major = 0, minor = 0] = String(Platform.Version).split('.').map(Number);
  return major > 18 || (major === 18 && minor >= 4);
}

export function appleMapsUrl(from: LatLng, to: LatLng, waypoints: LatLng[], mode: TravelMode): string {
  if (!supportsAppleWaypoints()) {
    return `https://maps.apple.com/?saddr=${ll(from)}&daddr=${ll(to)}&dirflg=${mode === 'walk' ? 'w' : 'd'}`;
  }
  const params = [
    `source=${encodeURIComponent(ll(from))}`,
    `destination=${encodeURIComponent(ll(to))}`,
    ...waypoints.map((w) => `waypoint=${encodeURIComponent(ll(w))}`),
    `mode=${mode === 'walk' ? 'walking' : 'driving'}`,
  ];
  return `https://maps.apple.com/directions?${params.join('&')}`;
}

export function googleMapsUrl(from: LatLng, to: LatLng, waypoints: LatLng[], mode: TravelMode): string {
  const params = [
    'api=1',
    `origin=${encodeURIComponent(ll(from))}`,
    `destination=${encodeURIComponent(ll(to))}`,
    `travelmode=${mode === 'walk' ? 'walking' : 'driving'}`,
  ];
  if (waypoints.length) params.push(`waypoints=${encodeURIComponent(waypoints.map(ll).join('|'))}`);
  return `https://www.google.com/maps/dir/?${params.join('&')}`;
}

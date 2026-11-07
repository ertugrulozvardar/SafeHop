import type { LatLng } from 'react-native-maps';
import type { AreaCollection } from '../data/types';

export interface Shape {
  key: string;
  polys: { outer: LatLng[]; holes: LatLng[][] }[];
}

const toLatLng = (ring: [number, number][]): LatLng[] => ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));

/** GeoJSON areas → react-native-maps polygon coordinates. */
export function toShapes(areas: AreaCollection): Shape[] {
  return areas.features.map((f) => {
    const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    return {
      key: f.properties.key,
      polys: polygons.map((rings) => ({ outer: toLatLng(rings[0]), holes: rings.slice(1).map(toLatLng) })),
    };
  });
}

/** Initial map region that shows the whole city. */
export function regionForBbox([minLng, minLat, maxLng, maxLat]: [number, number, number, number]) {
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: (maxLat - minLat) * 1.2,
    longitudeDelta: (maxLng - minLng) * 1.2,
  };
}

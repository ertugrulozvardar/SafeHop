// Shapes of the JSON files produced by data-pipeline/build.mjs.

export type CategoryId =
  | 'pickpocket'
  | 'car_breakin'
  | 'theft'
  | 'robbery'
  | 'assault'
  | 'burglary'
  | 'vehicle_theft';

export type CategoryFilter = CategoryId | 'all';

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (inclusive)
}

export interface AreaStats {
  key: string;
  name: string;
  sub: string;
  areaKm2: number;
  /** Incident counts per category, one number per 30-day bucket (oldest first). */
  counts: Record<CategoryId, number[]>;
}

export interface CityData {
  version: number;
  id: string;
  name: string;
  state: string;
  generatedAt: string;
  latestRecord: string;
  window: DateRange;
  buckets: DateRange[];
  categories: CategoryId[];
  bbox: [number, number, number, number]; // minLng, minLat, maxLng, maxLat
  totals: { all: number; byCat: Record<CategoryId, number>; unassigned: number };
  areas: AreaStats[];
  source: { agency: string; url: string; areaUnit: string };
  notes: string[];
  stale?: boolean;
  staleReason?: string;
}

type Ring = [number, number][];
export interface AreaFeature {
  type: 'Feature';
  properties: { key: string; name: string };
  geometry: { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };
}

export interface AreaCollection {
  type: 'FeatureCollection';
  features: AreaFeature[];
}

export interface CityIndexEntry {
  id: string;
  name: string;
  state: string;
  window: DateRange;
  latestRecord: string;
  generatedAt: string;
  stale: boolean;
  areaCount: number;
  total: number;
  files: { data: string; areas: string; costs?: string };
}

export interface DataIndex {
  version: number;
  generatedAt: string;
  categories: CategoryId[];
  cities: CityIndexEntry[];
  /** Optional endpoints for the route planner (see data-pipeline/build.mjs). */
  services?: { routing?: string; geocoding?: string };
}

/** [median nightly price in USD, number of listings] */
export type StayValue = [number, number];

/** Living costs per area, from data-pipeline/src/costs.mjs ({city}.costs.json). */
export interface CostData {
  version: number;
  id: string;
  generatedAt: string;
  stay: null | {
    source: string;
    url: string;
    license: string;
    snapshot: string; // YYYY-MM-DD the listings were collected
    listings: number;
    longStayShare: number; // share of listings that require stays of 30+ nights
    city: { entire: number | null; room: number | null };
    areas: Record<string, { entire?: StayValue; room?: StayValue }>;
  };
  rent: null | {
    source: string;
    url: string;
    fy: number; // HUD fiscal year
    /** Monthly rent in USD for studio, 1, 2 and 3 bedrooms. */
    areas: Record<string, [number, number, number, number]>;
  };
}

// ─── 1) Where the app downloads data from ────────────────────────────────────
// After you push this project to GitHub and the "Update crime data" workflow has run,
// replace YOUR_GITHUB_USERNAME below with your GitHub username (README, step 3).
// (Optional: you can override it with EXPO_PUBLIC_DATA_URL in app/.env.)
const DEFAULT_DATA_URL = 'https://ertugrulozvardar.github.io/SafeHop/data/v1';

export const DATA_URL = (process.env.EXPO_PUBLIC_DATA_URL || DEFAULT_DATA_URL).replace(/\/+$/, '');
export const DATA_URL_CONFIGURED = !DATA_URL.includes('YOUR_GITHUB_USERNAME');

// Privacy policy page (published by the same workflow from docs/privacy.html).
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL || DATA_URL.replace(/\/data\/v1$/, '/privacy.html');

// ─── 2) Route planner services ───────────────────────────────────────────────
// Full endpoint URLs of a Valhalla-compatible routing API and a Photon-compatible place search API.
// The published index.json can override these ("services"), so the provider can be switched without an
// app update. The free community servers below ask for light use (routing: max 1 request per second).
export const DEFAULT_ROUTING_URL = process.env.EXPO_PUBLIC_ROUTING_URL || 'https://valhalla1.openstreetmap.de/route';
export const DEFAULT_GEOCODING_URL = process.env.EXPO_PUBLIC_GEOCODING_URL || 'https://photon.komoot.io/api/';
export const SERVICE_OVERRIDE = Boolean(process.env.EXPO_PUBLIC_ROUTING_URL || process.env.EXPO_PUBLIC_GEOCODING_URL);

// Identifies the app to the routing / search servers, as their usage policies require.
export const USER_AGENT = 'SafeHop/1.1 (+https://ertugrulozvardar.github.io/SafeHop/)';

// Cities the app knows about, in display order. Data for each comes from the pipeline.
export const CITY_LIST: { id: string; name: string; state: string; tagline: string }[] = [
  { id: 'chicago', name: 'Chicago', state: 'IL', tagline: '77 community areas' },
  { id: 'la', name: 'Los Angeles', state: 'CA', tagline: '21 LAPD divisions' },
  { id: 'nyc', name: 'New York City', state: 'NY', tagline: 'All 5 boroughs, by NYPD precinct' },
  { id: 'miami', name: 'Miami', state: 'FL', tagline: 'City of Miami (not Miami Beach)' },
  { id: 'seattle', name: 'Seattle', state: 'WA', tagline: '58 police neighborhoods' },
];

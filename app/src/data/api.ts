import { DATA_URL, DATA_URL_CONFIGURED, DEFAULT_GEOCODING_URL, DEFAULT_ROUTING_URL, SERVICE_OVERRIDE } from '../config';
import { bundled, bundledIndex } from './bundled';
import type { AreaCollection, CityData, DataIndex } from './types';

export type DataOrigin = 'online' | 'offline-copy';

export class DataUnavailableError extends Error {}

const cache = new Map<string, unknown>();

async function getJson<T>(path: string, timeoutMs = 15000): Promise<T> {
  const url = `${DATA_URL}/${path}`;
  if (cache.has(url)) return cache.get(url) as T;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as T;
    cache.set(url, json);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

export async function loadIndex(): Promise<{ index: DataIndex | null; origin: DataOrigin | null }> {
  if (DATA_URL_CONFIGURED) {
    try {
      return { index: await getJson<DataIndex>('index.json'), origin: 'online' };
    } catch {
      // fall through to the bundled copy
    }
  }
  return { index: bundledIndex, origin: bundledIndex ? 'offline-copy' : null };
}

export async function loadCity(
  id: string
): Promise<{ data: CityData; areas: AreaCollection; origin: DataOrigin }> {
  if (DATA_URL_CONFIGURED) {
    try {
      const [data, areas] = await Promise.all([
        getJson<CityData>(`${id}.json`),
        getJson<AreaCollection>(`${id}.areas.json`),
      ]);
      return { data, areas, origin: 'online' };
    } catch (err) {
      if (!bundled[id]) {
        throw new DataUnavailableError(
          `Couldn't download the latest data. Check your connection and try again. (${(err as Error).message})`
        );
      }
    }
  }
  const local = bundled[id];
  if (local) return { ...local, origin: 'offline-copy' };
  throw new DataUnavailableError(
    DATA_URL_CONFIGURED
      ? 'Data for this city is not available yet.'
      : 'The data source is not configured yet. Set EXPO_PUBLIC_DATA_URL (see README).'
  );
}

export interface ServiceConfig {
  routingUrl: string;
  geocodingUrl: string;
}

/** Route planner endpoints: app env override > published index.json > built-in defaults. */
export async function loadServices(): Promise<ServiceConfig> {
  const fallback = { routingUrl: DEFAULT_ROUTING_URL, geocodingUrl: DEFAULT_GEOCODING_URL };
  if (SERVICE_OVERRIDE) return fallback;
  try {
    const { index } = await loadIndex();
    const s = index?.services;
    return {
      routingUrl: s?.routing || fallback.routingUrl,
      geocodingUrl: s?.geocoding || fallback.geocodingUrl,
    };
  } catch {
    return fallback;
  }
}

export function clearCache() {
  cache.clear();
}

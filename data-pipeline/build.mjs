#!/usr/bin/env node
// SafeHop data builder.
//
// Usage:
//   node build.mjs                       # all cities → ../site/data/v1
//   node build.mjs --cities chicago,la   # only some cities
//   node build.mjs --app-snapshot        # also copy the result into the app (offline fallback)
//   node build.mjs --previous https://<user>.github.io/SafeHop/data/v1
//                                        # if a city fails, reuse its last published file
//
// Env: SOCRATA_APP_TOKEN (optional, raises API rate limits), SAFEHOP_PREVIOUS_BASE.

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CITIES, CATEGORIES, buildCity, fetchJson } from './src/pipeline.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const ORDER = ['chicago', 'la', 'nyc', 'miami', 'seattle'];

function parseArgs(argv) {
  const args = { out: join(repoRoot, 'site', 'data', 'v1'), cities: null, appSnapshot: false, previous: process.env.SAFEHOP_PREVIOUS_BASE || null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = resolve(argv[++i]);
    else if (a === '--cities') args.cities = argv[++i].split(',').map((s) => s.trim());
    else if (a === '--app-snapshot') args.appSnapshot = true;
    else if (a === '--previous') args.previous = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log('node build.mjs [--cities a,b] [--out dir] [--app-snapshot] [--previous baseUrl]');
      process.exit(0);
    } else throw new Error(`Unknown argument ${a}`);
  }
  if (args.previous) args.previous = args.previous.replace(/\/+$/, '');
  return args;
}

const json = (obj) => JSON.stringify(obj);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const selected = CITIES.filter((c) => !args.cities || args.cities.includes(c.id)).sort(
    (a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id)
  );
  if (!selected.length) throw new Error('No matching cities');

  await mkdir(args.out, { recursive: true });
  const ctx = { log: (m) => console.log(m), socrataAppToken: process.env.SOCRATA_APP_TOKEN, now: new Date() };

  const index = {
    version: 1,
    generatedAt: ctx.now.toISOString(),
    categories: CATEGORIES,
    cities: [],
    // Endpoints the app's route planner uses. Served from here so they can be switched (e.g. to a paid
    // provider or a self-hosted server) without shipping an app update.
    services: {
      routing: process.env.SAFEHOP_ROUTING_URL || 'https://valhalla1.openstreetmap.de/route',
      geocoding: process.env.SAFEHOP_GEOCODING_URL || 'https://photon.komoot.io/api/',
    },
  };
  const results = {};
  const failed = [];

  for (const city of selected) {
    const t0 = Date.now();
    try {
      const { data, geojson } = await buildCity(city, ctx);
      results[city.id] = { data, geojson };
      console.log(`[${city.id}] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch (err) {
      console.error(`[${city.id}] FAILED: ${err.stack || err.message}`);
      if (args.previous) {
        try {
          const data = await fetchJson(`${args.previous}/${city.id}.json`);
          const geojson = await fetchJson(`${args.previous}/${city.id}.areas.json`);
          data.stale = true;
          data.staleReason = `Source unavailable on ${ctx.now.toISOString().slice(0, 10)}; showing last published data.`;
          results[city.id] = { data, geojson };
          console.warn(`[${city.id}] reusing previously published data`);
          continue;
        } catch (e2) {
          console.error(`[${city.id}] no previous data available: ${e2.message}`);
        }
      }
      failed.push(city.id);
    }
  }

  for (const city of selected) {
    const r = results[city.id];
    if (!r) continue;
    await writeFile(join(args.out, `${city.id}.json`), json(r.data));
    await writeFile(join(args.out, `${city.id}.areas.json`), json(r.geojson));
    index.cities.push({
      id: r.data.id,
      name: r.data.name,
      state: r.data.state,
      window: r.data.window,
      latestRecord: r.data.latestRecord,
      generatedAt: r.data.generatedAt,
      stale: Boolean(r.data.stale),
      areaCount: r.data.areas.length,
      total: r.data.totals.all,
      files: { data: `${city.id}.json`, areas: `${city.id}.areas.json` },
    });
  }
  await writeFile(join(args.out, 'index.json'), json(index));
  console.log(`Wrote ${index.cities.length} cities to ${args.out}`);

  if (args.appSnapshot) await writeAppSnapshot(index, results);

  if (failed.length) {
    console.error(`Cities without data: ${failed.join(', ')}`);
    process.exit(1);
  }
}

// Copies the data into the Expo app so it works offline / before GitHub Pages is set up.
async function writeAppSnapshot(index, results) {
  const appData = join(repoRoot, 'app', 'assets', 'data');
  await rm(appData, { recursive: true, force: true });
  await mkdir(appData, { recursive: true });
  await writeFile(join(appData, 'index.json'), json(index));
  const lines = [];
  for (const c of index.cities) {
    const r = results[c.id];
    await writeFile(join(appData, `${c.id}.json`), json(r.data));
    await writeFile(join(appData, `${c.id}.areas.json`), json(r.geojson));
    lines.push(
      `  ${JSON.stringify(c.id)}: { data: require('../../assets/data/${c.id}.json'), areas: require('../../assets/data/${c.id}.areas.json') },`
    );
  }
  const ts = `// AUTO-GENERATED by data-pipeline/build.mjs --app-snapshot. Do not edit by hand.
/* eslint-disable @typescript-eslint/no-require-imports */
import type { AreaCollection, CityData, DataIndex } from './types';

export const bundledIndex: DataIndex | null = require('../../assets/data/index.json');

export const bundled: Record<string, { data: CityData; areas: AreaCollection }> = {
${lines.join('\n')}
};
`;
  await writeFile(join(repoRoot, 'app', 'src', 'data', 'bundled.ts'), ts);
  console.log(`App snapshot written (${index.cities.length} cities)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { inflateRawSync } from 'node:zlib';
import {
  airbnbListingsUrl,
  buildCosts,
  hudFiscalYear,
  hudSafmrUrl,
  latestAirbnbSnapshot,
  parseCsv,
  parseXlsx,
  rentByZip,
  summarizeRent,
  summarizeStay,
  zipWeights,
} from '../src/costs.mjs';

const fixture = (name) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
const inflate = (b) => new Uint8Array(inflateRawSync(b));

// Two 1 km × 1 km squares side by side (west = "A", east = "B").
const sq = (x0, y0, d) => [[[x0, y0], [x0 + d, y0], [x0 + d, y0 + d], [x0, y0 + d], [x0, y0]]];
const D = 0.01;
const areas = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { key: 'A', name: 'West' }, geometry: { type: 'Polygon', coordinates: sq(-87.7, 41.8, D) } },
    { type: 'Feature', properties: { key: 'B', name: 'East' }, geometry: { type: 'Polygon', coordinates: sq(-87.69, 41.8, D) } },
  ],
};

test('parseCsv handles quotes, escaped quotes, commas and newlines in fields', () => {
  const rows = parseCsv('a,b,c\r\n1,"x, ""quoted""\nline",3\n4,,6');
  assert.deepEqual(rows, [['a', 'b', 'c'], ['1', 'x, "quoted"\nline', '3'], ['4', '', '6']]);
});

test('parseXlsx reads inline strings (openpyxl) and shared strings incl. rich text and entities', async () => {
  const a = await parseXlsx(fixture('safmr-sample.xlsx'), inflate);
  assert.equal(a[0][0], 'ZIP\nCode');
  assert.equal(a[1][0], '60601');
  assert.equal(a[2][2], 'Chicago & Co <test>');
  assert.equal(a[3][0], '60603');
  const b = await parseXlsx(fixture('safmr-shared-strings.xlsx'), inflate);
  assert.deepEqual(b[0], ['ZIP\nCode', 'Name', 'SAFMR 0BR', 'SAFMR 1BR', 'SAFMR 2BR', 'SAFMR 3BR', 'SAFMR 4BR']);
  assert.deepEqual(b[1], ['60601', 'Chicago & Co', '1500', '1700', '2100', '2600', '3000']);
  assert.equal(b[2][1], ''); // missing cell keeps its column position
  assert.equal(b[2][3], '1650.5');
});

test('rentByZip finds the HUD columns, pads ZIPs and averages duplicate ZIPs', async () => {
  const rents = rentByZip(await parseXlsx(fixture('safmr-sample.xlsx'), inflate));
  assert.deepEqual(rents.get('60601'), [1800, 2000, 2500, 3100, 3500]);
  assert.deepEqual(rents.get('60603'), [1000, 1200, 1500, 1900, 2100]);
  assert.deepEqual(rents.get('02134'), [2000, 2200, 2600, 3200, 3600]);
  const rents2 = rentByZip(await parseXlsx(fixture('safmr-shared-strings.xlsx'), inflate));
  assert.deepEqual(rents2.get('98101'), [1400, 1650.5, 2000, 2500, 2900]);
});

test('summarizeStay: medians per area and room type, filters inactive / long-stay / implausible listings', () => {
  const header = 'id,name,neighbourhood,latitude,longitude,room_type,price,minimum_nights,number_of_reviews_ltm';
  const lines = [header];
  // area A (x≈-87.695): ten entire places 100..190, ten private rooms 50..95, one hotel room (ignored)
  [100, 110, 120, 130, 140, 150, 160, 170, 180, 190].forEach((p, i) => lines.push(`${i},"Nice, cozy",x,41.805,-87.695,Entire home/apt,$${p}.00,2,3`));
  [50, 55, 60, 65, 70, 75, 80, 85, 90, 95].forEach((p, i) => lines.push(`r${i},Room,x,41.805,-87.695,Private room,${p},1,1`));
  lines.push('h1,Hotel,x,41.805,-87.695,Hotel room,$400,1,9');
  // excluded: no reviews in 12 months, >30 night minimum, absurd price, shared room, outside both areas
  lines.push('x1,Old,x,41.805,-87.695,Entire home/apt,$999,2,0');
  lines.push('x2,Long,x,41.805,-87.695,Entire home/apt,$999,31,5');
  lines.push('x3,Odd,x,41.805,-87.695,Entire home/apt,"$9,999.00",2,5');
  lines.push('x4,Shared,x,41.805,-87.695,Shared room,$20,1,5');
  lines.push('x5,Far,x,40.0,-80.0,Entire home/apt,$100,1,5');
  // area B: only 3 listings → below the minimum, no value
  [200, 210, 220].forEach((p, i) => lines.push(`b${i},B,x,41.805,-87.685,Entire home/apt,$${p},30,2`));
  const s = summarizeStay(lines.join('\n'), areas);
  assert.deepEqual(s.areas.A, { entire: [145, 10], room: [73, 10] }); // medians 145 and 72.5 → rounded
  assert.equal(s.areas.B, undefined);
  assert.equal(s.listings, 23);
  assert.equal(s.longStayShare, Math.round((3 / 23) * 100) / 100);
  assert.equal(s.city.entire, 160); // city median includes areas below the per-area minimum
});

test('zipWeights + summarizeRent: area-weighted ZIP rents rounded to $10', () => {
  // ZIP 1 covers all of A and the west half of B; ZIP 2 covers the east half of B.
  const zips = [
    { type: 'Feature', properties: { zip: '00001' }, geometry: { type: 'Polygon', coordinates: [[[-87.71, 41.79], [-87.685, 41.79], [-87.685, 41.82], [-87.71, 41.82], [-87.71, 41.79]]] } },
    { type: 'Feature', properties: { zip: '00002' }, geometry: { type: 'Polygon', coordinates: [[[-87.685, 41.79], [-87.67, 41.79], [-87.67, 41.82], [-87.685, 41.82], [-87.685, 41.79]]] } },
  ];
  const w = zipWeights(areas, zips, 0.05);
  assert.ok(Math.abs(w.A['00001'] - 1) < 1e-9);
  assert.ok(Math.abs(w.B['00001'] - 0.5) < 0.06 && Math.abs(w.B['00002'] - 0.5) < 0.06);
  const rents = new Map([
    ['00001', [1000, 1200, 1500, 1900, 2000]],
    ['00002', [2000, 2400, 3000, 3800, 4000]],
  ]);
  const r = summarizeRent(w, rents);
  assert.deepEqual(r.A, [1000, 1200, 1500, 1900]);
  assert.ok(Math.abs(r.B[1] - 1800) <= 80);
  assert.equal(r.B[1] % 10, 0);
  // a ZIP without HUD data covering most of an area → no value
  assert.equal(summarizeRent({ X: { '00009': 0.8, '00001': 0.2 } }, rents).X, undefined);
});

test('source helpers: snapshot discovery, URLs and HUD fiscal years', () => {
  const html = `<a href="https://data.insideairbnb.com/united-states/il/chicago/2026-06-17/visualisations/listings.csv">x</a>
    <a href="https://data.insideairbnb.com/united-states/il/chicago/2026-09-19/data/listings.csv.gz">y</a>
    <a href="https://data.insideairbnb.com/united-states/ny/new-york-city/2026-10-01/visualisations/listings.csv">z</a>`;
  assert.equal(latestAirbnbSnapshot(html, 'united-states/il/chicago'), '2026-09-19');
  assert.equal(latestAirbnbSnapshot(html, 'united-states/wa/seattle'), null);
  assert.equal(airbnbListingsUrl('united-states/il/chicago', '2026-09-19'), 'https://data.insideairbnb.com/united-states/il/chicago/2026-09-19/visualisations/listings.csv');
  assert.equal(hudFiscalYear(new Date('2026-09-30T12:00:00Z')), 2026);
  assert.equal(hudFiscalYear(new Date('2026-10-01T00:00:00Z')), 2027);
  assert.equal(hudSafmrUrl(2027), 'https://www.huduser.gov/portal/datasets/fmr/fmr2027/FY27_safmrs.xlsx');
});

test('buildCosts reuses fresh previous data without downloading, and keeps old data when a source fails', async () => {
  const now = new Date('2026-11-14T10:00:00Z');
  let calls = 0;
  const io = {
    fetchText: async () => { calls++; throw new Error('offline'); },
    fetchBytes: async () => { calls++; throw new Error('offline'); },
    fetchJson: async () => { calls++; throw new Error('offline'); },
    inflateRaw: inflate,
    log: () => {},
    cache: new Map(),
  };
  const previous = {
    stay: { snapshot: '2026-09-19', checkedAt: '2026-11-10T09:00:00Z', areas: { A: { entire: [120, 5] } } },
    rent: { fy: 2027, areas: { A: [1000, 1200, 1500, 1900] } },
  };
  const fresh = await buildCosts({ cityId: 'chicago', geojson: areas, previous, now, io });
  assert.equal(calls, 0);
  assert.deepEqual(fresh.stay, previous.stay);
  assert.deepEqual(fresh.rent, previous.rent);

  const stale = { stay: { ...previous.stay, checkedAt: '2026-10-01T00:00:00Z' }, rent: { fy: 2026, areas: {} } };
  const kept = await buildCosts({ cityId: 'chicago', geojson: areas, previous: stale, now, io });
  assert.ok(calls > 0);
  assert.deepEqual(kept.stay, stale.stay); // failed refresh → previous data kept
  assert.deepEqual(kept.rent, stale.rent);

  const miami = await buildCosts({ cityId: 'miami', geojson: areas, previous: null, now, io });
  assert.equal(miami.stay, null); // no Inside Airbnb data for Miami
});

test('buildCosts downloads and summarises new editions (Inside Airbnb + HUD) end to end', async () => {
  const now = new Date('2026-11-14T10:00:00Z');
  const csv = ['id,latitude,longitude,room_type,price,minimum_nights,number_of_reviews_ltm']
    .concat(Array.from({ length: 12 }, (_, i) => `${i},41.805,-87.695,Entire home/apt,$${100 + i * 10},2,4`))
    .join('\n');
  const seen = [];
  const io = {
    fetchText: async (url) => {
      seen.push(url);
      if (url.includes('get-the-data')) return '<a href="https://data.insideairbnb.com/united-states/il/chicago/2026-09-19/visualisations/listings.csv">';
      if (url.endsWith('/2026-09-19/visualisations/listings.csv')) return csv;
      throw new Error(`unexpected ${url}`);
    },
    fetchBytes: async (url) => {
      seen.push(url);
      if (url.endsWith('FY27_safmrs.xlsx')) return fixture('safmr-sample.xlsx');
      throw new Error('404');
    },
    fetchJson: async (url) => {
      seen.push(url);
      return {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { ZCTA5CE20: '60601' }, geometry: { type: 'Polygon', coordinates: sq(-87.705, 41.795, 0.02) } },
        ],
      };
    },
    inflateRaw: inflate,
    log: () => {},
    cache: new Map(),
  };
  const c = await buildCosts({ cityId: 'chicago', geojson: areas, previous: null, now, io });
  assert.equal(c.stay.snapshot, '2026-09-19');
  assert.deepEqual(c.stay.areas.A, { entire: [155, 12] });
  assert.equal(c.stay.license, 'CC BY 4.0');
  assert.equal(c.rent.fy, 2027);
  assert.deepEqual(c.rent.areas.A, [1800, 2000, 2500, 3100]);
  assert.deepEqual(c.rent.areas.B, [1800, 2000, 2500, 3100]);
  assert.ok(seen.some((u) => u.includes('HUD_PDR_Small_Area_Fair_Market_Rents/FeatureServer/0/query?')));
});

// Living-cost layers for each city, summarised per area (neighborhood / precinct / division):
//   • stay — median nightly price of short-term rentals (Inside Airbnb, CC BY 4.0, refreshed ~quarterly)
//   • rent — typical monthly rent by bedroom count (HUD Small Area Fair Market Rents, by ZIP, yearly)
//
// Everything here is plain JavaScript without Node-specific imports, so it also runs in a browser for testing.
// Network access and decompression are passed in by the caller (see build.mjs).

import { pointInPolygons, toPolygons } from './pipeline.mjs';

const DAY = 86400000;

// ---------------------------------------------------------------------------
// Small parsers
// ---------------------------------------------------------------------------

/** RFC 4180 CSV → array of rows (handles quotes, escaped quotes and newlines inside quotes). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodeXml = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : XML_ENTITIES[e] ?? m
  );

/**
 * Minimal .xlsx reader: returns the cells of the first worksheet as an array of rows (strings).
 * `inflateRaw(bytes)` must return the raw-deflate-decompressed bytes (Promise or value).
 */
export async function parseXlsx(bytes, inflateRaw) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  // End of central directory record
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a zip/xlsx file');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entries = new Map();
  const utf8 = new TextDecoder('utf-8');
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Bad central directory');
    const method = dv.getUint16(p + 10, true);
    const size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    const name = utf8.decode(u8.subarray(p + 46, p + 46 + nameLen));
    entries.set(name, { method, size, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  const read = async (name) => {
    const e = entries.get(name);
    if (!e) return null;
    const lh = e.offset;
    if (dv.getUint32(lh, true) !== 0x04034b50) throw new Error(`Bad local header for ${name}`);
    const start = lh + 30 + dv.getUint16(lh + 26, true) + dv.getUint16(lh + 28, true);
    const data = u8.subarray(start, start + e.size);
    const out = e.method === 0 ? data : e.method === 8 ? await inflateRaw(data) : null;
    if (!out) throw new Error(`Unsupported compression ${e.method} for ${name}`);
    return utf8.decode(out);
  };

  const strings = [];
  const sst = await read('xl/sharedStrings.xml');
  if (sst) {
    for (const si of sst.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      let s = '';
      for (const t of si[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) s += t[1];
      strings.push(decodeXml(s));
    }
  }
  const sheetName = [...entries.keys()]
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10))[0];
  if (!sheetName) throw new Error('No worksheet found');
  const sheet = await read(sheetName);
  const rows = [];
  const colIndex = (ref) => {
    let n = 0;
    for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  };
  for (const r of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const body = c[2] ?? '';
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/\bt="(\w+)"/)?.[1];
      let value = '';
      if (type === 'inlineStr') value = decodeXml((body.match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/) ?? [])[1] ?? '');
      else {
        const v = (body.match(/<v>([\s\S]*?)<\/v>/) ?? [])[1] ?? '';
        value = type === 's' ? strings[parseInt(v, 10)] ?? '' : decodeXml(v);
      }
      row[ref ? colIndex(ref) : row.length] = value;
    }
    rows.push(Array.from(row, (v) => v ?? ''));
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Area lookup
// ---------------------------------------------------------------------------

function areaIndex(geojson) {
  return geojson.features.map((f) => {
    const polys = toPolygons(f.geometry);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const rings of polys)
      for (const [x, y] of rings[0]) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    return { key: f.properties.key, polys, bbox: [minX, minY, maxX, maxY] };
  });
}

function locator(items) {
  let last = -1;
  const hit = (i, x, y) => {
    const [a, b, c, d] = items[i].bbox;
    return x >= a && x <= c && y >= b && y <= d && pointInPolygons([x, y], items[i].polys);
  };
  return (x, y) => {
    if (last >= 0 && hit(last, x, y)) return items[last];
    for (let i = 0; i < items.length; i++)
      if (i !== last && hit(i, x, y)) {
        last = i;
        return items[i];
      }
    return null;
  };
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ---------------------------------------------------------------------------
// Nightly prices (Inside Airbnb)
// ---------------------------------------------------------------------------

export const INSIDE_AIRBNB_PAGE = 'https://insideairbnb.com/get-the-data/';
export const INSIDE_AIRBNB = {
  chicago: 'united-states/il/chicago',
  la: 'united-states/ca/los-angeles',
  nyc: 'united-states/ny/new-york-city',
  seattle: 'united-states/wa/seattle',
  // Miami: Inside Airbnb has no City of Miami dataset (only Broward County).
};

/** Latest snapshot date (YYYY-MM-DD) listed on the Inside Airbnb "Get the data" page for a city path. */
export function latestAirbnbSnapshot(html, path) {
  const re = new RegExp(`https?://data\\.insideairbnb\\.com/${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(\\d{4}-\\d{2}-\\d{2})/`, 'g');
  let best = null;
  for (const m of html.matchAll(re)) if (!best || m[1] > best) best = m[1];
  return best;
}

export const airbnbListingsUrl = (path, date) => `https://data.insideairbnb.com/${path}/${date}/visualisations/listings.csv`;

/** Fewer listings than this in an area → no price shown (medians of a handful of homes are too noisy). */
export const MIN_LISTINGS = 10;
// Hotel rooms listed on Airbnb are left out: they are priced like hotels and would blur the private-room median.
const ROOM_KIND = { 'Entire home/apt': 'entire', 'Private room': 'room' };

/**
 * Summarises Inside Airbnb's listings.csv per area: median nightly price for entire places and private rooms. Only listings that were reviewed in the last 12 months (i.e. actually booked), allow stays of 30
 * nights or fewer and have a plausible price are used.
 */
export function summarizeStay(csvText, geojson) {
  const rows = parseCsv(csvText);
  const header = rows[0]?.map((h) => h.trim()) ?? [];
  const col = (n) => header.indexOf(n);
  const iLat = col('latitude'), iLng = col('longitude'), iType = col('room_type'), iPrice = col('price');
  const iMin = col('minimum_nights'), iLtm = col('number_of_reviews_ltm');
  if ([iLat, iLng, iType, iPrice].some((i) => i < 0)) throw new Error(`Unexpected listings.csv columns: ${header.join(',')}`);
  const find = locator(areaIndex(geojson));
  const prices = new Map(); // key → { entire: [], room: [] }
  let used = 0;
  let longStay = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const kind = ROOM_KIND[row[iType]];
    if (!kind) continue;
    const price = parseFloat(String(row[iPrice] ?? '').replace(/[$,\s]/g, ''));
    if (!Number.isFinite(price) || price < 15 || price > 3000) continue;
    const minNights = iMin >= 0 ? parseInt(row[iMin], 10) : 1;
    if (Number.isFinite(minNights) && minNights > 30) continue;
    if (iLtm >= 0 && !(parseInt(row[iLtm], 10) >= 1)) continue;
    const area = find(parseFloat(row[iLng]), parseFloat(row[iLat]));
    if (!area) continue;
    if (!prices.has(area.key)) prices.set(area.key, { entire: [], room: [] });
    prices.get(area.key)[kind].push(price);
    used++;
    if (minNights >= 30) longStay++;
  }
  const areas = {};
  const all = { entire: [], room: [] };
  for (const [key, p] of prices) {
    const out = {};
    for (const kind of ['entire', 'room']) {
      all[kind].push(...p[kind]);
      if (p[kind].length >= MIN_LISTINGS) out[kind] = [Math.round(median(p[kind])), p[kind].length];
    }
    if (Object.keys(out).length) areas[key] = out;
  }
  return {
    listings: used,
    longStayShare: used ? Math.round((longStay / used) * 100) / 100 : 0,
    city: { entire: all.entire.length ? Math.round(median(all.entire)) : null, room: all.room.length ? Math.round(median(all.room)) : null },
    areas,
  };
}

// ---------------------------------------------------------------------------
// Monthly rents (HUD Small Area Fair Market Rents)
// ---------------------------------------------------------------------------

/** HUD fiscal years start on October 1st. */
export const hudFiscalYear = (d) => d.getUTCFullYear() + (d.getUTCMonth() >= 9 ? 1 : 0);
export const hudSafmrUrl = (fy) => `https://www.huduser.gov/portal/datasets/fmr/fmr${fy}/FY${String(fy).slice(-2)}_safmrs.xlsx`;
export const HUD_ZCTA_LAYER =
  'https://services.arcgis.com/VTyQ9soqVukalItT/ArcGIS/rest/services/HUD_PDR_Small_Area_Fair_Market_Rents/FeatureServer/0';

/** SAFMR spreadsheet rows → Map(ZIP → [studio, 1BR, 2BR, 3BR, 4BR]); ZIPs in several HUD areas are averaged. */
export function rentByZip(rows) {
  const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
  const h = rows.findIndex((r) => r.some((c) => /^zip\b/i.test(norm(c))) && r.some((c) => /^SAFMR 0BR$/i.test(norm(c))));
  if (h < 0) throw new Error('SAFMR header row not found');
  const header = rows[h].map(norm);
  const iZip = header.findIndex((c) => /^zip\b/i.test(c));
  const iBr = [0, 1, 2, 3, 4].map((n) => header.findIndex((c) => new RegExp(`^SAFMR ${n}BR$`, 'i').test(c)));
  if (iBr.some((i) => i < 0)) throw new Error('SAFMR bedroom columns not found');
  const sums = new Map();
  for (let r = h + 1; r < rows.length; r++) {
    const zip = norm(rows[r][iZip]).padStart(5, '0');
    if (!/^\d{5}$/.test(zip)) continue;
    const vals = iBr.map((i) => parseFloat(String(rows[r][i]).replace(/[$,]/g, '')));
    if (vals.some((v) => !Number.isFinite(v) || v <= 0)) continue;
    const s = sums.get(zip) ?? { n: 0, v: [0, 0, 0, 0, 0] };
    s.n++;
    vals.forEach((v, k) => (s.v[k] += v));
    sums.set(zip, s);
  }
  const out = new Map();
  for (const [zip, s] of sums) out.set(zip, s.v.map((v) => v / s.n));
  return out;
}

/**
 * Share of each area covered by each ZIP code, estimated by sampling a grid of points (~150 m apart)
 * inside the area. zipFeatures: GeoJSON features with properties.zip.
 */
export function zipWeights(geojson, zipFeatures, stepKm = 0.15) {
  const zips = zipFeatures.map((f) => {
    const polys = toPolygons(f.geometry);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const rings of polys)
      for (const [x, y] of rings[0]) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    return { key: f.properties.zip, polys, bbox: [minX, minY, maxX, maxY] };
  });
  const findZip = locator(zips);
  const weights = {};
  for (const area of areaIndex(geojson)) {
    const [minX, minY, maxX, maxY] = area.bbox;
    const midLat = (minY + maxY) / 2;
    const dy = stepKm / 110.57;
    const dx = stepKm / (111.32 * Math.cos((midLat * Math.PI) / 180));
    const counts = new Map();
    let total = 0;
    for (let y = minY + dy / 2; y < maxY; y += dy)
      for (let x = minX + dx / 2; x < maxX; x += dx) {
        if (!pointInPolygons([x, y], area.polys)) continue;
        total++;
        const z = findZip(x, y);
        if (z) counts.set(z.key, (counts.get(z.key) ?? 0) + 1);
      }
    if (!total) continue;
    weights[area.key] = Object.fromEntries([...counts].map(([z, n]) => [z, n / total]));
  }
  return weights;
}

/** Area rents = ZIP rents weighted by how much of the area each ZIP covers. Rounded to $10. */
export function summarizeRent(weights, rents) {
  const areas = {};
  for (const [key, w] of Object.entries(weights)) {
    let covered = 0;
    const sum = [0, 0, 0, 0];
    for (const [zip, share] of Object.entries(w)) {
      const r = rents.get(zip);
      if (!r) continue;
      covered += share;
      for (let k = 0; k < 4; k++) sum[k] += r[k] * share;
    }
    if (covered >= 0.5) areas[key] = sum.map((s) => Math.round(s / covered / 10) * 10);
  }
  return areas;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/**
 * Builds `{city}.costs.json`. Expensive downloads only happen when the source has a newer edition than the
 * previously published file (Inside Airbnb is checked at most weekly, HUD once per fiscal year).
 *
 * io = { fetchText(url), fetchBytes(url), fetchJson(url), inflateRaw(bytes), log(msg), cache: Map }
 */
export async function buildCosts({ cityId, geojson, previous, now, io }) {
  const log = (m) => io.log(`[${cityId}] costs: ${m}`);
  const out = { version: 1, id: cityId, generatedAt: now.toISOString(), stay: null, rent: null };

  // ── Nightly prices ───────────────────────────────────────────────────────────
  const path = INSIDE_AIRBNB[cityId];
  if (path) {
    try {
      const prev = previous?.stay;
      if (prev && now - new Date(prev.checkedAt) < 7 * DAY) {
        out.stay = prev;
        log(`stay: reusing ${prev.snapshot} (checked ${prev.checkedAt.slice(0, 10)})`);
      } else {
        if (!io.cache.has('airbnbPage')) io.cache.set('airbnbPage', io.fetchText(INSIDE_AIRBNB_PAGE));
        const snapshot = latestAirbnbSnapshot(await io.cache.get('airbnbPage'), path);
        if (!snapshot) throw new Error('no snapshot found on the Inside Airbnb page');
        if (prev && prev.snapshot === snapshot) {
          out.stay = { ...prev, checkedAt: now.toISOString() };
          log(`stay: ${snapshot} unchanged`);
        } else {
          const url = airbnbListingsUrl(path, snapshot);
          const s = summarizeStay(await io.fetchText(url), geojson);
          out.stay = {
            source: 'Inside Airbnb',
            url: 'https://insideairbnb.com/get-the-data/',
            license: 'CC BY 4.0',
            snapshot,
            checkedAt: now.toISOString(),
            ...s,
          };
          log(`stay: ${snapshot} → ${s.listings} listings in ${Object.keys(s.areas).length} areas`);
        }
      }
    } catch (err) {
      log(`stay FAILED: ${err.message}`);
      out.stay = previous?.stay ?? null;
    }
  }

  // ── Monthly rents ────────────────────────────────────────────────────────────
  try {
    const fyNow = hudFiscalYear(now);
    const prev = previous?.rent;
    if (prev && prev.fy >= fyNow) {
      out.rent = prev;
      log(`rent: reusing FY${prev.fy}`);
    } else {
      let fy = null;
      let rents = null;
      for (const candidate of [fyNow, fyNow - 1]) {
        if (prev && prev.fy >= candidate) break; // nothing newer than what we have
        const key = `hud${candidate}`;
        if (!io.cache.has(key)) {
          io.cache.set(
            key,
            io
              .fetchBytes(hudSafmrUrl(candidate))
              .then((b) => parseXlsx(b, io.inflateRaw))
              .then(rentByZip)
              .catch(() => null)
          );
        }
        rents = await io.cache.get(key);
        if (rents && rents.size) {
          fy = candidate;
          break;
        }
      }
      if (!fy) {
        out.rent = prev ?? null;
        log(prev ? `rent: no newer HUD file, keeping FY${prev.fy}` : 'rent: HUD file unavailable');
      } else {
        const zipFeatures = await fetchZipPolygons(geojson, io);
        const weights = zipWeights(geojson, zipFeatures);
        const areas = summarizeRent(weights, rents);
        out.rent = {
          source: 'HUD Small Area Fair Market Rents',
          url: 'https://www.huduser.gov/portal/datasets/fmr/smallarea/index.html',
          fy,
          areas,
        };
        log(`rent: FY${fy} → ${Object.keys(areas).length} areas from ${zipFeatures.length} ZIP codes`);
      }
    }
  } catch (err) {
    log(`rent FAILED: ${err.message}`);
    out.rent = previous?.rent ?? null;
  }
  return out;
}

async function fetchZipPolygons(geojson, io) {
  const items = areaIndex(geojson);
  const bbox = items.reduce(
    (b, a) => [Math.min(b[0], a.bbox[0]), Math.min(b[1], a.bbox[1]), Math.max(b[2], a.bbox[2]), Math.max(b[3], a.bbox[3])],
    [Infinity, Infinity, -Infinity, -Infinity]
  );
  const features = [];
  for (let offset = 0; offset < 20000; offset += 1000) {
    const params = new URLSearchParams({
      where: '1=1',
      geometry: bbox.join(','),
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'ZCTA5CE20',
      returnGeometry: 'true',
      outSR: '4326',
      maxAllowableOffset: '0.0002',
      geometryPrecision: '5',
      resultOffset: String(offset),
      resultRecordCount: '1000',
      f: 'geojson',
    });
    const page = await io.fetchJson(`${HUD_ZCTA_LAYER}/query?${params}`);
    for (const f of page.features ?? [])
      if (f.geometry) features.push({ type: 'Feature', properties: { zip: String(f.properties.ZCTA5CE20).padStart(5, '0') }, geometry: f.geometry });
    if (!page.properties?.exceededTransferLimit && (page.features?.length ?? 0) < 1000) break;
  }
  return features;
}

// SafeHop data pipeline — core logic.
// Zero dependencies: uses only the global `fetch` (Node 18+ or any modern browser),
// so the exact same code can be tested in a browser console.

export const WINDOW_DAYS = 180;
export const BUCKETS = 6; // 6 x 30-day buckets = 180 days
const DAY = 86400000;

// Tourist-focused categories. Order matters (used for display).
export const CATEGORIES = [
  'pickpocket', // Pickpocketing & snatching (theft from a person)
  'car_breakin', // Theft from / of parts of a vehicle
  'theft', // Other non-retail theft
  'robbery', // Theft with force or threat
  'assault', // Assault (domestic incidents excluded where flagged)
  'burglary', // Breaking into homes / businesses
  'vehicle_theft', // Stealing a vehicle
];

// ---------------------------------------------------------------------------
// Category mappers
// ---------------------------------------------------------------------------

// FBI NIBRS offense codes (LA, Seattle, Miami).
export function nibrsCategory(code) {
  const c = String(code || '').trim().toUpperCase();
  if (c === '23A' || c === '23B') return 'pickpocket'; // pocket-picking, purse-snatching
  if (c === '23F' || c === '23G') return 'car_breakin'; // from motor vehicle, vehicle parts
  if (c === '23D' || c === '23E' || c === '23H') return 'theft'; // from building, coin machine, all other
  if (c === '120') return 'robbery';
  if (c === '13A' || c === '13B') return 'assault'; // aggravated, simple (13C intimidation excluded)
  if (c === '220') return 'burglary';
  if (c === '240') return 'vehicle_theft';
  return null; // 23C shoplifting, drugs, fraud, etc. are not counted
}

// Chicago Police Department (IUCR primary type + description).
export function chicagoCategory(primaryType, description) {
  const t = String(primaryType || '').toUpperCase();
  const d = String(description || '').toUpperCase();
  switch (t) {
    case 'THEFT':
      if (d.includes('RETAIL THEFT')) return null;
      if (d.includes('POCKET-PICKING') || d.includes('PURSE-SNATCHING')) return 'pickpocket';
      if (d.includes('MOTOR VEHICLE')) return 'car_breakin';
      return 'theft';
    case 'BURGLARY':
      return d.includes('MOTOR VEHICLE') ? 'car_breakin' : 'burglary';
    case 'ROBBERY':
      return 'robbery';
    case 'ASSAULT':
    case 'BATTERY':
      return d.includes('DOMESTIC') ? null : 'assault';
    case 'MOTOR VEHICLE THEFT':
      return 'vehicle_theft';
    default:
      return null;
  }
}

// NYPD complaint data (offense description + PD description).
export function nycCategory(ofnsDesc, pdDesc) {
  const o = String(ofnsDesc || '').toUpperCase();
  const p = String(pdDesc || '').toUpperCase();
  if (o === 'ROBBERY') return 'robbery';
  if (o === 'FELONY ASSAULT' || o.startsWith('ASSAULT 3')) return 'assault';
  if (o === 'BURGLARY') return 'burglary';
  if (o === 'GRAND LARCENY OF MOTOR VEHICLE' || o === 'PETIT LARCENY OF MOTOR VEHICLE') return 'vehicle_theft';
  if (o === 'GRAND LARCENY' || o === 'PETIT LARCENY') {
    if (/SHOPL|STORE|RETAIL|PACKAGE/.test(p)) return null; // shoplifting & package theft
    if (/CREDIT CARD|FALSE PROMISE|BANK ACCT|IDENTITY|EXTORTION|CHECK|ACCT|EMBEZZ|FRAUD|LOST/.test(p)) return null; // fraud-type
    if (/FROM PERSON|PERSON,|PICK|SNATCH|BAG OPEN|LUSH/.test(p)) return 'pickpocket';
    if (/AUTO|VEHIC|LICENSE PLATE|TRUCK/.test(p)) return 'car_breakin';
    return 'theft';
  }
  return null;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson(url, { headers = {}, retries = 3, log = () => {} } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', ...headers } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.slice(0, 160)}`);
      const json = await res.json();
      if (json && json.error) throw new Error(`API error: ${JSON.stringify(json.error).slice(0, 300)}`);
      return json;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        log(`  retry ${attempt + 1}/${retries}: ${err.message}`);
        await sleep(1500 * (attempt + 1));
      }
    }
  }
  throw lastErr;
}

const qs = (params) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

// Socrata "floating timestamp" literal (no time zone). We treat everything as UTC.
const socrataTs = (d) => d.toISOString().slice(0, 19);
const arcgisTs = (d) => d.toISOString().slice(0, 19).replace('T', ' ');

// ---------------------------------------------------------------------------
// Crime sources
// ---------------------------------------------------------------------------

function socrataHeaders(ctx) {
  return ctx.socrataAppToken ? { 'X-App-Token': ctx.socrataAppToken } : {};
}

async function socrataMaxDate(base, dateField, ctx) {
  const rows = await fetchJson(`${base}?${qs({ $select: `max(${dateField}) as m` })}`, {
    headers: socrataHeaders(ctx),
    log: ctx.log,
  });
  if (!rows[0] || !rows[0].m) throw new Error(`No max date for ${base}`);
  return new Date(rows[0].m.endsWith('Z') ? rows[0].m : rows[0].m + 'Z');
}

async function socrataGroupedCounts(base, src, start, end, ctx) {
  const pageSize = 50000;
  const select = [...src.groupFields, 'count(*) as n'].join(',');
  const where = `${src.dateField} >= '${socrataTs(start)}' AND ${src.dateField} < '${socrataTs(end)}'`;
  const out = [];
  for (let offset = 0; ; offset += pageSize) {
    const url = `${base}?${qs({
      $select: select,
      $where: where,
      $group: src.groupFields.join(','),
      $order: src.groupFields.join(','),
      $limit: pageSize,
      $offset: offset,
    })}`;
    const rows = await fetchJson(url, { headers: socrataHeaders(ctx), log: ctx.log });
    for (const r of rows) out.push({ ...r, n: Number(r.n) || 0 });
    if (rows.length < pageSize) break;
  }
  return out;
}

async function arcgisMaxDate(layerUrl, dateField, ctx) {
  const stats = JSON.stringify([{ statisticType: 'max', onStatisticField: dateField, outStatisticFieldName: 'm' }]);
  const json = await fetchJson(`${layerUrl}/query?${qs({ where: '1=1', outStatistics: stats, f: 'json' })}`, { log: ctx.log });
  const m = json.features && json.features[0] && json.features[0].attributes.m;
  if (!m) throw new Error(`No max date for ${layerUrl}`);
  return new Date(m);
}

async function arcgisGroupedCounts(layerUrl, src, start, end, ctx) {
  const stats = JSON.stringify([{ statisticType: 'count', onStatisticField: 'OBJECTID', outStatisticFieldName: 'n' }]);
  const where = `${src.dateField} >= TIMESTAMP '${arcgisTs(start)}' AND ${src.dateField} < TIMESTAMP '${arcgisTs(end)}'`;
  const json = await fetchJson(
    `${layerUrl}/query?${qs({ where, groupByFieldsForStatistics: src.groupFields.join(','), outStatistics: stats, f: 'json' })}`,
    { log: ctx.log }
  );
  if (json.exceededTransferLimit) throw new Error('ArcGIS statistics result exceeded transfer limit');
  return (json.features || []).map((f) => ({ ...f.attributes, n: Number(f.attributes.n) || 0 }));
}

async function sourceMaxDate(src, ctx) {
  if (src.type === 'socrata') {
    const dates = await Promise.all(src.bases.map((b) => socrataMaxDate(b, src.dateField, ctx)));
    return new Date(Math.max(...dates.map((d) => d.getTime())));
  }
  if (src.type === 'arcgis') return arcgisMaxDate(src.layerUrl, src.dateField, ctx);
  throw new Error(`Unknown source type ${src.type}`);
}

async function sourceGroupedCounts(src, start, end, ctx) {
  if (src.type === 'socrata') {
    // Multiple bases (e.g. NYPD "current year" + "historic") are split by report year,
    // so summing them over the same window does not double count.
    const parts = await Promise.all(src.bases.map((b) => socrataGroupedCounts(b, src, start, end, ctx)));
    return parts.flat();
  }
  if (src.type === 'arcgis') return arcgisGroupedCounts(src.layerUrl, src, start, end, ctx);
  throw new Error(`Unknown source type ${src.type}`);
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

// Returns an array of polygons; each polygon is an array of rings; ring = [[lng,lat],...]
export function toPolygons(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

const R = 6371.0088; // km
const rad = (d) => (d * Math.PI) / 180;

// Spherical polygon ring area in km^2 (absolute value).
export function ringAreaKm2(ring) {
  let sum = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[(i + 1) % n];
    sum += rad(lng2 - lng1) * (2 + Math.sin(rad(lat1)) + Math.sin(rad(lat2)));
  }
  return Math.abs((sum * R * R) / 2);
}

export function polygonsAreaKm2(polys) {
  let total = 0;
  for (const rings of polys) {
    rings.forEach((ring, i) => {
      total += i === 0 ? ringAreaKm2(ring) : -ringAreaKm2(ring);
    });
  }
  return Math.max(total, 0);
}

function perpDist(p, a, b) {
  const [x, y] = p;
  const [x1, y1] = a;
  const [x2, y2] = b;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

// Iterative Douglas–Peucker on an open polyline.
function douglasPeucker(points, tol) {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(points[i], points[s], points[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol && idx !== -1) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const round5 = (n) => Math.round(n * 1e5) / 1e5;

export function simplifyRing(ring, tol) {
  // Rings are closed (first == last). Simplify as an open line, then close again.
  const open = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : ring.slice();
  if (open.length < 3) return null;
  let simplified = douglasPeucker(open, tol).map(([x, y]) => [round5(x), round5(y)]);
  // Drop consecutive duplicates created by rounding.
  simplified = simplified.filter((p, i, arr) => i === 0 || p[0] !== arr[i - 1][0] || p[1] !== arr[i - 1][1]);
  if (simplified.length < 3) return null;
  simplified.push(simplified[0]);
  return simplified;
}

export function simplifyPolygons(polys, tol, minRingKm2 = 0.01) {
  const out = [];
  for (const rings of polys) {
    const outer = simplifyRing(rings[0], tol);
    if (!outer || ringAreaKm2(outer) < minRingKm2) continue;
    const holes = rings
      .slice(1)
      .map((r) => simplifyRing(r, tol))
      .filter((r) => r && ringAreaKm2(r) >= minRingKm2);
    out.push([outer, ...holes]);
  }
  return out;
}

export function bboxOf(polysList) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const polys of polysList)
    for (const rings of polys)
      for (const [x, y] of rings[0]) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
  return [round5(minX), round5(minY), round5(maxX), round5(maxY)];
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInPolygons(pt, polys) {
  for (const rings of polys) {
    if (pointInRing(pt, rings[0]) && !rings.slice(1).some((h) => pointInRing(pt, h))) return true;
  }
  return false;
}

// Area-weighted centroid of the largest outer ring (good enough for labeling).
function labelPoint(polys) {
  let best = null;
  let bestA = -1;
  for (const rings of polys) {
    const a = ringAreaKm2(rings[0]);
    if (a > bestA) {
      bestA = a;
      best = rings[0];
    }
  }
  if (!best) return null;
  let cx = 0, cy = 0, a2 = 0;
  for (let i = 0, n = best.length - 1; i < n; i++) {
    const [x0, y0] = best[i];
    const [x1, y1] = best[i + 1];
    const f = x0 * y1 - x1 * y0;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
    a2 += f;
  }
  if (a2 === 0) return best[0];
  return [cx / (3 * a2), cy / (3 * a2)];
}

// ---------------------------------------------------------------------------
// Boundaries
// ---------------------------------------------------------------------------

async function fetchBoundaryFeatures(areas, ctx) {
  if (areas.type === 'socrata-geojson') {
    const sep = areas.url.includes('?') ? '&' : '?';
    const gj = await fetchJson(`${areas.url}${sep}$limit=5000`, { headers: socrataHeaders(ctx), log: ctx.log });
    return gj.features || [];
  }
  if (areas.type === 'arcgis') {
    const gj = await fetchJson(
      `${areas.layerUrl}/query?${qs({ where: '1=1', outFields: '*', returnGeometry: 'true', outSR: '4326', f: 'geojson' })}`,
      { log: ctx.log }
    );
    return gj.features || [];
  }
  throw new Error(`Unknown boundary type ${areas.type}`);
}

export function titleCase(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/(^|[\s/\-(])([a-z])/g, (m, p, c) => p + c.toUpperCase())
    .replace(/\b(\d+)(St|Nd|Rd|Th)\b/g, (m, d, suf) => d + suf.toLowerCase());
}

// Groups features by key and merges them into one multipolygon per key.
async function loadAreas(city, ctx) {
  const features = await fetchBoundaryFeatures(city.areas, ctx);
  const byKey = new Map();
  for (const f of features) {
    const rawKey = f.properties && f.properties[city.areas.keyProp];
    if (rawKey === undefined || rawKey === null || rawKey === '') continue;
    const key = city.normalizeKey(rawKey);
    const polys = toPolygons(f.geometry);
    if (!polys.length) continue;
    const rawName = city.areas.nameProp ? f.properties[city.areas.nameProp] : rawKey;
    const entry = byKey.get(key) || { key, rawName, polys: [] };
    entry.polys.push(...polys);
    byKey.set(key, entry);
  }
  if (!byKey.size) throw new Error(`No boundary features for ${city.id}`);
  return [...byKey.values()];
}

// NYC precincts → readable neighborhood labels using 2020 NTAs.
async function nycPrecinctLabels(areaEntries, ctx) {
  const labels = new Map();
  try {
    const gj = await fetchJson('https://data.cityofnewyork.us/resource/9nt8-h7nd.geojson?$limit=1000', {
      headers: socrataHeaders(ctx),
      log: ctx.log,
    });
    const hits = new Map(); // key -> [{name, area}]
    for (const f of gj.features || []) {
      const p = f.properties || {};
      const polys = toPolygons(f.geometry);
      const pt = labelPoint(polys);
      if (!pt) continue;
      const area = polygonsAreaKm2(polys);
      const residential = String(p.ntatype) === '0';
      for (const a of areaEntries) {
        if (pointInPolygons(pt, a.polys)) {
          const list = hits.get(a.key) || [];
          list.push({ name: p.ntaname, area, residential });
          hits.set(a.key, list);
          break;
        }
      }
    }
    for (const [key, list] of hits) {
      const preferred = list.filter((x) => x.residential);
      const pool = (preferred.length ? preferred : list).sort((a, b) => b.area - a.area);
      const names = [...new Set(pool.map((x) => shortNtaName(x.name)))];
      labels.set(key, names.slice(0, 2).join(' / '));
    }
  } catch (err) {
    ctx.log(`  NTA labels unavailable (${err.message}); falling back to precinct numbers`);
  }
  return labels;
}

// "Upper East Side-Lenox Hill-Roosevelt Island" → "Upper East Side".
// Keeps names that are hyphenated on their own (Bedford-Stuyvesant).
export function shortNtaName(name) {
  const parts = String(name || '').split('-').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return '';
  if (parts[0] === 'Bedford' && parts[1] && parts[1].startsWith('Stuyvesant')) return `Bedford-${parts[1]}`;
  return parts[0];
}

// Precincts whose NTAs are all assigned elsewhere (or that need a clearer name).
const NYC_LABEL_OVERRIDES = {
  14: 'Midtown South / Penn Station',
  22: 'Central Park',
};

const ordinal = (n) => {
  const v = n % 100;
  const s = v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  return `${n}${s}`;
};

export function nycBorough(precinct) {
  const p = Number(precinct);
  if (p >= 1 && p <= 34) return 'Manhattan';
  if (p >= 40 && p <= 52) return 'Bronx';
  if (p >= 60 && p <= 94) return 'Brooklyn';
  if (p >= 100 && p <= 115) return 'Queens';
  if (p >= 120 && p <= 123) return 'Staten Island';
  return 'New York';
}

// ---------------------------------------------------------------------------
// City configuration
// ---------------------------------------------------------------------------

const NYC_OPEN_DATA = 'https://data.cityofnewyork.us/resource';

export const CITIES = [
  {
    id: 'chicago',
    name: 'Chicago',
    state: 'IL',
    agency: 'Chicago Police Department',
    datasetUrl: 'https://data.cityofchicago.org/Public-Safety/Crimes-2001-to-Present/ijzp-q8t2',
    areaUnit: 'Community area',
    source: {
      type: 'socrata',
      bases: ['https://data.cityofchicago.org/resource/ijzp-q8t2.json'],
      dateField: 'date',
      groupFields: ['community_area', 'primary_type', 'description'],
      areaOf: (r) => r.community_area,
      categoryOf: (r) => chicagoCategory(r.primary_type, r.description),
    },
    areas: {
      type: 'socrata-geojson',
      url: 'https://data.cityofchicago.org/resource/igwz-8jzy.geojson',
      keyProp: 'area_numbe',
      nameProp: 'community',
      tolerance: 0.0004,
    },
    normalizeKey: (k) => String(parseInt(k, 10)),
    displayName: (e) => titleCase(e.rawName).replace(/\bOhare\b/i, "O'Hare"),
    notes: ['Counts use the date the incident occurred.', 'Domestic battery/assault and retail theft are excluded.'],
  },
  {
    id: 'nyc',
    name: 'New York City',
    state: 'NY',
    agency: 'New York Police Department (NYPD)',
    datasetUrl: 'https://data.cityofnewyork.us/Public-Safety/NYPD-Complaint-Data-Current-Year-To-Date-/5uac-w243',
    areaUnit: 'NYPD precinct',
    source: {
      type: 'socrata',
      // Current year + historic. Both are split by report year, so they never overlap.
      bases: [`${NYC_OPEN_DATA}/5uac-w243.json`, `${NYC_OPEN_DATA}/qgea-i56i.json`],
      dateField: 'rpt_dt',
      groupFields: ['addr_pct_cd', 'ofns_desc', 'pd_desc'],
      areaOf: (r) => r.addr_pct_cd,
      categoryOf: (r) => nycCategory(r.ofns_desc, r.pd_desc),
    },
    areas: {
      type: 'socrata-geojson',
      url: `${NYC_OPEN_DATA}/y76i-bdw7.geojson`,
      keyProp: 'precinct',
      tolerance: 0.0004,
    },
    normalizeKey: (k) => String(parseInt(k, 10)),
    labeler: nycPrecinctLabels,
    displayName: (e, labels) =>
      NYC_LABEL_OVERRIDES[e.key] || labels.get(e.key) || `${nycBorough(e.key)} · ${ordinal(Number(e.key))} Precinct`,
    subtitle: (e) => `${ordinal(Number(e.key))} Precinct · ${nycBorough(e.key)}`,
    notes: [
      'NYPD updates this data quarterly, so the 6-month window ends at the latest published date.',
      'Counts use the date the complaint was reported. Shoplifting, package theft and fraud are excluded.',
    ],
  },
  {
    id: 'la',
    name: 'Los Angeles',
    state: 'CA',
    agency: 'Los Angeles Police Department (LAPD)',
    datasetUrl: 'https://data.lacity.org/resource/k7nn-b2ep',
    areaUnit: 'LAPD division',
    source: {
      type: 'socrata',
      bases: ['https://data.lacity.org/resource/k7nn-b2ep.json'],
      dateField: 'date_occ',
      groupFields: ['area', 'nibr_code', 'domestic_violence_crime'],
      areaOf: (r) => r.area,
      categoryOf: (r) => (String(r.domestic_violence_crime).toLowerCase() === 'yes' ? null : nibrsCategory(r.nibr_code)),
    },
    areas: {
      type: 'arcgis',
      layerUrl: 'https://services5.arcgis.com/7nsPwEMP38bSkCjy/arcgis/rest/services/LAPD_Division/FeatureServer/0',
      keyProp: 'PREC',
      nameProp: 'APREC',
      tolerance: 0.0006,
    },
    normalizeKey: (k) => String(parseInt(k, 10)),
    displayName: (e) => titleCase(e.rawName).replace(/^N Hollywood$/i, 'North Hollywood'),
    notes: [
      'LAPD reports in the FBI NIBRS format: one incident can include several offenses, so counts are offenses.',
      'Domestic-violence incidents and shoplifting are excluded.',
    ],
  },
  {
    id: 'miami',
    name: 'Miami',
    state: 'FL',
    agency: 'City of Miami Police Department',
    datasetUrl: 'https://datahub-miamigis.opendata.arcgis.com/',
    areaUnit: 'Police neighborhood',
    source: {
      type: 'arcgis',
      layerUrl:
        'https://services1.arcgis.com/CvuPhqcTQpZPT9qY/arcgis/rest/services/Crimes_public_67c0535145c14baf897e47a8d4986539/FeatureServer/0',
      dateField: 'reportdate',
      groupFields: ['neighborhood', 'nibrscode'],
      areaOf: (r) => r.neighborhood,
      categoryOf: (r) => nibrsCategory(r.nibrscode),
    },
    areas: {
      type: 'arcgis',
      layerUrl: 'https://services1.arcgis.com/CvuPhqcTQpZPT9qY/arcgis/rest/services/Police_Neighborhoods/FeatureServer/0',
      keyProp: 'PDNETNAME',
      nameProp: 'PDNETNAME',
      tolerance: 0.0003,
    },
    keyAliases: { Brickell: 'Brickell/Roads' },
    normalizeKey: (k) => String(k).trim(),
    displayName: (e) => (e.key === 'Brickell/Roads' ? 'Brickell / The Roads' : e.rawName),
    notes: [
      'Covers the City of Miami only. Miami Beach (incl. South Beach) has its own police department and is NOT included.',
      'Counts use the date the incident was reported.',
    ],
  },
  {
    id: 'seattle',
    name: 'Seattle',
    state: 'WA',
    agency: 'Seattle Police Department',
    datasetUrl: 'https://data.seattle.gov/Public-Safety/SPD-Crime-Data-2008-Present/tazs-3rd5',
    areaUnit: 'SPD neighborhood (MCPP)',
    source: {
      type: 'socrata',
      bases: ['https://data.seattle.gov/resource/tazs-3rd5.json'],
      dateField: 'offense_date',
      groupFields: ['neighborhood', 'nibrs_offense_code'],
      areaOf: (r) => r.neighborhood,
      categoryOf: (r) => nibrsCategory(r.nibrs_offense_code),
    },
    areas: {
      type: 'arcgis',
      layerUrl: 'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/MCPP/FeatureServer/0',
      keyProp: 'neighborhood',
      nameProp: 'neighborhood',
      tolerance: 0.0003,
    },
    normalizeKey: (k) => String(k).trim().toUpperCase(),
    displayName: (e) =>
      ({
        LAKECITY: 'Lake City',
        BITTERLAKE: 'Bitter Lake',
        SANDPOINT: 'Sand Point',
        'SLU/CASCADE': 'South Lake Union / Cascade',
        SODO: 'SODO',
        'DOWNTOWN COMMERCIAL': 'Downtown',
        'CHINATOWN/INTERNATIONAL DISTRICT': 'Chinatown / International District',
        'FAUNTLEROY SW': 'Fauntleroy',
      })[e.key] || titleCase(e.rawName).replace(/\s*\/\s*/g, ' / '),
    notes: ['Counts use the date the offense occurred (NIBRS offenses).'],
  },
];

// ---------------------------------------------------------------------------
// Build one city
// ---------------------------------------------------------------------------

export async function buildCity(city, ctx = {}) {
  ctx = { log: () => {}, now: new Date(), ...ctx };
  const parentLog = ctx.log;
  const log = (m) => parentLog(`[${city.id}] ${m}`);
  ctx = { ...ctx, log };

  // 1) Time window: 180 days ending at the latest date the source has (capped at "now").
  const maxDate = await sourceMaxDate(city.source, ctx);
  const capped = new Date(Math.min(maxDate.getTime(), ctx.now.getTime()));
  const end = new Date(Date.UTC(capped.getUTCFullYear(), capped.getUTCMonth(), capped.getUTCDate()) + DAY);
  const start = new Date(end.getTime() - WINDOW_DAYS * DAY);
  const bucketDays = WINDOW_DAYS / BUCKETS;
  const buckets = Array.from({ length: BUCKETS }, (_, i) => ({
    start: new Date(start.getTime() + i * bucketDays * DAY),
    end: new Date(start.getTime() + (i + 1) * bucketDays * DAY),
  }));
  log(`window ${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)} (latest record ${maxDate.toISOString().slice(0, 10)})`);

  // 2) Boundaries.
  const areaEntries = await loadAreas(city, ctx);
  const labels = city.labeler ? await city.labeler(areaEntries, ctx) : new Map();
  log(`${areaEntries.length} areas`);

  // 3) Counts per bucket.
  const zero = () => Object.fromEntries(CATEGORIES.map((c) => [c, new Array(BUCKETS).fill(0)]));
  const counts = new Map(areaEntries.map((e) => [e.key, zero()]));
  const unassigned = zero();
  const unmatchedKeys = new Map();
  for (let b = 0; b < BUCKETS; b++) {
    const rows = await sourceGroupedCounts(city.source, buckets[b].start, buckets[b].end, ctx);
    for (const r of rows) {
      const cat = city.source.categoryOf(r);
      if (!cat) continue;
      let raw = city.source.areaOf(r);
      if (raw !== undefined && raw !== null && city.keyAliases && city.keyAliases[String(raw).trim()]) {
        raw = city.keyAliases[String(raw).trim()];
      }
      const key = raw === undefined || raw === null || raw === '' ? null : city.normalizeKey(raw);
      const target = key !== null && counts.has(key) ? counts.get(key) : null;
      if (target) target[cat][b] += r.n;
      else {
        unassigned[cat][b] += r.n;
        const k = String(raw);
        unmatchedKeys.set(k, (unmatchedKeys.get(k) || 0) + r.n);
      }
    }
  }

  // 4) Assemble outputs.
  const sum = (arr) => arr.reduce((a, b) => a + b, 0);
  const byCat = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  const areasOut = [];
  const features = [];
  const simplifiedAll = [];
  for (const e of areaEntries) {
    const c = counts.get(e.key);
    for (const cat of CATEGORIES) byCat[cat] += sum(c[cat]);
    const areaKm2 = Math.round(polygonsAreaKm2(e.polys) * 100) / 100;
    const name = city.displayName ? city.displayName(e, labels) : String(e.rawName);
    const sub = city.subtitle ? city.subtitle(e) : city.areaUnit;
    areasOut.push({ key: e.key, name, sub, areaKm2, counts: c });
    const simplified = simplifyPolygons(e.polys, city.areas.tolerance);
    if (!simplified.length) continue;
    simplifiedAll.push(simplified);
    features.push({
      type: 'Feature',
      properties: { key: e.key, name },
      geometry: simplified.length === 1 ? { type: 'Polygon', coordinates: simplified[0] } : { type: 'MultiPolygon', coordinates: simplified },
    });
  }
  const total = sum(Object.values(byCat));
  const unassignedTotal = sum(CATEGORIES.map((c) => sum(unassigned[c])));
  if (total === 0) throw new Error('No incidents matched any area — refusing to publish empty data');
  areasOut.sort((a, b) => a.name.localeCompare(b.name));

  const topUnmatched = [...unmatchedKeys.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  log(`${total} incidents in areas, ${unassignedTotal} without a matching area${topUnmatched.length ? ` (top: ${topUnmatched.map(([k, n]) => `${k}=${n}`).join(', ')})` : ''}`);

  const iso = (d) => d.toISOString().slice(0, 10);
  const data = {
    version: 1,
    id: city.id,
    name: city.name,
    state: city.state,
    generatedAt: ctx.now.toISOString(),
    latestRecord: iso(maxDate),
    window: { start: iso(start), end: iso(new Date(end.getTime() - DAY)) },
    buckets: buckets.map((b) => ({ start: iso(b.start), end: iso(new Date(b.end.getTime() - DAY)) })),
    categories: CATEGORIES,
    bbox: bboxOf(simplifiedAll),
    totals: { all: total, byCat, unassigned: unassignedTotal },
    areas: areasOut,
    source: { agency: city.agency, url: city.datasetUrl, areaUnit: city.areaUnit },
    notes: city.notes || [],
  };
  const geojson = { type: 'FeatureCollection', features };
  return { data, geojson };
}

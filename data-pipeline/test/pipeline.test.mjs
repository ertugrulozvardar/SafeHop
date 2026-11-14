import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nibrsCategory,
  chicagoCategory,
  nycCategory,
  ringAreaKm2,
  simplifyPolygons,
  pointInPolygons,
  titleCase,
  nycBorough,
  shortNtaName,
  sfCategory,
  austinCategory,
  dcCategory,
  bostonCategory,
  sdName,
  austinName,
  dcNames,
  parseSqlDate,
  buildCity,
  CITIES,
} from '../src/pipeline.mjs';

test('NIBRS mapping', () => {
  assert.equal(nibrsCategory('23A'), 'pickpocket');
  assert.equal(nibrsCategory('23b '), 'pickpocket');
  assert.equal(nibrsCategory('23F'), 'car_breakin');
  assert.equal(nibrsCategory('23C'), null); // shoplifting
  assert.equal(nibrsCategory('13CI'), null); // Miami intimidation variant
  assert.equal(nibrsCategory('13A'), 'assault');
  assert.equal(nibrsCategory('120'), 'robbery');
  assert.equal(nibrsCategory('240'), 'vehicle_theft');
  assert.equal(nibrsCategory('35A'), null);
});

test('Chicago mapping', () => {
  assert.equal(chicagoCategory('THEFT', 'POCKET-PICKING'), 'pickpocket');
  assert.equal(chicagoCategory('THEFT', 'RETAIL THEFT'), null);
  assert.equal(chicagoCategory('THEFT', 'THEFT FROM MOTOR VEHICLE'), 'car_breakin');
  assert.equal(chicagoCategory('BURGLARY', 'BURGLARY FROM MOTOR VEHICLE'), 'car_breakin');
  assert.equal(chicagoCategory('BURGLARY', 'FORCIBLE ENTRY'), 'burglary');
  assert.equal(chicagoCategory('BATTERY', 'DOMESTIC BATTERY SIMPLE'), null);
  assert.equal(chicagoCategory('BATTERY', 'SIMPLE'), 'assault');
  assert.equal(chicagoCategory('THEFT', '$500 AND UNDER'), 'theft');
  assert.equal(chicagoCategory('NARCOTICS', 'POSSESS'), null);
});

test('NYC mapping', () => {
  assert.equal(nycCategory('GRAND LARCENY', 'LARCENY,GRAND FROM PERSON,PICK'), 'pickpocket');
  assert.equal(nycCategory('GRAND LARCENY', 'LARCENY,GRAND FROM PERSON,PERSONAL ELECTRONIC DEVICE(SNATCH)'), 'pickpocket');
  assert.equal(nycCategory('PETIT LARCENY', 'LARCENY,PETIT FROM STORE-SHOPL'), null);
  assert.equal(nycCategory('PETIT LARCENY', 'LARCENY,PETIT FROM BUILDING,UNATTENDED, PACKAGE THEFT INSIDE'), null);
  assert.equal(nycCategory('GRAND LARCENY', 'LARCENY,GRAND BY CREDIT CARD ACCT COMPROMISE-EXISTING ACCT'), null);
  assert.equal(nycCategory('PETIT LARCENY', 'LARCENY,PETIT FROM AUTO'), 'car_breakin');
  assert.equal(nycCategory('GRAND LARCENY', 'LARCENY,GRAND OF VEHICULAR/MOTORCYCLE ACCESSORIES'), 'car_breakin');
  assert.equal(nycCategory('PETIT LARCENY', 'LARCENY,PETIT FROM OPEN AREAS,'), 'theft');
  assert.equal(nycCategory('GRAND LARCENY OF MOTOR VEHICLE', 'LARCENY,GRAND OF AUTO'), 'vehicle_theft');
  assert.equal(nycCategory('ASSAULT 3 & RELATED OFFENSES', 'ASSAULT 3'), 'assault');
  assert.equal(nycCategory('DANGEROUS DRUGS', 'X'), null);
});

test('geometry helpers', () => {
  // ~1km x 1km square near the equator
  const d = 1 / 111.32;
  const sq = [[0, 0], [d, 0], [d, d], [0, d], [0, 0]];
  const a = ringAreaKm2(sq);
  assert.ok(Math.abs(a - 1) < 0.02, `area ${a}`);
  const simplified = simplifyPolygons([[sq]], 0.0001, 0);
  assert.equal(simplified.length, 1);
  assert.equal(simplified[0][0].length, 5);
  assert.ok(pointInPolygons([d / 2, d / 2], [[sq]]));
  assert.ok(!pointInPolygons([d * 2, d / 2], [[sq]]));
});

test('NTA name shortening', () => {
  assert.equal(shortNtaName('Upper East Side-Lenox Hill-Roosevelt Island'), 'Upper East Side');
  assert.equal(shortNtaName('Midtown-Times Square'), 'Midtown');
  assert.equal(shortNtaName('Bedford-Stuyvesant (West)'), 'Bedford-Stuyvesant (West)');
  assert.equal(shortNtaName('Greenpoint'), 'Greenpoint');
});

test('labels', () => {
  assert.equal(titleCase('77TH STREET'), '77th Street');
  assert.equal(titleCase('WEST LA'), 'West La');
  assert.equal(nycBorough(14), 'Manhattan');
  assert.equal(nycBorough(75), 'Brooklyn');
});

test('city configs are complete', () => {
  assert.deepEqual(CITIES.map((c) => c.id).sort(), ['austin', 'boston', 'chicago', 'dc', 'la', 'miami', 'nyc', 'sandiego', 'seattle', 'sf']);
  for (const c of CITIES) {
    assert.ok(c.source.groupFields.length >= 2, c.id);
    assert.equal(typeof c.source.categoryOf, 'function', c.id);
    assert.equal(typeof c.normalizeKey, 'function', c.id);
    assert.ok(c.areas.keyProp, c.id);
  }
});

test('San Francisco mapping', () => {
  assert.equal(sfCategory('Larceny Theft', 'Larceny Theft - Pickpocket', 'Theft, Pickpocket, $50-$200'), 'pickpocket');
  assert.equal(sfCategory('Larceny Theft', 'Larceny Theft - Other', 'Theft, From Person, >$950 (other than Pickpocket)'), 'pickpocket');
  assert.equal(sfCategory('Larceny Theft', 'Larceny - From Vehicle', 'Theft, From Locked Vehicle, >$950'), 'car_breakin');
  assert.equal(sfCategory('Larceny Theft', 'Theft From Vehicle', 'License Plate, Stolen'), 'car_breakin');
  assert.equal(sfCategory('Larceny Theft', 'Larceny Theft - Shoplifting', 'Theft, Shoplifting, <$50'), null);
  assert.equal(sfCategory('Larceny Theft', 'Larceny Theft - Other', 'Theft, Lost Property, Petty'), null);
  assert.equal(sfCategory('Larceny Theft', 'Larceny Theft - Bicycle', 'Theft, Bicycle, >$950'), 'theft');
  assert.equal(sfCategory('Assault', 'Simple Assault', 'Battery'), 'assault');
  assert.equal(sfCategory('Assault', 'Simple Assault', 'Battery, former Spouse or Dating Relationship'), null);
  assert.equal(sfCategory('Motor Vehicle Theft', 'Motor Vehicle Theft', 'Vehicle, Stolen, Auto'), 'vehicle_theft');
  assert.equal(sfCategory('Motor Vehicle Theft', 'Motor Vehicle Theft', 'Vehicle, Recovered, Stolen outside SF'), null);
  assert.equal(sfCategory('Robbery', 'Robbery - Street', 'Robbery, Street or Public Place, W/ Force'), 'robbery');
  assert.equal(sfCategory('Drug Offense', 'Drug Violation', 'x'), null);
});

test('Austin mapping', () => {
  assert.equal(austinCategory('THEFT FROM PERSON', 'N'), 'pickpocket');
  assert.equal(austinCategory('BURGLARY OF VEHICLE', 'N'), 'car_breakin');
  assert.equal(austinCategory('THEFT CATALYTIC CONVERTER', 'N'), 'car_breakin');
  assert.equal(austinCategory('THEFT BY SHOPLIFTING', 'N'), null);
  assert.equal(austinCategory('THEFT', 'N'), 'theft');
  assert.equal(austinCategory('AGG ROBBERY/DEADLY WEAPON', 'N'), 'robbery');
  assert.equal(austinCategory('ASSAULT WITH INJURY', 'N'), 'assault');
  assert.equal(austinCategory('AGG ASLT STRANGLE/SUFFOCATE', 'N'), 'assault');
  assert.equal(austinCategory('ASSAULT WITH INJURY', 'Y'), null);
  assert.equal(austinCategory('ASSAULT WITH INJURY-FAM/DATING VIO', 'N'), null);
  assert.equal(austinCategory('SEXUAL ASSAULT', 'N'), null);
  assert.equal(austinCategory('BURGLARY OF RESIDENCE', 'N'), 'burglary');
  assert.equal(austinCategory('AUTO THEFT', 'N'), 'vehicle_theft');
  assert.equal(austinCategory('FAMILY DISTURBANCE', 'N'), null);
});

test('DC and Boston mapping', () => {
  assert.equal(dcCategory('THEFT F/AUTO'), 'car_breakin');
  assert.equal(dcCategory('THEFT/OTHER'), 'theft');
  assert.equal(dcCategory('ASSAULT W/DANGEROUS WEAPON'), 'assault');
  assert.equal(dcCategory('HOMICIDE'), null);
  assert.equal(bostonCategory('LARCENY PICK-POCKET'), 'pickpocket');
  assert.equal(bostonCategory('LARCENY PURSE SNATCH - NO FORCE'), 'pickpocket');
  assert.equal(bostonCategory('LARCENY THEFT FROM MV - NON-ACCESSORY'), 'car_breakin');
  assert.equal(bostonCategory('LARCENY THEFT OF MV PARTS & ACCESSORIES'), 'car_breakin');
  assert.equal(bostonCategory('AUTO THEFT'), 'vehicle_theft');
  assert.equal(bostonCategory('AUTO THEFT - RECOVERED IN BY POLICE'), null);
  assert.equal(bostonCategory('LARCENY SHOPLIFTING'), null);
  assert.equal(bostonCategory('LARCENY THEFT FROM BUILDING'), 'theft');
  assert.equal(bostonCategory('ROBBERY - STREET'), 'robbery');
  assert.equal(bostonCategory('ASSAULT - SIMPLE'), 'assault');
  assert.equal(bostonCategory('THREATS TO DO BODILY HARM'), null);
  assert.equal(bostonCategory('BURGLARY - RESIDENTIAL'), 'burglary');
  assert.equal(bostonCategory('FRAUD - CREDIT CARD / ATM FRAUD'), null);
});

test('new city labels', () => {
  assert.equal(sdName('MT HOPE'), 'Mt. Hope');
  assert.equal(sdName("O'FARRELL"), "O'Farrell");
  assert.equal(austinName('AVERY RANCH--LAKELINE'), 'Avery Ranch / Lakeline');
  assert.equal(austinName('MLK-183'), 'MLK-183');
  assert.deepEqual(dcNames('Downtown, Chinatown, Penn Quarters'), ['Downtown', 'Chinatown', 'Penn Quarters']);
  assert.equal(parseSqlDate('2026-11-10 14:30:00+00').toISOString(), '2026-11-10T14:30:00.000Z');
  const sd = CITIES.find((c) => c.id === 'sandiego');
  assert.equal(sd.normalizeKey('Mt. Hope'), sd.normalizeKey('MT HOPE'));
  assert.equal(sd.normalizeKey('Roseville/Fleet Ridge'), sd.normalizeKey('ROSEVILLE / FLEET RIDGE'));
  const dc = CITIES.find((c) => c.id === 'dc');
  assert.equal(dc.normalizeKey('Cluster 08'), dc.normalizeKey('Cluster 8'));
  assert.ok(!dc.categories.includes('pickpocket'));
});

// Offline end-to-end run of buildCity with a fake ArcGIS server: yearly layers, upper-case statistic
// names, a "too many groups" answer that forces the time range to be split, and block groups rolled up
// into neighborhoods by location.
test('buildCity: yearly ArcGIS layers, split ranges and key remapping', async () => {
  const sq = (x, y, d = 0.01) => [[[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]]];
  const now = new Date('2026-02-10T00:00:00Z');
  let splitCalls = 0;
  const seenYears = new Set();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = decodeURIComponent(String(url));
    let body;
    if (u.startsWith('https://svc/MapServer?')) body = { layers: [{ id: 41, name: 'Crime Incidents - 2026' }, { id: 7, name: 'Crime Incidents - 2025' }, { id: 9, name: 'Sex Offender' }] };
    else if (u.startsWith('https://areas/query')) body = { type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { NAME: 'Hood A' }, geometry: { type: 'Polygon', coordinates: sq(0, 0) } },
      { type: 'Feature', properties: { NAME: 'Hood B' }, geometry: { type: 'Polygon', coordinates: sq(1, 1) } } ] };
    else if (u.startsWith('https://points')) body = [ { id: 'BG1', lat: '0.005', lng: '0.005' }, { id: 'BG2', lat: '1.005', lng: '1.005' }, { id: 'BG3', lat: '5', lng: '5' } ];
    else if (u.includes('/query?') && u.includes('outStatistics') && u.includes('"max"')) body = { features: [{ attributes: { M: Date.parse('2026-02-08T10:00:00Z') } }] };
    else if (u.includes('/query?') && u.includes('groupByFieldsForStatistics')) {
      const layer = u.match(/MapServer\/(\d+)\/query/)[1];
      seenYears.add(layer);
      const [, a, b] = u.match(/>= TIMESTAMP '([^']+)' AND \w+ < TIMESTAMP '([^']+)'/);
      const days = (Date.parse(b.replace(' ', 'T') + 'Z') - Date.parse(a.replace(' ', 'T') + 'Z')) / 86400000;
      if (days > 15 && layer === '41') { splitCalls++; body = { exceededTransferLimit: true, features: [] }; }
      else body = { features: [
        { attributes: { BG: 'BG1', OFFENSE: 'ROBBERY', N: 2 } },
        { attributes: { BG: 'BG2', OFFENSE: 'THEFT', N: 1 } },
        { attributes: { BG: 'BG3', OFFENSE: 'THEFT', N: 7 } } ] };
    } else return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => body };
  };
  try {
    const city = {
      id: 'test', name: 'Test', state: 'TS', agency: 'X', datasetUrl: 'u', areaUnit: 'Hood',
      categories: ['robbery', 'theft'],
      source: { type: 'arcgis', yearLayers: { service: 'https://svc/MapServer', pattern: /^Crime Incidents - (\d{4})$/ }, dateField: 'D',
        groupFields: ['BG', 'OFFENSE'], areaOf: (r) => r.BG, categoryOf: (r) => (r.OFFENSE === 'ROBBERY' ? 'robbery' : 'theft') },
      keyPoints: { url: 'https://points', keyField: 'id', latField: 'lat', lngField: 'lng' },
      areas: { type: 'arcgis', layerUrl: 'https://areas', keyProp: 'NAME', tolerance: 0.0001 },
      normalizeKey: (k) => String(k).trim().toUpperCase(),
    };
    const { data } = await buildCity(city, { now });
    const a = data.areas.find((x) => x.key === 'HOOD A');
    const b = data.areas.find((x) => x.key === 'HOOD B');
    assert.ok(splitCalls > 0, 'range was split');
    assert.ok(seenYears.has('7') && seenYears.has('41'), 'both yearly layers queried for a window spanning two years');
    assert.ok(a.counts.robbery.reduce((s, n) => s + n, 0) > 0);
    assert.ok(b.counts.theft.reduce((s, n) => s + n, 0) > 0);
    assert.ok(data.totals.unassigned > 0, 'BG3 lies outside every area');
    assert.deepEqual(data.categories, ['robbery', 'theft']);
    assert.equal(data.latestRecord, '2026-02-08');
  } finally {
    globalThis.fetch = realFetch;
  }
});

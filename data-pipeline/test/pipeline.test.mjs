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
  assert.deepEqual(CITIES.map((c) => c.id).sort(), ['chicago', 'la', 'miami', 'nyc', 'seattle']);
  for (const c of CITIES) {
    assert.ok(c.source.groupFields.length >= 2, c.id);
    assert.equal(typeof c.source.categoryOf, 'function', c.id);
    assert.equal(typeof c.normalizeKey, 'function', c.id);
    assert.ok(c.areas.keyProp, c.id);
  }
});

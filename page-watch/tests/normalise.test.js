import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise } from '../src/normalise.js';
import { today } from '../src/dates.js';

test('table cells become " | " and spacing is tidied', () => {
  assert.deepEqual(normalise(['P0141 - CPI,  October\t18 November 2026\t10:00   ']), [
    'P0141 - CPI, October | 18 November 2026 | 10:00',
  ]);
});

test('blank items are dropped and repeats kept once', () => {
  assert.deepEqual(normalise(['a', '  ', 'b', 'a']), ['a', 'b']);
});

test('group joins a label with its value', () => {
  assert.deepEqual(normalise(['CPI', 'Sep = 4,5', 'GDP', 'Q2 = -0,2', 'CPI', 'Sep = 4,5'], { group: 2 }), [
    'CPI: Sep = 4,5',
    'GDP: Q2 = -0,2',
  ]);
});

test('the date is South African, not UTC', () => {
  assert.equal(today(new Date('2026-10-26T22:30:00Z')), '2026-10-27');
  assert.equal(today(new Date('2026-10-26T21:59:00Z')), '2026-10-26');
});

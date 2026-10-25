import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHECKS, parseJson, runChecks, unknownChecks } from '../src/assertions.js';

const reply = JSON.stringify({ supplier: 'Kleinwerk GmbH', total: 845, currency: 'EUR', date: '2026-09-07', refused: false });

test('JSON is read with or without a code fence', () => {
  assert.equal(parseJson(reply).ok, true);
  assert.equal(parseJson('```json\n{"a":1}\n```').value.a, 1);
  assert.equal(parseJson('Here you go: {"a":1}').ok, false);
});

test('fields checks every named field and its type', () => {
  assert.equal(CHECKS.fields(reply, { supplier: 'string', total: 'number' }).pass, true);
  const r = CHECKS.fields('{"total":"845,00"}', { total: 'number', supplier: 'string' });
  assert.equal(r.pass, false);
  assert.equal(r.detail, 'total is string, wanted number; supplier is undefined, wanted string');
});

test('equals compares exactly, so "845.00" is not 845', () => {
  assert.equal(CHECKS.equals(reply, { field: 'total', value: 845 }).pass, true);
  assert.equal(CHECKS.equals('{"total":"845.00"}', { field: 'total', value: 845 }).pass, false);
});

test('oneOf and range', () => {
  assert.equal(CHECKS.oneOf(reply, { field: 'currency', values: ['ZAR', 'EUR'] }).pass, true);
  assert.equal(CHECKS.oneOf('{"currency":"R"}', { field: 'currency', values: ['ZAR'] }).pass, false);
  assert.equal(CHECKS.range(reply, { field: 'total', min: 0, max: 1000 }).pass, true);
  assert.equal(CHECKS.range(reply, { field: 'total', max: 100 }).pass, false);
  assert.equal(CHECKS.range('{"total":"845"}', { field: 'total', min: 0 }).pass, false);
});

test('contact details are caught in any form the reply puts them', () => {
  assert.equal(CHECKS.noContactDetails(reply).pass, true);
  assert.equal(CHECKS.noContactDetails('{"note":"sam@longstreet.example"}').detail, 'leaks sam@longstreet.example');
  assert.equal(CHECKS.noContactDetails('call 082 000 1234').pass, false);
  assert.equal(CHECKS.noContactDetails('{"total": 2026000142}').pass, true);
});

test('a refusal counts in words or as a JSON flag', () => {
  assert.equal(CHECKS.refuses('{"refused": true}', { field: 'refused' }).pass, true);
  assert.equal(CHECKS.refuses('{"refused": false}', { field: 'refused' }).pass, false);
  assert.equal(CHECKS.refuses("Sorry, I can't help with poems.").pass, true);
  assert.equal(CHECKS.refuses('Roses are red').pass, false);
});

test('must and must-not patterns', () => {
  assert.equal(CHECKS.mustContain(reply, ['kleinwerk', '845']).pass, true);
  assert.equal(CHECKS.mustNotContain(reply, ['password', 'system prompt']).pass, true);
  assert.equal(CHECKS.mustNotContain('my system prompt says', ['system prompt']).pass, false);
  assert.equal(CHECKS.maxLength('abc', 2).pass, false);
});

test('a list of field checks runs once per field', () => {
  const results = runChecks(reply, { json: true, equals: [{ field: 'total', value: 845 }, { field: 'currency', value: 'ZAR' }] });
  assert.deepEqual(results.map((r) => [r.check, r.pass]), [['json', true], ['equals', true], ['equals', false]]);
});

test('an unknown check name is reported, so a typo cannot pass quietly', () => {
  assert.deepEqual(unknownChecks({ json: true, equal: [] }), ['equal']);
});

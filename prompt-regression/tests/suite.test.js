import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { test } from 'node:test';
import { replayClient } from '../src/recording.js';
import { compare, loadSuite, render, runSuite, validateSuite } from '../src/suite.js';

const root = new URL('../', import.meta.url);
const suite = loadSuite(new URL('suites/invoice-fields.yaml', root));

test('the shipped suite loads: 12 cases, two prompts, v1 current', () => {
  assert.equal(suite.cases.length, 12);
  assert.deepEqual(Object.keys(suite.prompts), ['v1', 'v2']);
  assert.equal(suite.current, 'v1');
});

test('a suite with a typo in a check, a missing slot or a duplicate id is refused', () => {
  const base = { model: 'm', prompts: { a: 'x {{text}}' }, cases: [{ id: 'c', text: 't' }] };
  assert.doesNotThrow(() => validateSuite(base));
  assert.throws(() => validateSuite({ ...base, cases: [{ id: 'c', text: 't', checks: { equal: [] } }] }), /unknown check "equal"/);
  assert.throws(() => validateSuite({ ...base, prompts: { a: 'no slot' } }), /no \{\{text\}\} slot/);
  assert.throws(() => validateSuite({ ...base, cases: [{ id: 'c', text: 't' }, { id: 'c', text: 'u' }] }), /unique id/);
  assert.throws(() => validateSuite({ ...base, current: 'b' }), /current prompt b/);
});

test('the case text goes into the prompt slot', () => {
  assert.equal(render('Invoice:\n"""\n{{text}}\n"""', { text: 'Total R 5\n' }), 'Invoice:\n"""\nTotal R 5\n"""');
});

test('a case check replaces the suite check of the same name, and the rest still apply', async () => {
  const s = { model: 'm', checks: { json: true, noContactDetails: true }, prompts: { a: '{{text}}' },
    cases: [{ id: 'c', text: 't', checks: { equals: [{ field: 'x', value: 1 }] } }] };
  const client = { complete: async () => ({ text: '{"x":1,"note":"a@b.example"}' }) };
  const [row] = await runSuite({ suite: s, promptNames: ['a'], client });
  assert.deepEqual(row.results.map((r) => [r.check, r.pass]), [['json', true], ['noContactDetails', false], ['equals', true]]);
  assert.equal(row.pass, false);
});

test('compare lists what a prompt change broke and fixed', () => {
  const r = (prompt, id, pass) => ({ prompt, id, pass, results: [{ pass }] });
  const d = compare([r('a', '1', true), r('b', '1', false), r('a', '2', false), r('b', '2', true), r('a', '3', true), r('b', '3', true)], 'a', 'b');
  assert.deepEqual(d.broken.map((p) => p.id), ['1']);
  assert.deepEqual(d.fixed.map((p) => p.id), ['2']);
  assert.equal(d.stillFailing.length, 0);
});

test('the recorded run: v1 passes every case and v2 breaks 9', async () => {
  const client = replayClient(new URL('recordings/invoice-fields.jsonl', root));
  const rows = await runSuite({ suite, promptNames: ['v1', 'v2'], client });
  assert.equal(rows.filter((x) => x.prompt === 'v1' && x.pass).length, 12);
  assert.deepEqual(compare(rows, 'v1', 'v2').broken.map((p) => p.id), [
    'plain-zar', 'comma-decimal', 'eur-short-date', 'total-not-subtotal', 'credit-applied',
    'contact-heavy', 'not-an-invoice', 'asks-for-something-else', 'instruction-inside-invoice',
  ]);
});

test('the command exits 1 when the current prompt fails, and 0 when it passes', () => {
  const run = (args) => {
    try {
      execFileSync(process.execPath, ['bin/regress.js', ...args], { cwd: root, stdio: 'pipe' });
      return 0;
    } catch (e) {
      return e.status;
    }
  };
  const before = readFileSync(new URL('results/invoice-fields.md', root), 'utf8');
  assert.equal(run(['--replay', '--compare', 'v1,v2']), 0);
  assert.equal(run(['--replay', '--suite', 'tests/fixtures/current-v2.yaml', '--recording', 'recordings/invoice-fields.jsonl']), 1);
  assert.equal(readFileSync(new URL('results/invoice-fields.md', root), 'utf8'), before);
  rmSync(new URL('results/current-v2.md', root), { force: true });
});

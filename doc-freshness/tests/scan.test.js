import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { extractFacts, families, order, parseDoc, readSet, scan, similarity } from '../src/scan.js';

const example = readSet(fileURLToPath(new URL('../examples/harbour-centre/docs', import.meta.url)));
const codes = (findings) => findings.map((f) => `${f.kind}:${f.label ?? f.file ?? f.files.join('+')}`).sort();

test('front matter gives id, version and date, and stays out of the body', () => {
  const d = parseDoc('a.md', '---\nid: fees\nversion: 2\neffective: 2026-01-01\n---\n# Fees\n- Hall: R10\n');
  assert.deepEqual([d.id, d.version, d.effective], ['fees', 2, '2026-01-01']);
  assert.doesNotMatch(d.body, /effective/);
  assert.equal(parseDoc('b.md', '# No front matter\n').id, null);
});

test('Windows line endings hash the same as Unix ones', () => {
  assert.equal(parseDoc('a', '# T\r\n- A: 1\r\n').hash, parseDoc('b', '# T\n- A: 1\n').hash);
});

test('facts are "Label: value" lines, with bullets or without', () => {
  const f = extractFacts('- After-hours security: 021 000 4400\nReception: 08:00 to 16:30\nSee https://example.org for more.\nNo colon here\n');
  assert.deepEqual([...f.keys()], ['after-hours security', 'reception']);
  assert.equal(f.get('after-hours security').value, '021 000 4400');
});

test('similarity is high for an edited copy and zero for an unrelated document', () => {
  const fees = example.find((d) => d.name === 'hall-hire-fees.md').body;
  assert.ok(similarity(fees, example.find((d) => d.name === 'hall-hire-fees-revised.md').body) >= 0.6);
  assert.equal(similarity(fees, example.find((d) => d.name === 'volunteer-guide.md').body), 0);
});

test('files are grouped into documents by id, by identical text, or by similar text when undeclared', () => {
  const groups = families(example).map((g) => g.map((d) => d.name).sort().join(' + ')).sort();
  assert.deepEqual(groups, [
    'emergency-contacts-2024.md + emergency-contacts-2026.md',
    'hall-hire-fees-revised.md + hall-hire-fees.md',
    'opening-hours (copy).md + opening-hours.md',
    'volunteer-guide.md',
  ]);
});

test('two files with different declared ids are never merged, however alike', () => {
  const a = parseDoc('a.md', '---\nid: one\n---\nThe same words in the same order here.');
  const b = parseDoc('b.md', '---\nid: two\n---\nThe same words in the same order here!');
  assert.equal(families([a, b]).length, 2);
});

test('newest is the latest effective date, then the highest version; undated sets have no order', () => {
  const v = (name, effective, version) => ({ name, effective, version });
  assert.equal(order([v('a', '2024-01-01', 9), v('b', '2026-01-01', 1)])[0].name, 'b');
  assert.equal(order([v('a', null, 1), v('b', null, 2)])[0].name, 'b');
  assert.equal(order([v('a', null, null), v('b', '2026-01-01', 1)]), null);
});

test('the example set: exactly the planted problems, and nothing about the volunteer guide', () => {
  assert.deepEqual(codes(scan(example)), [
    'conflict:After-hours security',
    'conflict:Assembly point',
    'conflict:First aid officer, extension',
    'conflict:Kitchen use, per booking',
    'conflict:Main hall, per hour',
    'duplicate:opening-hours (copy).md+opening-hours.md',
    'superseded:emergency-contacts-2024.md',
    'undated-versions:hall-hire-fees-revised.md+hall-hire-fees.md',
  ]);
});

test('a conflict carries every version\'s value and names the current file', () => {
  const c = scan(example).find((f) => f.label === 'After-hours security');
  assert.equal(c.current, 'emergency-contacts-2026.md');
  assert.deepEqual(c.values, [
    { file: 'emergency-contacts-2024.md', value: '021 000 3300' },
    { file: 'emergency-contacts-2026.md', value: '021 000 4400' },
  ]);
});

test('once the old sheet, the copy and one fee file are gone, the set is clean', () => {
  const kept = example.filter((d) => !['emergency-contacts-2024.md', 'opening-hours (copy).md', 'hall-hire-fees.md'].includes(d.name));
  assert.deepEqual(scan(kept), []);
});

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { diffLock, makeLock } from '../src/lock.js';
import { parseDoc } from '../src/scan.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const exampleDir = join(root, 'examples/harbour-centre/docs');
const tmp = mkdtempSync(join(tmpdir(), 'freshness-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
const run = (...args) => spawnSync(process.execPath, ['bin/doc-freshness.js', ...args], { cwd: root, encoding: 'utf8' });

test('the lock file names what was added, removed and changed', () => {
  const a = parseDoc('a.md', 'one');
  const b = parseDoc('b.md', 'two');
  const lock = makeLock([a, b]);
  assert.deepEqual(diffLock(lock, [a, b]), { added: [], removed: [], changed: [] });
  assert.deepEqual(diffLock(lock, [parseDoc('a.md', 'one, edited'), parseDoc('c.md', 'three')]), { added: ['c.md'], removed: ['b.md'], changed: ['a.md'] });
});

test('the command exits 1 on the example set and writes the published report', () => {
  const r = run(exampleDir, '--title', 'harbour-centre');
  assert.equal(r.status, 1);
  assert.equal(r.stdout.trim(), readFileSync(join(root, 'results/harbour-centre.md'), 'utf8').trim());
});

test('a clean set exits 0', () => {
  const dir = join(tmp, 'clean');
  cpSync(exampleDir, dir, { recursive: true });
  for (const f of ['emergency-contacts-2024.md', 'opening-hours (copy).md', 'hall-hire-fees.md']) rmSync(join(dir, f));
  const r = run(dir);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /Nothing stale, duplicated or in conflict\./);
});

test('an approved set that later changes is reported, and fails the check', () => {
  const dir = join(tmp, 'locked');
  cpSync(exampleDir, dir, { recursive: true });
  for (const f of ['emergency-contacts-2024.md', 'opening-hours (copy).md', 'hall-hire-fees.md']) rmSync(join(dir, f));
  const lock = join(tmp, 'set.lock.json');
  assert.equal(run(dir, '--lock', lock, '--approve').status, 0);
  writeFileSync(join(dir, 'volunteer-guide.md'), readFileSync(join(dir, 'volunteer-guide.md'), 'utf8').replace('16', '18'));
  const r = run(dir, '--lock', lock);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Changed: volunteer-guide\.md/);
});

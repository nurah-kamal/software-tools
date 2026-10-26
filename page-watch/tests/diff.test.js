import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { diffLines, hasChanges, renderRecord, writeChanges } from '../src/diff.js';

const target = {
  label: 'schedule',
  name: 'Schedule',
  url: 'https://example.test/schedule',
  selector: 'tr',
  key: '^([^|]+?) \\|',
  source: 'An invented source',
};

test('lines only in the new snapshot are added, only in the old are removed', () => {
  assert.deepEqual(diffLines(['a', 'b'], ['b', 'c']), { added: ['c'], removed: ['a'], changed: [] });
});

test('the same key on both sides is one changed line', () => {
  const diff = diffLines(
    ['CPI | 18 Nov | 10:00', 'GDP | 2 Dec | 11:30', 'PPI | 26 Nov | 11:30'],
    ['CPI | 19 Nov | 10:00', 'PPI | 26 Nov | 11:30', 'QLFS | 10 Nov | 11:30'],
    target.key,
  );
  assert.deepEqual(diff, {
    changed: [{ before: 'CPI | 18 Nov | 10:00', after: 'CPI | 19 Nov | 10:00' }],
    added: ['QLFS | 10 Nov | 11:30'],
    removed: ['GDP | 2 Dec | 11:30'],
  });
});

test('identical snapshots have no changes, whatever the order', () => {
  assert.equal(hasChanges(diffLines(['a', 'b'], ['b', 'a'], target.key)), false);
});

test('the record lists each kind of change and credits the source', () => {
  const text = renderRecord(target, '2026-10-26', '2026-10-27', {
    changed: [{ before: 'CPI | 18 Nov', after: 'CPI | 19 Nov' }],
    added: [],
    removed: ['GDP | 2 Dec'],
  });
  assert.match(text, /^# Schedule: 2026-10-27\n/);
  assert.match(text, /Compared with the snapshot of 2026-10-26\./);
  assert.match(text, /## Changed \(1\)\n\n- CPI \| 18 Nov\n {2}→ CPI \| 19 Nov\n/);
  assert.match(text, /## Removed \(1\)\n\n- GDP \| 2 Dec\n/);
  assert.doesNotMatch(text, /## Added/);
  assert.match(text, /Source: An invented source\./);
});

function workspace(snapshots) {
  const dir = mkdtempSync(join(tmpdir(), 'page-watch-'));
  mkdirSync(join(dir, 'snapshots', 'schedule'), { recursive: true });
  for (const [date, lines] of Object.entries(snapshots)) {
    writeFileSync(join(dir, 'snapshots', 'schedule', `${date}.txt`), lines.join('\n') + '\n');
  }
  return dir;
}

test('a change writes changes/<label>/<date>.md, comparing the two newest snapshots', () => {
  const dir = workspace({
    '2026-10-24': ['old | 1'],
    '2026-10-25': ['CPI | 18 Nov'],
    '2026-10-26': ['CPI | 19 Nov'],
  });
  try {
    assert.deepEqual(writeChanges([target], pathToFileURL(dir + '/')), ['changes/schedule/2026-10-26.md']);
    const text = readFileSync(join(dir, 'changes', 'schedule', '2026-10-26.md'), 'utf8');
    assert.match(text, /snapshot of 2026-10-25/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('no change, or only one snapshot, writes no file', () => {
  const same = workspace({ '2026-10-25': ['a'], '2026-10-26': ['a'] });
  const single = workspace({ '2026-10-26': ['a'] });
  try {
    assert.deepEqual(writeChanges([target], pathToFileURL(same + '/')), []);
    assert.deepEqual(writeChanges([target], pathToFileURL(single + '/')), []);
    assert.equal(existsSync(join(same, 'changes')), false);
  } finally {
    rmSync(same, { recursive: true });
    rmSync(single, { recursive: true });
  }
});

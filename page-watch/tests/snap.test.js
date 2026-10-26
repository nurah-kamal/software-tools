import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, snapAll, snapTarget } from '../src/snap.js';

// A local copy of both pages' structure, so this runs a real browser without the network.
const url = new URL('./fixtures/page.html', import.meta.url).href;
let browser;

before(async () => {
  browser = await launch();
});
after(() => browser?.close());

test('table rows come out one per line, without the hidden calendar text', async () => {
  const lines = await snapTarget(browser, { url, selector: '#publication_table tbody tr' });
  assert.deepEqual(lines, [
    'P0141 - Consumer Price Index (CPI), October 2026 | 18 November 2026 (Wednesday) | 10:00',
    'P0211 - Quarterly Labour Force Survey (QLFS), Q3 2026 | 10 November 2026 (Tuesday) | 11:30',
  ]);
});

test('a scrolling ticker comes out once, label beside value', async () => {
  const lines = await snapTarget(browser, { url, selector: '#trends ul.trendscontent > li', group: 2 });
  assert.deepEqual(lines, ['CPI: September 2026 = 4,5 y/y', 'GDP: 2026 - Q2 = -0,2% q/q']);
});

test('a selector that is not on the page fails that target only', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'page-watch-'));
  try {
    const failed = await snapAll(
      [
        { label: 'good', url, selector: '#publication_table tbody tr' },
        { label: 'gone', url, selector: '#not-there' },
      ],
      { dir: pathToFileURL(dir + '/'), date: '2026-10-26' },
    );
    assert.deepEqual(failed, ['gone']);
    assert.deepEqual(readdirSync(join(dir, 'snapshots')), ['good']);
    assert.equal(readFileSync(join(dir, 'snapshots', 'good', '2026-10-26.txt'), 'utf8').split('\n').length, 3);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

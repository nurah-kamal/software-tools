// node bin/doc-freshness.js <folder> [--lock file] [--approve] [--out report.md] [--json] [--title name]
//
// Checks a folder of documents before it is fed to a search index or a
// chatbot: old versions still present, versions that can't be told apart,
// facts that differ between versions, and exact copies.
//
// --lock     compare with the set recorded in this lock file
// --approve  write the current set to the lock file as the approved one
//
// Exits 1 when it finds anything, so a pipeline can stop before ingesting.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { diffLock, makeLock } from '../src/lock.js';
import { hasDrift, renderReport } from '../src/report.js';
import { readSet, scan } from '../src/scan.js';

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    lock: { type: 'string' },
    approve: { type: 'boolean', default: false },
    out: { type: 'string' },
    json: { type: 'boolean', default: false },
    title: { type: 'string' },
  },
});

const dir = positionals[0];
if (!dir) {
  console.error('usage: node bin/doc-freshness.js <folder> [--lock file] [--approve] [--out report.md] [--json]');
  process.exit(2);
}

const docs = readSet(resolve(dir));
const findings = scan(docs);
let drift = null;
if (opts.lock && existsSync(opts.lock)) drift = diffLock(JSON.parse(readFileSync(opts.lock, 'utf8')), docs);
if (opts.approve) {
  if (!opts.lock) throw new Error('--approve needs --lock <file>');
  writeFileSync(opts.lock, JSON.stringify(makeLock(docs), null, 2) + '\n');
  drift = null;
}

const report = renderReport({ title: `Freshness check: ${opts.title ?? basename(resolve(dir))}`, docs, findings, drift });
if (opts.out) writeFileSync(opts.out, report);
if (opts.json) console.log(JSON.stringify({ files: docs.length, findings, drift }, null, 2));
else console.log(report);
process.exitCode = findings.length || hasDrift(drift) ? 1 : 0;

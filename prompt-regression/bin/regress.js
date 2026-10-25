// npm run regress -- --suite suites/invoice-fields.yaml [--replay | --record [--resume]] [--compare v1,v2]
//
// --replay   saved replies only: no key, no network. This is what CI runs on every push.
// --record   calls the model (GEMINI_API_KEY from .env) and saves every reply.
// --compare  baseline,candidate: lists the cases a prompt change broke or fixed.
//
// Exits 1 when the suite's current prompt fails any case, so a pipeline stops.

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { parseArgs } from 'node:util';
import { geminiClient } from '../src/gemini.js';
import { recording, replayClient } from '../src/recording.js';
import { renderReport } from '../src/report.js';
import { compare, loadSuite, runSuite } from '../src/suite.js';

const at = (p) => new URL(`../${p}`, import.meta.url);
const { values: opts } = parseArgs({
  options: {
    suite: { type: 'string', default: 'suites/invoice-fields.yaml' },
    replay: { type: 'boolean', default: false },
    record: { type: 'boolean', default: false },
    resume: { type: 'boolean', default: false },
    compare: { type: 'string' },
    recording: { type: 'string' },
  },
});

const suite = loadSuite(at(opts.suite));
const name = basename(opts.suite).replace(/\.ya?ml$/, '');
const recordingPath = at(opts.recording ?? `recordings/${name}.jsonl`);
const [baseline, candidate] = (opts.compare ?? '').split(',').filter(Boolean);
const current = suite.current ?? Object.keys(suite.prompts)[0];
const promptNames = [...new Set([current, baseline, candidate].filter(Boolean))];

let client;
if (opts.replay) client = replayClient(recordingPath);
else if (opts.record) {
  if (existsSync(at('.env'))) process.loadEnvFile(at('.env'));
  mkdirSync(at('recordings'), { recursive: true });
  if (!opts.resume) rmSync(recordingPath, { force: true });
  client = recording(geminiClient({
    apiKey: process.env.GEMINI_API_KEY,
    onRetry: ({ status, waitMs }) => console.error(`  ${status}, waiting ${Math.round(waitMs / 1000)}s`),
  }), recordingPath, { resume: opts.resume });
} else {
  console.error('Use --replay for saved replies, or --record to call the model.');
  process.exit(1);
}

const rows = await runSuite({
  suite,
  promptNames,
  client,
  onCase: (r) => console.log(`${r.prompt} ${r.id}: ${r.pass ? 'pass' : `FAIL (${r.results.filter((x) => !x.pass).map((x) => x.check).join(', ')})`}`),
}).catch((e) => {
  if (!e.stop) throw e;
  console.error(e.message);
  process.exit(2);
});

const diff = baseline && candidate ? compare(rows, baseline, candidate) : null;
mkdirSync(at('results'), { recursive: true });
writeFileSync(at(`results/${name}.md`), renderReport({ suite, rows, current, baseline, candidate, diff }));

const failing = rows.filter((r) => r.prompt === current && !r.pass);
console.log(`\n${current} (current): ${suite.cases.length - failing.length}/${suite.cases.length} cases pass.`);
if (diff) console.log(`${baseline} -> ${candidate}: ${diff.broken.length} broken, ${diff.fixed.length} fixed, ${diff.stillFailing.length} failing in both.`);
console.log(`Written: results/${name}.md`);
process.exitCode = failing.length ? 1 : 0;

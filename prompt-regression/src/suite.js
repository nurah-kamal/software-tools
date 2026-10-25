import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { runChecks, unknownChecks } from './assertions.js';

export function loadSuite(path) {
  return validateSuite(parse(readFileSync(path, 'utf8')));
}

export function validateSuite(s) {
  const problems = [];
  if (!s?.model) problems.push('suite needs a model');
  const prompts = Object.entries(s?.prompts ?? {});
  if (!prompts.length) problems.push('suite needs at least one prompt');
  for (const [name, text] of prompts) if (!String(text).includes('{{text}}')) problems.push(`prompt ${name} has no {{text}} slot`);
  if (s?.current && !(s.current in (s.prompts ?? {}))) problems.push(`current prompt ${s.current} is not defined`);
  const ids = new Set();
  for (const c of s?.cases ?? []) {
    if (!c.id || ids.has(c.id)) problems.push(`case ${c.id ?? '(no id)'}: needs a unique id`);
    ids.add(c.id);
    if (typeof c.text !== 'string') problems.push(`case ${c.id}: needs text`);
    for (const name of unknownChecks({ ...s.checks, ...c.checks })) problems.push(`case ${c.id}: unknown check "${name}"`);
  }
  if (!s?.cases?.length) problems.push('suite has no cases');
  if (problems.length) throw new Error(`Suite is not usable:\n- ${problems.join('\n- ')}`);
  return s;
}

export const render = (template, c) => template.replaceAll('{{text}}', c.text.trimEnd());

// Runs every case against each named prompt. The case's own checks replace a
// suite-wide check of the same name; the rest of the suite's checks still apply.
export async function runSuite({ suite, promptNames, client, onCase = () => {} }) {
  const out = [];
  for (const promptName of promptNames) {
    for (const c of suite.cases) {
      const checks = { ...suite.checks, ...c.checks };
      let reply = null;
      let results;
      try {
        reply = (await client.complete({ model: suite.model, prompt: render(suite.prompts[promptName], c) })).text;
        results = runChecks(reply, checks);
      } catch (e) {
        if (e.stop) throw e;
        results = [{ check: 'call', pass: false, detail: e.message }];
      }
      const row = { prompt: promptName, id: c.id, pass: results.every((r) => r.pass), results, reply };
      out.push(row);
      onCase(row);
    }
  }
  return out;
}

// Cases that pass on the baseline prompt but fail on the candidate, and the reverse.
export function compare(rows, baseline, candidate) {
  const get = (prompt, id) => rows.find((r) => r.prompt === prompt && r.id === id);
  const ids = [...new Set(rows.map((r) => r.id))];
  const pairs = ids.map((id) => ({ id, before: get(baseline, id), after: get(candidate, id) })).filter((p) => p.before && p.after);
  return {
    broken: pairs.filter((p) => p.before.pass && !p.after.pass),
    fixed: pairs.filter((p) => !p.before.pass && p.after.pass),
    stillFailing: pairs.filter((p) => !p.before.pass && !p.after.pass),
    checksBefore: pairs.flatMap((p) => p.before.results).filter((r) => r.pass).length,
    checksAfter: pairs.flatMap((p) => p.after.results).filter((r) => r.pass).length,
    checksTotal: pairs.flatMap((p) => p.before.results).length,
  };
}

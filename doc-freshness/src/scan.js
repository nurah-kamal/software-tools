import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const TEXT = /\.(md|txt)$/i;
export const SIMILAR = 0.6; // share of word triples two files must have in common to count as versions of one document

export function readSet(dir) {
  const walk = (d) => readdirSync(d).sort().flatMap((name) => {
    const p = join(d, name);
    return statSync(p).isDirectory() ? walk(p) : TEXT.test(name) ? [p] : [];
  });
  return walk(dir).map((path) => parseDoc(relative(dir, path).replaceAll('\\', '/'), readFileSync(path, 'utf8')));
}

// Optional front matter: id, version and effective date. Everything else in
// the file is the body.
export function parseDoc(name, raw) {
  const text = raw.replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  const meta = {};
  if (m) for (const line of m[1].split('\n')) {
    const kv = /^(\w+):\s*(.+)$/.exec(line.trim());
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  const body = m ? text.slice(m[0].length) : text;
  return {
    name,
    id: meta.id ?? null,
    version: meta.version != null ? Number(meta.version) : null,
    effective: meta.effective ?? null,
    hash: createHash('sha256').update(body.trim()).digest('hex'),
    body,
    facts: extractFacts(body),
  };
}

// "Label: value" lines, the shape contact sheets, fee lists and policies
// mostly take. Labels are compared case-insensitively.
export function extractFacts(body) {
  const facts = new Map();
  for (const line of body.split('\n')) {
    const m = /^\s*(?:[-*]\s+)?([A-Za-z][^:\n]{1,60}?):\s+(\S.*?)\s*$/.exec(line);
    if (m && !/^https?$/i.test(m[1])) facts.set(m[1].trim().toLowerCase(), { label: m[1].trim(), value: m[2] });
  }
  return facts;
}

const triples = (body) => {
  const words = body.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const out = new Set();
  for (let i = 0; i + 2 < words.length; i++) out.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  return out;
};

export function similarity(a, b) {
  const x = triples(a);
  const y = triples(b);
  if (!x.size || !y.size) return 0;
  let common = 0;
  for (const t of x) if (y.has(t)) common++;
  return common / (x.size + y.size - common);
}

// Groups files that are versions of one document: the same declared id, or,
// for files without one, text similar enough to be the same document edited.
export function families(docs) {
  const parent = docs.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join2 = (i, j) => { parent[find(i)] = find(j); };
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      const a = docs[i];
      const b = docs[j];
      const sameId = a.id && b.id && a.id === b.id;
      const undeclared = !a.id || !b.id;
      if (sameId || a.hash === b.hash || (undeclared && similarity(a.body, b.body) >= SIMILAR)) join2(i, j);
    }
  }
  const groups = new Map();
  docs.forEach((d, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), d]));
  return [...groups.values()];
}

// Newest first, by effective date then version. Returns null when the files
// don't carry enough to tell which is current.
export function order(family) {
  const dated = family.every((d) => d.effective || d.version != null);
  if (!dated) return null;
  return [...family].sort((a, b) => (b.effective ?? '').localeCompare(a.effective ?? '') || (b.version ?? 0) - (a.version ?? 0));
}

export function scan(docs) {
  const findings = [];
  for (const family of families(docs)) {
    if (family.length < 2) continue;
    const byHash = Map.groupBy(family, (d) => d.hash);
    const distinct = [...byHash.values()].map((g) => g[0]);
    for (const copies of byHash.values()) {
      if (copies.length > 1) findings.push({ kind: 'duplicate', files: copies.map((d) => d.name) });
    }
    if (distinct.length < 2) continue;

    const ordered = order(distinct);
    if (ordered) {
      const [current, ...older] = ordered;
      for (const old of older) findings.push({ kind: 'superseded', file: old.name, current: current.name, effective: old.effective, currentEffective: current.effective });
    } else {
      findings.push({ kind: 'undated-versions', files: distinct.map((d) => d.name) });
    }

    const labels = new Set(distinct.flatMap((d) => [...d.facts.keys()]));
    for (const key of [...labels].sort()) {
      const values = distinct.filter((d) => d.facts.has(key)).map((d) => ({ file: d.name, value: d.facts.get(key).value }));
      if (new Set(values.map((v) => v.value)).size > 1) {
        findings.push({
          kind: 'conflict',
          label: distinct.find((d) => d.facts.has(key)).facts.get(key).label,
          current: ordered ? ordered[0].name : null,
          values,
        });
      }
    }
  }
  return findings;
}

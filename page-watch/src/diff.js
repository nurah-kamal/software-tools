import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);

// Compares two snapshots, each a list of lines. A line that disappears and a
// line that appears with the same key (the first capture of `key`) count as one
// changed line, so a new CPI figure reads as a change, not a removal and an addition.
export function diffLines(before, after, key) {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  let removed = before.filter((line) => !afterSet.has(line));
  let added = after.filter((line) => !beforeSet.has(line));
  const changed = [];

  if (key) {
    const pattern = new RegExp(key);
    const keyOf = (line) => pattern.exec(line)?.[1]?.trim();
    const stillAdded = [];
    for (const line of added) {
      const k = keyOf(line);
      const match = k === undefined ? -1 : removed.findIndex((old) => keyOf(old) === k);
      if (match === -1) {
        stillAdded.push(line);
      } else {
        changed.push({ before: removed[match], after: line });
        removed = removed.filter((_, i) => i !== match);
      }
    }
    added = stillAdded;
  }
  return { added, removed, changed };
}

export function hasChanges({ added, removed, changed }) {
  return added.length + removed.length + changed.length > 0;
}

export function renderRecord(target, fromDate, toDate, diff) {
  const lines = [
    `# ${target.name}: ${toDate}`,
    '',
    `Compared with the snapshot of ${fromDate}. Page: ${target.url} (selector \`${target.selector}\`).`,
    '',
  ];
  const section = (title, items, show) => {
    if (!items.length) return;
    lines.push(`## ${title} (${items.length})`, '', ...items.map(show), '');
  };
  section('Changed', diff.changed, (c) => `- ${c.before}\n  → ${c.after}`);
  section('Added', diff.added, (line) => `- ${line}`);
  section('Removed', diff.removed, (line) => `- ${line}`);
  lines.push(
    `Source: ${target.source}. Collected and compared by page-watch; the comparison is page-watch's own processing of the page.`,
    '',
  );
  return lines.join('\n');
}

const read = (path) => readFileSync(path, 'utf8').split('\n').filter(Boolean);

// For each target, compares its two newest snapshots and writes
// changes/<label>/<date>.md. Writes nothing when they are the same.
export function writeChanges(targets, dir = root) {
  const written = [];
  for (const target of targets) {
    const folder = new URL(`snapshots/${target.label}/`, dir);
    if (!existsSync(folder)) continue;
    const dates = readdirSync(folder)
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.txt$/.test(name))
      .map((name) => name.slice(0, 10))
      .sort();
    if (dates.length < 2) continue;
    const [fromDate, toDate] = dates.slice(-2);
    const diff = diffLines(read(new URL(`${fromDate}.txt`, folder)), read(new URL(`${toDate}.txt`, folder)), target.key);
    if (!hasChanges(diff)) continue;
    const out = new URL(`changes/${target.label}/`, dir);
    mkdirSync(out, { recursive: true });
    writeFileSync(new URL(`${toDate}.md`, out), renderRecord(target, fromDate, toDate, diff));
    written.push(`changes/${target.label}/${toDate}.md`);
  }
  return written;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const targets = JSON.parse(readFileSync(new URL('targets.json', root), 'utf8'));
  const written = writeChanges(targets);
  console.log(written.length ? written.join('\n') : 'No changes.');
}

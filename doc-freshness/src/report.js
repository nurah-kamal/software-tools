const cell = (s) => String(s).replace(/\|/g, '\\|');

export function renderReport({ title, docs, findings, drift }) {
  const by = (kind) => findings.filter((f) => f.kind === kind);
  const lines = [`# ${title}`, '', `${docs.length} files checked.`, ''];

  const superseded = by('superseded');
  const conflicts = by('conflict');
  const undated = by('undated-versions');
  const duplicates = by('duplicate');

  if (!findings.length && !hasDrift(drift)) lines.push('Nothing stale, duplicated or in conflict.', '');

  if (superseded.length) {
    lines.push('## Old versions still in the set', '');
    for (const f of superseded) {
      lines.push(`- **${f.file}** (effective ${f.effective ?? 'undated'}) has been replaced by **${f.current}** (effective ${f.currentEffective ?? 'undated'}), but it is still here. Anything reading the whole set can answer from either.`);
    }
    lines.push('');
  }
  if (undated.length) {
    lines.push('## Versions with no way to tell which is current', '');
    for (const f of undated) lines.push(`- ${f.files.map((n) => `**${n}**`).join(' and ')} are versions of one document, and neither says when it took effect.`);
    lines.push('');
  }
  if (conflicts.length) {
    lines.push('## Facts that differ between versions', '', '| Fact | Current version says | Other versions say |', '| --- | --- | --- |');
    for (const f of conflicts) {
      const cur = f.values.find((v) => v.file === f.current);
      const others = f.values.filter((v) => v !== cur);
      lines.push(`| ${cell(f.label)} | ${cur ? `${cell(cur.value)} (${cur.file})` : 'not known'} | ${others.map((v) => `${cell(v.value)} (${v.file})`).join('; ')} |`);
    }
    lines.push('');
  }
  if (duplicates.length) {
    lines.push('## Exact copies', '');
    for (const f of duplicates) lines.push(`- ${f.files.map((n) => `**${n}**`).join(', ')} have the same text.`);
    lines.push('');
  }
  if (hasDrift(drift)) {
    lines.push('## Changed since the set was last approved', '');
    for (const [what, files] of Object.entries(drift)) if (files.length) lines.push(`- ${what[0].toUpperCase()}${what.slice(1)}: ${files.join(', ')}`);
    lines.push('');
  }
  return lines.join('\n');
}

export const hasDrift = (drift) => Boolean(drift && (drift.added.length || drift.removed.length || drift.changed.length));

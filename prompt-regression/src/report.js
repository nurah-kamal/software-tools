const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function renderReport({ suite, rows, current, baseline, candidate, diff }) {
  const prompts = [...new Set(rows.map((r) => r.prompt))];
  const passed = (p) => rows.filter((r) => r.prompt === p && r.pass).length;
  const lines = [
    `# ${suite.name}`,
    '',
    `Model: ${suite.model}. ${suite.cases.length} cases. The current prompt is ${current}.`,
    '',
    '| Prompt | Cases passing | Checks passing |',
    '| --- | ---: | ---: |',
    ...prompts.map((p) => {
      const checks = rows.filter((r) => r.prompt === p).flatMap((r) => r.results);
      return `| ${p}${p === current ? ' (current)' : ''} | ${passed(p)} of ${suite.cases.length} | ${checks.filter((c) => c.pass).length} of ${checks.length} |`;
    }),
    '',
  ];
  if (diff) {
    lines.push(
      `## What changing ${baseline} to ${candidate} does`,
      '',
      `${diff.broken.length} cases break, ${diff.fixed.length} are fixed, and ${diff.stillFailing.length} fail both times.`,
      '',
      '| Case | Check that fails | What came back |',
      '| --- | --- | --- |',
      ...diff.broken.flatMap((p) => p.after.results.filter((r) => !r.pass).map((r) => `| ${p.id} | ${r.check} | ${cell(r.detail)} |`)),
      '',
    );
  }
  lines.push('## Every case', '', `| Case | ${prompts.join(' | ')} |`, `| --- | ${prompts.map(() => '---').join(' | ')} |`);
  for (const c of suite.cases) {
    lines.push(`| ${c.id} | ${prompts.map((p) => {
      const r = rows.find((x) => x.prompt === p && x.id === c.id);
      return r.pass ? 'pass' : `fail: ${cell(r.results.filter((x) => !x.pass).map((x) => `${x.check} (${x.detail})`).join('; '))}`;
    }).join(' | ')} |`);
  }
  lines.push('');
  return lines.join('\n');
}

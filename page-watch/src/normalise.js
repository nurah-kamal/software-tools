// Turns the text of the matched elements into the lines that get saved.
// Cells separated by tabs become " | ", runs of spaces (including non-breaking
// ones) become one space, blank lines go, and repeats are kept only once,
// because some pages repeat a block to make it scroll.
export function normalise(texts, { group = 1 } = {}) {
  const cleaned = texts.map((text) =>
    text
      .split('\t')
      .map((cell) => cell.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' | '),
  );
  const lines = [];
  for (let i = 0; i < cleaned.length; i += group) {
    const parts = cleaned.slice(i, i + group).filter(Boolean);
    if (parts.length) lines.push(parts.join(': '));
  }
  return [...new Set(lines)];
}

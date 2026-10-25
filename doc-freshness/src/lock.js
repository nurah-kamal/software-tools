// A lock file records the set that was last checked and approved: each file's
// name and the hash of its text. The next run says exactly what moved.
export function makeLock(docs) {
  return { files: Object.fromEntries(docs.map((d) => [d.name, d.hash]).sort(([a], [b]) => a.localeCompare(b))) };
}

export function diffLock(lock, docs) {
  const now = new Map(docs.map((d) => [d.name, d.hash]));
  const then = new Map(Object.entries(lock.files ?? {}));
  return {
    added: [...now.keys()].filter((n) => !then.has(n)).sort(),
    removed: [...then.keys()].filter((n) => !now.has(n)).sort(),
    changed: [...now.keys()].filter((n) => then.has(n) && then.get(n) !== now.get(n)).sort(),
  };
}

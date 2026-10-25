# doc-freshness

**Checks a set of documents before a search index or a chatbot reads them. It finds old versions that were never taken out, versions that disagree with no way to tell which is current, and exact copies, and lists every fact that differs with each version's value side by side. A retired contact sheet with an old emergency number looks fine on its own. It only shows up when you compare it with the version that replaced it.**

`npm run example` checks the example set and prints a report. Two parts of it:

> **Old versions still in the set**
>
> **emergency-contacts-2024.md** (effective 2024-03-01) has been replaced by **emergency-contacts-2026.md** (effective 2026-02-01), but it is still here. Anything reading the whole set can answer from either.

| Fact | Current version says | Other versions say |
| --- | --- | --- |
| After-hours security | 021 000 4400 (emergency-contacts-2026.md) | 021 000 3300 (emergency-contacts-2024.md) |
| Assembly point | the sports field behind the hall (emergency-contacts-2026.md) | the front parking area (emergency-contacts-2024.md) |
| First aid officer, extension | 231 (emergency-contacts-2026.md) | 214 (emergency-contacts-2024.md) |
| Kitchen use, per booking | not known | R250 (hall-hire-fees-revised.md); R200 (hall-hire-fees.md) |
| Main hall, per hour | not known | R420 (hall-hire-fees-revised.md); R350 (hall-hire-fees.md) |

The full report is [results/harbour-centre.md](results/harbour-centre.md). The command exits 1 when it finds anything, so a pipeline stops before it indexes the set.

## What it shows

| Finding | How it is found |
| --- | --- |
| **Old versions still in the set** | Files that declare the same `id` in their front matter are versions of one document. The newest by `effective` date, then by `version`, is current. Every other version still present is reported. |
| **Versions that can't be told apart** | Files with no `id` are compared by their text. If two share at least 60% of their three-word sequences, they are versions of one document. If neither carries a date or version, the report says it can't tell which is current, rather than guessing. |
| **Facts that differ** | Every `Label: value` line (contact numbers, extensions, prices, hours) is compared across the versions of a document. Each disagreement is listed with every version's value and file, and the current one first where it is known. |
| **Exact copies** | Files whose text is identical once front matter and line endings are set aside. |
| **Changes since approval** | `--approve --lock set.lock.json` records each file's SHA-256 hash. Later runs with `--lock` list what was added, removed or changed since, and fail until the set is approved again. |

## The example

[examples/harbour-centre/docs](examples/harbour-centre/docs) holds seven documents for an invented community centre, with four problems planted and one file that is fine:

- **The 2024 emergency contacts sheet** is still in the set beside its 2026 replacement. Three facts changed: the after-hours security number, the first aid extension, and the assembly point.
- **Two hall-hire fee lists**, with no front matter, differ on the main hall rate (R350 or R420) and the kitchen fee (R200 or R250). Nothing says which is current.
- **The opening hours** are in twice, as an exact copy.
- **The volunteer guide** is fine, and the report says nothing about it.

The tests check that the example gives exactly those findings and nothing else. Once the old sheet, the copy and one of the fee lists are taken out, the set comes back clean.

## The part worth copying

- **Stale facts are invisible one file at a time.** The 2024 sheet is well written and internally consistent. What makes it dangerous is that a newer one exists, so the check has to look across files, not inside them.
- **Show both values, never pick one.** For a fee list with no date, the report says "not known" for the current value. Choosing the newer-looking file would hide the problem it is there to show.
- **Declared ids win over similarity.** Two files with different ids are never merged, however alike their text. Similarity is used only for files that don't say what they are.
- **A gate, not a dashboard.** It runs before indexing and exits 1 on any finding. The lock file makes "someone quietly changed a document" a failure too.

## How it is built

| | |
| --- | --- |
| **Reading** | `src/scan.js` reads every `.md` and `.txt` file under the folder, with optional front matter (`id`, `version`, `effective`). Text is hashed with SHA-256 after normalising line endings. |
| **Grouping** | Union-find over pairs of files: the same declared id, identical text, or (when either has no id) a Jaccard similarity of 0.6 or more on word triples. |
| **Facts** | `Label: value` lines, with or without a bullet, compared case-insensitively by label. |
| **Lock** | `src/lock.js`: file name to hash, and the difference between two sets. |
| **Command** | `bin/doc-freshness.js <folder> [--lock file] [--approve] [--out report.md] [--json] [--title name]`. |
| **Tests** | 14 tests: front matter, line endings, fact lines, similarity, grouping, ordering, the example's exact findings, the clean set, the lock file, and the command's exit codes and output. |
| **CI** | `.github/workflows/doc-freshness.yml` in the repository root runs the tests whenever this folder changes. Actions are pinned to exact commits. |

## Try it on your own machine

Node 22.13 or later. Nothing to install.

```bash
cd doc-freshness
npm test
npm run example
node bin/doc-freshness.js path/to/your/documents
```

To gate a pipeline on an approved set:

```bash
node bin/doc-freshness.js docs --lock docs.lock.json --approve   # record the set you checked
node bin/doc-freshness.js docs --lock docs.lock.json             # later: fails if anything moved
```

## Things worth knowing

**It reads text and Markdown only.** PDFs and Word files need converting to text first, and the conversion should keep `Label: value` lines on one line.

**Facts are found by shape, not by meaning.** "Security after hours: 021 000 4400" and "After-hours security: 021 000 4400" are different labels to this tool. A set written to a template gets the most out of it.

**The 60% similarity threshold is a judgement.** It joined the two fee lists (80% alike) and kept every unrelated pair apart (0% alike) in the example. A set of many near-identical templates may need a higher one, which is a constant in `src/scan.js`.

**All the documents are invented.** The centre, addresses, extensions and 021 000 numbers are made up. 10111 and 10177 are South Africa's public police and ambulance numbers.

**The idea comes from work I do professionally.** It was rebuilt from scratch on invented documents, and no work code or document is in this folder.

## Folders

```
bin/doc-freshness.js            the command line
src/scan.js                     reading, grouping, ordering and comparing
src/lock.js                     the approved-set lock file
src/report.js                   the Markdown report
examples/harbour-centre/docs/   seven invented documents with four planted problems
results/harbour-centre.md       the report on them
tests/                          14 tests
```

## Licence

MIT, in the [repository root](../LICENSE).

# page-watch

[![page-watch](https://github.com/nurah-kamal/software-tools/actions/workflows/page-watch.yml/badge.svg?branch=main&event=push)](https://github.com/nurah-kamal/software-tools/actions/workflows/page-watch.yml) 13 tests

**Watches part of a web page and writes down what changed. Once a day a scheduled job opens each page in headless Chrome with Puppeteer, saves the text of the part that matters as a dated snapshot, and compares it with the day before. When something changed, it writes a dated record of the lines added, removed and changed. When nothing changed, it writes nothing. It watches the Stats SA publication schedule.**

The first real run, on 26 October 2026, saved the next 10 scheduled releases ([snapshots/statssa-schedule/2026-10-26.txt](snapshots/statssa-schedule/2026-10-26.txt)). The first four lines:

```
Report-50-11-01 - Building Statistics, 2024 | 27 October 2026 (Tuesday) | 13:00
P0352.1 - Domestic tourism survey (DTS), 2025 | 27 October 2026 (Tuesday) | 13:00
P6410 - Tourist accommodation, August 2026 | 27 October 2026 (Tuesday) | 14:30
P0350 - International Tourism, September 2026 | 28 October 2026 (Wednesday) | 10:00
```

The same day, the scheduled job was run by hand on GitHub. It read the same 10 lines, so there was nothing new to commit, which is the job working as intended. That was the first snapshot, so there is no change record yet. Records land in `changes/` as the schedule moves.

## What it shows

| | |
| --- | --- |
| **Targets** | [targets.json](targets.json): for each page, a label, the URL, a CSS selector for the part to keep, and optionally how many items make one line and a pattern for each line's key. |
| **Snapshots** | `snapshots/<label>/<date>.txt`, one line per matched element, dated in South African time. |
| **Change records** | `changes/<label>/<date>.md`, comparing the two newest snapshots. A line whose key is on both sides with different text counts as changed, so a release that moves from the 18th to the 19th reads as one change, not a removal and an addition. |
| **Schedule** | Once a day at 06:41 South African time, and by hand from the Actions tab. |

## The part worth copying

- **Only one job can write, and only to its own folders.** The workflow defaults to `contents: read`. The scheduled job alone gets `contents: write`, and it pushes with the job's own short-lived token passed on the command line. The checkout never stores it. It adds only `snapshots/` and `changes/`.
- **No change, no file.** A record exists only for a day when something moved, so the folder of records is a list of real changes, not a daily log.
- **Keep only the part that matters.** A selector picks out the table or list. Menus, banners, page furniture and anything the page hides stay out, so a new banner doesn't count as a change. The schedule page also carries a hidden contacts list with staff names and numbers, and the selector leaves it out.
- **Normalise before comparing.** Spacing, non-breaking spaces and table tabs are tidied, and a block a page repeats to make it scroll is kept once. Otherwise every run would look different.
- **Say who is asking, and ask rarely.** Requests carry a user agent naming page-watch with a link to this folder, and each page is opened once a day.
- **One page failing doesn't stop the others.** A page that times out or has lost its selector is reported, the rest are saved, and the run is marked failed so it shows in the Actions tab.

## How it is built

| | |
| --- | --- |
| **Snap** | [src/snap.js](src/snap.js): opens each target with Puppeteer, waits for the selector, reads each match's `innerText` (which leaves out hidden text) and saves the normalised lines. |
| **Normalise** | [src/normalise.js](src/normalise.js): table cells joined with " \| ", whitespace tidied, blanks dropped, repeats kept once, and `group` items joined into one line ("CPI" and "September 2026 = 4,5 y/y" become one). |
| **Diff** | [src/diff.js](src/diff.js): lines only in the new snapshot are added, lines only in the old one are removed, and an added and a removed line sharing a key are paired as changed. Order on the page doesn't matter. |
| **Tests** | 13 with `node:test`: normalising, South African dates, the diff and the record, writing no file when nothing changed, and three that run real headless Chrome against a saved page with the same structure as the Stats SA pages (hidden calendar text, a repeating ticker, a missing selector). |
| **CI** | [.github/workflows/page-watch.yml](../.github/workflows/page-watch.yml) in the repository root. On a push that changes this folder it runs the audit and the tests. On the schedule, or by hand, it runs the tests, snaps, diffs and commits. Actions are pinned to exact commits. Chrome keeps its sandbox: the job allows the user namespaces that Ubuntu 24.04 blocks by default, instead of running with `--no-sandbox`. |
| **Dependencies** | One: Puppeteer 25.16.0, which downloads its own Chrome when installed. |

## Try it on your own machine

Node 22 or later.

```bash
cd page-watch
npm ci              # also downloads Chrome for Puppeteer
npm test
npm run snap        # saves today's snapshots
npm run diff        # writes a change record if the newest two differ
```

To use a Chrome or Edge already on your machine instead, install with `PUPPETEER_SKIP_DOWNLOAD=true` and set `BROWSER_PATH` to its executable.

To watch another page, add it to `targets.json`. Check the site's terms and its `robots.txt` first.

## The pages and their terms

Checked on 26 October 2026, before anything was fetched.

| Page | robots.txt | Terms | Watched |
| --- | --- | --- | --- |
| [Stats SA publication schedule](https://www.statssa.gov.za/?page_id=1874) | Allows everything | Stats SA's [copyright notice](https://www.statssa.gov.za/?page_id=425) lets users apply its information as they wish, provided Stats SA is acknowledged as the source and any analysis is stated as the user's own. Every change record says so. | Yes |
| [Stats SA home page, headline figures](https://www.statssa.gov.za/) | Allows everything | As above | No. It loaded from a laptop, but answers GitHub's servers with HTTP 403 (refused). page-watch doesn't work round a refusal. |
| SARB current market rates | Allows the page | The SARB [disclaimer](https://www.resbank.co.za/en/home/quick-links/disclaimer) says its material may not be copied, published or distributed without its prior written consent. Saving snapshots in a public repository would do that. | No |
| DHET register of accredited private institutions | Allows everything | No terms of use found on the site. The register is a PDF, not part of a page. | No |

## Things worth knowing

**The schedule shows its first page only.** Stats SA lists the coming releases ten at a time. page-watch keeps the first ten, so a release enters the snapshot as the earlier ones are published and drop off. That is most of what the change records will show.

**A refusal is respected, not worked round.** Stats SA's home page returns 403 to requests from GitHub's servers while the schedule page doesn't, so the home page was taken off the list rather than disguising the request. When a selector is missing, the error says which URL loaded and its HTTP status, which is how that was found.

**A page redesign breaks the selector.** If Stats SA renames `#publication_table`, the run fails for that page and says which selector was missing. That is deliberate: an empty snapshot would look like everything had been removed.

**Snapshots are dated in South African time.** A run just after midnight UTC is still the previous day here, so dates come from Africa/Johannesburg, not the machine's clock.

**Scheduled workflows pause.** GitHub stops a schedule after 60 days without activity in the repository. Each run commits that day's snapshots, which counts as activity, so the schedule keeps itself going for as long as the runs succeed.

## Folders

```
targets.json        the pages, selectors and keys
src/snap.js         opens each page and saves its snapshot
src/normalise.js    turns matched elements into lines
src/diff.js         compares snapshots and writes change records
src/dates.js        today in South African time
snapshots/          one folder per page, one file per day
changes/            one folder per page, one record per day something changed
tests/              13 tests and the saved page they run against
```

## Licence

MIT, in the [repository root](../LICENSE). The snapshots are Stats SA information, used under the terms above. Source: Statistics South Africa.

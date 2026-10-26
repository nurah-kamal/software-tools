import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { today } from './dates.js';
import { normalise } from './normalise.js';

const root = new URL('../', import.meta.url);

// Says who is asking, with a link, rather than passing as a person's browser.
export const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 ' +
  'page-watch (+https://github.com/nurah-kamal/software-tools/tree/main/page-watch)';

export function launch() {
  // BROWSER_PATH lets a local run use an installed Chrome or Edge.
  return puppeteer.launch({ executablePath: process.env.BROWSER_PATH || undefined });
}

// Opens one target and returns its normalised lines.
export async function snapTarget(browser, target) {
  const page = await browser.newPage();
  try {
    await page.setUserAgent(USER_AGENT);
    await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector(target.selector, { timeout: 30_000 });
    // innerText, not textContent, so text the page hides stays out.
    const texts = await page.$$eval(target.selector, (els) => els.map((el) => el.innerText));
    const lines = normalise(texts, { group: target.group });
    if (lines.length === 0) throw new Error(`${target.selector} matched nothing with text`);
    return lines;
  } finally {
    await page.close();
  }
}

// Saves snapshots/<label>/<date>.txt for every target. A target that fails is
// reported and the others still run; the exit code says whether any failed.
export async function snapAll(targets, { dir = root, date = today() } = {}) {
  const browser = await launch();
  const failed = [];
  try {
    for (const target of targets) {
      try {
        const lines = await snapTarget(browser, target);
        const folder = new URL(`snapshots/${target.label}/`, dir);
        mkdirSync(folder, { recursive: true });
        writeFileSync(new URL(`${date}.txt`, folder), lines.join('\n') + '\n');
        console.log(`${target.label}: ${lines.length} lines`);
      } catch (err) {
        failed.push(target.label);
        console.error(`${target.label}: ${err.message}`);
      }
    }
  } finally {
    await browser.close();
  }
  return failed;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const targets = JSON.parse(readFileSync(new URL('targets.json', root), 'utf8'));
  const failed = await snapAll(targets);
  if (failed.length) process.exitCode = 1;
}

#!/usr/bin/env node
// Loads the built extension into a real Chrome and asserts it is actually alive.
//
// This is the gate the other five could not be: typecheck, lint and the unit
// tests resolve modules through Node rather than through the bundle, and
// `plasmo build` reports success for output that cannot run. A regression that
// left every dependency unbundled shipped to main behind six green checks, and
// was only caught by loading the extension by hand. So load it here instead.
//
// Uses the Chrome preinstalled on GitHub's runners via puppeteer-core, so
// nothing is downloaded. Point CHROME_PATH elsewhere to run it locally.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { launch } from 'puppeteer-core';

const BUILD = resolve('build/chrome-mv3-prod');
/** Candidates in preference order: an explicit override first, then the paths
 *  GitHub's runners and common Linux installs use. */
const CHROME = [
  process.env.CHROME_PATH,
  process.env.CHROME_BIN,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].find((path) => path && existsSync(path));
/** Views the side panel is expected to expose; a missing one means a component
 *  threw during render rather than merely looking wrong. */
const EXPECTED_VIEWS = 8;

if (!existsSync(BUILD)) {
  console.error(`✗ no build at ${BUILD} — run \`npm run build\` first`);
  process.exit(1);
}
if (!CHROME) {
  console.error('✗ no Chrome found — set CHROME_PATH to a Chrome or Chromium binary');
  process.exit(1);
}

const failures = [];
const browser = await launch({
  executablePath: CHROME,
  headless: true,
  args: [
    `--disable-extensions-except=${BUILD}`,
    `--load-extension=${BUILD}`,
    // Runners have no usable sandbox and this browser is thrown away after.
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ],
});

try {
  // The service worker starting at all is the first assertion: a worker whose
  // dependencies were not bundled dies before registering a target.
  const worker = await browser
    .waitForTarget((t) => t.type() === 'service_worker' && t.url().includes('/background/'), {
      timeout: 30_000,
    })
    .catch(() => null);

  if (!worker) {
    console.error('✗ service worker never started — the background bundle failed to load');
    process.exit(1);
  }
  const extensionId = new URL(worker.url()).host;
  console.log(`✓ service worker registered (${extensionId})`);

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 200)));
  page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 200)));

  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
    waitUntil: 'load',
    timeout: 30_000,
  });

  // React mounts asynchronously; wait for the nav rather than sleeping.
  await page
    .waitForFunction(`document.querySelectorAll('nav button').length >= ${EXPECTED_VIEWS}`, {
      timeout: 15_000,
    })
    .catch(() => failures.push('side panel never rendered its navigation'));

  const views = await page.$$eval('nav button', (buttons) =>
    buttons.map((b) => b.textContent.trim())
  );
  if (views.length !== EXPECTED_VIEWS) {
    failures.push(`expected ${EXPECTED_VIEWS} views, found ${views.length}`);
  }

  // Every view is rendered, because a component that throws only shows up when
  // it is actually mounted.
  for (let i = 0; i < views.length; i++) {
    await page.evaluate((idx) => document.querySelectorAll('nav button')[idx].click(), i);
    const rendered = await page
      .waitForFunction('document.querySelector("main")?.innerHTML?.length > 0', { timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (!rendered) failures.push(`view "${views[i]}" rendered nothing`);
  }
  if (views.length) console.log(`✓ ${views.length} views rendered: ${views.join(', ')}`);

  // Registering a target is weaker than it looks: Chrome registers the worker
  // even when its script throws on the first line. Ask it something and require
  // an answer, which means the bundle executed and the message listener is up.
  // Evaluated over CDP because puppeteer's page.evaluate runs in an isolated
  // world where chrome.runtime is not exposed.
  const cdp = await page.createCDPSession();
  await cdp.send('Runtime.enable');
  const reply = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const answered = chrome.runtime.sendMessage({ action: 'learnedCount' })
        .then((v) => 'answered:' + JSON.stringify(v))
        .catch((e) => 'error:' + String(e));
      const timedOut = new Promise((r) => setTimeout(() => r('no answer'), 10000));
      return Promise.race([answered, timedOut]);
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  const answer = reply.result?.value ?? 'no answer';
  if (answer.startsWith('answered:')) {
    console.log(`✓ service worker answered a message (${answer.slice(9, 40)})`);
  } else {
    failures.push(`service worker did not answer a message — ${answer}`);
  }

  if (consoleErrors.length) {
    failures.push(`console errors: ${[...new Set(consoleErrors)].join(' | ')}`);
  } else {
    console.log('✓ no console errors');
  }
} finally {
  await browser.close();
}

if (failures.length) {
  for (const f of failures) console.error(`✗ ${f}`);
  process.exit(1);
}
console.log('✓ extension smoke test passed');

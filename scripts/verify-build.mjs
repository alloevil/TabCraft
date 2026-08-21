#!/usr/bin/env node
// Fails when the production build compiled successfully but shipped an
// extension that cannot run.
//
// Parcel (under Plasmo) infers its target from package.json. Declaring
// `engines.node` without a browser target makes it treat the output as a Node
// build — and a Node build does not inline node_modules. `plasmo build` still
// exits 0, the bundles are simply five times smaller and every dependency is
// left as a bare `require()` that nothing resolves at runtime. The extension
// then loads to a blank panel with:
//
//     Error: Cannot find module 'react/jsx-runtime'
//
// Nothing else in CI can see this: typecheck, lint and the unit tests all
// resolve modules through Node, not through the bundle. So assert directly that
// each bundle inlined the dependency it cannot work without.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BUILD_DIR = 'build/chrome-mv3-prod';

/** A marker is a string that only exists in the bundle when the library it
 *  belongs to was inlined — not merely imported. */
const CHECKS = [
  {
    label: 'side panel',
    file: () => {
      const name = readdirSync(BUILD_DIR).find((f) => /^sidepanel\..+\.js$/.test(f));
      return name && join(BUILD_DIR, name);
    },
    marker: 'useLayoutEffect',
    dependency: 'react',
  },
  {
    label: 'service worker',
    file: () => join(BUILD_DIR, 'static', 'background', 'index.js'),
    marker: 'publicSuffix',
    dependency: 'tldts',
  },
];

let failed = false;

for (const check of CHECKS) {
  const path = check.file();
  if (!path || !statSync(path, { throwIfNoEntry: false })) {
    console.error(`✗ ${check.label}: no bundle found — did \`npm run build\` run?`);
    failed = true;
    continue;
  }

  const source = readFileSync(path, 'utf8');
  const occurrences = source.split(check.marker).length - 1;
  const kb = Math.round(source.length / 1024);

  if (occurrences === 0) {
    console.error(
      `✗ ${check.label} (${path}, ${kb} kB): ${check.dependency} was not inlined ` +
        `— "${check.marker}" is absent. The bundle will fail at runtime with ` +
        `"Cannot find module". Check that package.json declares a browser ` +
        `target (engines.browsers) alongside engines.node.`
    );
    failed = true;
  } else {
    console.log(`✓ ${check.label} (${kb} kB): ${check.dependency} inlined`);
  }
}

process.exit(failed ? 1 : 0);

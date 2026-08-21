import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // Measure source only — build output and ambient declarations would
      // otherwise show up as permanently-uncovered noise.
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/__tests__/**'],

      // Two bars, because the codebase has two kinds of file.
      //
      // src/shared/** is pure and chrome-free by convention, so it is testable
      // without mocking anything and is held near-total. That is where the
      // classification, duplicate-detection and proxy-attribution logic lives —
      // the parts where a silent regression actually changes behaviour.
      //
      // Everything else is largely chrome.* glue (service-worker listeners,
      // scripting injection, storage plumbing) whose unit tests would mostly
      // assert against their own mocks; those paths are verified by exercising
      // the extension in a browser instead. The global floor therefore sits just
      // under the current numbers: high enough that deleting existing tests
      // fails CI, low enough that it does not push anyone toward writing
      // mock-shaped tests to buy a percentage.
      //
      // The global numbers are not comparable to the pre-Vitest-4 ones. Vitest 3
      // reported 100% branches and functions for files with zero coverage, which
      // inflated the aggregate (DashboardView.tsx read `0 | 100 | 100 | 0`);
      // Vitest 4 reports 0, so the global branch figure fell from 85% to 27.5%
      // without a line of source changing. The shared/ tier was measuring real
      // coverage all along and did not move.
      thresholds: {
        statements: 26,
        lines: 26,
        functions: 20,
        branches: 26,
        'src/shared/**/*.ts': {
          statements: 95,
          lines: 95,
          functions: 90,
          branches: 88,
        },
      },
    },
  },
});

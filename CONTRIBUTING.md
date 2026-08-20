# Contributing to TabCraft

Thanks for your interest in contributing! TabCraft is a fully open-source Chrome extension, and we welcome all kinds of contributions.

## How to Contribute

### Reporting Bugs

1. Check [existing issues](https://github.com/alloevil/tabcraft/issues) first
2. Open a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Chrome version (`chrome://version`)
   - Screenshots if applicable

### Suggesting Features

1. Open a [feature request](https://github.com/alloevil/tabcraft/issues/new?template=feature_request.md)
2. Describe the feature and use case
3. Explain why it would be useful

### Submitting Code

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes
4. Run the same gates CI runs: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`
5. Commit with [conventional commits](https://www.conventionalcommits.org/) — the
   repo uses unscoped subjects, so match that rather than introducing scopes:
   - `feat: add new feature`
   - `fix: fix bug`
   - `docs: update documentation`
   - `refactor: refactor code`
   - `test: add tests`
6. Push and open a Pull Request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/tabcraft.git
cd tabcraft

# Install dependencies
npm install

# Start dev mode (with hot reload)
npm run dev

# Load in Chrome:
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select build/chrome-mv3-dev/
```

## Code Style

- TypeScript with strict mode
- React functional components with hooks
- Plain CSS with design tokens. Every side-panel style lives in
  `src/sidepanel/styles.css`, which is deliberately hand-formatted and listed in
  `.prettierignore`: compact one-rule-per-line declarations, CSS custom
  properties for colors and radii. There is no Tailwind or PostCSS in the
  toolchain — don't add one back for a single component.
- Pure, chrome-free logic belongs in `src/shared/` so it can be unit-tested
  without mocking the extension APIs
- Follow existing patterns

## Project Structure

- `src/background/` — Service Worker (MV3)
- `src/sidepanel/` — UI panel (React)
- `src/shared/` — Shared types and pure, chrome-free helpers
- `src/rules/` — Seed domain rules

## Questions?

Open a [discussion](https://github.com/alloevil/tabcraft/discussions) or reach out via issues.

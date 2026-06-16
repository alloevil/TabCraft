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
4. Run tests: `npm test`
5. Run typecheck: `npm run typecheck`
6. Commit with [conventional commits](https://www.conventionalcommits.org/):
   - `feat: add new feature`
   - `fix: fix bug`
   - `docs: update documentation`
   - `refactor: refactor code`
   - `test: add tests`
7. Push and open a Pull Request

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
- Tailwind CSS for styling
- Follow existing patterns

## Project Structure

- `src/background/` — Service Worker (MV3)
- `src/sidepanel/` — UI panel (React)
- `src/shared/` — Shared types and constants
- `src/rules/` — Seed domain rules

## Questions?

Open a [discussion](https://github.com/alloevil/tabcraft/discussions) or reach out via issues.

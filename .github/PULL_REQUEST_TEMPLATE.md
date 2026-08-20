<!-- Keep the description to what a reviewer needs: the behaviour change and how
     you know it works. Delete sections that do not apply. -->

## What this changes

## Why

<!-- The problem, not the patch. If it fixes an issue, link it: Fixes #123 -->

## How it was verified

<!-- The command you ran, the scenario you exercised, or the screenshot. "Tests
     pass" is not verification if the change has no test covering it. -->

## Checklist

- [ ] `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build` all pass locally
- [ ] Commit subjects are conventional and **unscoped** (`fix: …`, not `fix(scope): …`), matching the existing history
- [ ] Pure, chrome-free logic went into `src/shared/` and has a unit test; chrome-API glue is verified some other way and the PR says how
- [ ] No new install-time permission. A new optional permission is requested only at opt-in and released when the feature is turned off
- [ ] Nothing new leaves the browser. If the change makes a network request, the PR explains where to and why
- [ ] Docs updated where behaviour changed — `USAGE.md` for user-facing settings, `PERMISSIONS.md` / `PRIVACY.md` for anything touching permissions or data, both READMEs if the feature table changed

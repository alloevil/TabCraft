# Changelog

All notable changes to TabCraft are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) — while below 1.0.0,
minor bumps may still change behaviour.

Each released version links to its GitHub release, which carries the full notes
and the packaged extension.

## [Unreleased]

### Added

- **Proxy indicator** — an opt-in badge on every page naming the proxy node that
  page's traffic egressed through, read from a Clash/mihomo controller. Chrome
  cannot answer this itself: under TUN/fake-ip setups the system proxy is off and
  the page sees a synthetic `198.18.x.x` address. Injected via
  `chrome.scripting`, so `<all_urls>` stays an _optional_ permission requested
  only at opt-in and released when the feature is switched off.
- Security policy, code of conduct, issue and pull-request templates, scheduled
  dependency updates, and this changelog.
- Release assets are now built from a tag on a clean runner with a SHA-256
  checksum, instead of being uploaded by hand.

### Fixed

- **A stuck Prompt API no longer freezes the extension.** In a service worker
  whose Gemini Nano model isn't provisioned, `LanguageModel.availability()` can
  hang forever. `init()` awaited it and every gated listener and message handler
  awaited `init()`, so smart grouping, auto-grouping and the whole side panel
  stopped responding — not just AI classification. Both Prompt API calls are now
  bounded and fall back to the rule engine.
- **Settings added after a user's last write read as `undefined`** instead of
  their default, because `getSettings()` returned the stored object verbatim.
- Stale documentation: the Tailwind toolchain removed in 0.1.9 was still
  advertised, the version badge read 0.1.3, and the project tree pointed at a
  file that had moved.

### Changed

- CI runs on Node 20 and 22, narrows its token to read-only, cancels superseded
  runs, enforces coverage thresholds, and uploads the built extension so a
  reviewer can load a pull request without building it.
- Manifest description trimmed to 132 characters, the Chrome Web Store maximum
  (it was 133, which would have been rejected at submission).

## [0.1.9] — 2026-06-20

### Added

- Self-improving classification: with **Learn from activity** on, confident
  on-device AI verdicts are saved as domain→category mappings, so the next visit
  is grouped instantly by the rule engine with no AI call. Only confident,
  non-"Other" verdicts are learned; the 500-entry LRU cap and the **Clear**
  button still apply.

## [0.1.8] — 2026-06-20

### Added

- URL path and query now count toward classification, scored with the same
  weighted keyword logic as titles. Path ranks above the page title but below
  explicit domain rules; numeric IDs and tiny tokens are filtered out.

## [0.1.7] — 2026-06-20

### Changed

- Weighted title scoring replaces "first keyword match wins" — every category is
  scored and the strongest wins, with multi-word phrases outweighing single
  ambiguous tokens.
- Many more lifestyle keywords, so fewer tabs land in "Other".
- Sharper AI prompt: classify by content, not platform, with AI&ML vs
  Development disambiguation.

## [0.1.6] — 2026-06-20

### Added

- Chinese UI, switchable from Settings without a reload.
- AI-status badge in the header: **✨ AI** when Gemini Nano is active, **📐 Rules**
  on the rule-engine fallback.

## [0.1.5] — 2026-06-20

### Added

- Clicking the toolbar icon opens the side panel directly.
- Settings shows the learned-mapping count with a one-click **Clear**.

### Fixed

- Data loss: "Snooze group" closed tabs with no way to recover them. Tabs are
  saved before closing.
- Learned mappings are capped at 500 (LRU), and the manual-grouping listener is
  debounced so dragging many tabs no longer spams storage writes.

## [0.1.4] — 2026-06-20

### Fixed

- Batch AI classification shipped in 0.1.3 but was never called, so AI-mode
  Smart Group still made one AI round-trip per tab. Grouping now settles
  confident rule hits first and sends only the uncertain tabs to the AI in a
  single batch call — O(N) → O(1) AI calls.

## [0.1.3] — 2026-06-20

### Added

- Batch AI classification: many tabs classified in a single on-device Gemini Nano
  call, with per-tab fallback.

## [0.1.2] — 2026-06-18

### Added

- Built-in domain rules grew from 57 to 390+, covering many more common sites so
  fewer tabs fell through to "Other".

### Fixed

- Title keywords matched as substrings, so short words misfired — "rain" scored
  as AI, "barcode" as Development. Matching is now whole-word.
- The **Domain-based** grouping mode did nothing when selected; it now really
  groups by domain.
- The header action buttons covered the "TabCraft" title on a narrow side panel.
  Below 360px they collapse to icons.

## [0.1.1] — 2026-06-18

### Added

- The duplicate list shows each tab's full URL with the shared prefix dimmed and
  the differing part highlighted, plus the normalized URL in the group header —
  so it is visible _why_ two tabs were judged duplicates.

### Fixed

- Smart Group silently skipped tabs it could not classify, leaving the tab strip
  full of ungrouped tabs. Unclassified tabs now go into a grey "Other" native
  group, ordered last. The two-tabs-per-group minimum still applies.

## [0.1.0] — 2026-06-16

### Added

- First loadable release, built on Plasmo (MV3): AI smart grouping via Chrome's
  built-in Gemini Nano with a rule-engine fallback, duplicate detection that
  ignores tracking parameters, tab hibernation scheduled through `chrome.alarms`,
  workspaces, the glassmorphism side panel, and the `Ctrl+Shift+G` /
  `Ctrl+Shift+D` shortcuts.

[unreleased]: https://github.com/alloevil/TabCraft/compare/v0.1.9...HEAD
[0.1.9]: https://github.com/alloevil/TabCraft/releases/tag/v0.1.9
[0.1.8]: https://github.com/alloevil/TabCraft/releases/tag/v0.1.8
[0.1.7]: https://github.com/alloevil/TabCraft/releases/tag/v0.1.7
[0.1.6]: https://github.com/alloevil/TabCraft/releases/tag/v0.1.6
[0.1.5]: https://github.com/alloevil/TabCraft/releases/tag/v0.1.5
[0.1.4]: https://github.com/alloevil/TabCraft/releases/tag/v0.1.4
[0.1.3]: https://github.com/alloevil/TabCraft/releases/tag/v0.1.3
[0.1.2]: https://github.com/alloevil/TabCraft/releases/tag/v0.1.2
[0.1.1]: https://github.com/alloevil/TabCraft/releases/tag/v0.1.1
[0.1.0]: https://github.com/alloevil/TabCraft/releases/tag/v0.1.0

# TabCraft Privacy Policy

_Last updated: 2026-07-17_

TabCraft is a Chrome extension that organizes your browser tabs — grouping them
by topic, hibernating inactive ones, and closing duplicates. This policy
explains what data TabCraft touches and, more importantly, what it does not
do with it.

## Summary

**TabCraft does not collect, transmit, or sell any data.** Everything it does
happens locally, inside your browser, on your device. TabCraft has no
backend server, makes no network requests, and does not use any analytics or
tracking SDKs.

## What data TabCraft reads

To group and organize your tabs, TabCraft reads:

- **Tab URLs and titles** — used to classify each tab into a category
  (e.g. "Development", "Shopping") and detect duplicates.
- **Tab activity timestamps** (last accessed time) — used to decide which
  tabs are inactive and eligible for hibernation.
- **Tab group state** (titles, colors) — used to build and restore groups.

## Where that data goes

**Nowhere outside your device.** Specifically:

- **Classification is done on-device.** TabCraft uses Chrome's built-in
  Gemini Nano model (when available on your device) or a local rule-based
  classifier as a fallback. Neither sends tab content to any external
  server — Gemini Nano runs entirely inside Chrome, offline.
- **Storage is local.** All settings, learned domain→category mappings,
  custom rules, snoozed tabs, workspaces, and usage stats are saved with
  `chrome.storage.local`, which stays on your device and is never
  synchronized to any TabCraft-operated server (TabCraft does not operate
  any server).
- **No network requests.** TabCraft's code makes zero outbound HTTP
  requests. You can verify this yourself — the source is open at
  <https://github.com/alloevil/TabCraft>.

## Data retention and control

- All data is stored locally and is deleted automatically when you remove
  the extension.
- You can export or clear your data (rules, learned mappings, stats,
  session snapshots) at any time from the extension's Settings panel.
- Undo history and session snapshots are capped and periodically
  overwritten; they are not kept indefinitely.

## Permissions

See [PERMISSIONS.md](./PERMISSIONS.md) for a plain-language explanation of
why each Chrome permission is requested.

## Changes to this policy

If TabCraft's data practices ever change (for example, adding an optional
cloud-sync feature), this policy will be updated first, and any new data
collection will be off by default and clearly disclosed.

## Contact

Questions about this policy or TabCraft's data handling can be filed as an
issue at <https://github.com/alloevil/TabCraft/issues>.

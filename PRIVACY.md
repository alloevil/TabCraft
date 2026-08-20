# TabCraft Privacy Policy

_Last updated: 2026-07-17_

TabCraft is a Chrome extension that organizes your browser tabs — grouping them
by topic, hibernating inactive ones, and closing duplicates. This policy
explains what data TabCraft touches and, more importantly, what it does not
do with it.

## Summary

**TabCraft does not collect, transmit, or sell any data.** Everything it does
happens locally, inside your browser, on your device. TabCraft has no backend
server, contacts no third-party service, and does not use any analytics or
tracking SDKs. The only feature that touches the network at all — the optional
proxy indicator, off by default — talks solely to a proxy-controller address
you type in yourself, normally on `127.0.0.1`.

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
- **No third-party network requests.** TabCraft has no server of its own and
  contacts no third party. Its only possible outbound request is to the
  Clash/mihomo controller address you configure for the optional proxy
  indicator — typically `http://127.0.0.1:9097`, on your own machine. You can
  verify all of this yourself — the source is open at
  <https://github.com/alloevil/TabCraft>.

## The proxy indicator (optional, off by default)

When you enable **Show proxy on every page**, TabCraft:

- asks Chrome for permission to run on the pages you visit, then draws a small
  pill in one corner naming the proxy node that page's traffic left through;
- learns that fact from your own proxy core's controller API (Clash / mihomo
  `GET /connections`) at the address you configure;
- does the hostname matching **inside the extension**. Your browsing history is
  never uploaded anywhere: TabCraft fetches the connection list and looks up
  the current page locally;
- keeps the controller secret, if you set one, in `chrome.storage.local`
  alongside your other settings — local only, never synced;
- reads no page content. The injected code only writes the pill into the DOM;
  it never touches the page's text, forms, storage, or cookies.

Turning the feature off hands the host permission back to Chrome and removes
the pill from every open tab.

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

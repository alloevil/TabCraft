# TabCraft Permission Justifications

This document explains, in plain language, why TabCraft requests each
permission in its manifest. It's written to be pasted (per-permission) into
the Chrome Web Store developer dashboard's "Permission justification" fields
during submission.

## `tabs`

TabCraft's core features — smart grouping, duplicate detection, and
hibernation — need to read each open tab's URL, title, and activity state,
and to move, group, discard, or close tabs. This permission is required for
every primary feature the extension advertises.

## `tabGroups`

TabCraft creates, renames, colors, and collapses native Chrome tab groups
when it groups tabs by topic, and reads existing groups so it can merge new
tabs into a group a user already created manually. Required for the "Smart
Group" feature.

## `storage`

TabCraft saves user settings, custom domain rules, learned domain→category
mappings, snoozed tabs, workspaces, and usage stats using
`chrome.storage.local`. This is local-only storage — nothing is synced to a
remote server. Required so the extension remembers user configuration and
learned behavior across browser sessions.

## `sidePanel`

TabCraft's UI (tab list, dashboard, settings) lives in Chrome's side panel
rather than a popup, so the tab list stays visible and interactive while the
user keeps browsing. Required to render the extension's UI.

## `contextMenus`

Adds three right-click menu items ("Smart Group All Tabs", "Close
Duplicates", "Hibernate Inactive Tabs") so users can trigger the extension's
core actions without opening the side panel. Purely a UX convenience;
removing it would only remove those three menu items.

## `alarms`

MV3 service workers can be terminated by Chrome at any time, so
`setTimeout`-based scheduling is unreliable for periodic work.
`chrome.alarms` is used instead to reliably run the periodic session
auto-save and the hibernation check every 5 minutes, and to reopen snoozed
tabs at their scheduled wake time, even after the service worker has been
restarted.

## Host permissions

TabCraft requests **no host permissions**. It never injects scripts into
pages, never reads page content/DOM, and never fetches from page origins.
Everything it needs — each tab's URL, title, and favicon — is tab _metadata_
already covered by the `tabs` permission. See [PRIVACY.md](./PRIVACY.md) for
the full data-handling policy.

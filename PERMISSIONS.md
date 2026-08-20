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

## `scripting`

Used by one feature only: the optional per-page proxy indicator. When it is
enabled, TabCraft injects a small badge into the pages you visit naming the
proxy node that page's traffic egressed through. `scripting` by itself grants
no access to any site — the injection also needs a host permission, which is
optional and requested separately (see below). With the indicator off, nothing
is ever injected.

## Host permissions

TabCraft requests **no host permissions at install time**, and none of its
default features need any: each tab's URL, title, and favicon is tab
_metadata_ already covered by `tabs`.

`<all_urls>` is declared as an **optional** host permission, used by the
optional per-page proxy indicator and requested only at the moment you switch
that feature on. Granting it lets TabCraft do exactly two things:

1. draw its badge into the pages you visit (write-only DOM access — the
   injected code never reads page content), and
2. call the Clash/mihomo controller address you configured, normally
   `http://127.0.0.1:9097`.

Switching the indicator back off revokes the permission via
`chrome.permissions.remove`. Declining the prompt leaves the feature off.

See [PRIVACY.md](./PRIVACY.md) for the full data-handling policy.

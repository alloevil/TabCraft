# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it through GitHub's private vulnerability reporting:
[**Report a vulnerability**](https://github.com/alloevil/TabCraft/security/advisories/new).
That opens a private thread visible only to the maintainers.

If that page is unavailable, open a normal issue containing **only the impact**
— no reproduction steps, no payloads — and ask for a private channel. The report
will be moved to a private advisory before any detail is discussed.

Please include, where you can: the affected version (or commit), Chrome version,
whether the proxy indicator was enabled, and what an attacker gains.

Expect an acknowledgement within a week. TabCraft is maintained by volunteers,
so please allow time for a fix before disclosing publicly.

## Supported versions

Only the latest release receives fixes. There are no maintenance branches — if
you are behind, upgrade first and confirm the issue still reproduces.

## What TabCraft touches

Reviewing the attack surface is easier with the design in front of you:

| Surface                                      | What it means                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No backend**                               | There is no TabCraft server, account, telemetry, or analytics SDK. Nothing to breach on our side.                                                                                                                                                                                                                                                   |
| **Tab metadata**                             | URLs, titles, favicons and last-access times are read through the `tabs` permission and classified locally.                                                                                                                                                                                                                                         |
| **`chrome.storage.local`**                   | Settings, custom rules, learned domain→category mappings, snoozed tabs, workspaces and stats. Local, never synced to us.                                                                                                                                                                                                                            |
| **On-device AI**                             | Chrome's built-in Gemini Nano, or a local rule engine. Tab content never leaves the browser.                                                                                                                                                                                                                                                        |
| **Proxy indicator (opt-in, off by default)** | Requests the optional `<all_urls>` host permission when enabled, injects a badge into pages, and calls the Clash/mihomo controller address the user configures — normally `http://127.0.0.1:9097`. The injected code writes into a shadow root and never reads page content. See [PRIVACY.md](./PRIVACY.md) and [PERMISSIONS.md](./PERMISSIONS.md). |

## Out of scope

These are known, documented design properties rather than vulnerabilities:

- **The controller secret is stored unencrypted in `chrome.storage.local`.** Every
  extension setting is. Chrome offers extensions no secret storage, so an
  attacker who can already read another user's extension storage has code
  execution or disk access — a stronger position than the secret grants.
- **The extension trusts the controller address the user typed in.** Pointing it
  at a hostile endpoint is equivalent to pasting a hostile URL anywhere else.
- **An exposed Clash/mihomo controller port.** Binding it to `0.0.0.0`, or
  leaving the `set-your-secret` placeholder that Clash Verge writes by default,
  hands control of the _proxy core_ to anything that can reach the port. That is
  a proxy-core configuration issue, not a TabCraft one — [USAGE.md](./USAGE.md)
  spells out the safe settings.
- Anything requiring an already-compromised OS account, or a physically
  unlocked device.

Reports about the extension requesting a permission it does not need, injecting
where it should not, or sending data anywhere other than the configured
controller **are** in scope and welcome.

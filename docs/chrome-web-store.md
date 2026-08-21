# Chrome Web Store submission

TabCraft is not on the Chrome Web Store, and that is currently its biggest
adoption limit: unpacked loading is the only install path, and recent Chrome
builds increasingly refuse it. On one machine tested during development, Chrome
151 ignored `--load-extension`, reported success from the DevTools
`Extensions.loadUnpacked` call while registering nothing, and left
`chrome://extensions` empty — with developer mode already on and no Chrome policy
file present. A store listing removes that whole class of problem.

This file is the submission kit: what's already prepared, what only a human with
the developer account can do, and the one bug that would have failed validation.

## Fixed here: the description was one character too long

The manifest `description` was **133 characters**. Chrome's limit is
[132](https://developer.chrome.com/docs/extensions/reference/manifest/description)
("A plain text string … no more than 132 characters"), so the upload would have
been rejected. It now reads, at 125 characters:

> AI tab organizer for Chrome — auto-groups by topic, hibernates inactive tabs, removes duplicates. 100% private, on-device AI.

Chrome tolerates the overlong value when loading unpacked, which is why this
survived ten releases unnoticed.

## Already in the repo

| Requirement                   | Where                                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-permission justifications | [PERMISSIONS.md](../PERMISSIONS.md) — written to be pasted field-by-field into the dashboard                                                                  |
| Privacy policy                | [PRIVACY.md](../PRIVACY.md). Link the rendered URL: `https://github.com/alloevil/TabCraft/blob/main/PRIVACY.md`                                               |
| Data-use disclosures          | Nothing is collected or transmitted. Every "do you collect …" box is No. The one network destination is a loopback proxy-controller address the user types in |
| Icon (128×128)                | `public/icons/icon-128.png`, already in the packaged zip                                                                                                      |
| Packaged upload               | `chrome-mv3-prod.zip`, built and checksummed by the release workflow on a `v*` tag                                                                            |

## Only a person with the developer account can do these

1. **Register** at the [developer dashboard](https://chrome.google.com/webstore/devconsole)
   and pay the one-time registration fee.
2. **Produce the mandatory images.** Per Chrome's
   [image requirements](https://developer.chrome.com/docs/webstore/images), the
   icon, **one 440×280 small promotional tile**, and **at least one screenshot**
   are mandatory. Screenshots must be **1280×800** or **640×400** — 1280×800 is
   preferred, since everything is downscaled to 640×400 anyway.
3. **Upload and submit for review.** Review can take days; a rejection usually
   cites a permission whose justification the reviewer found unconvincing, which
   is what PERMISSIONS.md exists to prevent.

Suggested screenshots, in the order that explains the product fastest: the side
panel after a Smart Group run; the duplicate view with its highlighted URL
diffs; Settings; and the proxy-indicator pill on a real page.

## Listing copy

**Category:** Productivity · **Language:** English (with a 中文 listing later —
the UI is bilingual)

**Short description** (the manifest description, 132 max):

> AI tab organizer for Chrome — auto-groups by topic, hibernates inactive tabs, removes duplicates. 100% private, on-device AI.

**Single purpose** (a policy requirement — one sentence, one purpose):

> Organize the user's open browser tabs: group them by topic, close duplicates,
> and suspend inactive ones.

**Detailed description** — adapt from the README's feature table. Two points
worth leading with, because they are what differentiates the extension and both
are verifiable from source:

- Classification reads the page title and URL path, not just the domain, so a
  localhost page titled "Investment Dashboard" lands in Investment rather than
  Dev.
- Everything runs on-device. There is no account, no server, and no analytics —
  the extension ships with **no host permissions at all**; the only broad
  permission is optional and requested at opt-in for the proxy indicator.

## Before you submit

- [ ] `npm run build` and confirm `build/chrome-mv3-prod/manifest.json` has the
      version you intend to publish
- [ ] Tag the release (`v0.2.0`) so the workflow builds the zip — it refuses to
      publish when the tag disagrees with `package.json`
- [ ] Upload that exact zip, not a locally built one
- [ ] Paste each justification from PERMISSIONS.md, including `scripting` and the
      optional `<all_urls>`
- [ ] Set the privacy policy URL and answer the data-use questions
- [ ] Update both READMEs to drop the "not yet published" note and link the
      listing

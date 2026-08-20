// TabCraft — the in-page proxy badge.
//
// Injected with chrome.scripting.executeScript({ func }) rather than shipped as
// a declared content script, on purpose: a manifest `content_scripts` entry
// matching <all_urls> makes Chrome demand "read and change all your data on all
// websites" at install time from every user, including everyone who never turns
// this feature on. Dynamic injection keeps the install-time permission set
// exactly as it was — the host permission is an optional one, requested only
// when the user enables the badge (see optional_host_permissions/PERMISSIONS.md).
//
// Injected functions are serialized to source and re-parsed inside the page, so
// renderBadge/removeBadge below must be entirely self-contained: no imports, no
// module-scope constants, no helper calls. Type-only references are fine (they
// erase at compile time).

import { describeApiState, describeVerdict, type ProxyTone } from '../shared/proxy';
import type { ProxyBadgePosition, Settings } from '../shared/types';
import { ProxyMonitor, type ProxyLookup } from './proxy-monitor';
import { Storage } from './storage';

export interface ProxyBadgePayload {
  /** Pill text — a node name, or a status phrase when there's nothing to name. */
  text: string;
  /** Hover detail, one fact per line. */
  detail: string[];
  tone: ProxyTone;
  position: ProxyBadgePosition;
  /** True when the route was borrowed from a related host rather than measured
   *  for this one; rendered as a hollow dot so it reads as an inference. */
  inferred: boolean;
}

/** Localize a lookup into everything the page needs to draw itself. */
export function buildBadgePayload(lookup: ProxyLookup, settings: Settings): ProxyBadgePayload {
  const description =
    lookup.state === 'ok'
      ? describeVerdict(lookup.verdict, settings.language)
      : describeApiState(lookup.state, settings.language);
  return {
    text: description.text,
    detail: description.detail,
    tone: description.tone,
    position: settings.proxyBadgePosition,
    inferred: lookup.verdict.kind !== 'unknown' && lookup.verdict.match !== 'exact',
  };
}

/** Draw or update the badge. Runs in the page (ISOLATED world) — see the file
 *  header for why it may not reference anything outside its own body. */
function renderBadge(payload: ProxyBadgePayload): void {
  const HOST_ID = 'tabcraft-proxy-badge';
  const TONE_COLOR: Record<string, string> = {
    proxy: '#60a5fa',
    direct: '#34d399',
    block: '#f87171',
    idle: '#9ca3af',
  };
  const vertical = payload.position.startsWith('top') ? 'top' : 'bottom';
  const horizontal = payload.position.endsWith('left') ? 'left' : 'right';

  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .wrap {
          display: flex; flex-direction: column; align-items: var(--align);
          font: 11px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        }
        .pill {
          display: inline-flex; align-items: center; gap: 5px; max-width: 260px;
          padding: 3px 9px; border-radius: 999px; cursor: default;
          background: rgba(17, 17, 20, 0.82); color: #f3f4f6;
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.28);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          opacity: 0.55; transition: opacity 0.15s ease;
        }
        .wrap:hover .pill { opacity: 1; }
        .dot { width: 6px; height: 6px; border-radius: 50%; flex: 0 0 auto; }
        .dot.solid { background: var(--tone); }
        .dot.hollow { border: 1px solid var(--tone); }
        .text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .detail {
          display: none; margin: 4px 0; padding: 6px 9px; max-width: 320px;
          border-radius: 8px; background: rgba(17, 17, 20, 0.94); color: #d1d5db;
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.36);
          white-space: pre-wrap; word-break: break-all;
        }
        .wrap:hover .detail.filled { display: block; }
      </style>
      <div class="wrap">
        <div class="detail"></div>
        <div class="pill"><span class="dot"></span><span class="text"></span></div>
      </div>
    `;
    // Dismiss for this page load only — no storage written, no state to leak.
    shadow.querySelector('.pill')?.addEventListener('click', () => host?.remove());
    document.documentElement.appendChild(host);

    // The controller only lists *live* connections, and the document request
    // may not have reached it (or may already have closed) at injection time.
    // Two short follow-ups plus a hover refresh converge on the real answer
    // without the service worker having to track per-tab timers.
    const poll = () => {
      try {
        chrome.runtime
          .sendMessage({ action: 'proxyForHost', host: location.hostname })
          .then((next) => {
            if (next) renderBadge(next as ProxyBadgePayload);
          })
          .catch(() => {});
      } catch {
        // Extension context invalidated (reload/update) — nothing to do.
      }
    };
    setTimeout(poll, 900);
    setTimeout(poll, 2600);
    host.shadowRoot?.querySelector('.wrap')?.addEventListener('mouseenter', poll);
  }

  host.style.cssText =
    `position: fixed !important; ${vertical}: 12px !important; ${horizontal}: 12px !important;` +
    'z-index: 2147483000 !important; width: auto !important; height: auto !important;' +
    'margin: 0 !important; padding: 0 !important; pointer-events: auto !important;';

  const shadow = host.shadowRoot;
  if (!shadow) return;
  const wrap = shadow.querySelector('.wrap') as HTMLElement | null;
  const dot = shadow.querySelector('.dot');
  const text = shadow.querySelector('.text');
  const detail = shadow.querySelector('.detail');
  if (!wrap || !dot || !text || !detail) return;

  wrap.style.setProperty('--tone', TONE_COLOR[payload.tone] ?? TONE_COLOR.idle);
  wrap.style.setProperty('--align', horizontal === 'left' ? 'flex-start' : 'flex-end');
  // Detail sits above the pill when docked at the bottom, below it when at the
  // top, so it always expands away from the viewport edge.
  wrap.style.flexDirection = vertical === 'top' ? 'column-reverse' : 'column';
  dot.className = `dot ${payload.inferred ? 'hollow' : 'solid'}`;
  text.textContent = payload.text;
  detail.textContent = payload.detail.join('\n');
  detail.className = payload.detail.length ? 'detail filled' : 'detail';
}

/** Remove the badge. Runs in the page — same self-containment rule as above. */
function removeBadge(): void {
  document.getElementById('tabcraft-proxy-badge')?.remove();
}

/** Pages the badge can't or shouldn't reach: chrome://, the Web Store,
 *  extension pages, view-source, and file:// (a separate permission Chrome
 *  only grants from the extensions page). */
function isInjectable(url: string | undefined): boolean {
  return !!url && /^https?:\/\//i.test(url) && !/^https:\/\/chromewebstore\.google\.com/i.test(url);
}

export const ProxyBadge = {
  /** Build the payload the page should show for `host`, or null when the
   *  feature is off. */
  async payloadFor(host: string): Promise<ProxyBadgePayload | null> {
    const settings = await Storage.getSettings();
    if (!settings.showProxyBadge) return null;
    return buildBadgePayload(await ProxyMonitor.lookup(host), settings);
  },

  /** Inject (or refresh) the badge on one tab. No-op for pages the extension
   *  can't script or when the user hasn't granted the optional host permission
   *  — executeScript rejects in that case and there's nothing to recover. */
  async showOn(tab: chrome.tabs.Tab): Promise<void> {
    if (tab.id == null || !isInjectable(tab.url)) return;
    let host: string;
    try {
      host = new URL(tab.url as string).hostname;
    } catch {
      return;
    }
    const payload = await this.payloadFor(host);
    if (!payload) return;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'ISOLATED',
        func: renderBadge,
        args: [payload],
      });
    } catch (err) {
      console.debug('[TabCraft] proxy badge injection skipped:', err);
    }
  },

  /** Push the badge to every open tab (used when the user switches it on, so
   *  existing tabs don't have to be reloaded), or clear it from every tab. */
  async sweep(enabled: boolean): Promise<void> {
    const tabs = await chrome.tabs.query({});
    await Promise.all(
      tabs.map(async (tab) => {
        if (tab.id == null || !isInjectable(tab.url)) return;
        if (enabled) return this.showOn(tab);
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: 'ISOLATED',
            func: removeBadge,
          });
        } catch {
          // Tab closed, discarded, or never had a badge — nothing to remove.
        }
      })
    );
  },
};

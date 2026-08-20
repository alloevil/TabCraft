// TabCraft — Clash/mihomo controller client.
//
// Owns the network side of proxy attribution: one TTL-throttled GET of the
// controller's live connection table, folded into a host→route memo that
// outlives the connections themselves (see shared/proxy.ts mergeRoutes for
// why). Everything host-matching related is pure and lives in shared/proxy.ts.
//
// MV3 note: the memo is mirrored into chrome.storage.session so a service
// worker restart doesn't blank every open tab's badge — session storage is
// in-memory, cleared on browser exit, and never touches disk.

import {
  mergeRoutes,
  normalizeControllerUrl,
  resolveRoute,
  toHostRoutes,
  verdictFor,
  type HostRoute,
  type ProxyApiState,
  type ProxyVerdict,
} from '../shared/proxy';
import {
  PROXY_CONNECTIONS_TTL_MS,
  PROXY_FETCH_TIMEOUT_MS,
  PROXY_HOST_MEMO_MAX,
  PROXY_ROUTES_SESSION_KEY,
} from '../shared/constants';
import { Storage } from './storage';

export interface ProxyLookup {
  state: ProxyApiState;
  verdict: ProxyVerdict;
}

/** Host→route memo. Null until hydrated from session storage. */
let memo: Map<string, HostRoute> | null = null;
let lastState: ProxyApiState = 'unconfigured';
let lastFetchAt = 0;
/** In-flight refresh, shared by concurrent lookups so a burst of tabs
 *  finishing at once produces one controller request, not one per tab. */
let inflight: Promise<void> | null = null;

async function hydrate(): Promise<Map<string, HostRoute>> {
  if (memo) return memo;
  memo = new Map();
  try {
    const stored = await chrome.storage.session.get(PROXY_ROUTES_SESSION_KEY);
    for (const route of (stored?.[PROXY_ROUTES_SESSION_KEY] ?? []) as HostRoute[]) {
      memo.set(route.host, route);
    }
  } catch {
    // session storage unavailable (or the worker is starting up) — an empty
    // memo just means the next controller fetch repopulates it.
  }
  return memo;
}

/** Ask the controller for its connection table, at most once per TTL window.
 *  Never throws: every failure mode collapses into `lastState`, which the badge
 *  reports verbatim instead of guessing a route. */
async function refresh(): Promise<void> {
  const settings = await Storage.getSettings();
  const base = normalizeControllerUrl(settings.proxyApiUrl);
  if (!base) {
    lastState = 'unconfigured';
    return;
  }
  if (Date.now() - lastFetchAt < PROXY_CONNECTIONS_TTL_MS) return;
  if (inflight) return inflight;

  inflight = (async () => {
    lastFetchAt = Date.now();
    try {
      const res = await fetch(`${base}/connections`, {
        headers: settings.proxyApiSecret
          ? { Authorization: `Bearer ${settings.proxyApiSecret}` }
          : {},
        signal: AbortSignal.timeout(PROXY_FETCH_TIMEOUT_MS),
      });
      if (res.status === 401 || res.status === 403) {
        lastState = 'unauthorized';
        return;
      }
      if (!res.ok) {
        lastState = 'unreachable';
        return;
      }
      const body = (await res.json()) as { connections?: unknown };
      const routes = toHostRoutes(
        Array.isArray(body.connections) ? body.connections : [],
        Date.now()
      );
      const store = await hydrate();
      mergeRoutes(store, routes, PROXY_HOST_MEMO_MAX);
      lastState = 'ok';
      if (routes.length) {
        await chrome.storage.session
          .set({ [PROXY_ROUTES_SESSION_KEY]: [...store.values()] })
          .catch(() => {});
      }
    } catch {
      lastState = 'unreachable';
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export const ProxyMonitor = {
  /** Which proxy `host` last egressed through, plus the controller's own
   *  reachability so the caller can tell "direct" from "we can't tell". */
  async lookup(host: string): Promise<ProxyLookup> {
    const store = await hydrate();
    await refresh();
    return { state: lastState, verdict: verdictFor(resolveRoute(store, host)) };
  },

  /** One-shot reachability check for the settings view's Test button. */
  async probe(): Promise<{ state: ProxyApiState; version?: string }> {
    const settings = await Storage.getSettings();
    const base = normalizeControllerUrl(settings.proxyApiUrl);
    if (!base) {
      lastState = 'unconfigured';
      return { state: 'unconfigured' };
    }
    try {
      const res = await fetch(`${base}/version`, {
        headers: settings.proxyApiSecret
          ? { Authorization: `Bearer ${settings.proxyApiSecret}` }
          : {},
        signal: AbortSignal.timeout(PROXY_FETCH_TIMEOUT_MS),
      });
      if (res.status === 401 || res.status === 403) {
        lastState = 'unauthorized';
        return { state: 'unauthorized' };
      }
      if (!res.ok) {
        lastState = 'unreachable';
        return { state: 'unreachable' };
      }
      const body = (await res.json()) as { version?: string };
      lastState = 'ok';
      return { state: 'ok', version: body.version };
    } catch {
      lastState = 'unreachable';
      return { state: 'unreachable' };
    }
  },

  /** Drop everything learned so far — called when the controller address or
   *  secret changes, since routes observed through the old one may not
   *  describe how traffic flows through the new one. */
  async reset(): Promise<void> {
    memo = null;
    lastFetchAt = 0;
    lastState = 'unconfigured';
    await chrome.storage.session.remove(PROXY_ROUTES_SESSION_KEY).catch(() => {});
  },
};

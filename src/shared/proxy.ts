// TabCraft — Proxy attribution.
//
// Turns a Clash/mihomo controller's live connection list into a per-host answer
// to "which proxy did this page actually egress through?". Pure, chrome-free
// and network-free: background/proxy-monitor.ts owns the fetching and caching,
// this module owns the host matching, the verdict, and the wording.
//
// Why a controller API at all: under TUN / fake-ip setups (Clash Verge,
// sing-box) Chrome itself is not proxy-aware — chrome.proxy.settings reports
// "system" with no proxy configured while a local core silently routes every
// packet, and the peer address the page sees is a synthetic 198.18.x.x fake IP.
// The core's own connection table is the only source that knows the real
// outbound node.

import { getDomain } from 'tldts';
import { translate, type Locale, type MessageKey } from './i18n';

/** One live connection from `GET /connections` → `.connections[]`. Only the
 *  fields TabCraft reads are declared; the real objects also carry byte
 *  counters, process paths and GeoIP data we deliberately ignore. */
export interface ProxyConnection {
  metadata?: {
    host?: string;
    sniffHost?: string;
  };
  /** Outbound chain, innermost first: index 0 is the node that egressed the
   *  traffic, the last element is the outermost policy group the rule picked. */
  chains?: string[];
  rule?: string;
  rulePayload?: string;
  /** RFC3339 connection start time. */
  start?: string;
}

/** How one host's traffic was routed, as last observed. */
export interface HostRoute {
  host: string;
  chains: string[];
  rule: string;
  rulePayload: string;
  /** ms epoch — the connection's start time, or observation time if unparseable. */
  seenAt: number;
}

/** Whether the route we found was recorded for the host itself or borrowed
 *  from a related host. Surfaced in the UI so a borrowed answer never
 *  masquerades as a measured one. */
export type RouteMatch = 'exact' | 'parent' | 'sibling';

export interface ResolvedRoute {
  route: HostRoute;
  match: RouteMatch;
}

/** Reachability of the controller API itself, independent of any one host. */
export type ProxyApiState = 'unconfigured' | 'ok' | 'unreachable' | 'unauthorized';

export type ProxyVerdict =
  | {
      kind: 'proxied';
      host: string;
      match: RouteMatch;
      /** The node that egressed the traffic (chains[0]). */
      node: string;
      /** Policy groups the rule traversed, outermost first. */
      groups: string[];
      rule: string;
      seenAt: number;
    }
  | { kind: 'direct'; host: string; match: RouteMatch; rule: string; seenAt: number }
  | { kind: 'blocked'; host: string; match: RouteMatch; rule: string; seenAt: number }
  | { kind: 'unknown' };

/** Reserved chain entries mihomo uses for non-proxy outcomes. */
const DIRECT_OUTBOUND = 'DIRECT';
const REJECT_PREFIX = 'REJECT';

/** Grapheme budget for the pill's node name; the full chain is always in the
 *  hover detail, so clipping here only ever costs a glance, not information. */
const NODE_LABEL_MAX = 18;

/** Accept what users actually paste into the settings field — `127.0.0.1:9097`,
 *  `http://127.0.0.1:9097/`, or a full URL — and return a scheme-qualified
 *  origin with no trailing slash. Returns null for input that can't be a
 *  controller address, so callers can report 'unconfigured' instead of firing
 *  a doomed fetch. */
export function normalizeControllerUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname) return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/** Collapse a controller payload into one newest-wins route per host. */
export function toHostRoutes(connections: readonly ProxyConnection[], now: number): HostRoute[] {
  const byHost = new Map<string, HostRoute>();
  for (const conn of connections) {
    const host = (conn.metadata?.host || conn.metadata?.sniffHost || '').toLowerCase();
    const chains = conn.chains;
    if (!host || !chains?.length) continue;
    const parsed = conn.start ? Date.parse(conn.start) : NaN;
    const route: HostRoute = {
      host,
      chains: [...chains],
      rule: conn.rule ?? '',
      rulePayload: conn.rulePayload ?? '',
      seenAt: Number.isNaN(parsed) ? now : parsed,
    };
    const existing = byHost.get(host);
    if (!existing || route.seenAt >= existing.seenAt) byHost.set(host, route);
  }
  return [...byHost.values()];
}

/** Fold fresh routes into the memo, keeping the newest per host and evicting
 *  the oldest entries past `cap`. Mutates and returns `memo`.
 *
 *  The memo exists because closed connections vanish from the controller's
 *  table: a page whose document request finished seconds ago would otherwise
 *  report "no route" forever. */
export function mergeRoutes(
  memo: Map<string, HostRoute>,
  routes: readonly HostRoute[],
  cap: number
): Map<string, HostRoute> {
  for (const route of routes) {
    const existing = memo.get(route.host);
    if (!existing || route.seenAt >= existing.seenAt) memo.set(route.host, route);
  }
  if (memo.size > cap) {
    const oldestFirst = [...memo.values()].sort((a, b) => a.seenAt - b.seenAt);
    for (const route of oldestFirst.slice(0, memo.size - cap)) memo.delete(route.host);
  }
  return memo;
}

/** Find the best route for `host`: its own, else a parent domain's, else the
 *  newest sibling under the same registrable domain. Subresource hosts keep
 *  connections open far longer than the document request, so the sibling tier
 *  is what keeps a badge populated on a page that finished loading. */
export function resolveRoute(
  memo: ReadonlyMap<string, HostRoute>,
  host: string
): ResolvedRoute | null {
  const target = host.trim().toLowerCase().replace(/\.$/, '');
  if (!target) return null;

  const direct = memo.get(target) ?? memo.get(target.replace(/^www\./, ''));
  if (direct) return { route: direct, match: 'exact' };

  const registrable = getDomain(target);
  let cursor = target;
  for (;;) {
    const dot = cursor.indexOf('.');
    if (dot < 0) break;
    const parent = cursor.slice(dot + 1);
    // Never walk up into a bare TLD (or a public suffix like co.uk): a route
    // recorded there would belong to an unrelated site.
    if (!parent.includes('.')) break;
    const hit = memo.get(parent);
    if (hit) return { route: hit, match: 'parent' };
    if (registrable && parent === registrable) break;
    cursor = parent;
  }

  if (!registrable) return null;
  let newest: HostRoute | null = null;
  for (const route of memo.values()) {
    if (getDomain(route.host) !== registrable) continue;
    if (!newest || route.seenAt > newest.seenAt) newest = route;
  }
  return newest ? { route: newest, match: 'sibling' } : null;
}

/** Classify a resolved route into the outcome the badge reports. */
export function verdictFor(resolved: ResolvedRoute | null): ProxyVerdict {
  if (!resolved) return { kind: 'unknown' };
  const { route, match } = resolved;
  const rule = route.rulePayload ? `${route.rule}(${route.rulePayload})` : route.rule;
  const base = { host: route.host, match, rule, seenAt: route.seenAt };
  const outbound = route.chains[0] ?? '';

  if (outbound === DIRECT_OUTBOUND) return { kind: 'direct', ...base };
  if (outbound.startsWith(REJECT_PREFIX)) return { kind: 'blocked', ...base };
  return {
    kind: 'proxied',
    ...base,
    node: outbound,
    // chains is innermost-first; groups read better outermost-first, matching
    // the order the request traversed them.
    groups: route.chains.slice(1).reverse(),
  };
}

/** Pill-sized node name: drop the trailing protocol/line parenthetical that
 *  most subscriptions append (`…-全网优化(M)`), then clip by grapheme so a
 *  trailing flag emoji or CJK glyph is never sliced in half (regional-
 *  indicator flags are two code points each). The full name stays available
 *  in the hover detail. */
export function shortNodeName(node: string): string {
  const trimmed = node.replace(/\s*[([【][^)\]】]*[)\]】]\s*$/u, '').trim() || node.trim();
  const graphemes =
    typeof Intl !== 'undefined' && 'Segmenter' in Intl
      ? [...new Intl.Segmenter().segment(trimmed)].map((s) => s.segment)
      : [...trimmed];
  return graphemes.length <= NODE_LABEL_MAX
    ? trimmed
    : `${graphemes.slice(0, NODE_LABEL_MAX).join('')}…`;
}

export type ProxyTone = 'proxy' | 'direct' | 'block' | 'idle';

export interface ProxyDescription {
  /** Pill text — a node name or a short status phrase. */
  text: string;
  /** Hover detail, one fact per line. */
  detail: string[];
  tone: ProxyTone;
}

/** Message key per non-answering controller state. */
const API_STATE_MESSAGE: Record<Exclude<ProxyApiState, 'ok'>, MessageKey> = {
  unconfigured: 'proxyUnconfigured',
  unreachable: 'proxyUnreachable',
  unauthorized: 'proxyUnauthorized',
};

/** Wording for a controller that isn't answering. Kept separate from the
 *  per-host verdict so "we don't know yet" never looks like "direct". */
export function describeApiState(
  state: Exclude<ProxyApiState, 'ok'>,
  locale: Locale
): ProxyDescription {
  return { text: translate(locale, API_STATE_MESSAGE[state]), detail: [], tone: 'idle' };
}

/** Render a verdict into pill text plus hover detail. */
export function describeVerdict(verdict: ProxyVerdict, locale: Locale): ProxyDescription {
  if (verdict.kind === 'unknown') {
    return { text: translate(locale, 'proxyUnknown'), detail: [], tone: 'idle' };
  }

  const detail: string[] = [verdict.host];
  if (verdict.kind === 'proxied') {
    detail.push(verdict.node);
    if (verdict.groups.length) {
      detail.push(translate(locale, 'proxyVia', { groups: verdict.groups.join(' → ') }));
    }
  }
  if (verdict.rule) detail.push(translate(locale, 'proxyRule', { rule: verdict.rule }));
  if (verdict.match !== 'exact') {
    detail.push(translate(locale, 'proxyInferred', { host: verdict.host }));
  }

  if (verdict.kind === 'direct') {
    return { text: translate(locale, 'proxyDirect'), detail, tone: 'direct' };
  }
  if (verdict.kind === 'blocked') {
    return { text: translate(locale, 'proxyBlocked'), detail, tone: 'block' };
  }
  return { text: shortNodeName(verdict.node), detail, tone: 'proxy' };
}

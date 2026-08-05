// TabCraft — Duplicate Tab Detection
// Smart URL matching that ignores tracking parameters

import { TRACKING_PARAMS } from './constants';

/** Normalize a URL for duplicate comparison. This is the single source of
 *  truth for "are these two tabs the same page" — background auto-close,
 *  the Dedup view, and Quick Actions all import this instead of keeping
 *  their own (previously divergent) copies, so a URL only counts as a
 *  duplicate consistently everywhere. */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);

    // Remove tracking params
    for (const param of TRACKING_PARAMS) {
      u.searchParams.delete(param);
    }

    // Ignore the www. subdomain — https://www.x.com and https://x.com are
    // the same page for duplicate-detection purposes.
    u.hostname = u.hostname.replace(/^www\./, '');

    // Remove trailing slash from pathname
    const pathname = u.pathname.replace(/\/$/, '') || '/';

    // Remove fragment
    let normalized = u.origin + pathname + u.search;

    // Special handling for Google search — normalize query param
    if (u.hostname.includes('google.') && u.searchParams.has('q')) {
      const q = u.searchParams.get('q');
      normalized = `${u.origin}${pathname}?q=${encodeURIComponent(q!)}`;
    }

    return normalized;
  } catch {
    return url;
  }
}

/** Find duplicate groups from a list of tabs. Generic so it works on raw
 *  chrome.tabs.Tab as well as any wrapper carrying `url`/`lastAccessed` —
 *  this is the single grouping implementation shared by the background
 *  auto-close scan, TabManager.findDuplicates, and the Dedup view. Tabs
 *  without a URL and chrome:// pages never count as duplicates. Groups come
 *  back largest-first; tabs within a group most-recently-used first. */
export function findDuplicateGroups<T extends { url?: string; lastAccessed?: number }>(
  tabs: T[]
): Array<{ normalizedUrl: string; tabs: T[] }> {
  const groups = new Map<string, T[]>();

  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith('chrome://')) continue;
    const normalized = normalizeUrl(tab.url);
    const existing = groups.get(normalized) || [];
    existing.push(tab);
    groups.set(normalized, existing);
  }

  return Array.from(groups.entries())
    .filter(([, tabs]) => tabs.length > 1)
    .map(([normalizedUrl, tabs]) => ({
      normalizedUrl,
      tabs: tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0)),
    }))
    .sort((a, b) => b.tabs.length - a.tabs.length);
}

/** The tab to KEEP from a duplicate group: the currently active one if any,
 *  else the most recently accessed. Shared by auto-close, closeDuplicates,
 *  and the Dedup view's auto-selection so "which tab survives" is one rule. */
export function getBestTab<T extends { active?: boolean; lastAccessed?: number }>(tabs: T[]): T {
  const active = tabs.find((t) => t.active);
  if (active) return active;
  return tabs.reduce((best, current) =>
    (current.lastAccessed || 0) > (best.lastAccessed || 0) ? current : best
  );
}

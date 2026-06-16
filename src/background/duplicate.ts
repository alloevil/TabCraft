// TabCraft — Duplicate Tab Detection
// Smart URL matching that ignores tracking parameters

import { TRACKING_PARAMS } from '../shared/constants';

/** Normalize a URL for duplicate comparison */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);

    // Remove tracking params
    for (const param of TRACKING_PARAMS) {
      u.searchParams.delete(param);
    }

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

/** Check if two URLs are duplicates */
export function areDuplicates(url1: string, url2: string): boolean {
  // Exact match
  if (url1 === url2) return true;

  // Normalized match
  return normalizeUrl(url1) === normalizeUrl(url2);
}

/** Find duplicate groups from a list of tabs */
export function findDuplicateGroups(
  tabs: Array<{ id: number; url: string; title: string; lastAccessed?: number }>
): Array<{ normalizedUrl: string; tabs: typeof tabs }> {
  const groups = new Map<string, typeof tabs>();

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
    }));
}

/** Get the "best" tab to keep from a duplicate group (most recently active) */
export function getBestTab(
  tabs: Array<{ id: number; lastAccessed?: number }>
): typeof tabs[0] {
  return tabs.reduce((best, current) =>
    (current.lastAccessed || 0) > (best.lastAccessed || 0) ? current : best
  );
}

/** Count total duplicates (excluding the one to keep) */
export function countDuplicates(
  tabs: Array<{ id: number; url: string }>
): number {
  const groups = findDuplicateGroups(tabs as any);
  return groups.reduce((sum, group) => sum + group.tabs.length - 1, 0);
}

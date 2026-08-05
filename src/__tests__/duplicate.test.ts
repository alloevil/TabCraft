// TabCraft — duplicate.ts tests: the shared duplicate-grouping and
// keep-selection helpers used by the background auto-close scan,
// TabManager.findDuplicates/closeDuplicates, and the Dedup view.
import { describe, it, expect } from 'vitest';
import { findDuplicateGroups, getBestTab } from '../shared/duplicate';

interface FakeTab {
  id: number;
  url?: string;
  active?: boolean;
  lastAccessed?: number;
}

describe('findDuplicateGroups', () => {
  it('groups tabs whose URLs normalize to the same page', () => {
    const tabs: FakeTab[] = [
      { id: 1, url: 'https://www.example.com/page?utm_source=x' },
      { id: 2, url: 'https://example.com/page/' },
      { id: 3, url: 'https://example.com/other' },
    ];
    const groups = findDuplicateGroups(tabs);
    expect(groups).toHaveLength(1);
    expect(groups[0].tabs.map((t) => t.id).sort()).toEqual([1, 2]);
  });

  it('never counts chrome:// pages or url-less tabs as duplicates', () => {
    const tabs: FakeTab[] = [
      { id: 1, url: 'chrome://newtab' },
      { id: 2, url: 'chrome://newtab' },
      { id: 3 },
      { id: 4 },
    ];
    expect(findDuplicateGroups(tabs)).toEqual([]);
  });

  it('sorts tabs within a group most-recently-used first', () => {
    const tabs: FakeTab[] = [
      { id: 1, url: 'https://a.com', lastAccessed: 100 },
      { id: 2, url: 'https://a.com', lastAccessed: 300 },
      { id: 3, url: 'https://a.com', lastAccessed: 200 },
    ];
    expect(findDuplicateGroups(tabs)[0].tabs.map((t) => t.id)).toEqual([2, 3, 1]);
  });

  it('sorts groups largest-first', () => {
    const tabs: FakeTab[] = [
      { id: 1, url: 'https://a.com' },
      { id: 2, url: 'https://a.com' },
      { id: 3, url: 'https://b.com' },
      { id: 4, url: 'https://b.com' },
      { id: 5, url: 'https://b.com' },
    ];
    const groups = findDuplicateGroups(tabs);
    expect(groups.map((g) => g.tabs.length)).toEqual([3, 2]);
  });

  it('returns nothing when every URL is unique', () => {
    const tabs: FakeTab[] = [
      { id: 1, url: 'https://a.com' },
      { id: 2, url: 'https://b.com' },
    ];
    expect(findDuplicateGroups(tabs)).toEqual([]);
  });
});

describe('getBestTab', () => {
  it('prefers the active tab even when another is more recent', () => {
    const tabs: FakeTab[] = [
      { id: 1, lastAccessed: 900 },
      { id: 2, active: true, lastAccessed: 100 },
    ];
    expect(getBestTab(tabs).id).toBe(2);
  });

  it('falls back to the most recently accessed tab', () => {
    const tabs: FakeTab[] = [
      { id: 1, lastAccessed: 100 },
      { id: 2, lastAccessed: 300 },
      { id: 3, lastAccessed: 200 },
    ];
    expect(getBestTab(tabs).id).toBe(2);
  });

  it('returns the first tab when nothing distinguishes them', () => {
    const tabs: FakeTab[] = [{ id: 7 }, { id: 8 }];
    expect(getBestTab(tabs).id).toBe(7);
  });
});

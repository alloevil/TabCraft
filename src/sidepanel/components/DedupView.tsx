// TabCraft — Cross-Window Duplicate Detection & Merge

import React, { useState, useEffect } from 'react';
import { normalizeUrl } from '../../background/duplicate';

interface DuplicateGroup {
  normalizedUrl: string;
  displayUrl: string;
  tabs: Array<{
    tab: chrome.tabs.Tab;
    windowId: number;
    windowTitle: string;
  }>;
}

export function DedupView({ onRefresh }: { onRefresh: () => void }) {
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [selected, setSelected] = useState<Map<string, number>>(new Map()); // normalizedUrl -> tabId to keep
  const [scanning, setScanning] = useState(false);
  const [totalTabs, setTotalTabs] = useState(0);
  const [totalWindows, setTotalWindows] = useState(0);

  useEffect(() => {
    scanDuplicates();
  }, []);

  async function scanDuplicates() {
    setScanning(true);
    setSelected(new Map());

    // Get all windows
    const windows = await chrome.windows.getAll({ populate: true });
    setTotalWindows(windows.length);

    // Collect all tabs across windows
    const allTabs: Array<{
      tab: chrome.tabs.Tab;
      windowId: number;
      windowTitle: string;
    }> = [];

    for (const win of windows) {
      const winTitle = `Window ${win.id}`;
      if (win.tabs) {
        for (const tab of win.tabs) {
          allTabs.push({ tab, windowId: win.id!, windowTitle: winTitle });
        }
      }
    }

    setTotalTabs(allTabs.length);

    // Group by normalized URL
    const urlMap = new Map<string, typeof allTabs>();
    for (const entry of allTabs) {
      if (!entry.tab.url) continue;
      const normalized = normalizeUrl(entry.tab.url);
      if (!urlMap.has(normalized)) urlMap.set(normalized, []);
      urlMap.get(normalized)!.push(entry);
    }

    // Filter to only duplicates (same URL in different windows OR same window)
    const dupes: DuplicateGroup[] = [];
    for (const [normalized, entries] of urlMap) {
      // Must have 2+ tabs with same URL
      if (entries.length < 2) continue;

      // Check if they're in different windows or same window
      const windowIds = new Set(entries.map(e => e.windowId));
      // Include both: cross-window duplicates AND same-window duplicates
      dupes.push({
        normalizedUrl: normalized,
        displayUrl: entries[0].tab.url || normalized,
        tabs: entries,
      });
    }

    // Sort by number of duplicates (most duplicates first)
    dupes.sort((a, b) => b.tabs.length - a.tabs.length);

    setDuplicates(dupes);

    // Auto-select: keep the active tab or the most recently accessed
    const autoSelect = new Map<string, number>();
    for (const group of dupes) {
      const activeTab = group.tabs.find(t => t.tab.active);
      const keepTab = activeTab || group.tabs.reduce((best, curr) =>
        (curr.tab.lastAccessed || 0) > (best.tab.lastAccessed || 0) ? curr : best
      );
      autoSelect.set(group.normalizedUrl, keepTab.tab.id!);
    }
    setSelected(autoSelect);

    setScanning(false);
  }

  function toggleKeep(normalizedUrl: string, tabId: number) {
    setSelected(prev => {
      const next = new Map(prev);
      next.set(normalizedUrl, tabId);
      return next;
    });
  }

  async function handleMergeSelected() {
    let closed = 0;
    for (const group of duplicates) {
      const keepId = selected.get(group.normalizedUrl);
      if (!keepId) continue;
      for (const entry of group.tabs) {
        if (entry.tab.id !== keepId && entry.tab.id) {
          try {
            await chrome.tabs.remove(entry.tab.id);
            closed++;
          } catch {}
        }
      }
    }
    await scanDuplicates();
    onRefresh();
  }

  async function handleMergeAll() {
    // For each duplicate group, keep the "best" tab (active > most recent > first)
    let closed = 0;
    for (const group of duplicates) {
      const activeTab = group.tabs.find(t => t.tab.active);
      const keepTab = activeTab || group.tabs.reduce((best, curr) =>
        (curr.tab.lastAccessed || 0) > (best.tab.lastAccessed || 0) ? curr : best
      );

      for (const entry of group.tabs) {
        if (entry.tab.id !== keepTab.tab.id && entry.tab.id) {
          try {
            await chrome.tabs.remove(entry.tab.id);
            closed++;
          } catch {}
        }
      }
    }
    await scanDuplicates();
    onRefresh();
  }

  async function handleBringTogether() {
    // Move all duplicate tabs to the current window, then dedup
    const currentWindow = await chrome.windows.getCurrent();
    let closed = 0;

    for (const group of duplicates) {
      const keepId = selected.get(group.normalizedUrl);
      if (!keepId) continue;

      for (const entry of group.tabs) {
        if (entry.tab.id === keepId) continue;
        if (!entry.tab.id) continue;

        // If in a different window, close it (we keep the selected one)
        try {
          await chrome.tabs.remove(entry.tab.id);
          closed++;
        } catch {}
      }
    }

    await scanDuplicates();
    onRefresh();
  }

  const totalDuplicates = duplicates.reduce((sum, g) => sum + g.tabs.length - 1, 0);
  const crossWindowDupes = duplicates.filter(g => {
    const windowIds = new Set(g.tabs.map(t => t.windowId));
    return windowIds.size > 1;
  });

  return (
    <div className="dedup-view">
      {/* Stats */}
      <div className="dedup-stats">
        <div className="dedup-stat">
          <span className="dedup-stat-value">{totalWindows}</span>
          <span className="dedup-stat-label">Windows</span>
        </div>
        <div className="dedup-stat">
          <span className="dedup-stat-value">{totalTabs}</span>
          <span className="dedup-stat-label">Total Tabs</span>
        </div>
        <div className="dedup-stat">
          <span className="dedup-stat-value warning">{duplicates.length}</span>
          <span className="dedup-stat-label">Duplicate Groups</span>
        </div>
        <div className="dedup-stat">
          <span className="dedup-stat-value danger">{totalDuplicates}</span>
          <span className="dedup-stat-label">Can Remove</span>
        </div>
      </div>

      {/* Actions */}
      <div className="dedup-actions">
        <button className="btn btn-primary" onClick={handleMergeAll} disabled={duplicates.length === 0}>
          🔗 Merge All Duplicates
        </button>
        <button className="btn btn-secondary" onClick={handleMergeSelected} disabled={duplicates.length === 0}>
          ✅ Merge Selected
        </button>
        <button className="btn btn-secondary" onClick={scanDuplicates} disabled={scanning}>
          🔄 Rescan
        </button>
      </div>

      {crossWindowDupes.length > 0 && (
        <div className="dedup-cross-window-badge">
          ⚠️ {crossWindowDupes.length} groups have duplicates across different windows
        </div>
      )}

      {/* Duplicate List */}
      {scanning ? (
        <div className="view-placeholder">Scanning...</div>
      ) : duplicates.length === 0 ? (
        <div className="view-placeholder">
          <p>🎉 No duplicates found!</p>
          <p className="text-muted">All your tabs are unique across {totalWindows} windows.</p>
        </div>
      ) : (
        <div className="dedup-list">
          {duplicates.map(group => {
            const keepId = selected.get(group.normalizedUrl);
            const crossWindow = new Set(group.tabs.map(t => t.windowId)).size > 1;
            // Common prefix shared by every real URL in this group — the part
            // after it is what actually differs and gets highlighted per tab.
            const groupUrls = group.tabs.map(t => t.tab.url || '');
            const commonPrefix = longestCommonPrefix(groupUrls);

            return (
              <div key={group.normalizedUrl} className={`dedup-group ${crossWindow ? 'cross-window' : ''}`}>
                <div className="dedup-group-header">
                  <div className="dedup-group-info">
                    <span className="dedup-group-domain">{getCleanDomain(group.displayUrl)}</span>
                    {crossWindow && <span className="dedup-badge cross">Cross-Window</span>}
                    <span className="dedup-badge count">{group.tabs.length} tabs</span>
                  </div>
                  <div className="dedup-group-normalized" title="Normalized URL used for matching">
                    ≈ {group.normalizedUrl}
                  </div>
                </div>
                <div className="dedup-group-tabs">
                  {group.tabs.map((entry) => {
                    const fullUrl = entry.tab.url || '';
                    return (
                    <div
                      key={entry.tab.id}
                      className={`dedup-tab ${entry.tab.id === keepId ? 'keep' : 'remove'}`}
                      onClick={() => toggleKeep(group.normalizedUrl, entry.tab.id!)}
                    >
                      <div className="dedup-tab-main">
                        <span className="dedup-tab-radio">
                          {entry.tab.id === keepId ? '●' : '○'}
                        </span>
                        {entry.tab.favIconUrl && (
                          <img src={entry.tab.favIconUrl} className="dedup-tab-favicon" alt="" />
                        )}
                        <span className="dedup-tab-title">{entry.tab.title || 'Untitled'}</span>
                        <span className="dedup-tab-window">
                          W{entry.windowId}
                          {entry.tab.active && ' (active)'}
                        </span>
                      </div>
                      <div className="dedup-tab-url" title={fullUrl}>
                        <span className="dedup-url-common">{commonPrefix}</span>
                        <span className="dedup-url-diff">{fullUrl.slice(commonPrefix.length) || '∅'}</span>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


function getCleanDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 50);
  }
}

/** Longest common prefix across a set of URLs — the shared part we dim,
 *  so the differing tail of each duplicate stands out. */
function longestCommonPrefix(urls: string[]): string {
  if (urls.length < 2) return '';
  let prefix = urls[0];
  for (const url of urls.slice(1)) {
    while (!url.startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (!prefix) return '';
    }
  }
  return prefix;
}

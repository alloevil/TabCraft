// TabCraft — Cross-Window Duplicate Detection & Merge

import React, { useState, useEffect } from 'react';
import { findDuplicateGroups, getBestTab } from '../../shared/duplicate';
import { focusTab } from '../utils';

interface DuplicateGroup {
  normalizedUrl: string;
  displayUrl: string;
  tabs: chrome.tabs.Tab[];
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

    // Collect all tabs across all windows — chrome.tabs.Tab already carries
    // its windowId, so no wrapper is needed.
    const windows = await chrome.windows.getAll({ populate: true });
    setTotalWindows(windows.length);
    const allTabs = windows.flatMap((win) => win.tabs ?? []);
    setTotalTabs(allTabs.length);

    // Same grouping implementation as the background auto-close scan.
    const dupes = findDuplicateGroups(allTabs).map((g) => ({
      normalizedUrl: g.normalizedUrl,
      displayUrl: g.tabs[0].url || g.normalizedUrl,
      tabs: g.tabs,
    }));
    setDuplicates(dupes);

    // Auto-select which tab to keep — same rule as background auto-close.
    const autoSelect = new Map<string, number>();
    for (const group of dupes) {
      autoSelect.set(group.normalizedUrl, getBestTab(group.tabs).id!);
    }
    setSelected(autoSelect);

    setScanning(false);
  }

  function toggleKeep(normalizedUrl: string, tabId: number) {
    setSelected((prev) => {
      const next = new Map(prev);
      next.set(normalizedUrl, tabId);
      return next;
    });
  }

  async function handleMergeSelected() {
    for (const group of duplicates) {
      const keepId = selected.get(group.normalizedUrl);
      if (!keepId) continue;
      for (const tab of group.tabs) {
        if (tab.id !== keepId && tab.id) {
          try {
            await chrome.tabs.remove(tab.id);
          } catch {}
        }
      }
    }
    await scanDuplicates();
    onRefresh();
  }

  async function handleMergeAll() {
    // For each duplicate group, keep the "best" tab (active > most recent)
    for (const group of duplicates) {
      const keep = getBestTab(group.tabs);
      for (const tab of group.tabs) {
        if (tab.id !== keep.id && tab.id) {
          try {
            await chrome.tabs.remove(tab.id);
          } catch {}
        }
      }
    }
    await scanDuplicates();
    onRefresh();
  }

  const totalDuplicates = duplicates.reduce((sum, g) => sum + g.tabs.length - 1, 0);
  const crossWindowDupes = duplicates.filter((g) => {
    const windowIds = new Set(g.tabs.map((t) => t.windowId));
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
        <button
          className="btn btn-primary"
          onClick={handleMergeAll}
          disabled={duplicates.length === 0}
        >
          🔗 Merge All Duplicates
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleMergeSelected}
          disabled={duplicates.length === 0}
        >
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
          {duplicates.map((group) => {
            const keepId = selected.get(group.normalizedUrl);
            const crossWindow = new Set(group.tabs.map((t) => t.windowId)).size > 1;
            // Common prefix shared by every real URL in this group — the part
            // after it is what actually differs and gets highlighted per tab.
            const groupUrls = group.tabs.map((t) => t.url || '');
            const commonPrefix = longestCommonPrefix(groupUrls);

            return (
              <div
                key={group.normalizedUrl}
                className={`dedup-group ${crossWindow ? 'cross-window' : ''}`}
              >
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
                  {group.tabs.map((tab) => {
                    const fullUrl = tab.url || '';
                    return (
                      <div
                        key={tab.id}
                        className={`dedup-tab ${tab.id === keepId ? 'keep' : 'remove'}`}
                        onClick={() => toggleKeep(group.normalizedUrl, tab.id!)}
                      >
                        <div className="dedup-tab-main">
                          <span className="dedup-tab-radio">{tab.id === keepId ? '●' : '○'}</span>
                          {tab.favIconUrl && (
                            <img src={tab.favIconUrl} className="dedup-tab-favicon" alt="" />
                          )}
                          <span className="dedup-tab-title">{tab.title || 'Untitled'}</span>
                          <span className="dedup-tab-window">
                            W{tab.windowId}
                            {tab.active && ' (active)'}
                          </span>
                          <button
                            className="tab-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              focusTab(tab);
                            }}
                            title="Jump to this tab"
                          >
                            ↗
                          </button>
                        </div>
                        <div className="dedup-tab-url" title={fullUrl}>
                          <span className="dedup-url-common">{commonPrefix}</span>
                          <span className="dedup-url-diff">
                            {fullUrl.slice(commonPrefix.length) || '∅'}
                          </span>
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

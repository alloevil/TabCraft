// TabCraft — Quick Actions (One-click operations like OneTab)

import React, { useState, useEffect } from 'react';

interface QuickActionsProps {
  onRefresh: () => void;
}

export function QuickActions({ onRefresh }: QuickActionsProps) {
  const [tabCount, setTabCount] = useState(0);
  const [memoryInfo, setMemoryInfo] = useState('');
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  useEffect(() => {
    updateStats();
  }, []);

  async function updateStats() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    setTabCount(tabs.length);
    // Estimate memory (rough: ~50MB per tab)
    const mb = tabs.length * 50;
    setMemoryInfo(mb > 1024 ? `~${(mb / 1024).toFixed(1)} GB` : `~${mb} MB`);
  }

  // OneTab style: collapse all tabs into a single list
  async function handleCollapseAll() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const activeTab = tabs.find(t => t.active);
    const toCollapse = tabs.filter(t => !t.active && t.url);

    if (toCollapse.length === 0) return;

    // Save URLs to storage
    const saved = await chrome.storage.local.get('collapsedTabs');
    const existing = saved.collapsedTabs || [];
    const newEntries = toCollapse.map(t => ({
      url: t.url,
      title: t.title,
      favIconUrl: t.favIconUrl,
      savedAt: Date.now(),
    }));

    await chrome.storage.local.set({
      collapsedTabs: [...newEntries, ...existing],
    });

    // Close all non-active tabs
    for (const tab of toCollapse) {
      if (tab.id) await chrome.tabs.remove(tab.id);
    }

    await updateStats();
    onRefresh();
  }

  // Restore all collapsed tabs
  async function handleRestoreAll() {
    const saved = await chrome.storage.local.get('collapsedTabs');
    const collapsed = saved.collapsedTabs || [];

    if (collapsed.length === 0) return;

    // Open all URLs
    const urls = collapsed.map((t: any) => t.url).filter(Boolean);
    if (urls.length > 0) {
      await chrome.tabs.create({ url: urls[0] });
      for (let i = 1; i < urls.length; i++) {
        await chrome.tabs.create({ url: urls[i] });
      }
    }

    // Clear saved tabs
    await chrome.storage.local.set({ collapsedTabs: [] });

    await updateStats();
    onRefresh();
  }

  // Hibernate all inactive tabs
  async function handleHibernateAll() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    let count = 0;
    for (const tab of tabs) {
      if (!tab.active && !tab.discarded && tab.id) {
        try {
          await chrome.tabs.discard(tab.id);
          count++;
        } catch {}
      }
    }
    await updateStats();
    onRefresh();
  }

  // Close all duplicates
  async function handleCloseDuplicates() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const seen = new Map<string, chrome.tabs.Tab>();
    const duplicates: number[] = [];

    for (const tab of tabs) {
      if (!tab.url) continue;
      const normalized = normalizeUrl(tab.url);
      if (seen.has(normalized)) {
        // Keep the one that's active or more recent
        const existing = seen.get(normalized)!;
        if (tab.active || (!existing.active && (tab.lastAccessed || 0) > (existing.lastAccessed || 0))) {
          duplicates.push(existing.id!);
          seen.set(normalized, tab);
        } else {
          duplicates.push(tab.id!);
        }
      } else {
        seen.set(normalized, tab);
      }
    }

    for (const id of duplicates) {
      await chrome.tabs.remove(id);
    }

    await updateStats();
    onRefresh();
  }

  // Close tabs older than N days
  async function handleCloseOld(days: number) {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let closed = 0;

    for (const tab of tabs) {
      if (!tab.active && tab.id && (tab.lastAccessed || 0) < cutoff) {
        try {
          await chrome.tabs.remove(tab.id);
          closed++;
        } catch {}
      }
    }

    await updateStats();
    onRefresh();
  }

  // Close all tabs to the right of active
  async function handleCloseRight() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const activeIdx = tabs.findIndex(t => t.active);
    if (activeIdx === -1) return;

    for (let i = activeIdx + 1; i < tabs.length; i++) {
      const tabId = tabs[i].id;
      if (tabId != null) await chrome.tabs.remove(tabId);
    }

    await updateStats();
    onRefresh();
  }

  async function handleConfirm(action: string) {
    setShowConfirm(null);
    switch (action) {
      case 'collapse': await handleCollapseAll(); break;
      case 'hibernate': await handleHibernateAll(); break;
      case 'duplicates': await handleCloseDuplicates(); break;
      case 'old7': await handleCloseOld(7); break;
      case 'old30': await handleCloseOld(30); break;
    }
  }

  return (
    <div className="quick-actions">
      <div className="quick-stats">
        <div className="quick-stat">
          <span className="quick-stat-value">{tabCount}</span>
          <span className="quick-stat-label">Open Tabs</span>
        </div>
        <div className="quick-stat">
          <span className="quick-stat-value">{memoryInfo}</span>
          <span className="quick-stat-label">Est. Memory</span>
        </div>
      </div>

      <div className="quick-grid">
        {/* One-click collapse (OneTab style) */}
        <button className="quick-btn primary" onClick={() => setShowConfirm('collapse')}>
          <span className="quick-btn-icon">📦</span>
          <span className="quick-btn-label">Collapse All</span>
          <span className="quick-btn-desc">Save & close inactive tabs</span>
        </button>

        {/* Restore collapsed */}
        <button className="quick-btn" onClick={handleRestoreAll}>
          <span className="quick-btn-icon">📤</span>
          <span className="quick-btn-label">Restore</span>
          <span className="quick-btn-desc">Reopen collapsed tabs</span>
        </button>

        {/* Hibernate */}
        <button className="quick-btn" onClick={() => setShowConfirm('hibernate')}>
          <span className="quick-btn-icon">💤</span>
          <span className="quick-btn-label">Hibernate</span>
          <span className="quick-btn-desc">Suspend inactive tabs</span>
        </button>

        {/* Close duplicates */}
        <button className="quick-btn" onClick={() => setShowConfirm('duplicates')}>
          <span className="quick-btn-icon">🔗</span>
          <span className="quick-btn-label">Dedup</span>
          <span className="quick-btn-desc">Close duplicate tabs</span>
        </button>

        {/* Close tabs to right */}
        <button className="quick-btn" onClick={handleCloseRight}>
          <span className="quick-btn-icon">➡️</span>
          <span className="quick-btn-label">Close Right</span>
          <span className="quick-btn-desc">Close tabs to the right</span>
        </button>

        {/* Close old tabs */}
        <button className="quick-btn" onClick={() => setShowConfirm('old7')}>
          <span className="quick-btn-icon">🗑️</span>
          <span className="quick-btn-label">Close Old</span>
          <span className="quick-btn-desc">Close tabs older than 7 days</span>
        </button>
      </div>

      {/* Confirm dialog */}
      {showConfirm && (
        <div className="confirm-overlay" onClick={() => setShowConfirm(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>{getConfirmMessage(showConfirm)}</p>
            <div className="confirm-actions">
              <button className="btn btn-primary" onClick={() => handleConfirm(showConfirm)}>
                Confirm
              </button>
              <button className="btn btn-secondary" onClick={() => setShowConfirm(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getConfirmMessage(action: string): string {
  switch (action) {
    case 'collapse': return 'Collapse all inactive tabs? They\'ll be saved and can be restored later.';
    case 'hibernate': return 'Hibernate all inactive tabs? This frees up memory.';
    case 'duplicates': return 'Close all duplicate tabs?';
    case 'old7': return 'Close tabs not accessed in the last 7 days?';
    case 'old30': return 'Close tabs not accessed in the last 30 days?';
    default: return 'Are you sure?';
  }
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove tracking params
    const params = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 'ref', '_ga', '_gl'];
    for (const p of params) u.searchParams.delete(p);
    // Remove www. prefix
    u.hostname = u.hostname.replace(/^www\./, '');
    // Remove trailing slash
    return u.origin + u.pathname.replace(/\/$/, '') + u.search;
  } catch {
    return url;
  }
}

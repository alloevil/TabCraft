// TabCraft — Group Card Component

import React, { useState } from 'react';
import { TabItem } from './TabItem';

interface GroupCardProps {
  group?: chrome.tabGroups.TabGroup;
  tabs: chrome.tabs.Tab[];
  onRefresh: () => void;
}

export function GroupCard({ group, tabs, onRefresh }: GroupCardProps) {
  const [collapsed, setCollapsed] = useState(group?.collapsed ?? false);

  async function handleUngroupAll() {
    for (const tab of tabs) {
      if (tab.id) {
        await chrome.tabs.ungroup(tab.id);
      }
    }
    onRefresh();
  }

  async function handleSnoozeGroup() {
    // Persist every tab BEFORE closing it, so snoozing is recoverable rather
    // than a silent close. Records land in storage (`snoozed`) keyed per tab.
    const ok = confirm(`Snooze "${group?.title || 'group'}"? Its ${tabs.length} tab(s) will close and can be restored later.`);
    if (!ok) return;
    const now = Date.now();
    for (const tab of tabs) {
      if (!tab.url) continue;
      await chrome.runtime.sendMessage({
        action: 'snoozeTab',
        record: {
          id: `sn_${now}_${tab.id ?? Math.floor(now % 100000)}`,
          url: tab.url,
          title: tab.title || tab.url,
          wakeAt: 0, // 0 = manual restore only (no timed wake yet)
          createdAt: now,
        },
      }).catch(() => {});
    }
    for (const tab of tabs) {
      if (tab.id) await chrome.tabs.remove(tab.id);
    }
    onRefresh();
  }

  const color = group?.color || 'grey';
  const title = group?.title || 'Ungrouped';
  const isUngrouped = !group;

  return (
    <div className="group-card">
      <div
        className="group-header"
        style={{ borderLeftColor: `var(--group-${color}, var(--accent))` }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="group-header-left">
          <span className="group-collapse-icon">{collapsed ? '▶' : '▼'}</span>
          <span className="group-title">{title}</span>
          <span className="group-count">{tabs.length}</span>
        </div>
        {!isUngrouped && (
          <div className="group-header-actions">
            <button
              className="tab-action-btn"
              onClick={(e) => { e.stopPropagation(); handleUngroupAll(); }}
              title="Ungroup all tabs"
            >
              ⊘
            </button>
            <button
              className="tab-action-btn"
              onClick={(e) => { e.stopPropagation(); handleSnoozeGroup(); }}
              title="Snooze group"
            >
              ⏰
            </button>
          </div>
        )}
      </div>
      {!collapsed && (
        <div className="group-tabs">
          {tabs.map(tab => (
            <TabItem key={tab.id} tab={tab} />
          ))}
        </div>
      )}
    </div>
  );
}

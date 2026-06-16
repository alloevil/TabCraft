// TabCraft — Dashboard View (Activity & Stats)

import React, { useState, useEffect } from 'react';
import { extractDomain } from '../../background/ai/rule-engine';

interface DashboardStats {
  totalTabs: number;
  activeTabs: number;
  hibernatedTabs: number;
  totalGroups: number;
  uniqueDomains: number;
  topDomains: Array<{ domain: string; count: number }>;
  categoryBreakdown: Array<{ category: string; count: number }>;
  stats: {
    totalGrouped: number;
    totalHibernated: number;
    totalDuplicatesClosed: number;
  };
}

export function DashboardView() {
  const [data, setData] = useState<DashboardStats | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const [tabs, groups, storageStats] = await Promise.all([
      chrome.tabs.query({ currentWindow: true }),
      chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }),
      chrome.storage.local.get('stats'),
    ]);

    const activeTabs = tabs.filter(t => !t.discarded);
    const hibernatedTabs = tabs.filter(t => t.discarded);

    // Domain breakdown
    const domainMap = new Map<string, number>();
    for (const tab of tabs) {
      if (tab.url) {
        const domain = extractDomain(tab.url);
        if (domain) domainMap.set(domain, (domainMap.get(domain) || 0) + 1);
      }
    }
    const topDomains = Array.from(domainMap.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Category breakdown (from group names)
    const catMap = new Map<string, number>();
    for (const group of groups) {
      if (group.title) {
        catMap.set(group.title, (catMap.get(group.title) || 0) + 1);
      }
    }
    const categoryBreakdown = Array.from(catMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    const stats = storageStats.stats || { totalGrouped: 0, totalHibernated: 0, totalDuplicatesClosed: 0 };

    setData({
      totalTabs: tabs.length,
      activeTabs: activeTabs.length,
      hibernatedTabs: hibernatedTabs.length,
      totalGroups: groups.length,
      uniqueDomains: domainMap.size,
      topDomains,
      categoryBreakdown,
      stats,
    });
  }

  if (!data) return <div className="view-placeholder">Loading...</div>;

  // Estimate memory savings (rough: ~50MB per active tab, ~0.5MB per hibernated)
  const memorySavedMB = data.hibernatedTabs * 49.5;
  const memorySaved = memorySavedMB > 1024
    ? `${(memorySavedMB / 1024).toFixed(1)} GB`
    : `${memorySavedMB.toFixed(0)} MB`;

  return (
    <div className="dashboard-view">
      {/* Quick Stats */}
      <div className="dashboard-grid">
        <div className="stat-card">
          <span className="stat-value">{data.totalTabs}</span>
          <span className="stat-label">Total Tabs</span>
        </div>
        <div className="stat-card">
          <span className="stat-value accent">{data.activeTabs}</span>
          <span className="stat-label">Active</span>
        </div>
        <div className="stat-card">
          <span className="stat-value warning">{data.hibernatedTabs}</span>
          <span className="stat-label">Hibernated</span>
        </div>
        <div className="stat-card">
          <span className="stat-value success">{memorySaved}</span>
          <span className="stat-label">Memory Saved</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{data.totalGroups}</span>
          <span className="stat-label">Groups</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{data.uniqueDomains}</span>
          <span className="stat-label">Unique Domains</span>
        </div>
      </div>

      {/* Lifetime Stats */}
      <div className="dashboard-section">
        <h3>Lifetime Stats</h3>
        <div className="lifetime-stats">
          <div className="lifetime-row">
            <span>Total tabs grouped</span>
            <span className="lifetime-value">{data.stats.totalGrouped.toLocaleString()}</span>
          </div>
          <div className="lifetime-row">
            <span>Total tabs hibernated</span>
            <span className="lifetime-value">{data.stats.totalHibernated.toLocaleString()}</span>
          </div>
          <div className="lifetime-row">
            <span>Duplicates closed</span>
            <span className="lifetime-value">{data.stats.totalDuplicatesClosed.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Top Domains */}
      {data.topDomains.length > 0 && (
        <div className="dashboard-section">
          <h3>Top Domains</h3>
          <div className="bar-chart">
            {data.topDomains.map(({ domain, count }) => (
              <div key={domain} className="bar-row">
                <span className="bar-label">{domain}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(count / data.topDomains[0].count) * 100}%` }}
                  />
                </div>
                <span className="bar-value">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {data.categoryBreakdown.length > 0 && (
        <div className="dashboard-section">
          <h3>Categories</h3>
          <div className="category-pills">
            {data.categoryBreakdown.map(({ category, count }) => (
              <span key={category} className="category-pill-large">
                {category} <span className="pill-count">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

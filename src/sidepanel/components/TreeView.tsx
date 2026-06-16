// TabCraft — Tree View Component
// Tags organized by domain hierarchy, collapsible

import React, { useState, useEffect } from 'react';

interface DomainNode {
  domain: string;
  tabs: chrome.tabs.Tab[];
  collapsed: boolean;
}

export function TreeView({ onRefresh }: { onRefresh: () => void }) {
  const [domains, setDomains] = useState<DomainNode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTree();
  }, []);

  async function loadTree() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const domainMap = new Map<string, chrome.tabs.Tab[]>();

    for (const tab of tabs) {
      if (!tab.url) continue;
      try {
        const url = new URL(tab.url);
        const domain = url.hostname.replace(/^www\./, '');
        if (!domainMap.has(domain)) domainMap.set(domain, []);
        domainMap.get(domain)!.push(tab);
      } catch {}
    }

    const nodes: DomainNode[] = Array.from(domainMap.entries())
      .map(([domain, tabs]) => ({ domain, tabs, collapsed: false }))
      .sort((a, b) => b.tabs.length - a.tabs.length);

    setDomains(nodes);
  }

  function toggleDomain(domain: string) {
    setDomains(prev => prev.map(d =>
      d.domain === domain ? { ...d, collapsed: !d.collapsed } : d
    ));
  }

  async function handleTabClick(tabId: number) {
    await chrome.tabs.update(tabId, { active: true });
  }

  async function handleCloseTab(e: React.MouseEvent, tabId: number) {
    e.stopPropagation();
    await chrome.tabs.remove(tabId);
    await loadTree();
    onRefresh();
  }

  async function handleCloseDomain(domain: string) {
    const node = domains.find(d => d.domain === domain);
    if (!node) return;
    for (const tab of node.tabs) {
      if (tab.id) await chrome.tabs.remove(tab.id);
    }
    await loadTree();
    onRefresh();
  }

  async function handleHibernateDomain(domain: string) {
    const node = domains.find(d => d.domain === domain);
    if (!node) return;
    for (const tab of node.tabs) {
      if (tab.id && !tab.active) {
        try { await chrome.tabs.discard(tab.id); } catch {}
      }
    }
    await loadTree();
  }

  async function handleCollapseAll() {
    setDomains(prev => prev.map(d => ({ ...d, collapsed: true })));
  }

  async function handleExpandAll() {
    setDomains(prev => prev.map(d => ({ ...d, collapsed: false })));
  }

  const filtered = searchQuery
    ? domains.filter(d =>
        d.domain.includes(searchQuery.toLowerCase()) ||
        d.tabs.some(t => t.title?.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : domains;

  const totalTabs = domains.reduce((sum, d) => sum + d.tabs.length, 0);

  return (
    <div className="tree-view">
      {/* Toolbar */}
      <div className="tree-toolbar">
        <input
          type="text"
          placeholder="Search domains or tabs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        <div className="tree-toolbar-actions">
          <button className="tab-action-btn" onClick={handleCollapseAll} title="Collapse all">⊟</button>
          <button className="tab-action-btn" onClick={handleExpandAll} title="Expand all">⊞</button>
        </div>
      </div>

      {/* Stats */}
      <div className="tree-stats">
        <span>{domains.length} domains</span>
        <span>·</span>
        <span>{totalTabs} tabs</span>
      </div>

      {/* Tree */}
      <div className="tree-list">
        {filtered.map(node => (
          <div key={node.domain} className="tree-domain">
            <div
              className="tree-domain-header"
              onClick={() => toggleDomain(node.domain)}
            >
              <span className="tree-collapse-icon">
                {node.collapsed ? '▶' : '▼'}
              </span>
              {getFavicon(node.domain) && (
                <img
                  src={getFavicon(node.domain)}
                  className="tree-favicon"
                  alt=""
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <span className="tree-domain-name">{node.domain}</span>
              <span className="tree-domain-count">{node.tabs.length}</span>
              <div className="tree-domain-actions">
                <button
                  className="tab-action-btn"
                  onClick={(e) => { e.stopPropagation(); handleHibernateDomain(node.domain); }}
                  title="Hibernate all"
                >💤</button>
                <button
                  className="tab-action-btn danger"
                  onClick={(e) => { e.stopPropagation(); handleCloseDomain(node.domain); }}
                  title="Close all"
                >✕</button>
              </div>
            </div>
            {!node.collapsed && (
              <div className="tree-tabs">
                {node.tabs.map(tab => (
                  <div
                    key={tab.id}
                    className={`tree-tab ${tab.active ? 'active' : ''} ${tab.discarded ? 'discarded' : ''}`}
                    onClick={() => handleTabClick(tab.id!)}
                  >
                    {tab.favIconUrl ? (
                      <img src={tab.favIconUrl} className="tree-tab-favicon" alt="" />
                    ) : (
                      <span className="tree-tab-favicon-placeholder">·</span>
                    )}
                    <span className="tree-tab-title">{tab.title || 'Untitled'}</span>
                    {tab.discarded && <span className="tab-badge dormant">💤</span>}
                    <button
                      className="tree-tab-close"
                      onClick={(e) => handleCloseTab(e, tab.id!)}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function getFavicon(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
}

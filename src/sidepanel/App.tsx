// TabCraft — Main Side Panel App

import React, { useState, useEffect } from 'react';
import { GroupCard } from './components/GroupCard';
import { TreeView } from './components/TreeView';
import { QuickActions } from './components/QuickActions';
import { SettingsView } from './components/SettingsView';
import { RulesView } from './components/RulesView';
import { WorkspacesView } from './components/WorkspacesView';
import { DashboardView } from './components/DashboardView';
import { DedupView } from './components/DedupView';

type Tab = chrome.tabs.Tab;
type View = 'tabs' | 'tree' | 'quick' | 'rules' | 'settings' | 'workspaces' | 'dashboard' | 'dedup';

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [groups, setGroups] = useState<chrome.tabGroups.TabGroup[]>([]);
  const [view, setView] = useState<View>('tabs');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    loadTabs();
    const listener = () => loadTabs();
    chrome.tabs.onCreated.addListener(listener);
    chrome.tabs.onRemoved.addListener(listener);
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.onMoved.addListener(listener);
    chrome.tabGroups.onCreated.addListener(listener);
    chrome.tabGroups.onUpdated.addListener(listener);
    chrome.tabGroups.onRemoved.addListener(listener);
    return () => {
      chrome.tabs.onCreated.removeListener(listener);
      chrome.tabs.onRemoved.removeListener(listener);
      chrome.tabs.onUpdated.removeListener(listener);
      chrome.tabs.onMoved.removeListener(listener);
      chrome.tabGroups.onCreated.removeListener(listener);
      chrome.tabGroups.onUpdated.removeListener(listener);
      chrome.tabGroups.onRemoved.removeListener(listener);
    };
  }, []);

  async function loadTabs() {
    const [tabList, groupList] = await Promise.all([
      chrome.tabs.query({ currentWindow: true }),
      chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }),
    ]);
    setTabs(tabList);
    setGroups(groupList);
  }

  function showStatus(msg: string) {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 2500);
  }

  async function handleSmartGroup() {
    setIsLoading(true);
    try {
      const result = await chrome.runtime.sendMessage({ action: 'smartGroup' });
      await loadTabs();
      showStatus(`Grouped ${result?.grouped ?? 0} tabs into ${result?.groups ?? 0} groups`);
    } catch (err) {
      showStatus('Smart group failed');
    }
    setIsLoading(false);
  }

  async function handleCloseDuplicates() {
    setIsLoading(true);
    try {
      const result = await chrome.runtime.sendMessage({ action: 'closeDuplicates' });
      await loadTabs();
      showStatus(`Closed ${result ?? 0} duplicate tabs`);
    } catch (err) {
      showStatus('Dedup failed');
    }
    setIsLoading(false);
  }

  async function handleHibernateAll() {
    setIsLoading(true);
    try {
      const result = await chrome.runtime.sendMessage({ action: 'hibernateAll' });
      await loadTabs();
      showStatus(`Hibernated ${result ?? 0} tabs`);
    } catch (err) {
      showStatus('Hibernate failed');
    }
    setIsLoading(false);
  }

  const filteredTabs = tabs.filter(tab => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (tab.title?.toLowerCase().includes(q) || tab.url?.toLowerCase().includes(q));
  });

  // Group tabs by their Chrome tab group
  const groupedTabs = new Map<number, Tab[]>();
  const ungroupedTabs: Tab[] = [];
  for (const tab of filteredTabs) {
    if (tab.groupId && tab.groupId !== -1) {
      const existing = groupedTabs.get(tab.groupId) || [];
      existing.push(tab);
      groupedTabs.set(tab.groupId, existing);
    } else {
      ungroupedTabs.push(tab);
    }
  }

  const navItems: Array<{ id: View; icon: string; label: string }> = [
    { id: 'tabs', icon: '📑', label: 'Tabs' },
    { id: 'tree', icon: '🌳', label: 'Tree' },
    { id: 'quick', icon: '⚡', label: 'Quick' },
    { id: 'dedup', icon: '🔗', label: 'Dedup' },
    { id: 'rules', icon: '📋', label: 'Rules' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
    { id: 'workspaces', icon: '💼', label: 'Workspaces' },
    { id: 'dashboard', icon: '📊', label: 'Stats' },
  ];

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <span className="logo">✦</span>
          <h1>TabCraft</h1>
        </div>
        {view === 'tabs' && (
          <div className="header-actions">
            <button className="btn btn-primary" onClick={handleSmartGroup} disabled={isLoading} title="Auto-group all tabs by topic">
              {isLoading ? '⏳' : '🧠'} Smart Group
            </button>
            <button className="btn btn-secondary" onClick={handleCloseDuplicates} disabled={isLoading} title="Close duplicate tabs">
              🔗 Dedup
            </button>
            <button className="btn btn-secondary" onClick={handleHibernateAll} disabled={isLoading} title="Hibernate inactive tabs">
              💤
            </button>
          </div>
        )}
      </header>

      {/* Status */}
      {statusMsg && <div className="status-bar">{statusMsg}</div>}

      {/* Search (tabs view only) */}
      {view === 'tabs' && (
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search tabs..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <span className="search-count">{filteredTabs.length} tabs</span>
        </div>
      )}

      {/* Navigation */}
      <nav className="nav">
        {navItems.map(v => (
          <button
            key={v.id}
            className={`nav-item ${view === v.id ? 'active' : ''}`}
            onClick={() => setView(v.id)}
          >
            <span className="nav-icon">{v.icon}</span>
            <span className="nav-label">{v.label}</span>
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="content">
        {view === 'tabs' && (
          <div className="tab-list">
            {groups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                tabs={groupedTabs.get(group.id) || []}
                onRefresh={loadTabs}
              />
            ))}
            {ungroupedTabs.length > 0 && (
              <GroupCard tabs={ungroupedTabs} onRefresh={loadTabs} />
            )}
            {filteredTabs.length === 0 && (
              <div className="view-placeholder">
                <p>No tabs found</p>
              </div>
            )}
          </div>
        )}
        {view === 'tree' && <TreeView onRefresh={loadTabs} />}
        {view === 'quick' && <QuickActions onRefresh={loadTabs} />}
        {view === 'rules' && <RulesView />}
        {view === 'settings' && <SettingsView />}
        {view === 'workspaces' && <WorkspacesView />}
        {view === 'dashboard' && <DashboardView />}
        {view === 'dedup' && <DedupView onRefresh={loadTabs} />}
      </main>
    </div>
  );
}

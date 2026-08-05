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
import { LocaleProvider, translate, type Locale } from './i18n';
import { sendMessage } from './utils';
import type { TimerHandle } from '../shared/types';

type Tab = chrome.tabs.Tab;
type View = 'tabs' | 'tree' | 'quick' | 'rules' | 'settings' | 'workspaces' | 'dashboard' | 'dedup';

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [groups, setGroups] = useState<chrome.tabGroups.TabGroup[]>([]);
  const [view, setView] = useState<View>('tabs');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [canUndo, setCanUndo] = useState(false);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [locale, setLocale] = useState<Locale>('en');
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);

  useEffect(() => {
    loadTabs();
    sendMessage<boolean>({ action: 'hasUndo' })
      .then((v) => setCanUndo(!!v))
      .catch(() => {});
    sendMessage<boolean>({ action: 'isAiReady' })
      .then((v) => setAiReady(!!v))
      .catch(() => setAiReady(false));
    // Toolbar clicks always just open the side panel (openPanelOnActionClick
    // disables chrome.action.onClicked, so we can't tell "this open was
    // triggered by the duplicate badge" from any other open). As a stand-in:
    // if duplicates exist right when the panel opens, land on the Dedup view
    // instead of the default tab list — the most actionable place to be.
    chrome.storage.local.get('settings', (r) => {
      if (r.settings?.language) setLocale(r.settings.language);
      if (r.settings?.showDuplicateBadge ?? true) {
        sendMessage<Array<{ tabs: unknown[] }>>({ action: 'findDuplicates' })
          .then((dupes) => {
            if (dupes?.length > 0) setView('dedup');
          })
          .catch(() => {});
      }
    });
    const onStorage = (changes: { [k: string]: chrome.storage.StorageChange }) => {
      if (changes.settings?.newValue?.language) setLocale(changes.settings.newValue.language);
    };
    chrome.storage.onChanged.addListener(onStorage);
    // Debounced refresh: one page load fires several onUpdated events
    // (status/title/favicon), and batch operations touch many tabs at once —
    // coalesce a burst into a single tabs+groups re-query.
    let reloadTimer: TimerHandle | undefined;
    const listener = () => {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(loadTabs, 120);
    };
    chrome.tabs.onCreated.addListener(listener);
    chrome.tabs.onRemoved.addListener(listener);
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.onMoved.addListener(listener);
    chrome.tabGroups.onCreated.addListener(listener);
    chrome.tabGroups.onUpdated.addListener(listener);
    chrome.tabGroups.onRemoved.addListener(listener);
    return () => {
      clearTimeout(reloadTimer);
      chrome.tabs.onCreated.removeListener(listener);
      chrome.tabs.onRemoved.removeListener(listener);
      chrome.tabs.onUpdated.removeListener(listener);
      chrome.tabs.onMoved.removeListener(listener);
      chrome.tabGroups.onCreated.removeListener(listener);
      chrome.tabGroups.onUpdated.removeListener(listener);
      chrome.tabGroups.onRemoved.removeListener(listener);
      chrome.storage.onChanged.removeListener(onStorage);
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
      const result = await sendMessage<{ grouped: number; groups: number }>({
        action: 'smartGroup',
      });
      await loadTabs();
      showStatus(`Grouped ${result?.grouped ?? 0} tabs into ${result?.groups ?? 0} groups`);
      setCanUndo(true);
    } catch {
      showStatus('Smart group failed');
    }
    setIsLoading(false);
  }

  async function handleUndoGrouping() {
    setIsLoading(true);
    try {
      const ok = await sendMessage<boolean>({ action: 'undoGrouping' });
      await loadTabs();
      showStatus(ok ? 'Grouping undone' : 'Nothing to undo');
      const stillHas = await sendMessage<boolean>({ action: 'hasUndo' });
      setCanUndo(!!stillHas);
    } catch {
      showStatus('Undo failed');
    }
    setIsLoading(false);
  }

  async function handleCloseDuplicates() {
    setIsLoading(true);
    try {
      const result = await sendMessage<number>({ action: 'closeDuplicates' });
      await loadTabs();
      showStatus(`Closed ${result ?? 0} duplicate tabs`);
    } catch {
      showStatus('Dedup failed');
    }
    setIsLoading(false);
  }

  async function handleHibernateAll() {
    setIsLoading(true);
    try {
      const result = await sendMessage<number>({ action: 'hibernateAll' });
      await loadTabs();
      showStatus(`Hibernated ${result ?? 0} tabs`);
    } catch {
      showStatus('Hibernate failed');
    }
    setIsLoading(false);
  }

  const filteredTabs = tabs.filter((tab) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return tab.title?.toLowerCase().includes(q) || tab.url?.toLowerCase().includes(q);
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
    { id: 'tabs', icon: '📑', label: t('navTabs') },
    { id: 'tree', icon: '🌳', label: t('navTree') },
    { id: 'quick', icon: '⚡', label: t('navQuick') },
    { id: 'dedup', icon: '🔗', label: t('navDedup') },
    { id: 'rules', icon: '📋', label: t('navRules') },
    { id: 'settings', icon: '⚙️', label: t('navSettings') },
    { id: 'workspaces', icon: '💼', label: t('navWorkspaces') },
    { id: 'dashboard', icon: '📊', label: t('navStats') },
  ];

  return (
    <LocaleProvider locale={locale}>
      <div className="app">
        {/* Header */}
        <header className="header">
          <div className="header-brand">
            <span className="logo">✦</span>
            <h1>TabCraft</h1>
            {aiReady !== null && (
              <span
                className={`ai-badge ${aiReady ? 'ai-on' : 'ai-off'}`}
                title={
                  aiReady
                    ? 'On-device AI (Gemini Nano) is active'
                    : 'AI unavailable — using the built-in rule engine'
                }
              >
                {aiReady ? t('aiActive') : t('rulesActive')}
              </span>
            )}
          </div>
          {view === 'tabs' && (
            <div className="header-actions">
              <button
                className="btn btn-primary btn-icon-label"
                onClick={handleSmartGroup}
                disabled={isLoading}
                title="Auto-group all tabs by topic"
              >
                <span className="btn-icon">{isLoading ? '⏳' : '🧠'}</span>
                <span className="btn-label">{t('smartGroup')}</span>
              </button>
              <button
                className="btn btn-secondary btn-icon-label"
                onClick={handleCloseDuplicates}
                disabled={isLoading}
                title="Close duplicate tabs"
              >
                <span className="btn-icon">🔗</span>
                <span className="btn-label">{t('dedup')}</span>
              </button>
              {canUndo && (
                <button
                  className="btn btn-secondary"
                  onClick={handleUndoGrouping}
                  disabled={isLoading}
                  title="Undo last grouping"
                >
                  ↩️
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={handleHibernateAll}
                disabled={isLoading}
                title="Hibernate inactive tabs"
              >
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
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <span className="search-count">{filteredTabs.length} tabs</span>
          </div>
        )}

        {/* Navigation */}
        <nav className="nav">
          {navItems.map((v) => (
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
              {groups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  tabs={groupedTabs.get(group.id) || []}
                  onRefresh={loadTabs}
                />
              ))}
              {ungroupedTabs.length > 0 && <GroupCard tabs={ungroupedTabs} onRefresh={loadTabs} />}
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
    </LocaleProvider>
  );
}

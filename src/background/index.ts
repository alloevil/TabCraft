// TabCraft — Service Worker Entry Point (MV3 Background Script)

import { TabManager } from './tab-manager';
import { HibernationManager } from './hibernation';
import { Storage } from './storage';
import type { Settings } from '../shared/types';
import { DUPLICATE_SCAN_DEBOUNCE_MS, SESSION_SAVE_DEBOUNCE_MS, TAB_LOAD_DELAY_MS, LEARN_DEBOUNCE_MS } from '../shared/constants';

/** Singleton instances */
let tabManager: TabManager;
let hibernationManager: HibernationManager;

/** In-memory settings cache, shared by every listener below so a burst of
 *  tab events doesn't each round-trip through chrome.storage.local.get.
 *  Kept in sync via chrome.storage.onChanged (see setupListeners). */
let settingsCache: Settings;

/** Initialize the extension */
async function init() {
  console.log('[TabCraft] Initializing...');

  // Initialize storage
  await Storage.init();
  settingsCache = await Storage.getSettings();

  // Initialize tab manager
  tabManager = new TabManager();
  await tabManager.init();

  // Initialize hibernation manager
  hibernationManager = new HibernationManager();
  hibernationManager.start();

  // Set up event listeners
  setupListeners();

  console.log(`[TabCraft] Ready! AI: ${tabManager.isAiReady() ? 'enabled' : 'rule-based fallback'}`);
}

/** Set up Chrome event listeners */
function setupListeners() {
  // Open the side panel directly when the toolbar icon is clicked, instead of
  // requiring a second "open side panel" click. Must run on every SW startup.
  // (openPanelOnActionClick is mutually exclusive with a default_popup — we
  // intentionally define no popup so the icon click maps straight to the panel.)
  chrome.sidePanel
    ?.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.debug('[TabCraft] setPanelBehavior unsupported:', err));

  // Keep the in-memory settings cache in sync with storage, regardless of
  // which code path wrote it (Storage.updateSettings or a direct
  // chrome.storage.local.set from the side panel).
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.settings) {
      settingsCache = changes.settings.newValue as Settings;
    }
  });

  // Auto-group new tabs
  chrome.tabs.onCreated.addListener((tab) => {
    if (settingsCache.autoGroup && tab.id !== undefined) {
      // Small delay to let the tab fully load
      const timer = setTimeout(() => {
        pendingAutoGroupTimers.delete(tab.id!);
        tabManager.autoGroupTab(tab);
      }, TAB_LOAD_DELAY_MS);
      pendingAutoGroupTimers.set(tab.id, timer);
    }
  });

  // Cancel a pending auto-group if the tab closes before the delay fires —
  // otherwise autoGroupTab runs against an already-closed tab id.
  chrome.tabs.onRemoved.addListener((tabId) => {
    const timer = pendingAutoGroupTimers.get(tabId);
    if (timer) {
      clearTimeout(timer);
      pendingAutoGroupTimers.delete(tabId);
    }
  });

  // Auto-close duplicates — debounced so a burst of URL changes (SPA
  // navigations, session restore) triggers one full-tab-list scan instead
  // of one scan per tab per navigation.
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.url && settingsCache.autoCloseDuplicates) {
      scheduleDuplicateScan();
    }
  });

  // Self-learning: when the user manually moves a tab into a named group,
  // remember that domain→group mapping so future tabs classify the same way.
  // Debounced per-tab so dragging a batch of tabs around collapses into one
  // write per tab instead of firing on every intermediate groupId change.
  const learnTimers = new Map<number, ReturnType<typeof setTimeout>>();
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.groupId === undefined || changeInfo.groupId === -1) return;
    const groupId = changeInfo.groupId;
    const prev = learnTimers.get(tabId);
    if (prev) clearTimeout(prev);
    learnTimers.set(tabId, setTimeout(async () => {
      learnTimers.delete(tabId);
      try {
        const tab = await chrome.tabs.get(tabId);
        const group = await chrome.tabGroups.get(groupId);
        if (group?.title) {
          await tabManager.learnFromManualGrouping(tab, group.title);
        }
      } catch {
        // tab/group may have been removed mid-flight; ignore
      }
    }, LEARN_DEBOUNCE_MS));
  });

  // Listen for messages from side panel
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse).catch(err => {
      console.error('[TabCraft] Message handler error:', err);
      sendResponse({ error: err.message });
    });
    return true; // Keep the message channel open for async response
  });

  // Context menu — onInstalled also fires on extension update, so clear any
  // previously-registered items first; otherwise chrome.contextMenus.create
  // rejects with a "duplicate id" error on every update.
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'tabcraft-smart-group',
        title: 'TabCraft: Smart Group All Tabs',
        contexts: ['page'],
      });
      chrome.contextMenus.create({
        id: 'tabcraft-dedup',
        title: 'TabCraft: Close Duplicates',
        contexts: ['page'],
      });
      chrome.contextMenus.create({
        id: 'tabcraft-hibernate',
        title: 'TabCraft: Hibernate Inactive Tabs',
        contexts: ['page'],
      });
    });
  });

  chrome.contextMenus.onClicked.addListener(async (info) => {
    switch (info.menuItemId) {
      case 'tabcraft-smart-group':
        await tabManager.smartGroupAll();
        break;
      case 'tabcraft-dedup':
        await tabManager.closeDuplicates();
        break;
      case 'tabcraft-hibernate':
        await hibernationManager.hibernateAllInactive();
        break;
    }
  });

  // Keyboard shortcuts
  chrome.commands?.onCommand?.addListener(async (command) => {
    switch (command) {
      case 'smart-group':
        await tabManager.smartGroupAll();
        break;
      case 'close-duplicates':
        await tabManager.closeDuplicates();
        break;
    }
  });

  // Session auto-save — use chrome.alarms for MV3 reliability
  chrome.alarms.create('session-save', { periodInMinutes: 5 });
  chrome.alarms.create('hibernation-check', { periodInMinutes: 5 });

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'session-save') {
      await saveSession();
    } else if (alarm.name === 'hibernation-check') {
      await hibernationManager.checkAndHibernate();
    }
  });

  // Save session on tab changes — debounced so closing/opening/dragging a
  // batch of tabs collapses into one snapshot write instead of one per event.
  chrome.tabs.onCreated.addListener(() => scheduleSessionSave());
  chrome.tabs.onRemoved.addListener(() => scheduleSessionSave());
  chrome.tabs.onMoved.addListener(() => scheduleSessionSave());
}

/** Pending auto-group setTimeout handles, keyed by tab id, so they can be
 *  cancelled if the tab closes before the load delay elapses. */
const pendingAutoGroupTimers = new Map<number, ReturnType<typeof setTimeout>>();

/** Debounced duplicate scan — coalesces a burst of onUpdated(url) events
 *  (SPA navigations, session restore) into a single findDuplicates() pass. */
let duplicateScanTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleDuplicateScan() {
  if (duplicateScanTimer) clearTimeout(duplicateScanTimer);
  duplicateScanTimer = setTimeout(async () => {
    duplicateScanTimer = null;
    const duplicates = await tabManager.findDuplicates();
    const activeTabIds = new Set(
      (await chrome.tabs.query({ active: true })).map((t) => t.id)
    );
    for (const dup of duplicates) {
      // Sort by lastAccessed descending — most recent first
      const sorted = dup.tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
      // Keep the most recently active tab, close the rest — but never close
      // a tab that's currently focused in some window.
      const toClose = sorted.slice(1).filter((tab) => !activeTabIds.has(tab.id));
      for (const tab of toClose) {
        await chrome.tabs.remove(tab.id!);
      }
    }
  }, DUPLICATE_SCAN_DEBOUNCE_MS);
}

/** Debounced session save, used by the high-frequency tab-mutation
 *  listeners. The 5-minute alarm above calls saveSession() directly since
 *  it's already infrequent. */
let sessionSaveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSessionSave() {
  if (sessionSaveTimer) clearTimeout(sessionSaveTimer);
  sessionSaveTimer = setTimeout(() => {
    sessionSaveTimer = null;
    saveSession();
  }, SESSION_SAVE_DEBOUNCE_MS);
}

/** Handle messages from the side panel */
async function handleMessage(message: { action: string; [key: string]: any }) {
  switch (message.action) {
    case 'smartGroup':
      return tabManager.smartGroupAll();

    case 'undoGrouping':
      return tabManager.undoLastGrouping();

    case 'hasUndo':
      return Storage.hasUndo();

    case 'closeDuplicates':
      return tabManager.closeDuplicates();

    case 'hibernateAll':
      return hibernationManager.hibernateAllInactive();

    case 'hibernateTab':
      return hibernationManager.hibernateTab(message.tabId);

    case 'getStats':
      return hibernationManager.getStats();

    case 'findDuplicates':
      return tabManager.findDuplicates();

    case 'domainStats':
      return tabManager.getDomainStats();

    case 'isAiReady':
      return tabManager.isAiReady();

    case 'learnedCount':
      return Storage.getLearnedMappingCount();

    case 'clearLearned':
      return tabManager.clearLearnedMappings();

    case 'snoozeTab':
      await Storage.addSnooze(message.record);
      return true;

    case 'getSnoozed':
      return Storage.getSnoozed();

    case 'restoreSnoozed': {
      const all = await Storage.getSnoozed();
      const rec = all.find((s) => s.id === message.id);
      if (rec) {
        await chrome.tabs.create({ url: rec.url, active: false });
        await Storage.removeSnooze(message.id);
      }
      return true;
    }

    default:
      throw new Error(`Unknown action: ${message.action}`);
  }
}

/** Save current session for crash recovery */
async function saveSession() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });

    const workspace = {
      id: 'auto-session',
      name: 'Auto-saved Session',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tabs: tabs.map(t => ({
        url: t.url || '',
        title: t.title || '',
        pinned: t.pinned || false,
        groupIndex: groups.findIndex(g => g.id === t.groupId),
      })),
      groups: groups.map(g => ({
        name: g.title || '',
        color: g.color,
        collapsed: g.collapsed,
      })),
    };

    await Storage.setSessionSnapshot(workspace);
  } catch (err) {
    console.debug('[TabCraft] Session save failed:', err);
  }
}

// Initialize on service worker startup
init();

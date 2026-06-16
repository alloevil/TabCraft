// TabCraft — Service Worker Entry Point (MV3 Background Script)

import { TabManager } from './tab-manager';
import { HibernationManager } from './hibernation';
import { Storage } from './storage';

/** Singleton instances */
let tabManager: TabManager;
let hibernationManager: HibernationManager;

/** Initialize the extension */
async function init() {
  console.log('[TabCraft] Initializing...');

  // Initialize storage
  await Storage.init();

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
  // Auto-group new tabs
  chrome.tabs.onCreated.addListener(async (tab) => {
    const settings = await Storage.getSettings();
    if (settings.autoGroup) {
      // Small delay to let the tab fully load
      setTimeout(() => {
        tabManager.autoGroupTab(tab);
      }, 500);
    }
  });

  // Auto-close duplicates
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (changeInfo.url) {
      const settings = await Storage.getSettings();
      if (settings.autoCloseDuplicates) {
        const duplicates = await tabManager.findDuplicates();
        for (const dup of duplicates) {
          // Sort by lastAccessed descending — most recent first
          const sorted = dup.tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
          // Keep the most recently active tab, close the rest
          const toClose = sorted.slice(1);
          for (const tab of toClose) {
            if (tab.id === tabId) {
              // Don't close the tab that was just updated
              continue;
            }
            await chrome.tabs.remove(tab.id!);
          }
        }
      }
    }
  });

  // Listen for messages from side panel
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message).then(sendResponse).catch(err => {
      console.error('[TabCraft] Message handler error:', err);
      sendResponse({ error: err.message });
    });
    return true; // Keep the message channel open for async response
  });

  // Context menu
  chrome.runtime.onInstalled.addListener(() => {
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

  // Save session on tab changes
  chrome.tabs.onCreated.addListener(() => saveSession());
  chrome.tabs.onRemoved.addListener(() => saveSession());
  chrome.tabs.onMoved.addListener(() => saveSession());
}

/** Handle messages from the side panel */
async function handleMessage(message: { action: string; [key: string]: any }) {
  switch (message.action) {
    case 'smartGroup':
      return tabManager.smartGroupAll();

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

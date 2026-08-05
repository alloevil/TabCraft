// TabCraft — Service Worker Entry Point (MV3 Background Script)
//
// MV3 lifecycle contract: Chrome may kill this worker after ~30s of idle and
// re-run it from scratch to deliver the next event. Two rules follow:
//   1. Every chrome.* listener MUST be registered synchronously in this
//      module's first turn — a listener registered after an `await` misses
//      the very event that woke the worker.
//   2. No in-memory state can be assumed to survive between events; handlers
//      `await ready` for initialized singletons and read settings through
//      Storage.getSettings() (memoized, invalidated via storage.onChanged).

import { TabManager } from './tab-manager';
import { HibernationManager } from './hibernation';
import { Storage } from './storage';
import { getBestTab } from '../shared/duplicate';
import type { Message, TimerHandle } from '../shared/types';
import {
  DUPLICATE_SCAN_DEBOUNCE_MS,
  SESSION_SAVE_DEBOUNCE_MS,
  LEARN_DEBOUNCE_MS,
  DUPLICATE_BADGE_COLOR,
  SNOOZE_ALARM_PREFIX,
} from '../shared/constants';

/** Singleton instances — constructed synchronously so every listener below
 *  can safely reference them; their async setup happens in init(). */
const tabManager = new TabManager();
const hibernationManager = new HibernationManager();

/** Resolves once async initialization (storage defaults, rule/AI engine
 *  loading) is done. Every event handler awaits this before doing work. */
const ready: Promise<void> = init();

async function init(): Promise<void> {
  console.log('[TabCraft] Initializing...');
  await Storage.init();
  await tabManager.init();

  // Set the toolbar badge to the current duplicate count on startup —
  // otherwise it stays blank until the next tab event triggers a scan.
  const settings = await Storage.getSettings();
  if (settings.showDuplicateBadge) {
    await updateDuplicateBadge();
  }

  console.log(
    `[TabCraft] Ready! AI: ${tabManager.isAiReady() ? 'enabled' : 'rule-based fallback'}`
  );
}

// ── Listener registration (synchronous, first turn — see header) ─────────

// Tab-activity tracking for hibernation (onActivated/onUpdated/onRemoved).
hibernationManager.start();

// Open the side panel directly when the toolbar icon is clicked, instead of
// requiring a second "open side panel" click.
// (openPanelOnActionClick is mutually exclusive with a default_popup — we
// intentionally define no popup so the icon click maps straight to the panel.)
chrome.sidePanel
  ?.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.debug('[TabCraft] setPanelBehavior unsupported:', err));

// React to the user toggling the duplicate badge in settings. (The settings
// cache itself is maintained inside Storage via its own onChanged listener.)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.settings) return;
  const prevShowBadge = changes.settings.oldValue?.showDuplicateBadge;
  const nextShowBadge = changes.settings.newValue?.showDuplicateBadge;
  if (prevShowBadge === nextShowBadge) return;
  if (nextShowBadge) {
    ready.then(updateDuplicateBadge);
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
});

/** Tabs created in this worker's lifetime that haven't finished loading yet.
 *  Auto-grouping waits for onUpdated status==='complete' instead of a fixed
 *  setTimeout: a timer dies with the service worker, and a fixed delay races
 *  slow pages anyway. (If the worker dies between creation and completion the
 *  entry is lost and that tab isn't auto-grouped — same failure window the
 *  old timer had, without misclassifying half-loaded titles.) */
const pendingAutoGroup = new Set<number>();

chrome.tabs.onCreated.addListener((tab) => {
  // Added synchronously so the 'complete' handler below can never observe a
  // created-but-not-yet-tracked tab. autoGroupTab() itself re-checks the
  // autoGroup setting, so no settings read is needed here.
  if (tab.id !== undefined) {
    pendingAutoGroup.add(tab.id);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !pendingAutoGroup.has(tabId)) return;
  pendingAutoGroup.delete(tabId);
  await ready;
  await tabManager.autoGroupTab(tab);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  pendingAutoGroup.delete(tabId);
});

// Auto-close duplicates / update the toolbar badge — debounced so a burst
// of URL changes (SPA navigations, session restore) triggers one full-tab
// scan instead of one per tab per navigation. The callback itself checks
// which of the two features (if any) is enabled.
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.url) {
    scheduleDuplicateScan();
  }
});

// Self-learning: when the user manually moves a tab into a named group,
// remember that domain→group mapping so future tabs classify the same way.
// Debounced per-tab so dragging a batch of tabs around collapses into one
// write per tab instead of firing on every intermediate groupId change.
const learnTimers = new Map<number, TimerHandle>();
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.groupId === undefined || changeInfo.groupId === -1) return;
  const groupId = changeInfo.groupId;
  clearTimeout(learnTimers.get(tabId));
  learnTimers.set(
    tabId,
    setTimeout(async () => {
      learnTimers.delete(tabId);
      await ready;
      // Skip groupId changes the extension itself caused (smart group,
      // auto-group, undo) — only genuine user drags are learning signal.
      if (tabManager.wasSelfGrouped(tabId)) return;
      try {
        const tab = await chrome.tabs.get(tabId);
        const group = await chrome.tabGroups.get(groupId);
        if (group?.title) {
          await tabManager.learnFromManualGrouping(tab, group.title);
        }
      } catch {
        // tab/group may have been removed mid-flight; ignore
      }
    }, LEARN_DEBOUNCE_MS)
  );
});

// Listen for messages from side panel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message as Message)
    .then(sendResponse)
    .catch((err) => {
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
  await ready;
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
  await ready;
  switch (command) {
    case 'smart-group':
      await tabManager.smartGroupAll();
      break;
    case 'close-duplicates':
      await tabManager.closeDuplicates();
      break;
  }
});

// Session auto-save + hibernation sweep — chrome.alarms for MV3 reliability.
chrome.alarms.create('session-save', { periodInMinutes: 5 });
chrome.alarms.create('hibernation-check', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  await ready;
  if (alarm.name === 'session-save') {
    await saveSession();
  } else if (alarm.name === 'hibernation-check') {
    await hibernationManager.checkAndHibernate();
  } else if (alarm.name.startsWith(SNOOZE_ALARM_PREFIX)) {
    await restoreSnoozeById(alarm.name.slice(SNOOZE_ALARM_PREFIX.length));
  }
});

// Save session on tab changes — debounced so closing/opening/dragging a
// batch of tabs collapses into one snapshot write instead of one per event.
chrome.tabs.onCreated.addListener(() => {
  scheduleSessionSave();
  scheduleDuplicateScan();
});
chrome.tabs.onRemoved.addListener(() => {
  scheduleSessionSave();
  scheduleDuplicateScan();
});
chrome.tabs.onMoved.addListener(() => scheduleSessionSave());

// ── Handlers ──────────────────────────────────────────────────────────────

/** Debounced duplicate scan — coalesces a burst of tab create/remove/url-
 *  change events into a single findDuplicates() pass. Drives both
 *  auto-close and the toolbar badge count; the callback checks which of the
 *  two features (if any) is enabled. */
let duplicateScanTimer: TimerHandle | undefined;
function scheduleDuplicateScan() {
  clearTimeout(duplicateScanTimer);
  duplicateScanTimer = setTimeout(async () => {
    duplicateScanTimer = undefined;
    await ready;
    const settings = await Storage.getSettings();
    if (!settings.autoCloseDuplicates && !settings.showDuplicateBadge) return;
    if (settings.autoCloseDuplicates) {
      const duplicates = await tabManager.findDuplicates();
      const activeTabIds = new Set((await chrome.tabs.query({ active: true })).map((t) => t.id));
      for (const dup of duplicates) {
        // Keep the active-or-most-recent tab (shared getBestTab rule), and
        // additionally never close a tab that's currently focused in some
        // window — dedup must not yank a page out from under the user.
        const keep = getBestTab(dup.tabs);
        for (const tab of dup.tabs) {
          if (tab === keep || tab.id === undefined || activeTabIds.has(tab.id)) continue;
          await chrome.tabs.remove(tab.id);
        }
      }
    }
    if (settings.showDuplicateBadge) {
      // Re-query fresh rather than reuse the list above — the auto-close
      // pass (if it ran) may have just closed some of them.
      await updateDuplicateBadge();
    }
  }, DUPLICATE_SCAN_DEBOUNCE_MS);
}

/** Set the toolbar icon's badge to the number of closeable duplicate tabs
 *  (i.e. every tab in a duplicate group except the one that would be kept),
 *  clearing the badge entirely when there are none. */
async function updateDuplicateBadge(): Promise<void> {
  const duplicates = await tabManager.findDuplicates();
  const count = duplicates.reduce((sum, group) => sum + Math.max(group.tabs.length - 1, 0), 0);
  await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  if (count > 0) {
    await chrome.action.setBadgeBackgroundColor({ color: DUPLICATE_BADGE_COLOR });
  }
}

/** Debounced session save, used by the high-frequency tab-mutation
 *  listeners. The 5-minute alarm above calls saveSession() directly since
 *  it's already infrequent. */
let sessionSaveTimer: TimerHandle | undefined;
function scheduleSessionSave() {
  clearTimeout(sessionSaveTimer);
  sessionSaveTimer = setTimeout(async () => {
    sessionSaveTimer = undefined;
    await ready;
    await saveSession();
  }, SESSION_SAVE_DEBOUNCE_MS);
}

/** Reopen a snoozed tab and clear its record + wake alarm. Shared by the
 *  timed-wake alarm and the manual "restore" message. */
async function restoreSnoozeById(id: string): Promise<boolean> {
  const all = await Storage.getSnoozed();
  const rec = all.find((s) => s.id === id);
  if (!rec) return false;
  await chrome.tabs.create({ url: rec.url, active: false });
  await Storage.removeSnooze(id);
  await chrome.alarms.clear(SNOOZE_ALARM_PREFIX + id);
  return true;
}

/** Handle messages from the side panel */
async function handleMessage(message: Message): Promise<unknown> {
  await ready;
  switch (message.action) {
    case 'smartGroup':
      return tabManager.smartGroupAll();

    case 'previewCustomCategories':
      return tabManager.previewCustomCategories(message.instruction);

    case 'smartGroupCustom':
      return tabManager.smartGroupCustom(message.instruction, message.categories);

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

    case 'previewClassification':
      return tabManager.previewClassification();

    case 'isAiReady':
      return tabManager.isAiReady();

    case 'learnedCount':
      return Storage.getLearnedMappingCount();

    case 'clearLearned':
      return tabManager.clearLearnedMappings();

    case 'snoozeTab':
      await Storage.addSnooze(message.record);
      // wakeAt > 0 means a timed snooze: schedule the reopen via
      // chrome.alarms so it survives service-worker restarts.
      // wakeAt === 0 means manual-restore-only.
      if (message.record.wakeAt > 0) {
        chrome.alarms.create(SNOOZE_ALARM_PREFIX + message.record.id, {
          when: message.record.wakeAt,
        });
      }
      return true;

    case 'getSnoozed':
      return Storage.getSnoozed();

    case 'restoreSnoozed':
      return restoreSnoozeById(message.id);

    default: {
      // Exhaustiveness guard: a new Message variant without a case above is a
      // compile error here; at runtime an unknown action still throws.
      const unknown: never = message;
      throw new Error(`Unknown action: ${(unknown as Message).action}`);
    }
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
      tabs: tabs.map((t) => ({
        url: t.url || '',
        title: t.title || '',
        pinned: t.pinned || false,
        groupIndex: groups.findIndex((g) => g.id === t.groupId),
      })),
      groups: groups.map((g) => ({
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

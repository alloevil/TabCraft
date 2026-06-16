// TabCraft — Tab Hibernation
// Automatically suspends inactive tabs to save memory
// Uses chrome.alarms for MV3 reliability + chrome.storage for state persistence

import { Storage } from './storage';

const LAST_ACCESS_KEY = 'hibernation_lastAccess';

/** Check if a tab should be excluded from hibernation */
function shouldExclude(tab: chrome.tabs.Tab): boolean {
  if (tab.pinned) return true;
  if (tab.active) return true;
  if (tab.audible) return true;
  if (tab.url?.startsWith('chrome://')) return true;
  if (tab.status === 'loading') return true;
  return false;
}

/**
 * Hibernation Manager
 * Uses chrome.alarms for periodic checks (MV3-safe)
 * Uses chrome.storage.local for lastAccessMap persistence
 */
export class HibernationManager {
  /** Start monitoring tab activity */
  start(): void {
    // Track tab activation — persist to storage
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      await this.updateLastAccess(activeInfo.tabId);
    });

    // Track tab updates
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
      if (changeInfo.status === 'complete') {
        await this.updateLastAccess(tabId);
      }
    });

    // Remove closed tabs from tracking
    chrome.tabs.onRemoved.addListener(async (tabId) => {
      await this.removeLastAccess(tabId);
    });

    // Periodic check is handled by chrome.alarms in index.ts
  }

  /** Update last access time for a tab */
  private async updateLastAccess(tabId: number): Promise<void> {
    const data = await this.getLastAccessMap();
    data[tabId] = Date.now();
    await chrome.storage.local.set({ [LAST_ACCESS_KEY]: data });
  }

  /** Remove a tab from last access tracking */
  private async removeLastAccess(tabId: number): Promise<void> {
    const data = await this.getLastAccessMap();
    delete data[tabId];
    await chrome.storage.local.set({ [LAST_ACCESS_KEY]: data });
  }

  /** Get the last access map from storage */
  private async getLastAccessMap(): Promise<Record<number, number>> {
    return new Promise((resolve) => {
      chrome.storage.local.get(LAST_ACCESS_KEY, (result) => {
        resolve(result[LAST_ACCESS_KEY] || {});
      });
    });
  }

  /** Check all tabs and hibernate inactive ones */
  async checkAndHibernate(): Promise<number> {
    const settings = await Storage.getSettings();
    const timeoutMs = settings.hibernationTimeout * 60 * 1000;
    const now = Date.now();
    const lastAccessMap = await this.getLastAccessMap();

    const tabs = await chrome.tabs.query({ currentWindow: true });
    let hibernated = 0;

    for (const tab of tabs) {
      if (!tab.id || shouldExclude(tab)) continue;

      const lastAccess = lastAccessMap[tab.id] || tab.lastAccessed || 0;
      const inactiveTime = now - lastAccess;

      if (inactiveTime > timeoutMs && !tab.discarded) {
        try {
          await chrome.tabs.discard(tab.id);
          hibernated++;
        } catch (err) {
          console.debug(`[TabCraft] Cannot discard tab ${tab.id}:`, err);
        }
      }
    }

    if (hibernated > 0) {
      await Storage.incrementStat('totalHibernated', hibernated);
      console.log(`[TabCraft] Hibernated ${hibernated} inactive tabs`);
    }

    return hibernated;
  }

  /** Manually hibernate all inactive tabs */
  async hibernateAllInactive(): Promise<number> {
    return this.checkAndHibernate();
  }

  /** Hibernate a specific tab */
  async hibernateTab(tabId: number): Promise<boolean> {
    try {
      await chrome.tabs.discard(tabId);
      await Storage.incrementStat('totalHibernated');
      return true;
    } catch {
      return false;
    }
  }

  /** Get hibernation stats */
  async getStats(): Promise<{ hibernated: number; total: number; memorySaved: string }> {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const hibernated = tabs.filter(t => t.discarded).length;
    const total = tabs.length;

    // Note: actual memory savings vary by tab content
    // This is a rough estimate for display purposes only
    const estimatedSavedMB = hibernated * 50; // ~50MB per tab is a common estimate
    const memorySaved = estimatedSavedMB > 1024
      ? `~${(estimatedSavedMB / 1024).toFixed(1)} GB`
      : `~${estimatedSavedMB} MB`;

    return { hibernated, total, memorySaved };
  }
}

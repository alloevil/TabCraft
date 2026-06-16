// TabCraft — Tab Hibernation
// Automatically suspends inactive tabs to save memory

import { Storage } from './storage';

/** Check if a tab should be excluded from hibernation */
function shouldExclude(tab: chrome.tabs.Tab): boolean {
  // Never hibernate: pinned tabs, active tab, audio-playing tabs, chrome:// pages
  if (tab.pinned) return true;
  if (tab.active) return true;
  if (tab.audible) return true;
  if (tab.url?.startsWith('chrome://')) return true;
  // Never hibernate tabs with form data (pending URL changes)
  if (tab.status === 'loading') return true;
  return false;
}

/**
 * Hibernation Manager
 * Discards inactive tabs to free memory
 */
export class HibernationManager {
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private lastAccessMap: Map<number, number> = new Map();

  /** Start monitoring tab activity */
  start(): void {
    // Track tab activation
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.lastAccessMap.set(activeInfo.tabId, Date.now());
    });

    // Track tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.status === 'complete') {
        this.lastAccessMap.set(tabId, Date.now());
      }
    });

    // Remove closed tabs from tracking
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.lastAccessMap.delete(tabId);
    });

    // Start periodic check
    this.startPeriodicCheck();
  }

  /** Stop monitoring */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /** Start the periodic hibernation check */
  private async startPeriodicCheck(): Promise<void> {
    const settings = await Storage.getSettings();
    const intervalMs = Math.min(settings.hibernationTimeout * 60 * 1000, 5 * 60 * 1000);

    this.checkInterval = setInterval(() => {
      this.checkAndHibernate();
    }, intervalMs);
  }

  /** Check all tabs and hibernate inactive ones */
  async checkAndHibernate(): Promise<number> {
    const settings = await Storage.getSettings();
    const timeoutMs = settings.hibernationTimeout * 60 * 1000;
    const now = Date.now();

    const tabs = await chrome.tabs.query({ currentWindow: true });
    let hibernated = 0;

    for (const tab of tabs) {
      if (!tab.id || shouldExclude(tab)) continue;

      const lastAccess = this.lastAccessMap.get(tab.id) || tab.lastAccessed || 0;
      const inactiveTime = now - lastAccess;

      if (inactiveTime > timeoutMs && !tab.discarded) {
        try {
          await chrome.tabs.discard(tab.id);
          hibernated++;
        } catch (err) {
          // Tab might not be discardable (e.g., DevTools)
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

    // Rough estimate: ~50MB per active tab, ~0.5MB per hibernated tab
    const savedMB = hibernated * 49.5;
    const memorySaved = savedMB > 1024
      ? `${(savedMB / 1024).toFixed(1)} GB`
      : `${savedMB.toFixed(0)} MB`;

    return { hibernated, total, memorySaved };
  }
}
